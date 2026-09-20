import type { ReactNode } from 'react';

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {title && (
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent ${className}`}
    />
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
      <Spinner /> Memuat data...
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-sm text-gray-400">{text}</div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  BELUM_DIKERJAKAN: 'bg-gray-100 text-gray-700',
  DIKERJAKAN: 'bg-blue-100 text-blue-700',
  SELESAI: 'bg-emerald-100 text-emerald-700',
  TERLAMBAT: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

const PRIORITAS_STYLES: Record<string, string> = {
  RENDAH: 'bg-slate-100 text-slate-600',
  SEDANG: 'bg-amber-100 text-amber-700',
  TINGGI: 'bg-orange-100 text-orange-700',
};

export function PrioritasBadge({ prioritas }: { prioritas: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITAS_STYLES[prioritas] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {prioritas}
    </span>
  );
}