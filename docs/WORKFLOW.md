# NagariSDLC — Alur Kerja & State Machine

## 1. Diagram Alur Status Proyek

```
                  ┌──────────────┐
   (pemohon)      │   PENDING    │
                  └──────┬───────┘
                         ▼
                  ┌──────────────┐        ┌───────────┐
                  │  IN_REVIEW   │ ─────► │  REJECTED │
                  └──────┬───────┘        └───────────┘
                         ▼
                 ┌────────────────┐
                 │ANALYSIS_APPROVED│
                 └──────┬─────────┘
                        ▼
                 ┌─────────────────────┐
                 │READY_FOR_DEVELOPMENT │
                 └──────┬──────────────┘
                        ▼
                 ┌──────────────┐
                 │ DEV_ANALYSIS │
                 └──────┬───────┘
                        ▼
                 ┌─────────────────┐
                 │DEV_ANALYSIS_DONE │
                 └──────┬──────────┘
                        ▼
                 ┌─────────────────┐
                 │ IN_DEVELOPMENT  │◄────────────┐ (revisi mayor UAT / RETURN_TO_DEV)
                 └──────┬──────────┘             │
                        ▼                        │
                 ┌──────────────────┐            │
                 │ SIT_IN_PROGRESS  │            │
                 └──────┬───────────┘            │
                        ▼                        │
                 ┌──────────────┐                │
                 │ SIT_PASSED   │                │
                 └──────┬───────┘                │
                        ▼                        │
                 ┌─────────────────┐             │
                 │ UAT_IN_PROGRESS │             │
                 └──────┬──────────┘             │
                        ▼                        │
                 ┌────────────────┐              │
                 │ DEV_COMPLETED  │              │
                 └──────┬─────────┘              │
                        ▼                        │
                 ┌──────────────┐                │
                 │ READY_FOR_QA │                │
                 └──────┬───────┘                │
                        ▼                        │
          ┌─────────────────────┐   ┌──────────────────────┐
          │ QA_IN_PROGRESS      │   │ CYBER_IN_PROGRESS    │
          │ QA_PASSED           │   │ CYBER_PASSED         │
          └──────┬──────────────┘   └──────────┬───────────┘
                 │   (dua jalur paralel;       │
                 │    masing-masing bisa       │
                 │    RETURN_TO_DEV)           │
                 └───────────┬─────────────────┘
                             ▼
                 ┌─────────────────┐             │
                 │ PENDING_GOLIVE  │             │
                 └──────┬──────────┘             │
                        ▼                        │
                 ┌─────────────────┐             │
                 │ LIVE_PRODUCTION │             │
                 └─────────────────┘             │
                                                │
   Non-linear: ON_HOLD, CANCELLED, RETURN_TO_DEV
```

> Tidak ada UAT final setelah QA & Keamanan Siber. Begitu **kedua** jalur pengujian
> dinyatakan lulus (`projects.qa_status` dan `projects.cyber_status` = `PASSED`), PM
> langsung mengajukan migrasi & rilis ke Grup Infrastruktur (`PENDING_GOLIVE`).
> `READY_FOR_UAT` adalah status legacy: case enum-nya dipertahankan agar riwayat
> `project_status_histories` lama tetap terbaca, tetapi sudah tidak memiliki transisi
> masuk maupun keluar sehingga tidak dapat dicapai lagi.

> Setiap `RETURN_TO_DEV` dari QA/Keamanan Siber membuka satu **putaran pengembalian**
> (`project_return_rounds`) pada jalur yang menolak. Jalur itu baru boleh diajukan ulang
> setelah seluruh task perbaikan putaran tersebut selesai — lihat bagian 5.

## 1b. Tabel Transisi Valid (dari `ProjectWorkflowService::allowedTransitions`)

| Status Saat Ini | Status Tujuan (valid) |
|---|---|
| `PENDING` | IN_REVIEW, REJECTED, CANCELLED |
| `IN_REVIEW` | ANALYSIS_APPROVED, PENDING, REJECTED |
| `ANALYSIS_APPROVED` | READY_FOR_DEVELOPMENT, IN_REVIEW, REJECTED |
| `READY_FOR_DEVELOPMENT` | DEV_ANALYSIS, IN_DEVELOPMENT, ANALYSIS_APPROVED |
| `DEV_ANALYSIS` | DEV_ANALYSIS_DONE, READY_FOR_DEVELOPMENT, REJECTED |
| `DEV_ANALYSIS_DONE` | IN_DEVELOPMENT, DEV_ANALYSIS |
| `IN_DEVELOPMENT` | SIT_IN_PROGRESS, DEV_COMPLETED, DEV_ANALYSIS_DONE, ON_HOLD |
| `SIT_IN_PROGRESS` | SIT_PASSED, SIT_REVISION, IN_DEVELOPMENT |
| `SIT_PASSED` | UAT_IN_PROGRESS, DEV_COMPLETED, SIT_REVISION, IN_DEVELOPMENT |
| `SIT_REVISION` | SIT_IN_PROGRESS, IN_DEVELOPMENT |
| `UAT_IN_PROGRESS` | UAT_PASSED, DEV_COMPLETED, UAT_REVISION_SIT, UAT_REVISION_DEV |
| `UAT_REVISION_SIT` | SIT_IN_PROGRESS, UAT_IN_PROGRESS |
| `UAT_REVISION_DEV` | IN_DEVELOPMENT, SIT_IN_PROGRESS |
| `DEV_COMPLETED` | READY_FOR_QA, QA_IN_PROGRESS, CYBER_IN_PROGRESS, IN_DEVELOPMENT |
| `RETURN_TO_DEV` | IN_DEVELOPMENT, READY_FOR_DEVELOPMENT, READY_FOR_QA, QA_IN_PROGRESS, CYBER_IN_PROGRESS |
| `READY_FOR_QA` | QA_IN_PROGRESS, CYBER_IN_PROGRESS, DEV_COMPLETED, RETURN_TO_DEV, IN_DEVELOPMENT |
| `QA_IN_PROGRESS` | QA_PASSED, CYBER_IN_PROGRESS, CYBER_PASSED, RETURN_TO_DEV, READY_FOR_QA |
| `QA_PASSED` | CYBER_IN_PROGRESS, CYBER_PASSED, **PENDING_GOLIVE**, RETURN_TO_DEV, QA_IN_PROGRESS |
| `CYBER_IN_PROGRESS` | CYBER_PASSED, QA_IN_PROGRESS, QA_PASSED, RETURN_TO_DEV |
| `CYBER_PASSED` | **PENDING_GOLIVE**, QA_IN_PROGRESS, QA_PASSED, RETURN_TO_DEV, CYBER_IN_PROGRESS |
| `READY_FOR_UAT` | (legacy — tidak punya transisi masuk maupun keluar) |
| `UAT_PASSED` | DEV_COMPLETED, RETURN_TO_DEV |
| `PENDING_GOLIVE` | LIVE_PRODUCTION, QA_PASSED, CYBER_PASSED, RETURN_TO_DEV, REJECTED |
| `LIVE_PRODUCTION` | (terminal) |
| `REJECTED` | PENDING (re-open), IN_REVIEW |
| `ON_HOLD` | IN_DEVELOPMENT, PENDING |
| `CANCELLED` | (terminal) |

> Transisi tidak ada di tabel → ditolak oleh workflow (422/403).

**Prasyarat tambahan di luar tabel** (`validateTransitionPrerequisites()`):
`PENDING_GOLIVE` hanya sah bila `projects.qa_status` **dan** `projects.cyber_status`
sudah `PASSED`. Tabel di atas hanya mengizinkan *bentuk* transisinya (dari
`QA_PASSED` maupun dari `CYBER_PASSED`), karena matriks tidak dapat melihat status
jalur yang satunya. Jadi jalur mana pun yang sign-off lebih dulu boleh memegang
penunjuk status utama, tetapi pengajuan go-live dari satu jalur yang lulus sendirian
tetap ditolak dengan pesan yang menyebut jalur mana yang belum lulus.

Prasyarat kedua dari tempat yang sama: **status utama tidak boleh masuk fase pengujian
sebuah jalur selama jalur itu masih memiliki putaran pengembalian terbuka.** Aturannya
dinyatakan atas status **tujuan** — `READY_FOR_QA` dan `QA_IN_PROGRESS` memeriksa jalur QA,
`CYBER_IN_PROGRESS` memeriksa jalur Keamanan Siber, status tujuan lain tidak diperiksa —
apa pun status asalnya. Rinciannya di bagian 5.

## 1c. Otorisasi Role per Transisi (dari `rolePermissions`)

Role yang berhak **memindahkan proyek ke status berikut**:

| Status Tujuan | Role yang Diizinkan |
|---|---|
| `PENDING` | business_user, super_admin |
| `IN_REVIEW` | lead_group, super_admin |
| `ANALYSIS_APPROVED` | lead_group, analyst + qa_tester (grup Perencanaan-QA), super_admin |
| `REJECTED` | lead_group, analyst + qa_tester (grup Perencanaan-QA), head_of_it, super_admin |
| `READY_FOR_DEVELOPMENT` | lead_group, development_lead, super_admin |
| `DEV_ANALYSIS` | development_lead, super_admin |
| `DEV_ANALYSIS_DONE` | project_manager (alias `dev_analyst`), super_admin |
| `IN_DEVELOPMENT` | project_manager, developer, development_lead, super_admin |
| `SIT_IN_PROGRESS` | project_manager (alias `dev_analyst`), development_lead, developer, super_admin |
| `SIT_PASSED` | project_manager (alias `dev_analyst`), development_lead, super_admin |
| `SIT_REVISION` | project_manager (alias `dev_analyst`), development_lead, super_admin |
| `UAT_IN_PROGRESS` | project_manager (alias `dev_analyst`), business_user, super_admin |
| `UAT_REVISION_SIT` | project_manager (alias `dev_analyst`), business_user, super_admin |
| `UAT_REVISION_DEV` | project_manager (alias `dev_analyst`), business_user, super_admin |
| `DEV_COMPLETED` | project_manager (alias `dev_analyst`), development_lead, developer, super_admin |
| `RETURN_TO_DEV` | qa_lead, analyst + qa_tester (grup Perencanaan-QA), cyber_lead, pentester, lead_group, super_admin |
| `READY_FOR_QA` | project_manager (alias `dev_analyst`), super_admin |
| `QA_IN_PROGRESS` | qa_lead, lead_group, super_admin |
| `QA_PASSED` | analyst + qa_tester (grup Perencanaan-QA), qa_lead, lead_group, super_admin |
| `CYBER_IN_PROGRESS` | cyber_lead, super_admin |
| `CYBER_PASSED` | pentester, cyber_lead, super_admin |
| `READY_FOR_UAT` | (legacy — tidak ada transisi masuk, jadi tidak ada role) |
| `UAT_PASSED` | business_user, project_manager (alias `dev_analyst`), super_admin |
| `PENDING_GOLIVE` | project_manager (alias `dev_analyst`), super_admin |
| `LIVE_PRODUCTION` | head_of_it, super_admin |
| `ON_HOLD` | project_manager, development_lead, super_admin |
| `CANCELLED` | lead_group, head_of_it, super_admin |

> super_admin selalu diizinkan pada semua transisi.
>
> Konvensi grup pada tabel di atas:
> - **alias `dev_analyst`** — Project Manager adalah Analis Pengembangan (satu orang,
>   satu role). Router/menu frontend masih menyebutnya `dev_analyst`, jadi nama itu
>   diterima setara `project_manager` pada transisi PM/Analis Pengembangan.
> - **grup Perencanaan-QA** — `analyst` (Perencanaan, Fase 1) dan `qa_tester` (QA, Fase 3)
>   adalah kumpulan orang yang sama (`UserRole::PLANNING_QA_ANALYST_ROLES`). Keduanya
>   karena itu selalu muncul berpasangan; menghapus salah satunya membuat anggota grup
>   lolos gerbang penugasan tetapi gagal saat menyimpan hasil kerjanya.

Status revisi:
- `SIT_REVISION` — SIT gagal, kembali ke development.
- `UAT_REVISION_SIT` — status legacy; tidak dipakai untuk revisi minor baru.
- `UAT_REVISION_DEV` — UAT mayor: kembali ke development, SIT ulang menyeluruh, lalu UAT
  dijalankan ulang dari Tahap 1.
- `RETURN_TO_DEV` — dari QA/Cyber, kembali ke development. Transisi ini tidak
  dilakukan manual: sign-off `fail` dari Lead QA/Siber yang memindahkannya, sekaligus
  menandai kolom jalur menjadi `FAILED` dan membuka satu baris di
  `project_return_rounds`. Lihat bagian 5.

## 2. Alur Task

Status task (TaskStatus): `todo` (Belum Mulai), `in_progress` (Sedang Dikerjakan),
`hold` (Hold), `done` (Selesai), `take_down` (Take Down).

- **Revisi task** (dari SIT Tahap 2): task mundur ke `in_progress` +
  `revision_note` + `revision_requested_at/by` → developer melihat banner revisi.
- **Task perbaikan** (dari pengembalian QA/Keamanan Siber): task biasa yang dibuat
  dengan `return_round_id` menunjuk putaran pengembalian terbuka milik proyek itu.
  Kolomnya nullable — task tanpa `return_round_id` adalah task biasa. Selama satu saja
  task perbaikan pada putaran itu belum punya penerima atau belum `done`/`take_down`,
  jalur pengujiannya tidak dapat diajukan ulang. Lihat bagian 5.
- **Selesai task**: status `done` → `revision_note` otomatis dibersihkan +
  log `task_revision_completed`.

## 3. Alur SIT (Wizard, tab "SIT & UAT Internal")

### Gate masuk SIT
- Semua task (kecuali TAKE DOWN) harus `done`. `ProjectController@sitGate`.

### Tahap 1 — Persiapan
- URL staging (wajib), jumlah skenario otomatis = task selesai.
- Simpan → `activeSitStep=2`.

### Tahap 2 — Eksekusi Pengujian
- Tabel task: OK checkbox (approval per task), komentar/temuan,
  lampiran bukti per task (upload server), tombol **Revisi** (kembali ke dev).
- **Simpan sebagai Draft** menyimpan progres pengujian tanpa berpindah tahap
  (`activeSitStep` tetap `2`). Draft dapat diperbarui selama proses revisi berlangsung.
- Task yang pernah dikembalikan untuk revisi wajib selesai kembali, di-OK ulang, dan
  memiliki lampiran bukti baru yang diunggah setelah revisi diminta.
- **Simpan Final & Lanjut Approval** hanya aktif jika semua task selesai, semua task
  di-OK, dan seluruh bukti revisi sudah lengkap → `activeSitStep=3`.

#### Scope SIT ulang setelah revisi Mayor UAT
- SIT awal menggunakan seluruh task aktif proyek, kecuali `TAKE DOWN`.
- **SIT ulang setelah UAT Mayor memakai scope penuh yang sama** —
  `sit_retest_scope.mode = 'full'` dengan `taskIds: []`. Perbaikan Mayor menyentuh kode
  bersama sehingga dapat meregresi fungsi yang tidak diminta berubah; karena itu seluruh
  task aktif diuji ulang, bukan hanya yang direvisi. Hasil SIT siklus sebelumnya tetap
  tersimpan pada `sit_cycles`.
- `sit_retest_scope.affectedItems` tetap mencatat item Mayor yang memicu siklus, tetapi
  isinya **penjelasan asal-usul, bukan pembatas scope**.
- `mode = 'targeted'` hanya tersisa pada baris produksi lama dan masih dihormati untuk
  baris tersebut, supaya siklus yang sudah berjalan tidak berubah scope di tengah jalan.
  `Project::sitScopeTasks()` mempersempit ke `sit_retest_scope.taskIds` hanya bila
  `isSitRetestCycle()` benar **dan** `mode === 'targeted'`. Siklus baru tidak pernah
  ditulis dengan mode itu.
- `Project::isSitRetestCycle()` (dahulu `isTargetedSitRetest()`) kini hanya berarti
  "SIT ini milik siklus revisi", **bukan** "scope-nya dipersempit".
- Yang membedakan SIT ulang dari SIT pertama adalah **ketatnya bukti, bukan daftar
  task**. Pada transisi `SIT_PASSED`, tujuh prasyarat tambahan berlaku bila
  `isSitRetestCycle()` benar:
  1. scope SIT tidak boleh kosong;
  2. seluruh task scope berstatus `done`;
  3. seluruh task scope di-OK pada Eksekusi Pengujian (`sit2_task_approvals`);
  4. setiap task scope punya minimal satu lampiran bukti;
  5. setiap lampiran bukti berasal dari document vault proyek dan bertipe
     `SIT_TASK_EVIDENCE`;
  6. seluruh developer tim proyek sudah menyetujui;
  7. persetujuan PM **dan** Development Lead lengkap.

  Kewajiban **assignee** ditegakkan lebih awal, pada gerbang
  `UAT_REVISION_DEV → SIT_IN_PROGRESS`: setiap task Change Request Mayor siklus aktif wajib
  punya assignee dan berstatus `done` sebelum SIT ulang boleh dibuka.
- Approval developer pada SIT ulang diwajibkan kepada **seluruh developer tim proyek**
  (`Project::sitApprovalDeveloperIds()`), bukan hanya assignee task dalam scope.
  Approval PM dan Development Lead tetap wajib.

### Tahap 3 — Review & Sign-Off
- Ringkasan otomatis.
- **Persetujuan SIT** (muncul hanya jika `activeSitStep>=3`):
  - Developer (semua assignee) — dari My Tasks Dev.
  - PM / Analyst Pengembangan — dari Workspace Dev Analyst.
  - Development Lead — dari Workspace Dev Lead.
- **Dokumen Hasil Review / Berita Acara SIT wajib minimal 1** dan harus sudah
  tersimpan di server dengan tipe `SIT_RESULT` atau `SIT_SIGNOFF`.
- Tombol **"SIT Lulus"** aktif hanya jika 3/3 approve + catatan review +
  dokumen wajib telah diunggah. Backend menolak transisi `SIT_PASSED` jika
  dokumen belum tersedia.
  → `SIT_PASSED`.

## 4. Alur UAT

### Gate masuk UAT
- Setelah `SIT_PASSED`.

### Tahap 1 — Persiapan Skenario UAT
- Skenario otomatis dari task.
- Unit / Divisi Peminta (otomatis dari pemohon), Tanggal Pelaksanaan (wajib
  dipilih manual oleh PM; tidak memiliki nilai default), Disiapkan Oleh
  (otomatis dari PM).
- Peserta yang Terlibat (otomatis: pemohon + nomor kontak, PM, analyst, developer;
  bisa tambah manual) sekaligus menjadi sumber **matrix approver per orang**.
- Pihak peminta wajib terdiri dari pemohon, pimpinan grup, dan pimpinan divisi.
  Mereka tidak membutuhkan akun: PM membuat link pribadi dan penerima mencocokkan
  nomor HP terdaftar sebelum melihat hasil serta memberikan keputusan.
- Pihak IT terdiri dari minimal satu developer, Analyst/PM, pimpinan grup
  pengembangan, dan pimpinan Divisi Teknologi dan Digitalisasi. Setiap orang wajib
  ditautkan ke akun aktif dan menyetujui dari workspace aplikasi.
- **Dokumen Undangan UAT** (wajib minimal 1) — undangan untuk pihak berkepentingan.
  Gunakan tipe `UNDANGAN`; nama masking mengikuti format
  `XXX/GPTD/UNDANGAN/DD-BulanYYYY_NamaProyek.ext`.
- Simpan → `activeUatStep=2`.

### Tahap 2 — Eksekusi UAT
- UAT dilakukan sebagai demonstrasi/pengujian langsung oleh user pemohon.
- Setiap task aktif menjadi satu skenario. Untuk setiap skenario dicatat:
  hasil `accepted|revision`, tipe perubahan `minor|mayor` bila revisi,
  detail permintaan, komentar, dan lampiran `UAT_EVIDENCE`.
- Kebutuhan baru yang muncul langsung dari user dicatat sebagai **Permintaan Tambahan**
  terpisah dari skenario awal: judul task/request, tipe `minor|mayor`, detail,
  komentar, dan lampiran bukti.
- **Setiap Permintaan Tambahan menjadi satu task Change Request, baik Minor maupun
  Mayor.** Keduanya pekerjaan pengembangan yang harus terlihat di Manajemen Task, jadi
  keduanya dibuatkan task berstatus `todo` **tanpa assignee** — PM wajib menentukan
  developer yang sesuai. Yang membedakan hanya penanda di judul (`[CR UAT Minor] ` /
  `[CR UAT Mayor] `) dan prioritasnya (`Medium` untuk Minor, `High` untuk Mayor).
  Detail permintaan disalin ke `description` sekaligus `revision_note`, sehingga
  developer melihatnya sebagai banner revisi. Permintaan yang menunjuk task lama
  (`taskId` sudah terisi) tidak dibuatkan task kembar; task lamanya dibuka kembali
  oleh jalur hold.
- **Simpan sebagai Draft** menyimpan seluruh isian sementara tanpa mewajibkan semua
  skenario lengkap, tanpa mengunci snapshot, tanpa berpindah ke Tahap 3, dan tanpa
  menjalankan rollback atau membuat Change Request.
- Draft dapat diperbarui selama hasil pengujian, permintaan revisi, dan lampiran bukti
  masih dilengkapi. Lampiran yang sedang diunggah harus selesai sebelum draft disimpan.
- **Simpan Final** tetap memerlukan seluruh skenario valid. Hanya aksi final ini yang
  menjalankan keputusan Minor/Mayor dan melanjutkan alur sesuai kesimpulan UAT.
- Angka dieksekusi/diterima/revisi dan kesimpulan dihitung backend, bukan input manual.
- Setelah disubmit, snapshot Tahap 2 dikunci untuk menjaga jejak audit; lampiran tetap
  dapat dilihat/diunduh. Kunci ini berasal dari `uat2_summary.submittedAt`. Revisi Mayor
  mengosongkan `uat2_summary` setelah mengarsipkannya, jadi kuncinya ikut terlepas dan
  Tahap 2 dapat diisi kembali pada putaran berikutnya.
- Kesimpulan:
  - semua diterima → `activeUatStep=3`, lanjut Persetujuan Final;
  - ada minor tanpa mayor → `activeUatStep=3`; perbaikan dibantu developer tanpa
    rollback/SIT ulang, tetapi Persetujuan Final **ditahan** sampai seluruh CR Minor
    putaran itu selesai (lihat bagian 7);
  - ada mayor → otomatis menjadi Change Request, status `UAT_REVISION_DEV`, task
    terkait dibuka kembali, `activeUatStep=1`, dan UAT belum dapat disetujui.
- **Revisi Mayor mengulang dua siklus sekaligus, bukan hanya memverifikasi item
  Mayor.** Pekerjaan kembali ke developer, SIT diuji ulang menyeluruh, lalu UAT dimulai
  lagi dari **Tahap 1**: skenario disusun ulang, seluruhnya dieksekusi ulang, dan sebuah
  putaran persetujuan baru dibuka lewat Tahap 3 seperti biasa. Urutan lengkapnya ada di
  bagian 7.
- Alasannya: kesimpulan UAT yang lahir dari "hasil lama + tambalan item Mayor" bukan
  penilaian atas versi aplikasi yang benar-benar akan dirilis.
- **Mode verifikasi Mayor sudah dipensiunkan.** Flag `uat2_verification_mode`, endpoint
  `POST /projects/{id}/uat-major-verification`, `SubmitUatMajorVerificationRequest`,
  `UatExecutionService::verifyMajorRevisions()`, dan seksi UI-nya semuanya sudah dihapus.
  Tidak ada lagi keadaan "Tahap 2 baca-saja yang hanya menerima form verifikasi".
- Sebelum satu kunci pun dikosongkan, `UatExecutionService::holdForMajorRevision()`
  mengarsipkan putaran UAT yang sedang berjalan ke `sit_uat_data.uat_cycles`
  (append-only) — termasuk `uat3_approvals`-nya. Arsip itulah satu-satunya bukti bahwa
  putaran tersebut pernah dijalankan, siapa yang menyimpulkannya, dan apa kesimpulannya.
- **Daftar peserta/penanda tangan `uat1_participants` tidak pernah dikosongkan oleh jalur
  kode mana pun**, begitu pula `uat1_docs`. Lihat bagian 7 butir 6.

### Tahap 3 — Persetujuan Final
- Backend membuat snapshot `uat_approval_rounds` dan `uat_approvers` ketika hasil
  UAT final siap disetujui. Keputusan satu orang tidak memengaruhi slot orang lain.
- Pihak peminta: pemohon + pimpinan grup pemohon + pimpinan divisi pemohon melalui
  link pribadi dan pencocokan nomor HP.
- Pihak IT: seluruh developer yang ditetapkan + Analyst/PM + pimpinan grup
  pengembangan + pimpinan Divisi Teknologi dan Digitalisasi melalui akun aplikasi.
- Seluruh approver dapat memberikan keputusan secara paralel; tidak ada satu orang
  yang dapat mewakili slot orang lain.
- Link eksternal bersifat unik per orang, berlaku tujuh hari, dapat dibuat ulang,
  dan menghasilkan sesi akses 30 menit setelah nomor HP cocok. Penolakan wajib
  disertai alasan.
- Riwayat perubahan/Change Request dari Tahap 2 ditampilkan read-only.
- Approval ditolak backend bila Tahap 2 belum lengkap atau pengulangan UAT karena revisi
  Mayor belum tuntas. `UatApprovalService::startNewRound()` dan `assertActiveApprover()`
  keduanya memeriksa `Project::isUatRestartPending()`.
- Tombol **"UAT Lulus"** aktif hanya jika semua approver pada putaran terbaru
  menyetujui → `DEV_COMPLETED`.
- **Supersession putaran.** Setiap kali proyek keluar dari `UAT_IN_PROGRESS` menuju
  `UAT_REVISION_DEV` atau `UAT_REVISION_SIT`, seluruh putaran `active`/`completed`
  ditandai `superseded` di dalam transaksi transisi yang sama. Ini berlaku untuk semua
  pintu masuk revisi — termasuk `PATCH /projects/{id}/status` langsung — bukan hanya
  jalur Eksekusi UAT.
- Yang terjadi pada baris approver saat putaran di-supersede: seluruh token link dan
  sesi akses dibatalkan, baris berstatus `pending` menjadi `revoked`, sedangkan **baris
  `approved` dibiarkan apa adanya sebagai jejak audit**. Baris lama tidak pernah
  di-hard-delete dan tidak lagi dihitung untuk gerbang kelulusan.
- Putaran baru tidak dibuat saat hold. Ia dibuka menyusul lewat alur Tahap 3 yang normal,
  setelah UAT dijalankan ulang dari Tahap 1 dan `uat2_summary.conclusion` terisi kembali.
- **Seluruh penanda tangan menandatangani ulang terhadap hasil UAT yang terbaru.**
  Orangnya tetap orang yang sama — lihat bagian 7 butir 6 soal roster yang terbawa.

## 5. Alur QA & Cyber

Dua jalur pengujian ini **paralel dan independen**. Statusnya disimpan pada kolom
jalur `projects.qa_status` dan `projects.cyber_status` (enum `TrackStatus`:
`NOT_SUBMITTED` → `SUBMITTED` → `IN_PROGRESS` → `REVIEW` → `PASSED`/`FAILED`),
bukan pada `projects.status` yang hanya menyimpan satu penunjuk siklus utama.

Setiap jalur berjalan dalam **empat langkah, satu peran per langkah**, dan semuanya
melewati `TestingTrackService` sehingga jejak audit dan notifikasinya konsisten:

| Langkah | Pelaku | Endpoint | Efek pada kolom jalur |
|---|---|---|---|
| 1. Pengajuan | Analis Pengembangan pemegang disposisi (`pm_id`) atau `super_admin` | `POST /qa-requests/submit`, `POST /cyber-requests/submit` | `SUBMITTED`, `{track}_assignee_id` dikosongkan agar masuk antrean Lead lagi; endpoint yang sama dipakai untuk pengajuan ulang setelah pengembalian, dan menutup putaran yang terbuka |
| 2. Disposisi pelaksana | `qa_lead` / `lead_group` untuk QA, `cyber_lead` untuk Siber | `POST /{track}-requests/assign` | `IN_PROGRESS` + `qa_assignee_id` / `cyber_assignee_id` terisi; ditolak bila jalur `FAILED` dan putaran pengembaliannya masih terbuka |
| 3. Laporan pengujian | Pelaksana yang tercatat pada kolom assignee (Lead jalur juga boleh) | `POST /{track}-requests/report` | `REVIEW`; membuat baris `test_reports` dan melampirkan bukti dari vault dokumen |
| 4. Sign-off | Lead jalur | `POST /{track}-requests/sign-off` | `PASSED`, atau `FAILED` + satu putaran pengembalian baru |

Pemisahan langkah 3 dan 4 disengaja: pelaksana melaporkan temuan (boleh
`conditional_pass`), Lead yang memutuskan lulus atau kembali ke development, dan
keputusan Lead selalu biner (`pass` / `fail`).

### Gerbang masuk fase pengujian

Pengujian QA dan Keamanan Siber adalah fase **sesudah** pengembangan. Proyek hanya
dapat diajukan bila `projects.status` berada pada salah satu dari:

`DEV_COMPLETED`, `RETURN_TO_DEV`, `READY_FOR_QA`, `QA_IN_PROGRESS`, `QA_PASSED`,
`CYBER_IN_PROGRESS`, `CYBER_PASSED`

- `DEV_COMPLETED` adalah pintu utamanya — penanda bahwa SIT dan UAT Internal selesai.
- `RETURN_TO_DEV` disertakan agar proyek yang dikembalikan karena defect bisa diajukan
  ulang langsung setelah perbaikan, tanpa mengulang seluruh siklus SIT/UAT. "Setelah
  perbaikan" di sini bukan kelonggaran: gerbang putaran pengembalian menahan pengajuan
  ulang sampai seluruh task perbaikan putaran itu selesai (lihat di bawah).
- Lima status sisanya disertakan karena kedua jalur berjalan paralel: penunjuk siklus
  utama bisa sedang dipegang jalur lain saat PM mengajukan jalur yang belum berjalan.

Status pengembangan (`IN_DEVELOPMENT`, `SIT_*`, `UAT_*`) **tidak** termasuk. Gerbang ini
ditegakkan di tiga tempat yang harus tetap sinkron:

1. `TestingTrackService::SUBMITTABLE_MAIN_STATUSES` — pemeriksaan yang menolak request.
2. `ProjectWorkflowService::$allowedTransitions` — `IN_DEVELOPMENT` tidak lagi punya
   jalan langsung ke `READY_FOR_QA` / `QA_IN_PROGRESS` / `CYBER_IN_PROGRESS`.
3. `STATUSES_ALLOWING_QA_TRACK_START` & `STATUSES_ALLOWING_CYBER_TRACK_START` di
   `frontend/src/constants/projectStatus.js` — penyaring daftar proyek di layar PM.

Pemeriksaan nomor 1 tidak bisa digantikan matriks transisi saja: pengajuan jalur Siber
sengaja tidak menggerakkan status utama, jadi tanpa gerbang eksplisit proyek yang masih
dikembangkan tetap dapat masuk antrean audit keamanan.

1. PM mengajukan QA (`/pm/qa-request`) dan Keamanan Siber (`/pm/cyber-request`).
   Urutan pengajuan bebas dan boleh bersamaan. Pada pengajuan Siber, PM memilih
   **jenis pemeriksaan** — `pentest` (wajib mengisi alamat web target,
   `projects.cyber_target_url`) atau `secure_code` (wajib mengisi rujukan kode
   sumber, `projects.cyber_source_code_ref`) — dan pilihannya tersimpan pada
   `projects.cyber_check_type`. **Jenis pemeriksaan tidak menentukan daftar skenario
   wajib** — ia hanya menentukan istilah yang ditampilkan dan masukan mana yang wajib
   diisi. Ruang lingkup audit keamanan berbeda pada tiap proyek, jadi pelaksana
   menarasikan lingkup dan temuannya pada catatan laporan
   (`test_reports.tested_scenarios`). Dua daftar tetap enam skenario
   (`CYBER_CHECKLIST_ITEMS` dan `getCyberChecklistItems()`) sudah dihapus pada
   25 Agustus 2026; kolom `test_reports.checklist` dipertahankan hanya sebagai kolom
   warisan untuk laporan lama.
2. QA dan Siber mengerjakan di workspace masing-masing lalu Lead memberi sign-off
   pada jalurnya sendiri (`QA_PASSED` / `CYBER_PASSED`).
3. Sign-off `fail` pada salah satu jalur menandai jalur itu `FAILED`, memindahkan
   proyek ke `RETURN_TO_DEV`, dan **membuka satu putaran pengembalian** pada
   `project_return_rounds` → kembali ke development → SIT/UAT internal ulang sesuai
   kebutuhan. Wewenang `RETURN_TO_DEV` dimiliki `qa_lead`, `qa_tester`, `cyber_lead`,
   `pentester`, dan `lead_group`. Ketiga hal itu terjadi dalam satu transaksi: bila
   status utama gagal dipindahkan, seluruh sign-off dibatalkan agar tidak ada jalur
   bertanda TIDAK LULUS sementara proyek tetap duduk di antrean rilis. Alur
   pengembalian sampai pengajuan ulang dijelaskan di bawah.
4. Setelah **kedua** jalur `PASSED`, kendali kembali ke PM: PM mengajukan migrasi &
   rilis ke Grup Infrastruktur lewat `/pm/release-request`
   (`POST /api/v1/release-requests` → `PENDING_GOLIVE`). Tidak ada UAT final di
   antara sign-off pengujian dan pengajuan go-live.
5. Head of IT menyetujui pada Quality Gate (`POST /api/v1/quality-gate/approve`) →
   `LIVE_PRODUCTION`, atau menolak → `REJECTED` / `RETURN_TO_DEV`.

### Putaran Pengembalian (`project_return_rounds`)

Sign-off `fail` tidak berhenti pada penandaan `FAILED`. Ia membuka satu **putaran
pengembalian** — satu baris `project_return_rounds` yang menjawab pertanyaan "jalur mana
yang menolak, apa pesan Lead-nya, dan apa saja yang harus selesai sebelum jalur itu boleh
diajukan ulang". Tanpa baris itu, `RETURN_TO_DEV` hanya sebuah status tanpa keterangan.

Satu putaran, dari lahir sampai tutup:

1. **Dibuka** oleh sign-off `fail` (`ProjectReturnRoundService::open()`), pada transaksi
   yang sama dengan penandaan `FAILED` dan transisi `RETURN_TO_DEV`. Nomor putaran
   (`round_number`) berjalan naik per jalur, dihitung dengan `lockForUpdate()` agar dua
   sign-off gagal yang tiba hampir bersamaan tidak menghasilkan nomor kembar. Catatan
   Lead disalin ke `lead_notes`; bila Lead tidak menuliskannya, catatan pelaksana
   pengujian dipakai sebagai gantinya supaya putaran tidak pernah lahir tanpa satu pun
   keterangan yang dapat dibaca pengembang. Tingkat keparahan laporan disalin ke
   `severity`. Sebutan barisnya — dipakai di seluruh pesan sistem — berbentuk
   `Pengujian QA — Pengembalian ke-2` atau `Audit Keamanan Siber — Pengembalian ke-1`.
2. **Task perbaikan dibuat** lewat `POST /projects/{projectId}/tasks` dengan
   `return_round_id` menunjuk putaran terbuka milik proyek itu — pada praktiknya oleh
   Analis Pengembangan pemegang disposisi; wewenangnya sama dengan wewenang mengubah
   proyek (`ProjectAccessService::canUpdate()`). Kolomnya nullable: task biasa tetap
   dibuat tanpa `return_round_id`. Penerima task wajib anggota tim yang sudah
   dialokasikan ke proyek itu, jadi task perbaikan tanpa alokasi tim tidak akan pernah
   lolos gerbang nomor 2 di bawah. Penautan hanya terjadi saat pembuatan — tidak ada
   jalur untuk menautkan task lama ke sebuah putaran belakangan.
3. **Diajukan ulang** lewat endpoint pengajuan yang sama seperti pengajuan pertama
   (`POST /qa-requests/submit`, `POST /cyber-requests/submit`) — tidak ada endpoint
   pengajuan ulang tersendiri. Pengajuan yang lolos gerbang menutup putarannya pada
   transaksi yang sama: `status` menjadi `RESUBMITTED`, plus `resubmitted_by`,
   `resubmitted_at`, dan `resubmit_notes` (catatan pengajuan). Baris audit
   `update_project_track_status` pengajuan itu membawa `return_round_id`,
   `return_round_number`, dan `resubmitted_fix_task_count`; notifikasi ke Lead pun
   berubah bunyinya menjadi "Diajukan Ulang".
4. **Tidak pernah dihapus.** Sisi pengujian barisnya tidak pernah ditimpa, dan
   `RESUBMITTED` tidak pernah kembali menjadi `OPEN`. Putaran tertutup adalah riwayat
   lengkap: siapa mengembalikan, apa pesannya, task apa yang lahir, siapa mengajukan
   ulang, dan kapan. Tidak ada endpoint penghapusan putaran.

#### Gerbang keras pengajuan ulang

Satu jalur yang punya putaran terbuka **hanya boleh diajukan ulang bila seluruh task
perbaikan putaran itu benar-benar selesai**. Tiga hal ditolak, dalam urutan pemeriksaan
`ProjectReturnRoundService::assertResubmitAllowed()`:

| # | Ditolak bila | Alasannya |
|---|---|---|
| 1 | Putaran terbuka tanpa satu pun task perbaikan | Pengembalian yang tidak melahirkan task berarti tidak ada perbaikan yang tercatat, jadi tidak ada yang dapat dinyatakan selesai — aturan yang sama dipakai gerbang SIT ulang terhadap scope kosong |
| 2 | Ada task perbaikan tanpa penerima (`assignee_id` kosong) | Task tanpa penerima tidak punya penanggung jawab, sehingga "sudah dikerjakan" tidak dapat dipertanggungjawabkan siapa pun — cerminan gerbang `UAT_REVISION_DEV → SIT_IN_PROGRESS` |
| 3 | Ada task perbaikan yang belum selesai | Hanya `done` dan `take_down` yang dianggap tidak menahan; `take_down` dikecualikan karena permintaan yang dibatalkan secara sadar tidak boleh mengunci proyek selamanya |

Pesan penolakannya menyebut sebutan putaran dan menyebutkan task yang menahan sebagai
`#{id} {judul}`, supaya task yang dimaksud tetap dapat ditemukan meski ada dua task
berjudul mirip pada putaran yang sama.

Gerbang ini ditegakkan di **tiga tempat**, dan ketiganya membaca satu sumber kebenaran
yang sama:

1. `TestingTrackService::submitRequest()` — jalan masuk resmi pengajuan ulang oleh Analis
   Pengembangan. Memanggil `assertResubmitAllowed()`. Diletakkan **sesudah** pemeriksaan
   keadaan dasar (jalur sudah berjalan / sudah lulus) supaya pengajuan ganda tetap
   dijawab pesannya sendiri, bukan pesan "perbaikan belum selesai" yang menyesatkan.
2. `TestingTrackService::assignTester()` — menahan Lead yang mencoba menghidupkan
   kembali jalur gagal langsung dari disposisi, tanpa melewati `submitRequest()` sama
   sekali. Membaca `Project::openReturnRound()` dan menolak dengan bahasa yang menyebut
   siapa yang sedang ditunggu; pesan gerbang nomor 3 ditulis untuk Analis Pengembangan
   ("kerjakan task perbaikannya"), sehingga Lead yang membacanya tidak akan mengerti apa
   yang harus ia lakukan. Penolakan di sini disyaratkan pada **adanya putaran terbuka**,
   bukan pada status `FAILED` saja: jalur `FAILED` tanpa putaran terbuka — anomali data,
   atau proyek yang lebih tua daripada fitur ini — tetap berperilaku seperti sebelumnya,
   bukan terkunci permanen.
3. `ProjectWorkflowService::validateTransitionPrerequisites()` — menutup pintu belakang
   `PATCH /projects/{id}/status`, yang dapat mendorong status utama langsung ke fase
   pengujian tanpa melewati service jalur. Memanggil `assertResubmitAllowed()` yang sama.

**Gerbang nomor 3 adalah invarian atas status tujuan, bukan atas status asal:** status
utama tidak boleh masuk fase pengujian sebuah jalur selama jalur itu punya putaran
terbuka, dari mana pun ia datang.

| Status tujuan | Jalur yang diperiksa |
|---|---|
| `READY_FOR_QA`, `QA_IN_PROGRESS` | QA |
| `CYBER_IN_PROGRESS` | Keamanan Siber |
| lainnya | tidak diperiksa |

Membatasinya pada status asal `RETURN_TO_DEV` tidak cukup, karena matriks transisi juga
mengizinkan masuk fase pengujian dari `READY_FOR_QA`, `QA_IN_PROGRESS`, `QA_PASSED`,
`CYBER_IN_PROGRESS`, dan `CYBER_PASSED`. Contoh nyatanya: QA mengembalikan proyek, lalu
Lead Keamanan Siber mendisposisikan jalurnya sehingga status utama pindah ke
`CYBER_IN_PROGRESS` secara sah — sejak titik itu proyeknya tidak lagi berstatus
`RETURN_TO_DEV`, dan gerbang yang mensyaratkan status tersebut tidak akan pernah menyala
lagi meski perbaikan QA-nya belum satu pun selesai.

**Penilaiannya per jalur.** Dua jalur berjalan paralel, jadi proyek yang dikembalikan
Keamanan Siber tetap boleh memulai Pengujian QA yang belum jalan. Jalur tanpa putaran
terbuka selalu lolos tanpa efek samping — termasuk pengajuan pengujian pertama kali,
yang memang bukan pengajuan ulang.

> Frontend tidak menurunkan ulang aturan ini. Payload proyek membawa `return_rounds`
> dengan `can_resubmit` dan `resubmit_blocker` yang dihitung server, sehingga tombol
> "Ajukan Ulang" dan gerbangnya tidak dapat berbeda pendapat. Rinciannya di
> `API_REFERENCE.md`.

## 6. Approval Multi-Role — Ringkasan

| Tahap | Role yang approve | Tombol lulus |
|---|---|---|
| SIT | Developer (semua), PM, Dev Lead | "SIT Lulus" |
| UAT | 3 pihak peminta + seluruh approver IT yang ditetapkan | "UAT Lulus" |

## 7. Change Request UAT — Alur Maju-Mundur

Revisi **minor** diperbaiki di tempat: masuk laporan, dibantu developer, tanpa rollback,
tanpa SIT ulang, dan tanpa mengubah status proyek — proyeknya tetap `UAT_IN_PROGRESS`
karena tahapnya tidak mundur, dan `activeUatStep` tetap `3`. Yang **ditahan** adalah
keputusan persetujuannya, bukan tahapnya:

- `UatExecutionService::holdForMinorRevision()` membuat satu Change Request bertipe
  `minor` per item, menambah satu siklus pada `uat_revision_cycles`, dan menyetel
  `uat_hold` = `{ status: 'developer_revision', reason: 'minor_revision', resumeStep: 3 }`.
  Permintaan Minor lama yang masih terbuka di-`superseded` lebih dulu: hasil eksekusi
  terbaru adalah pernyataan resmi tentang apa yang masih perlu diperbaiki.
- Task sumber skenario dibuka kembali ke `in_progress` beserta `revision_note`. Task
  Permintaan Tambahan tidak dibuka ulang di sini — task-nya memang baru dibuat di
  `submit()`, lengkap dengan catatan revisinya, dan CR-nya berstatus `open` sampai PM
  menugaskannya.
- Penahanan itu dibaca `Project::isUatMinorRevisionPending()` di **dua** tempat:
  `UatApprovalService` menolak keputusan persetujuan ("Persetujuan UAT ditahan sampai
  perbaikan revisi Minor diselesaikan tim pengembangan."), dan
  `ProjectWorkflowService` menolak transisi ke `DEV_COMPLETED`. Alasannya sama: berita
  acara UAT menjadi dasar rilis, jadi tanda tangan tidak boleh jatuh pada versi aplikasi
  yang perbaikannya belum dikerjakan.
- Karena revisi Minor tidak menggerakkan status, notifikasi berbasis transisi tidak
  terpicu; `notifyMinorRevisionRequested()` memberitahu langsung assignee task yang
  dibuka kembali, PM proyek, `development_lead`, dan `super_admin`.
- Hold-nya lepas sendiri: saat sebuah task diselesaikan,
  `TaskController::update()` memanggil `releaseMinorRevisionHold()`, yang menyetel
  `uat_hold.status` menjadi `released` begitu seluruh CR Minor siklus itu `resolved`,
  lalu memberi tahu para penanda tangan bahwa persetujuan sudah dapat dilanjutkan.
- `uat_restart_after_sit` justru ditegaskan `false` agar `Project::isSitRetestCycle()`
  tidak salah membaca siklus Minor sebagai SIT ulang.

Revisi **mayor mengulang dua siklus secara penuh** — SIT ulang menyeluruh, lalu UAT dari
Tahap 1. Urutan lengkapnya, satu siklus dari awal sampai akhir:

1. **Kesimpulan UAT dengan temuan Mayor.** User menguji tiap skenario dan boleh mencatat
   permintaan tambahan baru. Pada **Simpan Final** (`POST /projects/{id}/uat-execution`),
   setiap skenario atau permintaan tambahan bertipe `mayor` dikumpulkan menjadi
   `majorWorkItems`. `activeUatStep` diset `1` — bukan `2`, bukan `3`.

2. **UAT di-hold.** `UatExecutionService::holdForMajorRevision()` dijalankan dan, dalam
   urutan ini:
   - mengarsipkan putaran UAT berjalan ke `uat_cycles` (`reason: 'major_revision'`)
     **sebelum** satu kunci pun dikosongkan, termasuk `uat3_approvals`-nya;
   - menutup siklus SIT berjalan ke `sit_cycles`;
   - membuat satu Change Request per item Mayor pada `uat_change_requests`, berstatus
     `in_progress` bila task-nya sudah ada atau `open` bila task-nya masih harus dibuat;
   - membuka kembali task terkait ke `in_progress` beserta `revision_note`;
   - menulis `sit_retest_scope` dengan `mode: 'full'`, `taskIds: []`,
     `status: 'waiting_development'`;
   - menyalakan `uat_restart_after_sit = true` dan `uat_hold.status =
     'developer_revision'` dengan `resumeStep: 1`;
   - mengosongkan hasil eksekusi Tahap 2 dan mereset SIT ke `activeSitStep = 1`;
   - menutup `activeUatStep = 1`.

   Putaran persetujuan aktif kemudian di-`superseded`, dan proyek berpindah ke
   `UAT_REVISION_DEV`. Jalur kedua — keputusan CR Mayor lewat
   `POST /projects/{id}/uat-change-request/decision` — memanggil
   `holdForMajorRevision()` yang sama, sehingga kedua pintu meninggalkan bentuk
   `sit_uat_data` yang identik.

3. **Pekerjaan developer.** PM meng-assign task Change Request yang belum bertuan (CR
   berstatus `open`). Saat sebuah task selesai (`done`), CR-nya berpindah
   `open`/`in_progress` → `resolved`.

4. **SIT ulang dibuka.** Transisi `UAT_REVISION_DEV → SIT_IN_PROGRESS` ditolak selama
   masih ada CR Mayor pada siklus aktif yang belum `resolved`, atau ada task CR Mayor yang
   belum punya assignee / belum `done`. SIT dijalankan dari Tahap 1 dengan **scope penuh**
   — seluruh task aktif kecuali `TAKE DOWN`, bukan hanya yang direvisi. Prasyarat
   buktinya lebih ketat daripada SIT pertama; rinciannya di bagian 3.

5. **SIT lulus → UAT restart.** Pada transisi `SIT_PASSED → UAT_IN_PROGRESS`, bila
   `Project::isUatRestartPending()` benar, `ProjectWorkflowService`:
   - menyetel `activeUatStep = 1`;
   - mematikan `uat_restart_after_sit` dan membuang sisa penanda lama;
   - menulis `uat_sit_retest_passed_at` (perhatikan: **tanpa** awalan `uat2_`);
   - memindahkan CR `resolved` → `sit_verified` beserta `sitVerifiedAt`;
   - menyetel `uat_hold.status = 'uat_restart'` beserta `sitPassedAt`.

   `sit_verified` berarti perbaikannya sudah divalidasi SIT; penerimaan oleh pengguna
   menyusul saat UAT dijalankan ulang.

6. **UAT dijalankan ulang dari Tahap 1.** Skenario disiapkan lagi, seluruhnya —
   bukan hanya item Mayor — dieksekusi ulang, lalu Tahap 2 disimpan final seperti biasa.

   > **Daftar penanda tangan UAT terbawa, tidak pernah diketik ulang.**
   > `sit_uat_data.uat1_participants` (dan `uat1_docs`) **tidak dikosongkan oleh jalur
   > kode mana pun** — tidak oleh `holdForMajorRevision()`, tidak oleh restart di
   > `ProjectWorkflowService`, tidak oleh migration perbaikan data. Orang yang sama
   > membawa peran approval-nya ke putaran berikutnya; PM boleh **menambah** atau
   > memperbaiki entri, tetapi tidak ada satu pun kondisi bisnis yang membenarkan daftar
   > ini kembali kosong. `PATCH /projects/{id}` bahkan menolak pengosongannya secara
   > eksplisit (lihat `API_REFERENCE.md`).
   >
   > Yang membuat carry-over ini sah di tingkat basis data: `uat_approvers` memakai
   > `unique(uat_approval_round_id, participant_key)` — **komposit, bukan global** —
   > sehingga `participant_key` yang sama memang boleh muncul kembali pada setiap putaran
   > baru.

7. **Putaran persetujuan baru.** Setelah `uat2_summary.conclusion` terisi kembali,
   Tahap 3 membuka putaran baru lewat alur normal. Putaran sebelumnya tetap
   `superseded`: baris `pending`-nya sudah `revoked`, sedangkan baris **`approved`
   disimpan sebagai jejak audit** dan tidak dihitung untuk gerbang kelulusan. Seluruh
   penanda tangan menandatangani ulang terhadap hasil UAT yang terbaru.

8. **Masih ada temuan Mayor lagi?** Siklus berikutnya berulang dari butir 1 dengan nomor
   `uat_hold.cycle` bertambah satu, dan putaran UAT yang baru saja gagal ikut diarsipkan
   ke `uat_cycles`. Bila semua diterima → `activeUatStep = 3` → approval final →
   `DEV_COMPLETED` → QA/Cyber.

Gerbang `DEV_COMPLETED` menolak selama `Project::isUatRestartPending()` masih benar,
dengan pesan: *"Revisi Mayor UAT belum selesai. Selesaikan SIT ulang dan jalankan UAT
dari awal sebelum proyek dapat dinyatakan DEV_COMPLETED."*

**Change Request UAT kini hanya punya satu pintu lahir: Eksekusi UAT Tahap 2.** Endpoint
pengajuan CR manual `POST /projects/{id}/uat-change-request` sudah dihapus — rutenya
tidak ada lagi, layarnya tidak ada lagi, dan wrapper `submitUatChangeRequest` di
`frontend/src/services/api.js` ikut dihapus. Alasannya: CR yang dihasilkannya tidak
membawa `cycle`, sehingga tidak pernah terlihat oleh gerbang
`UAT_REVISION_DEV → SIT_IN_PROGRESS`.

Endpoint keputusan `POST /projects/{id}/uat-change-request/decision` masih terdaftar dan
wrapper `decideUatChangeRequest` masih ada, tetapi **tidak ada satu pun layar yang
memanggilnya** — keputusan minor/mayor sudah ditetapkan otomatis dari kesimpulan
eksekusi UAT. Bila endpoint itu dipakai langsung, keputusan minor tidak memindahkan
status, sedangkan keputusan mayor memanggil `holdForMajorRevision()` yang sama dengan
alur di atas.

> **Mode verifikasi Mayor sudah dipensiunkan.** Dahulu SIT ulang bersifat *terarah* dan
> UAT hanya *dilanjutkan* di Tahap 2 (`uat2_verification_mode = true`) untuk memverifikasi
> item Mayor saja lewat `POST /projects/{id}/uat-major-verification`. Flag, endpoint,
> Form Request, method controller, method service (`verifyMajorRevisions()`), dan seksi
> UI-nya sudah dihapus seluruhnya. Baris produksi yang masih tertahan di keadaan itu
> diperbaiki oleh migration `2026_08_24_000000_restart_uat_for_retired_verification_mode_projects`
> — lihat catatan status penerapannya di `AI_HANDOFF.md`.

## 8. Catatan Gate

- Wizard SIT/UAT di frontend menampilkan tombol "Mulai Pengujian SIT" hanya pada
  status yang memang mengizinkan transisi ke `SIT_IN_PROGRESS`
  (`IN_DEVELOPMENT`, `SIT_REVISION`, `UAT_REVISION_DEV`). Status lain menampilkan
  panel informasi read-only, bukan tombol yang pasti ditolak backend.
- Setelah proyek melewati UAT Internal (`DEV_COMPLETED` sampai `LIVE_PRODUCTION`,
  termasuk `RETURN_TO_DEV`), berita acara SIT dan UAT Internal tetap terbaca dalam
  mode read-only untuk keperluan audit.
- Task **TAKE DOWN** diabaikan di: jumlah skenario SIT, gate SIT, progress bar
  detail proyek, PM workspace, dan gerbang pengajuan ulang putaran pengembalian
  (`ProjectReturnRound::NON_BLOCKING_TASK_STATUSES` = `done` + `take_down`).
- Persetujuan SIT muncul hanya setelah Eksekusi selesai (`activeSitStep>=3`).
- Kelulusan SIT memerlukan minimal satu dokumen `SIT_RESULT`/`SIT_SIGNOFF`
  yang tercatat pada document vault proyek.
- Kelulusan UAT internal ke `DEV_COMPLETED` memerlukan ringkasan UAT Tahap 2
  (`activeUatStep>=3` dan `uat2_summary.conclusion` terisi), tidak ada pengulangan UAT
  yang tertunda (`Project::isUatRestartPending()` bernilai `false`), tidak ada revisi
  Minor yang masih tertahan (`Project::isUatMinorRevisionPending()` bernilai `false`),
  dan seluruh approval individual pada putaran terbaru lengkap.
- Masuk fase pengujian sebuah jalur (`READY_FOR_QA`, `QA_IN_PROGRESS` untuk QA;
  `CYBER_IN_PROGRESS` untuk Keamanan Siber) ditolak selama jalur itu punya putaran
  pengembalian terbuka yang task perbaikannya belum tuntas — apa pun status asalnya, dan
  dinilai per jalur. Gerbangnya ditegakkan di `TestingTrackService::submitRequest()`,
  `TestingTrackService::assignTester()`, dan
  `ProjectWorkflowService::validateTransitionPrerequisites()`; lihat bagian 5.
- Keluar dari `UAT_IN_PROGRESS` menuju `UAT_REVISION_DEV`/`UAT_REVISION_SIT` selalu
  men-`superseded` putaran persetujuan yang masih berjalan, dari pintu mana pun revisinya
  masuk. Tanpa ini, baris `approved` dari sebelum revisi masih dapat memuaskan gerbang
  `DEV_COMPLETED` memakai tanda tangan atas hasil UAT yang sudah tidak berlaku.
