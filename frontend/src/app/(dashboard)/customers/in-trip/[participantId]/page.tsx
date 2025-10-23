'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Droplet,
  HeartPulse,
  MapPin,
  RefreshCcw,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMonitoringParticipantHistoryQuery, useTripDetailQuery } from '@/lib/queryHooks';

const formatDateTime = (value?: string | null) => {
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
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

type InTripParticipantPageProps = {
  params: { participantId: string };
  searchParams?: { tripId?: string | string[] } | null;
};

export default function InTripParticipantDetailPage({ params, searchParams }: InTripParticipantPageProps) {
  const router = useRouter();
  const participantId = Number(params.participantId);
  const rawTripId = searchParams?.tripId;
  const tripId = Number(Array.isArray(rawTripId) ? rawTripId[0] : rawTripId ?? '');
  const isTripIdValid = Number.isFinite(tripId);
  const isParticipantIdValid = Number.isFinite(participantId);

  const { data: tripDetail } = useTripDetailQuery(isTripIdValid ? tripId : undefined, {
    enabled: isTripIdValid,
  });

  const {
    data: history,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useMonitoringParticipantHistoryQuery(
    isTripIdValid ? tripId : undefined,
    isParticipantIdValid ? participantId : undefined,
    { limit: 120 },
    { enabled: isTripIdValid && isParticipantIdValid },
  );

  const chartData = useMemo(
    () =>
      history?.health.map((snapshot) => {
        const timestamp = new Date(snapshot.measured_at);
        return {
          measuredAt: snapshot.measured_at,
          label: timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          heartRate: snapshot.heart_rate,
          spo2: toNumber(snapshot.spo2) ?? 0,
        };
      }) ?? [],
    [history?.health],
  );

  const latestHealth = history?.health.at(-1) ?? null;
  const latestLocation = history?.location.at(-1) ?? null;
  const latestSpo2 = latestHealth ? toNumber(latestHealth.spo2) : null;

  const handleBack = () => {
    if (isTripIdValid) {
      router.push(`/customers/in-trip?tripId=${tripId}`);
    } else {
      router.push('/customers/in-trip');
    }
  };

  if (!isTripIdValid || !isParticipantIdValid) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 text-slate-700">
          <h1 className="text-xl font-semibold text-rose-600">여행 정보가 필요합니다</h1>
          <p className="mt-3 text-sm text-slate-600">참가자 ID와 여행 ID가 모두 포함된 링크로 접속해 주세요.</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-600 shadow-sm transition hover:bg-primary-100"
          >
            <ArrowLeft className="h-4 w-4" /> 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
          참가자 모니터링 데이터를 불러오는 중입니다.
        </div>
      </div>
    );
  }

  if (isError || !history) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 text-slate-700">
          <h1 className="text-xl font-semibold text-rose-600">데이터를 불러오지 못했습니다</h1>
          <p className="mt-3 text-sm text-slate-600">
            {error instanceof Error ? error.message : '모니터링 시계열 정보를 조회하는 중 문제가 발생했습니다.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <RefreshCcw className="h-4 w-4" /> 다시 시도
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
            >
              <ArrowLeft className="h-4 w-4" /> 목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">신청자 시계열</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{history.traveler_name}</h1>
            <p className="mt-1 text-sm text-slate-500">심박수와 산소포화도 흐름을 확인하여 실시간 이상 징후를 파악하세요.</p>
            <p className="mt-2 text-xs text-slate-500">마지막 업데이트 {formatDateTime(history.last_updated)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
            >
              <ArrowLeft className="h-4 w-4" /> 신청자 목록
            </button>
            <Link
              href={tripDetail ? `/trips/${tripDetail.id}` : '/trips'}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <MapPin className="h-4 w-4" /> 여행 상세 보기
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">건강 지표 추이</h2>
            <p className="text-sm text-slate-500">심박수(bpm)와 산소포화도(%)를 동일 시간 축으로 비교합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
            disabled={isFetching}
          >
            <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin text-primary-500' : ''}`} /> 데이터 새로고침
          </button>
        </div>
        {chartData.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            아직 누적된 측정 데이터가 없습니다. 상단의 데이터 생성 기능을 사용해 흐름을 시작해 보세요.
          </div>
        ) : (
          <div className="mt-6 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 32, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="heartRate" stroke="#ef4444" tick={{ fontSize: 12 }} domain={[40, 'dataMax + 15']} />
                <YAxis yAxisId="spo2" orientation="right" stroke="#0ea5e9" tick={{ fontSize: 12 }} domain={[85, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)' }}
                  formatter={(value: number, name: string) => {
                    if (name === '심박수 (bpm)') {
                      return [`${value} bpm`, name];
                    }
                    return [`${value.toFixed(2)}%`, name];
                  }}
                  labelFormatter={(label) => `${label}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  yAxisId="heartRate"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  name="심박수 (bpm)"
                />
                <Line
                  type="monotone"
                  dataKey="spo2"
                  yAxisId="spo2"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  name="산소포화도 (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">최근 측정 요약</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-[#F9FBFF] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">심박수</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <HeartPulse className="h-5 w-5 text-rose-500" />
                {latestHealth ? `${latestHealth.heart_rate} bpm` : '데이터 없음'}
              </p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(latestHealth?.measured_at)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-[#ECFDF5] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">산소포화도</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Droplet className="h-5 w-5 text-sky-500" />
                {latestHealth && latestSpo2 !== null ? `${latestSpo2.toFixed(2)}%` : '데이터 없음'}
              </p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(latestHealth?.measured_at)}</p>
            </div>
          </div>
        </article>

        <aside className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">위치 정보</h2>
          {latestLocation ? (
            <div className="rounded-2xl border border-slate-100 bg-[#FFF7ED] p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-800">최근 좌표</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(latestLocation.measured_at)}</p>
              <p className="mt-2 text-sm">
                위도 {Number(latestLocation.latitude).toFixed(5)}, 경도 {Number(latestLocation.longitude).toFixed(5)}
              </p>
              {latestLocation.accuracy_m && (
                <p className="mt-1 text-xs text-slate-500">정확도 ±{Number(latestLocation.accuracy_m).toFixed(1)}m</p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              위치 데이터가 아직 수집되지 않았습니다.
            </div>
          )}
          {tripDetail && (
            <div className="rounded-2xl border border-slate-100 bg-[#E8F1FF] p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">담당 여행</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{tripDetail.title}</p>
              <p className="mt-1 text-xs text-slate-500">{tripDetail.destination}</p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
