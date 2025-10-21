'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { CheckCircle, Shield, UserPlus } from 'lucide-react';
import { approveStaff, createStaff } from '@/lib/api';
import { usePendingStaffQuery } from '@/lib/queryHooks';
import { useUserStore } from '@/stores/useUserStore';
import type { UserCreate } from '@/types/api';

type StaffFormState = {
  username: string;
  email: string;
  password: string;
  phone: string;
  first_name: string;
  last_name: string;
  first_name_kr: string;
  last_name_kr: string;
  role: UserCreate['role'];
};

const initialStaffForm: StaffFormState = {
  username: '',
  email: '',
  password: '',
  phone: '',
  first_name: '',
  last_name: '',
  first_name_kr: '',
  last_name_kr: '',
  role: 'manager',
};

export default function ApprovalsPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const queryClient = useQueryClient();
  const { data: pending = [], isLoading } = usePendingStaffQuery({ enabled: isSuperAdmin });
  const [approvedIds, setApprovedIds] = useState<number[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState<StaffFormState>({ ...initialStaffForm });
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [staffFormSuccess, setStaffFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user && !isSuperAdmin) {
      router.replace('/');
    }
  }, [user, isSuperAdmin, router]);

  const createStaffMutation = useMutation({
    mutationFn: (payload: UserCreate) => createStaff(payload),
    onSuccess: async (created) => {
      setStaffForm({ ...initialStaffForm });
      setStaffFormError(null);
      setStaffFormSuccess(`${created.full_name_kr} 님이 등록되었습니다. 승인 후 사용 가능합니다.`);
      await queryClient.invalidateQueries({ queryKey: ['staff', 'pending'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '직원 등록 중 오류가 발생했습니다.';
      setStaffFormError(message);
    },
  });

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-sm font-semibold text-primary-500">권한 확인 중</p>
        <p className="mt-2 text-sm text-slate-500">승인 센터 접근 권한을 확인하고 있습니다.</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-6 text-amber-700 shadow-sm">
          <h1 className="text-xl font-semibold">접근 권한이 없습니다</h1>
          <p className="mt-2 text-sm">
            승인 요청 관리는 총괄관리자 전용 메뉴입니다. 필요한 경우 운영팀에 권한을 요청해 주세요.
          </p>
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
      const message = error instanceof Error ? error.message : '승인 처리 중 오류가 발생했습니다.';
      setErrorMessage(message);
    } finally {
      setBusyId(null);
    }
  };

  const handleStaffFormChange = (field: keyof StaffFormState) => (value: string) => {
    setStaffForm((prev) => ({ ...prev, [field]: value }));
    if (staffFormSuccess) {
      setStaffFormSuccess(null);
    }
    if (staffFormError) {
      setStaffFormError(null);
    }
  };

  const handleSubmitStaff = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStaffFormError(null);
    setStaffFormSuccess(null);

    if (!staffForm.username.trim()) {
      setStaffFormError('로그인에 사용할 아이디를 입력해 주세요.');
      return;
    }

    if (staffForm.password.length < 8) {
      setStaffFormError('비밀번호는 8자 이상으로 입력해 주세요.');
      return;
    }

    if (!staffForm.first_name_kr.trim() || !staffForm.last_name_kr.trim()) {
      setStaffFormError('직원의 한글 이름과 성을 모두 입력해 주세요.');
      return;
    }

    if (!staffForm.phone.trim()) {
      setStaffFormError('연락처를 입력해 주세요.');
      return;
    }

    const payload: UserCreate = {
      username: staffForm.username.trim(),
      email: staffForm.email.trim(),
      password: staffForm.password,
      phone: staffForm.phone.trim(),
      first_name: staffForm.first_name.trim(),
      last_name: staffForm.last_name.trim(),
      first_name_kr: staffForm.first_name_kr.trim(),
      last_name_kr: staffForm.last_name_kr.trim(),
      role: staffForm.role,
    };

    createStaffMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">승인 센터</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">직원 계정 승인</h1>
            <p className="mt-1 text-sm text-slate-500">신규 등록된 직원 계정을 확인하고 권한을 부여하세요.</p>
          </div>
          <div className="rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-600">
            대기 {pending.length - approvedIds.length}명
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">직원 등록</h2>
            <p className="text-sm text-slate-500">회원가입 양식을 작성해 신규 직원을 추가하고 승인 목록에 올려 주세요.</p>
          </div>
          {staffFormSuccess && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">{staffFormSuccess}</span>
          )}
        </div>

        {staffFormError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {staffFormError}
          </div>
        )}

        <form className="mt-5 space-y-5" onSubmit={handleSubmitStaff}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="staff-last-name-kr" className="text-sm font-semibold text-slate-700">
                한글 성
              </label>
              <input
                id="staff-last-name-kr"
                value={staffForm.last_name_kr}
                onChange={(event) => handleStaffFormChange('last_name_kr')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="예: 김"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="staff-first-name-kr" className="text-sm font-semibold text-slate-700">
                한글 이름
              </label>
              <input
                id="staff-first-name-kr"
                value={staffForm.first_name_kr}
                onChange={(event) => handleStaffFormChange('first_name_kr')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="예: 하늘"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="staff-last-name" className="text-sm font-semibold text-slate-700">
                영문 성 (선택)
              </label>
              <input
                id="staff-last-name"
                value={staffForm.last_name}
                onChange={(event) => handleStaffFormChange('last_name')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="예: KIM"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="staff-first-name" className="text-sm font-semibold text-slate-700">
                영문 이름 (선택)
              </label>
              <input
                id="staff-first-name"
                value={staffForm.first_name}
                onChange={(event) => handleStaffFormChange('first_name')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="예: HANEUL"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="staff-username" className="text-sm font-semibold text-slate-700">
                아이디
              </label>
              <input
                id="staff-username"
                value={staffForm.username}
                onChange={(event) => handleStaffFormChange('username')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="예: manager01"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="staff-password" className="text-sm font-semibold text-slate-700">
                비밀번호
              </label>
              <input
                id="staff-password"
                type="password"
                value={staffForm.password}
                onChange={(event) => handleStaffFormChange('password')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="최소 8자"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="staff-email" className="text-sm font-semibold text-slate-700">
                이메일 (선택)
              </label>
              <input
                id="staff-email"
                type="email"
                value={staffForm.email}
                onChange={(event) => handleStaffFormChange('email')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="예: manager@hi-trip.io"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="staff-phone" className="text-sm font-semibold text-slate-700">
                연락처
              </label>
              <input
                id="staff-phone"
                value={staffForm.phone}
                onChange={(event) => handleStaffFormChange('phone')(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="예: 010-1234-5678"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
            <label className="font-semibold" htmlFor="staff-role">
              역할 지정
            </label>
            <select
              id="staff-role"
              value={staffForm.role}
              onChange={(event) => handleStaffFormChange('role')(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100 md:w-52"
            >
              <option value="manager">담당자</option>
              <option value="super_admin">총괄담당자</option>
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="reset"
              onClick={() => {
                setStaffForm({ ...initialStaffForm });
                setStaffFormError(null);
                setStaffFormSuccess(null);
              }}
              className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
            >
              초기화
            </button>
            <button
              type="submit"
              disabled={createStaffMutation.isLoading}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createStaffMutation.isLoading ? '등록 중...' : '직원 등록'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">승인 요청 목록</h2>
            <p className="text-sm text-slate-500">역할과 연락처를 확인한 후 승인을 진행하세요.</p>
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
              승인 요청을 불러오는 중입니다.
            </div>
          )}
          {!isLoading && pending.length === 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-600">
              승인 대기 중인 직원이 없습니다.
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
                  <p className="mt-1 text-xs text-slate-400">연락처 {staff.phone}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                    <UserPlus className="h-3.5 w-3.5" /> 신규 등록
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
                    {isApproved ? '승인 완료' : busyId === staff.id ? '승인 중...' : '승인하기'}
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
