'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, BadgeCheck, ChevronDown, IdCard, Mail, Phone, UsersRound } from 'lucide-react';
import { useParticipantOverviewQuery, useParticipantsQuery, useTripsQuery } from '@/lib/queryHooks';
import { useUserStore } from '@/stores/useUserStore';
import type { TripParticipant, TripParticipantOverview, TripStatus } from '@/types/api';

const genderLabel = (gender?: TripParticipant['traveler']['gender']) => {
  if (gender === 'M') return '남성';
  if (gender === 'F') return '여성';
  return '미확인';
};

const tripStatusChip: Record<TripStatus, { label: string; tone: string; dot: string }> = {
  planning: {
    label: '계획 중',
    tone: 'bg-amber-50 text-amber-600 border border-amber-200',
    dot: 'bg-amber-400',
  },
  ongoing: {
    label: '진행 중',
    tone: 'bg-primary-50 text-primary-600 border border-primary-200',
    dot: 'bg-primary-400',
  },
  completed: {
    label: '완료',
    tone: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    dot: 'bg-emerald-400',
  },
};

export default function ParticipantsPage() {
  const { user } = useUserStore();
  const { data: trips = [] } = useTripsQuery();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const canViewOverview = user?.role === 'super_admin';
  const [viewMode, setViewMode] = useState<'trip' | 'overview'>(canViewOverview ? 'overview' : 'trip');
  const [overviewTripId, setOverviewTripId] = useState<number | 'all'>('all');
  const [overviewStatus, setOverviewStatus] = useState<'all' | TripStatus>('all');

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

  useEffect(() => {
    if (!canViewOverview && viewMode === 'overview') {
      setViewMode('trip');
    }
  }, [canViewOverview, viewMode]);

  const tripQueryEnabled = typeof selectedTripId === 'number';
  const { data: participants = [], isLoading } = useParticipantsQuery(selectedTripId ?? undefined, {
    enabled: tripQueryEnabled,
  });

  const overviewFilters = useMemo(() => {
    const filters: { trip?: number; status?: string } = {};
    if (overviewTripId !== 'all') {
      filters.trip = overviewTripId;
    }
    if (overviewStatus !== 'all') {
      filters.status = overviewStatus;
    }
    return filters;
  }, [overviewTripId, overviewStatus]);

  const {
    data: overviewParticipants = [],
    isLoading: overviewLoading,
  } = useParticipantOverviewQuery(
    Object.keys(overviewFilters).length > 0 ? overviewFilters : undefined,
    {
      enabled: canViewOverview && viewMode === 'overview',
    },
  );

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

  const overviewMetrics = useMemo(() => {
    if (overviewParticipants.length === 0) {
      return {
        total: 0,
        trips: 0,
        contactReady: 0,
        latest: null as TripParticipantOverview | null,
      };
    }

    const tripsSet = new Set<number>();
    let contactReady = 0;
    let latest: TripParticipantOverview | null = null;

    overviewParticipants.forEach((participant) => {
      tripsSet.add(participant.trip_id);
      if (participant.traveler.phone && participant.traveler.email) {
        contactReady += 1;
      }
      if (
        !latest ||
        new Date(participant.joined_date).getTime() > new Date(latest.joined_date).getTime()
      ) {
        latest = participant;
      }
    });

    return {
      total: overviewParticipants.length,
      trips: tripsSet.size,
      contactReady,
      latest,
    };
  }, [overviewParticipants]);

  const groupedOverview = useMemo(() => {
    const groups = new Map<
      number,
      {
        tripId: number;
        tripTitle: string;
        destination: string;
        status: TripStatus;
        managerName: string | null;
        maxParticipants: number | null;
        participants: TripParticipantOverview[];
      }
    >();

    overviewParticipants.forEach((participant) => {
      if (!groups.has(participant.trip_id)) {
        groups.set(participant.trip_id, {
          tripId: participant.trip_id,
          tripTitle: participant.trip_title,
          destination: participant.trip_destination,
          status: participant.trip_status,
          managerName: participant.trip_manager_name ?? null,
          maxParticipants: participant.max_participants ?? null,
          participants: [],
        });
      }
      groups.get(participant.trip_id)!.participants.push(participant);
    });

    return Array.from(groups.values()).sort((a, b) => a.tripTitle.localeCompare(b.tripTitle));
  }, [overviewParticipants]);

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
            {canViewOverview && (
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('trip')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    viewMode === 'trip'
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-500 hover:text-primary-600'
                  }`}
                >
                  여행별 보기
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('overview')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    viewMode === 'overview'
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-500 hover:text-primary-600'
                  }`}
                >
                  전체 참가자
                </button>
              </div>
            )}

            {viewMode === 'trip' ? (
              <>
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
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    value={overviewTripId === 'all' ? '' : overviewTripId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setOverviewTripId(value === '' ? 'all' : Number(value));
                    }}
                    className="appearance-none rounded-full border border-slate-200 bg-white px-4 py-2 pr-9 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus:border-primary-300 focus:outline-none"
                  >
                    <option value="">전체 여행</option>
                    {trips.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>
                <div className="relative">
                  <select
                    value={overviewStatus}
                    onChange={(event) => setOverviewStatus(event.target.value as 'all' | TripStatus)}
                    className="appearance-none rounded-full border border-slate-200 bg-white px-4 py-2 pr-9 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus:border-primary-300 focus:outline-none"
                  >
                    <option value="all">전체 상태</option>
                    <option value="planning">계획 중</option>
                    <option value="ongoing">진행 중</option>
                    <option value="completed">완료</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            )}
          </div>
        </div>

        {viewMode === 'trip' ? (
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
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ParticipantSummary
              label="전체 참가자"
              value={`${overviewMetrics.total}명`}
              helper={`${overviewMetrics.trips}개 여행에서 합류`}
            />
            <ParticipantSummary
              label="연락처 확보"
              value={`${overviewMetrics.contactReady}명`}
              helper="연락처 입력 완료"
              tone="bg-emerald-500/10 text-emerald-600"
            />
            <ParticipantSummary
              label="최근 합류"
              value={overviewMetrics.latest?.traveler.full_name_kr ?? '기록 없음'}
              helper={overviewMetrics.latest?.joined_date
                ? new Date(overviewMetrics.latest.joined_date).toLocaleString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '최근 합류 내역이 없습니다.'}
              tone="bg-primary-500/10 text-primary-600"
            />
            <ParticipantSummary
              label="선택된 필터"
              value={
                overviewTripId === 'all'
                  ? '전체 여행'
                  : trips.find((trip) => trip.id === overviewTripId)?.title ?? '여행 미선택'
              }
              helper={
                overviewStatus === 'all'
                  ? '전체 상태'
                  : overviewStatus === 'planning'
                  ? '계획 중 여행'
                  : overviewStatus === 'ongoing'
                  ? '진행 중 여행'
                  : '완료된 여행'
              }
              tone="bg-slate-200/40 text-slate-600"
            />
          </div>
        )}
      </section>

      {viewMode === 'trip' ? (
        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
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

          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">긴급 연락 카드</h2>
            <p className="text-sm text-slate-500">팀에 즉시 공유할 주요 연락망입니다.</p>
            <div className="space-y-3">
              {participants.slice(0, 3).map((participant) => (
                <div key={participant.id} className="rounded-2xl border border-slate-100 bg-[#E8F1FF] p-4 shadow-inner">
                  <p className="text-sm font-semibold text-slate-900">{participant.traveler.full_name_kr}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <Phone className="h-3.5 w-3.5 text-primary-500" />
                    {participant.traveler.phone}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <Mail className="h-3.5 w-3.5 text-primary-500" />
                    {participant.traveler.email}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-primary-600">
                    <BadgeCheck className="h-3.5 w-3.5" /> 체크인 완료
                  </p>
                </div>
              ))}
              {participants.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  등록된 연락 카드가 없습니다.
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-[#F9FBFF] p-4 text-xs text-slate-500">
              <p className="font-semibold text-slate-800">팁</p>
              <p className="mt-1 leading-relaxed">
                참가자 노트에 건강 유의사항이나 식단 정보를 기록해두면 긴급 상황 대응이 빨라집니다.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-600 transition hover:bg-primary-100">
              <IdCard className="h-4 w-4" /> 연락 카드 내보내기
            </button>
          </aside>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">여행별 참가자 요약</h2>
              <p className="text-sm text-slate-500">총괄담당자 관점에서 모든 여행의 참가자를 확인하세요.</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {overviewLoading ? '데이터 불러오는 중' : `${overviewParticipants.length}명 결과`}
            </span>
          </div>
          <div className="mt-5 space-y-5">
            {overviewLoading && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                참가자 정보를 불러오는 중입니다.
              </div>
            )}
            {!overviewLoading && groupedOverview.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                선택한 조건에 해당하는 참가자가 없습니다.
              </div>
            )}
            {groupedOverview.map((group) => {
              const statusMeta = tripStatusChip[group.status];
              return (
                <article key={group.tripId} className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{group.tripTitle}</h3>
                      <p className="text-sm text-slate-500">{group.destination} · 담당자 {group.managerName ?? '미지정'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${statusMeta.tone}`}>
                        <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600">
                        인원 {group.participants.length}
                        {typeof group.maxParticipants === 'number' && (
                          <>
                            <span className="text-slate-400">/</span>
                            {group.maxParticipants}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-[#F7F9FC] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">참가자</th>
                          <th className="px-4 py-3 text-left font-semibold">연락처</th>
                          <th className="px-4 py-3 text-left font-semibold">이메일</th>
                          <th className="px-4 py-3 text-left font-semibold">성별</th>
                          <th className="px-4 py-3 text-left font-semibold">참가일</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.participants.map((participant) => (
                          <tr key={participant.id} className="transition hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-semibold text-slate-800">{participant.traveler.full_name_kr}</td>
                            <td className="px-4 py-3 text-slate-600">{participant.traveler.phone}</td>
                            <td className="px-4 py-3 text-slate-600">{participant.traveler.email}</td>
                            <td className="px-4 py-3 text-slate-600">{genderLabel(participant.traveler.gender)}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {new Date(participant.joined_date ?? '').toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
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
