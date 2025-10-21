'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignTripManager, createTrip, deleteTrip, updateTrip } from '@/lib/api';
import { useStaffDirectoryQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { Trip, TripCreate, TripUpdate } from '@/types/api';

const emptyTripForm: TripCreate = {
  title: '',
  destination: '',
  start_date: '',
  end_date: '',
};

const statusLabel: Record<Trip['status'], string> = {
  planning: '계획 중',
  ongoing: '진행 중',
  completed: '완료',
};

export default function TripsPage() {
  const { data: scopedTrips = [], rawTrips, isLoading, isSuperAdmin } = useScopedTrips();
  const queryClient = useQueryClient();
  const [createForm, setCreateForm] = useState<TripCreate>({ ...emptyTripForm });
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TripCreate>({ ...emptyTripForm });
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const { data: staff = [] } = useStaffDirectoryQuery(
    { is_approved: true },
    { enabled: isSuperAdmin },
  );

  const createTripMutation = useMutation({
    mutationFn: (payload: TripCreate) => createTrip(payload),
    onSuccess: async () => {
      setCreateForm({ ...emptyTripForm });
      setCreateError(null);
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '여행 생성 중 오류가 발생했습니다.';
      setCreateError(message);
    },
  });

  const updateTripMutation = useMutation({
    mutationFn: ({ tripId, payload }: { tripId: number; payload: TripUpdate }) =>
      updateTrip(tripId, payload),
    onSuccess: async () => {
      setEditingId(null);
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '여행 수정 중 오류가 발생했습니다.';
      setEditError(message);
    },
  });

  const deleteTripMutation = useMutation({
    mutationFn: (tripId: number) => deleteTrip(tripId),
    onSuccess: async () => {
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '여행 삭제 중 오류가 발생했습니다.';
      setDeleteError(message);
    },
  });

  const assignManagerMutation = useMutation({
    mutationFn: ({ tripId, managerId }: { tripId: number; managerId: number }) =>
      assignTripManager(tripId, managerId),
    onSuccess: async () => {
      setAssignError(null);
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '담당자 배정 중 오류가 발생했습니다.';
      setAssignError(message);
    },
  });

  useEffect(() => {
    if (editingId === null) return;
    const target = rawTrips.find((trip) => trip.id === editingId);
    if (!target) {
      setEditingId(null);
      return;
    }
    setEditForm({
      title: target.title,
      destination: target.destination,
      start_date: target.start_date ?? '',
      end_date: target.end_date ?? '',
    });
  }, [editingId, rawTrips]);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    if (!createForm.title.trim() || !createForm.destination.trim()) {
      setCreateError('여행명과 목적지를 입력해 주세요.');
      return;
    }
    createTripMutation.mutate(createForm);
  };

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId) return;
    if (!editForm.title.trim() || !editForm.destination.trim()) {
      setEditError('여행명과 목적지를 입력해 주세요.');
      return;
    }
    updateTripMutation.mutate({ tripId: editingId, payload: editForm });
  };

  const handleAssign = (tripId: number, value: string, currentManager?: number | null) => {
    if (!value || (currentManager != null && String(currentManager) === value)) return;
    const managerId = Number(value);
    if (Number.isNaN(managerId)) return;
    assignManagerMutation.mutate({ tripId, managerId });
  };

  const sortedTrips = useMemo(() => {
    return [...scopedTrips].sort((a, b) => a.id - b.id);
  }, [scopedTrips]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">여행 관리</h1>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">여행 정보를 불러오는 중입니다.</p>
        ) : (
          <>
            {sortedTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 여행이 없습니다.</p>
            ) : (
              <div className="space-y-6">
                {sortedTrips.map((trip) => (
                  <article key={trip.id} className="rounded-lg border p-4 space-y-3">
                    <header className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-medium">{trip.title}</h2>
                        <p className="text-sm text-muted-foreground">{trip.destination}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                          {statusLabel[trip.status]}
                        </span>
                        <Link
                          href={`/app/(dashboard)/schedules?tripId=${trip.id}`}
                          className="text-primary hover:underline"
                        >
                          일정 보기
                        </Link>
                      </div>
                    </header>
                    <dl className="grid gap-1 text-sm text-muted-foreground">
                      <div>
                        <dt className="font-medium text-foreground">여행 기간</dt>
                        <dd>
                          {trip.start_date || trip.end_date
                            ? `${trip.start_date ?? '미정'} ~ ${trip.end_date ?? '미정'}`
                            : '일정 미정'}
                        </dd>
                      </div>
                      {trip.manager_name ? (
                        <div>
                          <dt className="font-medium text-foreground">담당자</dt>
                          <dd>{trip.manager_name}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <button
                        type="button"
                        className="rounded border px-3 py-1"
                        onClick={() => setEditingId(trip.id)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded border border-destructive px-3 py-1 text-destructive"
                        onClick={() => deleteTripMutation.mutate(trip.id)}
                      >
                        삭제
                      </button>
                      {isSuperAdmin ? (
                        <div className="flex items-center gap-2">
                          <label htmlFor={`manager-${trip.id}`} className="text-muted-foreground">
                            담당자 배정
                          </label>
                          <select
                            id={`manager-${trip.id}`}
                            className="rounded border px-2 py-1"
                            value={trip.manager != null ? String(trip.manager) : ''}
                            onChange={(event) =>
                              handleAssign(trip.id, event.target.value, trip.manager)
                            }
                          >
                            <option value="">선택</option>
                            {staff.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.full_name_kr || member.username}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
        {assignError ? <p className="text-sm text-destructive">{assignError}</p> : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">새 여행 등록</h2>
        <form className="grid gap-3 max-w-xl" onSubmit={handleCreate}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">여행명</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={createForm.title}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">목적지</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={createForm.destination}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, destination: event.target.value }))
              }
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">시작일</span>
              <input
                type="date"
                className="rounded border px-3 py-2"
                value={createForm.start_date}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, start_date: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">종료일</span>
              <input
                type="date"
                className="rounded border px-3 py-2"
                value={createForm.end_date}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, end_date: event.target.value }))
                }
              />
            </label>
          </div>
          <button
            type="submit"
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            disabled={createTripMutation.isPending}
          >
            {createTripMutation.isPending ? '등록 중...' : '여행 생성'}
          </button>
          {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
        </form>
      </section>

      {editingId ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">여행 정보 수정</h2>
          <form className="grid gap-3 max-w-xl" onSubmit={handleUpdate}>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">여행명</span>
              <input
                type="text"
                className="rounded border px-3 py-2"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">목적지</span>
              <input
                type="text"
                className="rounded border px-3 py-2"
                value={editForm.destination}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, destination: event.target.value }))
                }
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">시작일</span>
                <input
                  type="date"
                  className="rounded border px-3 py-2"
                  value={editForm.start_date}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, start_date: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">종료일</span>
                <input
                  type="date"
                  className="rounded border px-3 py-2"
                  value={editForm.end_date}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, end_date: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                disabled={updateTripMutation.isPending}
              >
                {updateTripMutation.isPending ? '저장 중...' : '수정 저장'}
              </button>
              <button
                type="button"
                className="rounded border px-4 py-2 text-sm"
                onClick={() => setEditingId(null)}
              >
                취소
              </button>
            </div>
            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
