'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  Settings,
  Sparkles,
  UserCircle2,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { postLogout } from '@/lib/api';
import { ApiError } from '@/lib/http';
import { useProfileQuery } from '@/lib/queryHooks';
import { useUserStore } from '@/stores/useUserStore';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/trips', label: '여행 관리', icon: MapPin },
  { href: '/schedules', label: '일정', icon: CalendarDays },
  { href: '/participants', label: '참가자', icon: Users },
  { href: '/monitoring', label: '모니터링', icon: Workflow },
  { href: '/places', label: '장소 관리', icon: Compass },
  { href: '/customers', label: '고객 관리', icon: UserCircle2 },
  { href: '/checklists', label: '체크리스트', icon: ClipboardCheck },
  { href: '/approvals', label: '승인 요청', icon: ListChecks },
  { href: '/settings', label: '설정', icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
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
    if (profile) {
      setUser(profile);
      setAuthError(null);
    }
  }, [profile, setUser]);

  useEffect(() => {
    if (!isProfileError) {
      return;
    }

    const apiError = profileError instanceof ApiError ? profileError : null;
    if (apiError?.status === 401) {
      clearUser();
      router.replace('/login');
      return;
    }

    setAuthError(profileError?.message ?? '사용자 정보를 불러오지 못했습니다.');
  }, [isProfileError, profileError, clearUser, router]);

  const initials = useMemo(() => {
    const name = user?.full_name_kr ?? profile?.full_name_kr ?? '';
    if (!name) return 'HT';
    const compact = name.replace(/\s+/g, '');
    if (compact.length >= 2) {
      return compact.slice(-2);
    }
    return compact.charAt(0).toUpperCase();
  }, [profile?.full_name_kr, user?.full_name_kr]);

  const currentTitle = useMemo(() => {
    const matched = NAV_ITEMS.find((item) =>
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
    );
    return matched?.label ?? 'HI-TRIP 운영센터';
  }, [pathname]);

  const renderNav = (item: NavItem) => {
    const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
        <span>{item.label}</span>
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
      const message = error instanceof Error ? error.message : '로그아웃 처리 중 오류가 발생했습니다.';
      setLogoutError(message);
    } finally {
      setLogoutBusy(false);
    }
  };

  if (isProfileLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F9FC] text-slate-500">
        <div className="rounded-3xl border border-slate-200 bg-white px-10 py-12 text-center shadow-xl">
          <p className="text-sm font-semibold text-primary-500">HI-TRIP</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">사용자 정보를 불러오는 중입니다.</p>
          <p className="mt-2 text-sm text-slate-500">잠시만 기다려 주세요.</p>
        </div>
      </div>
    );
  }

  if (authError && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F9FC] px-6 py-12 text-slate-600">
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white px-8 py-10 text-center shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-500">접속 오류</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">운영 센터에 연결하지 못했습니다</h1>
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
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
            >
              로그인 화면으로 이동
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
          aria-label="사이드바 닫기"
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
            <p className="text-xs text-slate-400">여행 운영 플랫폼</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-4 py-4 text-sm">{NAV_ITEMS.map(renderNav)}</nav>

        <div className="mt-auto px-6 py-6">
          <div className="rounded-xl border border-slate-200 bg-[#E8F1FF] p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">신규 기능 안내</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              팀 협업을 위한 실시간 편집 기능이 곧 업데이트 됩니다. 알림을 켜고 가장 먼저 받아보세요!
            </p>
          </div>
        </div>
      </aside>

      <div className="flex w-full flex-1 flex-col lg:ml-0">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 lg:hidden"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="사이드바 열기"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">운영 센터</p>
              <h1 className="text-lg font-semibold text-slate-900">{currentTitle}</h1>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="hidden max-w-xs flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm transition focus-within:border-primary-200 focus-within:ring-2 focus-within:ring-primary-100 lg:flex">
              <Sparkles className="h-4 w-4 text-primary-500" />
              <input
                type="search"
                placeholder="여행, 고객, 일정 검색"
                className="w-full border-none bg-transparent placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <button className="hidden items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 lg:inline-flex">
              <LifeBuoy className="h-4 w-4" />
              지원 요청
            </button>
            <button className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-primary-200 hover:text-primary-600">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500" />
            </button>
            <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm md:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 font-semibold text-white">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{user?.full_name_kr ?? profile?.full_name_kr ?? '운영자'}</p>
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
              {logoutBusy ? '로그아웃 중...' : '로그아웃'}
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
              사용자 세션을 확인하는 중입니다...
            </div>
          )}
          <div className="mx-auto max-w-[1320px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
