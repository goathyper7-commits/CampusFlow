# AGENTS.md — Panduan kerja untuk agent

## Prioritas kecepatan
- Eksekusi dulu, jelaskan belakangan (ringkas). Jangan tulis rencana panjang sebelum coding kalau tugasnya sudah jelas.
- Jangan minta izin untuk perubahan kecil dan reversibel (format, rename lokal, import, typo). Minta izin hanya untuk: hapus file, ubah skema database, ubah dependency besar, atau perubahan yang menyentuh data produksi.
- Baca file secukupnya — jangan `ls -R` seluruh repo atau baca file yang tidak relevan dengan task.
- Kalau task melibatkan banyak file serupa (misalnya ganti nama fungsi di 10 file), lakukan sekaligus lewat pencarian & ganti masal, bukan satu per satu dengan laporan di tiap file.
- Jangan jalankan test/build penuh di setiap langkah kecil — jalankan sekali di akhir, kecuali diminta.

## Gaya komunikasi
- Ringkas laporan akhir: apa yang diubah, file mana, dan cara mengujinya. Maksimal beberapa baris.
- Jangan ulangi kode yang sudah terlihat di diff/patch.
- Kalau ada ambiguitas kecil, pilih asumsi paling masuk akal dan lanjut; sebutkan asumsinya satu baris saja.

## Konteks proyek
- Repo: `campusflow/` — monorepo pnpm workspace (`apps/web` Next.js 14 + `apps/api` NestJS 10 + `packages/database` Prisma + `packages/shared-types` + `packages/dev-infra`).
- Port: web 3000, api 3001 (/api). DB: PostgreSQL 16 (embedded via `pnpm dev:infra`, port 5432, user campusflow), Redis (Memurai via dev:infra, port 6379) untuk BullMQ reminder.
- Stack: Next.js 14 (App Router), React 18, Tailwind (custom ui.tsx — bukan shadcn; komponen UI ada di apps/web/components/ui.tsx), Zustand (state), RHF+Zod (form), FullCalendar, Recharts, Dexie (offline). Backend NestJS modular monolith, Prisma ORM, JWT (access 15m + refresh 7d di HTTP-only cookie), bcryptjs. Testing: Jest (unit) + Supertest (e2e), k6 (load).
- Menjalankan: `pnpm dev:infra` (PG+Redis) → `pnpm db:generate && pnpm db:migrate` → `pnpm dev:api` + `pnpm dev:web`. Tes: `pnpm test:unit`, `pnpm test:e2e`.
- Style: TypeScript strict, class-validator untuk DTO backend, komentar code dilarang.
- Hal yang TIDAK boleh diubah tanpa izin: file `.env` yang berisi secret, konfigurasi deploy produksi, dan model Prisma di luar scope task yang sedang aktif.