'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock4, Compass, Filter, Loader2, MapPin, Navigation, Search, Sparkles, Stars } from 'lucide-react';
import {
  useAlternativeRecommendationsQuery,
  useCategoriesQuery,
  usePlaceSummaryCardQuery,
  usePlacesQuery,
} from '@/lib/queryHooks';
import type {
  AlternativePlaceRecommendationRequest,
  AlternativePlaceRecommendationResponse,
  Place,
  PlaceAlternativeInfo,
  PlaceSummaryCard,
  PlaceSummaryCardUpdate,
} from '@/types/api';

const parseAlternative = (
  info: Place['alternative_place_info'] | Place['ai_alternative_place'] | null | undefined,
): PlaceAlternativeInfo | null => {
  if (!info) return null;
  if (typeof info === 'string') {
    try {
      const parsed = JSON.parse(info);
      return typeof parsed === 'object' && parsed ? (parsed as PlaceAlternativeInfo) : null;
    } catch (error) {
      return null;
    }
  }
  if (typeof info === 'object') {
    return info as PlaceAlternativeInfo;
  }
  return null;
};

const buildDescriptionLines = (text?: string | null) => {
  if (!text) return [] as string[];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length >= 4) {
    return lines.slice(0, 6);
  }

  return text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);
};

const formatDurationFromSeconds = (seconds?: number | null): string | null => {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
    return null;
  }
  if (seconds === 0) {
    return '0분';
  }
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  if (hours > 0) {
    return `${hours}시간`;
  }
  if (minutes > 0) {
    return `${minutes}분`;
  }
  return null;
};

const formatDateLabel = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('ko', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const buildAlternativeRequestContext = (
  orderedPlaces: Place[],
  active: Place | null,
): {
  request: AlternativePlaceRecommendationRequest | null;
  reason?: string;
} => {
  if (!active) {
    return { request: null, reason: '추천을 확인하려면 먼저 장소를 선택해 주세요.' };
  }

  const activeIndex = orderedPlaces.findIndex((place) => place.id === active.id);
  if (activeIndex === -1) {
    return { request: null, reason: '선택한 장소를 목록에서 찾을 수 없습니다.' };
  }

  if (!active.google_place_id) {
    return { request: null, reason: '선택한 장소에 Google Place ID가 없어 대체 추천을 불러올 수 없습니다.' };
  }

  const placesWithIds = orderedPlaces.filter((place) => place.google_place_id);
  if (!placesWithIds.some((place) => place.id === active.id)) {
    return {
      request: null,
      reason: '선택한 장소의 Google Place ID가 등록되지 않아 대체 추천을 만들 수 없습니다.',
    };
  }

  const others = placesWithIds.filter((place) => place.id !== active.id);
  if (others.length < 2) {
    return {
      request: null,
      reason: 'Google Place ID가 등록된 다른 장소가 부족해 대체 추천을 계산할 수 없습니다.',
    };
  }

  const findNeighbor = (direction: 1 | -1): Place | null => {
    for (let offset = 1; offset <= orderedPlaces.length; offset += 1) {
      const index = (activeIndex + direction * offset + orderedPlaces.length) % orderedPlaces.length;
      const candidate = orderedPlaces[index];
      if (!candidate || candidate.id === active.id) continue;
      if (candidate.google_place_id) {
        return candidate;
      }
    }
    return null;
  };

  let previous = findNeighbor(-1);
  let next = findNeighbor(1);

  if (!previous || !next || previous.id === next.id) {
    previous = others[0] ?? null;
    next = others.find((place) => place.id !== previous?.id) ?? null;
  }

  if (!previous?.google_place_id || !next?.google_place_id || previous.id === next.id) {
    return { request: null, reason: '대체 추천을 계산할 인접 장소를 찾지 못했습니다.' };
  }

  return {
    request: {
      previous_place_id: previous.google_place_id,
      unavailable_place_id: active.google_place_id,
      next_place_id: next.google_place_id,
      travel_mode: 'DRIVE',
    },
  };
};

export default function PlacesPage() {
  const { data: places = [], isLoading } = usePlacesQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const [selectedCategory, setSelectedCategory] = useState<'all' | number>('all');
  const [keyword, setKeyword] = useState('');
  const [activePlaceId, setActivePlaceId] = useState<number | null>(null);

  const categoryOptions = useMemo(() => {
    const unique = new Map<number, string>();
    categories.forEach((category) => {
      unique.set(category.id, category.name);
    });

    places.forEach((place) => {
      if (place.category?.id && place.category?.name) {
        unique.set(place.category.id, place.category.name);
      }
    });

    return [
      { id: 'all' as const, label: '전체' },
      ...Array.from(unique.entries()).map(([id, label]) => ({ id, label })),
    ];
  }, [categories, places]);

  useEffect(() => {
    if (selectedCategory === 'all') return;
    const exists = categoryOptions.some((option) => option.id === selectedCategory);
    if (!exists) {
      setSelectedCategory('all');
    }
  }, [categoryOptions, selectedCategory]);

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return places.filter((place) => {
      const matchesCategory = selectedCategory === 'all' || place.category?.id === selectedCategory;
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        place.name.toLowerCase().includes(normalizedKeyword) ||
        (place.address ?? '').toLowerCase().includes(normalizedKeyword);
      return matchesCategory && matchesKeyword;
    });
  }, [places, selectedCategory, keyword]);

  useEffect(() => {
    if (filtered.length === 0) {
      setActivePlaceId(null);
      return;
    }
    setActivePlaceId((prev) => {
      if (prev && filtered.some((place) => place.id === prev)) {
        return prev;
      }
      return filtered[0]?.id ?? null;
    });
  }, [filtered]);

  const activePlace = useMemo(
    () => filtered.find((place) => place.id === activePlaceId) ?? null,
    [filtered, activePlaceId],
  );

  const summaryCardQuery = usePlaceSummaryCardQuery(activePlace?.id ?? undefined);
  const summaryCard = summaryCardQuery.data;
  const summaryCardLoading = summaryCardQuery.isLoading || summaryCardQuery.isFetching;

  const fallbackAlternative = useMemo(
    () =>
      activePlace
        ? parseAlternative(activePlace.alternative_place_info ?? activePlace.ai_alternative_place)
        : null,
    [activePlace],
  );

  const { request: alternativeRequest, reason: alternativeUnavailableReason } = useMemo(
    () => buildAlternativeRequestContext(filtered, activePlace),
    [filtered, activePlace],
  );

  const alternativeQuery = useAlternativeRecommendationsQuery(alternativeRequest);
  const alternativeData = alternativeQuery.data;
  const alternativeLoading = alternativeQuery.isLoading || alternativeQuery.isFetching;
  const alternativeError = alternativeQuery.error ? (alternativeQuery.error as Error) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">장소 라이브러리</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">추천 장소 & 담당자 메모</h1>
            <p className="mt-1 text-sm text-slate-500">여행 일정에 활용할 장소를 검색하고 대체 옵션을 준비하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
              <Search className="h-4 w-4 text-primary-500" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="장소명, 주소 검색"
                className="w-40 border-none bg-transparent placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600">
              <Filter className="h-4 w-4" /> 고급 필터
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {categoryOptions.map((category) => {
            const isActive = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-500 hover:border-primary-200 hover:text-primary-600'
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1.4fr] 2xl:grid-cols-[1.7fr_1.3fr]">
        <article className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
          {isLoading && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              장소 정보를 불러오는 중입니다.
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="col-span-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              조건에 맞는 장소가 없습니다.
            </div>
          )}
          {filtered.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              isActive={place.id === activePlaceId}
              onSelect={() => setActivePlaceId(place.id)}
            />
          ))}
        </article>

        <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <PlaceDetailsPanel
            place={activePlace}
            summaryCard={summaryCard}
            summaryCardLoading={summaryCardLoading}
            alternativeData={alternativeData}
            alternativeLoading={alternativeLoading}
            alternativeError={alternativeError}
            alternativeUnavailableReason={alternativeUnavailableReason}
            fallbackAlternative={fallbackAlternative}
          />

          <UpdatesPanel
            updates={summaryCard?.updates ?? []}
            isLoading={summaryCardLoading}
            generatedAt={summaryCard?.generated_at}
            createdBy={summaryCard?.created_by}
          />
        </aside>
      </section>
    </div>
  );
}

function PlaceCard({ place, isActive, onSelect }: { place: Place; isActive: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
        isActive ? 'border-primary-300 ring-2 ring-primary-200 ring-offset-2' : 'border-slate-200'
      }`}
    >
      {place.image ? (
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={place.image}
            alt={place.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center bg-[#E8F1FF] text-sm text-slate-500">이미지 없음</div>
      )}
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
            {place.category?.name ?? '미분류'}
          </span>
          <span className="text-xs text-slate-400">{place.activity_time_display ?? '시간 정보 없음'}</span>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{place.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{place.address ?? '주소 정보 없음'}</p>
        </div>
        {place.ai_generated_info && (
          <p className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-xs leading-relaxed text-slate-500">
            {place.ai_generated_info.length > 110
              ? `${place.ai_generated_info.slice(0, 110)}...`
              : place.ai_generated_info}
          </p>
        )}
        <p className="text-xs font-semibold text-primary-600">{place.ai_meeting_point ?? '집결지 미정'}</p>
      </div>
    </button>
  );
}

function PlaceDetailsPanel({
  place,
  summaryCard,
  summaryCardLoading,
  alternativeData,
  alternativeLoading,
  alternativeError,
  alternativeUnavailableReason,
  fallbackAlternative,
}: {
  place: Place | null;
  summaryCard?: PlaceSummaryCard;
  summaryCardLoading: boolean;
  alternativeData?: AlternativePlaceRecommendationResponse;
  alternativeLoading: boolean;
  alternativeError: Error | null;
  alternativeUnavailableReason?: string;
  fallbackAlternative: PlaceAlternativeInfo | null;
}) {
  if (!place) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        표시할 장소를 선택해 주세요.
      </div>
    );
  }

  const summaryLines = summaryCard?.generated_lines?.length
    ? summaryCard.generated_lines
    : buildDescriptionLines(place.ai_generated_info);
  const generatedAtLabel = formatDateLabel(summaryCard?.generated_at);
  const alternativeRecommendation = alternativeData?.alternatives?.[0] ?? null;
  const totalDurationText =
    alternativeRecommendation?.total_duration_text ??
    formatDurationFromSeconds(alternativeRecommendation?.total_duration_seconds);
  const baseDurationText =
    alternativeData?.base_route?.original_duration_text ??
    formatDurationFromSeconds(alternativeData?.base_route?.original_duration_seconds);
  const alternativeCategory = alternativeData?.searched_category;
  const alternativeMessage =
    alternativeUnavailableReason ??
    alternativeData?.detail ??
    (alternativeError ? alternativeError.message : null);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">일정 장소 정보</h2>
            <p className="text-xs text-slate-500">담당자와 공유할 기본 정보를 확인하세요.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
            <Compass className="h-3.5 w-3.5" /> {place.category?.name ?? '미분류'}
          </span>
        </header>

        <div className="grid gap-3 px-5 py-4 text-sm">
          <InfoRow label="장소명" value={place.name} />
          <InfoRow label="주소" value={place.address ?? '주소 정보 없음'} />
          <InfoRow label="입장료" value={place.entrance_fee_display ?? '미등록'} />
          <InfoRow label="권장 체류 시간" value={place.activity_time_display ?? '미등록'} />
          <InfoRow label="집결지" value={place.ai_meeting_point ?? '집결지 미정'} />
        </div>
      </section>

      <section className="rounded-2xl border border-primary-100 bg-[#F7F9FC] p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary-700">
          <Sparkles className="h-4 w-4" /> AI 인사이트
        </div>
        {(generatedAtLabel || summaryCard?.created_by) && (
          <p className="mt-1 text-[11px] text-slate-400">
            {generatedAtLabel ? `생성 ${generatedAtLabel}` : ''}
            {summaryCard?.created_by ? `${generatedAtLabel ? ' · ' : ''}${summaryCard.created_by}` : ''}
          </p>
        )}
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
          {summaryCardLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary-100 bg-white px-3 py-2 text-primary-600">
              <Loader2 className="h-3 w-3 animate-spin" /> 인사이트를 불러오는 중입니다.
            </div>
          )}
          {summaryLines.length > 0 ? (
            <ul className="space-y-2">
              {summaryLines.map((line, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-2 w-2 rounded-full bg-primary-400" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-primary-100 bg-white px-3 py-2 text-center text-xs text-slate-500">
              AI 설명 정보가 아직 입력되지 않았습니다.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">대체 장소 추천</h3>
            <p className="text-xs text-slate-500">
              {alternativeCategory
                ? `Google API 기반으로 '${alternativeCategory}' 카테고리를 분석했어요.`
                : 'Google API 기반 이동 시간 및 카테고리를 고려했습니다.'}
            </p>
          </div>
          <Navigation className="h-4 w-4 text-primary-500" />
        </div>
        {alternativeLoading ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin text-primary-500" /> 대체 장소를 불러오는 중입니다.
          </div>
        ) : alternativeRecommendation ? (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-[#E8F1FF] p-4 text-xs text-slate-700">
            <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
              <span>{alternativeRecommendation.place.name ?? '이름 미정'}</span>
              {alternativeCategory && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-primary-600 shadow-sm">
                  #{alternativeCategory}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              {totalDurationText && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">
                  <Navigation className="h-3 w-3" /> 총 이동 {totalDurationText}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">
                <Clock4 className="h-3 w-3" /> ΔETA {alternativeRecommendation.delta_text}
              </span>
              {alternativeRecommendation.place.rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">
                  <Stars className="h-3 w-3" /> 평점 {alternativeRecommendation.place.rating.toFixed(1)}
                </span>
              )}
              {typeof alternativeRecommendation.place.user_ratings_total === 'number' &&
                alternativeRecommendation.place.user_ratings_total > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">
                    리뷰 {alternativeRecommendation.place.user_ratings_total.toLocaleString()}건
                  </span>
                )}
            </div>
            {baseDurationText && (
              <p className="text-[11px] text-slate-500">기준 경로 대비 총 이동 {baseDurationText}</p>
            )}
          </div>
        ) : fallbackAlternative ? (
          <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-[#E8F1FF] p-4 text-xs text-slate-700">
            <p className="text-sm font-semibold text-slate-900">{fallbackAlternative.place_name ?? '이름 미정'}</p>
            {fallbackAlternative.reason && <p className="leading-relaxed">{fallbackAlternative.reason}</p>}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              {fallbackAlternative.distance_text && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">
                  <MapPin className="h-3 w-3" /> {fallbackAlternative.distance_text}
                </span>
              )}
              {typeof fallbackAlternative.eta_minutes === 'number' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">
                  <Clock4 className="h-3 w-3" /> 이동 {fallbackAlternative.eta_minutes}분 예상
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
            {alternativeMessage ?? '아직 대체 장소 추천 데이터가 없습니다.'}
          </p>
        )}
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3 text-xs text-slate-500 sm:grid-cols-[120px_1fr]">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

function UpdatesPanel({
  updates,
  isLoading,
  generatedAt,
  createdBy,
}: {
  updates: PlaceSummaryCardUpdate[];
  isLoading: boolean;
  generatedAt?: string | null;
  createdBy?: string | null;
}) {
  const generatedLabel = formatDateLabel(generatedAt);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 bg-[#F9FBFF] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Stars className="h-4 w-4 text-primary-500" /> 최신 운영 메모
        </div>
        {(generatedLabel || createdBy) && (
          <span className="text-[11px] font-medium text-slate-400">
            {generatedLabel ? `갱신 ${generatedLabel}` : ''}
            {createdBy ? `${generatedLabel ? ' · ' : ''}${createdBy}` : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-500" /> 메모를 불러오는 중입니다.
        </p>
      ) : updates.length > 0 ? (
        <ul className="space-y-3 text-xs text-slate-600">
          {updates.map((update) => {
            const published = formatDateLabel(update.published_at);
            return (
              <li key={update.id} className="rounded-xl border border-white bg-white px-3 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{update.title}</span>
                  {update.is_recent && (
                    <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-600">
                      최근
                    </span>
                  )}
                </div>
                <p className="mt-1 leading-relaxed text-slate-600">{update.description}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  {published && <span>{published}</span>}
                  <a
                    href={update.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                  >
                    <MapPin className="h-3 w-3" /> 출처 보기
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-primary-100 bg-white px-3 py-2 text-xs text-slate-500">
          등록된 운영 메모가 없습니다. 관리자에서 최신 소식을 생성하면 자동으로 표시됩니다.
        </p>
      )}

      <button className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-600 transition hover:bg-primary-100">
        <MapPin className="h-4 w-4" /> 장소 추천 요청
      </button>
    </div>
  );
}
