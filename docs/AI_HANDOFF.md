# NagariSDLC — Handoff untuk AI Baru

**Terakhir diperbarui:** 26 Agustus 2026  
**Status dokumen:** konteks kerja utama bersama `AGENTS.md` di root repository.

## 1. Saya memahami proyek ini sebagai

NagariSDLC adalah aplikasi governance SDLC internal Bank Nagari untuk mengelola
proyek teknologi dari pengajuan, review, analisis, pengembangan, SIT, UAT, QA,
Cyber Security, release, sampai produksi. Sistem mengutamakan role-based access,
state machine, bukti dokumen, approval individual, histori, dan audit trail.

Stack aktual:

- Backend: PHP 8.3, Laravel 13, Sanctum, Reverb, REST API.
- Frontend: React 19, Vite 8, Tailwind CSS 4.
- Data development mengikuti konfigurasi `.env`; target database, realtime, dan
  object storage produksi belum diputuskan.
- UI dan pesan bisnis menggunakan Bahasa Indonesia.

## 2. Fokus dan tingkat penyelesaian saat ini

- Fase sebelum SIT telah dikerjakan oleh pengguna.
- SIT dan UAT Internal sudah lengkap, termasuk siklus revisi mayor dan approval
  individual per putaran.
- Jalur Pengujian QA dan Audit Keamanan Siber sudah berjalan penuh dengan empat
  langkah identik (ajukan, disposisi, laporan pelaksana, sign-off Lead), demikian
  pula pengajuan migrasi & rilis ke Grup Infrastruktur dan Quality Gate Head of IT.
- Kondisi paralel QA dan Siber **tidak** memakai status gabungan. Setiap jalur
  memiliki kolomnya sendiri (`projects.qa_status`, `projects.cyber_status`) sebagai
  kebenaran jalurnya, sementara `projects.status` hanya penunjuk siklus yang bergerak
  menyusul. Lihat `docs/WORKFLOW.md` dan `backend/app/Services/TestingTrackService.php`.
- Makna bisnis fase sesudah QA & Siber sudah dikunci pengguna: **tidak ada UAT final**.
  Begitu kedua jalur pengujian dinyatakan lulus, PM langsung mengajukan migrasi & rilis
  ke Grup Infrastruktur (`PENDING_GOLIVE`), lalu Head of IT menyetujui pada Quality Gate.
  `READY_FOR_UAT` kini status legacy tanpa transisi masuk maupun keluar — case enum-nya
  dipertahankan hanya agar riwayat `project_status_histories` lama tetap terbaca, jadi
  jangan dipakai untuk alur baru dan jangan dihapus dari enum. `UAT_PASSED` tetap ada
  sebagai keluaran opsional UAT internal (Fase 2) dan sudah tidak bisa memintas ke
  `PENDING_GOLIVE`.

## 3. Alur SIT yang telah disepakati

1. SIT dimulai setelah seluruh task aktif selesai; task `TAKE_DOWN` tidak dihitung.
2. Tab 1 menyiapkan data pengujian.
3. Tab 2 melakukan eksekusi per task, komentar, bukti, dan revisi. Hasil dapat
   disimpan sebagai draft sebelum final.
4. Tab 3 melakukan review/sign-off. Dokumen Hasil Review/Berita Acara SIT wajib
   diunggah sebelum proyek dapat lanjut ke UAT.
5. Approval SIT melibatkan seluruh developer assignee, PM/Analyst Pengembangan,
   dan Development Lead.
6. Revisi mayor dari UAT mengembalikan pekerjaan ke developer, lalu menjalankan
   **SIT ulang menyeluruh** — seluruh task aktif kecuali `TAKE_DOWN`, bukan hanya task
   terdampak. Perbaikan mayor menyentuh kode bersama sehingga dapat meregresi fungsi yang
   tidak diminta berubah. Yang membedakan SIT ulang dari SIT pertama adalah ketatnya bukti
   (tujuh prasyarat tambahan pada transisi `SIT_PASSED`, termasuk bukti baru per task dari
   document vault), bukan daftar task-nya. `sit_retest_scope.mode = 'targeted'` hanya
   tersisa pada baris produksi lama dan masih dihormati untuk baris itu.

## 4. Alur UAT Internal yang telah disepakati

### Tab 1 — Persiapan

- Tanggal pelaksanaan tidak memiliki default hari ini; awalnya kosong dengan
  petunjuk `dd/mm/yyyy`.
- Dokumen `UNDANGAN` wajib sebelum lanjut.
- Peserta UAT sekaligus menjadi sumber calon approver.
- Developer approver hanya boleh dipilih dari developer yang menjadi assignee task
  proyek tersebut.

### Tab 2 — Eksekusi dan temuan

- User mencoba/demonstrasi aplikasi secara langsung.
- Hasil dicatat per skenario/task: diterima atau revisi, mayor/minor, permintaan,
  komentar, dan lampiran.
- Permintaan baru user dicatat terpisah sebagai permintaan tambahan mayor/minor.
- Draft boleh disimpan tanpa menjalankan rollback atau membentuk Change Request.
- **Minor tidak memundurkan alur, tetapi tetap menahan penutupan UAT.** Tidak ada rollback,
  tidak ada SIT ulang, dan status proyek tidak berpindah — proyek tetap `UAT_IN_PROGRESS`
  pada Tahap 3. Yang ditahan adalah keputusan penanda tangan: `holdForMinorRevision()`
  memasang `uat_hold.reason = 'minor_revision'`, membuat satu Change Request bertipe
  `minor` per item, dan membuka kembali task sumbernya dengan catatan revisi.
  `Project::isUatMinorRevisionPending()` dibaca dua tempat — `UatApprovalService` (menolak
  keputusan approver) dan gerbang `DEV_COMPLETED` di `ProjectWorkflowService` — dan hold-nya
  lepas sendiri lewat `releaseMinorRevisionHold()` begitu seluruh CR Minor siklus itu
  `resolved`. Alasannya: berita acara UAT menjadi dasar rilis, jadi menutupnya sebelum
  perbaikan Minor dikerjakan berarti menyatakan lulus atas versi yang sudah diketahui salah.
- **Mayor mengulang dua siklus secara penuh.** Menjadi Change Request: UAT di-hold →
  proyek ke `UAT_REVISION_DEV` → developer memperbaiki → SIT ulang **menyeluruh** → setelah
  SIT lulus, UAT dimulai kembali dari **Tab 1**, seluruh skenario disiapkan dan dieksekusi
  ulang, lalu putaran persetujuan baru dibuka lewat Tab 3.
- **Mode verifikasi item mayor sudah dipensiunkan.** Flag `uat2_verification_mode`,
  endpoint `POST /projects/{id}/uat-major-verification`, `SubmitUatMajorVerificationRequest`,
  `ProjectController::submitUatMajorVerification()`,
  `UatExecutionService::verifyMajorRevisions()`, `projectService.submitUatMajorVerification`,
  dan seksi UI-nya semuanya sudah dihapus. Jangan menambahkan kembali cabang apa pun yang
  memeriksa `uat2_verification_mode`.
- Sebelum hasil Tab 2 dikosongkan, `UatExecutionService::holdForMajorRevision()`
  mengarsipkan putaran UAT berjalan ke `sit_uat_data.uat_cycles` (append-only) beserta
  `uat3_approvals`-nya. Arsip itu satu-satunya bukti putaran tersebut pernah dijalankan.
- **`sit_uat_data.uat1_participants` tidak pernah dikosongkan oleh jalur kode mana pun.**
  Daftar penanda tangan UAT terbawa ke putaran berikutnya; PM boleh menambah, tetapi
  pengosongan ditolak `PATCH /projects/{id}`. Ini memang sah di tingkat basis data karena
  `uat_approvers` memakai `unique(uat_approval_round_id, participant_key)` — komposit,
  bukan global. Bila mengerjakan area ini, jangan pernah menulis kode yang mereset roster.

### Tab 3 — Persetujuan final

- Approval menggunakan snapshot per putaran di `uat_approval_rounds` dan
  `uat_approvers`.
- Pihak peminta: requester, pimpinan grup, dan pimpinan divisi. Mereka tidak wajib
  memiliki akun; PM memberikan link unik per orang dan akses dibuka setelah nomor
  HP cocok dengan data peserta.
- Pihak IT: developer (dapat lebih dari satu), Analyst/PM, pimpinan grup
  pengembangan, dan pimpinan Divisi Teknologi dan Digitalisasi. Mereka menggunakan
  akun aplikasi.
- Semua orang memberi keputusan secara individual dan dapat paralel.
- Dokumen Tab 3 dapat dilihat oleh approver eksternal pada halaman link approval.
- Perubahan peserta Tab 1 dapat disinkronkan ke putaran aktif selama peserta yang
  dicabut belum memberi keputusan. Keputusan yang sudah sah dipertahankan; perubahan
  terhadap approver yang sudah memutuskan membutuhkan putaran baru.
- Keluar dari `UAT_IN_PROGRESS` menuju `UAT_REVISION_DEV`/`UAT_REVISION_SIT` selalu
  men-`superseded` putaran yang masih berjalan — dari pintu mana pun, termasuk
  `PATCH /projects/{id}/status` langsung. Token link dibatalkan, baris `pending` menjadi
  `revoked`, sedangkan baris `approved` dipertahankan sebagai jejak audit. Tanpa ini,
  tanda tangan dari sebelum revisi masih dapat memuaskan gerbang `DEV_COMPLETED`.
- Data contoh terakhir: pada proyek `REQ-2026-015`, assignment Fani Wijaya telah
  dicabut (`revoked`) karena bukan developer proyek. Rina Wati tetap menjadi
  developer approver. Putaran tersebut selesai 7/7; record Fani tetap disimpan
  untuk audit dan tidak lagi muncul pada matrix aktif.

## 5. Keputusan bisnis dan batasan lain

- `super_admin` adalah role dengan akses global. Role lain harus memperoleh akses
  dari keterlibatan/penugasan proyek dan kebutuhan approval, bukan otomatis melihat
  semua proyek.
- Registrasi/pembuatan akun, pilihan role, divisi, dan aktivasi akun nantinya
  dikelola Super Admin.
- Grup kerja dan pembatasan menu per role juga dikelola Super Admin (25 Agustus 2026),
  atas permintaan pengguna agar bagian Administrasi mencerminkan pembagian fungsi yang
  sebenarnya. Yang **tidak** diminta dan sengaja tidak dikerjakan: membuat otorisasi fase
  ikut dinamis. Daftar dua belas role tetap, dan hak transisi status tetap di kode.
- QA dan Cyber dapat berjalan paralel dan membutuhkan representasi status gabungan
  yang tidak ambigu.
- Target resmi produksi (MySQL atau alternatif), Reverb atau polling, serta storage
  lokal atau S3/MinIO belum ditentukan.
- Apakah `CANCELLED` wajib terminal dan apakah hard-delete/cascade boleh digunakan
  belum diputuskan. Default aman: pertahankan histori dan hindari hard-delete.
- Alur revisi memang dapat bergerak mundur ke development; jangan memakai
  `CANCELLED` untuk merepresentasikan revisi.

## 6. File yang paling penting

- `backend/app/Services/ProjectWorkflowService.php` — state machine proyek.
- `backend/app/Services/TestingTrackService.php` — empat langkah jalur QA/Siber; satu-satunya
  orkestrator kolom jalur beserta putaran pengembaliannya.
- `backend/app/Services/ProjectReturnRoundService.php` — satu-satunya penulis
  `project_return_rounds` dan pemilik aturan gerbang pengajuan ulang.
- `backend/app/Services/UatExecutionService.php` — draft/final UAT dan penahanan revisi
  mayor (`holdForMajorRevision()`, publik dan dipakai dua pintu masuk).
- `backend/app/Services/UatApprovalService.php` — putaran dan keputusan approval UAT.
- `backend/app/Http/Controllers/Api/V1/ProjectController.php` — endpoint workflow proyek.
- `backend/routes/api.php` — kontrak route aktual.
- `frontend/src/components/SITUATWizard.jsx` — UI/alur SIT dan UAT.
- `frontend/src/components/SITTaskExecution.jsx` — eksekusi SIT per task.
- `frontend/src/services/api.js` — satu pintu panggilan API frontend.
- `frontend/src/router/index.jsx` dan `frontend/src/data/menuConfig.js` — akses dan navigasi role.
- `frontend/src/constants/roles.js` — daftar acuan Grup Perencanaan dan Quality Assurance;
  cermin `App\Enums\UserRole::PLANNING_QA_*`. Ini sumber OTORISASI grup itu, bukan tabel
  `groups`.
- `frontend/src/pages/admin/Groups.jsx` dan `frontend/src/pages/admin/Roles.jsx` —
  pengelolaan grup kerja dan penempatan role berikut pembatasan menunya.

## 7. Kondisi teknis dan risiko yang harus diketahui

- **Ketiga migration `2026_08_25_*` sudah dijalankan — tidak ada tindakan operator yang tertunda.**
  Diperiksa langsung ke database pengembangan (25 Agustus 2026): tabel `groups` ada, tabel
  `project_return_rounds` ada dengan 15 kolom, `project_tasks.return_round_id` ada dan
  terindeks, dan `test_reports` memiliki kolom `tested_scenarios`. Baris terakhir tabel
  `migrations` adalah `2026_08_25_000002_create_project_return_rounds_table` pada batch 21.
  Ketiganya:

  1. `2026_08_25_000000_add_tested_scenarios_to_test_reports_table` — menambah
     `tested_scenarios` (text, nullable). Kolom `checklist` sengaja **tidak** dihapus:
     laporan pengujian lama memakainya dan jejak audit tidak boleh dimundurkan.
  2. `2026_08_25_000001_create_groups_and_role_menu_access` — membuat tabel `groups`,
     menambah `roles.group_id` (`nullOnDelete`) dan `roles.menu_access` (json, nullable),
     lalu mengisi lima grup bawaan. Backfill-nya mencocokkan `roles.name` dan hanya
     menyentuh role yang `group_id`-nya masih `NULL`, sehingga menjalankannya ulang tidak
     pernah menimpa penempatan yang sudah diatur Super Admin.
  3. `2026_08_25_000002_create_project_return_rounds_table` — membuat tabel
     `project_return_rounds` dan menambah `project_tasks.return_round_id` (nullable,
     `nullOnDelete`). Backfill-nya idempoten: membaca `test_reports` yang
     `reviewed_result = 'fail'` dan `reviewed_by` terisi, melewati laporan yang sudah punya
     putaran, dan hanya menandai putaran `OPEN` bila laporan itu kegagalan terakhir pada
     (proyek, jalur) tersebut **dan** kolom jalurnya masih `FAILED`. Sisanya `RESUBMITTED`
     dengan `resubmit_notes` yang mengakui bahwa putaran itu direkonstruksi;
     `resubmitted_by` dibiarkan `NULL` dan task perbaikan lama tidak ditautkan ke belakang,
     karena tidak ada data yang membuktikannya.

  Backfill `2026_08_25_000002` menghasilkan nol baris pada database tersebut karena tidak
  ada `test_reports` dengan `reviewed_result = 'fail'` sekaligus `reviewed_by` terisi — itu
  kondisi data, bukan kegagalan migrasi. Laman **Manajemen Grup** (`/admin/groups`), kolom
  catatan skenario pada laman QA/Siber, dan **seluruh fitur putaran pengembalian** kini
  didukung skema database. Perintah migrasi selalu dijalankan pengguna sendiri — jangan
  menjalankannya atas inisiatif sendiri.

  Catatan penting untuk perubahan berikutnya: test berjalan di SQLite yang selalu
  bermigrasi bersih, jadi selisih antara skema database sungguhan dan migrasi **tidak**
  terlihat dari hasil test — verifikasi lewat `php artisan migrate:status` atau
  `php artisan db:table <tabel>`. Tabel `projects` memiliki 33 kolom (termasuk `priority`
  default `Medium`, dan `rbb_deadline`) dan `release_requests` memiliki 15 kolom termasuk
  `downtime_estimate`, `rollback_plan`, `approved_by`, `rejected_at`, `rejected_by`, dan
  `rejection_notes`.
- **Grup kerja adalah data, tetapi bukan otorisasi.** Tabel `groups` dengan
  `roles.group_id` dapat dikelola Super Admin di `/admin/groups`, dan kolom "Akses Menu"
  pada Manajemen Role kini benar-benar berasal dari `roles.menu_access` (sebelumnya teks
  hiasan `'Modul Standar'`). Yang tidak berubah: hak transisi status tetap milik
  `ProjectWorkflowService::$rolePermissions`, cakupan proyek milik `ProjectAccessService`,
  dan hak pelaksana uji milik `TestingTrack::testerRoles()` — ketiganya mencocokkan
  `roles.name`. Otorisasi fase memang tidak bisa dipindahkan ke database tanpa
  perancangan ulang: `$rolePermissions` adalah default properti PHP, dan default properti
  tidak boleh memuat pemanggilan method atau query.

  Konsekuensi yang harus diketahui sebelum menjanjikan apa pun ke pengguna: **role baru
  yang dibuat lewat Administrasi bersifat mati**. Namanya tidak ada di `ALL_ROLES`
  (`frontend/src/router/index.jsx`), jadi `MainLayout` menolaknya; `menuSections[role]`
  undefined sehingga sidebar-nya kosong; `ProjectAccessService` jatuh ke
  `whereRaw('1 = 0')`; dan tidak ada barisnya di `$rolePermissions`. Dua belas role yang
  ada sekarang adalah daftar tetap.
- **`roles.menu_access` bersifat mengurangi saja dan gagal-terbuka.** `null` dan daftar
  kosong sama-sama berarti "tanpa pembatasan", dinormalkan di tiga tempat:
  `Role::menuAccessPaths()`, `RoleController::normalizeMenuAccess()`, dan
  `filterSectionsByMenuAccess()` di `frontend/src/data/menuConfig.js`. Tidak ada cara
  memberi role menu yang tidak ada di `menuConfig.js`, dan menyembunyikan menu **tidak**
  menutup rutenya — gerbangnya tetap `ProtectedRoute` serta middleware `role:`.
  `menu_access` role `super_admin` ditolak `UpdateRoleRequest` karena halaman yang
  mengatur pembatasan itu sendiri berada di dalam menu. Penghapusan grup ditolak selama
  masih ada role di dalamnya (422), dan `roles.group_id` `SET NULL` memastikan tidak ada
  kaskade yang bisa mencapai pengguna.
- **Cakupan pengujian kini teks bebas.** Daftar enam skenario tetap yang dicentang sudah
  dihapus dari laman QA (`MyTasksQA.jsx`) dan laman Siber (`MyTasksCyber.jsx`). Di laman
  QA daftar itu digantikan satu kolom "Skenario yang diuji" yang tersimpan di
  `test_reports.tested_scenarios`. `checklist` masih diterima endpoint dan masih
  dipaparkan `TestReportResource` beserta `checklist_summary` agar laporan lama terbaca
  utuh, tetapi tidak ada jalur tulis baru dari antarmuka.

  **Diperbarui 26 Agustus 2026:** laman Siber kini memiliki kolom "Skenario / Ruang
  Lingkup yang Diuji" yang setara dengan QA. `MyTasksCyber.jsx` mengirim `tested_scenarios`
  bersama `result`, `notes`, `severity`, dan bukti ke `/cyber-requests/report`, sehingga
  laporan Siber kembali mencatat cakupan pengujian yang benar-benar dijalankan. Sebelumnya
  jalur Siber hanya kehilangan daftar tetapnya tanpa pengganti dan tidak pernah mengirim
  field itu sama sekali.
- **Layar My Tasks QA/Siber punya pencarian dan filter per pelaksana (26 Agustus 2026).**
  `MyTasksQA.jsx` (`/my-tasks/qa`) dan `MyTasksCyber.jsx` (`/my-tasks/cyber`) kini
  memiliki kotak pencarian (cocokkan ID kebutuhan / nama proyek / divisi, tersedia untuk
  semua peran) dan — khusus peran pengawas jalur — tombol "Semua" beserta dropdown per
  pelaksana, meniru pola papan Kanban Fase 2 (`pm/Kanban.jsx`). Peran pengawasnya berbeda
  antar jalur: QA memakai `QA_PRIVILEGED_ROLES = ['qa_lead','lead_group','super_admin']`,
  Siber memakai `CYBER_PRIVILEGED_ROLES = ['cyber_lead','super_admin']` — `lead_group`
  sengaja dikecualikan pada Siber, mengikuti matriks `TestingTrackService`. Dropdown
  berkunci pada ID penerima disposisi (`qa_assignee_id` / `cyber_assignee_id`), bukan
  nama. Kedua penyaring murni di sisi klien dan hanya mempersempit daftar yang sudah
  discope peran; tidak ada perubahan kontrak API, skema, maupun aturan visibilitas
  backend. Alur lengkapnya di `docs/WORKFLOW.md` §5, subseksi "Layar pelaksanaan tugas".
- Kolom jalur pengujian hanya boleh ditulis oleh empat endpoint jalur
  (`/qa-requests/*`, `/cyber-requests/*`) dan oleh
  `ProjectWorkflowService::syncTestingTrackStatuses()`. `PATCH /projects/{id}`
  menolak semua nilai jalur kecuali `FAILED`, dan `FAILED` wajib disertai
  `status = RETURN_TO_DEV` pada request yang sama.
- **Putaran pengembalian (`project_return_rounds`) — satu penulis, satu aturan, tiga
  penegak.** Sign-off `fail` pada satu jalur menandai kolom jalurnya `FAILED`, memindahkan
  proyek ke `RETURN_TO_DEV`, dan membuka satu baris `OPEN` di `project_return_rounds`
  (jalur, nomor putaran per jalur, catatan Lead, keparahan). PM membuat task perbaikan yang
  menunjuk putaran itu lewat `project_tasks.return_round_id` (nullable), dan jalur tersebut
  baru boleh diajukan ulang setelah seluruh task perbaikan pada putaran terbuka punya
  penerima dan selesai. Pengajuan ulang yang berhasil menutup putaran (`RESUBMITTED` +
  `resubmitted_by`/`resubmitted_at`/`resubmit_notes`).

  Yang harus dijaga bila menyentuh area ini:

  1. **Seluruh penulisan kolom putaran dimiliki `ProjectReturnRoundService`** (`open()`,
     `assertResubmitAllowed()`, `close()`). `TestingTrackService` memanggilnya di dalam
     transaksi yang sama dengan penulisan kolom jalur. Jangan menulis
     `project_return_rounds` dari controller, model, atau service lain.
  2. **Gerbang pengajuan ulang ditegakkan di tiga tempat**, semuanya bermuara pada satu
     aturan: `TestingTrackService::submitRequest()` (jalur resmi PM),
     `TestingTrackService::assignTester()` (menolak Lead mendisposisikan ulang jalur
     `FAILED` yang putarannya masih terbuka — tanpa ini pengujian bisa berjalan lagi tanpa
     pernah melewati pengajuan, karena `FAILED` bukan `NOT_SUBMITTED` dan bukan pula
     lulus), dan `ProjectWorkflowService::validateTransitionPrerequisites()` (menutup pintu
     belakang `PATCH /projects/{id}/status`). Nomor 1 dan 3 memanggil
     `assertResubmitAllowed()`; nomor 2 membaca `Project::openReturnRound()`. Bila
     aturannya berubah, ubah di service-nya — jangan menyalin syaratnya ke penegak baru.
  3. **Gerbang nomor 3 adalah invarian atas status tujuan, bukan atas status asal.**
     `match` hanya melihat status tujuan (`READY_FOR_QA`/`QA_IN_PROGRESS` → QA,
     `CYBER_IN_PROGRESS` → Siber). Jangan membungkusnya kembali dengan
     `if ($currentStatus === RETURN_TO_DEV)`: matriks transisi juga mengizinkan masuk fase
     pengujian dari `READY_FOR_QA`, `QA_IN_PROGRESS`, `QA_PASSED`, `CYBER_IN_PROGRESS`, dan
     `CYBER_PASSED`, sehingga versi berkondisi itu bisa dilangkahi.
  4. **Pemeriksaannya per jalur.** Proyek yang dikembalikan Siber tetap boleh mengajukan QA.
  5. **`ReturnRoundStatus::normalize()` gagal-tertutup**: nilai tak dikenal menjadi `OPEN`,
     berlawanan arah dengan `TrackStatus::normalize()` yang menjadi `NOT_SUBMITTED`.
     Gerbang yang gagal-terbuka menghapus gunanya gerbang. Karena itu pula `status` tidak
     dicast di `ProjectReturnRound`; bacanya lewat `roundStatus()`.
  6. **Putaran tidak pernah dihapus dan `RESUBMITTED` tidak pernah kembali `OPEN`.**
     Kegagalan berikutnya membuat putaran baru dengan nomor berikutnya. Tidak ada route
     `DELETE`, dan tidak boleh dibuat.
  7. **Verdikt gerbang dipaparkan ke klien**, `return_rounds[].can_resubmit` beserta
     `resubmit_blocker` di `ProjectResource`. Layar wajib memakainya, bukan menurunkan
     ulang aturannya, supaya tombol dan penolakan server tidak berbeda pendapat.
- `frontend/src/components/SITUATWizard.jsx` sekarang memakai
  `UNLOCK_ALL_STAGES = false` sesuai permintaan pengguna (22 Agustus 2026), sehingga
  gate SIT/UAT benar-benar mengikuti status proyek. Nilai ini harus tetap `false`;
  bila perlu dinyalakan sementara untuk debug lokal, jangan pernah ikut di-commit.
- Daftar status gate di `SITUATWizard.jsx` (`SIT_STARTABLE_STATUSES`,
  `SIT_COMPLETED_STATUSES`, `UAT_COMPLETED_STATUSES`, dan turunannya) adalah cermin
  `allowedTransitions` backend. Bila state machine berubah, perbarui keduanya agar
  tombol aksi tidak menawarkan transisi yang pasti ditolak backend.
- `SITUATWizard.jsx` besar. Jangan memperluas refactor hanya untuk memperbaiki
  permintaan kecil.
- Repo dapat berada dalam kondisi dirty karena perubahan fitur pengguna yang belum
  di-commit. Selalu cek `git status` dan pertahankan perubahan yang tidak terkait.
- `GET /dashboard/analytics` dibatasi `role:super_admin,head_of_it` di route (head_of_it
  ditambahkan 26 Agustus 2026 sebagai keputusan tata kelola: Head of IT memegang
  pengawasan rilis lintas portofolio). Route frontend `/analytics` dijaga daftar role
  yang sama (`['super_admin','head_of_it']`), bukan lagi `ADMIN_ROLES`. Sebelumnya
  endpoint terbuka bagi setiap akun yang login sementara halaman hanya dijaga router.
  Bila daftar role halaman itu diubah lagi, ubah keduanya (middleware route + guard FE)
  agar server dan client tidak berbeda.
- `GET /dashboard/summary` tidak lagi menyimpan salinan aturan visibilitasnya sendiri;
  penyaringannya memakai `ProjectAccessService::applyVisibilityScope()`. Jangan
  menambahkan cabang `if role` baru di controller dasbor — tambahkan di service itu
  supaya `GET /projects` dan dasbor tidak menyimpang lagi.
- Metrik analitik dibaca dari `project_status_histories` (transisi pertama ke
  `LIVE_PRODUCTION`), bukan dari `projects.updated_at`. Proyek berstatus produksi yang
  tidak punya baris histori tidak ikut terhitung pada `avg_cycle_time`/`release_trend`.
- Pelajaran dari cacat `status_distribution`: `projects.status` dicast ke enum, jadi
  `Model::pluck($nilai, 'status')` menghasilkan kunci berupa objek enum dan PHP
  melempar `TypeError: Cannot access offset of type App\Enums\ProjectStatus on array`.
  Untuk agregat berkunci kolom enum, pakai query builder (`DB::table`) dan tambahkan
  `whereNull('deleted_at')` sendiri karena global scope `SoftDeletes` tidak berlaku
  di sana.
- Snapshot pengujian terakhir (26 Agustus 2026): **236 test, 1467 assertions lulus**
  (`php vendor/bin/phpunit`, ±15 detik), `npx eslint src` bersih tanpa
  temuan, dan `npx vite build` berhasil (hanya peringatan lama soal chunk >1000 kB).
  `backend/phpunit.xml` memaksa
  `DB_CONNECTION=sqlite` dengan `DB_DATABASE=:memory:`, `MAIL_MAILER=array`, dan
  `QUEUE_CONNECTION=sync`, jadi menjalankan test tidak menyentuh database maupun
  email sungguhan. Snapshot ini historis, bukan jaminan bahwa perubahan sesudahnya
  sudah diuji.
- Bukti per task SIT (`sit2_task_approvals[*].attachments`) kini dibekukan setelah SIT
  lulus (diperbaiki 26 Agustus 2026, kedua sisi bersamaan). Frontend: `SITUATWizard.jsx`
  merender `SITTaskExecution` dengan `readOnly={isViewer || sitDone}`. Server:
  `ProjectController::update()` memakai konstanta `SIT_FROZEN_STATUSES` (cermin
  `SIT_COMPLETED_STATUSES` frontend) untuk mengembalikan `sit2_task_approvals` yang masuk
  ke nilai tersimpan bila proyek sudah melewati SIT, alih-alih menolaknya — sehingga PATCH
  yang membawa seluruh objek proyek tetap lolos tanpa mengubah berita acara final. Status
  pra-SIT dan SIT aktif tetap dapat menulis. Regresi ada di `ProjectCrudTest`.
- Token sesi frontend masih disimpan di `localStorage`, sehingga terbaca skrip
  pihak ketiga bila terjadi XSS. Pindah ke cookie `HttpOnly` menyentuh alur
  autentikasi ujung ke ujung, jadi ini keputusan pengguna, bukan perbaikan sisipan.
- Dokumentasi bisa tertinggal dari kode. Bila bertentangan, verifikasi route,
  migration, enum, model cast, service, dan frontend consumer sebelum menyimpulkan.

## 8. Cara AI baru memulai setiap pekerjaan

1. Baca `AGENTS.md` root dan file ini.
2. Baca hanya dokumen domain yang relevan.
3. Periksa `git status` dan diff pada file target.
4. Telusuri alur FE → service API → route → request/controller/service → model/DB.
5. Jelaskan diagnosis singkat sebelum melakukan perubahan material.
6. Implementasikan hanya scope yang diminta dan pertahankan kompatibilitas data lama.
7. Pengujian: pengguna sudah mengizinkan AI menjalankan `php vendor/bin/phpunit`,
   `npx eslint src`, dan `npx vite build` untuk memverifikasi perubahannya. Yang
   tetap dilarang tanpa izin baru adalah perintah yang menyentuh database sungguhan
   (`migrate`, `db:seed`, `migrate:fresh`).
8. Pada handoff, sebutkan perubahan, file terkait, langkah migration bila ada, serta
   hal yang belum terverifikasi.

## 9. Hal yang masih perlu dikonfirmasi

- Database, realtime transport, queue, dan storage produksi.
- Kebijakan retensi, cascade, soft delete, dan status terminal `CANCELLED`.
- Strategi deployment, CI/CD, environment staging/production, backup, monitoring,
  audit/security hardening, dan SLA.
- Penyimpanan token sesi frontend (`localStorage` sekarang, cookie `HttpOnly`
  sebagai alternatif).

