'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Filter, MapPin, Plane, PlusCircle, UserCog, Users2, X } from 'lucide-react';
import { assignTripManager, createTrip } from '@/lib/api';
import { useStaffDirectoryQuery, useTripsQuery } from '@/lib/queryHooks';
import { useUserStore } from '@/stores/useUserStore';
import type { Trip, TripCreate } from '@/types/api';

type TripFormState = {
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: Trip['status'];
  manager: string;
  heart_rate_min: string;
  heart_rate_max: string;
  spo2_min: string;
  geofence_center_lat: string;
  geofence_center_lng: string;
  geofence_radius_km: string;
};

const initialTripForm: TripFormState = {
  title: '',
  destination: '',
  start_date: '',
  end_date: '',
  status: 'planning',
  manager: '',
  heart_rate_min: '',
  heart_rate_max: '',
  spo2_min: '',
  geofence_center_lat: '',
  geofence_center_lng: '',
  geofence_radius_km: '',
};

const tripStatusMeta: Record<Trip['status'], { label: string; tone: string; chip: string }> = {
  planning: {
    label: '계획 중',
    tone: 'bg-amber-50 text-amber-600 border border-amber-200',
    chip: 'bg-amber-500/15 text-amber-600',
  },
  ongoing: {
    label: '진행 중',
    tone: 'bg-primary-50 text-primary-600 border border-primary-200',
    chip: 'bg-primary-500/15 text-primary-600',
  },
  completed: {
    label: '완료',
    tone: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    chip: 'bg-emerald-500/15 text-emerald-600',
  },
};

const statusFilters: Array<'all' | Trip['status']> = ['all', 'planning', 'ongoing', 'completed'];
const tripStatusEntries = Object.entries(tripStatusMeta) as Array<[
  Trip['status'],
  (typeof tripStatusMeta)[Trip['status']],
]>;

export default function TripsPage() {
  const { data: trips = [], isLoading } = useTripsQuery();
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const [filter, setFilter] = useState<(typeof statusFilters)[number]>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<TripFormState>({ ...initialTripForm });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<Trip | null>(null);
  const [assignManagerId, setAssignManagerId] = useState<number | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const canManageAssignments = user?.role === 'super_admin';

  const createTripMutation = useMutation({
    mutationFn: (payload: TripCreate) => createTrip(payload),
    onSuccess: async (createdTrip) => {
      setForm({ ...initialTripForm });
      setShowCreateModal(false);
      setFormError(null);
      setFormSuccess(`${createdTrip.title} 여행이 생성되었습니다.`);
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '여행 생성 중 오류가 발생했습니다.';
      setFormError(message);
    },
  });

  const staffQueryEnabled = canManageAssignments && (assignTarget !== null || showCreateModal);
  const { data: staffDirectory = [], isLoading: staffLoading } = useStaffDirectoryQuery(
    canManageAssignments ? { is_approved: true } : undefined,
    { enabled: staffQueryEnabled },
  );

  useEffect(() => {
    if (!assignTarget) return;
    if (assignManagerId !== null) return;

    if (typeof assignTarget.manager === 'number') {
      setAssignManagerId(assignTarget.manager);
      return;
    }

    if (staffDirectory.length > 0) {
      setAssignManagerId(staffDirectory[0].id);
    }
  }, [assignManagerId, assignTarget, staffDirectory]);

  useEffect(() => {
    if (!canManageAssignments && assignTarget) {
      setAssignTarget(null);
      setAssignManagerId(null);
      setAssignError(null);
    }
  }, [canManageAssignments, assignTarget]);

  const assignManagerMutation = useMutation({
    mutationFn: ({ tripId, managerId }: { tripId: number; managerId: number }) =>
      assignTripManager(tripId, managerId),
    onSuccess: async (updatedTrip) => {
      setFormSuccess(`${updatedTrip.title} 담당자가 배정되었습니다.`);
      setAssignTarget(null);
      setAssignManagerId(null);
      setAssignError(null);
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '담당자 배정 중 오류가 발생했습니다.';
      setAssignError(message);
    },
  });

  const handleFormChange = (field: keyof TripFormState) =>
    (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleCreateTrip = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!form.title.trim() || !form.destination.trim()) {
      setFormError('여행명과 목적지를 입력해 주세요.');
      return;
    }

    if (!form.start_date || !form.end_date) {
      setFormError('여행 시작일과 종료일을 모두 입력해 주세요.');
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      setFormError('종료일은 시작일 이후여야 합니다.');
      return;
    }

    const parseNumberField = (value: string, label: string) => {
      if (!value.trim()) {
        return { value: null as number | null, hasError: false };
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        setFormError(`${label}은 숫자로 입력해 주세요.`);
        return { value: null as number | null, hasError: true };
      }
      return { value: parsed, hasError: false };
    };

    const { value: heartRateMin, hasError: heartRateMinError } = parseNumberField(
      form.heart_rate_min,
      '최소 심박수',
    );
    if (heartRateMinError) return;

    const { value: heartRateMax, hasError: heartRateMaxError } = parseNumberField(
      form.heart_rate_max,
      '최대 심박수',
    );
    if (heartRateMaxError) return;

    if (heartRateMin !== null && heartRateMax !== null && heartRateMin > heartRateMax) {
      setFormError('최소 심박수는 최대 심박수보다 작거나 같아야 합니다.');
      return;
    }

    const { value: spo2Min, hasError: spo2Error } = parseNumberField(form.spo2_min, '최소 산소포화도');
    if (spo2Error) return;
    if (spo2Min !== null && (spo2Min < 0 || spo2Min > 100)) {
      setFormError('산소포화도는 0부터 100 사이의 값으로 입력해 주세요.');
      return;
    }

    const { value: geofenceLat, hasError: geofenceLatError } = parseNumberField(
      form.geofence_center_lat,
      '지오펜스 위도',
    );
    if (geofenceLatError) return;
    const { value: geofenceLng, hasError: geofenceLngError } = parseNumberField(
      form.geofence_center_lng,
      '지오펜스 경도',
    );
    if (geofenceLngError) return;
    const { value: geofenceRadius, hasError: geofenceRadiusError } = parseNumberField(
      form.geofence_radius_km,
      '허용 반경',
    );
    if (geofenceRadiusError) return;

    const hasGeofenceValue = [form.geofence_center_lat, form.geofence_center_lng, form.geofence_radius_km]
      .some((value) => value.trim().length > 0);

    if (hasGeofenceValue) {
      if (geofenceLat === null || geofenceLng === null || geofenceRadius === null) {
        setFormError('지오펜스를 사용하려면 위도, 경도, 반경을 모두 입력해 주세요.');
        return;
      }
      if (Math.abs(geofenceLat) > 90) {
        setFormError('위도는 -90에서 90 사이의 값으로 입력해 주세요.');
        return;
      }
      if (Math.abs(geofenceLng) > 180) {
        setFormError('경도는 -180에서 180 사이의 값으로 입력해 주세요.');
        return;
      }
      if (geofenceRadius <= 0) {
        setFormError('허용 반경은 0보다 큰 값으로 입력해 주세요.');
        return;
      }
    }

    const { value: managerId, hasError: managerError } = parseNumberField(form.manager, '담당자 ID');
    if (managerError) return;
    const normalizedManager = managerId !== null ? Math.trunc(managerId) : null;

    const payload: TripCreate = {
      title: form.title.trim(),
      destination: form.destination.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
    };

    if (normalizedManager !== null) {
      payload.manager = normalizedManager;
    }
    if (heartRateMin !== null) {
      payload.heart_rate_min = heartRateMin;
    }
    if (heartRateMax !== null) {
      payload.heart_rate_max = heartRateMax;
    }
    if (spo2Min !== null) {
      payload.spo2_min = spo2Min;
    }
    if (geofenceLat !== null && geofenceLng !== null && geofenceRadius !== null) {
      payload.geofence_center_lat = geofenceLat;
      payload.geofence_center_lng = geofenceLng;
      payload.geofence_radius_km = geofenceRadius;
    }

    createTripMutation.mutate(payload);
  };

  const statusCounts = useMemo(() => {
    return trips.reduce(
      (acc, trip) => {
        acc.total += 1;
        acc[trip.status] += 1;
        return acc;
      },
      { total: 0, planning: 0, ongoing: 0, completed: 0 },
    );
  }, [trips]);

  const filteredTrips = useMemo(() => {
    if (filter === 'all') return trips;
    return trips.filter((trip) => trip.status === filter);
  }, [filter, trips]);

  const tableColumnCount = canManageAssignments ? 6 : 5;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">여행 포트폴리오</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">전체 여행 현황</h1>
            <p className="mt-1 text-sm text-slate-500">상태별 진행 상황과 담당자를 한 눈에 파악하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600">
              <Filter className="h-4 w-4" />
              고급 필터
            </button>
            <button
              type="button"
              onClick={() => {
                setForm({ ...initialTripForm });
                setFormError(null);
                setFormSuccess(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <PlusCircle className="h-4 w-4" />
              새 여행 만들기
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TripSummaryCard
            icon={Plane}
            title="전체 여행"
            value={`${statusCounts.total}건`}
            helper="등록된 모든 여행"
          />
          <TripSummaryCard
            icon={CalendarRange}
            title="진행 중"
            value={`${statusCounts.ongoing}건`}
            helper="실시간 운영 중"
            tone="bg-primary-500/10 text-primary-600"
          />
          <TripSummaryCard
            icon={MapPin}
            title="계획 단계"
            value={`${statusCounts.planning}건`}
            helper="기획/견적 준비"
            tone="bg-amber-500/10 text-amber-600"
          />
          <TripSummaryCard
            icon={Users2}
            title="완료 여행"
            value={`${statusCounts.completed}건`}
            helper="성과 분석 대상"
            tone="bg-emerald-500/10 text-emerald-600"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">여행 목록</h2>
            <p className="text-sm text-slate-500">진행 단계별로 필터링하고 담당자를 확인하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusFilters.map((item) => {
              const isActive = item === filter;
              const label = item === 'all' ? '전체' : tripStatusMeta[item].label;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-primary-200 hover:text-primary-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-[#F7F9FC] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">여행명</th>
                <th className="px-5 py-3 text-left font-semibold">기간</th>
                <th className="px-5 py-3 text-left font-semibold">담당자</th>
                <th className="px-5 py-3 text-left font-semibold">상태</th>
                <th className="px-5 py-3 text-right font-semibold">참가자</th>
                {canManageAssignments && <th className="px-5 py-3 text-right font-semibold">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading && (
                <tr>
                  <td colSpan={tableColumnCount} className="px-5 py-6 text-center text-sm text-slate-500">
                    여행 정보를 불러오는 중입니다.
                  </td>
                </tr>
              )}
              {!isLoading && filteredTrips.length === 0 && (
                <tr>
                  <td colSpan={tableColumnCount} className="px-5 py-6 text-center text-sm text-slate-500">
                    조건에 해당하는 여행이 없습니다.
                  </td>
                </tr>
              )}
              {filteredTrips.map((trip) => {
                const status = tripStatusMeta[trip.status];
                return (
                  <tr key={trip.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-slate-800">{trip.title}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {trip.start_date} ~ {trip.end_date}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{trip.manager_name ?? '담당자 미지정'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}>
                        <span className={`h-2 w-2 rounded-full ${status.chip}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-600">{trip.participant_count ?? 0}명</td>
                    {canManageAssignments && (
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignTarget(trip);
                            setAssignManagerId(trip.manager ?? null);
                            setAssignError(null);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-600 shadow-sm transition hover:bg-primary-100"
                        >
                          <UserCog className="h-4 w-4" /> 담당자 배정
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {formSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-600 shadow-sm">
          {formSuccess}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">새로운 여행</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">여행 기본 정보를 입력하세요</h2>
                <p className="mt-1 text-sm text-slate-500">날짜와 상태는 추후에도 수정할 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full border border-slate-200 p-1.5 text-slate-400 transition hover:border-primary-200 hover:text-primary-600"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {formError}
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={handleCreateTrip}>
              <div className="space-y-2">
                <label htmlFor="trip-title" className="text-sm font-semibold text-slate-700">
                  여행명
                </label>
                <input
                  id="trip-title"
                  type="text"
                  value={form.title}
                  onChange={(event) => handleFormChange('title')(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  placeholder="예: 히말라야 트레킹"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="trip-destination" className="text-sm font-semibold text-slate-700">
                  목적지
                </label>
                <input
                  id="trip-destination"
                  type="text"
                  value={form.destination}
                  onChange={(event) => handleFormChange('destination')(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  placeholder="예: 네팔 카트만두"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="trip-start" className="text-sm font-semibold text-slate-700">
                    시작일
                  </label>
                  <input
                    id="trip-start"
                    type="date"
                    value={form.start_date}
                    onChange={(event) => handleFormChange('start_date')(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="trip-end" className="text-sm font-semibold text-slate-700">
                    종료일
                  </label>
                  <input
                    id="trip-end"
                    type="date"
                    value={form.end_date}
                    onChange={(event) => handleFormChange('end_date')(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="trip-status" className="text-sm font-semibold text-slate-700">
                    진행 상태
                  </label>
                  <select
                    id="trip-status"
                    value={form.status}
                    onChange={(event) => handleFormChange('status')(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  >
                    {tripStatusEntries.map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="trip-manager-select">
                    담당자 (선택)
                  </label>
                  {canManageAssignments ? (
                    staffLoading && staffQueryEnabled ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        담당자 목록을 불러오는 중입니다.
                      </div>
                    ) : staffQueryEnabled && staffDirectory.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-600">
                        승인된 담당자가 없어 바로 배정할 수 없습니다.
                      </div>
                    ) : (
                      <select
                        id="trip-manager-select"
                        value={form.manager}
                        onChange={(event) => handleFormChange('manager')(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      >
                        <option value="">담당자 미지정</option>
                        {staffDirectory.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name_kr} · {member.role_display}
                          </option>
                        ))}
                      </select>
                    )
                  ) : (
                    <div className="rounded-xl border border-slate-100 bg-[#F9FBFF] px-4 py-3 text-sm text-slate-500">
                      담당자 배정은 총괄담당자만 설정할 수 있습니다.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-100 bg-[#F7F9FC] p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">모니터링 임계치</h3>
                  <p className="text-xs text-slate-500">심박수와 산소포화도 기준을 설정하면 실시간 경보에 활용됩니다.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="trip-heart-min" className="text-xs font-semibold text-slate-600">
                      최소 심박수 (bpm)
                    </label>
                    <input
                      id="trip-heart-min"
                      type="number"
                      min={0}
                      value={form.heart_rate_min}
                      onChange={(event) => handleFormChange('heart_rate_min')(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      placeholder="예: 50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="trip-heart-max" className="text-xs font-semibold text-slate-600">
                      최대 심박수 (bpm)
                    </label>
                    <input
                      id="trip-heart-max"
                      type="number"
                      min={0}
                      value={form.heart_rate_max}
                      onChange={(event) => handleFormChange('heart_rate_max')(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      placeholder="예: 120"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="trip-spo2-min" className="text-xs font-semibold text-slate-600">
                      최소 산소포화도 (%)
                    </label>
                    <input
                      id="trip-spo2-min"
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={form.spo2_min}
                      onChange={(event) => handleFormChange('spo2_min')(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      placeholder="예: 94.5"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-100 bg-[#F7F9FC] p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">위치 기반 안전 구역</h3>
                  <p className="text-xs text-slate-500">지오펜스 기준점을 설정하면 여행 중 이탈 여부를 감지합니다.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="trip-geofence-lat" className="text-xs font-semibold text-slate-600">
                      위도
                    </label>
                    <input
                      id="trip-geofence-lat"
                      type="number"
                      step="0.000001"
                      value={form.geofence_center_lat}
                      onChange={(event) => handleFormChange('geofence_center_lat')(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      placeholder="예: 37.5665"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="trip-geofence-lng" className="text-xs font-semibold text-slate-600">
                      경도
                    </label>
                    <input
                      id="trip-geofence-lng"
                      type="number"
                      step="0.000001"
                      value={form.geofence_center_lng}
                      onChange={(event) => handleFormChange('geofence_center_lng')(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      placeholder="예: 126.9780"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="trip-geofence-radius" className="text-xs font-semibold text-slate-600">
                      허용 반경 (km)
                    </label>
                    <input
                      id="trip-geofence-radius"
                      type="number"
                      min={0}
                      step="0.1"
                      value={form.geofence_radius_km}
                      onChange={(event) => handleFormChange('geofence_radius_km')(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      placeholder="예: 2.5"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={createTripMutation.isLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createTripMutation.isLoading ? '생성 중...' : '여행 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignTarget && canManageAssignments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">담당자 배정</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{assignTarget.title}</h2>
                <p className="mt-1 text-sm text-slate-500">승인된 직원 중 담당자를 선택해 배정하세요.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignTarget(null);
                  setAssignManagerId(null);
                  setAssignError(null);
                }}
                className="rounded-full border border-slate-200 p-1.5 text-slate-400 transition hover:border-primary-200 hover:text-primary-600"
                aria-label="담당자 배정 창 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {assignError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {assignError}
              </div>
            )}

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!assignTarget) return;
                if (!assignManagerId) {
                  setAssignError('담당자를 선택해 주세요.');
                  return;
                }
                setAssignError(null);
                assignManagerMutation.mutate({ tripId: assignTarget.id, managerId: assignManagerId });
              }}
            >
              <div className="space-y-2">
                <label htmlFor="trip-manager" className="text-sm font-semibold text-slate-700">
                  담당자 선택
                </label>
                {staffLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    담당자 목록을 불러오는 중입니다.
                  </div>
                ) : staffDirectory.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-600">
                    승인된 직원이 없어 담당자를 배정할 수 없습니다.
                  </div>
                ) : (
                  <select
                    id="trip-manager"
                    value={assignManagerId ?? ''}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setAssignManagerId(Number.isNaN(value) ? null : value);
                    }}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                    required
                  >
                    {staffDirectory.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name_kr} · {member.role_display}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rounded-2xl bg-[#F7F9FC] px-4 py-3 text-xs text-slate-500">
                현재 담당자 ·{' '}
                <span className="font-semibold text-slate-700">{assignTarget.manager_name ?? '미지정'}</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignTarget(null);
                    setAssignManagerId(null);
                    setAssignError(null);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={assignManagerMutation.isLoading || staffDirectory.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assignManagerMutation.isLoading ? '배정 중...' : '담당자 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TripSummaryCard({
  icon: Icon,
  title,
  value,
  helper,
  tone = 'bg-slate-500/10 text-slate-600',
}: {
  icon: (props: { className?: string }) => JSX.Element;
  title: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}
