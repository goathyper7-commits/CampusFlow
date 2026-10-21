import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <Image
            src="/icons/icon-192.png"
            alt="Logo CampusFlow"
            width={64}
            height={64}
            priority
            className="mx-auto mb-3 h-16 w-16 rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl font-bold">CampusFlow</h1>
          <p className="text-sm text-indigo-100">
            Student Schedule & Task Management System
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-indigo-200">
          Moch. Fajrul Falah · NIM 60225095
        </p>
      </div>
    </div>
  );
}