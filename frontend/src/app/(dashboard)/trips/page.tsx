'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Filter, MapPin, Plane, PlusCircle, UserCog, Users2, X } from 'lucide-react';
import { assignTripManager, createTrip } from '@/lib/api';
import { useStaffDirectoryQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { Trip, TripCreate } from '@/types/api';

type TripFormState = {
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
};

const initialTripForm: TripFormState = {
  title: '',
  destination: '',
  start_date: '',
  end_date: '',
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

export default function TripsPage() {
  const { data: trips = [], isLoading: tripsLoading, isSuperAdmin } = useScopedTrips();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof statusFilters)[number]>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<TripFormState>({ ...initialTripForm });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<Trip | null>(null);
  const [assignManagerId, setAssignManagerId] = useState<number | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const canManageAssignments = isSuperAdmin;
  const canCreateTrips = isSuperAdmin;

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

  const { data: staffDirectory = [], isLoading: staffLoading } = useStaffDirectoryQuery(
    assignTarget && canManageAssignments ? { is_approved: true } : undefined,
    { enabled: canManageAssignments && assignTarget !== null },
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

    const payload: TripCreate = {
      title: form.title.trim(),
      destination: form.destination.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
    };

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
  const emptyTableMessage = filter === 'all'
    ? (isSuperAdmin ? '등록된 여행이 없습니다.' : '담당된 여행이 아직 배정되지 않았습니다.')
    : '조건에 해당하는 여행이 없습니다.';

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
            {canCreateTrips ? (
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
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400">
                조회 전용 모드
              </span>
            )}
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
              {tripsLoading && (
                <tr>
                  <td colSpan={tableColumnCount} className="px-5 py-6 text-center text-sm text-slate-500">
                    여행 정보를 불러오는 중입니다.
                  </td>
                </tr>
              )}
              {!tripsLoading && filteredTrips.length === 0 && (
                <tr>
                  <td colSpan={tableColumnCount} className="px-5 py-6 text-center text-sm text-slate-500">
                    {emptyTableMessage}
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
