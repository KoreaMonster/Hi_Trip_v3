'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  calculateOptionalExpenseTotal,
  createOptionalExpense,
  createPlaceCoordinator,
  deleteOptionalExpense,
  deletePlace,
  deletePlaceCoordinator,
  refreshPlaceSummaryCard,
  updateOptionalExpense,
  updatePlace,
  updatePlaceCoordinator,
} from '@/lib/api';
import {
  useCategoriesQuery,
  useCoordinatorRolesQuery,
  useOptionalExpensesQuery,
  usePlaceCoordinatorsQuery,
  usePlaceDetailQuery,
  usePlaceSummaryCardQuery,
} from '@/lib/queryHooks';
import type {
  OptionalExpenseCreate,
  OptionalExpenseSelection,
  OptionalExpenseTotal,
  OptionalExpenseUpdate,
  PlaceCoordinatorCreate,
  PlaceCoordinatorUpdate,
  PlaceSummaryCard,
  PlaceUpdate,
} from '@/types/api';

const emptyPlaceForm = {
  name: '',
  address: '',
  category_id: '',
  entrance_fee: '',
  activity_time: '',
  ai_generated_info: '',
  ai_meeting_point: '',
};

const emptyExpenseForm = {
  item_name: '',
  price: '',
  description: '',
  display_order: '',
};

const emptyCoordinatorForm = {
  name: '',
  phone: '',
  role_id: '',
  note: '',
};

export default function PlaceDetailPage() {
  const params = useParams<{ placeId: string }>();
  const router = useRouter();
  const placeId = Number(params?.placeId ?? NaN);
  const resolvedPlaceId = Number.isNaN(placeId) ? undefined : placeId;
  const queryClient = useQueryClient();

  const { data: place, isLoading: placeLoading, isError } = usePlaceDetailQuery(resolvedPlaceId);
  const { data: summaryCard } = usePlaceSummaryCardQuery(resolvedPlaceId);
  const { data: expenses = [] } = useOptionalExpensesQuery(resolvedPlaceId);
  const { data: coordinators = [] } = usePlaceCoordinatorsQuery(resolvedPlaceId);
  const { data: roles = [] } = useCoordinatorRolesQuery();
  const { data: categories = [] } = useCategoriesQuery();

  const [placeForm, setPlaceForm] = useState({ ...emptyPlaceForm });
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({ ...emptyExpenseForm });
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([]);
  const [expenseTotal, setExpenseTotal] = useState<OptionalExpenseTotal | null>(null);
  const [coordinatorForm, setCoordinatorForm] = useState({ ...emptyCoordinatorForm });
  const [coordinatorError, setCoordinatorError] = useState<string | null>(null);
  const [editingCoordinatorId, setEditingCoordinatorId] = useState<number | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!place) return;
    setPlaceForm({
      name: place.name,
      address: place.address ?? '',
      category_id: place.category?.id ? String(place.category.id) : '',
      entrance_fee: place.entrance_fee != null ? String(place.entrance_fee) : '',
      activity_time: place.activity_time ?? '',
      ai_generated_info: place.ai_generated_info ?? '',
      ai_meeting_point: place.ai_meeting_point ?? '',
    });
  }, [place]);

  useEffect(() => {
    setSelectedExpenseIds((prev) => prev.filter((id) => expenses.some((expense) => expense.id === id)));
  }, [expenses]);

  const updatePlaceMutation = useMutation({
    mutationFn: (payload: { placeId: number; data: PlaceUpdate }) =>
      updatePlace(payload.placeId, payload.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places', resolvedPlaceId, 'detail'] });
      setPlaceError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '장소 정보를 수정하지 못했습니다.';
      setPlaceError(message);
    },
  });

  const deletePlaceMutation = useMutation({
    mutationFn: (targetId: number) => deletePlace(targetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places'] });
      router.push('/app/(dashboard)/places');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '장소 삭제 중 오류가 발생했습니다.';
      setDeleteError(message);
    },
  });

  const refreshSummaryMutation = useMutation({
    mutationFn: (targetId: number) => refreshPlaceSummaryCard(targetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places', resolvedPlaceId, 'summary-card'] });
      setSummaryError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '요약 카드를 갱신하지 못했습니다.';
      setSummaryError(message);
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: ({ placeId: targetId, data }: { placeId: number; data: OptionalExpenseCreate }) =>
      createOptionalExpense(targetId, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places', resolvedPlaceId, 'expenses'] });
      setExpenseForm({ ...emptyExpenseForm });
      setEditingExpenseId(null);
      setExpenseError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '선택 지출 저장에 실패했습니다.';
      setExpenseError(message);
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({
      placeId: targetId,
      expenseId,
      data,
    }: {
      placeId: number;
      expenseId: number;
      data: OptionalExpenseUpdate;
    }) => updateOptionalExpense(targetId, expenseId, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places', resolvedPlaceId, 'expenses'] });
      setExpenseForm({ ...emptyExpenseForm });
      setEditingExpenseId(null);
      setExpenseError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '선택 지출 수정에 실패했습니다.';
      setExpenseError(message);
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: ({ placeId: targetId, expenseId }: { placeId: number; expenseId: number }) =>
      deleteOptionalExpense(targetId, expenseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places', resolvedPlaceId, 'expenses'] });
    },
  });

  const calculateTotalMutation = useMutation({
    mutationFn: ({ placeId: targetId, selection }: { placeId: number; selection: OptionalExpenseSelection }) =>
      calculateOptionalExpenseTotal(targetId, selection),
    onSuccess: (total) => {
      setExpenseTotal(total);
      setExpenseError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '합계를 계산하지 못했습니다.';
      setExpenseError(message);
    },
  });

  const createCoordinatorMutation = useMutation({
    mutationFn: ({ placeId: targetId, data }: { placeId: number; data: PlaceCoordinatorCreate }) =>
      createPlaceCoordinator(targetId, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places', resolvedPlaceId, 'coordinators'] });
      setCoordinatorForm({ ...emptyCoordinatorForm });
      setEditingCoordinatorId(null);
      setCoordinatorError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '담당자 저장에 실패했습니다.';
      setCoordinatorError(message);
    },
  });

  const updateCoordinatorMutation = useMutation({
    mutationFn: ({
      placeId: targetId,
      coordinatorId,
      data,
    }: {
      placeId: number;
      coordinatorId: number;
      data: PlaceCoordinatorUpdate;
    }) => updatePlaceCoordinator(targetId, coordinatorId, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places', resolvedPlaceId, 'coordinators'] });
      setCoordinatorForm({ ...emptyCoordinatorForm });
      setEditingCoordinatorId(null);
      setCoordinatorError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '담당자 수정에 실패했습니다.';
      setCoordinatorError(message);
    },
  });

  const deleteCoordinatorMutation = useMutation({
    mutationFn: ({ placeId: targetId, coordinatorId }: { placeId: number; coordinatorId: number }) =>
      deletePlaceCoordinator(targetId, coordinatorId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['places', resolvedPlaceId, 'coordinators'] });
    },
  });

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.item_name.localeCompare(b.item_name);
    });
  }, [expenses]);

  const categoryName = useMemo(() => {
    if (!place?.category?.id) return '카테고리 미지정';
    return place.category.name ?? '카테고리 미지정';
  }, [place]);

  const handlePlaceSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedPlaceId) return;
    if (!placeForm.name.trim()) {
      setPlaceError('장소 이름을 입력해 주세요.');
      return;
    }
    const payload: PlaceUpdate = {
      name: placeForm.name.trim(),
    };
    if (placeForm.address.trim()) payload.address = placeForm.address.trim();
    if (placeForm.category_id) {
      const parsed = Number(placeForm.category_id);
      if (!Number.isNaN(parsed)) {
        payload.category_id = parsed;
      }
    } else {
      payload.category_id = null;
    }
    if (placeForm.entrance_fee.trim()) {
      const fee = Number(placeForm.entrance_fee);
      if (!Number.isNaN(fee)) {
        payload.entrance_fee = fee;
      }
    } else {
      payload.entrance_fee = null;
    }
    if (placeForm.activity_time.trim()) payload.activity_time = placeForm.activity_time.trim();
    if (placeForm.ai_generated_info.trim()) payload.ai_generated_info = placeForm.ai_generated_info.trim();
    if (placeForm.ai_meeting_point.trim()) payload.ai_meeting_point = placeForm.ai_meeting_point.trim();

    updatePlaceMutation.mutate({ placeId: resolvedPlaceId, data: payload });
  };

  const handleExpenseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedPlaceId) return;
    if (!expenseForm.item_name.trim()) {
      setExpenseError('항목 이름을 입력해 주세요.');
      return;
    }
    if (!expenseForm.price.trim()) {
      setExpenseError('금액을 입력해 주세요.');
      return;
    }
    const price = Number(expenseForm.price);
    if (Number.isNaN(price)) {
      setExpenseError('금액은 숫자로 입력해 주세요.');
      return;
    }
    const payload: OptionalExpenseCreate = {
      item_name: expenseForm.item_name.trim(),
      price,
    };
    if (expenseForm.description.trim()) payload.description = expenseForm.description.trim();
    if (expenseForm.display_order.trim()) {
      const order = Number(expenseForm.display_order);
      if (!Number.isNaN(order)) payload.display_order = order;
    }

    if (editingExpenseId) {
      updateExpenseMutation.mutate({ placeId: resolvedPlaceId, expenseId: editingExpenseId, data: payload });
    } else {
      createExpenseMutation.mutate({ placeId: resolvedPlaceId, data: payload });
    }
  };

  const handleCoordinatorSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedPlaceId) return;
    if (!coordinatorForm.name.trim()) {
      setCoordinatorError('담당자 이름을 입력해 주세요.');
      return;
    }
    if (!coordinatorForm.phone.trim()) {
      setCoordinatorError('연락처를 입력해 주세요.');
      return;
    }
    if (!coordinatorForm.role_id) {
      setCoordinatorError('역할을 선택해 주세요.');
      return;
    }
    const createPayload: PlaceCoordinatorCreate = {
      name: coordinatorForm.name.trim(),
      phone: coordinatorForm.phone.trim(),
      role_id: Number(coordinatorForm.role_id),
    };
    if (coordinatorForm.note.trim()) createPayload.note = coordinatorForm.note.trim();

    if (editingCoordinatorId) {
      const updatePayload: PlaceCoordinatorUpdate = { ...createPayload };
      updateCoordinatorMutation.mutate({
        placeId: resolvedPlaceId,
        coordinatorId: editingCoordinatorId,
        data: updatePayload,
      });
    } else {
      createCoordinatorMutation.mutate({ placeId: resolvedPlaceId, data: createPayload });
    }
  };

  if (!resolvedPlaceId) {
    return <p className="text-sm text-destructive">유효한 장소 ID가 아닙니다.</p>;
  }

  if (placeLoading) {
    return <p className="text-sm text-muted-foreground">장소 정보를 불러오는 중입니다.</p>;
  }

  if (isError || !place) {
    return <p className="text-sm text-destructive">장소 정보를 불러오지 못했습니다.</p>;
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{place.name}</h1>
            <p className="text-sm text-muted-foreground">{place.address || '주소 미등록'}</p>
          </div>
          <Link href="/app/(dashboard)/places" className="text-primary hover:underline text-sm">
            목록으로
          </Link>
        </div>
        <dl className="grid gap-1 text-sm text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">카테고리</dt>
            <dd>{categoryName}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">입장료</dt>
            <dd>{place.entrance_fee != null ? `${place.entrance_fee.toLocaleString()}원` : '미등록'}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">예상 소요 시간</dt>
            <dd>{place.activity_time || '미등록'}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">AI 만남 장소</dt>
            <dd>{place.ai_meeting_point || '미등록'}</dd>
          </div>
        </dl>
        <form className="grid gap-3 max-w-2xl" onSubmit={handlePlaceSubmit}>
          <h2 className="text-xl font-semibold">장소 정보 수정</h2>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">장소 이름</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={placeForm.name}
              onChange={(event) => setPlaceForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">주소</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={placeForm.address}
              onChange={(event) => setPlaceForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">카테고리</span>
            <select
              className="rounded border px-3 py-2"
              value={placeForm.category_id}
              onChange={(event) => setPlaceForm((prev) => ({ ...prev, category_id: event.target.value }))}
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
              value={placeForm.entrance_fee}
              onChange={(event) => setPlaceForm((prev) => ({ ...prev, entrance_fee: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">예상 소요 시간</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={placeForm.activity_time}
              onChange={(event) => setPlaceForm((prev) => ({ ...prev, activity_time: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">AI 안내 문장</span>
            <textarea
              className="rounded border px-3 py-2"
              value={placeForm.ai_generated_info}
              onChange={(event) =>
                setPlaceForm((prev) => ({ ...prev, ai_generated_info: event.target.value }))
              }
              rows={3}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">AI 추천 만남 장소</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={placeForm.ai_meeting_point}
              onChange={(event) =>
                setPlaceForm((prev) => ({ ...prev, ai_meeting_point: event.target.value }))
              }
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              disabled={updatePlaceMutation.isPending}
            >
              {updatePlaceMutation.isPending ? '저장 중...' : '정보 저장'}
            </button>
            <button
              type="button"
              className="rounded border border-destructive px-4 py-2 text-sm text-destructive"
              onClick={() => deletePlaceMutation.mutate(place.id)}
              disabled={deletePlaceMutation.isPending}
            >
              {deletePlaceMutation.isPending ? '삭제 중...' : '장소 삭제'}
            </button>
          </div>
          {placeError ? <p className="text-sm text-destructive">{placeError}</p> : null}
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">AI 요약 카드</h2>
        {summaryCard ? <SummaryCard card={summaryCard} /> : <p className="text-sm">요약 정보가 없습니다.</p>}
        <button
          type="button"
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => refreshSummaryMutation.mutate(place.id)}
          disabled={refreshSummaryMutation.isPending}
        >
          {refreshSummaryMutation.isPending ? '재생성 중...' : '요약 재생성'}
        </button>
        {summaryError ? <p className="text-sm text-destructive">{summaryError}</p> : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">선택 지출</h2>
        <form className="grid gap-3 max-w-xl" onSubmit={handleExpenseSubmit}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">항목 이름</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={expenseForm.item_name}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, item_name: event.target.value }))
              }
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">금액 (원)</span>
            <input
              type="number"
              className="rounded border px-3 py-2"
              value={expenseForm.price}
              onChange={(event) => setExpenseForm((prev) => ({ ...prev, price: event.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">정렬 순서 (선택)</span>
            <input
              type="number"
              className="rounded border px-3 py-2"
              value={expenseForm.display_order}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, display_order: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">설명</span>
            <textarea
              className="rounded border px-3 py-2"
              value={expenseForm.description}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={2}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}
            >
              {editingExpenseId
                ? updateExpenseMutation.isPending
                  ? '수정 중...'
                  : '선택 지출 수정'
                : createExpenseMutation.isPending
                ? '추가 중...'
                : '선택 지출 추가'}
            </button>
            {editingExpenseId ? (
              <button
                type="button"
                className="rounded border px-4 py-2 text-sm"
                onClick={() => {
                  setEditingExpenseId(null);
                  setExpenseForm({ ...emptyExpenseForm });
                  setExpenseError(null);
                }}
              >
                취소
              </button>
            ) : null}
          </div>
          {expenseError ? <p className="text-sm text-destructive">{expenseError}</p> : null}
        </form>
        <div className="space-y-2">
          <h3 className="text-lg font-medium">등록된 항목</h3>
          {sortedExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 선택 지출이 없습니다.</p>
          ) : (
            <ul className="grid gap-3">
              {sortedExpenses.map((expense) => (
                <li key={expense.id} className="rounded border p-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{expense.item_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {expense.price.toLocaleString()}원
                        {expense.display_order != null ? ` · 순서 ${expense.display_order}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button
                        type="button"
                        className="rounded border px-3 py-1"
                        onClick={() => {
                          setEditingExpenseId(expense.id);
                          setExpenseForm({
                            item_name: expense.item_name,
                            price: String(expense.price),
                            description: expense.description ?? '',
                            display_order: expense.display_order != null ? String(expense.display_order) : '',
                          });
                        }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded border border-destructive px-3 py-1 text-destructive"
                        onClick={() => deleteExpenseMutation.mutate({ placeId: place.id, expenseId: expense.id })}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedExpenseIds.includes(expense.id)}
                      onChange={(event) => {
                        setSelectedExpenseIds((prev) => {
                          if (event.target.checked) {
                            return [...prev, expense.id];
                          }
                          return prev.filter((id) => id !== expense.id);
                        });
                      }}
                    />
                    합계 계산에 포함
                  </label>
                  {expense.description ? (
                    <p className="text-sm text-muted-foreground">{expense.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() =>
            calculateTotalMutation.mutate({
              placeId: place.id,
              selection: { expense_ids: selectedExpenseIds },
            })
          }
          disabled={calculateTotalMutation.isPending || selectedExpenseIds.length === 0}
        >
          {calculateTotalMutation.isPending ? '계산 중...' : '선택 항목 합계 계산'}
        </button>
        {expenseTotal ? (
          <div className="rounded border p-3 text-sm">
            <p className="font-medium">총 {expenseTotal.count}건 · {expenseTotal.formatted_total}</p>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">장소 담당자</h2>
        <form className="grid gap-3 max-w-xl" onSubmit={handleCoordinatorSubmit}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">이름</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={coordinatorForm.name}
              onChange={(event) =>
                setCoordinatorForm((prev) => ({ ...prev, name: event.target.value }))
              }
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">연락처</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={coordinatorForm.phone}
              onChange={(event) =>
                setCoordinatorForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">역할</span>
            <select
              className="rounded border px-3 py-2"
              value={coordinatorForm.role_id}
              onChange={(event) =>
                setCoordinatorForm((prev) => ({ ...prev, role_id: event.target.value }))
              }
              required
            >
              <option value="">역할 선택</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">메모</span>
            <textarea
              className="rounded border px-3 py-2"
              value={coordinatorForm.note}
              onChange={(event) =>
                setCoordinatorForm((prev) => ({ ...prev, note: event.target.value }))
              }
              rows={2}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              disabled={createCoordinatorMutation.isPending || updateCoordinatorMutation.isPending}
            >
              {editingCoordinatorId
                ? updateCoordinatorMutation.isPending
                  ? '수정 중...'
                  : '담당자 수정'
                : createCoordinatorMutation.isPending
                ? '등록 중...'
                : '담당자 추가'}
            </button>
            {editingCoordinatorId ? (
              <button
                type="button"
                className="rounded border px-4 py-2 text-sm"
                onClick={() => {
                  setEditingCoordinatorId(null);
                  setCoordinatorForm({ ...emptyCoordinatorForm });
                  setCoordinatorError(null);
                }}
              >
                취소
              </button>
            ) : null}
          </div>
          {coordinatorError ? <p className="text-sm text-destructive">{coordinatorError}</p> : null}
        </form>
        <div className="space-y-2">
          <h3 className="text-lg font-medium">등록된 담당자</h3>
          {coordinators.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 담당자가 없습니다.</p>
          ) : (
            <ul className="grid gap-3">
              {coordinators.map((coordinator) => (
                <li key={coordinator.id} className="rounded border p-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{coordinator.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {coordinator.phone} · {coordinator.role?.name || '역할 미지정'}
                      </p>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button
                        type="button"
                        className="rounded border px-3 py-1"
                        onClick={() => {
                          setEditingCoordinatorId(coordinator.id);
                          setCoordinatorForm({
                            name: coordinator.name,
                            phone: coordinator.phone,
                            role_id: coordinator.role?.id ? String(coordinator.role.id) : '',
                            note: coordinator.note ?? '',
                          });
                        }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded border border-destructive px-3 py-1 text-destructive"
                        onClick={() =>
                          deleteCoordinatorMutation.mutate({
                            placeId: place.id,
                            coordinatorId: coordinator.id,
                          })
                        }
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  {coordinator.note ? (
                    <p className="text-sm text-muted-foreground">{coordinator.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ card }: { card: PlaceSummaryCard }) {
  if (!card.generated_lines || card.generated_lines.length === 0) {
    return <p className="text-sm text-muted-foreground">생성된 요약이 없습니다.</p>;
  }
  return (
    <div className="rounded border p-3 space-y-2 text-sm">
      <ul className="list-disc pl-5 space-y-1">
        {card.generated_lines.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
      {card.sources.length > 0 ? (
        <div>
          <p className="font-medium">참고 자료</p>
          <ul className="list-disc pl-5 space-y-1">
            {card.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
