# NagariSDLC — Arsitektur Sistem

## 1. Overview

```
[ React 19 SPA (Vite 5173) ]
        │  fetch + Bearer token (Sanctum)
        ▼
[ Laravel 13 REST API (php artisan serve :8000) ]
        │
        ├── MySQL (nagarisdlc)
        ├── Storage (dokumen)
        └── Reverb (WebSocket: ProjectUpdated, NotificationCreated)
```

Arsitektur **monolith** sederhana: satu backend Laravel melayani satu frontend
React. Komunikasi murni REST API (JSON), auth via Bearer token.

## 2. Backend

### Layer
- **Routes** → `routes/api.php` (prefix `api/v1`, auth:sanctum).
- **Controllers** → `app/Http/Controllers/Api/V1/*`.
- **Requests** → `app/Http/Requests/*` (validasi).
- **Resources** → `app/Http/Resources/*` (transformasi output).
- **Models** → `app/Models/*` (Eloquent).
- **Services** → `app/Services/*` (logic bisnis lintas controller).
- **Events** → `app/Events/*` (broadcast).

### Service Utama
**`ProjectWorkflowService`** — pusat state machine proyek:
- `transition(Project, ProjectStatus, User, notes)` — validasi transisi + role,
  lalu eksekusi dalam DB transaction (update status, insert history, broadcast,
  buat notification).

### Controller Penting
| Controller | Fungsi |
|---|---|
| `ProjectController` | CRUD proyek, status, timeline, sitGate, sitApproval, uatApproval, uatChangeRequest(+decision) |
| `TaskController` | CRUD task, requestRevision |
| `DocumentController` | Upload/download/delete dokumen |
| `ChatController` | Chat per proyek |
| `AuthController` | Login/logout/me/refresh |
| `ActivityLogController` | Log aktivitas |
| `NotificationController` | Notifikasi |
| `QARequestController` / `CyberRequestController` | Pengajuan QA/Cyber |

### State Machine (ProjectWorkflowService)
- `$allowedTransitions[current] = [next...]`
- `$rolePermissions[status] = [role...]` — siapa boleh pindah ke status itu.
- Transisi non-linear (ON_HOLD/CANCELLED) dikecualikan.

## 3. Frontend

### Routing & Guard
- `src/router/index.jsx` — semua route + `ProtectedRoute allowedRoles`.
- Role constants: `PM_ROLES`, `DEV_MEMBER_ROLES`, `BUSINESS_ROLES`, dll.

### Context (state global)
| Context | Fungsi |
|---|---|
| `AuthContext` | Session, login/logout, user, handle 401 |
| `ProjectContext` | Daftar proyek + polling 30s + `refreshDataSilent` |
| `ChatContext` | Pesan chat per proyek (backend API + polling 10s) |
| `NotificationContext` | Notifikasi |
| `MasterDataContext` | Data master |

### Service Layer (`src/services/api.js`)
**Satu-satunya tempat** melakukan fetch ke backend. Semua komponen memakai ini.
- `apiFetch` — wrapper fetch + auto-refresh token + error handling.
- Export: `authService, projectService, taskService, documentService,
  activityLogService, chatService, userService, roleService, divisionService,
  notificationService, ...`

### Komponen Kunci
- `SITUATWizard.jsx` — wizard multi-step SIT & UAT (data di `sit_uat_data`).
- `SITTaskExecution.jsx` — tabel approval task SIT (OK, komentar, lampiran, revisi).
- `ChatBox.jsx` — chat per proyek.
- `DocList` (di dalam SITUATWizard) — daftar dokumen dengan masking & tipe file.

## 4. Alur Auth & Token

1. Login → `authService.login` → simpan session `{ token, user, issuedAt }` di
   `localStorage.nagari_sdlc_session`.
2. Setiap request: `Authorization: Bearer <token>`.
3. `ensureFreshToken()` — refresh otomatis jika token mendekati expire (8 jam).
4. Response 401 → `handleResponse` dispatch `auth:unauthorized` →
   `AuthContext.handleUnauthorized` → clear session + toast (anti-spam).

## 5. Keamanan

- **RBAC**: role gate di route & di controller (`role:` middleware).
- **Otorisasi dokumen**: `DocumentController@download` cek relasi user ke proyek.
- **Otorisasi chat**: `ChatController` cek akses proyek.
- **Isolasi data**: `ProjectAccessService` adalah satu sumber kebenaran aturan
  visibilitas proyek. `applyVisibilityScope()` menyaring daftar
  (`ProjectController@index`, `WorkspaceController@show`), `canView()` menjaga baca
  satu proyek (`ProjectController@show`, `TaskController@getByProject`), dan
  `canUpdate()` menjaga tulis (`ProjectController@update`,
  `TaskController@store`). Ringkasan aturan: role pengawas (super_admin,
  head_of_it, lead_group) melihat semua; business_user → `created_by`;
  project_manager → `pm_id`; analyst → `analyst_id` (hanya proyek yang
  didisposisikan kepadanya, termasuk saat masih `PENDING` tanpa analis);
  developer → anggota tim atau assignee task; development_lead, QA, dan Cyber →
  berbasis fase karena tabel `projects` tidak punya kolom penugasan untuk role
  itu. Keterlibatan personal (pemohon, PM, analis, anggota tim, assignee task,
  approver UAT) selalu memberi akses baca meski status sudah bergerak maju.
  Transisi status punya lapisan tambahan di `ProjectWorkflowService`: role dengan
  kolom penugasan hanya boleh mentransisikan proyek yang ditugaskan kepadanya —
  analyst dicocokkan ke `analyst_id`, project_manager ke `pm_id` — agar jejak
  `status_histories` tidak tercatat atas nama orang yang bukan pemegang
  disposisi. Role tanpa kolom penugasan (lead_group, development_lead, QA, Cyber)
  tidak melewati pemeriksaan itu.
- **Project Manager = Analis Pengembangan (Fase 2)**: satu orang, satu role, satu
  kolom penugasan `projects.pm_id`. Nama role `dev_analyst` hanya hidup di
  router dan menu frontend (`/workspace/dev-analyst`) dan tidak ada di
  `App\Enums\UserRole`; backend tetap mencocokkan kedua sebutan agar hasilnya
  identik. Kolom `projects.analyst_id` milik System Analyst Fase 1 dan tidak
  boleh ditimpa saat Development Lead menugaskan Analis Pengembangan — jika
  ditimpa, catatan pelaksana analisis perencanaan hilang dari baris proyek dan
  analis tersebut kehilangan akses ke proyek yang ia analisis sendiri. Hasil
  kajian keduanya pun terpisah: `projects.analyst_result` (Fase 1) dan
  `projects.dev_analyst_result` (Fase 2).
- **Input**: Form Request + `validate()`.
- **CORS**: `backend/config/cors.php` membaca `CORS_ALLOWED_ORIGINS` (dipisah koma),
  dengan fallback `FRONTEND_URL` lalu `APP_URL`. Saat `APP_ENV=local` origin dev
  server Vite (5173/4173) otomatis ditambahkan; di luar local nilai `*` dibuang
  supaya konfigurasi salah tidak membuka API ke semua origin. `allowed_headers`
  dibatasi pada header yang dipakai frontend (termasuk `X-UAT-Approval-Access`
  untuk approver eksternal), `exposed_headers` hanya `Content-Disposition`, dan
  `supports_credentials` tetap `false` karena autentikasi memakai Bearer token,
  bukan cookie. Ingat `php artisan config:cache` membekukan nilai `env()`.
- **Gate tahapan SIT/UAT di frontend**: `SITUATWizard.jsx` memakai
  `UNLOCK_ALL_STAGES = false` dan daftar status (`SIT_STARTABLE_STATUSES`,
  `SIT_COMPLETED_STATUSES`, `UAT_COMPLETED_STATUSES`) yang mencerminkan
  `allowedTransitions`. Tujuannya dua: tombol aksi tidak menawarkan transisi yang
  pasti ditolak backend, dan berita acara SIT/UAT tetap terbaca read-only setelah
  proyek masuk QA, Siber, atau produksi. Gate frontend hanya lapisan UX; otorisasi
  sebenarnya tetap di `ProjectWorkflowService`.
- **Environment**: nilai berawalan `VITE_` ikut dibundel ke berkas JavaScript
  publik, jadi tidak boleh memuat rahasia. Template: `backend/.env.example`,
  `backend/.env.production.example`, `frontend/.env.example`,
  `frontend/.env.production.example`.

## 6. Penyimpanan

- **DB**: MySQL. Kolom penting `projects.sit_uat_data` (JSON) menyimpan seluruh
  data SIT/UAT.
- **File**: `storage/app/documents` (disk local), metadata di tabel
  `document_vaults`.

## 7. Realtime

- **Reverb** terkonfigurasi untuk `ProjectUpdated` & `NotificationCreated`.
- **Chat**: saat ini polling 10 detik (belum Reverb).
- Frontend: polling ProjectContext 30s, ChatContext 10s, TaskDetail SIT 20s.
