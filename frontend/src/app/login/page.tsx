'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Plane, User } from 'lucide-react';
import { getProfile, postLogin } from '@/lib/api';
import { ApiError } from '@/lib/http';
import { useUserStore } from '@/stores/useUserStore';
import LanguageSwitch from '@/components/LanguageSwitch';
import { useTranslations } from '@/lib/i18n';

interface LoginFormState {
  username: string;
  password: string;
}

const initialForm: LoginFormState = {
  username: '',
  password: '',
};

export default function LoginPage() {
  const t = useTranslations();
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

  const extractErrorMessage = (error: unknown) => {
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

    return t('login.form.errorFallback');
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
      <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#F7F9FC] text-slate-600">
        <div className="absolute left-6 top-6">
          <LanguageSwitch />
        </div>
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white px-10 py-12 text-center shadow-2xl">
          <Plane className="h-8 w-8 text-primary-500" />
          <p className="text-lg font-semibold text-slate-900">{t('login.session.title')}</p>
          <p className="text-sm text-slate-500">{t('login.session.subtitle')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F7F9FC] via-white to-[#E8F1FF] px-6 py-12">
      <div className="absolute left-6 top-6">
        <LanguageSwitch />
      </div>
      <div className="grid w-full max-w-5xl gap-10 rounded-[32px] border border-white/60 bg-white/80 p-12 shadow-[0_25px_80px_rgba(91,141,239,0.18)] backdrop-blur">
        <section className="space-y-5">
          <div className="inline-flex items-center gap-3 rounded-full bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-600 shadow-sm">
            <Plane className="h-4 w-4" />
            {t('login.badge')}
          </div>
          <h1 className="text-4xl font-bold text-slate-900">{t('login.title')}</h1>
          <p className="text-base leading-relaxed text-slate-500">{t('login.description')}</p>
          <div className="mt-6 grid gap-4 rounded-2xl border border-slate-100 bg-white/70 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/15 text-primary-600">
                <User className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t('login.info.sso.title')}</p>
                <p className="text-xs text-slate-500">{t('login.info.sso.body')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/15 text-primary-600">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t('login.info.security.title')}</p>
                <p className="text-xs text-slate-500">{t('login.info.security.body')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
          <header className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">{t('login.form.title')}</h2>
            <p className="text-sm text-slate-500">{t('login.form.subtitle')}</p>
          </header>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-semibold text-slate-700">
                {t('login.form.username')}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={(event) => handleChange('username')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder={t('login.form.usernamePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                {t('login.form.password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => handleChange('password')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder={t('login.form.passwordPlaceholder')}
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
              {submitting ? t('login.form.submitting') : t('login.form.submit')}
            </button>
          </form>
          <footer className="space-y-3 text-center text-xs text-slate-400">
            <p>{t('login.footer.help')}</p>
            <p>{t('login.footer.security')}</p>
            <p>
              {t('login.footer.contact')}{' '}
              <Link href="mailto:support@hitrip.ai" className="font-semibold text-primary-500">
                support@hitrip.ai
              </Link>
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}
