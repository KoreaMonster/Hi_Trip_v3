'use client';

import { useState } from 'react';
import { getHealth, getProfile, postLogin } from '@/lib/api';
import JsonCard from '@/components/JsonCard';
import { useUserStore } from '@/stores/useUserStore';
import type { HealthResponse, LoginResponse, ProfileResponse } from '@/types/api';

export default function UsersTestPage() {
  const { user, setUser, logout } = useUserStore();
  const [loginRes, setLoginRes] = useState<LoginResponse | null>(null);
  const [profileRes, setProfileRes] = useState<ProfileResponse | null>(null);
  const [healthRes, setHealthRes] = useState<HealthResponse | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const handleLogin = async () => {
    setErr(null);
    try {
      const res = await postLogin({ username: 'demo', password: 'demo1234!' });
      setLoginRes(res);
      setUser(res);
    } catch (e) {
      setErr(e);
    }
  };

  const handleProfile = async () => {
    setErr(null);
    try {
      const res = await getProfile();
      setProfileRes(res);
      setUser(res);
    } catch (e) {
      setErr(e);
    }
  };

  const handleHealth = async () => {
    setErr(null);
    try {
      setHealthRes(await getHealth());
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Test — Users (login / profile)</h1>

      <div className="flex gap-2 flex-wrap">
        <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={handleLogin}>
          POST /api/auth/login/
        </button>
        <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={handleProfile}>
          GET /api/auth/profile/
        </button>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={handleHealth}>
          GET health/
        </button>
        <button className="px-3 py-2 rounded bg-neutral-700 text-white" onClick={logout}>
          로그아웃
        </button>
      </div>

      <JsonCard title="zustand 상태" data={{ user }} />
      <JsonCard title="login 응답" data={loginRes} />
      <JsonCard title="profile 응답" data={profileRes} />
      <JsonCard title="health 응답" data={healthRes} />
      <JsonCard title="에러(있다면)" data={err} />
    </main>
  );
}
