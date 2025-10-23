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

type ParticipantDetailClientProps = {
  participantId: string;
  searchTripId?: string | string[] | null;
};

export default function ParticipantDetailClient({
  participantId,
  searchTripId,
}: ParticipantDetailClientProps) {
  const router = useRouter();
  const participantNumericId = Number(participantId);
  const tripId = Number(
    Array.isArray(searchTripId) ? searchTripId[0] : searchTripId ?? ''
  );
  const isTripIdValid = Number.isFinite(tripId);
  const isParticipantIdValid = Number.isFinite(participantNumericId);

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
    isParticipantIdValid ? participantNumericId : undefined,
    { limit: 120 },
    { enabled: isTripIdValid && isParticipantIdValid }
  );

  const chartData = useMemo(
    () =>
      history?.health.map((snapshot) => {
        const timestamp = new Date(snapshot.measured_at);
        return {
          measuredAt: snapshot.measured_at,
          label: timestamp.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          heartRate: snapshot.heart_rate,
          spo2: toNumber(snapshot.spo2) ?? 0,
        };
      }) ?? [],
    [history?.health]
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
            {error instanceof Error
              ? error.message
              : '모니터링 시계열 정보를 조회하는 중 문제가 발생했습니다.'}
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
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-500">
            최근 측정된 건강 지표가 없습니다. 웨어러블 장치 연결 상태를 확인해 주세요.
          </div>
        ) : (
          <div className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis
                  yAxisId="left"
                  stroke="#f97316"
                  orientation="left"
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  allowDecimals={false}
                  width={40}
                />
                <YAxis
                  yAxisId="right"
                  stroke="#2563eb"
                  orientation="right"
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  width={40}
                />
                <Tooltip
                  formatter={(value: number, name) => {
                    if (name === 'spo2') {
                      return [`${value}%`, '산소포화도'];
                    }
                    return [`${value} bpm`, '심박수'];
                  }}
                  labelFormatter={(label) => `측정 시간 ${label}`}
                />
                <Legend
                  formatter={(value) =>
                    value === 'heartRate' ? '심박수(bpm)' : '산소포화도(%)'
                  }
                />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                  yAxisId="left"
                />
                <Line
                  type="monotone"
                  dataKey="spo2"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                  yAxisId="right"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">최근 건강 상태</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary-100 p-2 text-primary-600">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">심박수</p>
                  <p className="text-xl font-semibold text-slate-900">
                    {latestHealth?.heart_rate ?? '—'} <span className="text-xs font-medium text-slate-500">bpm</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {latestHealth ? formatDateTime(latestHealth.measured_at) : '최근 측정 정보가 없습니다.'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                  <Droplet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">산소포화도</p>
                  <p className="text-xl font-semibold text-slate-900">
                    {latestSpo2 ?? '—'} <span className="text-xs font-medium text-slate-500">%</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {latestSpo2 !== null
                  ? formatDateTime(latestHealth?.measured_at ?? null)
                  : '최근 측정 정보가 없습니다.'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">마지막 위치</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {latestLocation?.address ?? '위치 정보 없음'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {latestLocation ? formatDateTime(latestLocation.measured_at) : '최근 위치 정보가 없습니다.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">신청자 정보</h2>
          <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs uppercase tracking-widest text-slate-500">참가자 이름</dt>
              <dd className="mt-2 text-base font-semibold text-slate-900">
                {history.traveler_name ?? '미등록'}
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs uppercase tracking-widest text-slate-500">연락처</dt>
              <dd className="mt-2 text-base font-semibold text-slate-900">
                {history.traveler_phone ?? '미등록'}
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs uppercase tracking-widest text-slate-500">장치 ID</dt>
              <dd className="mt-2 text-base font-semibold text-slate-900">
                {history.device_serial ?? '할당 필요'}
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs uppercase tracking-widest text-slate-500">비상 연락처</dt>
              <dd className="mt-2 text-base font-semibold text-slate-900">
                {history.emergency_contact ?? '미등록'}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}