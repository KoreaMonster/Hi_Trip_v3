'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Clock4,
  Compass,
  MapPin,
  Navigation,
  NotebookPen,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { usePlaceDetailQuery, useTripDetailQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { PlaceAlternativeInfo } from '@/types/api';

const formatDateTime = (value?: string | null) => {
  if (!value) return '미등록';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '미등록';
  }
  return parsed.toLocaleString('ko-KR');
};

const formatDate = (value?: string | null) => {
  if (!value) return '미등록';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '미등록';
  }
  return parsed.toLocaleDateString('ko-KR');
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) return '미등록';
  return `${value.toLocaleString()}원`;
};

const buildDescriptionLines = (text?: string | null) => {
  if (!text) return [] as string[];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length >= 4) {
    return lines.slice(0, 8);
  }
  return text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 8);
};

const parseAlternative = (
  info: unknown,
): PlaceAlternativeInfo | null => {
  if (!info) return null;
  if (typeof info === 'string') {
    try {
      const parsed = JSON.parse(info) as PlaceAlternativeInfo;
      return typeof parsed === 'object' && parsed ? parsed : null;
    } catch (error) {
      return null;
    }
  }
  if (typeof info === 'object') {
    return info as PlaceAlternativeInfo;
  }
  return null;
};

type PageProps = {
  params: { placeId: string };
};

export default function PlaceDetailPage({ params }: PageProps) {
  const placeId = Number(params.placeId);
  const searchParams = useSearchParams();
  const tripIdParam = searchParams.get('tripId');
  const contextTripId = tripIdParam ? Number(tripIdParam) : undefined;

  const { data: place, isLoading, isError } = usePlaceDetailQuery(
    Number.isFinite(placeId) ? placeId : undefined,
  );
  const { data: tripDetail, isLoading: tripLoading } = useTripDetailQuery(
    typeof contextTripId === 'number' && Number.isFinite(contextTripId) ? contextTripId : undefined,
  );
  const { isSuperAdmin } = useScopedTrips();

  const alternative = useMemo(() => {
    if (!place) return null;
    return (
      parseAlternative(place.alternative_place_info) ?? parseAlternative(place.ai_alternative_place)
    );
  }, [place]);

  const descriptionLines = useMemo(() => buildDescriptionLines(place?.ai_generated_info), [place]);

  if (!Number.isFinite(placeId)) {
    return (
      <div className="space-y-4">
        <HeaderSkeleton />
        <ErrorCallout message="잘못된 장소 ID입니다." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <HeaderSkeleton />
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError || !place) {
    return (
      <div className="space-y-4">
        <HeaderSkeleton />
        <ErrorCallout message="장소 정보를 불러오지 못했습니다." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <nav className="text-xs font-semibold text-slate-400" aria-label="Breadcrumb">
              <ol className="flex items-center gap-2">
                <li className="hover:text-slate-600">
                  <Link href="/places" className="transition hover:text-primary-600">
                    여행 중 여행 추천
                  </Link>
                </li>
                <li aria-hidden className="text-slate-300">
                  /
                </li>
                <li className="text-slate-600">장소 상세 정보</li>
              </ol>
            </nav>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{place.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{place.address ?? '주소 정보가 등록되지 않았습니다.'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 font-semibold text-primary-600">
                <Compass className="h-3.5 w-3.5" /> {place.category?.name ?? '미분류'}
              </span>
              {place.activity_time_display && (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                  <Clock4 className="h-3.5 w-3.5" /> {place.activity_time_display}
                </span>
              )}
              {tripDetail && (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-600">
                  <Navigation className="h-3.5 w-3.5" /> {tripDetail.title} 일정 연계
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/places"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> 목록으로
            </Link>
            {place.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-600 shadow-sm transition hover:border-primary-300 hover:text-primary-700"
              >
                <MapPin className="h-4 w-4" /> 지도 열기
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <Card
            title="장소 상세 정보"
            description="일정에 공유할 기본 정보를 확인하세요."
            icon={<Building2 className="h-4 w-4 text-primary-500" />}
          >
            <div className="grid gap-3 text-sm">
              <DetailRow label="장소명" value={place.name} />
              <DetailRow label="주소" value={place.address ?? '주소 미등록'} />
              <DetailRow label="카테고리" value={place.category?.name ?? '미분류'} />
              <DetailRow
                label="입장료"
                value={place.entrance_fee_display ?? formatCurrency(place.entrance_fee)}
              />
              <DetailRow label="권장 체류 시간" value={place.activity_time_display ?? '미등록'} />
              <DetailRow label="AI 집결지 추천" value={place.ai_meeting_point ?? '집결지 미정'} />
              <DetailRow label="등록일시" value={formatDateTime(place.created_at)} />
              <DetailRow label="최근 업데이트" value={formatDateTime(place.updated_at)} />
            </div>
          </Card>

          <Card
            title="활동 세부 정보"
            description="AI가 제공한 인사이트와 전달 사항을 요약합니다."
            icon={<Sparkles className="h-4 w-4 text-primary-500" />}
          >
            {descriptionLines.length > 0 ? (
              <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
                {descriptionLines.map((line, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-2 w-2 rounded-full bg-primary-400" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                AI 설명 정보가 아직 등록되지 않았습니다.
              </p>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card
            title="AI 대체 장소 추천"
            description="기상 악화나 예약 불가 시 활용할 대안을 제공합니다."
            icon={<Navigation className="h-4 w-4 text-primary-500" />}
          >
            {alternative ? (
              <div className="space-y-3 text-sm">
                <DetailRow label="추천 장소" value={alternative.place_name ?? '이름 미정'} compact />
                {alternative.reason && <DetailRow label="추천 사유" value={alternative.reason} compact />}
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  {alternative.distance_text && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 font-semibold text-primary-600">
                      <MapPin className="h-3.5 w-3.5" /> {alternative.distance_text}
                    </span>
                  )}
                  {typeof alternative.eta_minutes === 'number' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-600">
                      <Clock4 className="h-3.5 w-3.5" /> 이동 {alternative.eta_minutes}분 예상
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">대체 장소 추천 정보가 아직 등록되지 않았습니다.</p>
            )}
          </Card>

          <Card
            title="담당자 정보"
            description="장소 운영 협의를 담당하는 직원을 확인합니다."
            icon={<UserRound className="h-4 w-4 text-primary-500" />}
          >
            {tripLoading ? (
              <p className="text-sm text-slate-500">여행 정보를 불러오는 중입니다.</p>
            ) : tripDetail ? (
              <div className="space-y-3 text-sm">
                <DetailRow label="여행명" value={tripDetail.title} compact />
                <DetailRow label="목적지" value={tripDetail.destination} compact />
                <DetailRow label="담당자" value={tripDetail.manager_name ?? '배정 대기'} compact />
                <DetailRow
                  label="여행 기간"
                  value={`${formatDate(tripDetail.start_date)} ~ ${formatDate(tripDetail.end_date)}`}
                  compact
                />
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  담당자 연락처는 직원 디렉터리에서 확인하거나 총괄 관리자에게 요청하세요.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {isSuperAdmin
                  ? '선택된 여행 맥락이 없어 담당자 정보를 표시할 수 없습니다.'
                  : '담당된 여행 범위 내 정보만 확인할 수 있습니다.'}
              </p>
            )}
          </Card>

          <Card
            title="현장 메모"
            description="현장 운영 시 공유할 메모를 기록하세요."
            icon={<NotebookPen className="h-4 w-4 text-primary-500" />}
          >
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
              체크인 위치, 이동 동선, 비상 연락처 등 현장 운영 팁을 기록해 팀과 공유하세요.
            </p>
          </Card>
        </aside>
      </section>
    </div>
  );
}

function DetailRow({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div
      className={`grid gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3 text-xs text-slate-500 ${
        compact ? 'sm:grid-cols-[110px_1fr]' : 'sm:grid-cols-[140px_1fr]'
      }`}
    >
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

function Card({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function HeaderSkeleton() {
  return <div className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white" />;
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

function ErrorCallout({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">{message}</div>
  );
}
