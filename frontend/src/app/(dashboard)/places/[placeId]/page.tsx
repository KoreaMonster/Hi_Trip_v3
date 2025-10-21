'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Clock4,
  Compass,
  Info,
  Loader2,
  MapPin,
  Navigation,
  NotebookPen,
  Phone,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { usePlaceDetailQuery, usePlaceCoordinatorsQuery } from '@/lib/queryHooks';
import type { Place, PlaceAlternativeInfo } from '@/types/api';

const parseAlternative = (
  info: Place['alternative_place_info'] | Place['ai_alternative_place'],
): PlaceAlternativeInfo | null => {
  if (!info) return null;
  if (typeof info === 'object') return info as PlaceAlternativeInfo;
  try {
    const parsed = JSON.parse(info);
    return typeof parsed === 'object' && parsed ? (parsed as PlaceAlternativeInfo) : null;
  } catch (error) {
    return null;
  }
};

const buildDescriptionLines = (text?: string | null) => {
  if (!text) return [] as string[];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length >= 4) return lines.slice(0, 8);
  return text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 8);
};

const formatDate = (value?: string | null) => {
  if (!value) return '미등록';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '미등록';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(parsed);
};

export default function PlaceDetailPage() {
  const params = useParams<{ placeId: string }>();
  const placeParam = params?.placeId;
  const placeId = placeParam ? Number(placeParam) : NaN;
  const resolvedPlaceId = Number.isNaN(placeId) ? undefined : placeId;

  const { data: place, isLoading, isError } = usePlaceDetailQuery(resolvedPlaceId);
  const { data: coordinators = [], isLoading: isCoordinatorsLoading } =
    usePlaceCoordinatorsQuery(resolvedPlaceId);

  if (!resolvedPlaceId) {
    return (
      <div className="space-y-6">
        <HeaderSection />
        <ErrorState message="유효한 장소 ID가 아닙니다." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <HeaderSection />
        <LoadingState message="장소 정보를 불러오는 중입니다." />
      </div>
    );
  }

  if (isError || !place) {
    return (
      <div className="space-y-6">
        <HeaderSection />
        <ErrorState message="장소 정보를 불러오지 못했습니다." />
      </div>
    );
  }

  const descriptionLines = buildDescriptionLines(place.ai_generated_info);
  const alternative = parseAlternative(place.alternative_place_info ?? place.ai_alternative_place);

  return (
    <div className="space-y-6">
      <HeaderSection placeName={place.name} />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1.3fr]">
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {place.image && (
            <div className="overflow-hidden rounded-2xl">
              <img
                src={place.image}
                alt={place.name}
                className="h-64 w-full object-cover"
              />
            </div>
          )}

          <SectionTitle
            icon={<Compass className="h-4 w-4 text-primary-500" />}
            title="일정 장소 정보"
            description="방문지 위치와 기본 운영 정보를 확인하세요."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="방문지명" value={place.name} />
            <InfoCard label="승객문(카테고리)" value={place.category?.name ?? '미분류'} />
            <InfoCard label="주소" value={place.address ?? '주소 정보 없음'} icon={<MapPin className="h-4 w-4 text-primary-500" />} />
            <InfoCard label="입장료" value={place.entrance_fee_display ?? '미등록'} icon={<NotebookPen className="h-4 w-4 text-primary-500" />} />
            <InfoCard label="활동 시간" value={place.activity_time_display ?? '미등록'} icon={<Clock4 className="h-4 w-4 text-primary-500" />} />
            <InfoCard label="집결지 상세주소" value={place.ai_meeting_point ?? '집결지 미정'} icon={<Building2 className="h-4 w-4 text-primary-500" />} />
          </div>

          <SectionTitle
            icon={<Sparkles className="h-4 w-4 text-primary-500" />}
            title="AI 자동 생성 정보"
            description="AI가 요약한 활동 하이라이트를 확인하세요."
          />

          <div className="space-y-3 rounded-2xl border border-slate-100 bg-[#F9FBFF] px-5 py-4">
            {descriptionLines.length > 0 ? (
              <ul className="space-y-2 text-sm text-slate-600">
                {descriptionLines.map((line, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-primary-400" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">AI 설명 정보가 아직 등록되지 않았습니다.</p>
            )}
          </div>

          <SectionTitle
            icon={<Navigation className="h-4 w-4 text-primary-500" />}
            title="AI 대체 장소 추천"
            description="이동 거리와 예상 시간을 함께 제공합니다."
          />

          {alternative ? (
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-[#E8F1FF] px-5 py-4 text-sm text-slate-700">
              <p className="text-base font-semibold text-slate-900">{alternative.place_name ?? '대체 장소'}</p>
              {alternative.reason && <p className="leading-relaxed">{alternative.reason}</p>}
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {alternative.distance_text && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-semibold text-slate-600">
                    <MapPin className="h-3 w-3" /> {alternative.distance_text}
                  </span>
                )}
                {typeof alternative.eta_minutes === 'number' && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-semibold text-slate-600">
                    <Clock4 className="h-3 w-3" /> 이동 {alternative.eta_minutes}분 예상
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
              아직 대체 장소 추천 데이터가 없습니다.
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">장소 요약</h2>
                <p className="text-xs text-slate-500">운영 정보와 최근 업데이트를 확인하세요.</p>
              </div>
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                {place.category?.name ?? '미분류'}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <SummaryItem icon={<MapPin className="h-4 w-4 text-primary-500" />} label="주소" value={place.address ?? '미등록'} />
              <SummaryItem icon={<Clock4 className="h-4 w-4 text-primary-500" />} label="활동 시간" value={place.activity_time_display ?? '미등록'} />
              <SummaryItem icon={<NotebookPen className="h-4 w-4 text-primary-500" />} label="입장료" value={place.entrance_fee_display ?? '미등록'} />
              <SummaryItem icon={<Info className="h-4 w-4 text-primary-500" />} label="최근 수정" value={formatDate(place.updated_at)} />
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary-500" />
              <h2 className="text-base font-semibold text-slate-900">집결지 메모</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {place.ai_meeting_point ?? '집결지가 아직 등록되지 않았습니다. 현장 담당자와 협의하여 입력해 주세요.'}
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary-500" />
              <h2 className="text-base font-semibold text-slate-900">담당자 정보</h2>
            </div>
            {isCoordinatorsLoading ? (
              <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-primary-500" /> 담당자 정보를 불러오는 중입니다.
              </div>
            ) : coordinators.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {coordinators.map((coordinator) => (
                  <li key={coordinator.id} className="rounded-2xl border border-slate-100 bg-[#F9FBFF] px-4 py-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">
                      {coordinator.name}{' '}
                      <span className="text-xs font-medium text-primary-600">
                        {coordinator.role?.name ?? '담당자'}
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="h-3.5 w-3.5 text-primary-400" /> {coordinator.phone}
                    </p>
                    {coordinator.note && (
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed">{coordinator.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">등록된 담당자 정보가 없습니다.</p>
            )}
          </article>
        </aside>
      </div>
    </div>
  );
}

function HeaderSection({ placeName }: { placeName?: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <nav className="text-xs text-slate-500">
          <span className="font-medium text-slate-400">여행 관리</span>
          <span className="mx-2 text-slate-300">/</span>
          <Link href="/schedules" className="text-slate-500 hover:text-primary-600">
            일정 관리
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <Link href="/places" className="text-slate-500 hover:text-primary-600">
            장소 라이브러리
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-primary-600">장소 상세 정보</span>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {placeName ? `${placeName} 장소 상세` : '장소 상세 정보'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          방문지 기본 정보와 AI 추천 데이터를 한눈에 확인하세요.
        </p>
      </div>
      <Link
        href="/places"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" /> 장소 목록으로
      </Link>
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-primary-500" /> {message}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-3xl border border-rose-200 bg-rose-50">
      <p className="text-sm font-semibold text-rose-600">{message}</p>
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50">{icon}</span>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-slate-600">
      <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-50">{icon}</span>
      <span>
        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="text-sm font-semibold text-slate-700">{value}</span>
      </span>
    </p>
  );
}
