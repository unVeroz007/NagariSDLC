# NagariSDLC — Panduan Agent AI

Dokumen ini adalah panduan utama bagi agent AI (atau pengembang) untuk memahami,
menavigasi, dan mengerjakan kodebase **NagariSDLC**. Bacalah file ini lengkap
sebelum melakukan perubahan apa pun.

## 1. Ringkasan Proyek

**NagariSDLC** adalah sistem **SDLC Governance** internal Bank Nagari. Sistem ini
mengelola seluruh siklus hidup proyek IT:

```
Pengajuan Proyek → Review & Analisis → Pengembangan → SIT → UAT →
QA Testing → Cyber Security Test → Release → Live Production
```

Setiap tahapan melibatkan role yang berbeda, dan setiap transisi status proyek
wajib melalui **state machine** yang terpusat.

## 2. Stack Teknologi

| Lapisan | Teknologi |
|---|---|
| Backend | Laravel 13 (PHP 8.3), REST API |
| Auth | Laravel Sanctum (token 8 jam + refresh) |
| Database | Mengikuti environment development; target produksi belum diputuskan |
| Realtime | Laravel Reverb tersedia; arsitektur produksi belum diputuskan |
| Frontend | React 19 + Vite 8 + Tailwind 4 |
| Bahasa UI | Bahasa Indonesia |
| Brand | Warna utama `#00529C` |

## 3. Struktur Direktori

```
nagarisdlc/
├── backend/                # Laravel REST API
│   ├── app/
│   │   ├── Enums/          # ProjectStatus, TaskStatus, UserRole, TestResult
│   │   ├── Http/
│   │   │   ├── Controllers/Api/V1/  # Semua controller API
│   │   │   ├── Requests/            # Form Request (validasi)
│   │   │   └── Resources/           # API Resource (transformasi response)
│   │   ├── Models/         # Eloquent models
│   │   ├── Services/       # ProjectWorkflowService (state machine) dll.
│   │   └── Events/         # ProjectUpdated, NotificationCreated
│   ├── database/migrations/
│   ├── routes/api.php      # Semua route API
│   └── tests/              # Feature tests (Pest/PHPUnit)
├── frontend/
│   ├── src/
│   │   ├── components/     # Komponen reusable (SITUATWizard, ChatBox, dll.)
│   │   ├── contexts/       # React Context (Auth, Project, Chat, Notification)
│   │   ├── pages/          # Halaman per role
│   │   ├── router/         # Routing + guard per role
│   │   ├── services/api.js # Service layer API (SINGLE SOURCE OF TRUTH)
│   │   └── utils/          # documentNaming.js dll.
│   └── vite.config.js
└── docs/                   # Dokumentasi (file ini)
```

## 4. Role Pengguna (UserRole)

### Role Backend (enum `App\Enums\UserRole`) — 12 role
| Role | Deskripsi | Landing Page |
|---|---|---|
| `super_admin` | Super Admin | `/dashboard` |
| `head_of_it` | Head of IT | `/quality-gate` |
| `lead_group` | Lead Group / Kadiv | `/workspace/lead` |
| `analyst` | System Analyst (perencanaan) | `/workspace/analyst` |
| `development_lead` | Development Lead | `/workspace/dev-lead` |
| `project_manager` | PM | `/pm/workspace` |
| `developer` | Developer | `/my-tasks/dev` |
| `qa_lead` | QA Lead | `/workspace/qa` |
| `qa_tester` | QA Tester | `/my-tasks/qa` |
| `cyber_lead` | Cyber Security Lead | `/workspace/cyber` |
| `pentester` | Pentester | `/my-tasks/cyber` |
| `business_user` | Pemohon / Business User | `/track` |

### Role Frontend (router/menu) — tambahan konseptual
Router (`router/index.jsx`) & menu (`data/menuConfig.js`) juga mengenal:
- `dev_analyst` — **PM modern / Analyst Pengembangan** (dianggap setara `project_manager`)
- `cyber_team` — alias tim cyber (dianggap setara `cyber_lead`)

> **Catatan penting:** `dev_analyst` & `cyber_team` TIDAK ada di enum backend.
> Di database, PM ber-role `project_manager`; tim cyber ber-role `cyber_lead`/`pentester`.
> Saat menambah user/role baru di DB, gunakan role enum backend.

## 5. Aturan Kritis (WAJIB DIPATUHI)

1. **Semua perubahan status proyek WAJIB lewat `ProjectWorkflowService::transition()`**
   — JANGAN update kolom `status` langsung dari controller.
2. **Transisi status tidak terdaftar → ditolak** (422/403).
3. Setiap transisi status otomatis: insert `project_status_histories` +
   broadcast `ProjectUpdated` + buat `Notification`.
4. **Input wajib divalidasi** via Form Request (backend) — bukan inline.
5. **Response API** selalu `{ status, message, data, meta? }`.
6. **Download dokumen wajib cek otorisasi** akses proyek.
7. Jangan commit secret/.env.

## 6. Alur Status Proyek (State Machine)

Lihat `docs/WORKFLOW.md` untuk diagram & tabel transisi lengkap.

Ringkasan fase:
- **Fase 1**: PENDING → IN_REVIEW → ANALYSIS_APPROVED / REJECTED
- **Fase 2**: READY_FOR_DEVELOPMENT → DEV_ANALYSIS → DEV_ANALYSIS_DONE → IN_DEVELOPMENT
- **Fase SIT/UAT**: IN_DEVELOPMENT → SIT_IN_PROGRESS → SIT_PASSED → UAT_IN_PROGRESS → DEV_COMPLETED
  - Revisi: SIT_REVISION, UAT_REVISION_SIT, UAT_REVISION_DEV
- **Fase 3 (QA/Cyber)**: READY_FOR_QA → QA_IN_PROGRESS → QA_PASSED; CYBER_IN_PROGRESS → CYBER_PASSED
  - Dua jalur paralel pada kolom `projects.qa_status` & `projects.cyber_status`.
    Masing-masing jalur boleh mengembalikan proyek ke RETURN_TO_DEV.
- **Fase 4 (Rilis)**: QA_PASSED + CYBER_PASSED (kedua jalur lulus) → PENDING_GOLIVE → LIVE_PRODUCTION
  - Tidak ada UAT final setelah QA & Siber. READY_FOR_UAT adalah status legacy tanpa
    transisi masuk/keluar; UAT_PASSED hanya keluaran opsional UAT internal di Fase 2.
- Non-linear: ON_HOLD, CANCELLED, RETURN_TO_DEV

## 7. Data SIT/UAT (JSON blob)

Data SIT & UAT tersimpan di kolom `projects.sit_uat_data` (JSON), dikelola
frontend wizard (`SITUATWizard.jsx`). Struktur penting:

```jsonc
{
  "activeSitStep": 1, "activeUatStep": 1,
  "sit2_task_approvals": { "task_10": { "approved": true, "attachments": [...], "approvedAt": ..., "revisedAt": ... } },
  "sit3_approvals": { "developer": {...}, "pm": {...}, "development_lead": {...} },
  "uat1_scenarioList": "...", "uat1_participants": [...], "uat1_startDate": "...", "uat1_unit": "...",
  "uat2_scenarios": [{ "taskId": 10, "result": "accepted|revision", "changeType": "minor|mayor|null", "request": "...", "comment": "...", "attachments": [...], "verificationStatus": "waiting_development|waiting_sit|null" }],
  "uat2_additional_requests": [{ "id": "uat_request_...", "title": "...", "changeType": "minor|mayor", "detail": "...", "taskId": 20, "attachments": [...], "verificationStatus": "..." }],
  "uat2_summary": { "executedCount": 1, "acceptedCount": 0, "minorCount": 0, "majorCount": 1, "additionalRequestCount": 1, "conclusion": "major_revision" },
  // Penanda pengulangan UAT. Baca HANYA lewat Project::isUatRestartPending(), yang jatuh
  // ke nama lama `uat2_resume_after_sit` bila kunci baru belum ada pada baris lama.
  "uat_restart_after_sit": true,
  "uat_sit_retest_passed_at": "ISO", // ditulis saat SIT ulang lulus; tanpa awalan uat2_
  "uat_hold": { "status": "developer_revision|uat_restart", "cycle": 1, "resumeStep": 1 },
  // mode 'full' = seluruh task aktif kecuali take_down. 'targeted' hanya tersisa pada
  // baris produksi lama dan masih dihormati untuk baris itu.
  "sit_retest_scope": { "mode": "full", "cycle": 1, "status": "waiting_development|in_progress|passed", "taskIds": [], "affectedItems": [...] },
  // Arsip append-only putaran UAT yang dikosongkan karena revisi Mayor (termasuk approvals)
  "uat_cycles": [ { "cycle": 1, "summary": {}, "scenarios": [], "approvals": {}, "archivedAt": "ISO", "archivedBy": "Nama", "reason": "major_revision" } ],
  "uat3_approvals": {}, // legacy; approval baru ada di uat_approval_rounds + uat_approvers
  "uat_change_requests": [ { "id": "cr_...", "type": "minor|mayor", "status": "pending|approved|rejected|open|in_progress|resolved|sit_verified", ... } ],
  "revisions": []
}
```

> **PENTING (bug historis):** `sit2_task_approvals` di-normalisasi backend dengan
> prefix `task_` (mis. `task_10`) agar PHP `json_encode` menghasilkan OBJECT,
> bukan ARRAY. Frontend wajib strip prefix `task_` saat membaca.

> **Kunci pensiun.** `uat2_verification_mode`, `uat2_resume_after_sit`,
> `uat2_sit_retest_passed_at`, `uat2_major_revision_verified_at`,
> `uat2_verification_history`, dan `uat2_major_revision_resolved_at` **tidak pernah ditulis
> lagi**, tetapi masih mungkin ada pada baris lama. Hanya `uat2_resume_after_sit` yang
> masih dibaca — sebagai fallback di `Project::isUatRestartPending()`. Rinciannya di
> `docs/DATA_MODEL.md`.

> **`uat1_participants` tidak pernah dikosongkan** oleh jalur kode mana pun, termasuk saat
> revisi Mayor mengulang UAT. Daftar penanda tangan terbawa ke putaran berikutnya; PM boleh
> menambah, tetapi `PATCH /projects/{id}` menolak pengosongannya.

## 8. Approval SIT & UAT

- **SIT (Tahap 3)**: Developer (semua assignee) + PM (`pm`) + Development Lead.
  Semua wajib approve sebelum tombol "SIT Lulus" aktif.
- **UAT (Tahap 3)**: matrix individual dari peserta UAT. Pihak peminta terdiri
  dari pemohon, pimpinan grup, dan pimpinan divisi melalui link pribadi +
  pencocokan nomor HP. Pihak IT terdiri dari developer yang ditetapkan,
  Analyst/PM, pimpinan grup pengembangan, dan pimpinan Divisi Teknologi dan
  Digitalisasi melalui akun aplikasi.
- **Gate approval SIT**: hanya muncul jika `activeSitStep >= 3` (Eksekusi selesai).
- **Gate dokumen SIT**: transisi `SIT_PASSED` wajib memiliki minimal satu
  dokumen server bertipe `SIT_RESULT` atau `SIT_SIGNOFF`.
- **Eksekusi UAT Tahap 2**: hasil dicatat per task dan dapat memuat request tambahan
  user. Minor tidak rollback; mayor otomatis menjadi Change Request →
  `UAT_REVISION_DEV` → dev → **SIT ulang menyeluruh** (seluruh task aktif kecuali
  `TAKE DOWN`, bukan hanya task Change Request) → setelah SIT lulus **UAT dijalankan ulang
  dari Tahap 1** dengan seluruh skenario dieksekusi ulang → UAT Tahap 3 dengan putaran
  persetujuan baru.
- **Mode verifikasi item Mayor sudah dipensiunkan.** Flag `uat2_verification_mode`,
  endpoint `POST /projects/{id}/uat-major-verification`, Form Request, method controller,
  dan `UatExecutionService::verifyMajorRevisions()` semuanya sudah dihapus. Jangan
  menambahkan kembali cabang yang memeriksa flag itu.
- Sebelum hasil Tahap 2 dikosongkan, putaran UAT berjalan diarsipkan ke `uat_cycles`
  (append-only) beserta approval-nya. Putaran approval lama ditandai `superseded`; baris
  `approved` dipertahankan untuk audit, baris `pending` menjadi `revoked`.
- Endpoint Change Request lama tetap ada untuk kompatibilitas: keputusan minor
  tidak mengubah status, keputusan mayor mengikuti alur di atas.

## 9. Perintah Umum

```bash
# Backend
cd backend
php artisan serve --port=8000        # Jalankan server
php artisan migrate                   # Jalankan migration
php artisan test                      # Jalankan test suite
php artisan db:seed                   # Seed data

# Frontend
cd frontend
npm run dev                           # Dev server (Vite, port 5173)
npm run build                         # Build produksi
```

> Catatan: gunakan PHP 8.3 (Laragon `C:\laragon\bin\php\php-8.3.23-...`).
> Server `php artisan serve` harus di-restart setelah perubahan route/controller.

## 10. Mengubah Kode — Checklist

- [ ] Baca file ini + `docs/ARCHITECTURE.md` + `docs/WORKFLOW.md` terkait.
- [ ] Untuk backend: tambah/ubah Form Request, Controller, Resource, Model, route.
- [ ] Tambahkan/ubah test bila diminta atau ketika scope pekerjaan memang mencakup test.
- [ ] Jangan menjalankan test/build tanpa permintaan pengguna; laporkan verifikasi yang belum dilakukan.
- [ ] Pertahankan `UNLOCK_ALL_STAGES = false` di `SITUATWizard.jsx`. Boleh dinyalakan
      sementara untuk debug lokal, tetapi jangan di-commit dan jangan diubah permanen
      tanpa konfirmasi pengguna.
- [ ] Bila `allowedTransitions` di `ProjectWorkflowService` berubah, perbarui juga
      daftar status gate di `SITUATWizard.jsx` (`SIT_STARTABLE_STATUSES`,
      `SIT_COMPLETED_STATUSES`, `UAT_COMPLETED_STATUSES`, dan turunannya).
