'use client';
 
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  ChevronDown,
  Clock8,
  Info,
  ListChecks,
  MapPin,
  Route,
  Search,
} from 'lucide-react';
import { createSchedule } from '@/lib/api';
import { usePlacesQuery, useSchedulesQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { Schedule, ScheduleCreate, Trip } from '@/types/api';

const minutesToLabel = (minutes?: number | null) => {
  if (!minutes) return '소요 시간 정보 없음';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
};

const initialScheduleForm = {
  day_number: 1,
  start_time: '09:00',
  end_time: '11:00',
  main_content: '',
  meeting_point: '',
  transport: '',
  budget: '',
  place_id: '',
  order: '',
};

type ScheduleFormState = typeof initialScheduleForm;

export default function SchedulesPage() {
  const {
    data: trips = [],
    isLoading: tripsLoading,
    isSuperAdmin,
  } = useScopedTrips();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [tripFilter, setTripFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | number>('details');
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ScheduleFormState>({ ...initialScheduleForm });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (trips.length === 0) {
      if (selectedTripId !== null) {
        setSelectedTripId(null);
      }
      return;
    }

    if (selectedTripId === null || !trips.some((trip) => trip.id === selectedTripId)) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips, selectedTripId]);

  useEffect(() => {
    setActiveTab('details');
  }, [selectedTripId]);

  const currentTrip = useMemo<Trip | null>(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );

  const { data: schedules = [], isLoading } = useSchedulesQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
  });

  const { data: places = [], isLoading: placesLoading } = usePlacesQuery();

  const canSelectTrip = trips.length > 1;
  const canEditSchedule = !isSuperAdmin;
  const noTripMessage = isSuperAdmin ? '등록된 여행이 없습니다.' : '담당된 여행이 없습니다.';

  const filteredTrips = useMemo(() => {
    const keyword = tripFilter.trim().toLowerCase();
    if (!keyword) return trips;
    return trips.filter((trip) => {
      const haystack = [trip.title, trip.destination, trip.manager_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [tripFilter, trips]);

  const filterActive = tripFilter.trim().length > 0;
  const emptyTripMessage = filterActive ? '조건에 맞는 여행이 없습니다.' : noTripMessage;

  const grouped = useMemo(() => {
    const record = new Map<number, Schedule[]>();
    schedules.forEach((schedule) => {
      const current = record.get(schedule.day_number) ?? [];
      current.push(schedule);
      record.set(schedule.day_number, current);
    });
    return Array.from(record.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, items]) => ({
        day,
        items: items.sort((a, b) => a.order - b.order),
      }));
  }, [schedules]);

  const tripDayCount = useMemo(() => {
    if (!currentTrip) {
      return grouped.length > 0 ? grouped.length : 0;
    }
    const start = new Date(currentTrip.start_date);
    const end = new Date(currentTrip.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return grouped.length > 0 ? grouped.length : 0;
    }
    const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return Math.max(diff + 1, grouped.length || 1);
  }, [currentTrip, grouped.length]);

  const dayTabs = useMemo(() => {
    if (tripDayCount === 0) {
      return grouped.length > 0 ? grouped.map((item) => item.day) : [1];
    }
    return Array.from({ length: tripDayCount }, (_, index) => index + 1);
  }, [grouped, tripDayCount]);

  useEffect(() => {
    if (typeof activeTab === 'number' && !dayTabs.includes(activeTab)) {
      setActiveTab(dayTabs[0] ?? 'details');
    }
  }, [activeTab, dayTabs]);

  const totalMinutes = useMemo(
    () => schedules.reduce((acc, schedule) => acc + (schedule.duration_minutes ?? 0), 0),
    [schedules],
  );

  const upcoming = grouped[0]?.items.slice(0, 2) ?? [];

  const activeDaySchedules = useMemo(() => {
    if (typeof activeTab !== 'number') return [] as Schedule[];
    return grouped.find((item) => item.day === activeTab)?.items ?? [];
  }, [activeTab, grouped]);

  const activeDayDuration = useMemo(() => {
    if (typeof activeTab !== 'number') return 0;
    return activeDaySchedules.reduce((acc, schedule) => acc + (schedule.duration_minutes ?? 0), 0);
  }, [activeDaySchedules, activeTab]);

  const createScheduleMutation = useMutation({
    mutationFn: ({ tripId, payload }: { tripId: number; payload: ScheduleCreate }) =>
      createSchedule(tripId, payload),
    onSuccess: async (_created, variables) => {
      setForm((prev) => ({ ...initialScheduleForm, day_number: prev.day_number }));
      setFormSuccess('새 일정이 추가되었습니다.');
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId, 'schedules'] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '일정 생성 중 오류가 발생했습니다.';
      setFormError(message);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleFormChange = (field: keyof ScheduleFormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const normalizeTime = (value: string) => {
    if (!value) return value;
    return value.length === 5 ? `${value}:00` : value;
  };

  const handleSubmitSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!selectedTripId) {
      setFormError('일정을 추가할 여행을 먼저 선택해 주세요.');
      return;
    }

    if (typeof activeTab !== 'number') {
      setFormError('일정을 추가할 일차를 선택해 주세요.');
      return;
    }

    if (!form.main_content.trim() && !form.meeting_point.trim()) {
      setFormError('일정 내용 또는 집결지를 입력해 주세요.');
      return;
    }

    const normalizedStart = normalizeTime(form.start_time);
    const normalizedEnd = normalizeTime(form.end_time);
    const dayNumber = activeTab;

    const sameDaySchedules = schedules.filter((schedule) => schedule.day_number === dayNumber);

    if (form.budget && Number(form.budget) < 0) {
      setFormError('예산은 0 이상의 금액으로 입력해 주세요.');
      return;
    }

    let placeId: number | null = null;
    if (form.place_id.trim()) {
      const parsedPlace = Number(form.place_id);
      if (Number.isNaN(parsedPlace)) {
        setFormError('방문 장소를 올바르게 선택해 주세요.');
        return;
      }
      placeId = parsedPlace;
    }

    const nextOrder = sameDaySchedules.reduce((order, schedule) => {
      const candidate = typeof schedule.order === 'number' ? schedule.order : 0;
      return Math.max(order, candidate);
    }, 0);

    let manualOrder: number | null = null;
    if (form.order.trim()) {
      const parsedOrder = Number(form.order);
      if (Number.isNaN(parsedOrder) || parsedOrder < 1) {
        setFormError('순서는 1 이상의 숫자로 입력해 주세요.');
        return;
      }
      manualOrder = Math.floor(parsedOrder);
    }

    const payload: ScheduleCreate = {
      day_number: dayNumber,
      start_time: normalizedStart,
      end_time: normalizedEnd,
      main_content: form.main_content.trim() || null,
      meeting_point: form.meeting_point.trim() || null,
      transport: form.transport.trim() || null,
      budget: form.budget ? Number(form.budget) : null,
      order: manualOrder ?? nextOrder + 1,
    };

    if (placeId !== null) {
      payload.place_id = placeId;
    }

    setIsSubmitting(true);
    createScheduleMutation.mutate({ tripId: selectedTripId, payload });
  };

  useEffect(() => {
    setForm((prev) => ({ ...prev, day_number: typeof activeTab === 'number' ? activeTab : dayTabs[0] ?? 1 }));
  }, [activeTab, dayTabs]);

  const formatTripPeriod = (trip: Trip) => {
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return '기간 미정';
    }
    const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return `${start.toLocaleDateString('ko-KR')} ~ ${end.toLocaleDateString('ko-KR')} (${diff + 1}일차)`;
  };

  const formatStartDate = (value?: string | null) => {
    if (!value) return '미정';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '미정';
    return parsed.toLocaleDateString('ko-KR');
  };

  const handleSelectTrip = (tripId: number) => {
    setSelectedTripId(tripId);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">여행 전 관리</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">여행 전 관리 리스트</h1>
            <p className="mt-1 text-sm text-slate-500">진행 중인 여행 일정을 한눈에 확인하고 관리할 대상을 선택하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
              <Search className="h-4 w-4 text-primary-500" />
              <input
                value={tripFilter}
                onChange={(event) => setTripFilter(event.target.value)}
                placeholder="여행명, 담당자 검색"
                className="w-40 border-none bg-transparent placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-[#F7F9FC] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">구분</th>
                <th className="px-5 py-3 text-left font-semibold">신청인 수</th>
                <th className="px-5 py-3 text-left font-semibold">여행명</th>
                <th className="px-5 py-3 text-left font-semibold">담당자</th>
                <th className="px-5 py-3 text-left font-semibold">시작일자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tripsLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    여행 정보를 불러오는 중입니다.
                  </td>
                </tr>
              )}
              {!tripsLoading && filteredTrips.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    {emptyTripMessage}
                  </td>
                </tr>
              )}
              {filteredTrips.map((trip, index) => {
                const isSelected = trip.id === selectedTripId;
                return (
                  <tr
                    key={trip.id}
                    onClick={() => handleSelectTrip(trip.id)}
                    className={`cursor-pointer transition hover:bg-primary-50/60 ${
                      isSelected ? 'bg-primary-50/80 text-primary-700' : 'text-slate-600'
                    }`}
                  >
                    <td className="px-5 py-3 font-semibold">{index + 1}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{trip.participant_count ?? 0}명</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">{trip.title}</span>
                        <span className="text-xs text-slate-500">
                          {trip.destination ?? '목적지 미정'} · {formatTripPeriod(trip)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{trip.manager_name ?? '담당자 미지정'}</td>
                    <td className="px-5 py-3 text-slate-600">{formatStartDate(trip.start_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">여행 일정</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">선택한 여행 타임라인</h2>
            <p className="mt-1 text-sm text-slate-500">
              {canEditSchedule
                ? '상세 정보와 일차별 타임라인을 확인하고 새 일정을 등록하세요.'
                : '총괄관리자는 모든 여행의 타임라인을 열람할 수 있습니다.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canSelectTrip ? (
              <div className="relative">
                <select
                  value={selectedTripId ?? ''}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) {
                      setSelectedTripId(null);
                      return;
                    }
                    setSelectedTripId(value);
                  }}
                  className="appearance-none rounded-full border border-slate-200 bg-white px-4 py-2 pr-10 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus:border-primary-300 focus:outline-none"
                >
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            ) : currentTrip ? (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                {currentTrip.title}
              </span>
            ) : null}
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600">
              <Route className="h-4 w-4" />
              이동 동선 최적화
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'details'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'border border-slate-200 text-slate-600 hover:border-primary-200 hover:text-primary-600'
            }`}
          >
            상세 정보
          </button>
          {dayTabs.map((day) => {
            const isActive = activeTab === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setActiveTab(day)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'border border-slate-200 text-slate-600 hover:border-primary-200 hover:text-primary-600'
                }`}
              >
                {day}일차
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-6">
          {activeTab === 'details' ? (
            <div className="space-y-6">
              {currentTrip ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-[#F7F9FC] p-5">
                    <div className="flex items-center gap-3">
                      <Info className="h-5 w-5 text-primary-500" />
                      <h3 className="text-base font-semibold text-slate-900">여행 정보</h3>
                    </div>
                    <dl className="mt-4 space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <dt className="font-medium text-slate-500">여행지</dt>
                        <dd className="font-semibold text-slate-900">{currentTrip.destination}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-slate-500">기간</dt>
                        <dd>{formatTripPeriod(currentTrip)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-slate-500">담당자</dt>
                        <dd>{currentTrip.manager_name ?? '배정 대기'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-slate-500">참가자</dt>
                        <dd>{currentTrip.participant_count ?? 0}명</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-[#F7F9FC] p-5">
                    <div className="flex items-center gap-3">
                      <ListChecks className="h-5 w-5 text-primary-500" />
                      <h3 className="text-base font-semibold text-slate-900">운영 메모</h3>
                    </div>
                    <p className="mt-4 text-sm text-slate-600">
                      일정 등록 현황과 소요 시간을 확인해 운영팀과 공유하세요. 필요 시 담당자와 실시간으로 조율할 수 있습니다.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                  {tripsLoading ? '여행 정보를 불러오는 중입니다.' : noTripMessage}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ScheduleSummaryCard
                  icon={CalendarClock}
                  label="등록 일정"
                  value={`${schedules.length}건`}
                  helper="선택한 여행의 전체 일정"
                />
                <ScheduleSummaryCard
                  icon={Clock8}
                  label="예상 소요"
                  value={minutesToLabel(totalMinutes)}
                  helper="전체 체류 시간"
                />
                <ScheduleSummaryCard
                  icon={MapPin}
                  label="운영 일수"
                  value={`${dayTabs.length}일차`}
                  helper="여행 진행 일수"
                />
                <ScheduleSummaryCard
                  icon={Route}
                  label="다가오는 일정"
                  value={
                    upcoming.length > 0
                      ? upcoming[0].main_content ?? upcoming[0].place_name ?? '세부 일정 미정'
                      : '일정 미정'
                  }
                  helper={upcoming[0] ? `${upcoming[0].start_time.slice(0, 5)} 시작` : '최신 업데이트 없음'}
                  compact
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {isLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                  일정을 불러오는 중입니다.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">{activeTab}일차 타임라인</h3>
                    <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                      총 소요 {minutesToLabel(activeDayDuration)}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-[#F7F9FC] text-slate-500">
                        <tr>
                          <th className="px-5 py-3 text-left font-semibold">시간</th>
                          <th className="px-5 py-3 text-left font-semibold">일정 내용</th>
                          <th className="px-5 py-3 text-left font-semibold">집결지</th>
                          <th className="px-5 py-3 text-left font-semibold">이동 수단</th>
                          <th className="px-5 py-3 text-right font-semibold">예산</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {activeDaySchedules.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                              {canEditSchedule
                                ? '아직 등록된 일정이 없습니다. 아래에서 일정을 추가해 보세요.'
                                : '아직 등록된 일정이 없습니다. 담당자에게 등록을 요청해 주세요.'}
                            </td>
                          </tr>
                        )}
                        {activeDaySchedules.map((schedule) => {
                          const placeId =
                            typeof schedule.place_id === 'number'
                              ? schedule.place_id
                              : typeof schedule.place === 'number'
                                ? schedule.place
                                : null;
                          const placeLabel = schedule.place_name ?? null;
                          return (
                            <tr key={schedule.id} className="transition hover:bg-slate-50/70">
                              <td className="px-5 py-3 font-medium text-slate-700">
                                {schedule.start_time.slice(0, 5)} ~ {schedule.end_time.slice(0, 5)}
                              </td>
                              <td className="px-5 py-3 text-slate-700">
                                <div className="font-semibold text-slate-900">
                                  {schedule.main_content ? (
                                    schedule.main_content
                                  ) : placeLabel ? (
                                    placeId ? (
                                      <Link
                                        href={`/places/${placeId}${selectedTripId ? `?tripId=${selectedTripId}` : ''}`}
                                        className="text-primary-600 transition hover:text-primary-700"
                                      >
                                        {placeLabel}
                                      </Link>
                                    ) : (
                                      placeLabel
                                    )
                                  ) : (
                                    '세부 일정 미정'
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">#{schedule.order.toString().padStart(2, '0')}</div>
                                {schedule.main_content && placeLabel && (
                                  placeId ? (
                                    <Link
                                      href={`/places/${placeId}${selectedTripId ? `?tripId=${selectedTripId}` : ''}`}
                                      className="mt-1 inline-flex text-xs font-semibold text-primary-600 transition hover:text-primary-700"
                                    >
                                      장소: {placeLabel}
                                    </Link>
                                  ) : (
                                    <div className="mt-1 text-xs text-slate-500">장소: {placeLabel}</div>
                                  )
                                )}
                              </td>
                              <td className="px-5 py-3 text-slate-600">{schedule.meeting_point ?? '집결지 미정'}</td>
                              <td className="px-5 py-3 text-slate-600">{schedule.transport ?? '미정'}</td>
                              <td className="px-5 py-3 text-right text-slate-700">
                                {schedule.budget ? `${schedule.budget.toLocaleString()}원` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {canEditSchedule ? (
                    <div className="rounded-2xl border border-slate-100 bg-[#F9FBFF] p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-semibold text-slate-900">새 일정 추가</h4>
                          <p className="text-sm text-slate-500">{activeTab}일차에 필요한 일정을 즉시 등록하세요.</p>
                        </div>
                        {formSuccess && (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                            {formSuccess}
                          </span>
                        )}
                      </div>

                      {formError && (
                        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                          {formError}
                        </div>
                      )}

                      <form className="grid gap-4" onSubmit={handleSubmitSchedule}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label htmlFor="schedule-start" className="text-sm font-semibold text-slate-700">
                            시작 시간
                          </label>
                          <input
                            id="schedule-start"
                            type="time"
                            value={form.start_time}
                            onChange={(event) => handleFormChange('start_time')(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="schedule-end" className="text-sm font-semibold text-slate-700">
                            종료 시간
                          </label>
                          <input
                            id="schedule-end"
                            type="time"
                            value={form.end_time}
                            onChange={(event) => handleFormChange('end_time')(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="schedule-content" className="text-sm font-semibold text-slate-700">
                          주요 활동
                        </label>
                        <input
                          id="schedule-content"
                          type="text"
                          value={form.main_content}
                          onChange={(event) => handleFormChange('main_content')(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                          placeholder="예: 문화 체험 프로그램"
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="schedule-place" className="text-sm font-semibold text-slate-700">
                          방문 장소
                        </label>
                        {placesLoading ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                            방문 가능 장소를 불러오는 중입니다.
                          </div>
                        ) : places.length === 0 ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-600">
                            등록된 장소가 없습니다. 장소 관리에서 먼저 추가해 주세요.
                          </div>
                        ) : (
                          <select
                            id="schedule-place"
                            value={form.place_id}
                            onChange={(event) => handleFormChange('place_id')(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                          >
                            <option value="">방문 장소 미정</option>
                            {places.map((place) => (
                              <option key={place.id} value={place.id}>
                                {place.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="schedule-meeting" className="text-sm font-semibold text-slate-700">
                          집결지
                        </label>
                        <input
                          id="schedule-meeting"
                          type="text"
                          value={form.meeting_point}
                          onChange={(event) => handleFormChange('meeting_point')(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                          placeholder="예: 호텔 로비"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <label htmlFor="schedule-transport" className="text-sm font-semibold text-slate-700">
                            이동 수단
                          </label>
                          <input
                            id="schedule-transport"
                            type="text"
                            value={form.transport}
                            onChange={(event) => handleFormChange('transport')(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                            placeholder="예: 전용 버스"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="schedule-budget" className="text-sm font-semibold text-slate-700">
                            예산 (원)
                          </label>
                          <input
                            id="schedule-budget"
                            type="number"
                            min={0}
                            value={form.budget}
                            onChange={(event) => handleFormChange('budget')(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                          placeholder="예: 50000"
                        />
                      </div>
                        <div className="space-y-2">
                          <label htmlFor="schedule-order" className="text-sm font-semibold text-slate-700">
                            순서 (선택)
                          </label>
                          <input
                            id="schedule-order"
                            type="number"
                            min={1}
                            value={form.order}
                            onChange={(event) => handleFormChange('order')(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                            placeholder="자동 배정"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setForm({ ...initialScheduleForm, day_number: typeof activeTab === 'number' ? activeTab : 1 });
                            setFormError(null);
                            setFormSuccess(null);
                          }}
                          className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
                        >
                          초기화
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmitting ? '등록 중...' : '일정 등록'}
                        </button>
                      </div>
                      </form>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
                      총괄관리자는 일정 등록 권한이 없습니다. 담당자 화면에서 여행 일정을 관리합니다.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ScheduleSummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  compact = false,
}: {
  icon: (props: { className?: string }) => JSX.Element;
  label: string;
  value: string;
  helper: string;
  compact?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-3 text-2xl font-bold text-slate-900 ${compact ? 'leading-snug' : ''}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}
