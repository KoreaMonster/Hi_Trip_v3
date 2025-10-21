'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivitySquare,
  AlertTriangle,
  ChevronDown,
  Clock3,
  Droplet,
  PlayCircle,
  RefreshCcw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { postMonitoringGenerateDemo } from '@/lib/api';
import { useHealthQuery, useMonitoringLatestQuery, useTripsQuery } from '@/lib/queryHooks';
import type { MonitoringDemoResponse, ParticipantLatest, Trip } from '@/types/api';

const statusMeta: Record<string, { label: string; tone: string }> = {
  normal: {
    label: '정상',
    tone: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  },
  danger: {
    label: '위험',
    tone: 'bg-rose-50 text-rose-600 border border-rose-200',
  },
  warning: {
    label: '주의',
    tone: 'bg-amber-50 text-amber-600 border border-amber-200',
  },
  unknown: {
    label: '수집 대기',
    tone: 'bg-slate-100 text-slate-500 border border-slate-200',
  },
};

const formatMeasuredAt = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const resolveStatusTone = (snapshot: ParticipantLatest): { label: string; tone: string } => {
  const statusKey = snapshot.health?.status ?? 'unknown';
  return statusMeta[statusKey] ?? statusMeta.unknown;
};

const toNumber = (value?: string | null): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const findLastUpdated = (snapshots: ParticipantLatest[]): string | null => {
  const times = snapshots
    .map((item) => item.health?.measured_at ?? item.location?.measured_at ?? null)
    .filter((value): value is string => Boolean(value));

  if (times.length === 0) {
    return null;
  }

  return times.reduce((latest, current) => {
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  });
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatRange = (start?: string | null, end?: string | null) => {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  if (startLabel === '—' && endLabel === '—') {
    return '일정 정보 없음';
  }
  if (startLabel === '—' || endLabel === '—') {
    return `${startLabel} ~ ${endLabel}`;
  }
  return `${startLabel} ~ ${endLabel}`;
};

const normalizeStatus = (snapshot: ParticipantLatest): 'danger' | 'warning' | 'normal' | 'unknown' => {
  const status = snapshot.health?.status?.toLowerCase();
  if (!status) {
    return 'unknown';
  }
  if (status.includes('danger') || status.includes('critical') || status.includes('위험')) {
    return 'danger';
  }
  if (status.includes('warning') || status.includes('caution') || status.includes('주의')) {
    return 'warning';
  }
  if (status.includes('normal') || status.includes('정상')) {
    return 'normal';
  }
  return statusMeta[status]?.label === statusMeta.danger.label
    ? 'danger'
    : statusMeta[status]?.label === statusMeta.warning.label
      ? 'warning'
      : statusMeta[status]?.label === statusMeta.normal.label
        ? 'normal'
        : 'unknown';
};

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);

export default function InTripCustomersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = useMemo(() => searchParams?.toString() ?? '', [searchParams]);
  const queryClient = useQueryClient();
  const { data: trips = [], isLoading: tripsLoading } = useTripsQuery();
  const ongoingTrips = useMemo(
    () => trips.filter((trip) => trip.status === 'ongoing'),
    [trips],
  );
  const initialTripIdFromQuery = useMemo(() => {
    if (!searchParams) return null;
    const value = searchParams.get('tripId');
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }, [searchParams]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(initialTripIdFromQuery);

  useEffect(() => {
    if (ongoingTrips.length === 0) {
      if (selectedTripId !== null) {
        setSelectedTripId(null);
      }
      return;
    }

    const hasSelectedTrip = selectedTripId !== null && ongoingTrips.some((trip) => trip.id === selectedTripId);
    if (hasSelectedTrip) {
      return;
    }

    const queryTripIsAvailable =
      initialTripIdFromQuery !== null && ongoingTrips.some((trip) => trip.id === initialTripIdFromQuery);

    if (queryTripIsAvailable) {
      setSelectedTripId(initialTripIdFromQuery);
      return;
    }

    setSelectedTripId(ongoingTrips[0].id);
  }, [initialTripIdFromQuery, ongoingTrips, selectedTripId]);

  useEffect(() => {
    if (!pathname) return;

    const params = new URLSearchParams(searchParamsString);

    if (selectedTripId !== null) {
      const next = String(selectedTripId);
      if (params.get('tripId') === next) {
        return;
      }
      params.set('tripId', next);
    } else {
      if (!params.has('tripId')) {
        return;
      }
      params.delete('tripId');
    }

    const query = params.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParamsString, selectedTripId]);

  const selectedTrip = useMemo<Trip | undefined>(
    () => ongoingTrips.find((trip) => trip.id === (selectedTripId ?? -1)),
    [ongoingTrips, selectedTripId],
  );

  const {
    data: health,
    isLoading: healthLoading,
    isError: healthIsError,
    error: healthError,
  } = useHealthQuery();

  const {
    data: latest = [],
    isLoading: latestLoading,
    isFetching: latestFetching,
    isError: latestIsError,
    error: latestError,
    refetch: refetchLatest,
  } = useMonitoringLatestQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
    refetchInterval: 1000 * 5,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const generateMutation = useMutation({
    mutationFn: (): Promise<MonitoringDemoResponse> =>
      postMonitoringGenerateDemo(selectedTripId!, { minutes: 5, interval: 30 }),
    onSuccess: (payload) => {
      void queryClient.invalidateQueries({ queryKey: ['monitoring', 'alerts', selectedTripId] });
      void queryClient.invalidateQueries({ queryKey: ['monitoring', 'latest', selectedTripId] });
      void queryClient.invalidateQueries({ queryKey: ['monitoring', 'history', selectedTripId], exact: false });
      void refetchLatest();
      return payload;
    },
  });

  const lastUpdated = useMemo(() => findLastUpdated(latest), [latest]);
  const latestErrorMessage = latestIsError
    ? latestError instanceof Error
      ? latestError.message
      : '모니터링 데이터를 불러오지 못했습니다.'
    : null;

  const monitoringSummary = useMemo(() => {
    const totalParticipants = selectedTrip?.participant_count ?? latest.length;
    let normal = 0;
    let warning = 0;
    let danger = 0;
    let unknown = 0;
    let active = 0;

    latest.forEach((item) => {
      const category = normalizeStatus(item);
      if (item.health) {
        active += 1;
      }
      if (category === 'danger') {
        danger += 1;
      } else if (category === 'warning') {
        warning += 1;
      } else if (category === 'normal') {
        normal += 1;
      } else {
        unknown += 1;
      }
    });

    const offline = Math.max(0, totalParticipants - active);

    return {
      total: totalParticipants,
      normal,
      warning,
      danger,
      unknown,
      active,
      offline,
    };
  }, [latest, selectedTrip?.participant_count]);

  const backendStatusLabel = healthLoading
    ? '상태 확인 중'
    : healthIsError
      ? '연결 실패'
      : health?.status === 'ok'
        ? '정상'
        : '점검 필요';

  const backendStatusDescription = healthLoading
    ? '모니터링 API 상태를 확인하고 있습니다.'
    : healthIsError
      ? healthError instanceof Error
        ? healthError.message
        : '백엔드 상태 확인에 실패했습니다.'
      : health?.message ?? '모니터링 API 응답을 수신했습니다.';

  const backendIconTone = healthLoading
    ? 'text-slate-400'
    : healthIsError || health?.status !== 'ok'
      ? 'text-rose-500'
      : 'text-emerald-500';

  const backendLabelTone = healthLoading
    ? 'text-slate-900'
    : healthIsError || health?.status !== 'ok'
      ? 'text-rose-600'
      : 'text-emerald-600';

  const handleGenerateClick = () => {
    if (selectedTripId === null || generateMutation.isPending) {
      return;
    }
    generateMutation.mutate();
  };

  const handleRowClick = (participantId: number) => {
    if (selectedTripId === null) return;
    router.push(`/customers/in-trip/${participantId}?tripId=${selectedTripId}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">여행 중 고객 관리</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">실시간 신청자 현황</h1>
            <p className="mt-1 text-sm text-slate-500">
              모니터링 API로 유입되는 건강 데이터를 5초마다 새로고침하여 최신 고객 상태를 확인하세요.
            </p>
            {selectedTrip && (
              <p className="mt-1 text-xs text-slate-500">
                선택한 여행: <span className="font-semibold text-slate-700">{selectedTrip.title}</span> · {selectedTrip.destination}
              </p>
            )}
            {lastUpdated && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                <Clock3 className="h-3.5 w-3.5" /> 마지막 업데이트 {formatMeasuredAt(lastUpdated)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={selectedTripId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedTripId(value ? Number(value) : null);
                }}
                disabled={ongoingTrips.length === 0}
                className="appearance-none rounded-full border border-slate-200 bg-white px-4 py-2 pr-10 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus:border-primary-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {ongoingTrips.length === 0 && <option value="">진행 중인 여행이 없습니다</option>}
                {ongoingTrips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={() => refetchLatest()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
              disabled={latestLoading || selectedTripId === null}
            >
              <RefreshCcw className={`h-4 w-4 ${latestFetching ? 'animate-spin text-primary-500' : ''}`} /> 수동 새로고침
            </button>
            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={selectedTripId === null || generateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <PlayCircle className={generateMutation.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              데이터 생성
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-[#F5FAFF] p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">백엔드 상태</p>
            <div className={`mt-2 flex items-center gap-2 text-lg font-semibold ${backendLabelTone}`}>
              <ShieldCheck className={`h-5 w-5 ${backendIconTone}`} />
              {backendStatusLabel}
            </div>
            <p className="mt-2 text-xs text-slate-500">{backendStatusDescription}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-[#F9FBFF] p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">실시간 수집 인원</p>
            <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Users className="h-5 w-5 text-primary-500" />
              {formatNumber(monitoringSummary.active)}명
            </div>
            <p className="mt-2 text-xs text-slate-500">
              총 {formatNumber(monitoringSummary.total)}명 중 {formatNumber(monitoringSummary.offline)}명 대기 중
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-[#FFF7ED] p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">이상 징후 감지</p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-rose-600">{formatNumber(monitoringSummary.danger)} 위험</span>
              <span className="text-lg font-semibold text-amber-600">{formatNumber(monitoringSummary.warning)} 주의</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">정상 {formatNumber(monitoringSummary.normal)}명 · 수집 대기 {formatNumber(monitoringSummary.unknown)}명</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-[#ECFDF5] p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">마지막 수집 시각</p>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Clock3 className="h-5 w-5 text-emerald-500" />
              {lastUpdated ? formatMeasuredAt(lastUpdated) : '데이터 수집 대기 중'}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {latestFetching ? '실시간 동기화 중입니다.' : '5초 간격으로 자동 새로고침됩니다.'}
            </p>
          </div>
        </div>
        {generateMutation.isSuccess && generateMutation.data && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            더미 데이터 {generateMutation.data.created}건을 생성했습니다. (참가자 {generateMutation.data.participants}명 · {generateMutation.data.minutes}
            분 · {generateMutation.data.interval}초 간격)
          </div>
        )}
        {generateMutation.isError && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            데이터를 생성하지 못했습니다. 다시 시도해 주세요.
          </div>
        )}
        {ongoingTrips.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-[#F7F9FC] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">구분</th>
                  <th className="px-4 py-3 text-left font-semibold">여행명</th>
                  <th className="px-4 py-3 text-left font-semibold">여행 일정</th>
                  <th className="px-4 py-3 text-left font-semibold">참가자 수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {ongoingTrips.map((trip, index) => {
                  const isActive = trip.id === selectedTripId;
                  return (
                    <tr
                      key={trip.id}
                      onClick={() => setSelectedTripId(trip.id)}
                      className={`cursor-pointer transition ${
                        isActive ? 'bg-primary-50/60' : 'hover:bg-primary-50/40'
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-600">{index + 1}</td>
                      <td className="px-4 py-3 text-slate-800">{trip.title}</td>
                      <td className="px-4 py-3 text-slate-500">{formatRange(trip.start_date, trip.end_date)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {typeof trip.participant_count === 'number'
                          ? `${formatNumber(trip.participant_count)}명`
                          : '집계 중'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !tripsLoading && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              진행 중인 여행이 없습니다. 여행을 ‘진행 중’으로 설정하면 자동으로 목록이 채워집니다.
            </div>
          )
        )}
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">신청자 현황 리스트</h2>
            <p className="text-sm text-slate-500">참가자를 클릭하면 시계열 상세 화면으로 이동합니다.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
            <ActivitySquare className="h-3.5 w-3.5" /> 실시간 갱신 중 (5초 간격)
          </span>
        </div>
        {latestErrorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            <AlertTriangle className="mr-2 inline h-4 w-4" /> {latestErrorMessage}
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-[#F7F9FC] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">이름</th>
                <th className="px-5 py-3 text-left font-semibold">심박수</th>
                <th className="px-5 py-3 text-left font-semibold">산소포화도</th>
                <th className="px-5 py-3 text-left font-semibold">상태</th>
                <th className="px-5 py-3 text-left font-semibold">측정 시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {latestLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    실시간 데이터를 불러오는 중입니다.
                  </td>
                </tr>
              )}
              {!latestLoading && latest.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    아직 수집된 신청자 데이터가 없습니다. 상단의 데이터 생성 버튼을 눌러 흐름을 시작하세요.
                  </td>
                </tr>
              )}
              {latest.map((item) => {
                const tone = resolveStatusTone(item);
                const heartRate = item.health?.heart_rate ?? '—';
                const spo2 = toNumber(item.health?.spo2);
                const measuredAt = item.health?.measured_at ?? item.location?.measured_at ?? null;
                return (
                  <tr
                    key={item.participant_id}
                    className="cursor-pointer transition hover:bg-primary-50/40"
                    onClick={() => handleRowClick(item.participant_id)}
                  >
                    <td className="px-5 py-4 font-semibold text-slate-800">{item.traveler_name}</td>
                    <td className="px-5 py-4 text-slate-600">{typeof heartRate === 'number' ? `${heartRate} bpm` : '—'}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <Droplet className="h-4 w-4 text-sky-500" /> {spo2 !== null ? `${spo2.toFixed(2)}%` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${tone.tone}`}>
                        {tone.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{formatMeasuredAt(measuredAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {ongoingTrips.length === 0 && !tripsLoading && (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
          진행 중인 여행이 없어 모니터링 데이터를 표시할 수 없습니다. 여행 상태를 ‘진행 중’으로 업데이트한 후 다시 확인하세요.
        </div>
      )}
    </div>
  );
}
