'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPlace } from '@/lib/api';
import { useCategoriesQuery, usePlacesQuery } from '@/lib/queryHooks';
import type { PlaceCreate } from '@/types/api';

const emptyPlaceForm: PlaceCreate = {
  name: '',
  address: '',
  category_id: null,
  entrance_fee: null,
  activity_time: '',
  ai_generated_info: '',
  ai_meeting_point: '',
};

export default function PlacesPage() {
  const { data: places = [], isLoading } = usePlacesQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [form, setForm] = useState<PlaceCreate>({ ...emptyPlaceForm });
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: PlaceCreate) => createPlace(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places'] });
      setForm({ ...emptyPlaceForm });
      setFormError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '장소 생성 중 오류가 발생했습니다.';
      setFormError(message);
    },
  });

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return places.filter((place) => {
      const matchesCategory =
        categoryFilter === 'all' || place.category?.id === categoryFilter;
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        place.name.toLowerCase().includes(normalizedKeyword) ||
        (place.address ?? '').toLowerCase().includes(normalizedKeyword);
      return matchesCategory && matchesKeyword;
    });
  }, [categoryFilter, keyword, places]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError('장소 이름을 입력해 주세요.');
      return;
    }
    const payload: PlaceCreate = {
      name: form.name.trim(),
    };
    if (form.address?.trim()) payload.address = form.address.trim();
    if (typeof form.category_id === 'number') payload.category_id = form.category_id;
    if (typeof form.entrance_fee === 'number') payload.entrance_fee = form.entrance_fee;
    if (form.activity_time?.trim()) payload.activity_time = form.activity_time.trim();
    if (form.ai_generated_info?.trim()) payload.ai_generated_info = form.ai_generated_info.trim();
    if (form.ai_meeting_point?.trim()) payload.ai_meeting_point = form.ai_meeting_point.trim();

    setFormError(null);
    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">장소 목록</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <input
            type="text"
            className="rounded border px-3 py-2"
            placeholder="장소 이름 또는 주소 검색"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select
            className="rounded border px-3 py-2"
            value={categoryFilter === 'all' ? '' : categoryFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                setCategoryFilter('all');
                return;
              }
              const parsed = Number(value);
              setCategoryFilter(Number.isNaN(parsed) ? 'all' : parsed);
            }}
          >
            <option value="">전체 카테고리</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">장소를 불러오는 중입니다.</p>
        ) : null}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">조건에 맞는 장소가 없습니다.</p>
        ) : (
          <ul className="grid gap-3">
            {filtered.map((place) => (
              <li key={place.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{place.name}</p>
                    <p className="text-sm text-muted-foreground">{place.address || '주소 미등록'}</p>
                  </div>
                  <Link
                    href={`/app/(dashboard)/places/${place.id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    상세 보기
                  </Link>
                </div>
                {place.category?.name ? (
                  <p className="text-xs text-muted-foreground">카테고리: {place.category.name}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">새 장소 등록</h2>
        <form className="grid gap-3 max-w-xl" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">장소 이름</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">주소</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={form.address ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">카테고리</span>
            <select
              className="rounded border px-3 py-2"
              value={form.category_id ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  setForm((prev) => ({ ...prev, category_id: null }));
                  return;
                }
                const parsed = Number(value);
                setForm((prev) => ({ ...prev, category_id: Number.isNaN(parsed) ? null : parsed }));
              }}
            >
              <option value="">선택 안 함</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">입장료 (원)</span>
            <input
              type="number"
              className="rounded border px-3 py-2"
              value={form.entrance_fee ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  setForm((prev) => ({ ...prev, entrance_fee: null }));
                  return;
                }
                const parsed = Number(value);
                setForm((prev) => ({ ...prev, entrance_fee: Number.isNaN(parsed) ? null : parsed }));
              }}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">예상 소요 시간</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={form.activity_time ?? ''}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, activity_time: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">AI 안내 문장</span>
            <textarea
              className="rounded border px-3 py-2"
              value={form.ai_generated_info ?? ''}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, ai_generated_info: event.target.value }))
              }
              rows={3}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">AI 추천 만남 장소</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={form.ai_meeting_point ?? ''}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, ai_meeting_point: event.target.value }))
              }
            />
          </label>
          <button
            type="submit"
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? '등록 중...' : '장소 추가'}
          </button>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </form>
      </section>
    </div>
  );
}
