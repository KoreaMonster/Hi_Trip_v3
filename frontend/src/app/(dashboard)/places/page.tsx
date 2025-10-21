'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock4, Filter, Locate, MapPin, Search, Stars } from 'lucide-react';
import { useCategoriesQuery, usePlacesQuery } from '@/lib/queryHooks';
import type { Place } from '@/types/api';

export default function PlacesPage() {
  const { data: places = [], isLoading } = usePlacesQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const [selectedCategory, setSelectedCategory] = useState<'all' | number>('all');
  const [keyword, setKeyword] = useState('');

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

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
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
            <PlaceCard key={place.id} place={place} />
          ))}
        </article>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">담당자 메모</h2>
          <p className="text-sm text-slate-500">현장 담당자와 공유할 참고 사항입니다.</p>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              <Stars className="mt-1 h-4 w-4 text-primary-500" />
              VIP 고객 방문 시 환영 배너 설치 필요.
            </li>
            <li className="flex items-start gap-3">
              <Clock4 className="mt-1 h-4 w-4 text-primary-500" />
              야외 장소는 일몰 전 30분까지 조명 세팅.
            </li>
            <li className="flex items-start gap-3">
              <Locate className="mt-1 h-4 w-4 text-primary-500" />
              비상 대체 장소 리스트를 항상 최신으로 유지하세요.
            </li>
          </ul>
          <button className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-600 transition hover:bg-primary-100">
            <MapPin className="h-4 w-4" /> 장소 추천 요청
          </button>
        </aside>
      </section>
    </div>
  );
}

function PlaceCard({ place }: { place: Place }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      {place.image ? (
        <div className="relative h-40 w-full overflow-hidden">
          <img src={place.image} alt={place.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center bg-[#E8F1FF] text-sm text-slate-500">이미지 없음</div>
      )}
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">{place.category?.name ?? '미분류'}</span>
          <span className="text-xs text-slate-400">{place.activity_time_display}</span>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{place.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{place.address ?? '주소 정보 없음'}</p>
        </div>
        {place.ai_generated_info && (
          <p className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-xs text-slate-500">{place.ai_generated_info}</p>
        )}
        <p className="text-xs font-semibold text-primary-600">{place.ai_meeting_point ?? '집결지 미정'}</p>
      </div>
    </article>
  );
}
