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
          ┌─────────────────────┐                │
          │ QA_IN_PROGRESS      │  CYBER_IN_PROGRESS
          │ QA_PASSED           │  CYBER_PASSED
          └──────┬──────────────┘                │
                 ▼                               │
                 ┌──────────────┐                │
                 │ READY_FOR_UAT│                │
                 └──────┬───────┘                │
                        ▼                        │
                 ┌──────────────┐                │
                 │  UAT_PASSED  │                │
                 └──────┬───────┘                │
                        ▼                        │
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

## 1b. Tabel Transisi Valid (dari `ProjectWorkflowService::allowedTransitions`)

| Status Saat Ini | Status Tujuan (valid) |
|---|---|
| `PENDING` | IN_REVIEW, REJECTED, CANCELLED |
| `IN_REVIEW` | ANALYSIS_APPROVED, PENDING, REJECTED |
| `ANALYSIS_APPROVED` | READY_FOR_DEVELOPMENT, IN_REVIEW, REJECTED |
| `READY_FOR_DEVELOPMENT` | DEV_ANALYSIS, IN_DEVELOPMENT, ANALYSIS_APPROVED |
| `DEV_ANALYSIS` | DEV_ANALYSIS_DONE, READY_FOR_DEVELOPMENT, REJECTED |
| `DEV_ANALYSIS_DONE` | IN_DEVELOPMENT, DEV_ANALYSIS |
| `IN_DEVELOPMENT` | SIT_IN_PROGRESS, DEV_COMPLETED, READY_FOR_QA, CYBER_IN_PROGRESS, QA_IN_PROGRESS, DEV_ANALYSIS_DONE, ON_HOLD |
| `SIT_IN_PROGRESS` | SIT_PASSED, SIT_REVISION, IN_DEVELOPMENT |
| `SIT_PASSED` | UAT_IN_PROGRESS, DEV_COMPLETED, SIT_REVISION, IN_DEVELOPMENT |
| `SIT_REVISION` | SIT_IN_PROGRESS, IN_DEVELOPMENT |
| `UAT_IN_PROGRESS` | UAT_PASSED, DEV_COMPLETED, UAT_REVISION_SIT, UAT_REVISION_DEV |
| `UAT_REVISION_SIT` | SIT_IN_PROGRESS, UAT_IN_PROGRESS |
| `UAT_REVISION_DEV` | IN_DEVELOPMENT, SIT_IN_PROGRESS |
| `DEV_COMPLETED` | READY_FOR_QA, QA_IN_PROGRESS, CYBER_IN_PROGRESS, IN_DEVELOPMENT |
| `RETURN_TO_DEV` | IN_DEVELOPMENT, READY_FOR_DEVELOPMENT, READY_FOR_QA, CYBER_IN_PROGRESS |
| `READY_FOR_QA` | QA_IN_PROGRESS, CYBER_IN_PROGRESS, DEV_COMPLETED, IN_DEVELOPMENT |
| `QA_IN_PROGRESS` | QA_PASSED, CYBER_IN_PROGRESS, RETURN_TO_DEV, READY_FOR_QA |
| `QA_PASSED` | CYBER_IN_PROGRESS, CYBER_PASSED, QA_IN_PROGRESS |
| `CYBER_IN_PROGRESS` | CYBER_PASSED, QA_IN_PROGRESS, QA_PASSED, RETURN_TO_DEV |
| `CYBER_PASSED` | READY_FOR_UAT, CYBER_IN_PROGRESS |
| `READY_FOR_UAT` | UAT_PASSED, RETURN_TO_DEV, CYBER_PASSED |
| `UAT_PASSED` | PENDING_GOLIVE, READY_FOR_UAT, RETURN_TO_DEV |
| `PENDING_GOLIVE` | LIVE_PRODUCTION, UAT_PASSED, RETURN_TO_DEV, REJECTED |
| `LIVE_PRODUCTION` | (terminal) |
| `REJECTED` | PENDING (re-open), IN_REVIEW |
| `ON_HOLD` | IN_DEVELOPMENT, PENDING |
| `CANCELLED` | (terminal) |

> Transisi tidak ada di tabel → ditolak oleh workflow (422/403).

## 1c. Otorisasi Role per Transisi (dari `rolePermissions`)

Role yang berhak **memindahkan proyek ke status berikut**:

| Status Tujuan | Role yang Diizinkan |
|---|---|
| `PENDING` | business_user, super_admin |
| `IN_REVIEW` | lead_group, super_admin |
| `ANALYSIS_APPROVED` | lead_group, analyst, super_admin |
| `REJECTED` | lead_group, analyst, head_of_it, super_admin |
| `READY_FOR_DEVELOPMENT` | lead_group, development_lead, super_admin |
| `DEV_ANALYSIS` | development_lead, analyst, super_admin |
| `DEV_ANALYSIS_DONE` | analyst, super_admin |
| `IN_DEVELOPMENT` | project_manager, developer, development_lead, super_admin |
| `SIT_IN_PROGRESS` | project_manager, development_lead, developer, super_admin |
| `SIT_PASSED` | project_manager, development_lead, super_admin |
| `SIT_REVISION` | project_manager, development_lead, super_admin |
| `UAT_IN_PROGRESS` | project_manager, business_user, super_admin |
| `UAT_REVISION_SIT` | project_manager, business_user, super_admin |
| `UAT_REVISION_DEV` | project_manager, business_user, super_admin |
| `DEV_COMPLETED` | project_manager, development_lead, developer, super_admin |
| `RETURN_TO_DEV` | qa_lead, qa_tester, cyber_lead, pentester, super_admin |
| `READY_FOR_QA` | project_manager, super_admin |
| `QA_IN_PROGRESS` | qa_lead, lead_group, super_admin |
| `QA_PASSED` | qa_tester, qa_lead, lead_group, super_admin |
| `CYBER_IN_PROGRESS` | cyber_lead, super_admin |
| `CYBER_PASSED` | pentester, cyber_lead, super_admin |
| `READY_FOR_UAT` | project_manager, super_admin |
| `UAT_PASSED` | business_user, project_manager, super_admin |
| `PENDING_GOLIVE` | project_manager, super_admin |
| `LIVE_PRODUCTION` | head_of_it, super_admin |
| `ON_HOLD` | project_manager, development_lead, super_admin |
| `CANCELLED` | lead_group, head_of_it, super_admin |

> super_admin selalu diizinkan pada semua transisi.

Status revisi:
- `SIT_REVISION` — SIT gagal, kembali ke development.
- `UAT_REVISION_SIT` — status legacy; tidak dipakai untuk revisi minor baru.
- `UAT_REVISION_DEV` — UAT mayor, kembali ke development lalu SIT ulang.
- `RETURN_TO_DEV` — dari QA/Cyber, kembali ke development.

## 2. Alur Task

Status task (TaskStatus): `todo` (Belum Mulai), `in_progress` (Sedang Dikerjakan),
`hold` (Hold), `done` (Selesai), `take_down` (Take Down).

- **Revisi task** (dari SIT Tahap 2): task mundur ke `in_progress` +
  `revision_note` + `revision_requested_at/by` → developer melihat banner revisi.
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
- SIT ulang setelah UAT Mayor menggunakan mode **targeted retest**. Scope diambil dari
  `sit_retest_scope.taskIds` pada siklus `uat_hold.cycle` yang aktif.
- Scope hanya berisi task skenario yang direvisi Mayor dan task baru yang dibuat dari
  permintaan tambahan Mayor. Task lain tidak ditampilkan, tidak di-OK ulang, dan hasil
  SIT sebelumnya tetap tersimpan pada `sit_cycles`.
- Sebelum SIT ulang dimulai, seluruh task scope wajib memiliki assignee dan berstatus
  `done`. Saat eksekusi, setiap task scope wajib di-OK serta memiliki bukti pengujian baru.
- Approval developer hanya diwajibkan kepada assignee unik dari task dalam scope;
  approval PM dan Development Lead tetap wajib.

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
- Setelah `SIT_PASSED` (atau UNLOCK_ALL_STAGES).

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
- Permintaan tambahan minor masuk laporan dan dapat ditindaklanjuti tanpa rollback.
  Permintaan tambahan mayor otomatis membuat task Change Request baru tanpa assignee;
  PM wajib menentukan developer yang sesuai.
- **Simpan sebagai Draft** menyimpan seluruh isian sementara tanpa mewajibkan semua
  skenario lengkap, tanpa mengunci snapshot, tanpa berpindah ke Tahap 3, dan tanpa
  menjalankan rollback atau membuat Change Request.
- Draft dapat diperbarui selama hasil pengujian, permintaan revisi, dan lampiran bukti
  masih dilengkapi. Lampiran yang sedang diunggah harus selesai sebelum draft disimpan.
- **Simpan Final** tetap memerlukan seluruh skenario valid. Hanya aksi final ini yang
  menjalankan keputusan Minor/Mayor dan melanjutkan alur sesuai kesimpulan UAT.
- Angka dieksekusi/diterima/revisi dan kesimpulan dihitung backend, bukan input manual.
- Setelah disubmit, snapshot Tahap 2 dikunci untuk menjaga jejak audit; lampiran tetap
  dapat dilihat/diunduh.
- Kesimpulan:
  - semua diterima → lanjut Persetujuan Final;
  - ada minor tanpa mayor → perbaikan dibantu developer tanpa rollback/SIT ulang,
    lalu lanjut Persetujuan Final;
  - ada mayor → otomatis menjadi Change Request, status `UAT_REVISION_DEV`, task
    terkait dibuka kembali, dan UAT belum dapat disetujui.
- Setelah revisi mayor selesai, SIT terarah dijalankan dari Tahap 1 hanya untuk task
  yang terdampak dan task tambahan baru. Jika SIT lulus,
  UAT dilanjutkan pada Tahap 2 dalam **mode verifikasi Mayor**. Hanya skenario atau
  permintaan tambahan Mayor yang diperiksa ulang; hasil UAT lainnya tetap terkunci.
- Jika semua perbaikan Mayor diterima user, alur lanjut ke Persetujuan Final UAT.
  Jika masih ada yang direvisi, UAT kembali di-hold dan siklus developer → SIT ulang →
  verifikasi Mayor diulang untuk item yang ditolak.
- Pada mode verifikasi Mayor, setiap item wajib memiliki hasil verifikasi, catatan alasan
  jika masih revisi, dan minimal satu lampiran `UAT_EVIDENCE`. Lampiran dikelola per item
  serta dapat dilihat, diunduh, dan dihapus sebelum verifikasi disimpan.
- Bukti verifikasi berlaku per siklus. Jika item ditolak dan masuk siklus berikutnya,
  bukti lama tetap berada dalam `uat2_verification_history`, sedangkan form verifikasi
  berikutnya wajib menerima bukti baru.

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
- Approval ditolak backend bila Tahap 2 belum lengkap atau revisi mayor/SIT ulang
  belum selesai.
- Tombol **"UAT Lulus"** aktif hanya jika semua approver pada putaran terbaru
  menyetujui → `DEV_COMPLETED`.
- Revisi Mayor atau verifikasi Mayor yang ditolak mencabut link aktif dan menandai
  putaran sebelumnya `superseded`. Setelah perbaikan dan SIT ulang selesai, sistem
  membuat putaran baru; keputusan lama tetap menjadi audit history tetapi tidak dihitung.

## 5. Alur QA & Cyber

- PM ajukan QA (`/pm/qa-request`) & Cyber (`/pm/cyber-request`).
- QA/Cyber melaksanakan di workspace masing-masing.
- `RETURN_TO_DEV` jika gagal → kembali development → SIT/UAT ulang.

## 6. Approval Multi-Role — Ringkasan

| Tahap | Role yang approve | Tombol lulus |
|---|---|---|
| SIT | Developer (semua), PM, Dev Lead | "SIT Lulus" |
| UAT | 3 pihak peminta + seluruh approver IT yang ditetapkan | "UAT Lulus" |

## 7. Change Request UAT — Alur Maju-Mundur

1. User menguji tiap skenario dan dapat mencatat permintaan tambahan yang baru muncul.
2. Revisi/request minor masuk laporan dan diperbaiki tanpa mengubah status proyek.
3. Revisi/request mayor otomatis dicatat sebagai Change Request → `UAT_REVISION_DEV`.
   Task skenario lama dibuka kembali; request tambahan mayor dibuat menjadi task baru
   yang harus di-assign PM.
4. UAT di-hold sampai seluruh Change Request Mayor dan task terkait berstatus selesai.
5. SIT ulang terarah hanya menjalankan task pada Change Request Mayor siklus aktif.
   Task di luar scope tidak diuji ulang. Setelah lulus → `SIT_PASSED` →
   `UAT_IN_PROGRESS` pada `activeUatStep=2` dengan `uat2_verification_mode=true`.
6. User memverifikasi hanya item Mayor. Semua diterima → `activeUatStep=3` → approval
   final → QA/Cyber. Ada yang masih revisi → kembali ke butir 3 untuk siklus baru.
7. Endpoint CR lama tetap tersedia untuk kompatibilitas. Keputusan minor tidak lagi
   memindahkan status; keputusan mayor mengikuti alur maju-mundur di atas.

## 8. Catatan Gate

- Task **TAKE DOWN** diabaikan di: jumlah skenario SIT, gate SIT, progress bar
  detail proyek, PM workspace.
- Persetujuan SIT muncul hanya setelah Eksekusi selesai (`activeSitStep>=3`).
- Kelulusan SIT memerlukan minimal satu dokumen `SIT_RESULT`/`SIT_SIGNOFF`
  yang tercatat pada document vault proyek.
- Kelulusan UAT internal ke `DEV_COMPLETED` memerlukan ringkasan UAT Tahap 2,
  tidak ada revisi mayor tertunda, dan seluruh approval individual pada putaran
  terbaru lengkap.
