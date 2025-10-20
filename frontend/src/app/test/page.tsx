'use client';

import Link from 'next/link';

export default function TestHome() {
  const items = [
    { href: '/test/users', label: 'Users (login/profile)' },
    { href: '/test/trips', label: 'Trips (list/create/participants)' },
    { href: '/test/schedules', label: 'Schedules (list/create)' },
    { href: '/test/monitoring', label: 'Monitoring (list/detail/action)' },
  ];

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Test Hub</h1>
        <p className="text-sm text-neutral-500">
          아래 버튼을 눌러 각 API 테스트 화면으로 이동하세요.
        </p>
      </header>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="block rounded-lg border border-neutral-200 px-4 py-3 hover:border-neutral-400 hover:bg-neutral-50 transition"
            >
              <span className="font-medium">{it.label}</span>
              <div className="text-xs text-neutral-500">{it.href}</div>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="pt-4 border-t text-xs text-neutral-500">
        필요한 테스트가 더 있다면 이 페이지에 버튼을 추가하면 됩니다.
      </footer>
    </main>
  );
}