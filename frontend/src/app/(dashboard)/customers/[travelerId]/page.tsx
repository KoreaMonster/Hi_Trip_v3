'use client';

import Link from 'next/link';
import { use, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  IdCard,
  Mail,
  MapPin,
  Passport,
  Phone,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { useTripDetailQuery, useTravelerQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';

const formatDate = (value?: string | null) => {
  if (!value) return '미등록';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '미등록';
  }
  return parsed.toLocaleDateString('ko-KR');
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) return '-';
  return `${value.toLocaleString()}원`;
};

type PageProps = {
  params: { travelerId: string } | Promise<{ travelerId: string }>;
};

export default function CustomerDetailPage({ params }: PageProps) {
  const resolvedParams =
    typeof (params as PromiseLike<{ travelerId: string }>).then === 'function'
      ? use(params as Promise<{ travelerId: string }>)
      : (params as { travelerId: string });
  const travelerId = Number(resolvedParams.travelerId);
  const searchParams = useSearchParams();
  const tripIdParam = searchParams.get('tripId');
  const contextTripId = tripIdParam ? Number(tripIdParam) : undefined;

  const { data: traveler, isLoading, isError } = useTravelerQuery(
    Number.isFinite(travelerId) ? travelerId : undefined,
  );
  const { data: tripDetail, isLoading: tripLoading } = useTripDetailQuery(
    typeof contextTripId === 'number' && Number.isFinite(contextTripId) ? contextTripId : undefined,
  );
  const { isSuperAdmin } = useScopedTrips();

  const matchingParticipant = useMemo(() => {
    if (!tripDetail || !traveler) return null;
    return tripDetail.participants.find((participant) => participant.traveler.id === traveler.id) ?? null;
  }, [tripDetail, traveler]);

  if (!Number.isFinite(travelerId)) {
    return (
      <div className="space-y-4">
        <HeaderSkeleton />
        <ErrorCallout message="잘못된 고객 ID입니다." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <HeaderSkeleton />
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError || !traveler) {
    return (
      <div className="space-y-4">
        <HeaderSkeleton />
        <ErrorCallout message="고객 정보를 불러오지 못했습니다." />
      </div>
    );
  }

  const genderLabel = traveler.gender === 'M' ? '남성' : '여성';
  const companionLabel = traveler.is_companion ? '동행' : '단독';
  const outstandingAmount = Math.max(traveler.total_amount - traveler.paid_amount, 0);

  const statusItems: Array<{ label: string; active: boolean }> = [
    { label: '여권 검증 완료', active: traveler.passport_verified },
    { label: '신분 확인 완료', active: traveler.identity_verified },
    { label: '예약 확인 완료', active: traveler.booking_verified },
    { label: '여행자 보험 가입', active: traveler.insurance_subscribed },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <nav className="text-xs font-semibold text-slate-400" aria-label="Breadcrumb">
              <ol className="flex items-center gap-2">
                <li className="hover:text-slate-600">
                  <Link href="/customers" className="transition hover:text-primary-600">
                    여행 전 고객 관리
                  </Link>
                </li>
                <li aria-hidden className="text-slate-300">
                  /
                </li>
                <li className="text-slate-600">고객 상세 정보 관리</li>
              </ol>
            </nav>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{traveler.full_name_kr}</h1>
            <p className="mt-1 text-sm text-slate-500">
              고객의 모든 등록 정보를 확인하고 자동 검증 상태를 한눈에 확인하세요.
            </p>
            {matchingParticipant && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                <CalendarClock className="h-3.5 w-3.5" /> {formatDate(matchingParticipant.joined_date)} 참가 확정
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/customers"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> 목록으로
            </Link>
            <ContactButton
              icon={Phone}
              label="전화 연결"
              href={traveler.phone ? `tel:${traveler.phone}` : undefined}
              disabled={!traveler.phone}
            />
            <ContactButton
              icon={Mail}
              label="메일 발송"
              href={traveler.email ? `mailto:${traveler.email}` : undefined}
              disabled={!traveler.email}
            />
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <Card
            title="고객 기본 정보"
            icon={<Users className="h-4 w-4 text-primary-500" />}
            description="등록된 인적 사항과 연락처 정보를 확인합니다."
          >
            <div className="grid gap-3 text-sm">
              <DetailRow label="한글 성명" value={`${traveler.last_name_kr}${traveler.first_name_kr}`} />
              <DetailRow
                label="영문 성명"
                value={`${traveler.first_name_en} ${traveler.last_name_en}`.trim() || '미등록'}
              />
              <DetailRow label="생년월일" value={formatDate(traveler.birth_date)} />
              <DetailRow label="성별" value={genderLabel} />
              <DetailRow label="이메일" value={traveler.email || '이메일 미등록'} />
              <DetailRow label="연락처" value={traveler.phone || '연락처 미등록'} />
              <DetailRow label="국가" value={traveler.country || '미등록'} />
              <DetailRow label="주소" value={traveler.address || '주소 미등록'} />
            </div>
          </Card>

          <Card
            title="여행 동행 및 서류 정보"
            icon={<IdCard className="h-4 w-4 text-primary-500" />}
            description="동행 여부와 여권, 예약 관련 정보를 확인하세요."
          >
            <div className="grid gap-3 text-sm">
              <DetailRow label="동행 여부" value={companionLabel} />
              {traveler.is_companion && (
                <DetailRow label="동행인" value={traveler.companion_names || '동행자 정보 미등록'} />
              )}
              <DetailRow label="대리 예약" value={traveler.proxy_booking ? '예' : '아니오'} />
              <DetailRow label="여권 번호" value={traveler.passport_number || '미등록'} />
              <DetailRow label="여권 만료일" value={formatDate(traveler.passport_expiry)} />
            </div>
          </Card>

          <Card
            title="결제 현황"
            icon={<ShieldCheck className="h-4 w-4 text-primary-500" />}
            description="고객의 결제 진행 상황을 확인합니다."
          >
            <div className="grid gap-3 text-sm">
              <DetailRow label="총 결제 금액" value={formatCurrency(traveler.total_amount)} />
              <DetailRow label="입금 완료 금액" value={formatCurrency(traveler.paid_amount)} />
              <DetailRow label="미결제 금액" value={formatCurrency(outstandingAmount)} />
              <DetailRow label="결제 상태" value={traveler.payment_status ? '완료' : '미완료'} />
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card
            title="자동 유효성 검증"
            icon={<ShieldCheck className="h-4 w-4 text-primary-500" />}
            description="서류 검증 및 보험 가입 상태를 확인합니다."
          >
            <ul className="space-y-2">
              {statusItems.map((item) => (
                <li key={item.label}>
                  <StatusChip label={item.label} active={item.active} />
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="여행 정보"
            icon={<MapPin className="h-4 w-4 text-primary-500" />}
            description="고객이 포함된 여행 정보를 확인합니다."
          >
            {tripLoading ? (
              <p className="text-sm text-slate-500">여행 정보를 불러오는 중입니다.</p>
            ) : tripDetail ? (
              <div className="space-y-3 text-sm">
                <DetailRow label="여행명" value={tripDetail.title} compact />
                <DetailRow label="목적지" value={tripDetail.destination} compact />
                <DetailRow
                  label="여행 기간"
                  value={`${formatDate(tripDetail.start_date)} ~ ${formatDate(tripDetail.end_date)}`}
                  compact
                />
                <DetailRow label="담당자" value={tripDetail.manager_name ?? '배정 대기'} compact />
                <DetailRow
                  label="참가자 수"
                  value={`${tripDetail.participant_count ?? tripDetail.participants.length}명`}
                  compact
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {isSuperAdmin ? '선택된 여행 정보가 없습니다.' : '담당된 여행 범위 내 정보만 확인할 수 있습니다.'}
              </p>
            )}
          </Card>

          <Card
            title="문서 관리 메모"
            icon={<Passport className="h-4 w-4 text-primary-500" />}
            description="필요한 후속 조치를 기록하세요."
          >
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
              서류 업로드, 결제 증빙 등 필요한 후속 조치를 기록해 운영팀과 공유하세요.
            </p>
          </Card>
        </aside>
      </section>
    </div>
  );
}

function DetailRow({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div
      className={`grid gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3 text-xs text-slate-500 ${
        compact ? 'sm:grid-cols-[100px_1fr]' : 'sm:grid-cols-[140px_1fr]'
      }`}
    >
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

function StatusChip({ label, active }: { label: string; active: boolean }) {
  const Icon = active ? CheckCircle2 : AlertCircle;
  const tone = active
    ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
    : 'border-amber-200 bg-amber-50 text-amber-600';

  return (
    <div className={`flex items-center justify-between rounded-full border px-4 py-2 text-xs font-semibold ${tone}`}>
      <span>{label}</span>
      <Icon className="h-4 w-4" aria-hidden />
    </div>
  );
}

function Card({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function ContactButton({
  icon: Icon,
  label,
  href,
  disabled,
}: {
  icon: typeof Phone;
  label: string;
  href?: string;
  disabled?: boolean;
}) {
  const className = `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
    disabled
      ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
      : 'border border-primary-200 bg-primary-50 text-primary-600 hover:border-primary-300 hover:text-primary-700'
  }`;

  if (disabled || !href) {
    return (
      <span className={className}>
        <Icon className="h-4 w-4" /> {label}
      </span>
    );
  }

  return (
    <a className={className} href={href}>
      <Icon className="h-4 w-4" /> {label}
    </a>
  );
}

function HeaderSkeleton() {
  return <div className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white" />;
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

function ErrorCallout({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">{message}</div>
  );
}
