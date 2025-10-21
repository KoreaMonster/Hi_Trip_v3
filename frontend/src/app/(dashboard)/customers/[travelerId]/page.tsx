'use client';

import Link from 'next/link';
import { Fragment, useMemo, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Settings,
  ShieldCheck,
  User,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { useSchedulesQuery, useTravelerDetailQuery, useTripDetailQuery } from '@/lib/queryHooks';
import type { Schedule, TripParticipant } from '@/types/api';

type HeaderSectionProps = {
  travelerName?: string;
  travelerPhone?: string;
  travelerEmail?: string;
  tripTitle?: string;
};

type DetailSection = {
  title: string;
  rows: {
    label: string;
    value: string;
    helper?: string;
  }[];
};

const formatCurrency = (value: number) => `${value.toLocaleString('ko-KR')}원`;

const formatDate = (value?: string | null) => {
  if (!value) return '미등록';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '미등록';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(parsed);
};

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
      .slice(0, 6);
  }, [tripSchedules]);

  const schedulePageHref = typeof tripId === 'number' ? `/schedules?trip=${tripId}` : '/schedules';

  const renderShell = (headerProps: HeaderSectionProps, body: ReactNode) => (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
        <NavigationPanel />
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <HeaderSection {...headerProps} />
          </div>
          {body}
        </div>
      </div>
    </div>
  );

  if (!resolvedTravelerId) {
    return renderShell({}, <ErrorState message="유효한 고객 ID가 아닙니다." />);
  }

  if (isLoading) {
    return renderShell({ travelerName: '고객 상세 정보' }, <LoadingState />);
  }

  if (isError || !traveler) {
    return renderShell({}, <ErrorState message="고객 정보를 불러오지 못했습니다." />);
  }

  const outstanding = Math.max(traveler.total_amount - traveler.paid_amount, 0);

  const detailSections: DetailSection[] = [
    {
      title: '고객 기본 정보',
      rows: [
        { label: '고객 명', value: traveler.full_name_kr },
        { label: '영문명', value: traveler.full_name_en || '미등록' },
        { label: '생년월일', value: formatDate(traveler.birth_date) },
        { label: '성별', value: traveler.gender_display },
        { label: '연락처', value: traveler.phone },
        { label: '이메일', value: traveler.email || '미등록' },
        { label: '국가', value: traveler.country },
        { label: '주소', value: traveler.address || '미등록' },
      ],
    },
    {
      title: '여권 · 여행 정보',
      rows: [
        { label: '여권 번호', value: traveler.passport_number || '미등록' },
        { label: '여권 만료일', value: formatDate(traveler.passport_expiry) },
        {
          label: '동행 여부',
          value: traveler.is_companion ? '동행 있음' : '단독 여행',
          helper: traveler.companion_names ? `동행인: ${traveler.companion_names}` : undefined,
        },
        { label: '대리 예약', value: traveler.proxy_booking ? '예' : '아니오' },
        { label: '보험 가입', value: traveler.insurance_subscribed ? '예' : '아니오' },
      ],
    },
    {
      title: '결제 및 정산',
      rows: [
        { label: '총 결제 금액', value: formatCurrency(traveler.total_amount) },
        { label: '결제 완료 금액', value: formatCurrency(traveler.paid_amount) },
        { label: '잔여 금액', value: formatCurrency(outstanding) },
        { label: '결제 상태', value: traveler.payment_status ? '결제 완료' : '결제 진행 중' },
        { label: '최근 업데이트', value: formatDate(traveler.updated_at) },
      ],
    },
    {
      title: '참여 여행',
      rows: [
        { label: '여행명', value: tripDetail?.title ?? '연결된 여행 없음' },
        { label: '여행지', value: tripDetail?.destination ?? '연결된 여행 없음' },
        {
          label: '여행 기간',
          value: tripDetail
            ? `${formatDate(tripDetail.start_date)} - ${formatDate(tripDetail.end_date)}`
            : '미정',
        },
        { label: '참가 확정일', value: participant ? formatDate(participant.joined_date) : '미확정' },
        { label: '등록 일정 수', value: `${tripSchedules.length}개` },
      ],
    },
  ];

  const validationStatuses = [
    { label: '여권 정보 검증', value: traveler.passport_verified },
    { label: '신분 확인', value: traveler.identity_verified },
    { label: '예약 확인', value: traveler.booking_verified },
    { label: '보험 가입 확인', value: traveler.insurance_subscribed },
    { label: '결제 확인', value: traveler.payment_status },
  ];

  const descriptionLines = [
    tripDetail
      ? `${tripDetail.title} (${formatDate(tripDetail.start_date)} ~ ${formatDate(tripDetail.end_date)}) 일정 참여`
      : '연결된 여행 정보가 없습니다.',
    participant ? `참가 확정일: ${formatDate(participant.joined_date)}` : '참가 확정일 미등록',
    `결제 상태: ${traveler.payment_status ? '완료' : '진행 중'} · 잔여 금액 ${formatCurrency(outstanding)}`,
    `연락처: ${traveler.phone}${traveler.email ? ` / ${traveler.email}` : ''}`,
    `여권 만료일: ${formatDate(traveler.passport_expiry)}`,
  ];

  const body = (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">고객 상세 정보 관리</h2>
          <p className="mt-1 text-sm text-slate-500">고객의 인적 사항과 여권, 결제, 일정 정보를 한 번에 점검하세요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-primary-600">
            <User className="h-3.5 w-3.5" /> 고객 ID {traveler.id}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
            <Phone className="h-3.5 w-3.5" /> {traveler.phone}
          </span>
          {traveler.email && (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Mail className="h-3.5 w-3.5" /> {traveler.email}
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <DetailOverviewTable sections={detailSections} />

          <ValidationChecklist statuses={validationStatuses} />

          <ScheduleTable
            schedules={highlightedSchedules}
            isLoading={isTripSchedulesLoading}
            tripId={tripId}
            schedulePageHref={schedulePageHref}
          />

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
            >
              중간 저장
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              완료
            </button>
          </div>
        </div>

        <aside className="space-y-5">
          <DescriptionPanel lines={descriptionLines} />
          <PaymentStatusCard
            total={traveler.total_amount}
            paid={traveler.paid_amount}
            outstanding={outstanding}
            paymentStatus={traveler.payment_status}
            updatedAt={traveler.updated_at}
          />
          <TripInfoCard
            tripTitle={tripDetail?.title}
            destination={tripDetail?.destination}
            startDate={tripDetail?.start_date}
            endDate={tripDetail?.end_date}
            participant={participant}
          />
          <ContactPanel
            phone={traveler.phone}
            email={traveler.email}
            country={traveler.country}
            address={traveler.address}
          />
        </aside>
      </div>
    </section>
  );

  return renderShell(
    {
      travelerName: traveler.full_name_kr,
      travelerPhone: traveler.phone,
      travelerEmail: traveler.email || undefined,
      tripTitle: tripDetail?.title,
    },
    body,
  );
}

function NavigationPanel() {
  const navItems = [
    {
      label: 'Dashboard',
      description: '전체 현황 요약',
      href: '/',
      icon: LayoutDashboard,
      active: false,
    },
    {
      label: '고객 관리',
      description: '고객 상세 정보 관리',
      href: '/customers',
      icon: Users,
      active: true,
    },
    {
      label: '일정 관리',
      description: '일정 · 타임라인',
      href: '/schedules',
      icon: CalendarClock,
      active: false,
    },
    {
      label: '장소 관리',
      description: '추천 장소 · 메모',
      href: '/places',
      icon: MapPin,
      active: false,
    },
    {
      label: '리포트',
      description: '분석 & 리포트',
      href: '#',
      icon: BarChart3,
      active: false,
      disabled: true,
    },
    {
      label: '정산',
      description: '결제 · 정산',
      href: '#',
      icon: Wallet,
      active: false,
      disabled: true,
    },
    {
      label: '설정',
      description: '시스템 설정',
      href: '/settings',
      icon: Settings,
      active: false,
      disabled: true,
    },
  ];

  return (
    <aside className="hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:block">
      <h2 className="text-sm font-semibold text-slate-900">여행 프로그램 메뉴</h2>
      <p className="mt-1 text-xs text-slate-500">기획서 구조에 맞춰 필요한 화면으로 이동하세요.</p>
      <nav className="mt-4 space-y-2">
        {navItems.map(({ label, description, href, icon: Icon, active, disabled }) => (
          <Link
            key={label}
            href={href}
            className={`group flex flex-col rounded-2xl border px-4 py-3 text-sm transition ${
              active
                ? 'border-primary-200 bg-primary-50 text-primary-600'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:text-primary-600'
            } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <Icon className="h-4 w-4" /> {label}
            </span>
            <span className="mt-1 text-xs text-slate-400 group-hover:text-current">{description}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function HeaderSection({ travelerName, travelerPhone, travelerEmail, tripTitle }: HeaderSectionProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <nav className="text-xs text-slate-500">
          <span className="font-medium text-slate-400">여행 관리</span>
          <span className="mx-2 text-slate-300">/</span>
          <Link href="/customers" className="text-slate-500 transition hover:text-primary-600">
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
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          {travelerPhone && (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Phone className="h-3.5 w-3.5" /> {travelerPhone}
            </span>
          )}
          {travelerEmail && (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Mail className="h-3.5 w-3.5" /> {travelerEmail}
            </span>
          )}
          {tripTitle && (
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-primary-600">
              <CalendarClock className="h-3.5 w-3.5" /> 연결 여행 {tripTitle}
            </span>
          )}
        </div>
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

function DetailOverviewTable({ sections }: { sections: DetailSection[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#FDFEFF]">
      <table className="min-w-full text-sm">
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.title}>
              <tr className="bg-[#F7F9FC]">
                <th
                  colSpan={2}
                  className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500"
                >
                  {section.title}
                </th>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <th className="w-40 px-4 py-3 text-left text-xs font-semibold text-slate-500">{row.label}</th>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">
                    {row.value}
                    {row.helper && <p className="mt-1 text-xs text-slate-400">{row.helper}</p>}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValidationChecklist({ statuses }: { statuses: { label: string; value: boolean }[] }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-inner">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">검증 체크리스트</h3>
        <span className="text-xs font-semibold text-primary-600">자동 검증</span>
      </header>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {statuses.map((status) => (
          <li key={status.label} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
            <span>{status.label}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              status.value ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
            }`}>
              {status.value ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {status.value ? '완료' : '미완료'}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ScheduleTable({
  schedules,
  isLoading,
  tripId,
  schedulePageHref,
}: {
  schedules: Schedule[];
  isLoading: boolean;
  tripId?: number;
  schedulePageHref: string;
}) {
  return (
    <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">참여 일정 요약</h3>
          <p className="text-xs text-slate-500">선택한 여행에서 진행 예정인 주요 일정을 확인하세요.</p>
        </div>
        <Link
          href={schedulePageHref}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
        >
          전체 타임라인 보기
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-100">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-[#F7F9FC] text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">일차</th>
              <th className="px-4 py-3 text-left font-semibold">시간</th>
              <th className="px-4 py-3 text-left font-semibold">일정 내용</th>
              <th className="px-4 py-3 text-left font-semibold">집결지</th>
              <th className="px-4 py-3 text-right font-semibold">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  일정을 불러오는 중입니다.
                </td>
              </tr>
            )}
            {!isLoading && schedules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  {typeof tripId === 'number' ? '등록된 일정이 없습니다.' : '연결된 여행 정보를 찾을 수 없습니다.'}
                </td>
              </tr>
            )}
            {schedules.map((schedule) => {
              const placeId =
                typeof schedule.place === 'number'
                  ? schedule.place
                  : typeof schedule.place_id === 'number'
                    ? schedule.place_id
                    : null;
              const detailHref = placeId ? `/places/${placeId}` : null;
              const title = schedule.main_content ?? schedule.place_name ?? '세부 일정 미정';

              return (
                <tr key={schedule.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-800">DAY {schedule.day_number}</td>
                  <td className="px-4 py-3 text-slate-600">{formatScheduleTimeRange(schedule)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <p className="font-semibold text-slate-900">{title}</p>
                    {schedule.meeting_point && (
                      <p className="text-xs text-slate-400">집결지: {schedule.meeting_point}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{schedule.meeting_point ?? '집결지 미정'}</td>
                  <td className="px-4 py-3 text-right">
                    {detailHref ? (
                      <Link
                        href={detailHref}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                      >
                        상세 보기
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">연결된 장소 없음</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function DescriptionPanel({ lines }: { lines: string[] }) {
  const filtered = lines.filter((line) => line && line.trim().length > 0);
  return (
    <article className="rounded-3xl border border-slate-200 bg-[#FDFEFF] p-5 shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-900">고객 메모</h3>
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Description</span>
      </header>
      {filtered.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
          {filtered.map((line, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full bg-primary-400" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">기록된 메모가 없습니다.</p>
      )}
    </article>
  );
}

function PaymentStatusCard({
  total,
  paid,
  outstanding,
  paymentStatus,
  updatedAt,
}: {
  total: number;
  paid: number;
  outstanding: number;
  paymentStatus: boolean;
  updatedAt: string;
}) {
  const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : paymentStatus ? 100 : 0;

  return (
    <article className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CreditCard className="h-4 w-4 text-primary-500" /> 결제 현황
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          paymentStatus ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
        }`}>
          {paymentStatus ? '결제 완료' : '결제 진행 중'}
        </span>
      </header>
      <div className="space-y-1 text-sm text-slate-600">
        <p>총 금액: {formatCurrency(total)}</p>
        <p>결제 완료: {formatCurrency(paid)}</p>
        <p>잔여 금액: {formatCurrency(outstanding)}</p>
      </div>
      <div>
        <div className="h-2 rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-primary-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-slate-400">진행률 {progress}% · {formatDate(updatedAt)} 기준</p>
      </div>
    </article>
  );
}

function TripInfoCard({
  tripTitle,
  destination,
  startDate,
  endDate,
  participant,
}: {
  tripTitle?: string;
  destination?: string;
  startDate?: string | null;
  endDate?: string | null;
  participant?: TripParticipant;
}) {
  return (
    <article className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <ShieldCheck className="h-4 w-4 text-primary-500" /> 참여 여행 정보
      </header>
      {tripTitle ? (
        <div className="space-y-2 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">{tripTitle}</p>
          <p>여행지: {destination ?? '미등록'}</p>
          <p>
            일정: {formatDate(startDate ?? undefined)} - {formatDate(endDate ?? undefined)}
          </p>
          <p>참가 확정일: {participant ? formatDate(participant.joined_date) : '미확정'}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">연결된 여행 정보가 없습니다.</p>
      )}
    </article>
  );
}

function ContactPanel({
  phone,
  email,
  country,
  address,
}: {
  phone: string;
  email?: string | null;
  country: string;
  address?: string | null;
}) {
  return (
    <article className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <MapPin className="h-4 w-4 text-primary-500" /> 연락 · 위치 정보
      </header>
      <div className="space-y-2 text-sm text-slate-600">
        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary-500" /> {phone}
        </p>
        {email && (
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary-500" /> {email}
          </p>
        )}
        <p className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary-500" /> {country}
        </p>
        <p className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-xs text-slate-500">
          {address && address.trim().length > 0 ? address : '주소 정보가 등록되어 있지 않습니다.'}
        </p>
      </div>
    </article>
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

