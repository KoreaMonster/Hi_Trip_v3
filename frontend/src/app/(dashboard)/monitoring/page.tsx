'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, HeartPulse, MapPin, RotateCcw, ShieldCheck, WifiOff } from 'lucide-react';
import {
  useHealthQuery,
  useMonitoringAlertsQuery,
  useMonitoringLatestQuery,
  useMonitoringParticipantHistoryQuery,
  useTripsQuery,
} from '@/lib/queryHooks';
import { postMonitoringGenerateDemo } from '@/lib/api';
import type {
  LocationSnapshot,
  MonitoringAlert,
  MonitoringParticipantHistory,
  ParticipantLatest,
} from '@/types/api';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const monitoringTone: Record<'normal' | 'warning' | 'critical' | 'offline', string> = {
  normal: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200',
  warning: 'bg-amber-500/10 text-amber-600 border border-amber-200',
  critical: 'bg-rose-500/10 text-rose-600 border border-rose-200',
  offline: 'bg-slate-200 text-slate-500 border border-slate-200',
};

export default function MonitoringPage() {
  const { data: trips = [] } = useTripsQuery();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [generationNotice, setGenerationNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(
    null,
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    if (trips.length > 0 && selectedTripId === null) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips, selectedTripId]);

  useEffect(() => {
    setSelectedParticipantId(null);
  }, [selectedTripId]);

  const { data: alerts = [], isLoading: alertsLoading } = useMonitoringAlertsQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
  });
  const { data: latest = [], isLoading: latestLoading } = useMonitoringLatestQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
  });
  const {
    data: participantHistory,
    isLoading: historyLoading,
    isFetching: historyFetching,
  } = useMonitoringParticipantHistoryQuery(selectedTripId ?? undefined, selectedParticipantId ?? undefined);
  const { data: health } = useHealthQuery();

  useEffect(() => {
    if (latest.length === 0) {
      setSelectedParticipantId(null);
      return;
    }

    setSelectedParticipantId((current) => {
      if (current && latest.some((item) => item.participant_id === current)) {
        return current;
      }
      return latest[0].participant_id;
    });
  }, [latest]);

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

  const selectedParticipant = useMemo(
    () => latest.find((item) => item.participant_id === selectedParticipantId) ?? null,
    [latest, selectedParticipantId],
  );

  const historyChartData = useMemo(() => buildHistoryChart(participantHistory), [participantHistory]);
  const latestLocation = useMemo(() => extractLatestLocation(participantHistory), [participantHistory]);
  const historyWindow = useMemo(() => deriveHistoryWindow(participantHistory), [participantHistory]);
  const historyLoadingState = historyLoading || historyFetching;

  const generateDemoMutation = useMutation({
    mutationFn: (tripId: number) => postMonitoringGenerateDemo(tripId, { minutes: 10, interval: 60 }),
    onSuccess: async (result, tripId) => {
      setGenerationNotice({
        message: `최근 ${result.minutes}분 데이터를 ${result.created_records}건 생성했어요.`,
        tone: 'success',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['monitoring', 'alerts', tripId] }),
        queryClient.invalidateQueries({ queryKey: ['monitoring', 'latest', tripId] }),
        queryClient.invalidateQueries({ queryKey: ['monitoring', 'history', tripId, selectedParticipantId] }),
      ]);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '데모 데이터를 생성하지 못했습니다.';
      setGenerationNotice({ message, tone: 'error' });
    },
  });

  const isGenerateDisabled = !selectedTripId || generateDemoMutation.isPending;

  const handleGenerateDemo = () => {
    if (!selectedTripId) return;
    setGenerationNotice(null);
    generateDemoMutation.mutate(selectedTripId);
  };

  useEffect(() => {
    if (!generationNotice) return;
    const timer = window.setTimeout(() => setGenerationNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [generationNotice]);

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
            <button
              type="button"
              onClick={handleGenerateDemo}
              disabled={isGenerateDisabled}
              className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-600 shadow-sm transition hover:border-primary-300 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className={`h-4 w-4 ${generateDemoMutation.isPending ? 'animate-spin' : ''}`} />
              데모 데이터 생성
            </button>
            <button className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
              <ShieldCheck className="h-4 w-4" />
              비상 매뉴얼 열기
            </button>
          </div>
          {generationNotice && (
            <p
              className={`mt-2 text-xs font-medium ${
                generationNotice.tone === 'success' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {generationNotice.message}
            </p>
          )}
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">실시간 상태</h2>
              <p className="text-sm text-slate-500">참가자별 최신 건강/위치 데이터를 요약합니다.</p>
            </div>
            {latest.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {latest.length}명
              </span>
            )}
          </div>
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
              <ParticipantStatus
                key={item.participant_id}
                snapshot={item}
                isSelected={item.participant_id === selectedParticipantId}
                onSelect={(id) => setSelectedParticipantId(id)}
              />
            ))}
          </div>
          <ParticipantDetailPanel
            participant={selectedParticipant}
            history={participantHistory}
            chartData={historyChartData}
            isLoading={historyLoadingState}
            latestLocation={latestLocation}
            timeWindow={historyWindow}
          />
        </aside>
      </section>
    </div>
  );
}

function buildHistoryChart(history?: MonitoringParticipantHistory): HistoryChartPoint[] {
  if (!history) return [];

  return history.health.map((item) => {
    const spo2Value = Number.parseFloat(item.spo2);
    return {
      label: formatShortTimestamp(item.measured_at),
      heartRate: item.heart_rate,
      spo2: Number.isFinite(spo2Value) ? spo2Value : 0,
    };
  });
}

function extractLatestLocation(history?: MonitoringParticipantHistory): LocationSnapshot | null {
  if (!history || history.location.length === 0) {
    return null;
  }
  return history.location[history.location.length - 1];
}

function deriveHistoryWindow(history?: MonitoringParticipantHistory): string | null {
  if (!history || history.health.length === 0) {
    return null;
  }

  const first = history.health[0];
  const last = history.health[history.health.length - 1];
  return `${formatShortTimestamp(first.measured_at)} ~ ${formatShortTimestamp(last.measured_at)}`;
}

function formatShortTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function statusLabel(status?: string | null) {
  switch (status) {
    case 'normal':
      return '정상';
    case 'caution':
    case 'warning':
      return '주의';
    case 'danger':
    case 'critical':
      return '위험';
    default:
      return '정보 없음';
  }
}

function statusTone(status?: string | null) {
  switch (status) {
    case 'normal':
      return 'bg-emerald-500/20 text-emerald-700';
    case 'caution':
    case 'warning':
      return 'bg-amber-500/20 text-amber-700';
    case 'danger':
    case 'critical':
      return 'bg-rose-500/20 text-rose-700';
    default:
      return 'bg-slate-200 text-slate-600';
  }
}

function formatCoordinate(value?: string | null) {
  if (!value) return '-';
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toFixed(4);
}

function formatAccuracy(value?: string | null) {
  if (!value) return '—';
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toFixed(1);
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

type ParticipantStatusProps = {
  snapshot: ParticipantLatest;
  isSelected: boolean;
  onSelect: (participantId: number) => void;
};

function ParticipantStatus({ snapshot, isSelected, onSelect }: ParticipantStatusProps) {
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

  const selectionStyle = isSelected
    ? 'ring-2 ring-primary-400 ring-offset-2 shadow-md'
    : 'hover:shadow-md focus:ring-2 focus:ring-primary-400 focus:ring-offset-2';

  return (
    <button
      type="button"
      onClick={() => onSelect(snapshot.participant_id)}
      className={`w-full rounded-2xl px-4 py-4 text-left transition ${tone} ${selectionStyle}`}
    >
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
    </button>
  );
}

type HistoryChartPoint = {
  label: string;
  heartRate: number;
  spo2: number;
};

type ParticipantDetailPanelProps = {
  participant: ParticipantLatest | null;
  history: MonitoringParticipantHistory | undefined;
  chartData: HistoryChartPoint[];
  isLoading: boolean;
  latestLocation: LocationSnapshot | null;
  timeWindow: string | null;
};

function ParticipantDetailPanel({
  participant,
  history,
  chartData,
  isLoading,
  latestLocation,
  timeWindow,
}: ParticipantDetailPanelProps) {
  if (!participant) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        모니터링할 참가자를 선택해 주세요.
      </div>
    );
  }

  const statusBadge = statusLabel(participant.health?.status);
  const badgeTone = statusTone(participant.health?.status);
  const coordinateText = latestLocation
    ? (() => {
        const lat = formatCoordinate(latestLocation.latitude);
        const lng = formatCoordinate(latestLocation.longitude);
        const accuracy = formatAccuracy(latestLocation.accuracy_m);
        const suffix = accuracy === '—' ? '' : ` (±${accuracy}m)`;
        return `${lat}, ${lng}${suffix}`;
      })()
    : '정보 없음';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{participant.traveler_name}</p>
          <p className="text-xs text-slate-500">
            심박수 {participant.health?.heart_rate ?? '-'} bpm · 산소포화도 {participant.health?.spo2 ?? '-'}%
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeTone}`}>{statusBadge}</span>
      </div>
      <div className="mt-4 h-48 rounded-xl bg-white p-2 shadow-inner">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">측정 이력을 불러오는 중입니다.</div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">아직 측정 이력이 없습니다.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5f5' }} fontSize={11} interval="preserveEnd" />
              <YAxis
                yAxisId="heart"
                tickLine={false}
                axisLine={{ stroke: '#cbd5f5' }}
                width={34}
                fontSize={11}
                allowDecimals={false}
                label={{ value: 'bpm', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10 }}
              />
              <YAxis
                yAxisId="spo2"
                orientation="right"
                tickLine={false}
                axisLine={{ stroke: '#cbd5f5' }}
                width={34}
                fontSize={11}
                domain={[85, 100]}
                label={{ value: '%', angle: -90, position: 'insideRight', fill: '#475569', fontSize: 10 }}
              />
              <Tooltip
                formatter={(value, key) =>
                  key === 'heartRate'
                    ? [`${value} bpm`, '심박수']
                    : [`${Number(value).toFixed(1)}%`, 'SpO₂']
                }
                labelFormatter={(label) => `측정 시각 ${label}`}
                contentStyle={{ borderRadius: 12, borderColor: '#cbd5f5' }}
              />
              <Line yAxisId="heart" type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line
                yAxisId="spo2"
                type="monotone"
                dataKey="spo2"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 3"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-500">
        {timeWindow && <p>측정 구간: {timeWindow}</p>}
        <p>최근 위치: {coordinateText}</p>
        {history && history.health.length > 0 && (
          <p>총 측정 {history.health.length}건 · 위치 {history.location.length}건</p>
        )}
      </div>
    </div>
  );
}
