'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Home,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from 'lucide-react';

import { useSchedulesQuery, useTravelerDetailQuery, useTripDetailQuery } from '@/lib/queryHooks';
import type { Schedule, TripParticipant } from '@/types/api';

const formatCurrency = (value: number) => `${value.toLocaleString('ko-KR')}원`;

const formatDate = (value?: string | null) => {
  if (!value) return '미등록';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '미등록';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(parsed);
};

const booleanLabel = (value: boolean) => (value ? '예' : '아니오');

const parseOptionalNumber = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const formatScheduleTimeRange = (schedule: Schedule) => {
  const start = schedule.start_time.slice(0, 5);
  const end = schedule.end_time.slice(0, 5);
  return `${start} ~ ${end}`;
};

export default function CustomerDetailPage() {
  const params = useParams<{ travelerId: string }>();
  const searchParams = useSearchParams();

  const travelerParam = params?.travelerId;
  const travelerId = travelerParam ? Number(travelerParam) : NaN;
  const resolvedTravelerId = Number.isNaN(travelerId) ? undefined : travelerId;

  const tripId = parseOptionalNumber(searchParams.get('trip'));
  const participantId = parseOptionalNumber(searchParams.get('participant'));

  const { data: traveler, isLoading, isError } = useTravelerDetailQuery(resolvedTravelerId);
  const { data: tripDetail } = useTripDetailQuery(tripId);
  const { data: tripSchedules = [], isLoading: isTripSchedulesLoading } = useSchedulesQuery(tripId, {
    enabled: typeof tripId === 'number',
  });

  const participant: TripParticipant | undefined = useMemo(() => {
    if (!tripDetail || typeof participantId !== 'number') return undefined;
    return tripDetail.participants.find((item) => item.id === participantId);
  }, [tripDetail, participantId]);

  const highlightedSchedules = useMemo(() => {
    if (!tripSchedules || tripSchedules.length === 0) return [] as Schedule[];
    return [...tripSchedules]
      .sort((a, b) => {
        if (a.day_number === b.day_number) {
          return a.start_time.localeCompare(b.start_time);
        }
        return a.day_number - b.day_number;
      })
      .slice(0, 5);
  }, [tripSchedules]);

  const schedulePageHref = typeof tripId === 'number' ? `/schedules?trip=${tripId}` : '/schedules';

  if (!resolvedTravelerId) {
    return (
      <div className="space-y-6">
        <HeaderSection />
        <ErrorState message="유효한 고객 ID가 아닙니다." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <HeaderSection travelerName="고객 상세 정보" />
        <LoadingState />
      </div>
    );
  }

  if (isError || !traveler) {
    return (
      <div className="space-y-6">
        <HeaderSection />
        <ErrorState message="고객 정보를 불러오지 못했습니다." />
      </div>
    );
  }

  const outstanding = Math.max(traveler.total_amount - traveler.paid_amount, 0);
  const validationStatuses = [
    { label: '여권 정보 검증', value: traveler.passport_verified },
    { label: '신분 확인', value: traveler.identity_verified },
    { label: '예약 확인', value: traveler.booking_verified },
    { label: '보험 가입', value: traveler.insurance_subscribed },
  ];

  return (
    <div className="space-y-6">
      <HeaderSection travelerName={traveler.full_name_kr} />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={<User className="h-4 w-4 text-primary-500" />}
            title="기본 정보"
            description="고객 연락처와 인적 사항을 확인하세요."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="한글 성명" value={traveler.full_name_kr} />
            <InfoCard label="영문 성명" value={traveler.full_name_en || '미등록'} />
            <InfoCard label="생년월일" value={formatDate(traveler.birth_date)} />
            <InfoCard label="성별" value={traveler.gender_display} />
            <InfoCard label="연락처" value={traveler.phone} />
            <InfoCard label="이메일" value={traveler.email || '미등록'} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="주소" value={traveler.address || '미등록'} icon={<Home className="h-4 w-4 text-primary-500" />} />
            <InfoCard label="국가" value={traveler.country || '미등록'} icon={<MapPin className="h-4 w-4 text-primary-500" />} />
            <InfoCard
              label="동행 여부"
              value={traveler.is_companion ? '동행 있음' : '단독 여행'}
              helper={traveler.companion_names ? `동행인: ${traveler.companion_names}` : undefined}
              icon={<Users className="h-4 w-4 text-primary-500" />}
            />
            <InfoCard
              label="대리 예약"
              value={traveler.proxy_booking ? '예' : '아니오'}
              icon={<ShieldCheck className="h-4 w-4 text-primary-500" />}
            />
          </div>

          <SectionTitle
            icon={<PassportIcon />}
            title="여권 및 검증 정보"
            description="여권 만료일과 자동 검증 결과를 확인하세요."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="여권 번호" value={traveler.passport_number || '미등록'} />
            <InfoCard label="여권 만료일" value={formatDate(traveler.passport_expiry)} />
            <InfoCard label="여권 검증" value={booleanLabel(traveler.passport_verified)} />
            <InfoCard label="신분 확인" value={booleanLabel(traveler.identity_verified)} />
          </div>

          <SectionTitle
            icon={<CreditCard className="h-4 w-4 text-primary-500" />}
            title="결제 정보"
            description="결제 진행 현황과 잔여 금액을 확인하세요."
          />

          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard label="총 금액" value={formatCurrency(traveler.total_amount)} />
            <InfoCard label="결제 완료" value={formatCurrency(traveler.paid_amount)} />
            <InfoCard label="잔여 금액" value={formatCurrency(outstanding)} />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-[#F9FBFF] px-5 py-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">자동 유효성 검증 결과</p>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {validationStatuses.map((status) => (
                <li key={status.label} className="flex items-center gap-2">
                  {status.value ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  )}
                  <span className="text-sm text-slate-600">{status.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <SectionTitle
            icon={<CalendarClock className="h-4 w-4 text-primary-500" />}
            title="참여 일정 요약"
            description="선택한 여행에서 진행 예정인 일정을 확인하세요."
          />

          <div className="space-y-3 rounded-2xl border border-slate-100 bg-white px-5 py-4">
            {typeof tripId !== 'number' ? (
              <p className="text-sm text-slate-500">연결된 여행 정보를 찾을 수 없어 일정을 불러오지 못했습니다.</p>
            ) : isTripSchedulesLoading ? (
              <p className="text-sm text-slate-500">일정을 불러오는 중입니다.</p>
            ) : highlightedSchedules.length > 0 ? (
              <ul className="space-y-3 text-sm text-slate-600">
                {highlightedSchedules.map((schedule) => (
                  <li key={schedule.id} className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-[#F9FBFF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {schedule.day_number}일차 · {formatScheduleTimeRange(schedule)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {schedule.main_content ?? schedule.place_name ?? '세부 일정 미정'}
                      </p>
                      {schedule.meeting_point && (
                        <p className="text-xs text-slate-400">집결지: {schedule.meeting_point}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {schedule.place_id ? (
                        <Link
                          href={`/places/${schedule.place_id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                        >
                          장소 상세
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">연결된 장소 없음</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">등록된 일정이 없습니다.</p>
            )}
          </div>

          {typeof tripId === 'number' && (
            <div className="flex justify-end">
              <Link
                href={schedulePageHref}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
              >
                전체 타임라인 보기
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">결제 상태</h2>
                <p className="text-xs text-slate-500">총 결제 금액 대비 진행 상황입니다.</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  traveler.payment_status
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {traveler.payment_status ? '결제 완료' : '결제 진행 중'}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary-500" /> 결제 금액 {formatCurrency(traveler.paid_amount)}
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary-500" /> 보험 가입 {traveler.insurance_subscribed ? '완료' : '미가입'}
              </p>
              <p className="flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-primary-500" /> 최근 갱신 {formatDate(traveler.updated_at)}
              </p>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary-500" />
              <h2 className="text-base font-semibold text-slate-900">참여 여행 정보</h2>
            </div>
            {tripDetail ? (
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">{tripDetail.title}</p>
                <p>여행지: {tripDetail.destination}</p>
                <p>
                  일정: {formatDate(tripDetail.start_date)} - {formatDate(tripDetail.end_date)}
                </p>
                {participant && (
                  <p>참가 확정일: {formatDate(participant.joined_date)}</p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">선택된 여행 정보가 없습니다.</p>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Mail className="h-4 w-4 text-primary-500" /> 연락 메모
            </div>
            <p className="mt-3 text-sm text-slate-600">
              고객과의 커뮤니케이션 이력을 정리하고, 맞춤 안내 사항을 기록해 주세요.
            </p>
            <div className="mt-4 space-y-2 text-xs text-slate-500">
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-primary-400" /> 휴대전화 {traveler.phone}
              </p>
              {traveler.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-primary-400" /> 이메일 {traveler.email}
                </p>
              )}
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}

function HeaderSection({ travelerName }: { travelerName?: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <nav className="text-xs text-slate-500">
          <span className="font-medium text-slate-400">여행 관리</span>
          <span className="mx-2 text-slate-300">/</span>
          <Link href="/customers" className="text-slate-500 hover:text-primary-600">
            고객 관리
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-primary-600">고객 상세 정보 관리</span>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {travelerName ? `${travelerName} 고객 상세` : '고객 상세 정보 관리'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          고객의 연락처, 결제 상태, 여권 정보 등 주요 데이터를 한 번에 확인하세요.
        </p>
      </div>
      <Link
        href="/customers"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" /> 고객 목록으로
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-primary-500" /> 고객 정보를 불러오는 중입니다.
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-3xl border border-rose-200 bg-rose-50">
      <p className="text-sm font-semibold text-rose-600">{message}</p>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50">{icon}</span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function PassportIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      stroke="currentColor"
      className="h-4 w-4 text-primary-500"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5 0v18m-3-9h6"
      />
    </svg>
  );
}
