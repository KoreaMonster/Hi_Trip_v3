'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, ChevronDown, UsersRound } from 'lucide-react';
import { useParticipantsQuery, useTripsQuery } from '@/lib/queryHooks';
import type { TripParticipant } from '@/types/api';

const genderLabel = (gender?: TripParticipant['traveler']['gender']) => {
  if (gender === 'M') return '남성';
  if (gender === 'F') return '여성';
  return '미확인';
};

export default function ParticipantsPage() {
  const { data: trips = [] } = useTripsQuery();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (trips.length === 0) {
      return;
    }

    const queryTripId = searchParams.get('tripId');
    if (queryTripId) {
      const parsed = Number(queryTripId);
      if (
        !Number.isNaN(parsed) &&
        trips.some((trip) => trip.id === parsed) &&
        selectedTripId !== parsed
      ) {
        setSelectedTripId(parsed);
        return;
      }
    }

    if (selectedTripId === null) {
      setSelectedTripId(trips[0].id);
    }
  }, [searchParams, selectedTripId, trips]);

  const tripQueryEnabled = typeof selectedTripId === 'number';
  const { data: participants = [], isLoading } = useParticipantsQuery(selectedTripId ?? undefined, {
    enabled: tripQueryEnabled,
  });

  const currentTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId), [trips, selectedTripId]);
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

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">참가자 관리</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">참가자 명단 & 연락처</h1>
            <p className="mt-1 text-sm text-slate-500">여행별 참가자 정보를 확인하고 긴급 연락망을 최신으로 유지하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={selectedTripId ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSelectedTripId(Number.isNaN(value) ? null : value);
                }}
                className="appearance-none rounded-full border border-slate-200 bg-white px-4 py-2 pr-10 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus:border-primary-300 focus:outline-none"
                disabled={trips.length === 0}
              >
                {trips.length === 0 && <option value="">등록된 여행 없음</option>}
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <button className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
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
              <h2 className="text-lg font-semibold text-slate-900">참가자 목록</h2>
              <p className="text-sm text-slate-500">연락처와 기본 정보를 확인하세요.</p>
            </div>
            {currentTrip && (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">{currentTrip.destination}</span>
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
              {!isLoading && participants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-500">
                    아직 참가자가 없습니다. 초대 코드를 공유해보세요.
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
