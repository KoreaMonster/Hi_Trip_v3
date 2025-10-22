'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { CheckCircle, Shield, UserPlus } from 'lucide-react';
import { approveStaff } from '@/lib/api';
import { usePendingStaffQuery } from '@/lib/queryHooks';
import { useTranslations } from '@/lib/i18n';
import { useUserStore } from '@/stores/useUserStore';

export default function ApprovalsPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const queryClient = useQueryClient();
  const { data: pending = [], isLoading } = usePendingStaffQuery({ enabled: isSuperAdmin });
  const [approvedIds, setApprovedIds] = useState<number[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const t = useTranslations();

  useEffect(() => {
    if (user && !isSuperAdmin) {
      router.replace('/');
    }
  }, [user, isSuperAdmin, router]);

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-sm font-semibold text-primary-500">{t('approvals.auth.checking')}</p>
        <p className="mt-2 text-sm text-slate-500">{t('approvals.auth.description')}</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-6 text-amber-700 shadow-sm">
          <h1 className="text-xl font-semibold">{t('approvals.accessDenied.title')}</h1>
          <p className="mt-2 text-sm">{t('approvals.accessDenied.description')}</p>
        </section>
      </div>
    );
  }

  const handleApprove = async (id: number) => {
    try {
      setBusyId(id);
      setErrorMessage(null);
      await approveStaff(id);
      setApprovedIds((prev) => [...prev, id]);
      await queryClient.invalidateQueries({ queryKey: ['staff', 'pending'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('approvals.error.generic');
      setErrorMessage(message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">
              {t('approvals.header.badge')}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t('approvals.header.title')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('approvals.header.subtitle')}</p>
          </div>
          <div className="rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-600">
            {t('approvals.header.pendingPrefix')} {pending.length - approvedIds.length}
            {t('approvals.header.pendingUnit')}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('approvals.list.title')}</h2>
            <p className="text-sm text-slate-500">{t('approvals.list.subtitle')}</p>
          </div>
          <Shield className="h-5 w-5 text-primary-500" />
        </div>
        {errorMessage && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {errorMessage}
          </div>
        )}
        <div className="mt-5 space-y-3">
          {isLoading && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {t('approvals.list.loading')}
            </div>
          )}
          {!isLoading && pending.length === 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-600">
              {t('approvals.list.empty')}
            </div>
          )}
          {pending.map((staff) => {
            const isApproved = approvedIds.includes(staff.id);
            return (
              <div
                key={staff.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-[#F9FBFF] p-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{staff.full_name_kr}</p>
                  <p className="text-xs text-slate-500">{staff.role_display} · {staff.email}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t('approvals.list.contactPrefix')} {staff.phone}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                    <UserPlus className="h-3.5 w-3.5" /> {t('approvals.list.newBadge')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApprove(staff.id)}
                    disabled={isApproved || busyId === staff.id}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isApproved
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-600'
                        : 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
                    }`}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {isApproved
                      ? t('approvals.list.action.completed')
                      : busyId === staff.id
                      ? t('approvals.list.action.pending')
                      : t('approvals.list.action.submit')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
