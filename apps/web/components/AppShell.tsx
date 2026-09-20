'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearAuth, getStoredUser, getAccessToken } from '@/lib/auth';
import { OfflineBanner } from './OfflineBanner';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/courses', label: 'Mata Kuliah' },
  { href: '/schedules', label: 'Jadwal' },
  { href: '/tasks', label: 'Tugas' },
  { href: '/reminders', label: 'Pengingat' },
  { href: '/notifications', label: 'Notifikasi' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    async function fetchUnread() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/notifications?unreadOnly=true`,
          {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
            cache: 'no-store',
          },
        );
        if (res.ok) {
          const list = (await res.json()) as unknown[];
          setUnread(list.length);
        }
      } catch {
        // abaikan — badge hanya info tambahan
      }
    }
    fetchUnread();
    const timer = setInterval(fetchUnread, 60000);
    return () => clearInterval(timer);
  }, [router]);

  const user = getStoredUser();

  const NAV = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/courses', label: 'Mata Kuliah' },
    { href: '/schedules', label: 'Jadwal' },
    { href: '/tasks', label: 'Tugas' },
    { href: '/reminders', label: 'Pengingat' },
    { href: '/notifications', label: 'Notifikasi' },
    ...(user?.role === 'ADMIN'
      ? [{ href: '/admin', label: 'Admin' }]
      : []),
  ];

  function handleLogout() {
    clearAuth();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">
            CF
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">CampusFlow</div>
            <div className="text-xs text-gray-500">Schedule & Task Manager</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.label}
                {item.href === '/notifications' && unread > 0 && (
                  <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4">
          {user && (
            <div className="mb-3">
              <div className="text-sm font-semibold text-gray-800">
                {user.nama}
              </div>
              <div className="text-xs text-gray-500">
                {user.nim} · {user.prodi ?? '—'}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className="ml-60 p-8">
        <OfflineBanner />
        {children}
      </main>
    </div>
  );
}