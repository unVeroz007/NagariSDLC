# Blueprint Backend NagariSDLC

**Status dokumen:** ringkasan implementasi aktif per 5 September 2026. Nama file
`v2` dipertahankan agar tautan lama tidak rusak. Blueprint Laravel 11 yang dahulu
berada di file ini sudah tidak berlaku; sumber kontrak terperinci berada di
[`../../docs`](../../docs/README.md).

## Stack dan bentuk aplikasi

- PHP 8.3 dan Laravel 13.
- REST API JSON dengan prefix `/api/v1`.
- Laravel Sanctum untuk token sesi.
- Cookie `HttpOnly` adalah jalur utama SPA; Bearer eksplisit tetap kompatibel.
- MySQL sebagai database development/operasional saat ini.
- Reverb tersedia untuk event proyek dan notifikasi; transport produksi belum
  diputuskan.
- Document Vault memakai Laravel Filesystem dan metadata `document_vaults`.

## Lapisan backend

```text
routes/api.php
  → Form Request
    → Controller Api/V1
      → Service domain
        → Model/Eloquent
          → API Resource
```

Service inti:

- `ProjectWorkflowService`: satu-satunya mesin transisi `projects.status`.
- `ProjectAccessService`: satu sumber cakupan baca/tulis proyek.
- `TestingTrackService`: empat langkah jalur QA dan Siber.
- `ProjectReturnRoundService`: membuka, memvalidasi, dan menutup putaran
  pengembalian.
- `UatExecutionService`: draft/final UAT dan siklus revisi Minor/Mayor.
- `UatApprovalService`: approval individual, link eksternal, dan supersession.
- `SitApprovalService`: inbox serta keputusan approval SIT.
- `ReleaseReadinessService`: empat pilar kesiapan Quality Gate.

## Alur status aktif

```text
PENDING → IN_REVIEW → ANALYSIS_APPROVED → READY_FOR_DEVELOPMENT
→ DEV_ANALYSIS → DEV_ANALYSIS_DONE → IN_DEVELOPMENT
→ SIT_IN_PROGRESS → SIT_PASSED → UAT_IN_PROGRESS → DEV_COMPLETED
→ QA dan Siber paralel → PENDING_GOLIVE → LIVE_PRODUCTION
```

Aturan penting:

- `READY_FOR_UAT` dipertahankan hanya untuk membaca histori lama dan tidak punya
  transisi masuk/keluar.
- `UAT_PASSED` masih merupakan keluaran opsional UAT Internal dan dapat menuju
  `DEV_COMPLETED`; status ini bukan gerbang rilis.
- Tidak ada UAT final setelah QA/Siber.
- `PENDING_GOLIVE` membutuhkan `qa_status=PASSED` dan
  `cyber_status=PASSED`.
- `ON_HOLD` dan `CANCELLED` mengikuti matriks aktual di
  `ProjectWorkflowService`, bukan dapat dimasuki bebas dari semua status.

## SIT dan UAT Internal

- SIT memiliki tahap persiapan, eksekusi per task, serta review/sign-off.
- Kelulusan SIT membutuhkan persetujuan seluruh developer terkait, PM, Development
  Lead, dan dokumen hasil review/berita acara.
- UAT memiliki tahap persiapan/roster, eksekusi per skenario, serta approval
  individual pihak peminta dan pihak IT.
- Revisi Minor tidak melakukan rollback status, tetapi menahan penutupan UAT
  sampai seluruh Change Request Minor selesai.
- Revisi Mayor mengembalikan proyek ke development, menjalankan SIT ulang penuh,
  lalu mengulang UAT dari Tahap 1 dengan putaran approval baru.
- `uat1_participants` tidak pernah dikosongkan saat siklus revisi.
- Approval aktif disimpan di `uat_approval_rounds` dan `uat_approvers`; putaran
  lama di-`superseded`, bukan dihapus.

## QA dan Keamanan Siber

Masing-masing jalur menggunakan empat aksi:

1. PM mengajukan (`submit`).
2. Lead mendisposisikan pelaksana (`assign`).
3. Pelaksana menyimpan laporan (`report`).
4. Lead memberi keputusan (`sign-off`).

Status jalur disimpan terpisah pada `projects.qa_status` dan
`projects.cyber_status`. Sign-off gagal memindahkan proyek ke `RETURN_TO_DEV` dan
membuka `project_return_rounds`. Pengajuan ulang ditolak sampai seluruh task
perbaikan putaran tersebut memiliki assignee dan selesai (`done` atau
`take_down`). Riwayat putaran tidak pernah di-hard-delete.

## Autentikasi dan keamanan sesi

Login/refresh menerbitkan token Sanctum dalam cookie `nagari_sdlc_token`.
Middleware `AuthenticateFromSessionCookie` mengubahnya menjadi Bearer sebelum
guard Sanctum. Request berbasis cookie wajib membawa
`X-Requested-With: XMLHttpRequest`; CORS memakai origin eksplisit dan
`supports_credentials=true`.

Di produksi, gunakan HTTPS dan pertimbangkan:

```env
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_EXPOSE_TOKEN=false
```

Nilai domain dan `SameSite` harus mengikuti topologi SPA/API aktual.

## Database dan audit trail

- `users`, `projects`, dan `divisions` memakai soft delete.
- Status history, approval, laporan pengujian, dokumen bukti, release decision,
  dan putaran pengembalian dipertahankan sebagai audit trail.
- Data wizard SIT/UAT berada pada `projects.sit_uat_data` dengan compatibility
  key lama; penanda restart hanya dibaca melalui
  `Project::isUatRestartPending()`.
- Struktur dan foreign key lengkap dijelaskan di
  [`../../docs/DATA_MODEL.md`](../../docs/DATA_MODEL.md).

## Kontrak dan verifikasi

- Route aktif: [`../routes/api.php`](../routes/api.php).
- Referensi API: [`../../docs/API_REFERENCE.md`](../../docs/API_REFERENCE.md).
- Alur/status: [`../../docs/WORKFLOW.md`](../../docs/WORKFLOW.md).
- Snapshot historis 26 Agustus 2026: 236 test / 1.467 assertion lulus.
- PHPUnit memakai SQLite in-memory; status migration database nyata harus
  diperiksa terpisah dengan `php artisan migrate:status`.
