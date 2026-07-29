# 📘 BLUEPRINT BACKEND NAGARISDLC (v2 — Panduan Implementasi)
Laravel 11 REST API + WebSocket Real-time

> Dokumen ini adalah revisi dari draft awal Anda. Struktur lama dipertahankan, tapi ditambahkan: **state machine workflow**, **matrix approval per role**, tabel database yang terlewat, endpoint yang belum ada, dan **roadmap implementasi bertahap**. Gunakan dokumen ini sebagai satu-satunya acuan — kalau ada keputusan desain baru saat coding, update dulu dokumen ini sebelum lanjut, supaya tidak drift dari rencana.

---

## 0. CARA MEMAKAI DOKUMEN INI

- Kerjakan sesuai urutan **Bagian 14 (Roadmap Bertahap)** — jangan loncat ke fitur lain sebelum fase sebelumnya jalan dan ada testnya.
- **Bagian 5 (State Machine)** adalah sumber kebenaran untuk semua logic status. Kalau controller Anda melakukan perubahan status yang tidak ada di tabel transisi, itu tandanya ada yang salah — perbaiki di sini dulu.
- Setiap kali menambah field/tabel baru saat implementasi, catat di Bagian 3 supaya dokumen tetap sinkron dengan kode.

---

## 1. PENDAHULUAN & ARSITEKTUR

### 1.1 Teknologi Stack

| Layer | Teknologi | Versi | Keterangan |
|---|---|---|---|
| Backend Framework | Laravel | 11.x | REST API + WebSocket |
| Database | MySQL | 8.0+ | Sesuaikan dengan standar infra Bank Nagari |
| Autentikasi | Laravel Sanctum | 4.x | Token-based authentication |
| Real-time | Laravel Reverb | 1.x | WebSocket notifikasi & chat |
| Queue | Database Driver (dev) → Redis (prod) | - | Email & background job |
| Storage | Laravel Filesystem | Local (dev) / S3 (prod) | Upload dokumen |
| Caching | File (dev) / Redis (prod) | - | Session & rate limiting |
| Testing | Pest | - | Unit & Feature testing |

**Catatan produksi:** karena ini sistem internal bank, defaultnya asumsikan server **tidak boleh akses internet publik** — berarti AWS S3 tidak bisa dipakai. Dua opsi realistis:

- **`FILESYSTEM_DISK=local`** — cukup kalau aplikasi hanya jalan di satu server. Paling sederhana, mulai dari sini.
- **MinIO on-premise** (API-compatible dengan S3) — kalau ada rencana multi-server/load balancer di masa depan. Karena API-nya sama dengan S3, kode Laravel pakai driver `s3` tapi `endpoint` diarahkan ke MinIO internal — jadi kalau infra berubah nanti, cukup ganti `.env`, tidak perlu ubah kode `FileUploadService`.

Konfirmasi ke tim infra Bank Nagari sebelum Fase 6 (Dokumen) di roadmap, supaya keputusan ini tidak menggantung sampai akhir.

### 1.2 Arsitektur Sistem

Sama seperti draft awal (Client React → Laravel API+Reverb+Storage → MySQL), dengan tambahan **API versioning** (`/api/v1/...`) agar breaking change di masa depan tidak merusak frontend yang sudah jalan.

### 1.3 Prinsip Pengembangan

Sama seperti draft awal, ditambah:

| Prinsip | Keterangan |
|---|---|
| Single Source of Truth Status | Semua perubahan status proyek **wajib** lewat satu service class (`ProjectWorkflowService`), tidak boleh update kolom `status` langsung dari controller manapun. |
| Idempotent Transition | Setiap transisi status dicek dulu validitasnya lewat state machine sebelum dieksekusi (lihat Bagian 5). |
| Fail Loud di Dev, Fail Safe di Prod | `APP_DEBUG=true` hanya di lokal; response error di production tidak boleh bocorkan stack trace. |

---

## 2. ENVIRONMENT & SETUP

Environment variables sama seperti draft awal. Tambahan yang perlu ada sejak awal (banyak proyek baru sadar butuh ini setelah production, padahal harus direncanakan dari hari pertama):

```env
# SECURITY
BCRYPT_ROUNDS=12
SESSION_ENCRYPT=true
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15

# LOGGING
LOG_CHANNEL=daily
LOG_LEVEL=info
LOG_DAYS_RETENTION=90

# FILE UPLOAD
MAX_UPLOAD_SIZE_MB=10
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,png,jpg

# HEALTH CHECK
HEALTH_CHECK_TOKEN=
```

Struktur folder Laravel: **sama seperti draft awal**, tambahkan:
- `app/Services/ProjectWorkflowService.php` — satu-satunya tempat logic transisi status.
- `app/Services/FileUploadService.php` (sudah ada di draft, dipertahankan).
- `app/Enums/ProjectStatus.php`, `app/Enums/UserRole.php` — pakai native PHP Enum (Laravel 11 support penuh), lebih aman daripada string mentah tersebar di banyak file.
- `app/Http/Resources/` — untuk API Resource classes (transformasi response JSON konsisten, draft awal belum menyebut ini sama sekali padahal penting untuk response format yang konsisten).

---

## 3. DATABASE SCHEMA (LENGKAP)

Tabel 3.1–3.12 dari draft awal **dipertahankan seluruhnya** (roles, divisions, users, projects, project_tasks, project_team_members, test_reports, release_requests, document_vaults, audit_trails, notifications, chat_messages). Berikut perbaikan dan tambahan:

### 3.13 Perbaikan pada tabel `projects`

- **Bug race condition pada `req_id`:** generate nomor urut dengan `lockForUpdate()` di dalam DB transaction, bukan hanya `orderBy desc first()`. Dua request bersamaan bisa dapat nomor yang sama kalau tidak dikunci.

```php
DB::transaction(function () use ($model) {
    $year = date('Y');
    $last = self::where('req_id', 'like', "REQ-{$year}-%")
        ->lockForUpdate()
        ->orderBy('req_id', 'desc')
        ->first();
    $number = $last ? intval(substr($last->req_id, -3)) + 1 : 1;
    $model->req_id = "REQ-{$year}-" . str_pad($number, 3, '0', STR_PAD_LEFT);
});
```

- Tambah kolom `current_stage_deadline` (date, nullable) — deadline untuk tahap yang sedang berjalan (dipakai untuk reminder notifikasi, beda dengan `target_date` yang deadline keseluruhan proyek).

### 3.14 Tabel baru: `project_status_histories` (WAJIB ADA)

Draft awal hanya mengandalkan `audit_trails` generik untuk melacak histori status. Untuk fitur timeline proyek (yang hampir pasti dibutuhkan FE), butuh tabel khusus:

| Kolom | Tipe | Deskripsi |
|---|---|---|
| id | bigIncrements | Primary key |
| project_id | foreignId | Foreign ke projects |
| from_status | string(50) | nullable — status sebelumnya |
| to_status | string(50) | Status baru |
| changed_by | foreignId | Foreign ke users |
| notes | text | nullable — catatan/alasan |
| created_at | timestamp | Timestamp |

Ini yang dipakai untuk render timeline "Riwayat Proyek" di FE, dan jauh lebih cepat di-query dibanding parsing `audit_trails.new_values` JSON.

### 3.15 Tabel bawaan Laravel yang wajib disiapkan (sering terlewat)

| Tabel | Sumber | Keterangan |
|---|---|---|
| `password_reset_tokens` | Laravel default migration | Wajib untuk endpoint `/forgot-password` & `/reset-password` yang sudah Anda rencanakan |
| `personal_access_tokens` | `php artisan install:api` (Sanctum) | Wajib untuk token auth |
| `jobs`, `job_batches`, `failed_jobs` | `php artisan queue:table` | Wajib karena `QUEUE_CONNECTION=database` |
| `cache`, `cache_locks` | Jika `CACHE_DRIVER=database` | Opsional jika pakai file/redis |

### 3.16 Perbaikan `document_vaults.file_size`

Ubah dari `string(20)` jadi `unsignedBigInteger` (simpan dalam byte), lalu format ke human-readable (`"2.4 MB"`) di API Resource, bukan di database. Ini supaya bisa di-sort/filter berdasarkan ukuran file kalau nanti dibutuhkan.

---

## 4. WORKFLOW / STATE MACHINE PROYEK (BAGIAN PALING PENTING)

Ini yang tidak ada di draft awal Anda, padahal ini adalah inti bisnis sistem NagariSDLC. Tanpa tabel ini, tim development akan menebak-nebak alur status.

### 4.1 Diagram Alur Utama

```
PENDING
  → IN_REVIEW (lead_group)
    → ANALYSIS_APPROVED (analyst) atau REJECTED (lead_group/analyst)
      → READY_FOR_DEVELOPMENT (development_lead assign PM)
        → DEV_ANALYSIS (analyst internal dev)
          → DEV_ANALYSIS_DONE
            → IN_DEVELOPMENT (developer mengerjakan task)
              → READY_FOR_QA (PM ajukan QA)
                → QA_IN_PROGRESS (qa_lead assign tester)
                  → RETURN_TO_DEV (qa_tester result: fail) → kembali ke IN_DEVELOPMENT
                  → QA_PASSED (qa_tester result: pass)
                    → CYBER_IN_PROGRESS (cyber_lead assign pentester)
                      → CYBER_PASSED (pentester result: pass)
                        → READY_FOR_UAT (PM submit uat_notes)
                          → UAT_PASSED (business_user konfirmasi)
                            → PENDING_GOLIVE (PM ajukan release_request)
                              → LIVE_PRODUCTION (head_of_it approve quality gate)

Status non-linear (bisa terjadi dari banyak titik):
  ON_HOLD  ← dari status manapun sebelum LIVE_PRODUCTION (alasan wajib diisi)
  CANCELLED ← dari status manapun sebelum LIVE_PRODUCTION (alasan wajib diisi)
```

### 4.2 Tabel Transisi Status (Sumber Kebenaran)

| Status Saat Ini | Bisa Pindah Ke | Role yang Boleh Trigger | Field Wajib Diisi |
|---|---|---|---|
| PENDING | IN_REVIEW | lead_group | - |
| IN_REVIEW | ANALYSIS_APPROVED, REJECTED | lead_group, analyst | `rejection_reason` jika REJECTED |
| ANALYSIS_APPROVED | READY_FOR_DEVELOPMENT | development_lead | `analyst_id`, `analyst_result` |
| READY_FOR_DEVELOPMENT | DEV_ANALYSIS | development_lead | `pm_id` |
| DEV_ANALYSIS | DEV_ANALYSIS_DONE | analyst | - |
| DEV_ANALYSIS_DONE | IN_DEVELOPMENT | project_manager | minimal 1 task dibuat |
| IN_DEVELOPMENT | READY_FOR_QA | project_manager | semua task status `done` |
| READY_FOR_QA | QA_IN_PROGRESS | qa_lead | `staging_url`, tester `assign` |
| QA_IN_PROGRESS | QA_PASSED, RETURN_TO_DEV | qa_tester (submit result) | `test_reports.result` |
| RETURN_TO_DEV | IN_DEVELOPMENT | project_manager | `rework_notes` |
| QA_PASSED | CYBER_IN_PROGRESS | cyber_lead | pentester `assign` |
| CYBER_IN_PROGRESS | CYBER_PASSED, RETURN_TO_DEV | pentester (submit result) | `test_reports.result` |
| CYBER_PASSED | READY_FOR_UAT | project_manager | `uat_notes` |
| READY_FOR_UAT | UAT_PASSED | business_user | konfirmasi UAT |
| UAT_PASSED | PENDING_GOLIVE | project_manager | `release_requests` submitted |
| PENDING_GOLIVE | LIVE_PRODUCTION | head_of_it (quality gate approve) | `quality_gate` approved |
| * (sebelum LIVE_PRODUCTION) | ON_HOLD, CANCELLED | super_admin, development_lead, project_manager (sesuai konteks) | alasan wajib |

> **Implementasi:** definisikan tabel ini secara literal sebagai array di `ProjectWorkflowService` (map `[status => [allowed_next_statuses]]` + `[status => allowed_roles]`). Semua endpoint yang mengubah status (`PUT /projects/{id}/status`, QA submit, Cyber submit, quality gate approve/reject, dll) **wajib** memanggil service ini, bukan update langsung. Setiap transisi otomatis: (1) insert ke `project_status_histories`, (2) broadcast `ProjectUpdated`, (3) buat `Notification` untuk pihak terkait berikutnya.

---

## 5. API ENDPOINTS

Base URL: `http://localhost:8000/api/v1` (tambahkan versioning dibanding draft awal).

Format response sukses/error/validasi: **sama seperti draft awal**, dipertahankan.

### 5.1–5.9 Endpoint Auth, Project, Task, Workspace, QA/Cyber, Release, Admin, Notification/Chat

Semua endpoint di draft awal (Bagian 4.3–4.10) **dipertahankan seluruhnya**. Tambahan endpoint yang belum ada tapi dibutuhkan untuk alur lengkap:

| Method | URL | Deskripsi | Role |
|---|---|---|---|
| GET | `/api/v1/projects/{id}/timeline` | Riwayat status proyek (dari `project_status_histories`) | semua yang punya akses read proyek |
| GET | `/api/v1/documents/{id}/download` | Download dokumen dengan cek otorisasi | sesuai akses proyek |
| PUT | `/api/v1/workspace/lead/approve/{id}` | Approve proyek di tahap lead review | lead_group |
| PUT | `/api/v1/workspace/lead/reject/{id}` | Reject proyek dengan alasan | lead_group |
| POST | `/api/v1/test-reports/{id}/review` | Lead review hasil QA/Cyber (isi `reviewed_by`, `reviewed_at`) | qa_lead, cyber_lead |
| PUT | `/api/v1/projects/{id}/hold` | Set proyek ON_HOLD | super_admin, development_lead, project_manager |
| PUT | `/api/v1/projects/{id}/cancel` | Set proyek CANCELLED | super_admin, development_lead |
| GET | `/api/v1/dashboard/summary` | Statistik ringkas sesuai role login (jumlah pending, in-progress, dll) | semua role (data difilter sesuai role) |
| GET | `/api/v1/projects/search` | Pencarian proyek by nama/req_id | semua yang punya akses read |
| GET | `/api/v1/health` | Health check server (untuk monitoring uptime) | public/token khusus |

---

## 6. AUTENTIKASI & OTORISASI

Bagian 5.1 draft awal (Sanctum flow) **dipertahankan**. Tambahan security hardening yang penting untuk sistem bank internal:

- **Rate limiting login:** throttle `LOGIN_MAX_ATTEMPTS` per email+IP dalam window tertentu, lockout `LOGIN_LOCKOUT_MINUTES` (pakai `RateLimiter` bawaan Laravel, bukan custom).
- **Password policy:** minimal 8 karakter, kombinasi huruf besar/kecil/angka/simbol — validasi pakai `Password::min(8)->mixedCase()->numbers()->symbols()` di `LoginRequest`/`RegisterRequest`.
- **Token expiration:** draft awal set `'expiration' => null` (token tidak pernah expired) — untuk aplikasi bank sebaiknya set expiry (misal 8 jam / 1 hari kerja) dan implementasi refresh atau re-login.
- **Audit login gagal:** catat percobaan login gagal ke `audit_trails` dengan action `LOGIN_FAILED`.

### 6.1 Role Access Matrix (Detail — revisi dari draft awal)

Matrix di draft awal (Bagian 5.2) terlalu general. Untuk implementasi middleware yang presisi, acuan sebenarnya adalah **Tabel Transisi Status di Bagian 4.2** — matrix CRUD umum di draft awal tetap dipakai untuk otorisasi *akses modul*, sedangkan otorisasi *aksi transisi status* mengikuti Bagian 4.2. Jangan campur keduanya dalam satu middleware role check saja; endpoint pengubah status perlu extra-check terhadap state machine, bukan hanya role.

---

## 7. REAL-TIME EVENT (LARAVEL REVERB)

Sama seperti draft awal (event `NewNotification`, `NewChatMessage`, `ProjectUpdated`, channel definitions). Tambahan:

- `ProjectUpdated` event dikirim otomatis oleh `ProjectWorkflowService` setiap transisi (bukan manual per controller), supaya tidak ada transisi yang lupa dibroadcast.
- Tambahkan channel privat `project.{id}` (selain channel publik `projects`) untuk update detail proyek yang hanya relevan untuk tim yang terlibat.

---

## 8. FILE MANAGEMENT

Sama seperti draft awal, tambahan validasi wajib untuk konteks bank:

- Validasi tipe file (`ALLOWED_FILE_TYPES`) dan ukuran maksimum (`MAX_UPLOAD_SIZE_MB`) di **Form Request**, bukan di controller.
- Nama file disimpan dengan hash/UUID, nama asli disimpan terpisah di kolom `file_name` (draft awal sudah punya kolom ini, pastikan dipakai konsisten — jangan pakai nama asli sebagai path fisik, rawan path traversal).
- Endpoint download **wajib** cek otorisasi (apakah user punya akses ke proyek terkait) sebelum stream file — jangan andalkan URL storage public yang bisa ditebak.

---

## 9. ERROR HANDLING, MIDDLEWARE, TESTING, DEPLOYMENT

Bagian 8, 9, 11, 10 dari draft awal **dipertahankan seluruhnya** (exception handler, HTTP status codes, audit middleware, CORS, testing strategy, deployment checklist). Tambahan untuk production readiness:

- **Health check endpoint** (`GET /api/v1/health`) yang mengecek koneksi DB, Redis, dan storage — dipakai monitoring/uptime tools.
- **Log rotation:** `LOG_CHANNEL=daily` dengan retensi `LOG_DAYS_RETENTION` hari.
- **Backup database:** jadwalkan `mysqldump` harian sebelum go-live (di luar scope kode, tapi wajib ada di checklist ops).
- **Security headers:** tambahkan middleware untuk header `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` di response API.

---

## 10. ROADMAP IMPLEMENTASI BERTAHAP

Ini bagian yang paling langsung dipakai sebagai checklist kerja harian Anda. Kerjakan berurutan — jangan mulai fase berikutnya sebelum fase sebelumnya lulus test.

### Fase 0 — Fondasi (1–2 hari)
- [ ] Install Laravel 11, setup `.env`, koneksi DB
- [ ] Migration tabel bawaan Laravel: `password_reset_tokens`, `personal_access_tokens`, `jobs`/`failed_jobs`
- [ ] Setup Sanctum, Reverb, CORS dasar
- [ ] Buat `app/Enums/ProjectStatus.php`, `app/Enums/UserRole.php`

### Fase 1 — Master Data & Auth (2–3 hari)
- [ ] Migration & seeder: `roles`, `divisions`, `users`
- [ ] `AuthController`: register, login, logout, forgot/reset password
- [ ] `RoleMiddleware`
- [ ] Feature test: login sukses/gagal, akses endpoint tanpa token ditolak
- [ ] Admin CRUD: users, roles, divisions

### Fase 2 — Proyek Inti & State Machine (3–5 hari, PALING KRITIS)
- [ ] Migration: `projects`, `project_status_histories`
- [ ] `ProjectWorkflowService` — implementasi tabel transisi Bagian 4.2 secara literal
- [ ] `ProjectController`: CRUD dasar + endpoint status transition generik
- [ ] Broadcast `ProjectUpdated` + insert `project_status_histories` otomatis di service
- [ ] Feature test: setiap baris di tabel transisi Bagian 4.2 punya 1 test (transisi valid) + 1 test (transisi invalid ditolak)

### Fase 3 — Workspace per Role (3–4 hari)
- [ ] `project_tasks`, `project_team_members` migration
- [ ] `WorkspaceController` untuk lead_group, analyst, development_lead, project_manager
- [ ] `TaskController` CRUD + update status task

### Fase 4 — QA & Cyber (2–3 hari)
- [ ] `test_reports` migration
- [ ] `QARequestController`, `CyberRequestController`
- [ ] Endpoint review oleh lead (Bagian 5 tambahan)

### Fase 5 — Release & Quality Gate (2 hari)
- [ ] `release_requests` migration
- [ ] `ReleaseRequestController`, `QualityGateController`

### Fase 6 — Dokumen, Notifikasi, Chat (3 hari)
- [ ] `document_vaults` + `FileUploadService` + endpoint download
- [ ] `notifications` + event broadcasting
- [ ] `chat_messages` + `ChatController` + broadcast

### Fase 7 — Audit, Dashboard, Hardening (2–3 hari)
- [ ] `AuditMiddleware` aktif di semua route write
- [ ] `dashboard/summary` endpoint per role
- [ ] Rate limiting login, password policy, security headers
- [ ] Health check endpoint

### Fase 8 — Testing & Deployment (2–3 hari)
- [ ] Coverage sesuai target Bagian 11.3 draft awal
- [ ] Jalankan deployment checklist Bagian 10 draft awal
- [ ] Setup backup DB terjadwal
- [ ] Smoke test end-to-end: 1 proyek dari PENDING sampai LIVE_PRODUCTION lewat API

---

## 11. KESIMPULAN

| Aspek | Status |
|---|---|
| Arsitektur & Teknologi | Lengkap |
| Database Schema (16 tabel: 12 awal + 4 tambahan) | Lengkap |
| State Machine & Alur Approval | **Baru ditambahkan — inti sistem** |
| API Endpoints (50+ endpoint) | Lengkap |
| Autentikasi, RBAC, & Security Hardening | Lengkap |
| Real-time WebSocket | Lengkap |
| File Management & Otorisasi Download | Lengkap |
| Error Handling & Middleware | Lengkap |
| Roadmap Implementasi Bertahap | **Baru ditambahkan** |
| Testing & Deployment Checklist | Lengkap |
