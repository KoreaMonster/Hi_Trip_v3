'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock4, Compass, Filter, Locate, MapPin, Navigation, Search, Sparkles, Stars } from 'lucide-react';
import { useCategoriesQuery, usePlacesQuery } from '@/lib/queryHooks';
import type { Place, PlaceAlternativeInfo } from '@/types/api';

const parseAlternative = (
  info: Place['alternative_place_info'] | Place['ai_alternative_place'],
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
    .split(/\r?\n/) // 우선 줄바꿈 기준 분리
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length >= 4) {
    return lines.slice(0, 6);
  }

  // 줄바꿈 기준이 아니라면 문장 단위로 재분리
  return text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);
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
      const matchesCategory =
        selectedCategory === 'all' || place.category?.id === selectedCategory;
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
          <PlaceDetailsPanel place={activePlace} />

          <div className="space-y-3 rounded-2xl border border-slate-100 bg-[#F9FBFF] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Stars className="h-4 w-4 text-primary-500" /> 담당자 메모
            </div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary-400" /> VIP 고객 방문 시 환영 배너를 미리 준비하세요.
              </li>
              <li className="flex items-start gap-2">
                <Clock4 className="mt-0.5 h-3.5 w-3.5 text-primary-400" /> 야외 이동 동선은 일몰 30분 전까지 점검이 필요합니다.
              </li>
              <li className="flex items-start gap-2">
                <Locate className="mt-0.5 h-3.5 w-3.5 text-primary-400" /> 비상 대체 장소 리스트를 최신으로 유지해 주세요.
              </li>
            </ul>
            <button className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-600 transition hover:bg-primary-100">
              <MapPin className="h-4 w-4" /> 장소 추천 요청
            </button>
          </div>
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

function PlaceDetailsPanel({ place }: { place: Place | null }) {
  if (!place) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        표시할 장소를 선택해 주세요.
      </div>
    );
  }

  const descriptionLines = buildDescriptionLines(place.ai_generated_info);
  const alternative = parseAlternative(place.alternative_place_info ?? place.ai_alternative_place);

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
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
          {descriptionLines.length > 0 ? (
            descriptionLines.map((line, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-2 w-2 rounded-full bg-primary-400" aria-hidden />
                <span>{line}</span>
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-dashed border-primary-100 bg-white px-3 py-2 text-center text-xs text-slate-500">
              AI 설명 정보가 아직 입력되지 않았습니다.
            </li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">대체 장소 추천</h3>
            <p className="text-xs text-slate-500">Google API 기반 이동 시간 및 카테고리를 고려했습니다.</p>
          </div>
          <Navigation className="h-4 w-4 text-primary-500" />
        </div>
        {alternative ? (
          <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-[#E8F1FF] p-4 text-xs text-slate-700">
            <p className="text-sm font-semibold text-slate-900">{alternative.place_name ?? '이름 미정'}</p>
            {alternative.reason && <p className="leading-relaxed">{alternative.reason}</p>}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              {alternative.distance_text && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">
                  <MapPin className="h-3 w-3" /> {alternative.distance_text}
                </span>
              )}
              {typeof alternative.eta_minutes === 'number' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">
                  <Clock4 className="h-3 w-3" /> 이동 {alternative.eta_minutes}분 예상
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
            아직 대체 장소 추천 데이터가 없습니다.
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
