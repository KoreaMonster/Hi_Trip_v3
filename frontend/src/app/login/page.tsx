'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Plane, User } from 'lucide-react';
import { getProfile, postLogin } from '@/lib/api';
import { ApiError } from '@/lib/http';
import { useUserStore } from '@/stores/useUserStore';

interface LoginFormState {
  username: string;
  password: string;
}

const initialForm: LoginFormState = {
  username: '',
  password: '',
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (typeof error.body === 'string') return error.body;
    if (error.body && typeof error.body === 'object') {
      const detail = error.body.detail ?? error.body.non_field_errors;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        const first = detail.find((item) => typeof item === 'string');
        if (typeof first === 'string') return first;
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '로그인에 실패했습니다. 다시 시도해 주세요.';
};

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser } = useUserStore();
  const [form, setForm] = useState<LoginFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      try {
        const profile = await getProfile();
        if (!active) return;
        setUser(profile);
        setCheckingSession(false);
        router.replace('/');
      } catch {
        if (!active) return;
        setCheckingSession(false);
      }
    };

    if (user) {
      setCheckingSession(false);
      router.replace('/');
      return () => {
        active = false;
      };
    }

    void verifySession();

    return () => {
      active = false;
    };
  }, [router, setUser, user]);

  const handleChange = (field: keyof LoginFormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        username: form.username.trim(),
        password: form.password,
      };
      const profile = await postLogin(payload);
      setUser(profile);
      router.replace('/');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession && !user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#F7F9FC] text-slate-600">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white px-10 py-12 text-center shadow-2xl">
          <Plane className="h-8 w-8 text-primary-500" />
          <p className="text-lg font-semibold text-slate-900">세션을 확인하는 중입니다</p>
          <p className="text-sm text-slate-500">잠시만 기다려 주세요.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F7F9FC] via-white to-[#E8F1FF] px-6 py-12">
      <div className="grid w-full max-w-5xl gap-10 rounded-[32px] border border-white/60 bg-white/80 p-12 shadow-[0_25px_80px_rgba(91,141,239,0.18)] backdrop-blur">
        <section className="space-y-5">
          <div className="inline-flex items-center gap-3 rounded-full bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-600 shadow-sm">
            <Plane className="h-4 w-4" />
            HI-TRIP 운영센터
          </div>
          <h1 className="text-4xl font-bold text-slate-900">스태프 전용 로그인</h1>
          <p className="text-base leading-relaxed text-slate-500">
            여행 운영 데이터와 모니터링을 한 곳에서 관리하세요. 승인된 직원만 접근할 수 있으며, 모든 활동은 보안 로그에 기록됩니다.
          </p>
          <div className="mt-6 grid gap-4 rounded-2xl border border-slate-100 bg-white/70 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/15 text-primary-600">
                <User className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">SSO 연동 준비 중</p>
                <p className="text-xs text-slate-500">임시로 내부 계정으로 로그인합니다.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/15 text-primary-600">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">보안 안내</p>
                <p className="text-xs text-slate-500">로그인 시 세션 쿠키가 발급되며, 일정 시간 미사용 시 자동으로 만료됩니다.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
          <header className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">계정으로 로그인</h2>
            <p className="text-sm text-slate-500">부여받은 사내 계정 정보를 입력하세요.</p>
          </header>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-semibold text-slate-700">
                사용자 이름
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={(event) => handleChange('username')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="예: staff01"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => handleChange('password')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="비밀번호를 입력하세요"
                required
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {submitting ? '로그인 중...' : '로그인'}
            </button>
          </form>
          <footer className="space-y-3 text-center text-xs text-slate-400">
            <p>로그인 문제 발생 시 총괄담당자에게 승인 여부를 확인해 주세요.</p>
            <p>
              보안 정책에 따라 공용 기기 사용 후에는 반드시
              <span className="font-semibold text-slate-600"> 로그아웃</span>을 진행해야 합니다.
            </p>
            <p>
              문의: <Link href="mailto:support@hitrip.ai" className="font-semibold text-primary-500">support@hitrip.ai</Link>
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}
