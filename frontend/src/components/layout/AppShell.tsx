'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bell,
  CalendarDays,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Plane,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { postLogout } from '@/lib/api';
import { ApiError } from '@/lib/http';
import { useProfileQuery } from '@/lib/queryHooks';
import type { UserDetail } from '@/types/api';
import { useUserStore } from '@/stores/useUserStore';
import LanguageSwitch from '@/components/LanguageSwitch';
import { useTranslations, type TranslationKey } from '@/lib/i18n';
import { useLocale } from '@/stores/useLocaleStore';

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  group?: 'pre' | 'mid';
  placement?: 'top' | 'bottom';
}
const areUsersEqual = (a: UserDetail | null | undefined, b: UserDetail | null | undefined) => {
  if (!a || !b) {
    return false;
  }

  return (
    a.id === b.id &&
    a.username === b.username &&
    a.email === b.email &&
    a.phone === b.phone &&
    a.first_name === b.first_name &&
    a.last_name === b.last_name &&
    a.first_name_kr === b.first_name_kr &&
    a.last_name_kr === b.last_name_kr &&
    a.full_name_kr === b.full_name_kr &&
    a.full_name_en === b.full_name_en &&
    a.role === b.role &&
    a.role_display === b.role_display &&
    a.is_approved === b.is_approved
  );
};


const BASE_NAV_ITEMS: NavItem[] = [
  { href: '/', labelKey: 'app.nav.dashboard', icon: LayoutDashboard, placement: 'top' },
  { href: '/trips', labelKey: 'app.nav.tripManagement', icon: Plane, group: 'pre' },
  { href: '/schedules', labelKey: 'app.nav.scheduleManagement', icon: CalendarDays, group: 'pre' },
  { href: '/participants', labelKey: 'app.nav.participantManagement', icon: Users, group: 'pre' },
  { href: '/monitoring', labelKey: 'app.nav.monitoring', icon: HeartPulse, group: 'mid' },
  { href: '/places', labelKey: 'app.nav.recommendations', icon: Sparkles, group: 'mid' },
  { href: '/settings', labelKey: 'app.nav.settings', icon: Settings, placement: 'bottom' },
];

const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/approvals', labelKey: 'app.nav.approvals', icon: ShieldCheck, placement: 'top' },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser, logout: clearUser } = useUserStore();
  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
    isFetching: isProfileFetching,
  } = useProfileQuery();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

useEffect(() => {
    if (!profile) {
      return;
    }

    setAuthError(null);

    if (areUsersEqual(user, profile)) {
      return;
    }

    setUser(profile);
  }, [profile, setUser, user]);


  useEffect(() => {
    if (!isProfileError) {
      return;
    }

    const apiError = profileError instanceof ApiError ? profileError : null;
    const shouldRedirectToLogin = (() => {
      if (!apiError) return false;
      if (apiError.status === 401) return true;
      if (apiError.status !== 403) return false;
      if (!apiError.body) return false;
      if (typeof apiError.body === 'string') {
        return apiError.body.includes('Authentication credentials were not provided');
      }
      const detail = apiError.body.detail ?? apiError.body.non_field_errors;
      if (typeof detail === 'string') {
        return detail.includes('Authentication credentials were not provided');
      }
      if (Array.isArray(detail)) {
        return detail.some(
          (item) => typeof item === 'string' && item.includes('Authentication credentials were not provided'),
        );
      }
      return false;
    })();

    if (shouldRedirectToLogin) {
      clearUser();
      router.replace('/login');
      return;
    }

    setAuthError(profileError?.message ?? t('app.authError.description'));
  }, [isProfileError, profileError, clearUser, router, t]);

  const initials = useMemo(() => {
    const baseName =
      locale === 'en'
        ? user?.full_name_en ?? profile?.full_name_en ?? user?.full_name_kr ?? profile?.full_name_kr ?? ''
        : user?.full_name_kr ?? profile?.full_name_kr ?? user?.full_name_en ?? profile?.full_name_en ?? '';

    if (!baseName) return 'HT';
    const compact = baseName.replace(/\s+/g, '');
    if (compact.length >= 2) {
      return compact.slice(-2).toUpperCase();
    }
    return compact.charAt(0).toUpperCase();
  }, [locale, profile?.full_name_en, profile?.full_name_kr, user?.full_name_en, user?.full_name_kr]);

  const displayName = useMemo(() => {
    const fallback = t('app.user.fallback');
    if (locale === 'en') {
      return user?.full_name_en ?? profile?.full_name_en ?? fallback;
    }
    return user?.full_name_kr ?? profile?.full_name_kr ?? fallback;
  }, [locale, profile?.full_name_en, profile?.full_name_kr, t, user?.full_name_en, user?.full_name_kr]);

  const availableNavItems = useMemo(() => {
    const role = user?.role ?? profile?.role;
    if (!role || role === 'super_admin') {
      return [...SUPER_ADMIN_NAV_ITEMS, ...BASE_NAV_ITEMS];
    }
    return BASE_NAV_ITEMS;
  }, [profile?.role, user?.role]);

  const navSections = useMemo(() => {
    const top = availableNavItems.filter((item) => item.placement === 'top');
    const pre = availableNavItems.filter((item) => item.group === 'pre');
    const mid = availableNavItems.filter((item) => item.group === 'mid');
    const bottom = availableNavItems.filter((item) => item.placement === 'bottom');
    return { top, pre, mid, bottom };
  }, [availableNavItems]);

  const currentTitle = useMemo(() => {
    const matched = availableNavItems.find((item) =>
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
    );
    return matched ? t(matched.labelKey) : t('app.header.titleFallback');
  }, [availableNavItems, pathname, t]);

  const renderNav = (item: NavItem) => {
    const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
    const label = t(item.labelKey);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition ${
          isActive
            ? 'bg-primary-50 text-primary-600 shadow-sm'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <item.icon
          className={`h-4 w-4 ${isActive ? 'text-primary-500' : 'text-slate-400 group-hover:text-primary-500'}`}
        />
        <span>{label}</span>
      </Link>
    );
  };

  const handleLogout = async () => {
    setLogoutError(null);
    setLogoutBusy(true);
    try {
      await postLogout();
      clearUser();
      router.replace('/login');
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t('app.logout.error');
      setLogoutError(message);
    } finally {
      setLogoutBusy(false);
    }
  };

  if (isProfileLoading && !user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#F7F9FC] text-slate-500">
        <div className="absolute left-6 top-6">
          <LanguageSwitch />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-10 py-12 text-center shadow-xl">
          <p className="text-sm font-semibold text-primary-500">HI-TRIP</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">{t('app.loading.title')}</p>
          <p className="mt-2 text-sm text-slate-500">{t('app.loading.subtitle')}</p>
        </div>
      </div>
    );
  }

  if (authError && !user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#F7F9FC] px-6 py-12 text-slate-600">
        <div className="absolute left-6 top-6">
          <LanguageSwitch />
        </div>
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white px-8 py-10 text-center shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-500">{t('app.authError.badge')}</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">{t('app.authError.title')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{authError}</p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setAuthError(null);
                void refetchProfile();
              }}
              className="w-full rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              {t('app.authError.retry')}
            </button>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
            >
              {t('app.authError.gotoLogin')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F7F9FC] text-slate-700">
      {sidebarOpen && (
        <button
          type="button"
          aria-label={t('app.aria.closeSidebar')}
          className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-white shadow-xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 font-semibold text-white shadow-sm">
            HT
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">HI-TRIP</p>
            <p className="text-xs text-slate-400">{t('app.brand.tagline')}</p>
          </div>
        </div>

        <nav className="flex h-full flex-col gap-6 px-4 py-4 text-sm">
          <div className="flex flex-col gap-1">{navSections.top.map(renderNav)}</div>

          {navSections.pre.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{t('app.nav.preSection')}</p>
              <div className="flex flex-col gap-1">{navSections.pre.map(renderNav)}</div>
            </div>
          )}

          {navSections.mid.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{t('app.nav.midSection')}</p>
              <div className="flex flex-col gap-1">{navSections.mid.map(renderNav)}</div>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-1 border-t border-slate-100 pt-4">{navSections.bottom.map(renderNav)}</div>
        </nav>

        <div className="mt-auto px-6 py-6">
          <div className="rounded-xl border border-slate-200 bg-[#E8F1FF] p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">{t('app.nav.newFeature.title')}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{t('app.nav.newFeature.body')}</p>
          </div>
        </div>
      </aside>

      <div className="flex w-full flex-1 flex-col lg:ml-0">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <LanguageSwitch />
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 lg:hidden"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={t('app.aria.openSidebar')}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">{t('app.header.section')}</p>
              <h1 className="text-lg font-semibold text-slate-900">{currentTitle}</h1>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="hidden max-w-xs flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm transition focus-within:border-primary-200 focus-within:ring-2 focus-within:ring-primary-100 lg:flex">
              <Sparkles className="h-4 w-4 text-primary-500" />
              <input
                type="search"
                placeholder={t('app.header.searchPlaceholder')}
                className="w-full border-none bg-transparent placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <button className="hidden items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 lg:inline-flex">
              <LifeBuoy className="h-4 w-4" />
              {t('app.header.support')}
            </button>
            <button
              className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
              aria-label={t('app.header.notifications')}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500" />
            </button>
            <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm md:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 font-semibold text-white">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-[11px] text-slate-500">{user?.role_display ?? profile?.role_display ?? 'Operations'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutBusy}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm transition hover:border-primary-200 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {logoutBusy ? t('app.header.loggingOut') : t('app.header.logout')}
            </button>
          </div>
        </header>

        {logoutError && (
          <div className="px-6 pt-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
              {logoutError}
            </div>
          </div>
        )}

        <main className="flex-1 px-6 pb-10 pt-8">
          {isProfileFetching && (
            <div className="mx-auto mb-4 max-w-[1320px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
              {t('app.session.checking')}
            </div>
          )}
          <div className="mx-auto max-w-[1320px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
