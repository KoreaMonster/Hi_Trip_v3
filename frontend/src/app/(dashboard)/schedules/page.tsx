'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ChevronDown, Clock8, MapPin, RefreshCcw, Route, Search } from 'lucide-react';
import { createSchedule, rebalanceTripSchedules } from '@/lib/api';
import { usePlaceAutocompleteQuery, usePlaceLookupQuery, useSchedulesQuery, useTripsQuery } from '@/lib/queryHooks';
import type {
  Place,
  Schedule,
  ScheduleCreate,
  ScheduleRebalanceRequest,
  TravelMode,
  Trip,
} from '@/types/api';

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
};

type ScheduleFormState = typeof initialScheduleForm;

export default function SchedulesPage() {
  const { data: trips = [] } = useTripsQuery();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ScheduleFormState>({ ...initialScheduleForm });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rebalanceDay, setRebalanceDay] = useState<number | null>(null);
  const [rebalanceMode, setRebalanceMode] = useState<TravelMode>('DRIVE');
  const [rebalanceStartTime, setRebalanceStartTime] = useState('09:00');
  const [rebalanceFeedback, setRebalanceFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [placeQuery, setPlaceQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [pendingLookupId, setPendingLookupId] = useState<string | null>(null);
  const autocompleteSessionToken = useMemo(() => Math.random().toString(36).slice(2), []);

  const { data: placeSuggestions } = usePlaceAutocompleteQuery(placeQuery, autocompleteSessionToken, {
    enabled: placeQuery.trim().length >= 2,
    staleTime: 1000 * 10,
  });

  const { isFetching: isResolvingPlace } = usePlaceLookupQuery(pendingLookupId ?? undefined, {
    enabled: Boolean(pendingLookupId),
    staleTime: 0,
    onSuccess: (place) => {
      setSelectedPlace(place);
      setPendingLookupId(null);
      setPlaceQuery(place.name ?? '');
    },
    onError: () => {
      setPendingLookupId(null);
    },
  });

  useEffect(() => {
    if (trips.length > 0 && selectedTripId === null) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips, selectedTripId]);

  const currentTrip = useMemo<Trip | undefined>(
    () => trips.find((trip) => trip.id === selectedTripId ?? trips[0]?.id),
    [trips, selectedTripId],
  );

  const { data: schedules = [], isLoading } = useSchedulesQuery(selectedTripId ?? undefined);

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

  const totalMinutes = useMemo(
    () => schedules.reduce((acc, schedule) => acc + (schedule.duration_minutes ?? 0), 0),
    [schedules],
  );

  const upcoming = grouped[0]?.items.slice(0, 2) ?? [];

  useEffect(() => {
    if (grouped.length > 0) {
      setRebalanceDay((current) => current ?? grouped[0].day);
    } else {
      setRebalanceDay(null);
    }
  }, [grouped]);

  useEffect(() => {
    if (!rebalanceDay) {
      return;
    }

    const target = grouped.find((group) => group.day === rebalanceDay);
    if (!target || target.items.length === 0) {
      return;
    }

    const earliest = target.items.reduce((selected, current) => {
      if (!selected) {
        return current;
      }
      return current.start_time < selected.start_time ? current : selected;
    }, target.items[0]);

    setRebalanceStartTime(earliest.start_time.slice(0, 5));
  }, [grouped, rebalanceDay]);

  const createScheduleMutation = useMutation({
    mutationFn: ({ tripId, payload }: { tripId: number; payload: ScheduleCreate }) =>
      createSchedule(tripId, payload),
    onSuccess: async (_created, variables) => {
      setForm({ ...initialScheduleForm });
      setFormSuccess('새 일정이 추가되었습니다.');
      setFormError(null);
      setSelectedPlace(null);
      setPlaceQuery('');
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

  const rebalanceMutation = useMutation({
    mutationFn: ({ tripId, payload }: { tripId: number; payload: ScheduleRebalanceRequest }) =>
      rebalanceTripSchedules(tripId, payload),
    onSuccess: async (response, variables) => {
      setRebalanceFeedback({ type: 'success', message: `DAY ${response.day_number} 일정이 재배치되었습니다.` });
      await queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId, 'schedules'] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '일정을 재배치하는 동안 오류가 발생했습니다. 다시 시도해 주세요.';
      setRebalanceFeedback({ type: 'error', message });
    },
  });

  const handleFormChange = (field: keyof ScheduleFormState) => (value: string) => {
    setForm((prev) => {
      if (field === 'day_number') {
        const parsed = Number(value);
        const normalized = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
        return { ...prev, day_number: normalized };
      }
      return { ...prev, [field]: value };
    });
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

    if (!form.main_content.trim() && !form.meeting_point.trim()) {
      setFormError('일정 내용 또는 집결지를 입력해 주세요.');
      return;
    }

    if (placeQuery.trim() && !selectedPlace) {
      setFormError('방문 장소를 자동완성 목록에서 선택해 주세요.');
      return;
    }

    const normalizedStart = normalizeTime(form.start_time);
    const normalizedEnd = normalizeTime(form.end_time);
    const dayNumber = Number(form.day_number) || 1;

    const sameDaySchedules = schedules.filter((schedule) => schedule.day_number === dayNumber);

    const nextOrder = sameDaySchedules.reduce((order, schedule) => {
      const candidate = typeof schedule.order === 'number' ? schedule.order : 0;
      return Math.max(order, candidate);
    }, 0);

    const payload: ScheduleCreate = {
      place_id: selectedPlace?.id ?? null,
      day_number: dayNumber,
      start_time: normalizedStart,
      end_time: normalizedEnd,
      main_content: form.main_content.trim() || null,
      meeting_point: form.meeting_point.trim() || null,
      transport: form.transport.trim() || null,
      budget: form.budget ? Number(form.budget) : null,
      order: nextOrder + 1,
    };

    setIsSubmitting(true);
    createScheduleMutation.mutate({ tripId: selectedTripId, payload });
  };

  const handleRebalanceSchedules = () => {
    setRebalanceFeedback(null);

    if (!selectedTripId) {
      setRebalanceFeedback({ type: 'error', message: '재배치할 여행을 먼저 선택해 주세요.' });
      return;
    }

    if (!rebalanceDay) {
      setRebalanceFeedback({ type: 'error', message: '재배치할 일차를 선택해 주세요.' });
      return;
    }

    const targetGroup = grouped.find((group) => group.day === rebalanceDay);
    if (!targetGroup || targetGroup.items.length === 0) {
      setRebalanceFeedback({ type: 'error', message: '선택한 일차에 일정이 없습니다.' });
      return;
    }

    const scheduleIds = targetGroup.items.map((schedule) => schedule.id);
    const payload: ScheduleRebalanceRequest = {
      day_number: rebalanceDay,
      schedule_ids: scheduleIds,
      travel_mode: rebalanceMode,
    };

    const trimmed = rebalanceStartTime.trim();
    if (trimmed) {
      payload.day_start_time = trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    }

    rebalanceMutation.mutate({ tripId: selectedTripId, payload });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">여행 일정</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">데일리 타임라인</h1>
            <p className="mt-1 text-sm text-slate-500">
              일정별 이동 수단과 시간을 확인하고 담당자에게 즉시 공유하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={selectedTripId ?? ''}
                onChange={(event) => setSelectedTripId(Number(event.target.value))}
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
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={rebalanceDay ?? ''}
                onChange={(event) => setRebalanceDay(Number(event.target.value))}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 focus:border-primary-300 focus:outline-none"
              >
                {grouped.map((group) => (
                  <option key={group.day} value={group.day}>
                    DAY {group.day}
                  </option>
                ))}
              </select>
              <select
                value={rebalanceMode}
                onChange={(event) => setRebalanceMode(event.target.value as TravelMode)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 focus:border-primary-300 focus:outline-none"
              >
                {(['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'] as TravelMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={rebalanceStartTime}
                onChange={(event) => setRebalanceStartTime(event.target.value)}
                className="w-28 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 focus:border-primary-300 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleRebalanceSchedules}
              disabled={rebalanceMutation.isPending || grouped.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {rebalanceMutation.isPending ? (
                <>
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                  재배치 중...
                </>
              ) : (
                <>
                  <Route className="h-4 w-4" />
                  이동 동선 최적화
                </>
              )}
            </button>
          </div>
        </div>

        {rebalanceFeedback && (
          <p
            className={`mt-3 text-xs font-semibold ${
              rebalanceFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {rebalanceFeedback.message}
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ScheduleSummaryCard
            icon={CalendarClock}
            label="등록 일정"
            value={`${schedules.length}건`}
            helper="여행별 총 일정"
          />
          <ScheduleSummaryCard icon={Clock8} label="예상 소요" value={minutesToLabel(totalMinutes)} helper="총 체류 시간" />
          <ScheduleSummaryCard
            icon={MapPin}
            label="주요 이동"
            value={`${grouped.length}일차`}
            helper="운영 일수"
          />
          <ScheduleSummaryCard
            icon={Route}
            label="다가오는 일정"
            value={upcoming.length > 0 ? upcoming[0].main_content ?? upcoming[0].place_name : '일정 미정'}
            helper={upcoming[0] ? `${upcoming[0].start_time} 시작` : '최신 업데이트 없음'}
            compact
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">상세 타임라인</h2>
              <p className="text-sm text-slate-500">일정별 이동 시간과 예산 메모를 확인하세요.</p>
            </div>
            {currentTrip && (
              <div className="rounded-full bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-600">
                {currentTrip.destination}
              </div>
            )}
          </div>

          {isLoading && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              일정을 불러오는 중입니다.
            </div>
          )}

          {!isLoading && grouped.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              선택한 여행에 등록된 일정이 없습니다.
            </div>
          )}

          {grouped.map(({ day, items }) => (
            <div key={day} className="rounded-2xl border border-slate-100 bg-[#F9FBFF] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">DAY {day}</h3>
                <span className="text-xs font-medium text-slate-500">
                  {minutesToLabel(
                    items.reduce((acc, schedule) => acc + (schedule.duration_minutes ?? 0), 0),
                  )}
                </span>
              </div>
              <ul className="mt-5 space-y-4">
                {items.map((schedule) => (
                  <li key={schedule.id} className="flex gap-4">
                    <div className="relative flex w-24 flex-shrink-0 flex-col items-start text-xs font-semibold text-slate-500">
                      <span>{schedule.start_time.slice(0, 5)}</span>
                      <span className="text-[10px] text-slate-400">{minutesToLabel(schedule.duration_minutes)}</span>
                    </div>
                    <div className="flex-1 rounded-2xl border border-white bg-white px-5 py-4 shadow-sm">
                      <p className="text-sm font-semibold text-slate-900">
                        {schedule.main_content ?? schedule.place_name ?? '세부 일정 미정'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {schedule.meeting_point ?? '집결지 미정'} · 이동 수단 {schedule.transport ?? '미정'}
                      </p>
                      {schedule.budget ? (
                        <p className="mt-2 inline-flex rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold text-primary-600">
                          예산 {schedule.budget.toLocaleString()}원
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </article>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">오늘의 하이라이트</h2>
          <p className="text-sm text-slate-500">다가오는 일정 요약과 담당자 공유 메모입니다.</p>
          <div className="space-y-3">
            {upcoming.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                표시할 일정이 없습니다.
              </div>
            )}
            {upcoming.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-[#E8F1FF] p-4 shadow-inner">
                <p className="text-sm font-semibold text-slate-900">{item.main_content ?? item.place_name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.start_time.slice(0, 5)} · {item.meeting_point ?? '집결지 미정'}
                </p>
                <p className="mt-2 text-xs text-slate-400">담당자에게 안전 가이드를 미리 공유하세요.</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-[#F9FBFF] p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-800">현장 메모</p>
            <p className="mt-1 leading-relaxed">
              이동 시간에 맞춰 현장 스태프에게 도착 알림을 발송하고, 날씨에 따라 대체 일정을 준비해 주세요.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">새 일정 추가</h2>
              <p className="text-sm text-slate-500">선택한 여행에 맞춰 일정을 등록하세요.</p>
            </div>
            {formSuccess && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                {formSuccess}
              </span>
            )}
          </div>

          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {formError}
            </div>
          )}

          <form className="grid gap-4" onSubmit={handleSubmitSchedule}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="schedule-day" className="text-sm font-semibold text-slate-700">
                  일차
                </label>
                <input
                  id="schedule-day"
                  type="number"
                  min={1}
                  value={form.day_number}
                  onChange={(event) => handleFormChange('day_number')(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  required
                />
              </div>
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
                방문 장소 (Google 자동완성)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  id="schedule-place"
                  type="text"
                  value={placeQuery}
                  onChange={(event) => {
                    setPlaceQuery(event.target.value);
                    if (!event.target.value) {
                      setSelectedPlace(null);
                    }
                  }}
                  placeholder="장소명 또는 주소를 입력하세요"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  autoComplete="off"
                />
              </div>
              {selectedPlace && (
                <div className="flex flex-col gap-1 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-xs text-primary-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{selectedPlace.name}</span>
                    <span className="text-[11px] text-primary-500">
                      {isResolvingPlace ? '세부 정보를 불러오는 중...' : '연동 완료'}
                    </span>
                  </div>
                  <span>{selectedPlace.address ?? '주소 정보 없음'}</span>
                  {selectedPlace.google_place_id && (
                    <span className="text-[11px] text-primary-500">Google Place ID: {selectedPlace.google_place_id}</span>
                  )}
                </div>
              )}
              {placeQuery.trim().length >= 2 && (!selectedPlace || selectedPlace.name !== placeQuery) &&
                (placeSuggestions?.predictions.length ?? 0) > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {placeSuggestions?.predictions.map((prediction) => (
                    <li key={prediction.place_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingLookupId(prediction.place_id);
                          setSelectedPlace(null);
                        }}
                        className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-primary-50"
                      >
                        <span className="font-semibold text-slate-800">{prediction.primary_text}</span>
                        <span className="text-xs text-slate-500">{prediction.secondary_text ?? prediction.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
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

            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setForm({ ...initialScheduleForm });
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
        </article>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">등록 가이드</h2>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="rounded-xl border border-slate-100 bg-[#F9FBFF] p-4">
              <span className="font-semibold text-slate-900">시간 형식</span>
              <p className="mt-1 text-xs text-slate-500">24시간 형식으로 입력하면 자동으로 서버 형식에 맞춰집니다.</p>
            </li>
            <li className="rounded-xl border border-slate-100 bg-[#F9FBFF] p-4">
              <span className="font-semibold text-slate-900">집결지</span>
              <p className="mt-1 text-xs text-slate-500">집결지를 입력하면 참가자 카드와 자동 연동됩니다.</p>
            </li>
            <li className="rounded-xl border border-slate-100 bg-[#F9FBFF] p-4">
              <span className="font-semibold text-slate-900">예산</span>
              <p className="mt-1 text-xs text-slate-500">예산을 비워두면 비용 통계에 포함되지 않습니다.</p>
            </li>
          </ul>
        </aside>
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
