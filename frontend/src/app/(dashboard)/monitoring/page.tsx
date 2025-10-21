'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  HeartPulse,
  MapPin,
  Search,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import {
  useHealthQuery,
  useMonitoringAlertsQuery,
  useMonitoringLatestQuery,
  useParticipantsQuery,
} from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { MonitoringAlert, ParticipantLatest, Trip, TripParticipant } from '@/types/api';

type RiskLevel = 'normal' | 'warning' | 'critical' | 'offline';

const riskTone: Record<RiskLevel, string> = {
  normal: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  warning: 'bg-amber-50 text-amber-600 border-amber-200',
  critical: 'bg-rose-50 text-rose-600 border-rose-200',
  offline: 'bg-slate-100 text-slate-500 border-slate-200',
};

const riskLabel: Record<RiskLevel, string> = {
  normal: '정상',
  warning: '주의',
  critical: '위험',
  offline: '연결 대기',
};

const formatDate = (value?: string | null) => {
  if (!value) return '미정';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}`;
};

const formatTripRange = (trip?: Trip | null) => {
  if (!trip) return '일정 정보 없음';
  if (!trip.start_date || !trip.end_date) return '일정 미정';
  return `${formatDate(trip.start_date)} ~ ${formatDate(trip.end_date)}`;
};

type ParticipantRow = {
  participant: TripParticipant;
  snapshot: ParticipantLatest | null;
  alerts: MonitoringAlert[];
  level: RiskLevel;
};

export default function MonitoringPage() {
  const {
    data: trips = [],
    isLoading: tripsLoading,
    isSuperAdmin,
  } = useScopedTrips();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');

  const sortedTrips = useMemo(() => {
    const statusPriority: Record<Trip['status'], number> = { ongoing: 0, planning: 1, completed: 2 };
    const toComparable = (value?: string | null) => {
      if (!value) return Number.MAX_SAFE_INTEGER;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return Number.MAX_SAFE_INTEGER;
      }
      return parsed.getTime();
    };

    return [...trips].sort((a, b) => {
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      const dateDiff = toComparable(a.start_date) - toComparable(b.start_date);
      if (dateDiff !== 0) return dateDiff;
      return a.title.localeCompare(b.title);
    });
  }, [trips]);

  const groupedTrips = useMemo(
    () =>
      sortedTrips.map((trip, index) => ({
        order: index + 1,
        trip,
      })),
    [sortedTrips],
  );

  useEffect(() => {
    if (sortedTrips.length === 0) {
      if (selectedTripId !== null) {
        setSelectedTripId(null);
      }
      return;
    }

    if (selectedTripId === null || !sortedTrips.some((trip) => trip.id === selectedTripId)) {
      setSelectedTripId(sortedTrips[0].id);
    }
  }, [selectedTripId, sortedTrips]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );
  const canSelectTrip = groupedTrips.length > 1;
  const noGroupMessage = isSuperAdmin
    ? '등록된 여행이 없습니다.'
    : '담당된 여행이 없습니다.';

  const alertsQueryEnabled = typeof selectedTripId === 'number';
  const { data: alerts = [], isLoading: alertsLoading } = useMonitoringAlertsQuery(selectedTripId ?? undefined, {
    enabled: alertsQueryEnabled,
  });
  const { data: latest = [], isLoading: latestLoading } = useMonitoringLatestQuery(selectedTripId ?? undefined, {
    enabled: alertsQueryEnabled,
  });
  const { data: participants = [], isLoading: participantsLoading } = useParticipantsQuery(
    selectedTripId ?? undefined,
    {
      enabled: alertsQueryEnabled,
    },
  );
  const { data: health } = useHealthQuery();

  const latestByParticipant = useMemo(() => {
    const map = new Map<number, ParticipantLatest>();
    latest.forEach((item) => {
      map.set(item.participant_id, item);
    });
    return map;
  }, [latest]);

  const alertsByParticipant = useMemo(() => {
    const map = new Map<number, MonitoringAlert[]>();
    alerts.forEach((alert) => {
      const current = map.get(alert.participant) ?? [];
      current.push(alert);
      map.set(alert.participant, current);
    });
    return map;
  }, [alerts]);

  const determineRisk = useCallback(
    (snapshot: ParticipantLatest | null, participantAlerts: MonitoringAlert[]): RiskLevel => {
      if (!snapshot) {
        return participantAlerts.length > 0 ? 'warning' : 'offline';
      }

      if (participantAlerts.some((alert) => alert.alert_type === 'health')) {
        return 'critical';
      }

      const status = snapshot.health?.status?.toLowerCase();
      if (!status) {
        return participantAlerts.length > 0 ? 'warning' : 'normal';
      }
      if (status.includes('critical') || status.includes('danger') || status.includes('위험')) {
        return 'critical';
      }
      if (status.includes('warning') || status.includes('caution') || status.includes('주의')) {
        return 'warning';
      }
      return participantAlerts.length > 0 ? 'warning' : 'normal';
    },
    [],
  );

  const participantRows = useMemo<ParticipantRow[]>(() => {
    return participants.map((participant) => {
      const snapshot = latestByParticipant.get(participant.id) ?? null;
      const participantAlerts = alertsByParticipant.get(participant.id) ?? [];
      const level = determineRisk(snapshot, participantAlerts);
      return { participant, snapshot, alerts: participantAlerts, level };
    });
  }, [alertsByParticipant, determineRisk, latestByParticipant, participants]);

  const filteredRows = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (normalized.length === 0) {
      return participantRows;
    }
    return participantRows.filter((row) => {
      const { traveler } = row.participant;
      return [traveler.full_name_kr, traveler.phone, traveler.email]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [keyword, participantRows]);

  const sortedRows = useMemo(() => {
    const levelPriority: Record<RiskLevel, number> = { critical: 0, warning: 1, normal: 2, offline: 3 };
    return [...filteredRows].sort((a, b) => {
      const levelDiff = levelPriority[a.level] - levelPriority[b.level];
      if (levelDiff !== 0) return levelDiff;
      return a.participant.traveler.full_name_kr.localeCompare(b.participant.traveler.full_name_kr);
    });
  }, [filteredRows]);

  const totalCritical = useMemo(
    () => participantRows.filter((row) => row.level === 'critical').length,
    [participantRows],
  );
  const totalWarning = useMemo(
    () => participantRows.filter((row) => row.level === 'warning').length,
    [participantRows],
  );
  const totalOffline = useMemo(
    () => participantRows.filter((row) => row.level === 'offline').length,
    [participantRows],
  );

  const overallLevel: RiskLevel = useMemo(() => {
    if (participantRows.length === 0) {
      return 'offline';
    }
    if (totalCritical > 0) return 'critical';
    if (totalWarning > 0) return 'warning';
    if (totalOffline === participantRows.length) return 'offline';
    return 'normal';
  }, [participantRows.length, totalCritical, totalWarning, totalOffline]);

  const isTripSelected = Boolean(selectedTrip);
  const isDataLoading = (participantsLoading || latestLoading) && isTripSelected;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">여행 중 그룹</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">진행 중인 여행 리스트</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isSuperAdmin
                ? '총괄관리자는 모든 여행의 모니터링 상태를 확인할 수 있습니다.'
                : '담당된 여행을 기준으로 실시간 모니터링 대상을 확인하세요.'}
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-[#F7F9FC] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">구분</th>
                <th className="px-5 py-3 text-left font-semibold">고객 수</th>
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
              {!tripsLoading && groupedTrips.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    {noGroupMessage}
                  </td>
                </tr>
              )}
              {groupedTrips.map(({ order, trip }) => {
                const isActive = trip.id === selectedTripId;
                return (
                  <tr
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={`cursor-pointer transition ${
                      isActive ? 'bg-primary-50/80 text-primary-700' : 'hover:bg-slate-50/70'
                    }`}
                    aria-selected={isActive}
                  >
                    <td className="px-5 py-4 font-semibold">{order}</td>
                    <td className="px-5 py-4 font-semibold">{trip.participant_count ?? 0}명</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{trip.title}</span>
                        <span className="text-xs text-slate-500">
                          {trip.destination ?? '목적지 미정'} · {formatTripRange(trip)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{trip.manager_name ?? '담당자 미지정'}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(trip.start_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">여행 중 관리</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {selectedTrip ? `${selectedTrip.title} 모니터링 센터` : '고객 모니터링 센터'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {selectedTrip
                ? `${selectedTrip.destination ?? '목적지 미정'} · ${formatTripRange(selectedTrip)}`
                : '생체 데이터와 경보 내역을 확인하고 위험 상황을 빠르게 대응하세요.'}
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
                  {groupedTrips.map(({ trip }) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            ) : selectedTrip ? (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                {selectedTrip.title}
              </span>
            ) : null}
            <button className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
              <ShieldCheck className="h-4 w-4" />
              비상 매뉴얼 열기
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Stethoscope}
            label="전체 상태"
            value={riskLabel[overallLevel]}
            helper={health?.message ?? '서비스 상태 확인 중'}
            tone={riskTone[overallLevel]}
          />
          <SummaryCard
            icon={AlertTriangle}
            label="누적 경보"
            value={`${alerts.length}건`}
            helper={alerts[0] ? `${alerts[0].traveler_name} · ${formatAlertTime(alerts[0].snapshot_time)}` : '최근 경보 없음'}
            tone={alerts.length > 0 ? riskTone.warning : riskTone.normal}
          />
          <SummaryCard
            icon={HeartPulse}
            label="위험 고객"
            value={`${totalCritical}명`}
            helper={totalWarning > 0 ? `주의 ${totalWarning}명 포함` : '건강 이상 없음'}
            tone={totalCritical > 0 ? riskTone.critical : totalWarning > 0 ? riskTone.warning : riskTone.normal}
          />
          <SummaryCard
            icon={MapPin}
            label="오프라인"
            value={`${totalOffline}명`}
            helper="기기 연결 상태를 확인하세요"
            tone={totalOffline > 0 ? riskTone.offline : riskTone.normal}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.8fr_1.2fr]">
        <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">신청자 현황</h2>
              <p className="text-sm text-slate-500">여행 중 고객 건강 상태와 경보 여부를 한눈에 확인하세요.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
                <Search className="h-4 w-4 text-primary-500" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="이름, 연락처 검색"
                  className="w-40 border-none bg-transparent placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-[#F7F9FC] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">이름</th>
                  <th className="px-4 py-3 text-left font-semibold">성별</th>
                  <th className="px-4 py-3 text-left font-semibold">생년월일</th>
                  <th className="px-4 py-3 text-left font-semibold">연락처</th>
                  <th className="px-4 py-3 text-left font-semibold">이메일</th>
                  <th className="px-4 py-3 text-left font-semibold">위험 여부</th>
                  <th className="px-4 py-3 text-left font-semibold">심박수</th>
                  <th className="px-4 py-3 text-left font-semibold">산소포화도</th>
                  <th className="px-4 py-3 text-right font-semibold">경보</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isTripSelected ? (
                  <>
                    {isDataLoading && (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                          데이터를 불러오는 중입니다.
                        </td>
                      </tr>
                    )}
                    {!isDataLoading && sortedRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                          조회된 참가자 정보가 없습니다.
                        </td>
                      </tr>
                    )}
                    {sortedRows.map((row) => {
                      const { participant, snapshot, alerts: participantAlerts, level } = row;
                      const traveler = participant.traveler;
                      const birthDateValue = traveler.birth_date ? new Date(traveler.birth_date) : null;
                      const birthDate =
                        birthDateValue && !Number.isNaN(birthDateValue.getTime())
                          ? birthDateValue.toLocaleDateString('ko-KR')
                          : '-';
                      const heartRateValue = snapshot?.health?.heart_rate;
                      const spo2Value = snapshot?.health?.spo2 ?? null;
                      const heartRate = typeof heartRateValue === 'number' ? `${heartRateValue} bpm` : '-';
                      const spo2 = typeof spo2Value === 'string' && spo2Value.length > 0 ? `${spo2Value}%` : '-';
                      return (
                        <tr
                          key={participant.id}
                          className={`transition hover:bg-slate-50/70 ${
                            level === 'critical'
                              ? 'bg-rose-50'
                              : level === 'warning'
                              ? 'bg-amber-50/40'
                              : level === 'offline'
                              ? 'bg-slate-50'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900">{traveler.full_name_kr}</td>
                          <td className="px-4 py-3 text-slate-600">{genderLabel(traveler.gender)}</td>
                          <td className="px-4 py-3 text-slate-600">{birthDate}</td>
                          <td className="px-4 py-3 text-slate-600">{traveler.phone}</td>
                          <td className="px-4 py-3 text-slate-600">{traveler.email}</td>
                          <td className="px-4 py-3">
                            <RiskBadge level={level} alerts={participantAlerts.length} />
                          </td>
                          <td className="px-4 py-3 text-slate-700">{heartRate}</td>
                          <td className="px-4 py-3 text-slate-700">{spo2}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{participantAlerts.length}건</td>
                        </tr>
                      );
                    })}
                  </>
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                      {tripsLoading ? '여행 정보를 불러오는 중입니다.' : noGroupMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">경보 타임라인</h2>
              <p className="text-sm text-slate-500">최근 발생한 경보를 확인하고 대응을 기록하세요.</p>
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
              <AlertListItem key={alert.id} alert={alert} />
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function genderLabel(gender: TripParticipant['traveler']['gender']) {
  if (gender === 'M') return '남성';
  if (gender === 'F') return '여성';
  return '미확인';
}

function formatAlertTime(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function SummaryCard({
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

function RiskBadge({ level, alerts }: { level: RiskLevel; alerts: number }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${riskTone[level]}`}
    >
      {riskLabel[level]}
      {alerts > 0 && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700">{alerts}</span>}
    </span>
  );
}

function AlertListItem({ alert }: { alert: MonitoringAlert }) {
  const tone =
    alert.alert_type === 'health'
      ? 'border-rose-200 bg-rose-50 text-rose-600'
      : 'border-amber-200 bg-amber-50 text-amber-600';
  const icon = alert.alert_type === 'health' ? <HeartPulse className="h-4 w-4" /> : <MapPin className="h-4 w-4" />;
  return (
    <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-slate-700 shadow-sm">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800">{alert.traveler_name}</p>
          <p className="text-xs text-slate-600">{alert.message}</p>
          <p className="text-xs text-slate-400">{formatAlertTime(alert.snapshot_time)}</p>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-700">Trip #{alert.trip_id}</span>
    </div>
  );
}
