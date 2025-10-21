'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, HeartPulse, MapPin, ShieldCheck, WifiOff } from 'lucide-react';
import { useHealthQuery, useMonitoringAlertsQuery, useMonitoringLatestQuery, useTripsQuery } from '@/lib/queryHooks';
import type { MonitoringAlert, ParticipantLatest } from '@/types/api';

const monitoringTone: Record<'normal' | 'warning' | 'critical' | 'offline', string> = {
  normal: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200',
  warning: 'bg-amber-500/10 text-amber-600 border border-amber-200',
  critical: 'bg-rose-500/10 text-rose-600 border border-rose-200',
  offline: 'bg-slate-200 text-slate-500 border border-slate-200',
};

export default function MonitoringPage() {
  const { data: trips = [] } = useTripsQuery();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  useEffect(() => {
    if (trips.length > 0 && selectedTripId === null) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips, selectedTripId]);

  const { data: alerts = [], isLoading: alertsLoading } = useMonitoringAlertsQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
  });
  const { data: latest = [], isLoading: latestLoading } = useMonitoringLatestQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
  });
  const { data: health } = useHealthQuery();

  const level = useMemo<'normal' | 'warning' | 'critical' | 'offline'>(() => {
    if (!selectedTripId) return 'offline';
    if (alerts.length === 0 && latest.length === 0) return 'warning';
    if (alerts.some((alert) => alert.alert_type === 'health')) return 'critical';
    if (alerts.length > 0) return 'warning';
    return 'normal';
  }, [alerts, latest, selectedTripId]);

  const participantsAtRisk = useMemo(
    () =>
      latest.filter((item) => {
        const status = item.health?.status;
        return status && status !== 'normal';
      }),
    [latest],
  );

  const lastAlert = alerts[0];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">실시간 모니터링</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">안전 현황 센터</h1>
            <p className="mt-1 text-sm text-slate-500">참가자 건강과 위치 상태를 실시간으로 확인하고 빠르게 대응하세요.</p>
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
            <button className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
              <ShieldCheck className="h-4 w-4" />
              비상 매뉴얼 열기
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MonitoringSummary
            icon={ShieldCheck}
            label="전체 상태"
            value={levelLabel(level)}
            helper={health?.message ?? '상태 정보를 불러오는 중입니다.'}
            tone={monitoringTone[level]}
          />
          <MonitoringSummary
            icon={AlertTriangle}
            label="경보"
            value={`${alerts.length}건`}
            helper={lastAlert ? `${lastAlert.traveler_name} · ${formatTime(lastAlert.snapshot_time)}` : '최근 경보 없음'}
            tone={alerts.length > 0 ? monitoringTone.warning : monitoringTone.normal}
          />
          <MonitoringSummary
            icon={HeartPulse}
            label="건강 주의"
            value={`${participantsAtRisk.length}명`}
            helper={participantsAtRisk[0]?.traveler_name ?? '모든 인원이 정상입니다.'}
            tone={participantsAtRisk.length > 0 ? monitoringTone.warning : monitoringTone.normal}
          />
          <MonitoringSummary
            icon={MapPin}
            label="위치 이상"
            value={`${alerts.filter((alert) => alert.alert_type === 'location').length}건`}
            helper="지오펜스 이탈"
            tone={alerts.some((alert) => alert.alert_type === 'location') ? monitoringTone.warning : monitoringTone.normal}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">경보 타임라인</h2>
              <p className="text-sm text-slate-500">발생 시간과 내용을 확인하고 담당자에게 알림을 전달하세요.</p>
            </div>
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">최근 24시간</span>
          </div>
          <div className="space-y-3">
            {alertsLoading && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                경보 데이터를 불러오는 중입니다.
              </div>
            )}
            {!alertsLoading && alerts.length === 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-600">
                모든 참가자가 안전하게 여행 중입니다.
              </div>
            )}
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </article>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">실시간 상태</h2>
          <p className="text-sm text-slate-500">참가자별 최신 건강/위치 데이터를 요약합니다.</p>
          <div className="space-y-3">
            {latestLoading && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                최신 상태를 불러오는 중입니다.
              </div>
            )}
            {!latestLoading && latest.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                아직 수집된 측정 데이터가 없습니다.
              </div>
            )}
            {latest.map((item) => (
              <ParticipantStatus key={item.participant_id} snapshot={item} />
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function levelLabel(level: 'normal' | 'warning' | 'critical' | 'offline') {
  switch (level) {
    case 'critical':
      return '위험';
    case 'warning':
      return '주의';
    case 'offline':
      return '연결 대기';
    default:
      return '정상';
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

function MonitoringSummary({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: (props: { className?: string }) => JSX.Element;
  label: string;
  value: string;
  helper: string;
  tone: string;
}) {
  return (
    <article className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${tone}`}>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-current">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{helper}</p>
    </article>
  );
}

function AlertCard({ alert }: { alert: MonitoringAlert }) {
  const tone =
    alert.alert_type === 'health'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  const icon = alert.alert_type === 'health' ? <HeartPulse className="h-4 w-4" /> : <MapPin className="h-4 w-4" />;
  return (
    <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-slate-700 shadow-sm">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-slate-800">{alert.traveler_name}</p>
          <p className="text-xs text-slate-600">{alert.message}</p>
          <p className="text-xs text-slate-400">{formatTime(alert.snapshot_time)}</p>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-700">Trip #{alert.trip_id}</span>
    </div>
  );
}

function ParticipantStatus({ snapshot }: { snapshot: ParticipantLatest }) {
  const status = snapshot.health?.status ?? 'unknown';
  const isOffline = !snapshot.location;
  const tone =
    status === 'normal'
      ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
      : status === 'caution' || status === 'warning'
      ? 'bg-amber-50 border border-amber-200 text-amber-600'
      : status === 'danger' || status === 'critical'
      ? 'bg-rose-50 border border-rose-200 text-rose-600'
      : 'bg-slate-100 border border-slate-200 text-slate-500';
  return (
    <div className={`rounded-2xl border px-4 py-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{snapshot.traveler_name}</p>
        <span className="text-xs font-semibold text-slate-600">
          {isOffline ? (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <WifiOff className="h-3.5 w-3.5" /> 오프라인
            </span>
          ) : (
            '실시간'
          )}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        심박수 {snapshot.health?.heart_rate ?? '-'} bpm · 산소포화도 {snapshot.health?.spo2 ?? '-'}%
      </p>
      <p className="mt-1 text-xs text-slate-500">
        위치 {snapshot.location ? `${snapshot.location.latitude}, ${snapshot.location.longitude}` : '정보 없음'}
      </p>
    </div>
  );
}
