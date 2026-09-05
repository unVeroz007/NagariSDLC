# NagariSDLC — Model Data

## 1. Diagram Entitas Utama

```
users ──┬── roles ── groups
        ├── divisions
        ├── projects (created_by)      ← pemohon
        ├── projects (pm_id)           ← PM
        ├── projects (analyst_id)      ← analyst
        ├── document_vaults (uploaded_by)
        ├── chat_messages (user_id)
        ├── project_status_histories (changed_by)
        └── notifications (user_id)

projects ──┬── project_tasks
           ├── project_team_members
           ├── project_status_histories
           ├── project_return_rounds ── project_tasks (return_round_id)
           ├── document_vaults
           ├── activity_logs (subject)
           └── chat_messages
```

## 2. Tabel & Field Utama

### users
`id, name, email, password, role_id, division_id, phone_number, is_active, deleted_at`

### roles
`id, name (super_admin, ..., developer, business_user), display_name, description, group_id, menu_access`

- `group_id` → FK `groups` (`nullOnDelete`). Grup kerja yang menaungi role. Boleh `NULL`;
  `super_admin` sengaja tanpa grup. **Grup tidak menentukan otorisasi apa pun** —
  hak transisi status tetap milik `ProjectWorkflowService::$rolePermissions`, cakupan
  proyek milik `ProjectAccessService`, dan hak pelaksana uji milik
  `TestingTrack::testerRoles()`, yang semuanya mencocokkan `roles.name`.
- `menu_access` → JSON, daftar path menu yang boleh dilihat role. `NULL` dan daftar
  kosong sama-sama berarti **tanpa pembatasan** (lihat `Role::menuAccessPaths()`), supaya
  role tidak kehilangan seluruh sidebar-nya hanya karena tidak ada yang dicentang.
  Sifatnya **mengurangi saja**: tidak ada cara memberi role menu yang tidak ada pada
  `frontend/src/data/menuConfig.js`, dan menyembunyikan menu tidak menutup rutenya —
  gerbangnya tetap `ProtectedRoute` serta middleware `role:` di backend. Akses menu
  `super_admin` tidak dapat dibatasi (dijaga `UpdateRoleRequest`).

### groups
`id, code (unik), name, description`

Grup mengelompokkan **role**; divisi adalah unit tempat **pengguna** berada. Satu grup
dapat berisi role dari beberapa divisi, dan sebaliknya. Grup bawaan diisi migration
`2026_08_25_000001_create_groups_and_role_menu_access`: `PERENCANAAN-QA`, `PENGEMBANGAN`,
`KEAMANAN-SIBER`, `MANAJEMEN-TI`, `PEMOHON`. Backfill mencocokkan `code` (bukan id, yang
berbeda per lingkungan) dan hanya mengisi role yang `group_id`-nya masih `NULL`, sehingga
penempatan ulang oleh Super Admin tidak pernah ditimpa.

### divisions
`id, code, name, deleted_at`

### projects
| Field | Tipe | Keterangan |
|---|---|---|
| id | int | PK |
| req_id | string | Kode unik `REQ-YYYY-NNN` |
| title / description | string | Nama & deskripsi |
| **contact_phone** | string | **Nomor telpon kontak pemohon (untuk UAT & koordinasi)** |
| type | string | `RBB` / `NON_RBB` |
| project_type | string | `baru` / `perbaikan` / `update` |
| **priority** | string | **Prioritas pilihan pengaju: `High` / `Medium` / `Low` (default `Medium`). Kosakatanya sama dengan `project_tasks.priority`** |
| status | string(enum) | Lihat ProjectStatus |
| created_by | FK users | Pemohon |
| pm_id | FK users | PM |
| analyst_id | FK users | Analyst |
| division_id | FK divisions | Divisi pemohon |
| target_date | date | Target selesai |
| **rbb_deadline** | date (nullable) | **Tenggat komitmen Rencana Bisnis Bank. Berdiri sendiri dari `target_date` dan hanya bermakna bila `type = 'RBB'`. Diisi pada formulir inisiasi, dibaca dasbor untuk panel "Proyek RBB mendekati deadline". Baris lama tidak dibackfill — tidak ada sumber historisnya** |
| staging_url | string | URL staging |
| qa_status / cyber_status | string(enum) | Status dua jalur pengujian paralel (`TrackStatus`) |
| **qa_assignee_id / cyber_assignee_id** | FK users (nullable) | **Pelaksana yang didisposisikan Lead jalur. `nullOnDelete` — penghapusan akun tidak menghapus proyek, penugasan hanya dikosongkan** |
| **cyber_check_type** | string (nullable) | **Jenis pemeriksaan Siber pilihan PM: `pentest` / `secure_code` (`CyberCheckType`)** |
| **cyber_target_url** | string(2048) (nullable) | **Alamat web target, wajib bila `cyber_check_type = pentest`** |
| **cyber_source_code_ref** | text (nullable) | **Rujukan repositori/berkas kode, wajib bila `cyber_check_type = secure_code`** |
| **sit_uat_data** | json | **Seluruh data SIT/UAT (lihat bawah)** |
| rejection_reason | text | Alasan tolak |
| team_allocated_by_pm | boolean | Tim sudah dialokasi PM |
| **deleted_at** | timestamp (nullable) | **Penanda penghapusan lunak (`SoftDeletes`)** |

### project_tasks
`id, project_id, title, description, assignee_id, status (todo|in_progress|hold|done|take_down), due_date, priority, revision_note, revision_requested_at, revision_requested_by, return_round_id, timestamps`

> **`return_round_id`** (FK `project_return_rounds`, nullable, `nullOnDelete`) menandai
> task ini sebagai **task perbaikan** atas satu putaran pengembalian QA / Keamanan Siber.
> `NULL` berarti task biasa. Kolom inilah yang dibaca gerbang pengajuan ulang: hanya task
> yang menunjuk ke putaran terbuka yang dihitung. Diisi saat pembuatan task
> (`POST /projects/{projectId}/tasks`) dan dibatasi pada putaran milik proyek yang sama
> yang masih `OPEN`.

### project_team_members
`id, project_id, user_id, role_in_project, assigned_by (lead|pm)`

### project_status_histories
`id, project_id, from_status, to_status, changed_by, notes`

### document_vaults
`id, project_id, uploaded_by, document_type, original_filename, file_name (masked), file_path, file_size, mime_type`

### chat_messages
`id, project_id, user_id, message, type (text|system), created_at`

### activity_logs
`id, user_id, action, action_label, description, subject_type, subject_id, metadata (json), ip_address`

### notifications
`id, user_id, title, message, type, is_read, link`

### test_reports
`id, project_id, test_type (qa|cyber), result (pass|conditional_pass|fail), severity, notes, checklist (json), tested_scenarios (text), attachment_url, evidence_document_ids (json), tester_id, reviewed_by, reviewed_result, review_notes, reviewed_at, timestamps`

> Satu baris menampung dua peran sekaligus namun terpisah kolomnya: `result`,
> `severity`, `tested_scenarios`, dan `evidence_document_ids` diisi pelaksana saat
> submit; `reviewed_by`, `reviewed_result`, dan `review_notes` diisi Lead saat
> sign-off. Pemisahan ini menjaga jejak audit tetap jujur ketika keputusan Lead
> berbeda dari hasil pelaksana. `evidence_document_ids` menyimpan ID baris
> `document_vaults` (tipe `QA_EVIDENCE` / `CYBER_EVIDENCE`), bukan salinan berkas.

> `tested_scenarios` (ditambahkan `2026_08_25_000000_add_tested_scenarios_to_test_reports_table`)
> adalah catatan bebas penguji tentang skenario apa yang benar-benar dijalankan.
> Kolom ini menggantikan `checklist`, yaitu enam skenario tetap yang dicentang —
> daftar tetap itu tidak pernah cocok untuk semua proyek, dan mencentangnya tidak
> membuktikan apa pun. Antarmuka QA maupun Siber sekarang hanya menampilkan
> `tested_scenarios`; `checklist` **tidak dihapus** karena laporan lama memakainya
> dan jejak audit tidak boleh dimundurkan. `TestReportResource` masih memaparkan
> `checklist` beserta `checklist_summary` agar laporan lama tetap terbaca utuh,
> tetapi tidak ada jalur tulis baru yang mengisinya dari antarmuka.

### release_requests
`id, project_id, requested_by, target_release_date, downtime_estimate, rollback_plan, notes, head_of_it_approval, approved_at, approved_by, rejected_at, rejected_by, rejection_notes, timestamps`

> **Estimasi downtime dan prosedur rollback memiliki kolomnya sendiri** sejak
> `2026_08_23_000004_add_release_decision_to_release_requests_table`:
> `downtime_estimate` (string 255, nullable) dan `rollback_plan` (text, nullable).
> Sebelumnya `ReleaseRequestController::composeNotes()` menggabungkan keduanya ke dalam
> `notes` dengan label tetap, sehingga layar Quality Gate tidak dapat menampilkannya
> terpisah. Migrasi yang sama memindahkan isi berlabel dari `notes` lama ke kolom baru,
> dan `notes` kini menyisakan catatan rilis bebas saja.
>
> Keputusan Quality Gate juga tercatat lengkap: `approved_by`, `rejected_at`,
> `rejected_by`, dan `rejection_notes`. Kedua kunci asing ke `users` memakai
> **`RESTRICT`**, bukan `SET NULL` — identitas pemberi keputusan go-live adalah bukti
> audit dan tidak boleh hilang diam-diam karena penghapusan akun.

### project_return_rounds
Satu baris = satu **putaran pengembalian**: sekali sebuah jalur pengujian (QA atau
Keamanan Siber) dinyatakan TIDAK LULUS oleh Lead-nya, proyek kembali ke pengembangan dan
putaran ini dibuka sebagai wadah task perbaikannya.

| Field | Tipe | Keterangan |
|---|---|---|
| id | int | PK |
| project_id | FK projects | **`cascadeOnDelete`** — putaran adalah anak proyek; `forceDelete` proyek tidak boleh meninggalkan baris yatim |
| track | string | `qa` / `cyber`. Disimpan sebagai string biasa (bukan enum DB) dan dibaca lewat cast ke `TestingTrack`. Nilainya sama dengan `test_reports.test_type` |
| round_number | unsignedInteger | Nomor putaran, mulai dari `1`, dihitung **per (proyek, jalur)**. QA dan Siber punya penomoran masing-masing |
| test_report_id | FK test_reports (nullable) | **`nullOnDelete`** — laporan uji yang memicu pengembalian. Nullable karena putaran hasil backfill boleh tidak punya laporan yang masih dapat ditunjuk |
| returned_by | FK users, NOT NULL | **`restrictOnDelete`** — Lead yang menandatangani TIDAK LULUS. Identitas ini bukti tata kelola |
| returned_at | timestamp | Saat pengembalian |
| lead_notes | text (nullable) | Catatan Lead saat sign-off. **Salinan**, bukan bacaan lewat `test_report_id`: bukti alasan pengembalian harus tetap terbaca walau laporannya kelak hilang |
| severity | string (nullable) | Tingkat keparahan temuan, disalin dari laporan uji dengan alasan yang sama |
| status | string, default `OPEN` | `OPEN` / `RESUBMITTED` (`ReturnRoundStatus`). Sengaja **tidak** dicast di model — dibaca lewat `ProjectReturnRound::roundStatus()` agar baris yang nilainya tidak dikenal tidak melempar exception |
| resubmitted_by | FK users (nullable) | `nullOnDelete`. PM yang mengajukan ulang jalur tersebut |
| resubmitted_at | timestamp (nullable) | Saat putaran ditutup |
| resubmit_notes | text (nullable) | Catatan PM pada pengajuan ulang |
| created_at / updated_at | timestamp | |

**Indeks.**
- `unique(project_id, track, round_number)` — `return_rounds_project_track_number_unique`.
  Penomoran per jalur dijaga basis data, bukan hanya kode.
- `index(project_id, track, status)` — `return_rounds_project_track_status_index`.
  Bentuk kueri terpanasnya adalah "apakah jalur ini punya putaran terbuka".

**Makna di dalam alur.**
1. Sign-off `fail` pada satu jalur → kolom jalurnya `FAILED`, `projects.status` ke
   `RETURN_TO_DEV`, dan satu baris `OPEN` dibuka di sini.
2. PM membuat task perbaikan yang menunjuk putaran itu lewat
   `project_tasks.return_round_id`.
3. Jalur tersebut baru boleh diajukan ulang bila seluruh task perbaikan pada putaran
   terbuka sudah punya penerima dan selesai. Pengajuan ulang yang berhasil menutup
   putaran: `status = RESUBMITTED` beserta `resubmitted_by`, `resubmitted_at`, dan
   `resubmit_notes`.
4. Kegagalan berikutnya **tidak** membuka kembali putaran lama — ia membuat putaran baru
   dengan `round_number` berikutnya. `RESUBMITTED` tidak pernah kembali menjadi `OPEN`.

> **Putaran pengembalian tidak pernah dihapus.** Baris di sini adalah jejak audit
> pengembalian: siapa yang mengembalikan, kapan, dengan alasan apa, task perbaikan mana
> yang menjawabnya, dan siapa yang mengajukan ulang. Tidak ada endpoint yang menghapusnya,
> dan seluruh penulisan kolomnya dimiliki satu tempat saja: `ProjectReturnRoundService`.

## 3. `sit_uat_data` (JSON di projects)

Struktur lengkap:

```jsonc
{
  // Step aktif wizard
  "activeSitStep": 1,
  "activeUatStep": 1,

  // SIT Tahap 1
  "sit1_stagingUrl": "https://...",

  // SIT Tahap 2 — approval & bukti per task
  "sit2_task_approvals": {
    "task_10": {
      "approved": true,
      "comment": "...",
      "attachments": [{ "id": "...", "docId": 83, "name": "masked", "originalName": "...", "size": "1.23 MB", "type": "PDF", "url": "...", "uploadedAt": "..." }],
      "approvedAt": "ISO",
      "approvedBy": "Nama",
      "revisedAt": "ISO",
      "revisedBy": "Nama"
    }
  },
  "sit2_totalCases": 4, "sit2_passedCases": 3, "sit2_defects": 0,

  // SIT Tahap 3 — persetujuan
  "sit3_reviewNotes": "...",
  "sit3_approvals": {
    "developer": { "required": 2, "approvedCount": 2, "developers": [{ "userId": 19, "name": "...", "at": "..." }] },
    "pm": { "approved": true, "approvedBy": "...", "at": "..." },
    "development_lead": { "approved": true, "approvedBy": "...", "at": "..." }
  },

  // UAT Tahap 1
  "uat1_scenarioList": "...",
  "uat1_unit": "Divisi Operasional",
  "uat1_startDate": "2026-08-20",
  "uat1_preparedBy": "Nama PM",
  "uat1_participants": [
    { "id": "uuid", "name": "Pemohon", "role": "Pemohon", "unit": "Divisi...", "phone": "08xx", "isApprover": true, "approvalRole": "requester", "approvalMode": "external_link", "userId": null },
    { "id": "uuid", "name": "PM", "role": "PM / Analyst Pengembangan", "unit": "Divisi Pengembangan TI", "phone": "", "isApprover": true, "approvalRole": "analyst_pm", "approvalMode": "internal_account", "userId": 7 }
  ],
  "uat1_docs": [
    {
      "docId": 90,
      "doc_type": "UNDANGAN",
      "name": "001/GPTD/UNDANGAN/20-Agustus2026_NamaProyek.pdf",
      "originalName": "undangan.pdf",
      "type": "PDF",
      "url": "..."
    }
  ],

  // UAT Tahap 2 — snapshot per skenario; summary dihitung backend
  "uat2_scenarios": [
    {
      "id": "task_10", "taskId": 10, "scenario": "Unduh laporan",
      "result": "accepted|revision", "changeType": "minor|mayor|null",
      "request": "Detail perubahan bila revision", "comment": "...",
      "attachments": [{ "docId": 91, "doc_type": "UAT_EVIDENCE", "name": "masked", "originalName": "bukti.png" }]
    }
  ],
  "uat2_summary": {
    "executedCount": 20, "acceptedCount": 19, "revisionCount": 1,
    "minorCount": 1, "majorCount": 0,
    "conclusion": "accepted|minor_revision|major_revision",
    "notes": "...", "submittedBy": "...", "submittedById": 7, "submittedAt": "ISO"
  },
  // field legacy/kompatibilitas, selalu diturunkan dari summary
  "uat2_executedCount": 20, "uat2_passedCount": 19, "uat2_findings": 1, "uat2_execNotes": "...",

  // Penanda pengulangan UAT karena revisi Mayor.
  // Dibaca HANYA lewat Project::isUatRestartPending(), yang jatuh ke nama lama
  // `uat2_resume_after_sit` bila kunci baru belum ada pada baris lama.
  "uat_restart_after_sit": false,
  // Ditulis ProjectWorkflowService saat SIT ulang lulus. Perhatikan: tanpa awalan `uat2_`.
  "uat_sit_retest_passed_at": "ISO|absent",

  // UAT Tahap 3 — catatan/dokumen. Approval aktif disimpan pada tabel
  // uat_approval_rounds + uat_approvers; uat3_approvals hanya data legacy.
  "uat3_approvalNotes": "...",
  "uat3_approvals": {
    "business_user": { "approved": true, "approvedBy": "...", "at": "..." },
    "pm": { "approved": true, ... },
    "development_lead": { "approved": true, ... }
  },

  // Change Request UAT. Satu-satunya pintu masuk kini Eksekusi Pengujian UAT
  // (POST .../uat-execution): skenario ber-`result: "revision"` menghasilkan entri
  // dengan origin: "uat_execution", berstatus "open" bila task-nya masih harus dibuat,
  // "in_progress" bila task-nya sudah ada, lalu "resolved" saat task selesai, lalu
  // "sit_verified" saat SIT ulang lulus.
  //
  // Status "pending" → "approved"|"rejected" hanya muncul pada baris lama yang dulu
  // diajukan lewat POST .../uat-change-request. Endpoint itu sudah dihapus, tetapi
  // `POST .../uat-change-request/decision` tetap hidup untuk memutuskan baris tersebut,
  // jadi ketiga nilai status itu masih harus dibaca.
  "uat_change_requests": [
    { "id": "cr_...", "type": "minor|mayor", "title": "...", "detail": "...",
      "status": "pending|approved|rejected|open|in_progress|resolved|sit_verified",
      "submittedBy": "...", "submittedById": 7, "at": "ISO",
      "category": "UAT_EXECUTION|UAT_ADDITIONAL_REQUEST|...",
      "source": "scenario|additional_request", "sourceItemId": "task_10",
      "origin": "uat_execution", "cycle": 1, "taskId": 10, "attachments": [],
      "decisionBy": "...", "decisionAt": "ISO", "decisionNote": "...",
      "sitVerifiedAt": "ISO" }
  ],

  // Scope SIT ulang. mode 'full' = seluruh task aktif kecuali take_down (perilaku baru).
  // 'targeted' hanya tersisa pada baris produksi lama dan masih dihormati untuk baris itu;
  // Project::sitScopeTasks() mempersempit ke taskIds hanya bila mode === 'targeted'.
  // affectedItems bersifat penjelasan asal-usul, bukan pembatas scope.
  "sit_retest_scope": {
    "mode": "full|targeted", "cycle": 1,
    "status": "waiting_development|...", "taskIds": [],
    "affectedItems": [{ "source": "scenario|additional_request", "id": "task_10", "taskId": 10 }],
    "createdAt": "ISO"
  },

  // Hold UAT akibat revisi Mayor.
  // status: 'developer_revision' saat di-hold, 'uat_restart' setelah SIT ulang lulus.
  "uat_hold": { "cycle": 1, "status": "developer_revision|uat_restart", "resumeStep": 1,
                "heldAt": "ISO", "sitPassedAt": "ISO" },

  // Ringkasan per siklus revisi Mayor
  "uat_revision_cycles": [
    { "cycle": 1, "status": "developer_revision", "changeRequestIds": ["cr_..."],
      "affectedItems": [], "heldAt": "ISO", "heldBy": "Nama" }
  ],

  // Arsip append-only hasil eksekusi UAT yang dikosongkan karena revisi Mayor.
  // Ditulis UatExecutionService::holdForMajorRevision() SEBELUM kunci Tahap 2 dibersihkan,
  // sehingga approvals ikut terekam, bukan array yang sudah dikosongkan.
  // Satu entri per putaran; entri lama tidak pernah ditimpa atau dihapus.
  "uat_cycles": [
    { "cycle": 1, "summary": {}, "scenarios": [], "additionalRequests": [],
      "executedCount": 20, "passedCount": 19, "findings": 1, "execNotes": "...",
      "approvals": {}, "verificationHistory": [],
      "archivedAt": "ISO", "archivedBy": "Nama", "reason": "major_revision" }
  ],

  // Snapshot SIT lama sebelum data aktif direset untuk SIT ulang.
  // `scope` merekam `sit_retest_scope` siklus yang ditutup; bila siklus itu belum
  // punya scope (SIT pertama), nilainya jatuh ke mode 'full' dengan taskIds diambil
  // dari `uat2_scenarios`.
  "sit_cycles": [
    { "cycle": 1, "closedAt": "ISO", "reason": "UAT_MAJOR_REVISION", "taskApprovals": {},
      "reviewNotes": "...", "documents": [], "approvals": {},
      "scope": { "mode": "full", "taskIds": [] } }
  ],

  // Riwayat revisi
  "revisions": [ { "type": "SIT_TO_DEV|UAT_TO_SIT|UAT_TO_DEV|UAT_CHANGE_MAYOR|UAT_CHANGE_MINOR", "notes": "...", "at": "...", "by": "..." } ]
}
```

### Kunci yang sudah dipensiunkan

Kunci berikut **tidak pernah ditulis lagi**, tetapi masih mungkin ditemukan pada baris
produksi lama. Pembaca data harus menganggapnya opsional dan tidak boleh menjadikannya
dasar keputusan alur:

| Kunci pensiun | Penggantinya / keterangan |
|---|---|
| `uat2_verification_mode` | Tidak ada. Mode verifikasi item Mayor sudah dihapus seluruhnya. |
| `uat2_resume_after_sit` | `uat_restart_after_sit`. Nama lama **masih dibaca** sebagai fallback oleh `Project::isUatRestartPending()`, jadi tidak ada migrasi data yang diperlukan untuk baris in-flight. |
| `uat2_sit_retest_passed_at` | `uat_sit_retest_passed_at` (tanpa awalan `uat2_`). |
| `uat2_major_revision_verified_at` | Tidak ada. |
| `uat2_verification_history` | Tidak ada. Isi lamanya ikut terarsip ke `uat_cycles[].verificationHistory`. |
| `uat2_major_revision_resolved_at` | Tidak ada — kunci ini bahkan tidak pernah benar-benar terpakai. |

`UatExecutionService` membuang kunci-kunci ini setiap kali menyentuh sebuah baris, baik
pada jalur hold Mayor maupun pada submit tanpa temuan Mayor, sehingga baris bersih dengan
sendirinya seiring pemakaian.

Penanda pengulangan UAT **hanya boleh dibaca lewat `Project::isUatRestartPending()`**.
Membaca `uat_restart_after_sit` langsung akan salah menilai baris lama yang masih memakai
nama `uat2_resume_after_sit`.

### `uat1_participants` tidak pernah dikosongkan

Daftar peserta/penanda tangan UAT adalah hasil kesepakatan orang, bukan hasil eksekusi.
Tidak ada jalur kode yang mengosongkannya — tidak `holdForMajorRevision()`, tidak restart
UAT di `ProjectWorkflowService`, tidak migration perbaikan data. Hal yang sama berlaku
untuk `uat1_docs`.

Konsekuensinya: pada revisi Mayor, seluruh isi Tahap 2 dikosongkan (setelah diarsipkan ke
`uat_cycles`) sementara Tahap 1 tetap utuh. Orang yang sama membawa peran approval-nya ke
putaran berikutnya; PM boleh menambah atau memperbaiki entri, tetapi pengosongan ditolak
di lapisan API oleh `PATCH /projects/{id}`.

## 4. Persetujuan UAT terstruktur

`uat_approval_rounds` menyimpan setiap putaran persetujuan final per proyek dengan
status `active|completed|superseded`. `uat_approvers` menyimpan satu baris untuk
setiap orang, posisi approval, sisi peminta/IT, metode `external_link` atau
`internal_account`, keputusan, waktu, serta audit akses.

Token link dan token sesi eksternal hanya disimpan sebagai SHA-256 hash. Nomor HP
snapshot approver juga disimpan sebagai keyed hash serta bentuk masking; nilai asli
tetap berada pada data peserta UAT agar PM dapat memperbaikinya sebelum putaran dibuat.

Posisi wajib: pemohon, pimpinan grup pemohon, pimpinan divisi pemohon, minimal satu
developer, Analyst/PM, pimpinan grup pengembangan, serta pimpinan Divisi Teknologi
dan Digitalisasi.

### Keunikan approver bersifat per putaran, bukan global

`uat_approvers` memakai `unique(['uat_approval_round_id', 'participant_key'])` — sebuah
**unique komposit**, bukan unique global atas `participant_key`. `participant_key` diambil
dari `uat1_participants[].id` bila nilainya UUID yang sah; bila tidak, UUID baru dibuat.
Karena itu peserta yang sudah punya `id` UUID stabil akan membawa `participant_key` yang
sama melewati putaran-putaran berikutnya.

Justru inilah yang membuat roster terbawa antar putaran menjadi sah: satu orang hanya
boleh menempati **satu slot di dalam satu putaran**, tetapi `participant_key` yang sama
memang boleh — dan seharusnya — muncul kembali pada setiap putaran baru. Jadi ketika revisi
Mayor mengulang UAT, `uat1_participants` tidak perlu diubah sama sekali: putaran baru cukup
dibuat, dan orang yang sama menandatangani ulang terhadap hasil UAT yang terbaru.

`uat_approval_rounds` sendiri memakai `unique(['project_id', 'round_number'])`, sehingga
nomor putaran monoton per proyek.

### Supersession putaran

Putaran ditandai `superseded` (bukan dihapus) setiap kali proyek keluar dari
`UAT_IN_PROGRESS` menuju `UAT_REVISION_DEV`/`UAT_REVISION_SIT`, dari pintu mana pun —
termasuk `PATCH /projects/{id}/status` langsung. `UatApprovalService::supersedeRound()`
melakukan tepat tiga hal:

1. mengosongkan `link_token_hash`, `access_token_hash`, dan `access_expires_at` seluruh
   approver pada putaran itu;
2. mengubah baris berstatus `pending` menjadi `revoked`;
3. menyetel `status = 'superseded'` beserta `superseded_at` dan `superseded_reason`.

Baris berstatus `approved` **tidak disentuh** — keputusan yang pernah diberikan tetap
tersimpan sebagai jejak audit. Baris lama tidak pernah di-hard-delete, dan tidak lagi
dihitung oleh gerbang kelulusan yang hanya melihat putaran terbaru.

### Normalisasi penting (ProjectResource::normalizeSitUatData)
- `sit2_task_approvals` → key di-prefix `task_` (mis. `task_10`) agar PHP
  `json_encode` menghasilkan **object** bukan array. Frontend wajib strip prefix.

> Catatan `sit2_task_approvals[*].attachments`: `size` ditulis
> `frontend/src/components/SITTaskExecution.jsx` sebagai **string yang sudah diformat**
> (mis. `"1.23 MB"`), bukan jumlah byte, dan `type` adalah ekstensi huruf besar hasil
> tebakan dari nama berkas. Keduanya hanya untuk tampilan. Lampiran yang dibuat sebelum
> kedua field itu ada tidak memilikinya, jadi konsumen harus menanganinya sebagai nilai
> opsional — `formatDocSizeLabel()` di `frontend/src/utils/documentNaming.js` melakukan itu.

## 5. Enum

### ProjectStatus (project.status)
`PENDING, IN_REVIEW, ANALYSIS_APPROVED, REJECTED, READY_FOR_DEVELOPMENT,
DEV_ANALYSIS, DEV_ANALYSIS_DONE, IN_DEVELOPMENT, SIT_IN_PROGRESS, SIT_PASSED,
SIT_REVISION, UAT_IN_PROGRESS, UAT_REVISION_SIT, UAT_REVISION_DEV, DEV_COMPLETED,
READY_FOR_QA, QA_IN_PROGRESS, RETURN_TO_DEV, QA_PASSED, CYBER_IN_PROGRESS,
CYBER_PASSED, READY_FOR_UAT, UAT_PASSED, PENDING_GOLIVE, LIVE_PRODUCTION,
ON_HOLD, CANCELLED`

> `READY_FOR_UAT` adalah case legacy: masih ada di enum agar riwayat
> `project_status_histories` lama terbaca, tetapi sudah tidak punya transisi masuk
> maupun keluar di `ProjectWorkflowService`. Jangan dipakai untuk alur baru.

### TaskStatus (project_tasks.status)
`todo, in_progress, hold, done, take_down`

### TrackStatus (projects.qa_status / projects.cyber_status)
`NOT_SUBMITTED, SUBMITTED, IN_PROGRESS, REVIEW, PASSED, FAILED`

> `TrackStatus::normalize()` mengembalikan `NOT_SUBMITTED` untuk nilai yang tidak
> dikenal, supaya satu baris lama di luar enum tidak membuat pembacaan model melempar
> exception.

### ReturnRoundStatus (project_return_rounds.status)
`OPEN` (label "Menunggu Perbaikan"), `RESUBMITTED` (label "Sudah Diajukan Ulang")

> `ReturnRoundStatus::normalize()` mengembalikan **`OPEN`** untuk nilai yang tidak
> dikenal — arahnya sengaja berlawanan dengan `TrackStatus`. Nilai ini dipakai gerbang
> pengajuan ulang, dan gerbang yang gagal-terbuka menghapus gunanya gerbang: nilai rusak
> harus menahan, bukan meloloskan. `RESUBMITTED` tidak pernah kembali menjadi `OPEN`;
> kegagalan berikutnya membuat putaran baru.

### UserRole (users.role)
`super_admin, head_of_it, lead_group, analyst, development_lead, project_manager,
developer, qa_lead, qa_tester, cyber_lead, pentester, business_user`

> Frontend (router/menu) juga mengenal `dev_analyst` (PM modern) & `cyber_team`
> (alias tim cyber) yang TIDAK ada di enum backend — DB memakai
> `project_manager` & `cyber_lead`/`pentester`.

## 5. Migrations Terkini (relevan)

- `2026_08_14_..._add_team_allocated_by_pm...`
- `2026_08_15_..._add_revision_fields_to_project_tasks...`
- `2026_08_20_..._create_chat_messages_table...`
- `2026_08_21_..._add_contact_phone_to_projects...`
- `2026_08_23_000000_add_testing_track_assignees_to_projects_table` — `qa_assignee_id`, `cyber_assignee_id`
- `2026_08_23_000001_add_review_details_to_test_reports_table` — `severity`, `checklist`, `evidence_document_ids`, `reviewed_result`, `review_notes`, indeks `(project_id, test_type)`
- `2026_08_23_000002_add_cyber_check_type_to_projects_table` — `cyber_check_type`, `cyber_target_url`, `cyber_source_code_ref`
- `2026_08_23_000003_add_soft_deletes_and_protect_audit_trail` — `deleted_at` pada `users`/`projects`/`divisions`, dan tujuh kunci asing audit diubah dari `CASCADE` menjadi `RESTRICT`
- `2026_08_23_000004_add_release_decision_to_release_requests_table` — `downtime_estimate`, `rollback_plan`, `approved_by`, `rejected_at`, `rejected_by`, `rejection_notes` pada `release_requests`, plus backfill bagian berlabel dari `notes` lama
- `2026_08_23_000005_add_priority_to_projects_table` — `priority` pada `projects` (string, default `Medium`)
- `2026_08_24_000000_restart_uat_for_retired_verification_mode_projects` — perbaikan data: proyek yang tertahan pada mode verifikasi Mayor yang sudah dipensiunkan dikembalikan ke pengulangan UAT dari Tahap 1
- `2026_08_24_000001_null_fabricated_contact_phone_on_projects_table` — perbaikan data: `contact_phone` karangan dikosongkan
- `2026_08_24_000002_add_rbb_deadline_to_projects_table` — `rbb_deadline` pada `projects` (date, nullable)
- `2026_08_25_000000_add_tested_scenarios_to_test_reports_table` — `tested_scenarios` (text, nullable) pada `test_reports`. `checklist` dibiarkan utuh untuk laporan lama
- `2026_08_25_000001_create_groups_and_role_menu_access` — tabel `groups`, kolom `roles.group_id` (`nullOnDelete`) & `roles.menu_access` (json, nullable), plus backfill lima grup bawaan
- `2026_08_25_000002_create_project_return_rounds_table` — tabel `project_return_rounds`, kolom `project_tasks.return_round_id` (nullable, `nullOnDelete`), plus backfill putaran dari `test_reports` yang sudah ditolak Lead

> Migrasi sampai `2026_08_24_000002` **sudah dijalankan**: `000000`–`000002` pada batch 13,
> `000003` pada batch 14, `000004` pada batch 15, `000005` pada batch 16. Tabel `projects`
> kini memiliki 33 kolom.
>
> Ketiga migrasi `2026_08_25_*` **sudah dijalankan** di basis data pengembangan
> (diperiksa 25 Agustus 2026: `test_reports.tested_scenarios` ada, tabel `groups` ada,
> tabel `project_return_rounds` ada dengan 15 kolom dan `project_tasks.return_round_id`
> terindeks; baris terakhir tabel `migrations` adalah
> `2026_08_25_000002_create_project_return_rounds_table` pada batch 21). Backfill putaran
> pengembalian menghasilkan nol baris karena tidak ada `test_reports` dengan
> `reviewed_result = 'fail'` sekaligus `reviewed_by` terisi pada data tersebut — itu
> kondisi data, bukan kegagalan migrasi.
>
> Test suite memakai sqlite `:memory:` yang selalu bermigrasi dari nol, jadi selisih antara
> skema basis data sungguhan dan berkas migrasi **tidak** akan terlihat dari hasil test;
> verifikasi selalu lewat `php artisan migrate:status`. Perintah migrasi dijalankan
> pengguna sendiri.
>
> Catatan `000005`: karena kolomnya `NOT NULL` dengan default, MySQL mengisi 20 baris
> proyek yang sudah ada dengan `Medium`. Nilai itu bawaan sistem, bukan pilihan pengaju.
>
> Catatan `2026_08_25_000001`: backfill mencocokkan `roles.name` dan hanya menyentuh role
> yang `group_id`-nya masih `NULL`, sehingga menjalankan ulang migrasi (atau
> `migrate:refresh` di lingkungan lain) tidak pernah menimpa penempatan yang sudah diatur
> Super Admin. `down()` menghapus kolom lalu tabelnya, jadi penempatan grup ikut hilang —
> itu bukan data audit, jadi tidak ada yang perlu diselamatkan.
>
> Catatan `2026_08_25_000002`: backfill-nya idempoten. Ia membaca `test_reports` yang
> `reviewed_result = 'fail'` dengan `reviewed_by` terisi, melewati laporan yang sudah
> memiliki putaran, lalu membuat satu putaran per laporan. Sebuah putaran hasil backfill
> berstatus `OPEN` **hanya** bila laporannya adalah kegagalan terakhir pada (proyek, jalur)
> itu **dan** kolom jalurnya masih `FAILED`; selain itu ia langsung `RESUBMITTED` dengan
> `resubmit_notes` yang menyatakan bahwa putaran ini direkonstruksi dan jejak pengajuan
> ulangnya tidak tersimpan. `resubmitted_by` sengaja dibiarkan `NULL` — mengarang
> identitas pengaju ulang lebih buruk daripada mengakui ketidaktahuan. Task perbaikan lama
> tidak ditautkan ke belakang, karena tidak ada data yang dapat membuktikan task mana yang
> menjawab pengembalian mana.

## 6. Penghapusan Lunak & Proteksi Jejak Audit

Seluruh bukti tata kelola SDLC wajib dapat ditelusuri, jadi tidak ada data approval atau
histori yang boleh hilang karena satu pemanggilan `DELETE`.

**Penghapusan lunak.** `users`, `projects`, dan `divisions` memakai `SoftDeletes`. Baris
yang dihapus hanya ditandai `deleted_at` — hilang dari seluruh query biasa (termasuk
pencarian saat login dan penyelesaian token Sanctum, sehingga akun yang dihapus langsung
kehilangan akses) tetapi tetap dapat dipulihkan dan tetap dapat dibaca oleh catatan yang
menunjuk padanya.

**Aturan kunci asing menuju `users`.** Enam kolom audit bersifat `NOT NULL` dan kini
`RESTRICT`: `projects.created_by`, `project_status_histories.changed_by`,
`project_team_members.user_id`, `test_reports.tester_id`, `document_vaults.uploaded_by`,
`release_requests.requested_by`. Sebelumnya semuanya `CASCADE` — satu penghapusan
pengguna memusnahkan seluruh proyek yang pernah ia ajukan berikut semua anaknya.
`projects.division_id` diubah dengan alasan yang sama. Kolom audit yang lahir sesudahnya
mengikuti aturan yang sama: `release_requests.approved_by`, `release_requests.rejected_by`,
dan `project_return_rounds.returned_by` juga `RESTRICT`.

Kolom penugasan tetap `SET NULL` (`pm_id`, `analyst_id`, `qa_assignee_id`,
`cyber_assignee_id`, `project_tasks.assignee_id`, `project_tasks.revision_requested_by`,
`test_reports.reviewed_by`, `uat_approval_rounds.opened_by`, `uat_approvers.user_id`,
`chat_messages.user_id`, `activity_logs.user_id`,
`project_return_rounds.resubmitted_by`): atribusinya boleh hilang, barisnya
tidak. `notifications.user_id` tetap `CASCADE` karena notifikasi adalah kotak masuk
pribadi, bukan bukti audit. Kunci asing anak-ke-`projects` juga tetap `CASCADE`, agar
`forceDelete` yang disengaja tidak meninggalkan baris yatim — termasuk
`project_return_rounds.project_id`.

Dua kunci asing antar-tabel-anak memakai `SET NULL` supaya tautannya boleh hilang tanpa
membawa barisnya: `project_return_rounds.test_report_id` dan
`project_tasks.return_round_id`.

**Putaran pengembalian tidak memiliki endpoint penghapusan.** `project_return_rounds`
adalah jejak audit pengembalian jalur pengujian: tidak ada route `DELETE` untuknya, dan
tidak ada jalur kode yang menghapus barisnya. Penutupan sebuah putaran dilakukan dengan
mengubah `status` menjadi `RESUBMITTED`, bukan dengan menghapusnya.

**Pemeriksaan di controller** adalah lapis pertama yang memberi pesan manusiawi, database
adalah lapis terakhir:

| Endpoint | Penolakan |
|---|---|
| `DELETE /users/{id}` | 403 bila akun sendiri. 422 bila masih membawa jejak (proyek diajukan/dikelola/dianalisis, disposisi QA atau Siber, keanggotaan tim, task, perubahan status, laporan pengujian, dokumen, pengajuan rilis, approval UAT, pesan diskusi) — beserta rinciannya di `data.audit_trail_references`. Cabut akses lewat `is_active = false`, bukan penghapusan. `activity_logs` sengaja tidak dihitung sebagai penghalang |
| `DELETE /divisions/{id}` | 422 bila masih memiliki pengguna, atau masih memiliki proyek (termasuk yang sudah dihapus lunak) |
| `DELETE /projects/{id}` | 403 bila bukan Super Admin / Head of IT / PM proyek itu. 422 bila status `PENDING_GOLIVE` atau `LIVE_PRODUCTION` — gunakan transisi status `CANCELLED`. Penghapusan yang berhasil dicatat sebagai `delete_project` di `activity_logs` |
| `DELETE /documents/{id}` | 403 bila bukan pengunggah / pemohon / PM proyek / Super Admin / Head of IT. 404 bila proyek pemiliknya sudah dihapus lunak. 422 bila dokumen masih menjadi bukti: dirujuk `test_reports.evidence_document_ids`, `sit3_docs` setelah SIT lulus, `uat1_docs`/`uat3_docs` setelah UAT selesai, `uat3_docs` yang sudah diputuskan approver, atau tersimpan di histori `sit_cycles[].documents`. Alasannya dikirim di `data.reasons`; penolakan dicatat `delete_document_blocked` (status `error`), keberhasilan `delete_document` |
| `DELETE /groups/{id}` | 403 bila bukan Super Admin. 422 bila grup masih menaungi role — keluarkan role-nya dahulu di Manajemen Role. Penghapusan bersifat keras (`groups` tidak memakai `SoftDeletes`) karena grup hanyalah pengelompokan tampilan, bukan bukti tata kelola. Kunci asing `roles.group_id` bersifat `nullOnDelete`, jadi seandainya penghapusan lolos pemeriksaan pun role dan penggunanya tetap utuh — hanya kehilangan penempatan grupnya |

> Batasan implementasi saat ini: rujukan lampiran pada
> `sit2_task_approvals[*].attachments` dan bukti skenario UAT dibekukan dalam snapshot,
> tetapi belum ikut diperiksa oleh `DocumentController::auditTrailBlockers()` saat file
> dasar dihapus. Tabel di atas menggambarkan perlindungan yang benar-benar aktif, bukan
> seluruh rujukan dokumen yang secara konseptual seharusnya menjadi jejak audit.

> Perhitungan proyek pada dua pemeriksaan pertama memakai `withTrashed()`: proyek yang
> sudah dihapus lunak masih menempati tabel, jadi `RESTRICT` tetap berlaku atasnya.
