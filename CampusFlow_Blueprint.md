# **DOKUMEN BLUEPRINT SYSTEM & SPESIFIKASI TEKNIS** 

CampusFlow (Single-User PWA Edition) 

## **1. RINGKASAN PROYEK & DESAIN ARSITEKTUR** 

CampusFlow adalah platform manajemen produktivitas mahasiswa yang mencakup pengelolaan Mata Kuliah, Penginputan Tugas, Aktivitas Mahasiswa, serta integrasi Bot Notifikasi Telegram. Aplikasi dirancang dengan pendekatan Progressive Web App (PWA) untuk performa instan di perangkat mobile dan desktop, serta dikembangkan menggunakan arsitektur Zero Overhead agar sangat hemat penggunaan memori (konsumsi RAM < 100 MB). 

### **Rangkaian Teknologi (Tech Stack)** 

- **Frontend UI:** HTML5 + Tailwind CSS (via CDN) 

- **PWA Layer:** Service Worker Engine + Web App Manifest 

- **Client Logic:** Vanilla JavaScript (ES6+) 

- **Backend Runtime:** Node.js + Express.js Framework 

- **Database Engine:** SQLite3 (File-based, Serverless DB) 

- **Job Scheduler:** Node-Cron Engine 

- **Integration API:** Node-Telegram-Bot-API (Telegram HTTP Bot API) 

## **2. ARSITEKTUR PROGRESSIVE WEB APP (PWA)** 

### **Service Worker (sw.js)** 

- **Metode Caching:** Stale-While-Revalidate untuk aset statis (HTML, CSS, JS, Gambar). 

- **Akses Offline:** Memungkinkan UI dibuka tanpa jaringan internet. 

- **API Strategy:** Network First dengan penyimpanan sementara (fallback) saat koneksi terputus. 

### **Web App Manifest (manifest.json)** 

- Mengatur nama aplikasi, ikon launcher, warna tema, serta tampilan standalone (bebas dari address bar browser). 

## **3. DOKUMENTASI DILENGKAPI UML (UNIFIED MODELING LANGUAGE)** 

### **A. Use Case Diagram** 

CampusFlow — Blueprint System & Spesifikasi Teknis 

Halaman 1 

|<br>`┌────────`|`CAMPUSFLOW SYSTEM`<br>`───────────────────────────────┐`|
|---|---|
|`│`<br>`│  (UC-1:`<br>`│`|`│`<br>`Kelola Data Mata Kuliah)      │`<br>`│`|
|<br>`│  (UC-2:`<br>`│`|<br>`Kelola & Monitoring Tugas)    │`<br>`│`|
|<br>`│  (UC-3:`<br>`│`|<br>`Kelola Aktivitas & Agenda)    │`<br>`│`|
|<br>`│  (UC-4:`<br>`│`|<br>`Hubungkan Akun Telegram)      │`<br>`│`|
|<br>`│  (UC-5:`<br>`│`|<br>`Install / Akses PWA)          │`<br>`│`|
|<br>`Mahasiswa ┼────────`<br>`(User)  │`<br>`│  (UC-6:`<br>`│`|<br>`───────────────────────────────┼`<br>`│`<br>`Cek Deadline & Jadwal Auto) ──┼── Cron Engine`<br>`│`|
|<br>`│  (UC-7:`<br>`│`<br>`└────────`|<br>`Kirim Notifikasi Telegram) ───┼── Telegram Bot API`<br>`│`<br>`───────────────────────────────┘`|



### **B. Database Schema / Entity Relationship Diagram (ERD)** 



<!-- Start of picture text -->
 ┌─────────────────────────┐        1:N        ┌─────────────────────────┐<br> │        COURSES          │ ◄─────────────────┤          TASKS          │<br> ├─────────────────────────┤                   ├─────────────────────────┤<br> │ PK  id          INTEGER │                   │ PK  id          INTEGER │<br> │     nama        TEXT    │                   │ FK  course_id   INTEGER │<br> │     dosen       TEXT    │                   │     judul       TEXT    │<br> │     sks         INTEGER │                   │     deadline    DATETIME │<br> │     hari        TEXT    │                   │     prioritas   TEXT    │<br> │     jam_mulai   TEXT    │                   │     status      TEXT    │<br> │     jam_selesai TEXT    │                   │     is_notified INTEGER │<br> └─────────────────────────┘                   └─────────────────────────┘<br> ┌─────────────────────────┐                   ┌─────────────────────────┐<br> │       ACTIVITIES        │                   │        SETTINGS         │<br> ├─────────────────────────┤                   ├─────────────────────────┤<br> │ PK  id          INTEGER │                   │ PK  key         TEXT    │<br> │     nama        TEXT    │                   │     value       TEXT    │<br> │     kategori    TEXT    │                   └─────────────────────────┘<br> │     tanggal     DATETIME │<br> │     lokasi      TEXT    │<br> └─────────────────────────┘<br><!-- End of picture text -->

CampusFlow — Blueprint System & Spesifikasi Teknis 

Halaman 2 

### **C. Sequence Diagram: Engine Notifikasi Otomatis** 

|`[Cron Engine]      [SQLite Database]    [Express Backend]    [Telegram Bot API]    [User Telegram]`<br>`│                    │                    │                     │                    │`<br>`│ (Setiap 15 menit)  │                    │                     │                    │`<br>`│ Jalankan Scheduler │                    │                     │                    │`<br>`│                    │                    │                     │                    │`<br>|
|---|
|`│───────────────────>│                    │                     │                    │`<br>`│ Query Tugas Deadline                    │                     │                    │`<br>`│ (<24 Jam & Notif=0)│                    │                     │                    │`<br>`│                    │                    │                     │                    │`<br>|
|`│<───────────────────│                    │                     │                    │`<br>`│ Return Data Tugas  │                    │                     │                    │`<br>`│                    │                    │                     │                    │`<br>`│ (Jika Ada Tugas)   │                    │                     │                    │`<br>`│────────────────────────────────────────>│                     │                    │`<br>`│                    │                    │ Format Pesan Markdown                    │`<br>`│                    │                    │                     │                    │`<br>|
|`│                    │                    │────────────────────>│                    │`<br>`│                    │                    │ POST /sendMessage   │                    │`<br>`│                    │                    │                     │                    │`<br>|
|`│                    │                    │<────────────────────│───────────────────>│`<br>`│                    │                    │ Status Response 200 │ Push Notification  │`<br>`│                    │                    │                     │ Pesan Terkirim     │`<br>`│                    │                    │                     │                    │`<br>|
|`│───────────────────>│                    │                     │                    │`<br>`│ Update tasks SET   │                    │                     │                    │`<br>`│ is_notified = 1    │                    │                     │                    │`<br>`│ WHERE id = x       │                    │                     │                    │`|



### **D. Activity Diagram: Input Tugas Baru dari PWA Mobile** 

|`[Mahasiswa]                     [PWA F`<br>`│`|`rontend]                    [Express Server / DB]`<br>`│`|
|---|---|
|<br>`├─► Buka Aplikasi PWA`<br>`│   Klik Tombol "+ Tugas" ──────►`<br>`│`<br>`│`<br>`├─► Isi Judul, Matkul, Deadline ►`<br>`│   & Klik "Simpan"`<br>`│`<br>`│`<br>`│`|<br>`│                                    │`<br>`│                                    │`<br>`├─► Tampilkan Form Modal             │`<br>`│   (Dropdown Matkul Auto-Loaded)    │`<br>`│                                    │`<br>`│                                    │`<br>`├─► Validasi Client-side             │`<br>`│   (Cek input tidak boleh kosong)   │`<br>`│`|
|<br>`│`<br>`│`<br>`│`<br>`│`<br>`│`|<br>`├─► Kirim HTTP POST /api/tasks ─────►│`<br>`│                                    ├─► Insert Data ke SQLite`<br>`│                                    ├─► Set is_notified = 0`<br>`│◄── Return Success Status (201) ────┤`<br>`│`|
|<br>`│◄── Tampilkan Toast Notification`<br>`│    & Re-render Daftar Tugas`|<br>`┤                                    │`<br>`│                                    │`|



CampusFlow — Blueprint System & Spesifikasi Teknis 

Halaman 3 

## **4. STRUKTUR DIREKTORI REPOSITORI PROYEK** 

```
campusflow/
├── .env                       # Variabel lingkungan (PORT, TELEGRAM_BOT_TOKEN)
├── server.js                  # Main server entry (Express + SQLite + Cron Job)
├── campusflow.db              # File database SQLite lokal
├── package.json               # Dependensi Node.js & npm scripts
└── public/                    # Root folder aset statis & PWA
    ├── index.html             # Tampilan utama Dashboard SPA
    ├── manifest.json          # Manifest PWA
    ├── sw.js                  # Script Service Worker
    ├── css/
    │   └── styles.css         # Styling kustom tambahan
    ├── js/
    │   ├── app.js             # Logika interaksi UI & konsumsi API
    │   └── pwa-register.js    # Registrasi Service Worker
    └── icons/
        ├── icon-192.png       # Ikon PWA standar
        └── icon-512.png       # Ikon PWA splash screen
```

## **5. PROSEDUR PENGUJIAN DAN VALIDASI (QA)** 

|**Kasus Uji**|**Skenario Pengujian**|**Parameter Keberhasilan**|
|---|---|---|
|**PWA Installability**|Pengujian tombol "Add to Home Screen"<br>di Android/iOS/Chrome.|Aplikasi terpasang sebagai aplikasi<br>mandiri (standalone).|
|**Konsumsi RAM**|Monitoring penggunaan memori server<br>via top / Task Manager.|Penggunaan RAM backend stabil di<br>bawah 80 MB.|
|**Resiliensi Offline**|Pemutusan koneksi internet saat<br>membuka kembali aplikasi.|Antarmuka aplikasi tetap muncul secara<br>instan dari memori cache.|
|**Notifikasi Telegram**|Memasukkan tugas dengan deadline <<br>24 jam.|Bot Telegram berhasil mengirim pesan<br>peringatan tepat waktu.|



CampusFlow — Blueprint System & Spesifikasi Teknis 

Halaman 4 

