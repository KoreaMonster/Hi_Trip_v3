'use client';

import { useMemo } from 'react';
import {
  useHealthQuery,
  useMonitoringAlertsQuery,
  useMonitoringLatestQuery,
  usePlacesQuery,
  useSchedulesQuery,
  useTripsQuery,
} from '@/lib/queryHooks';
import type { Schedule } from '@/types/api';
import {
  AlertTriangle,
  CalendarCheck,
  CircleDashed,
  Leaf,
  Plane,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import BookingTrendChart, { type BookingTrendPoint } from './BookingTrendChart';

const summaryCards = [
  {
    key: 'trips',
    title: '진행 중인 여행',
    icon: Plane,
    accent: 'bg-primary-500/10 text-primary-600',
  },
  {
    key: 'schedules',
    title: '오늘의 일정',
    icon: CalendarCheck,
    accent: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    key: 'alerts',
    title: '모니터링 경보',
    icon: AlertTriangle,
    accent: 'bg-rose-500/10 text-rose-600',
  },
] as const;

type MonitoringLevel = 'normal' | 'warning' | 'critical' | 'unknown';

const monitoringBadgeStyles: Record<MonitoringLevel, string> = {
  normal: 'border border-emerald-200 bg-emerald-50 text-emerald-600',
  warning: 'border border-amber-200 bg-amber-50 text-amber-600',
  critical: 'border border-rose-200 bg-rose-50 text-rose-600',
  unknown: 'border border-slate-200 bg-slate-100 text-slate-500',
};

const monitoringBadgeIcons: Record<MonitoringLevel, JSX.Element> = {
  normal: <ShieldCheck className="h-3.5 w-3.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" />,
  critical: <CircleDashed className="h-3.5 w-3.5" />,
  unknown: <CircleDashed className="h-3.5 w-3.5" />,
};

const monitoringBadgeLabels: Record<MonitoringLevel, string> = {
  normal: '정상',
  warning: '주의',
  critical: '위험',
  unknown: '정보 없음',
};

const formatTripRange = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '일정 미정';
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getMonth() + 1}/${s.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`;
};

const formatShortTime = (value: string) => `${value.slice(0, 5)}`;

export default function DashboardContent() {
  const { data: trips } = useTripsQuery();
  const activeTrip = trips?.[0];
  const activeTripId = activeTrip?.id;

  const { data: schedules } = useSchedulesQuery(activeTripId);
  const { data: monitoringAlerts } = useMonitoringAlertsQuery(activeTripId);
  const { data: monitoringLatest } = useMonitoringLatestQuery(activeTripId);
  const { data: health } = useHealthQuery();
  const { data: places } = usePlacesQuery();

  const bookingTrendData = useMemo(() => {
    if (!trips || trips.length === 0) return [] as BookingTrendPoint[];

    const reference = new Date();

    return Array.from({ length: 6 }).map((_, index) => {
      const monthDate = new Date(reference.getFullYear(), reference.getMonth() - (5 - index), 1);
      const targetYear = monthDate.getFullYear();
      const targetMonth = monthDate.getMonth();
      const label = `${String(targetYear).slice(-2)}.${String(targetMonth + 1).padStart(2, '0')}`;

      const value = trips.filter((trip) => {
        if (!trip.start_date) return false;
        const start = new Date(trip.start_date);
        return start.getFullYear() === targetYear && start.getMonth() === targetMonth;
      }).length;

      return { label, value };
    });
  }, [trips]);

  const bookingTrendChangeLabel = useMemo(() => {
    if (bookingTrendData.length === 0) return '데이터 없음';
    if (bookingTrendData.length < 2) return '데이터 수집 중';

    const previous = bookingTrendData[bookingTrendData.length - 2]?.value ?? 0;
    const current = bookingTrendData[bookingTrendData.length - 1]?.value ?? 0;

    if (previous === 0 && current === 0) return '변동 없음';
    if (previous === 0) return current > 0 ? '신규 예약 발생' : '변동 없음';

    const change = Math.round(((current - previous) / previous) * 100);
    if (!Number.isFinite(change)) return '변동 없음';

    return `${change > 0 ? '+' : ''}${change}% 변화`;
  }, [bookingTrendData]);

  const buildScheduleStart = (schedule: Schedule): Date | null => {
    if (!activeTrip) return null;
    const base = new Date(`${activeTrip.start_date}T${schedule.start_time}`);
    base.setDate(base.getDate() + (schedule.day_number - 1));
    return base;
  };

  const todaysSchedules = useMemo(() => {
    if (!schedules || !activeTrip) return [] as Schedule[];
    const today = new Date();
    return schedules.filter((item) => {
      const start = buildScheduleStart(item);
      if (!start) return false;
      return (
        start.getFullYear() === today.getFullYear() &&
        start.getMonth() === today.getMonth() &&
        start.getDate() === today.getDate()
      );
    });
  }, [schedules, activeTrip]);

  const upcomingSchedules = useMemo(() => {
    if (!schedules || !activeTrip) return [] as Schedule[];
    return [...schedules]
      .sort((a, b) => {
        const startA = buildScheduleStart(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const startB = buildScheduleStart(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return startA - startB;
      })
      .slice(0, 5);
  }, [schedules, activeTrip]);

  const totalAlerts = monitoringAlerts?.length ?? 0;

  const monitoringLevelByTrip = useMemo(() => {
    const map = new Map<number, MonitoringLevel>();
    (trips ?? []).forEach((trip) => {
      if (trip.id !== activeTripId) {
        map.set(trip.id, 'unknown');
        return;
      }

      const alerts = monitoringAlerts ?? [];
      const healthStatuses = (monitoringLatest ?? [])
        .map((item) => item.health?.status)
        .filter((status): status is string => Boolean(status));

      let level: MonitoringLevel = 'normal';
      if (alerts.some((alert) => alert.alert_type === 'health')) {
        level = 'critical';
      } else if (alerts.length > 0) {
        level = 'warning';
      } else if (healthStatuses.some((status) => status === 'warning' || status === 'caution')) {
        level = 'warning';
      }

      map.set(trip.id, level);
    });
    return map;
  }, [trips, activeTripId, monitoringAlerts, monitoringLatest]);

  const scheduleDisplayTitle = (schedule: Schedule) => schedule.main_content ?? schedule.place_name ?? '일정';

  const participantsAtRisk = (monitoringLatest ?? []).filter(
    (item) => item.health && item.health.status !== 'normal',
  );

  const unassignedTrips = useMemo(
    () => (trips ?? []).filter((trip) => !trip.manager && !trip.manager_name).length,
    [trips],
  );

  const healthStatusLabel = health?.status === 'ok' ? '정상' : '점검 필요';
  const healthMessage = health?.message ?? '상태 정보를 불러오는 중입니다.';
  const healthServiceLabel = health?.service ? `서비스 · ${health.service}` : '서비스 정보 없음';

  const recommendedPlaces = useMemo(() => (places ?? []).slice(0, 3), [places]);

  return (
    <div className="space-y-6">
      <header className="animate-[fade-in_0.6s_ease-out] rounded-3xl border border-slate-200 bg-gradient-to-r from-[#E8F1FF] via-white to-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">HI-TRIP 운영 현황</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">오늘의 여행 SaaS 대시보드</h1>
            <p className="mt-2 text-sm text-slate-500">
              주요 일정, 모니터링, 추천 장소를 확인하고 안전하고 매끄러운 여행을 준비하세요.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-primary-100 bg-white/70 px-5 py-4 text-sm text-primary-600 shadow-inner md:flex-row md:items-center">
            <Leaf className="h-4 w-4" />
            <span className="font-semibold">{healthStatusLabel}</span>
            <span className="text-xs text-primary-500">{healthMessage}</span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.75fr_1fr]">
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(({ key, title, icon: Icon, accent }) => {
              const scheduleCount = todaysSchedules.length || schedules?.length || 0;
              const value =
                key === 'trips'
                  ? trips?.length ?? 0
                  : key === 'schedules'
                  ? scheduleCount
                  : totalAlerts;

              const helperText =
                key === 'trips'
                  ? '등록된 전체 여행 수'
                  : key === 'schedules'
                  ? todaysSchedules.length > 0
                    ? '오늘 진행되는 주요 일정'
                    : '등록된 전체 일정 수'
                  : '주의가 필요한 경보 수';

              return (
                <article
                  key={key}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-3xl font-bold text-slate-900">{value}</span>
                    <span className="text-xs text-slate-500">{helperText}</span>
                  </div>
                </article>
              );
            })}
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">서비스 상태</p>
              <div className="mt-3 flex flex-col gap-1">
                <span className="text-2xl font-bold text-slate-900">{healthStatusLabel}</span>
                <span className="text-xs text-slate-500">{healthMessage}</span>
                <span className="text-xs text-slate-400">{healthServiceLabel}</span>
              </div>
            </article>
          </section>

          <section className="grid gap-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">여행 예약 추이</h2>
                  <p className="text-sm text-slate-500">최근 6개월 동안의 예약 흐름을 확인하세요.</p>
                </div>
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600">
                  {bookingTrendChangeLabel}
                </span>
              </div>
              <div className="mt-6 h-60">
                <BookingTrendChart data={bookingTrendData} />
              </div>
            </article>
          </section>

          <section className="grid gap-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">주요 여행 현황</h2>
                  <p className="text-sm text-slate-500">현재 등록된 여행과 진행 상태를 확인하세요.</p>
                </div>
                <button className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 shadow-sm transition hover:bg-primary-100">
                  전체 보기
                </button>
              </div>
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-[#F7F9FC] text-slate-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">여행명</th>
                      <th className="px-5 py-3 text-left font-semibold">기간</th>
                      <th className="px-5 py-3 text-left font-semibold">모니터링</th>
                      <th className="px-5 py-3 text-right font-semibold">참가자 수</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(trips ?? []).map((trip) => {
                      const level = monitoringLevelByTrip.get(trip.id) ?? 'unknown';
                      const badgeStyle = monitoringBadgeStyles[level];
                      const badgeIcon = monitoringBadgeIcons[level];
                      const badgeText = monitoringBadgeLabels[level];
                      const participantCount = trip.participant_count ?? 0;

                      return (
                        <tr key={trip.id} className="transition hover:bg-slate-50/80">
                          <td className="px-5 py-3 font-semibold text-slate-800">{trip.title}</td>
                          <td className="px-5 py-3 text-slate-600">{formatTripRange(trip.start_date, trip.end_date)}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeStyle}`}>
                              {badgeIcon}
                              {badgeText}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">{participantCount}명</td>
                        </tr>
                      );
                    })}
                    {(!trips || trips.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-sm text-slate-500">
                          등록된 여행이 아직 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">다가오는 일정</h2>
            <p className="text-sm text-slate-500">최대 5개의 일정을 표시합니다.</p>
            <ul className="mt-5 space-y-4">
              {upcomingSchedules.length === 0 && (
                <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  예정된 일정이 없습니다.
                </li>
              )}
              {upcomingSchedules.map((schedule) => (
                <li key={schedule.id} className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800">{scheduleDisplayTitle(schedule)}</p>
                    <p className="text-xs text-slate-500">
                      {(activeTrip && activeTrip.id === schedule.trip ? activeTrip.title : `Trip #${schedule.trip}`) ?? '여행'} ·{' '}
                      {formatShortTime(schedule.start_time)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">추천 장소</h2>
            <p className="text-sm text-slate-500">AI 추천 상위 장소를 미리 검토하세요.</p>
            <div className="space-y-3">
              {recommendedPlaces.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  등록된 추천 장소가 없습니다.
                </div>
              )}
              {recommendedPlaces.map((place) => (
                <div key={place.id} className="rounded-2xl border border-slate-100 bg-[#E8F1FF] p-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{place.name}</p>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-primary-600">
                      {place.category?.name ?? '미분류'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{place.ai_generated_info ?? '운영 메모 없음'}</p>
                  <p className="mt-2 text-xs font-semibold text-primary-600">집결지 · {place.ai_meeting_point ?? '미정'}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">참가자 주의 대상</h2>
            <p className="text-sm text-slate-500">건강 모니터링에서 주의 상태인 참가자입니다.</p>
            <div className="mt-4 space-y-3">
              {participantsAtRisk.length === 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-600">
                  현재 주의 대상이 없습니다.
                </div>
              )}
              {participantsAtRisk.slice(0, 3).map((participant) => (
                <div key={participant.participant_id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <p className="font-semibold text-amber-800">{participant.traveler_name}</p>
                  <p className="text-xs text-amber-600">
                    심박수 {participant.health?.heart_rate ?? '-'} bpm · 산소포화도 {participant.health?.spo2 ?? '-'}%
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
