'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCcw, TimerReset } from 'lucide-react';
import { postMonitoringGenerateDemo } from '@/lib/api';
import { useMonitoringLatestQuery, useTripsQuery } from '@/lib/queryHooks';
import type { MonitoringDemoResponse, ParticipantLatest, Trip } from '@/types/api';

const REFRESH_INTERVAL_MS = 3000;

const statusLabel: Record<string, string> = {
  normal: '정상',
  warning: '주의',
  danger: '위험',
  unknown: '수집 대기',
};

const statusTone: Record<string, string> = {
  normal: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-600 border border-amber-200',
  danger: 'bg-rose-50 text-rose-600 border border-rose-200',
  unknown: 'bg-slate-100 text-slate-500 border border-slate-200',
};

const resolveStatus = (item: ParticipantLatest) => {
  const raw = item.health?.status?.toLowerCase();
  if (!raw) return 'unknown';
  if (raw.includes('danger') || raw.includes('critical') || raw.includes('위험')) return 'danger';
  if (raw.includes('warning') || raw.includes('주의')) return 'warning';
  if (raw.includes('normal') || raw.includes('정상')) return 'normal';
  return (raw as keyof typeof statusLabel) in statusLabel ? (raw as keyof typeof statusLabel) : 'unknown';
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

const toNumber = (value?: string | null): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const findLastUpdated = (items: ParticipantLatest[]) => {
  const latest = items
    .map((item) => item.health?.measured_at ?? item.location?.measured_at ?? null)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return latest.at(0) ?? null;
};

export default function InTripCustomersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading: tripsLoading } = useTripsQuery();
  const ongoingTrips = useMemo(() => trips.filter((trip) => trip.status === 'ongoing'), [trips]);

  const queryTripId = useMemo(() => {
    const value = searchParams?.get('tripId');
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const [selectedTripId, setSelectedTripId] = useState<number | null>(queryTripId);

  useEffect(() => {
    if (selectedTripId !== null && ongoingTrips.some((trip) => trip.id === selectedTripId)) {
      return;
    }
    if (queryTripId !== null && ongoingTrips.some((trip) => trip.id === queryTripId)) {
      setSelectedTripId(queryTripId);
      return;
    }
    setSelectedTripId(ongoingTrips[0]?.id ?? null);
  }, [ongoingTrips, queryTripId, selectedTripId]);

  useEffect(() => {
    if (!pathname) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (selectedTripId === null) {
      if (!params.has('tripId')) return;
      params.delete('tripId');
    } else {
      const nextValue = String(selectedTripId);
      if (params.get('tripId') === nextValue) return;
      params.set('tripId', nextValue);
    }
    const query = params.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams, selectedTripId]);

  const selectedTrip = useMemo<Trip | undefined>(
    () => ongoingTrips.find((trip) => trip.id === (selectedTripId ?? -1)),
    [ongoingTrips, selectedTripId],
  );

  const {
    data: latest = [],
    isLoading: latestLoading,
    isFetching: latestFetching,
    isError: latestError,
    error: latestErrorObject,
    refetch: refetchLatest,
  } = useMonitoringLatestQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
    refetchInterval: selectedTripId !== null ? REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (selectedTripId === null) return;
    void refetchLatest();
  }, [refetchLatest, selectedTripId]);

  const generateMutation = useMutation({
    mutationFn: (tripId: number): Promise<MonitoringDemoResponse> =>
      postMonitoringGenerateDemo(tripId, { minutes: 5, interval: 30 }),
    onSuccess: (_, tripId) => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'latest', tripId] });
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'history', tripId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'alerts', tripId] });
    },
  });

  const sortedLatest = useMemo(() => {
    return [...latest].sort((a, b) => {
      const timeA = new Date(a.health?.measured_at ?? a.location?.measured_at ?? 0).getTime();
      const timeB = new Date(b.health?.measured_at ?? b.location?.measured_at ?? 0).getTime();
      return timeB - timeA;
    });
  }, [latest]);

  const lastUpdated = useMemo(() => findLastUpdated(latest), [latest]);
  const errorMessage = latestError
    ? latestErrorObject instanceof Error
      ? latestErrorObject.message
      : '모니터링 데이터를 불러오는 중 문제가 발생했습니다.'
    : null;

  const handleGenerate = () => {
    if (selectedTripId === null || generateMutation.isPending) return;
    generateMutation.mutate(selectedTripId);
  };

  const handleRowClick = (participantId: number) => {
    if (selectedTripId === null) return;
    router.push(`/customers/in-trip/${participantId}?tripId=${selectedTripId}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">신청자 실시간 모니터링</h1>
            <p className="text-sm text-slate-500">
              백엔드가 생성하는 건강 데이터를 {REFRESH_INTERVAL_MS / 1000}초 간격으로 불러와 최신 상태를 보여줍니다.
            </p>
            {selectedTrip && (
              <p className="text-xs text-slate-500">
                선택한 여행: <span className="font-semibold text-slate-700">{selectedTrip.title}</span> · {selectedTrip.destination}
              </p>
            )}
            {lastUpdated && (
              <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                <TimerReset className="h-3.5 w-3.5" /> 마지막 측정 {formatMeasuredAt(lastUpdated)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedTripId ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedTripId(value ? Number(value) : null);
              }}
              disabled={ongoingTrips.length === 0}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus:border-primary-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ongoingTrips.length === 0 && <option value="">진행 중인 여행이 없습니다</option>}
              {ongoingTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (selectedTripId === null) return;
                void refetchLatest();
              }}
              disabled={selectedTripId === null || latestLoading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${latestFetching ? 'animate-spin text-primary-500' : ''}`} /> 새로고침
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={selectedTripId === null || generateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generateMutation.isPending ? '생성 중...' : '데이터 생성'}
            </button>
          </div>
        </div>
        {generateMutation.isSuccess && (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            더미 데이터 생성을 시작했습니다. 잠시 후 참가자 목록이 자동으로 갱신됩니다.
          </p>
        )}
        {generateMutation.isError && (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            데이터를 생성하지 못했습니다. 다시 시도해 주세요.
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">신청자 현황</h2>
            <p className="text-sm text-slate-500">백엔드에서 받은 최신 측정값을 실시간으로 표시합니다.</p>
          </div>
          <span className="text-xs font-semibold text-primary-600">
            {selectedTripId !== null ? `${REFRESH_INTERVAL_MS / 1000}초마다 자동 새로고침` : '여행을 선택해 주세요'}
          </span>
        </div>
        {errorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            <AlertTriangle className="mr-2 inline h-4 w-4" /> {errorMessage}
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500">
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
              {!latestLoading && sortedLatest.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    아직 수집된 데이터가 없습니다. 상단의 데이터 생성 버튼을 눌러 시뮬레이션을 시작해 주세요.
                  </td>
                </tr>
              )}
              {sortedLatest.map((item) => {
                const statusKey = resolveStatus(item);
                const heartRate = item.health?.heart_rate;
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
                    <td className="px-5 py-4 text-slate-600">{spo2 !== null ? `${spo2.toFixed(2)}%` : '—'}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusTone[statusKey]}`}>
                        {statusLabel[statusKey]}
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
          진행 중인 여행이 없어 표시할 모니터링 데이터가 없습니다.
        </div>
      )}
    </div>
  );
}
