'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { createSchedule, deleteSchedule, rebalanceTripDay, updateSchedule } from '@/lib/api';
import { usePlacesQuery, useSchedulesQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type {
  Schedule,
  ScheduleCreate,
  ScheduleRebalanceRequest,
  ScheduleUpdate,
} from '@/types/api';

const emptyForm = {
  day_number: 1,
  start_time: '09:00',
  end_time: '11:00',
  main_content: '',
  meeting_point: '',
  transport: '',
  budget: '',
  place_id: '',
};

type ScheduleFormState = typeof emptyForm;

type ScheduleListItem = Schedule & { place_label: string };

export default function SchedulesPage() {
  const { data: trips = [], isLoading: tripsLoading } = useScopedTrips();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { data: places = [] } = usePlacesQuery();
  const { data: schedules = [], isLoading: schedulesLoading } = useSchedulesQuery(
    selectedTripId ?? undefined,
    { enabled: typeof selectedTripId === 'number' },
  );
  const [form, setForm] = useState<ScheduleFormState>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rebalanceDay, setRebalanceDay] = useState(1);
  const [rebalanceMode, setRebalanceMode] = useState<ScheduleRebalanceRequest['travel_mode']>(
    'DRIVE',
  );
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);

  useEffect(() => {
    if (trips.length === 0) {
      setSelectedTripId(null);
      return;
    }
    if (selectedTripId && trips.some((trip) => trip.id === selectedTripId)) {
      return;
    }
    setSelectedTripId(trips[0].id);
  }, [selectedTripId, trips]);

  useEffect(() => {
    setRebalanceDay(1);
    setRebalanceMode('DRIVE');
    setForm({ ...emptyForm });
    setEditingId(null);
    setFormError(null);
  }, [selectedTripId]);

  useEffect(() => {
    if (!editingId) return;
    const target = schedules.find((schedule) => schedule.id === editingId);
    if (!target) {
      setEditingId(null);
      return;
    }
    setForm({
      day_number: target.day_number,
      start_time: target.start_time,
      end_time: target.end_time,
      main_content: target.main_content ?? '',
      meeting_point: target.meeting_point ?? '',
      transport: target.transport ?? '',
      budget: target.budget != null ? String(target.budget) : '',
      place_id: target.place ? String(target.place) : target.place_id ? String(target.place_id) : '',
    });
  }, [editingId, schedules]);

  const createMutation = useMutation({
    mutationFn: ({ tripId, payload }: { tripId: number; payload: ScheduleCreate }) =>
      createSchedule(tripId, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId, 'schedules'] });
      setForm({ ...emptyForm });
      setFormError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '일정 생성 중 오류가 발생했습니다.';
      setFormError(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ tripId, scheduleId, payload }: { tripId: number; scheduleId: number; payload: ScheduleUpdate }) =>
      updateSchedule(tripId, scheduleId, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId, 'schedules'] });
      setEditingId(null);
      setForm({ ...emptyForm });
      setFormError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '일정 수정 중 오류가 발생했습니다.';
      setFormError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ tripId, scheduleId }: { tripId: number; scheduleId: number }) =>
      deleteSchedule(tripId, scheduleId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId, 'schedules'] });
    },
  });

  const rebalanceMutation = useMutation({
    mutationFn: ({ tripId, body }: { tripId: number; body: ScheduleRebalanceRequest }) =>
      rebalanceTripDay(tripId, body),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId, 'schedules'] });
      setRebalanceError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '일정을 재배치하지 못했습니다.';
      setRebalanceError(message);
    },
  });

  const groupedSchedules = useMemo<ScheduleListItem[]>(() => {
    return [...schedules].sort((a, b) => {
      if (a.day_number !== b.day_number) return a.day_number - b.day_number;
      return a.order - b.order;
    }).map((schedule) => ({
      ...schedule,
      place_label:
        places.find((place) => place.id === (schedule.place ?? schedule.place_id ?? undefined))?.
          name ?? '연결된 장소 없음',
    }));
  }, [places, schedules]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTripId) {
      setFormError('일정을 등록할 여행을 선택해 주세요.');
      return;
    }
    if (!form.start_time || !form.end_time) {
      setFormError('시작 시간과 종료 시간을 입력해 주세요.');
      return;
    }

    const payload: ScheduleCreate = {
      day_number: Number(form.day_number) || 1,
      start_time: form.start_time,
      end_time: form.end_time,
    };

    if (form.transport.trim()) payload.transport = form.transport.trim();
    if (form.main_content.trim()) payload.main_content = form.main_content.trim();
    if (form.meeting_point.trim()) payload.meeting_point = form.meeting_point.trim();
    if (form.budget.trim()) {
      const budgetValue = Number(form.budget);
      if (!Number.isNaN(budgetValue)) {
        payload.budget = budgetValue;
      }
    }
    if (form.place_id) {
      const placeId = Number(form.place_id);
      if (!Number.isNaN(placeId)) {
        payload.place_id = placeId;
      }
    }

    setFormError(null);

    if (editingId) {
      updateMutation.mutate({ tripId: selectedTripId, scheduleId: editingId, payload });
    } else {
      createMutation.mutate({ tripId: selectedTripId, payload });
    }
  };

  const handleDelete = (scheduleId: number) => {
    if (!selectedTripId) return;
    deleteMutation.mutate({ tripId: selectedTripId, scheduleId });
  };

  const handleRebalance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTripId) return;
    const daySchedules = schedules
      .filter((schedule) => schedule.day_number === rebalanceDay)
      .map((schedule) => schedule.id);
    if (daySchedules.length === 0) {
      setRebalanceError('선택한 날짜에 등록된 일정이 없습니다.');
      return;
    }
    const body: ScheduleRebalanceRequest = {
      day_number: rebalanceDay,
      schedule_ids: daySchedules,
      travel_mode: rebalanceMode,
    };
    setRebalanceError(null);
    rebalanceMutation.mutate({ tripId: selectedTripId, body });
  };

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">일정 관리</h1>
        {tripsLoading ? (
          <p className="text-sm text-muted-foreground">여행 목록을 불러오는 중입니다.</p>
        ) : null}
        {trips.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 여행이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label htmlFor="trip-select" className="text-muted-foreground">
              여행 선택
            </label>
            <select
              id="trip-select"
              className="rounded border px-3 py-2"
              value={selectedTripId ?? ''}
              onChange={(event) => {
                const value = Number(event.target.value);
                setSelectedTripId(Number.isNaN(value) ? null : value);
                setEditingId(null);
                setForm({ ...emptyForm });
              }}
            >
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
            </select>
            {selectedTripId ? (
              <Link
                href={`/app/(dashboard)/participants?tripId=${selectedTripId}`}
                className="text-primary hover:underline"
              >
                참가자 보기
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{editingId ? '일정 수정' : '새 일정 추가'}</h2>
        <form className="grid gap-3 max-w-xl" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">일차</span>
            <input
              type="number"
              min={1}
              className="rounded border px-3 py-2"
              value={form.day_number}
              onChange={(event) => setForm((prev) => ({ ...prev, day_number: Number(event.target.value) }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">시작 시간</span>
              <input
                type="time"
                className="rounded border px-3 py-2"
                value={form.start_time}
                onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">종료 시간</span>
              <input
                type="time"
                className="rounded border px-3 py-2"
                value={form.end_time}
                onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">주요 내용</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={form.main_content}
              onChange={(event) => setForm((prev) => ({ ...prev, main_content: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">만남 장소</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={form.meeting_point}
              onChange={(event) => setForm((prev) => ({ ...prev, meeting_point: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">이동 수단</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={form.transport}
              onChange={(event) => setForm((prev) => ({ ...prev, transport: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">예상 예산 (원)</span>
            <input
              type="number"
              className="rounded border px-3 py-2"
              value={form.budget}
              onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">연결된 장소</span>
            <select
              className="rounded border px-3 py-2"
              value={form.place_id}
              onChange={(event) => setForm((prev) => ({ ...prev, place_id: event.target.value }))}
            >
              <option value="">선택 안 함</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId
                ? updateMutation.isPending
                  ? '수정 중...'
                  : '일정 저장'
                : createMutation.isPending
                ? '생성 중...'
                : '일정 추가'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded border px-4 py-2 text-sm"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...emptyForm });
                }}
              >
                취소
              </button>
            ) : null}
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">일정 목록</h2>
        {schedulesLoading ? (
          <p className="text-sm text-muted-foreground">일정을 불러오는 중입니다.</p>
        ) : null}
        {groupedSchedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 일정이 없습니다.</p>
        ) : null}
        <ul className="grid gap-3">
          {groupedSchedules.map((schedule) => (
            <li key={schedule.id} className="rounded border p-3 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {schedule.day_number}일차 · {schedule.start_time} ~ {schedule.end_time}
                </p>
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    className="rounded border px-3 py-1"
                    onClick={() => setEditingId(schedule.id)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="rounded border border-destructive px-3 py-1 text-destructive"
                    onClick={() => handleDelete(schedule.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{schedule.place_label}</p>
              {schedule.main_content ? (
                <p className="text-sm text-muted-foreground">{schedule.main_content}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">하루 일정 자동 재배치</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={handleRebalance}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">대상 일차</span>
            <input
              type="number"
              min={1}
              className="rounded border px-3 py-2"
              value={rebalanceDay}
              onChange={(event) => setRebalanceDay(Math.max(1, Number(event.target.value)))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">이동 수단</span>
            <select
              className="rounded border px-3 py-2"
              value={rebalanceMode}
              onChange={(event) =>
                setRebalanceMode(event.target.value as ScheduleRebalanceRequest['travel_mode'])
              }
            >
              <option value="DRIVE">차량 이동</option>
              <option value="WALK">도보 이동</option>
              <option value="BICYCLE">자전거</option>
              <option value="TRANSIT">대중교통</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            disabled={rebalanceMutation.isPending}
          >
            {rebalanceMutation.isPending ? '재배치 중...' : '재배치 실행'}
          </button>
        </form>
        {rebalanceError ? <p className="text-sm text-destructive">{rebalanceError}</p> : null}
      </section>
    </div>
  );
}
