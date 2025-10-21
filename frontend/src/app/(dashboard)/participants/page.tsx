'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, ChevronDown, UsersRound } from 'lucide-react';
import { useParticipantsQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { Trip, TripParticipant } from '@/types/api';

const genderLabel = (gender?: TripParticipant['traveler']['gender']) => {
  if (gender === 'M') return '남성';
  if (gender === 'F') return '여성';
  return '미확인';
};

const formatDate = (value?: string | null) => {
  if (!value) return '미정';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}`;
};

const formatTripRange = (trip?: Trip | null) => {
  if (!trip) return '일정 정보 없음';
  if (!trip.start_date || !trip.end_date) return '일정 미정';
  return `${formatDate(trip.start_date)} ~ ${formatDate(trip.end_date)}`;
};

export default function ParticipantsPage() {
  const {
    data: trips = [],
    isLoading: tripsLoading,
    isSuperAdmin,
  } = useScopedTrips();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (trips.length === 0) {
      if (selectedTripId !== null) {
        setSelectedTripId(null);
      }
      return;
    }

    const queryTripId = searchParams.get('tripId');
    if (queryTripId) {
      const parsed = Number(queryTripId);
      if (!Number.isNaN(parsed) && trips.some((trip) => trip.id === parsed)) {
        if (selectedTripId !== parsed) {
          setSelectedTripId(parsed);
        }
        return;
      }
    }

    if (selectedTripId === null || !trips.some((trip) => trip.id === selectedTripId)) {
      setSelectedTripId(trips[0].id);
    }
  }, [searchParams, selectedTripId, trips]);

  const tripQueryEnabled = typeof selectedTripId === 'number';
  const { data: participants = [], isLoading } = useParticipantsQuery(selectedTripId ?? undefined, {
    enabled: tripQueryEnabled,
  });

  const currentTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );

  const sortedTrips = useMemo(() => {
    const toComparable = (value?: string | null) => {
      if (!value) return Number.MAX_SAFE_INTEGER;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return Number.MAX_SAFE_INTEGER;
      }
      return parsed.getTime();
    };

    return [...trips].sort((a, b) => {
      const diff = toComparable(a.start_date) - toComparable(b.start_date);
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title);
    });
  }, [trips]);

  const groupedTrips = useMemo(
    () =>
      sortedTrips.map((trip, index) => ({
        order: index + 1,
        trip,
      })),
    [sortedTrips],
  );

  const participantMetrics = useMemo(() => {
    if (participants.length === 0) {
      return {
        total: 0,
        contactReady: 0,
        responseRate: 0,
        latest: null as TripParticipant | null,
        pendingContacts: 0,
      };
    }

    const contactReady = participants.filter(
      (participant) => participant.traveler.phone && participant.traveler.email,
    ).length;
    const responseRate = Math.round((contactReady / participants.length) * 100);
    const latest = [...participants]
      .filter((participant) => Boolean(participant.joined_date))
      .sort(
        (a, b) => new Date(a.joined_date ?? 0).getTime() - new Date(b.joined_date ?? 0).getTime(),
      )
      .pop() ?? null;
    const pendingContacts = participants.length - contactReady;

    return { total: participants.length, contactReady, responseRate, latest, pendingContacts };
  }, [participants]);

  const emptyParticipantsMessage = useMemo(() => {
    if (currentTrip) {
      return '아직 참가자가 없습니다. 초대 코드를 공유해보세요.';
    }
    if (trips.length === 0) {
      return isSuperAdmin ? '등록된 여행이 없습니다.' : '담당된 여행이 없습니다.';
    }
    return '조회할 여행을 선택해 주세요.';
  }, [currentTrip, isSuperAdmin, trips.length]);

  const noGroupMessage = isSuperAdmin
    ? '등록된 여행이 없습니다.'
    : '담당된 여행이 아직 배정되지 않았습니다.';

  const canSelectTrip = groupedTrips.length > 1;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">여행 그룹</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">포함된 여행별 고객 현황</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isSuperAdmin
                ? '총괄관리자는 모든 여행의 참가자 그룹을 확인할 수 있습니다.'
                : '배정된 여행을 기준으로 고객 그룹이 표시됩니다.'}
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-[#F7F9FC] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">구분</th>
                <th className="px-5 py-3 text-left font-semibold">고객 수</th>
                <th className="px-5 py-3 text-left font-semibold">여행명</th>
                <th className="px-5 py-3 text-left font-semibold">담당자</th>
                <th className="px-5 py-3 text-left font-semibold">시작일자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tripsLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    여행 정보를 불러오는 중입니다.
                  </td>
                </tr>
              )}
              {!tripsLoading && groupedTrips.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    {noGroupMessage}
                  </td>
                </tr>
              )}
              {groupedTrips.map(({ order, trip }) => {
                const isActive = trip.id === selectedTripId;
                return (
                  <tr
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={`cursor-pointer transition ${
                      isActive ? 'bg-primary-50/80 text-primary-700' : 'hover:bg-slate-50/70'
                    }`}
                    aria-selected={isActive}
                  >
                    <td className="px-5 py-4 font-semibold">{order}</td>
                    <td className="px-5 py-4 font-semibold">{trip.participant_count ?? 0}명</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{trip.title}</span>
                        <span className="text-xs text-slate-500">
                          {trip.destination ?? '목적지 미정'} · {formatTripRange(trip)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{trip.manager_name ?? '담당자 미지정'}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(trip.start_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">선택한 여행</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {currentTrip ? `${currentTrip.title} 참가자 현황` : '확인할 여행이 없습니다'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {currentTrip
                ? `${currentTrip.destination ?? '목적지 미정'} · ${formatTripRange(currentTrip)}`
                : isSuperAdmin
                  ? '여행을 생성하고 담당자를 배정하면 고객 그룹을 확인할 수 있습니다.'
                  : '배정된 여행이 등록되면 참가자 정보를 확인할 수 있습니다.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canSelectTrip ? (
              <div className="relative">
                <select
                  value={selectedTripId ?? ''}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) {
                      setSelectedTripId(null);
                      return;
                    }
                    setSelectedTripId(value);
                  }}
                  className="appearance-none rounded-full border border-slate-200 bg-white px-4 py-2 pr-10 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus:border-primary-300 focus:outline-none"
                >
                  {groupedTrips.map(({ trip }) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            ) : currentTrip ? (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                {currentTrip.title}
              </span>
            ) : null}
            <button
              type="button"
              disabled={!currentTrip}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UsersRound className="h-4 w-4" />
              초대 코드 공유
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ParticipantSummary
            label="총 참가자"
            value={`${participantMetrics.total}명`}
            helper="확정 인원"
          />
          <ParticipantSummary
            label="연락처 등록률"
            value={`${participantMetrics.responseRate}%`}
            helper={`연락처 등록 ${participantMetrics.contactReady}/${participantMetrics.total}명`}
            tone="bg-emerald-500/10 text-emerald-600"
          />
          <ParticipantSummary
            label="최근 합류"
            value={participantMetrics.latest?.traveler.full_name_kr ?? '기록 없음'}
            helper={participantMetrics.latest?.joined_date
              ? new Date(participantMetrics.latest.joined_date).toLocaleDateString('ko-KR')
              : '최근 합류 내역이 없습니다.'}
            tone="bg-primary-500/10 text-primary-600"
          />
          <ParticipantSummary
            label="연락처 보강 필요"
            value={`${participantMetrics.pendingContacts}명`}
            helper="연락처 확인이 필요합니다"
            tone="bg-amber-500/10 text-amber-600"
          />
        </div>
      </section>

      <section>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">참가자 목록</h3>
              <p className="text-sm text-slate-500">연락처와 기본 정보를 확인하세요.</p>
            </div>
            {currentTrip && (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                {currentTrip.destination ?? '목적지 미정'}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-[#F7F9FC] text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">이름</th>
                  <th className="px-5 py-3 text-left font-semibold">연락처</th>
                  <th className="px-5 py-3 text-left font-semibold">이메일</th>
                  <th className="px-5 py-3 text-left font-semibold">성별</th>
                  <th className="px-5 py-3 text-left font-semibold">참가일</th>
                  <th className="px-5 py-3 text-right font-semibold">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-500">
                      참가자 정보를 불러오는 중입니다.
                    </td>
                  </tr>
                )}
                {!isLoading && (participants.length === 0 || !currentTrip) && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-500">
                      {emptyParticipantsMessage}
                    </td>
                  </tr>
                )}
                {participants.map((participant) => (
                  <tr key={participant.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-semibold text-slate-800">{participant.traveler.full_name_kr}</td>
                    <td className="px-5 py-4 text-slate-600">{participant.traveler.phone}</td>
                    <td className="px-5 py-4 text-slate-600">{participant.traveler.email}</td>
                    <td className="px-5 py-4 text-slate-600">{genderLabel(participant.traveler.gender)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {new Date(participant.joined_date ?? '').toLocaleDateString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-4 text-right text-sm">
                      {tripQueryEnabled ? (
                        <Link
                          href={`/participants/${participant.id}?tripId=${selectedTripId}`}
                          className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600 shadow-sm transition hover:bg-primary-100"
                        >
                          상세 보기
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400">
                          상세 보기
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}

function ParticipantSummary({
  label,
  value,
  helper,
  tone = 'bg-slate-500/10 text-slate-600',
}: {
  label: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <UsersRound className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}
