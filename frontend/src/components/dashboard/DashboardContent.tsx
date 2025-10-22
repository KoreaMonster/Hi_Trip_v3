'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  useHealthQuery,
  useMonitoringAlertsQuery,
  useMonitoringLatestQuery,
  usePlacesQuery,
  useSchedulesQuery,
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
  type LucideIcon,
} from 'lucide-react';
import BookingTrendChart, { type BookingTrendPoint } from './BookingTrendChart';
import { useScopedTrips } from '@/lib/useScopedTrips';
import { useTranslations, type TranslationKey } from '@/lib/i18n';
import { useLocale } from '@/stores/useLocaleStore';

type SummaryCardKey = 'trips' | 'schedules' | 'alerts';

interface SummaryCardConfig {
  key: SummaryCardKey;
  titleKey: TranslationKey;
  helperKey: TranslationKey;
  todayHelperKey?: TranslationKey;
  icon: LucideIcon;
  accent: string;
}

const summaryCards: readonly SummaryCardConfig[] = [
  {
    key: 'trips',
    titleKey: 'dashboard.summary.trips.title',
    helperKey: 'dashboard.summary.trips.helper',
    icon: Plane,
    accent: 'bg-primary-500/10 text-primary-600',
  },
  {
    key: 'schedules',
    titleKey: 'dashboard.summary.schedules.title',
    helperKey: 'dashboard.summary.schedules.total',
    todayHelperKey: 'dashboard.summary.schedules.today',
    icon: CalendarCheck,
    accent: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    key: 'alerts',
    titleKey: 'dashboard.summary.alerts.title',
    helperKey: 'dashboard.summary.alerts.helper',
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

const monitoringBadgeLabelKeys: Record<MonitoringLevel, TranslationKey> = {
  normal: 'monitoring.level.normal',
  warning: 'monitoring.level.warning',
  critical: 'monitoring.level.critical',
  unknown: 'monitoring.level.unknown',
};

const formatShortTime = (value: string) => `${value.slice(0, 5)}`;

export default function DashboardContent() {
  const t = useTranslations();
  const locale = useLocale();

  const { data: trips } = useScopedTrips();
  const activeTrip = trips[0];
  const activeTripId = activeTrip?.id;

  const { data: schedules } = useSchedulesQuery(activeTripId);
  const { data: monitoringAlerts } = useMonitoringAlertsQuery(activeTripId);
  const { data: monitoringLatest } = useMonitoringLatestQuery(activeTripId);
  const { data: health } = useHealthQuery();
  const { data: places } = usePlacesQuery();

  const formatTripRange = (start?: string | null, end?: string | null) => {
    if (!start || !end) return t('dashboard.tripRange.unplanned');
    const s = new Date(start);
    const e = new Date(end);
    return `${s.getMonth() + 1}/${s.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`;
  };

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
    if (bookingTrendData.length === 0) return t('dashboard.trend.change.noData');
    if (bookingTrendData.length < 2) return t('dashboard.trend.change.collecting');

    const previous = bookingTrendData[bookingTrendData.length - 2]?.value ?? 0;
    const current = bookingTrendData[bookingTrendData.length - 1]?.value ?? 0;

    if (previous === 0 && current === 0) return t('dashboard.trend.change.noChange');
    if (previous === 0) return current > 0 ? t('dashboard.trend.change.new') : t('dashboard.trend.change.noChange');

    const change = Math.round(((current - previous) / previous) * 100);
    if (!Number.isFinite(change)) return t('dashboard.trend.change.noChange');

    return `${change > 0 ? '+' : ''}${change}% ${t('dashboard.trend.change.suffix')}`;
  }, [bookingTrendData, t]);

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

  const scheduleDisplayTitle = (schedule: Schedule) =>
    schedule.main_content ?? schedule.place_name ?? t('dashboard.schedules.titleFallback');

  const participantsAtRisk = (monitoringLatest ?? []).filter(
    (item) => item.health && item.health.status !== 'normal',
  );

  const healthStatusKey: TranslationKey = (() => {
    if (!health?.status) return 'dashboard.health.status.unknown';
    if (health.status === 'ok') return 'dashboard.health.status.ok';
    return 'dashboard.health.status.needsAttention';
  })();

  const healthStatusLabel = t(healthStatusKey);
  const healthMessage = health?.message ?? t('dashboard.health.messageFallback');
  const healthServiceLabel = health?.service
    ? `${t('dashboard.health.servicePrefix')} ${health.service}`
    : t('dashboard.health.serviceFallback');

  const recommendedPlaces = useMemo(() => (places ?? []).slice(0, 3), [places]);
  const participantsUnit = t('dashboard.tripsSection.participantsUnit');
  const participantsCountFormatter = (count: number) =>
    locale === 'ko' ? `${count}${participantsUnit}` : `${count} ${participantsUnit}`;

  return (
    <div className="space-y-6">
      <header className="animate-[fade-in_0.6s_ease-out] rounded-3xl border border-slate-200 bg-gradient-to-r from-[#E8F1FF] via-white to-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">{t('dashboard.badge')}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{t('dashboard.title')}</h1>
            <p className="mt-2 text-sm text-slate-500">{t('dashboard.subtitle')}</p>
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
            {summaryCards.map(({ key, titleKey, helperKey, todayHelperKey, icon: Icon, accent }) => {
              const scheduleCount = todaysSchedules.length || schedules?.length || 0;
              const value =
                key === 'trips'
                  ? trips?.length ?? 0
                  : key === 'schedules'
                  ? scheduleCount
                  : totalAlerts;

              const helperText =
                key === 'schedules'
                  ? todaysSchedules.length > 0 && todayHelperKey
                    ? t(todayHelperKey)
                    : t(helperKey)
                  : t(helperKey);

              return (
                <article
                  key={key}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t(titleKey)}</p>
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
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t('dashboard.summary.service.title')}</p>
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
                  <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.trend.title')}</h2>
                  <p className="text-sm text-slate-500">{t('dashboard.trend.subtitle')}</p>
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
                  <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.tripsSection.title')}</h2>
                  <p className="text-sm text-slate-500">{t('dashboard.tripsSection.subtitle')}</p>
                </div>
                <button className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 shadow-sm transition hover:bg-primary-100">
                  {t('dashboard.tripsSection.viewAll')}
                </button>
              </div>
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-[#F7F9FC] text-slate-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">{t('dashboard.tripsSection.table.trip')}</th>
                      <th className="px-5 py-3 text-left font-semibold">{t('dashboard.tripsSection.table.period')}</th>
                      <th className="px-5 py-3 text-left font-semibold">{t('dashboard.tripsSection.table.monitoring')}</th>
                      <th className="px-5 py-3 text-right font-semibold">{t('dashboard.tripsSection.table.participants')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(trips ?? []).map((trip) => {
                      const level = monitoringLevelByTrip.get(trip.id) ?? 'unknown';
                      const badgeStyle = monitoringBadgeStyles[level];
                      const badgeIcon = monitoringBadgeIcons[level];
                      const badgeText = t(monitoringBadgeLabelKeys[level]);
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
                          <td className="px-5 py-3 text-right text-slate-600">{participantsCountFormatter(participantCount)}</td>
                        </tr>
                      );
                    })}
                    {(!trips || trips.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-sm text-slate-500">
                          {t('dashboard.tripsSection.table.empty')}
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
            <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.schedules.title')}</h2>
            <p className="text-sm text-slate-500">{t('dashboard.schedules.subtitle')}</p>
            <ul className="mt-5 space-y-4">
              {upcomingSchedules.length === 0 && (
                <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  {t('dashboard.schedules.empty')}
                </li>
              )}
              {upcomingSchedules.map((schedule) => (
                <li key={schedule.id} className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800">{scheduleDisplayTitle(schedule)}</p>
                    <p className="text-xs text-slate-500">
                      {(activeTrip && activeTrip.id === schedule.trip ? activeTrip.title : `Trip #${schedule.trip}`) ?? t('dashboard.tripsSection.tripFallback')}
                      · {formatShortTime(schedule.start_time)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.recommended.title')}</h2>
            <p className="text-sm text-slate-500">{t('dashboard.recommended.subtitle')}</p>
            <div className="space-y-3">
              {recommendedPlaces.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  {t('dashboard.recommended.empty')}
                </div>
              )}
              {recommendedPlaces.map((place) => (
                <div key={place.id} className="rounded-2xl border border-slate-100 bg-[#E8F1FF] p-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/places/${place.id}`}
                      className="text-sm font-semibold text-primary-600 hover:underline"
                    >
                      {place.name}
                    </Link>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-primary-600">
                      {place.category?.name ?? t('dashboard.recommended.categoryFallback')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{place.ai_generated_info ?? t('dashboard.recommended.noteFallback')}</p>
                  <p className="mt-2 text-xs font-semibold text-primary-600">
                    {t('dashboard.recommended.meetingPrefix')}{' '}
                    {place.ai_meeting_point ?? t('dashboard.recommended.meetingFallback')}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.participants.title')}</h2>
            <p className="text-sm text-slate-500">{t('dashboard.participants.subtitle')}</p>
            <div className="mt-4 space-y-3">
              {participantsAtRisk.length === 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-600">
                  {t('dashboard.participants.empty')}
                </div>
              )}
              {participantsAtRisk.slice(0, 3).map((participant) => (
                <div key={participant.participant_id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <p className="font-semibold text-amber-800">{participant.traveler_name}</p>
                  <p className="text-xs text-amber-600">
                    {t('dashboard.participants.heartRate')} {participant.health?.heart_rate ?? '-'} bpm · {t('dashboard.participants.spo2')} {participant.health?.spo2 ?? '-'}%
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
