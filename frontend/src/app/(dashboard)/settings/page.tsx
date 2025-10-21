'use client';

import { useState, type ReactNode } from 'react';
import { BellRing, Globe2, ShieldAlert } from 'lucide-react';

export default function SettingsPage() {
  const [notificationEmail, setNotificationEmail] = useState('manager@hi-trip.io');
  const [timezone, setTimezone] = useState('Asia/Seoul');

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">환경 설정</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">운영 센터 기본 설정</h1>
            <p className="mt-1 text-sm text-slate-500">알림, 보안, 지역 설정을 관리해 팀 협업 환경을 최적화하세요.</p>
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SettingBlock
          icon={BellRing}
          title="알림 설정"
          description="대시보드 경보와 일정 변경 알림을 받을 이메일을 등록하세요."
        >
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            알림 이메일
            <input
              value={notificationEmail}
              onChange={(event) => setNotificationEmail(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
        </SettingBlock>

        <SettingBlock icon={Globe2} title="지역 & 시간대" description="각 페이지의 시간과 날짜 표기 방식을 설정합니다.">
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            표준 시간대
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="Asia/Seoul">Asia/Seoul (KST)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              <option value="Europe/Prague">Europe/Prague (CET)</option>
            </select>
          </label>
        </SettingBlock>

        <SettingBlock icon={ShieldAlert} title="보안 옵션" description="권한 관리와 2단계 인증 정책을 검토하세요.">
          <ul className="space-y-2 text-sm text-slate-600">
            <li>· 승인되지 않은 기기에서 로그인 시 관리자에게 알림</li>
            <li>· 비밀번호 90일마다 변경 안내</li>
            <li>· 담당자 계정에는 2단계 인증 적용</li>
          </ul>
        </SettingBlock>
      </section>
    </div>
  );
}

function SettingBlock({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: (props: { className?: string }) => JSX.Element;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 bg-[#F9FBFF] p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
