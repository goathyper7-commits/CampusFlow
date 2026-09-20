# CampusFlow — Student Schedule & Task Management System

Sistem manajemen jadwal kuliah, tugas, dan deadline mahasiswa berbasis **Progressive Web App (PWA)**, pola arsitektur **Modular Monolith** siap dipecah ke microservices.

> Blueprint: Moch. Fajrul Falah — NIM 60225095

## Status Proyek

**Fase 1 — MVP** (selesai) ✓

- [x] Monorepo (pnpm workspace): `apps/web` + `apps/api` + `packages/database` + `packages/shared-types`
- [x] Skema Prisma lengkap (User, Course, Schedule, Task, SubTask, TaskGroup, Activity, Reminder, Notification, Attachment, Comment, AuditLog)
- [x] API Auth (register, login, refresh-token, me) — JWT access 15m / refresh 7d (HTTP-only cookie), bcrypt
- [x] API CRUD Course & Schedule (+ deteksi jadwal bentrok)
- [x] API Task CRUD + status + subtask
- [x] API Dashboard summary
- [x] Web UI: Login/Register, Dashboard, Mata Kuliah, Jadwal, Tugas

**Fase 2** (selesai) ✓

- [x] Reminder engine (BullMQ + Redis): delayed job per reminder + repeatable sweep job; worker mengubah `Reminder` menjadi `Notification` (dedup via unique `reminderId`)
- [x] API Reminder CRUD + sinkronisasi otomatis saat tugas dibuat/diubah/dihapus/mark-selesai
- [x] API Notifikasi (list, unread-only, mark read, read-all, clear)
- [x] Web UI: Pengingat + Notifikasi (filter unread, mark read, badge unread di sidebar)
- [x] PWA offline (next-pwa + Workbox): service worker, manifest, ikon, cache GET API (NetworkFirst), snapshot IndexedDB saat offline + banner indikator + outbox offline (mutasi ditunda saat putus koneksi)
- [x] Dashboard Recharts: donut distribusi status tugas + bar chart jadwal per hari
- [x] Push notification **Web Push (VAPID)** (bukan FCM — pilihan implementasi; endpoint identik: register subscription, kirim ke device yang terdaftar)

**Fase 3 — Admin & Audit** (selesai) ✓

- [x] Model `AuditLog` + seed admin (`admin@campusflow.local` / `Admin123!`, NIM `ADMIN001`)
- [x] RolesGuard (`@Roles('ADMIN')`) global + modul admin: rekap, daftar pengguna, audit trail, ubah role, hapus pengguna
- [x] UI Admin di web (guard role, rekap, kelola pengguna, audit log)

**Fase 4 — Kolaborasi & Kalender** (selesai) ✓

- [x] Aktivitas harian + kolaborasi grup tugas (buat grup, tambah/keluarkan anggota, keluar/bubarkan)
- [x] Komentar diskusi pada tugas (thread, akses dibatasi anggota/ADMIN, hapus sendiri)
- [x] Lampiran file pada tugas (unggah 5 MB, unduh, hapus)
- [x] Kalender bulanan (FullCalendar v6) menampilkan jadwal kuliah + konflik

**Fase 5 — Pengujian** (selesai) ✓

- [x] Jest unit (`apps/api/test/unit`): format pesan reminder, validitas custom jobId BullMQ
- [x] Supertest e2e (`apps/api/test/app.e2e-spec.ts`): auth, profil, course/task CRUD, preferensi notif, admin 403, komentar, lampiran
- [x] Reminder engine **teruji live**: delayed job → Notification `REMINDER` dibuat, `Reminder.isSent = true`; tugas yang di-mark `SELESAI` tidak menghasilkan notifikasi
- [x] Skrip load test k6 (`apps/api/test/load/campusflow.k6.js`) — siap dijalankan bila k6 tersedia di mesin
- [x] `pnpm typecheck` seluruh workspace : hijau; `next build` produksi: hijau (custom worker + sw.js ter-bundle)

**Di luar lingkup / catatan**
- Google Calendar sync tidak diimplementasikan (butuh OAuth + project Google Cloud di lingkungan produksi).
- Test k6 tidak dieksekusi di lingkungan dev ini karena binary k6 tidak tersedia (tanpa download).
- Deployment container (Dockerfile, Nginx) belum dieksekusi di lingkungan dev (tanpa Docker); config sudah ditulis ulang agar sesuai monorepo pnpm.

## Struktur

```
campusflow/
├── apps/
│   ├── web/                # Next.js 14 — PWA frontend
│   └── api/                # NestJS 10 — REST API
├── packages/
│   ├── database/           # Prisma schema (shared) + seed
│   ├── shared-types/       # Type/DTO bersama FE & BE
│   └── dev-infra/          # PostgreSQL 16 + Redis (Memurai) embedded (tanpa Docker)
├── docker-compose.yml      # Produksi
├── docker-compose.dev.yml  # PostgreSQL + Redis lokal
└── .github/workflows/ci.yml
```

## Menjalankan Lokal

Prasyarat: Node.js ≥ 20, pnpm ≥ 9.

```powershell
pnpm install

# 1) Infrastruktur PG + Redis
# Buat Scheduled Task Windows "campusflow-infra" (jalankan scripts/infra-start.cmd),
# atau: pnpm dev:infra  di terminal berdiri sendiri.
Start-ScheduledTask -TaskName "campusflow-infra"   # restart kapan pun perlu

# 2) Generate Prisma client + seed admin (sekali)
pnpm db:generate
pnpm db:seed

# 3) Jalankan dev
pnpm dev:api    # http://localhost:3001/api  (baca .env dari apps/api)
pnpm dev:web    # http://localhost:3000
```

Catatan: di lingkungan agent CLI, proses yang di-spawn ikut mati saat perintah selesai — jalankan API/Web di terminal terpisah, infra dijadwalkan via Scheduled Task agar persisten.

## Deployment (Docker)

Dockerfile memakai **pnpm via corepack** (`--frozen-lockfile --ignore-scripts`); stack produksi di `docker-compose.yml`: PostgreSQL 16 + Redis 7 (healthcheck) → API → Web → Nginx di port 80/443.

```powershell
# 1) Siapkan apps/api/.env (contoh: apps/api/.env.example) — wajib berisi
#    JWT_SECRET, JWT_REFRESH_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, etc.
#    (POSTGRES_PASSWORD opsional, default "campusflow")
#    Push notification: taruh NEXT_PUBLIC_VAPID_PUBLIC_KEY di .env ROOT proyek
#    (dibaca compose untuk build-arg web) lalu build dengan
#    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY.

# 2) Build & jalankan
docker compose up --build -d

# 3) Opsional: seed admin sekali — set RUN_SEED=true di .env (atau
#    environment compose), maka entrypoint API otomatis menjalankan
#    prisma migrate deploy + seed setiap container start.
#    docker compose up -d --build api
```

Cara kerja: entrypoint API (`apps/api/docker-entrypoint.sh`) menjalankan `prisma migrate deploy` (dan seed bila `RUN_SEED=true`) sebelum `node dist/main.js`; web di-build dengan `NEXT_PUBLIC_API_URL=/api` (same-origin, diproksi Nginx). File upload (`uploads/`) dipersistenkan di volume `uploads`. TLS: tambahkan blok `listen 443 ssl` di `nginx/nginx.conf` (mount sertifikat).

## Endpoint API

```
POST /api/auth/register | login | refresh-token
GET/PATCH /api/users/me

GET/POST     /api/courses          PUT/DELETE /api/courses/:id
GET/POST     /api/schedules        GET /api/schedules/conflict-check
PUT/DELETE   /api/schedules/:id
GET/POST     /api/tasks            (?status=&courseId=)
PUT/DELETE   /api/tasks/:id        PATCH /api/tasks/:id/status
POST/PATCH/DELETE /api/tasks/:id/subtasks(/:subtaskId)
POST/GET     /api/tasks/:id/attachments   DELETE /api/attachments/:id
GET          /api/attachments/:id/file

GET/POST     /api/comments         PATCH/DELETE /api/comments/:id   (GET ?taskId=)
GET/POST     /api/groups           POST /api/groups/:id/members | leave
DELETE       /api/groups/:id/members/:memberId | /api/groups/:id

GET/POST        /api/reminders     PATCH/DELETE /api/reminders/:id
GET/POST        /api/activities    PUT/DELETE /api/activities/:id
GET     /api/notifications         (?unreadOnly=true)
PATCH   /api/notifications/:id/read | /api/notifications/read-all
DELETE  /api/notifications         POST/DELETE /api/notifications/subscriptions
GET/PATCH /api/notifications/preferences

GET /api/dashboard/summary
GET /api/health

# Admin (role ADMIN)
GET     /api/admin/summary | /api/admin/users | /api/admin/audit
PATCH   /api/admin/users/:id/role   DELETE /api/admin/users/:id
```

## Reminder Engine

1. `POST /api/reminders` membuat baris `Reminder` dengan `scheduledAt = deadline − offsetHours` (1–8760 jam), lalu menjadwalkan **delayed job** (`fire`) di queue BullMQ `reminders`.
2. Job `fire` menulis `Notification` (tipe `REMINDER`) dan menandai `Reminder.isSent = true`; duplikasi dicegah lewat unique `reminderId` (balapan → `P2002` diabaikan).
3. **Repeatable sweep job** (`reminders-sweep`, tiap 60 detik) menjamin reminder tidak terlewat (misal Redis sempat mati).
4. Perubahan task (deadline, status `SELESAI`, hapus) otomatis menyinkronkan/menghentikan job via `TasksService → RemindersService.syncTask/unscheduleTask`.
5. Catatan penting: **custom jobId BullMQ tidak boleh mengandung `:`** (keyword Redis) — gunakan `reminder-${uuid}` / `reminders-sweep`.

## PWA Offline

- **Service worker** (`public/sw.js`) dibangun `next-pwa` saat `next build` (di-skip saat development) + **custom worker** (`worker/index.js`) untuk push & background sync.
- **Manifest** + ikon `192/512` → app bisa di-install (standalone).
- **Runtime caching Workbox**: navigasi + respons GET `*/api/*` memakai `NetworkFirst`.
- **IndexedDB** (`lib/offline.ts`): snapshot GET per-route; saat offline halaman memakai snapshot + banner "Mode offline"; mutasi ditulis ke **outbox** dan disinkronkan ulang (`requestOutboxSync`) saat koneksi pulih.

## Pengujian

```powershell
pnpm test:unit            # Jest unit (apps/api/test/unit)
pnpm test:e2e             # Supertest e2e — butuh PG+Redis aktif
pnpm typecheck            # tsc seluruh workspace
k6 run apps/api/test/load/campusflow.k6.js   # load test (k6 terpasang)
```