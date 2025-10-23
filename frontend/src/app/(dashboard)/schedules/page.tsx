'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  Clock8,
  Info,
  ListChecks,
  MapPin,
  Route,
  Search,
} from 'lucide-react';
import { createSchedule, rebalanceTripDay } from '@/lib/api';
import { usePlacesQuery, useSchedulesQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { Schedule, ScheduleCreate, ScheduleRebalanceRequest, Trip } from '@/types/api';
import { useLocale } from '@/stores/useLocaleStore';

const timeToMinutes = (value: string) => {
  const [hours = '0', minutes = '0'] = value.split(':');
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  if (Number.isNaN(parsedHours) || Number.isNaN(parsedMinutes)) {
    return 0;
  }
  return parsedHours * 60 + parsedMinutes;
};

const arraysEqual = (a: number[], b: number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const DEFAULT_TRAVEL_MODE: ScheduleRebalanceRequest['travel_mode'] = 'DRIVE';

const initialScheduleForm = {
  day_number: 1,
  start_time: '09:00',
  end_time: '11:00',
  main_content: '',
  meeting_point: '',
  transport: '',
  budget: '',
  place_id: '',
};

type ScheduleFormState = typeof initialScheduleForm;

export default function SchedulesPage() {
  const {
    data: trips = [],
    isLoading: tripsLoading,
    isSuperAdmin,
  } = useScopedTrips();
  const locale = useLocale();
  const lt = useCallback((ko: string, en: string) => (locale === 'ko' ? ko : en), [locale]);
  const minutesToLabel = useCallback(
    (minutes?: number | null) => {
      if (!minutes) return lt('소요 시간 정보 없음', 'No duration information');
      const hours = Math.floor((minutes ?? 0) / 60);
      const mins = (minutes ?? 0) % 60;
      if (hours === 0) {
        return lt(`${mins}분`, `${mins} min`);
      }
      if (mins === 0) {
        return lt(`${hours}시간`, `${hours} hr`);
      }
      return lt(`${hours}시간 ${mins}분`, `${hours} hr ${mins} min`);
    },
    [lt],
  );
  const dateLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [tripFilter, setTripFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | number>('details');
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ScheduleFormState>({ ...initialScheduleForm });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineNotice, setTimelineNotice] = useState<string | null>(null);
  const [localScheduleIds, setLocalScheduleIds] = useState<number[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hasLocalReorder, setHasLocalReorder] = useState(false);
  const activeScheduleSignatureRef = useRef<string | null>(null);

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

  useEffect(() => {
    setTimelineError(null);
    setTimelineNotice(null);
  }, [activeTab]);

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
  const noTripMessage = isSuperAdmin
    ? lt('등록된 여행이 없습니다.', 'No trips have been registered yet.')
    : lt('담당된 여행이 없습니다.', 'No trips have been assigned to you yet.');

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
  const emptyTripMessage = filterActive
    ? lt('조건에 맞는 여행이 없습니다.', 'No trips match the search criteria.')
    : noTripMessage;

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

  useEffect(() => {
    const nextIds = activeDaySchedules.map((schedule) => schedule.id);
    const signature = nextIds.join(',');

    if (activeScheduleSignatureRef.current === signature) {
      return;
    }

    activeScheduleSignatureRef.current = signature;
    setLocalScheduleIds(nextIds);
    setHasLocalReorder(false);
  }, [activeDaySchedules]);

  const activeScheduleMap = useMemo(() => {
    const map = new Map<number, Schedule>();
    activeDaySchedules.forEach((schedule) => {
      map.set(schedule.id, schedule);
    });
    return map;
  }, [activeDaySchedules]);

  const orderedActiveSchedules = useMemo(() => {
    if (localScheduleIds.length === activeDaySchedules.length && activeDaySchedules.length > 0) {
      const ordered = localScheduleIds
        .map((id) => activeScheduleMap.get(id))
        .filter((value): value is Schedule => Boolean(value));
      if (ordered.length === activeDaySchedules.length) {
        return ordered;
      }
    }
    return activeDaySchedules;
  }, [localScheduleIds, activeScheduleMap, activeDaySchedules]);

  const activeDayDuration = useMemo(() => {
    if (typeof activeTab !== 'number') return 0;
    return orderedActiveSchedules.reduce((acc, schedule) => acc + (schedule.duration_minutes ?? 0), 0);
  }, [orderedActiveSchedules, activeTab]);

  const rebalanceMutation = useMutation({
    mutationFn: ({
      tripId,
      payload,
    }: {
      tripId: number;
      payload: ScheduleRebalanceRequest;
    }) => rebalanceTripDay(tripId, payload),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<Schedule[]>(
        ['trips', variables.tripId, 'schedules'],
        (prev = []) => {
          const others = prev.filter((schedule) => schedule.day_number !== data.day_number);
          return [...others, ...data.schedules];
        },
      );
    },
  });

  const commitReorder = useCallback(
    async (scheduleIds: number[], fallbackIds?: number[], successMessage?: string) => {
      if (!selectedTripId || typeof activeTab !== 'number' || scheduleIds.length === 0) {
        setDraggingId(null);
        setHasLocalReorder(false);
        return;
      }

      const baseline = fallbackIds ?? localScheduleIds;
      if (arraysEqual(scheduleIds, baseline)) {
        setDraggingId(null);
        setHasLocalReorder(false);
        return;
      }

      try {
        setTimelineError(null);
        setTimelineNotice(null);
        const response = await rebalanceMutation.mutateAsync({
          tripId: selectedTripId,
          payload: {
            day_number: activeTab,
            schedule_ids: scheduleIds,
            travel_mode: DEFAULT_TRAVEL_MODE,
          },
        });
        setTimelineNotice(
          successMessage ?? lt('타임라인이 자동으로 정리되었습니다.', 'The timeline has been organized automatically.'),
        );
        setLocalScheduleIds(response.schedules.map((schedule) => schedule.id));
        setHasLocalReorder(false);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : lt('타임라인 재배치 중 오류가 발생했습니다.', 'An error occurred while reordering the timeline.');
        setTimelineError(message);
        if (fallbackIds) {
          setLocalScheduleIds(fallbackIds);
        }
      } finally {
        setDraggingId(null);
      }
    },
    [selectedTripId, activeTab, rebalanceMutation, localScheduleIds, lt],
  );

  const handleDragStart = useCallback(
    (scheduleId: number) => (event: DragEvent<HTMLTableRowElement>) => {
      if (!canEditSchedule || rebalanceMutation.isPending) return;
      setDraggingId(scheduleId);
      setHasLocalReorder(false);
      setTimelineNotice(null);
      setTimelineError(null);
      event.dataTransfer.effectAllowed = 'move';
      try {
        event.dataTransfer.setData('text/plain', String(scheduleId));
      } catch {
        // 일부 브라우저는 setData를 필수로 요구하지 않으므로 무시합니다.
      }
    },
    [canEditSchedule, rebalanceMutation.isPending],
  );

  const handleDragOver = useCallback(
    (scheduleId: number) => (event: DragEvent<HTMLTableRowElement>) => {
      if (
        !canEditSchedule ||
        rebalanceMutation.isPending ||
        draggingId === null ||
        draggingId === scheduleId
      ) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setLocalScheduleIds((prev) => {
        const draggingIndex = prev.indexOf(draggingId);
        const targetIndex = prev.indexOf(scheduleId);
        if (draggingIndex === -1 || targetIndex === -1 || draggingIndex === targetIndex) {
          return prev;
        }
        const next = [...prev];
        next.splice(draggingIndex, 1);
        next.splice(targetIndex, 0, draggingId);
        return next;
      });
      setHasLocalReorder(true);
    },
    [canEditSchedule, rebalanceMutation.isPending, draggingId],
  );

  const handleDragEnd = useCallback(() => {
    if (!canEditSchedule) return;
    if (hasLocalReorder) {
      const fallbackIds = activeDaySchedules.map((schedule) => schedule.id);
      void commitReorder(
        localScheduleIds,
        fallbackIds,
        lt('일정 순서를 재배치했습니다.', 'Schedule order has been updated.'),
      );
    } else {
      setDraggingId(null);
    }
  }, [canEditSchedule, hasLocalReorder, activeDaySchedules, commitReorder, localScheduleIds, lt]);

  const createScheduleMutation = useMutation({
    mutationFn: ({ tripId, payload }: { tripId: number; payload: ScheduleCreate }) =>
      createSchedule(tripId, payload),
    onSuccess: async (created, variables) => {
      setForm((prev) => ({ ...initialScheduleForm, day_number: prev.day_number }));
      setFormSuccess(lt('새 일정이 추가되었습니다.', 'A new schedule has been added.'));
      setFormError(null);
      setTimelineError(null);

      const scheduleQueryKey = ['trips', variables.tripId, 'schedules'] as const;
      queryClient.setQueryData<Schedule[]>(scheduleQueryKey, (prev = []) => {
        const others = prev.filter((item) => item.id !== created.id);
        return [...others, created];
      });

      const updated = queryClient.getQueryData<Schedule[]>(scheduleQueryKey) ?? [];
      const daySchedules = updated.filter((schedule) => schedule.day_number === created.day_number);
      const fallbackIds = daySchedules.map((schedule) => schedule.id);
      const sortedIds = [...daySchedules]
        .sort((a, b) => {
          const diff = a.start_time.localeCompare(b.start_time);
          if (diff !== 0) return diff;
          return a.id - b.id;
        })
        .map((schedule) => schedule.id);

      if (sortedIds.length > 0 && !arraysEqual(sortedIds, fallbackIds)) {
        await commitReorder(
          sortedIds,
          fallbackIds,
          lt(
            '새 일정 시작 시간 기준으로 순서를 정리했습니다.',
            'Schedules have been ordered by their start time.',
          ),
        );
      } else {
        setTimelineNotice(lt('새 일정을 추가했습니다.', 'A new schedule has been added.'));
      }

      await queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : lt('일정 생성 중 오류가 발생했습니다.', 'An error occurred while creating the schedule.');
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
      setFormError(lt('일정을 추가할 여행을 먼저 선택해 주세요.', 'Select a trip before adding schedules.'));
      return;
    }

    if (typeof activeTab !== 'number') {
      setFormError(lt('일정을 추가할 일차를 선택해 주세요.', 'Choose the trip day for the new schedule.'));
      return;
    }

    if (!form.main_content.trim() && !form.meeting_point.trim()) {
      setFormError(lt('일정 내용 또는 집결지를 입력해 주세요.', 'Enter either the schedule details or meeting point.'));
      return;
    }

    const normalizedStart = normalizeTime(form.start_time);
    const normalizedEnd = normalizeTime(form.end_time);
    const dayNumber = activeTab;

    const sameDaySchedules = schedules.filter((schedule) => schedule.day_number === dayNumber);

    if (form.budget && Number(form.budget) < 0) {
      setFormError(lt('예산은 0 이상의 금액으로 입력해 주세요.', 'Budget must be zero or higher.'));
      return;
    }

    let placeId: number | null = null;
    if (form.place_id.trim()) {
      const parsedPlace = Number(form.place_id);
      if (Number.isNaN(parsedPlace)) {
        setFormError(lt('방문 장소를 올바르게 선택해 주세요.', 'Select a valid place to visit.'));
        return;
      }
      placeId = parsedPlace;
    }

    const nextOrder = sameDaySchedules.reduce((order, schedule) => {
      const candidate = typeof schedule.order === 'number' ? schedule.order : 0;
      return Math.max(order, candidate);
    }, 0);

    const newStartMinutes = timeToMinutes(normalizedStart);
    const newEndMinutes = timeToMinutes(normalizedEnd);

    const hasOverlap = sameDaySchedules.some((schedule) => {
      const existingStart = timeToMinutes(schedule.start_time);
      const existingEnd = timeToMinutes(schedule.end_time);
      return newStartMinutes < existingEnd && newEndMinutes > existingStart;
    });

    if (hasOverlap) {
      const proceed = window.confirm(
        lt('시간이 겹치는데 생성하시겠습니까?', 'This overlaps with another schedule. Continue?'),
      );
      if (!proceed) {
        return;
      }
    }

    const payload: ScheduleCreate = {
      day_number: dayNumber,
      start_time: normalizedStart,
      end_time: normalizedEnd,
      main_content: form.main_content.trim() || null,
      meeting_point: form.meeting_point.trim() || null,
      transport: form.transport.trim() || null,
      budget: form.budget ? Number(form.budget) : null,
      order: nextOrder + 1,
    };

    if (placeId !== null) {
      payload.place_id = placeId;
    }

    setTimelineNotice(null);
    setIsSubmitting(true);
    createScheduleMutation.mutate({ tripId: selectedTripId, payload });
  };

  useEffect(() => {
    setForm((prev) => ({ ...prev, day_number: typeof activeTab === 'number' ? activeTab : dayTabs[0] ?? 1 }));
  }, [activeTab, dayTabs]);

  const formatTripPeriod = useCallback(
    (trip: Trip) => {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return lt('기간 미정', 'Dates TBD');
      }
      const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const startLabel = start.toLocaleDateString(dateLocale);
      const endLabel = end.toLocaleDateString(dateLocale);
      return lt(
        `${startLabel} ~ ${endLabel} (${diff + 1}일차)`,
        `${startLabel} - ${endLabel} (Day ${diff + 1})`,
      );
    },
    [dateLocale, lt],
  );

  const formatStartDate = useCallback(
    (value?: string | null) => {
      if (!value) return lt('미정', 'TBD');
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return lt('미정', 'TBD');
      return parsed.toLocaleDateString(dateLocale);
    },
    [dateLocale, lt],
  );

  const handleSelectTrip = (tripId: number) => {
    setSelectedTripId(tripId);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">
              {lt('여행 전 관리', 'Pre-trip management')}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {lt('여행 전 관리 리스트', 'Schedule planning overview')}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {lt(
                '진행 중인 여행 일정을 한눈에 확인하고 관리할 대상을 선택하세요.',
                'Review all upcoming trip schedules and pick the ones to manage.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
              <Search className="h-4 w-4 text-primary-500" />
              <input
                value={tripFilter}
                onChange={(event) => setTripFilter(event.target.value)}
                placeholder={lt('여행명, 담당자 검색', 'Search trip name or manager')}
                className="w-40 border-none bg-transparent placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-[#F7F9FC] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">{lt('구분', 'Category')}</th>
                <th className="px-5 py-3 text-left font-semibold">{lt('신청인 수', 'Applicants')}</th>
                <th className="px-5 py-3 text-left font-semibold">{lt('여행명', 'Trip')}</th>
                <th className="px-5 py-3 text-left font-semibold">{lt('담당자', 'Manager')}</th>
                <th className="px-5 py-3 text-left font-semibold">{lt('시작일자', 'Start date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tripsLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    {lt('여행 정보를 불러오는 중입니다.', 'Loading trip information.')}
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
                    <td className="px-5 py-3 font-semibold text-slate-700">
                      {trip.participant_count ?? 0}
                      {lt('명', ' people')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">{trip.title}</span>
                        <span className="text-xs text-slate-500">
                          {trip.destination ?? lt('목적지 미정', 'Destination TBD')} · {formatTripPeriod(trip)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {trip.manager_name ?? lt('담당자 미지정', 'Manager unassigned')}
                    </td>
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
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">
              {lt('여행 일정', 'Trip schedule')}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {lt('선택한 여행 타임라인', 'Selected trip timeline')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {canEditSchedule
                ? lt(
                    '상세 정보와 일차별 타임라인을 확인하고 새 일정을 등록하세요.',
                    'Review day-by-day details and register new schedules instantly.',
                  )
                : lt('총괄관리자는 모든 여행의 타임라인을 열람할 수 있습니다.', 'Super admins can view timelines for every trip.')}
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
              {lt('이동 동선 최적화', 'Optimize route')}
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
            {lt('상세 정보', 'Trip details')}
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
                {locale === 'ko' ? `${day}일차` : `Day ${day}`}
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
                      <h3 className="text-base font-semibold text-slate-900">{lt('여행 정보', 'Trip information')}</h3>
                    </div>
                    <dl className="mt-4 space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <dt className="font-medium text-slate-500">{lt('여행지', 'Destination')}</dt>
                        <dd className="font-semibold text-slate-900">{currentTrip.destination}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-slate-500">{lt('기간', 'Period')}</dt>
                        <dd>{formatTripPeriod(currentTrip)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-slate-500">{lt('담당자', 'Manager')}</dt>
                        <dd>{currentTrip.manager_name ?? lt('배정 대기', 'Pending assignment')}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-slate-500">{lt('참가자', 'Participants')}</dt>
                        <dd>
                          {currentTrip.participant_count ?? 0}
                          {lt('명', ' people')}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-[#F7F9FC] p-5">
                    <div className="flex items-center gap-3">
                      <ListChecks className="h-5 w-5 text-primary-500" />
                      <h3 className="text-base font-semibold text-slate-900">{lt('운영 메모', 'Operations note')}</h3>
                    </div>
                    <p className="mt-4 text-sm text-slate-600">
                      {lt(
                        '일정 등록 현황과 소요 시간을 확인해 운영팀과 공유하세요. 필요 시 담당자와 실시간으로 조율할 수 있습니다.',
                        'Review registered schedules and total duration to share with the operations team. Coordinate with managers in real time when needed.',
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                  {tripsLoading
                    ? lt('여행 정보를 불러오는 중입니다.', 'Loading trip information.')
                    : noTripMessage}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ScheduleSummaryCard
                  icon={CalendarClock}
                  label={lt('등록 일정', 'Registered schedules')}
                  value={`${schedules.length}${lt('건', ' items')}`}
                  helper={lt('선택한 여행의 전체 일정', 'All schedules for the selected trip')}
                />
                <ScheduleSummaryCard
                  icon={Clock8}
                  label={lt('예상 소요', 'Estimated duration')}
                  value={minutesToLabel(totalMinutes)}
                  helper={lt('전체 체류 시간', 'Total stay time')}
                />
                <ScheduleSummaryCard
                  icon={MapPin}
                  label={lt('운영 일수', 'Operating days')}
                  value={locale === 'ko' ? `${dayTabs.length}일차` : `${dayTabs.length} days`}
                  helper={lt('여행 진행 일수', 'Days in operation')}
                />
                <ScheduleSummaryCard
                  icon={Route}
                  label={lt('다가오는 일정', 'Upcoming schedule')}
                  value={
                    upcoming.length > 0
                      ? upcoming[0].main_content ?? upcoming[0].place_name ?? lt('세부 일정 미정', 'Details TBD')
                      : lt('일정 미정', 'No schedule planned')
                  }
                  helper={
                    upcoming[0]
                      ? lt(
                          `${upcoming[0].start_time.slice(0, 5)} 시작`,
                          `Starts at ${upcoming[0].start_time.slice(0, 5)}`,
                        )
                      : lt('최신 업데이트 없음', 'No recent updates')
                  }
                  compact
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {isLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                  {lt('일정을 불러오는 중입니다.', 'Loading schedules...')}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {locale === 'ko' ? `${activeTab}일차 타임라인` : `Day ${activeTab} timeline`}
                      </h3>
                      {canEditSchedule && (
                        <p className="text-xs text-slate-500">
                          {lt(
                            '일정을 드래그하면 백엔드에서 자동으로 순서와 시간이 재배치됩니다.',
                            'Drag and drop schedules to automatically reorder them on the backend.',
                          )}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                      {lt('총 소요', 'Total duration')} {minutesToLabel(activeDayDuration)}
                    </span>
                  </div>
                  <div className="grid gap-6 xl:grid-cols-3">
                    <div className="space-y-4 xl:col-span-2">
                      {(timelineError || timelineNotice || rebalanceMutation.isPending) && (
                        <div
                          className={`rounded-xl border px-4 py-3 text-sm ${
                            timelineError
                              ? 'border-rose-200 bg-rose-50 text-rose-600'
                              : 'border-primary-100 bg-primary-50 text-primary-700'
                          }`}
                        >
                          {timelineError ??
                            (rebalanceMutation.isPending
                              ? lt('타임라인을 재배치하는 중입니다...', 'Reordering the timeline...')
                              : timelineNotice)}
                        </div>
                      )}
                      <div className="overflow-hidden rounded-2xl border border-slate-100">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                          <thead className="bg-[#F7F9FC] text-slate-500">
                            <tr>
                              <th className="px-5 py-3 text-left font-semibold">{lt('시간', 'Time')}</th>
                              <th className="px-5 py-3 text-left font-semibold">{lt('일정 내용', 'Schedule detail')}</th>
                              <th className="px-5 py-3 text-left font-semibold">{lt('집결지', 'Meeting point')}</th>
                              <th className="px-5 py-3 text-left font-semibold">{lt('이동 수단', 'Transport')}</th>
                              <th className="px-5 py-3 text-right font-semibold">{lt('예산', 'Budget')}</th>
                              <th className="px-5 py-3 text-right font-semibold">{lt('상세', 'Details')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {orderedActiveSchedules.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-500">
                                  {canEditSchedule
                                    ? lt(
                                        '아직 등록된 일정이 없습니다. 오른쪽에서 일정을 추가해 보세요.',
                                        'No schedules yet. Add one from the panel on the right.',
                                      )
                                    : lt(
                                        '아직 등록된 일정이 없습니다. 담당자에게 등록을 요청해 주세요.',
                                        'No schedules yet. Ask the assigned manager to add them.',
                                      )}
                                </td>
                              </tr>
                            )}
                            {orderedActiveSchedules.map((schedule, index) => {
                              const placeId =
                                typeof schedule.place === 'number'
                                  ? schedule.place
                                  : schedule.place_id ?? null;
                              const detailHref = placeId ? `/places/${placeId}` : null;

                              return (
                                <tr
                                  key={schedule.id}
                                  draggable={canEditSchedule}
                                  onDragStart={handleDragStart(schedule.id)}
                                  onDragOver={handleDragOver(schedule.id)}
                                  onDragEnd={handleDragEnd}
                                  onDrop={(event) => event.preventDefault()}
                                  className={`transition ${
                                    canEditSchedule ? 'cursor-move' : ''
                                  } ${
                                    draggingId === schedule.id ? 'bg-primary-50/60' : 'hover:bg-slate-50/70'
                                  }`}
                                >
                                <td className="px-5 py-3 font-medium text-slate-700">
                                  {schedule.start_time.slice(0, 5)} ~ {schedule.end_time.slice(0, 5)}
                                </td>
                                <td className="px-5 py-3 text-slate-700">
                                  <div className="font-semibold text-slate-900">
                                    {schedule.main_content ?? schedule.place_name ?? lt('세부 일정 미정', 'Details TBD')}
                                  </div>
                                  <div className="text-xs text-slate-500">#{String(index + 1).padStart(2, '0')}</div>
                                </td>
                                <td className="px-5 py-3 text-slate-600">{schedule.meeting_point ?? lt('집결지 미정', 'Meeting point TBD')}</td>
                                <td className="px-5 py-3 text-slate-600">{schedule.transport ?? lt('미정', 'TBD')}</td>
                                <td className="px-5 py-3 text-right text-slate-700">
                                  {schedule.budget
                                    ? `${schedule.budget.toLocaleString()}${lt('원', ' KRW')}`
                                    : '-'}
                                </td>
                                <td className="px-5 py-3 text-right">
                                  {detailHref ? (
                                    <Link
                                      href={detailHref}
                                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                                    >
                                      {lt('상세 보기', 'View details')}
                                      <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Link>
                                  ) : (
                                    <span className="text-xs text-slate-400">{lt('연결된 장소 없음', 'No linked place')}</span>
                                  )}
                                </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {canEditSchedule ? (
                      <div className="rounded-2xl border border-slate-100 bg-[#F9FBFF] p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h4 className="text-base font-semibold text-slate-900">{lt('새 일정 추가', 'Add a new schedule')}</h4>
                            <p className="text-sm text-slate-500">
                              {locale === 'ko'
                                ? `${activeTab}일차에 필요한 일정을 즉시 등록하세요.`
                                : `Register what you need for Day ${activeTab} right away.`}
                            </p>
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
                                {lt('시작 시간', 'Start time')}
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
                                {lt('종료 시간', 'End time')}
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
                              {lt('주요 활동', 'Key activity')}
                            </label>
                            <input
                              id="schedule-content"
                              type="text"
                              value={form.main_content}
                              onChange={(event) => handleFormChange('main_content')(event.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                              placeholder={lt('예: 문화 체험 프로그램', 'e.g., cultural program')}
                            />
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="schedule-place" className="text-sm font-semibold text-slate-700">
                              {lt('방문 장소', 'Place to visit')}
                            </label>
                            {placesLoading ? (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                                {lt('방문 가능 장소를 불러오는 중입니다.', 'Loading available places...')}
                              </div>
                            ) : places.length === 0 ? (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-600">
                                {lt('등록된 장소가 없습니다. 장소 관리에서 먼저 추가해 주세요.', 'No places are registered yet. Add them from place management first.')}
                              </div>
                            ) : (
                              <select
                                id="schedule-place"
                                value={form.place_id}
                                onChange={(event) => handleFormChange('place_id')(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                              >
                                <option value="">{lt('방문 장소 미정', 'Place TBD')}</option>
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
                              {lt('집결지', 'Meeting point')}
                            </label>
                            <input
                              id="schedule-meeting"
                              type="text"
                              value={form.meeting_point}
                              onChange={(event) => handleFormChange('meeting_point')(event.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                              placeholder={lt('예: 호텔 로비', 'e.g., hotel lobby')}
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label htmlFor="schedule-transport" className="text-sm font-semibold text-slate-700">
                                {lt('이동 수단', 'Transport')}
                              </label>
                              <input
                                id="schedule-transport"
                                type="text"
                                value={form.transport}
                                onChange={(event) => handleFormChange('transport')(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                                placeholder={lt('예: 전용 버스', 'e.g., chartered bus')}
                              />
                            </div>
                            <div className="space-y-2">
                              <label htmlFor="schedule-budget" className="text-sm font-semibold text-slate-700">
                                {lt('예산 (원)', 'Budget (KRW)')}
                              </label>
                              <input
                                id="schedule-budget"
                                type="number"
                                min={0}
                                value={form.budget}
                                onChange={(event) => handleFormChange('budget')(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                                placeholder={lt('예: 50000', 'e.g., 50000')}
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setForm({
                                  ...initialScheduleForm,
                                  day_number: typeof activeTab === 'number' ? activeTab : 1,
                                });
                                setFormError(null);
                                setFormSuccess(null);
                              }}
                              className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
                            >
                              {lt('초기화', 'Reset')}
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSubmitting
                                ? lt('등록 중...', 'Registering...')
                                : lt('일정 등록', 'Register schedule')}
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
                        {lt(
                          '총괄관리자는 일정 등록 권한이 없습니다. 담당자 화면에서 여행 일정을 관리합니다.',
                          'Super admins cannot add schedules. Please manage timelines from the manager view.',
                        )}
                      </div>
                    )}
                  </div>
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
