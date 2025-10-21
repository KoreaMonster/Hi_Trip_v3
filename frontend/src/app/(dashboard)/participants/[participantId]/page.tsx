'use client';

import Link from 'next/link';
import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarClock,
  IdCard,
  Mail,
  MapPin,
  Phone,
  UserCircle2,
} from 'lucide-react';
import { useTripDetailQuery } from '@/lib/queryHooks';
import type { Trip, TripParticipant } from '@/types/api';

const statusMeta: Record<Trip['status'], { label: string; tone: string; dot: string }> = {
  planning: {
    label: '계획 중',
    tone: 'bg-amber-50 text-amber-600 border border-amber-200',
    dot: 'bg-amber-500/60',
  },
  ongoing: {
    label: '진행 중',
    tone: 'bg-primary-50 text-primary-600 border border-primary-200',
    dot: 'bg-primary-500/60',
  },
  completed: {
    label: '완료',
    tone: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    dot: 'bg-emerald-500/60',
  },
};

const genderLabel = (gender?: TripParticipant['traveler']['gender']) => {
  if (gender === 'M') return '남성';
  if (gender === 'F') return '여성';
  return '미확인';
};

const formatDate = (value?: string) => {
  if (!value) return '정보 없음';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '정보 없음';
  }
  return parsed.toLocaleDateString('ko-KR');
};

type ParticipantDetailPageProps = {
  params: Promise<{ participantId: string }> | { participantId: string };
  searchParams?: Promise<{ tripId?: string }> | { tripId?: string };
};

export default function ParticipantDetailPage({ params, searchParams }: ParticipantDetailPageProps) {
  const resolvedParams = use(params instanceof Promise ? params : Promise.resolve(params));
  const resolvedSearchParams = use(
    (searchParams instanceof Promise
      ? searchParams
      : Promise.resolve(searchParams ?? {})) as Promise<{ tripId?: string }>,
  );
  const { tripId: tripIdParam } = resolvedSearchParams ?? {};
  const participantId = Number(resolvedParams.participantId);
  const tripId = Number(tripIdParam ?? '');
  const router = useRouter();
  const isTripIdValid = Number.isFinite(tripId);
  const { data: tripDetail, isLoading, isError, error } = useTripDetailQuery(
    isTripIdValid ? tripId : undefined,
    { enabled: isTripIdValid },
  );

  const participant = useMemo(
    () => tripDetail?.participants.find((item) => item.id === participantId) ?? null,
    [tripDetail?.participants, participantId],
  );

  const handleBack = () => {
    if (isTripIdValid) {
      router.push(`/participants?tripId=${tripId}`);
    } else {
      router.push('/participants');
    }
  };

  if (!isTripIdValid) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 text-slate-700">
          <h1 className="text-xl font-semibold text-rose-600">여행 정보가 필요합니다</h1>
          <p className="mt-3 text-sm text-slate-600">
            참가자 상세 정보를 확인하려면 상단 참가자 목록에서 여행을 선택한 뒤 다시 시도하세요.
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-600 shadow-sm transition hover:bg-primary-100"
          >
            <ArrowLeft className="h-4 w-4" /> 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
          참가자 정보를 불러오는 중입니다.
        </div>
      </div>
    );
  }

  if (isError || !tripDetail || !participant) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 text-slate-700">
          <h1 className="text-xl font-semibold text-rose-600">참가자 정보를 찾을 수 없습니다</h1>
          <p className="mt-3 text-sm text-slate-600">
            {error instanceof Error ? error.message : '요청하신 참가자를 조회할 수 없습니다.'}
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-600 shadow-sm transition hover:bg-primary-100"
          >
            <ArrowLeft className="h-4 w-4" /> 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const status = statusMeta[tripDetail.status];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">참가자 상세</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{participant.traveler.full_name_kr}</h1>
            <p className="mt-1 text-sm text-slate-500">여행 참가자 프로필과 연락처, 일정 정보를 확인하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
            >
              <ArrowLeft className="h-4 w-4" /> 참가자 목록
            </button>
            <Link
              href="/trips"
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <MapPin className="h-4 w-4" /> 여행 관리로 이동
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">개인 정보</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailTile
              icon={UserCircle2}
              label="이름"
              value={`${participant.traveler.full_name_kr} (${participant.traveler.full_name_en})`}
              helper={genderLabel(participant.traveler.gender)}
            />
            <DetailTile
              icon={IdCard}
              label="생년월일"
              value={formatDate(participant.traveler.birth_date)}
              helper="여권 및 보험 등록에 활용"
            />
            <DetailTile
              icon={Phone}
              label="연락처"
              value={participant.traveler.phone}
              helper="긴급 연락망"
            />
            <DetailTile
              icon={Mail}
              label="이메일"
              value={participant.traveler.email}
              helper="안내 메일 발송용"
            />
          </div>
          <div className="rounded-2xl border border-slate-100 bg-[#F9FBFF] px-4 py-3 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">참가 메모</p>
            <p className="mt-1 leading-relaxed">
              참가일 {formatDate(participant.joined_date)} · 초대 코드 {participant.invite_code ? `사용 (${participant.invite_code})` : '정보 없음'}
            </p>
          </div>
        </article>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">여행 정보</h2>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-100 bg-[#E8F1FF] p-4 text-sm text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">담당 여행</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{tripDetail.title}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <CalendarClock className="h-3.5 w-3.5 text-primary-500" />
                {tripDetail.start_date} ~ {tripDetail.end_date}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-primary-500" />
                {tripDetail.destination}
              </p>
              <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}>
                <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                {status.label}
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">건강 · 위치 모니터링</p>
              <p className="mt-2 leading-relaxed">
                실시간 건강 데이터는 모니터링 화면에서 확인할 수 있습니다. 이상 징후 발생 시 즉시 담당자에게 알림이 전송됩니다.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

type DetailTileProps = {
  icon: (props: { className?: string }) => JSX.Element;
  label: string;
  value: string;
  helper?: string;
};

function DetailTile({ icon: Icon, label, value, helper }: DetailTileProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
          {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
        </div>
      </div>
    </div>
  );
}
