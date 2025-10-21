'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, UploadCloud } from 'lucide-react';
import {
  useMonitoringAlertsQuery,
  useParticipantsQuery,
  useSchedulesQuery,
  useTripsQuery,
} from '@/lib/queryHooks';
import type { Trip } from '@/types/api';

type ChecklistStatus = 'completed' | 'in-progress' | 'pending';

const statusTone: Record<ChecklistStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  'in-progress': 'bg-primary-50 text-primary-600 border border-primary-200',
  pending: 'bg-slate-100 text-slate-600 border border-slate-200',
};

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  due: string;
  status: ChecklistStatus;
};

export default function ChecklistsPage() {
  const { data: trips = [] } = useTripsQuery();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  useEffect(() => {
    if (trips.length > 0 && selectedTripId === null) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips, selectedTripId]);

  const selectedTrip = useMemo<Trip | undefined>(
    () => trips.find((trip) => trip.id === (selectedTripId ?? -1)),
    [trips, selectedTripId],
  );

  const tripIdForQuery = typeof selectedTripId === 'number' ? selectedTripId : undefined;

  const {
    data: participants = [],
    isLoading: isParticipantsLoading,
    isError: isParticipantsError,
  } = useParticipantsQuery(tripIdForQuery, { enabled: typeof tripIdForQuery === 'number' });
  const {
    data: schedules = [],
    isLoading: isSchedulesLoading,
    isError: isSchedulesError,
  } = useSchedulesQuery(tripIdForQuery, { enabled: typeof tripIdForQuery === 'number' });
  const {
    data: alerts = [],
    isLoading: isAlertsLoading,
    isError: isAlertsError,
  } = useMonitoringAlertsQuery(tripIdForQuery, { enabled: typeof tripIdForQuery === 'number' });

  const checklistItems = useMemo<ChecklistItem[]>(() => {
    if (!selectedTrip) return [];

    const now = new Date();
    const startDate = selectedTrip.start_date ? new Date(selectedTrip.start_date) : null;

    const getDueLabel = (daysBefore: number) => {
      if (!startDate) return '일정 미정';
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() - daysBefore);

      const diff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) return `D-${diff}`;
      if (diff === 0) return 'D-Day';
      return `D+${Math.abs(diff)}`;
    };

    const participantsWithContacts = participants.filter(
      (participant) => participant.traveler.phone && participant.traveler.email,
    );
    const hasManager = Boolean(selectedTrip.manager_name);
    const hasSchedules = schedules.length > 0;
    const unresolvedAlerts = alerts.filter((alert) => alert.created_at).length;

    const participantStatus: ChecklistStatus = participants.length === 0
      ? 'pending'
      : participantsWithContacts.length === participants.length
        ? 'completed'
        : 'in-progress';

    const managerStatus: ChecklistStatus = hasManager ? 'completed' : 'pending';
    const scheduleStatus: ChecklistStatus = hasSchedules ? 'completed' : 'in-progress';
    const alertStatus: ChecklistStatus = unresolvedAlerts === 0 ? 'completed' : 'in-progress';

    return [
      {
        id: 'participants',
        title: '참가자 연락처 점검',
        description: `${participantsWithContacts.length}/${participants.length}명 연락처 확보`,
        due: getDueLabel(7),
        status: participantStatus,
      },
      {
        id: 'manager',
        title: '담당자 배정 확정',
        description: hasManager
          ? `${selectedTrip.manager_name ?? '담당자'} 배정 완료`
          : '담당자 배정이 필요합니다.',
        due: getDueLabel(5),
        status: managerStatus,
      },
      {
        id: 'schedule',
        title: '일정 구성 검토',
        description: hasSchedules
          ? `${schedules.length}개 일정이 등록되어 있습니다.`
          : '등록된 일정이 없습니다.',
        due: getDueLabel(3),
        status: scheduleStatus,
      },
      {
        id: 'alerts',
        title: '위험 대응 계획 업데이트',
        description:
          unresolvedAlerts === 0
            ? '최근 경보 없음 · 계획 최신화 완료'
            : `미처리 경보 ${unresolvedAlerts}건 확인 필요`,
        due: getDueLabel(1),
        status: alertStatus,
      },
    ];
  }, [alerts, participants, schedules, selectedTrip]);

  const completedCount = checklistItems.filter((item) => item.status === 'completed').length;
  const inProgressCount = checklistItems.filter((item) => item.status === 'in-progress').length;
  const pendingCount = checklistItems.filter((item) => item.status === 'pending').length;

  const isLoading = isParticipantsLoading || isSchedulesLoading || isAlertsLoading;
  const hasError = isParticipantsError || isSchedulesError || isAlertsError;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">운영 체크리스트</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">여행 준비 상태 확인</h1>
            <p className="mt-1 text-sm text-slate-500">선택한 여행의 준비 상황을 백엔드 데이터와 연동해 확인하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedTripId ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedTripId(value ? Number(value) : null);
              }}
              disabled={trips.length === 0}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus:border-primary-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {trips.length === 0 && (
                <option value="">등록된 여행이 없습니다</option>
              )}
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
            </select>
            <button className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
              <UploadCloud className="h-4 w-4" /> 체크리스트 내보내기
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">오늘의 작업</h2>
              <p className="text-sm text-slate-500">실제 데이터 기반으로 우선순위를 확인하세요.</p>
            </div>
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
              완료 {completedCount}/{checklistItems.length}
            </span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> 준비 상태를 불러오는 중입니다.
            </div>
          )}

          {hasError && !isLoading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">
              체크리스트 데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침하거나 다시 시도해 주세요.
            </div>
          )}

          {!isLoading && !hasError && checklistItems.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              표시할 여행이 없습니다. 새로운 여행을 생성해 주세요.
            </div>
          )}

          <ul className="space-y-3">
            {!isLoading && !hasError &&
              checklistItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-4 transition hover:border-primary-200 ${statusTone[item.status]}`}
                >
                  <div
                    className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                      item.status === 'completed'
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : item.status === 'in-progress'
                          ? 'border-primary-400 bg-white text-primary-500'
                          : 'border-slate-300 bg-white text-slate-400'
                    }`}
                    aria-hidden="true"
                  >
                    {item.status === 'completed' ? '✓' : item.status === 'in-progress' ? '•' : ''}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" /> {item.due}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                  </div>
                </li>
              ))}
          </ul>
        </article>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">완료 요약</h2>
          <p className="text-sm text-slate-500">데이터 기반으로 팀의 준비 상황을 확인하세요.</p>

          <div className="space-y-3 text-sm text-slate-600">
            <SummaryItem tone="emerald" label="완료" value={completedCount} />
            <SummaryItem tone="primary" label="진행 중" value={inProgressCount} />
            <SummaryItem tone="amber" label="대기" value={pendingCount} />
            <SummaryItem tone="rose" label="최근 경보" value={alerts.length} />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-[#F7F9FC] p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-800">팁</p>
            <p className="mt-1 leading-relaxed">
              체크리스트를 내보내 팀과 공유하면 현장에서 체크인/체크아웃을 실시간으로 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-primary-500" />
            항목 상태는 여행, 일정, 경보 데이터를 기준으로 자동 계산됩니다.
          </div>
        </aside>
      </section>
    </div>
  );
}

function SummaryItem({
  tone,
  label,
  value,
}: {
  tone: 'emerald' | 'primary' | 'amber' | 'rose';
  label: string;
  value: number;
}) {
  const toneClass: Record<'emerald' | 'primary' | 'amber' | 'rose', string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    primary: 'border-primary-200 bg-primary-50 text-primary-600',
    amber: 'border-amber-200 bg-amber-50 text-amber-600',
    rose: 'border-rose-200 bg-rose-50 text-rose-600',
  };

  return (
    <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold ${toneClass[tone]}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
