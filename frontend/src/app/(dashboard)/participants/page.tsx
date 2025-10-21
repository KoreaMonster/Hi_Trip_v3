'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTripParticipant } from '@/lib/api';
import { useParticipantsQuery, useTravelersQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { TripParticipantCreate } from '@/types/api';

export default function ParticipantsPage() {
  const { data: trips = [], isLoading: tripsLoading } = useScopedTrips();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState('');
  const [selectedTravelerId, setSelectedTravelerId] = useState<number | ''>('');
  const [formError, setFormError] = useState<string | null>(null);

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
    setInviteCode('');
    setSelectedTravelerId('');
    setFormError(null);
  }, [selectedTripId]);

  const participantsQuery = useParticipantsQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
  });
  const travelersQuery = useTravelersQuery({
    enabled: typeof selectedTripId === 'number',
  });

  const registerMutation = useMutation({
    mutationFn: ({ tripId, payload }: { tripId: number; payload: TripParticipantCreate }) =>
      createTripParticipant(tripId, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId, 'participants'] });
      setInviteCode('');
      setSelectedTravelerId('');
      setFormError(null);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '참가자 등록 중 오류가 발생했습니다.';
      setFormError(message);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTripId) {
      setFormError('참가자를 추가할 여행을 선택해 주세요.');
      return;
    }
    if (!selectedTravelerId) {
      setFormError('등록할 고객을 선택해 주세요.');
      return;
    }
    const payload: TripParticipantCreate = {
      traveler_id: Number(selectedTravelerId),
    };
    if (inviteCode.trim()) {
      payload.invite_code = inviteCode.trim();
    }
    setFormError(null);
    registerMutation.mutate({ tripId: selectedTripId, payload });
  };

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">여행 참가자 관리</h1>
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
                href={`/app/(dashboard)/schedules?tripId=${selectedTripId}`}
                className="text-primary hover:underline"
              >
                선택한 여행 일정 보기
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">참가자 등록</h2>
        <form className="grid gap-3 max-w-lg" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">참가 고객</span>
            <select
              className="rounded border px-3 py-2"
              value={selectedTravelerId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedTravelerId(value ? Number(value) : '');
              }}
              disabled={travelersQuery.isLoading || !selectedTripId}
            >
              <option value="">고객 선택</option>
              {travelersQuery.data?.map((traveler) => (
                <option key={traveler.id} value={traveler.id}>
                  {traveler.full_name_kr} ({traveler.phone || '연락처 없음'})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">초대 코드 (선택)</span>
            <input
              type="text"
              className="rounded border px-3 py-2"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="초대 코드가 있다면 입력해 주세요"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? '등록 중...' : '참가자 추가'}
          </button>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">참가자 목록</h2>
        {participantsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">참가자 정보를 불러오는 중입니다.</p>
        ) : null}
        {participantsQuery.data && participantsQuery.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 참가자가 없습니다.</p>
        ) : null}
        <ul className="grid gap-3">
          {participantsQuery.data?.map((participant) => (
            <li key={participant.id} className="rounded border p-3">
              <p className="font-medium">{participant.traveler.full_name_kr}</p>
              <p className="text-sm text-muted-foreground">
                {participant.traveler.phone || '연락처 없음'} ·{' '}
                {participant.traveler.email || '이메일 없음'}
              </p>
              <p className="text-xs text-muted-foreground">
                참가일: {participant.joined_date || '미기록'}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
