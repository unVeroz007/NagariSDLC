# PROMPT MASTER — Pemahaman Menyeluruh Codebase "NagariSDLC"

> Salin SELURUH isi berkas ini ke AI yang kamu pilih sebagai **konteks pembuka**. Tujuannya: membuat AI memahami proyek NagariSDLC sampai ke akar-akarnya — arsitektur, konvensi, domain bisnis, model data, dan jebakan-jebakan yang mudah salah — sebelum ia menyentuh atau menjelaskan apa pun.
>
> Berkas ini adalah **peta dan aturan main**, bukan pengganti kode. Setiap klaim di sini harus dicocokkan dengan kode sumber aktual sebelum dijadikan dasar tindakan. Bila dokumentasi (`docs/`) bertentangan dengan kode, **kode adalah kebenaran** — laporkan selisihnya, jangan mengarang.

---

## 0. INSTRUKSI UNTUK AI (baca dulu, patuhi selama sesi)

Kamu adalah asisten rekayasa perangkat lunak yang membantu pengembangan proyek NagariSDLC. Sebelum memberi saran, menjelaskan, atau mengubah apa pun:

1. **Pahami dulu, baru bertindak.** Ikuti urutan baca pada Bagian 2. Jangan menyimpulkan arsitektur dari satu berkas.
2. **Ikuti urutan sumber kebenaran.** Keputusan terbaru pengguna dan
   `AGENTS.md`/`docs/AI_HANDOFF.md` berada di atas implementasi aktif. Untuk klaim
   teknis yang tidak dikunci keputusan bisnis, cocokkan dokumentasi dengan route,
   migration, enum, model cast, service, dan konsumen frontend; laporkan setiap
   selisih dan jangan mengarang.
3. **Jangan mengarang.** Bila sebuah detail belum kamu verifikasi, katakan "belum diverifikasi" — jangan menebak angka, nama berkas, endpoint, atau perilaku.
4. **Bahasa Indonesia** untuk seluruh penjelasan, komentar kode, dan pesan bisnis. Istilah teknis asing boleh apa adanya.
5. **Jaga perubahan tetap kecil dan sesuai permintaan.** Dilarang tanpa izin eksplisit: refactor luas, menambah dependency, menjalankan `migrate`/`db:seed`/`migrate:fresh`, atau mengubah fase kerja lain.
6. **Telusuri setiap fitur ujung ke ujung** (lihat Bagian 9): frontend → `services/api.js` → route → Request/Controller/Service → Model/DB. Pastikan otorisasi dan audit trail tetap benar.
7. **Cek `git status` lebih dulu.** Repo sering dalam kondisi *dirty* karena fitur pengguna yang belum di-commit. Jangan menimpa perubahan yang tidak berkaitan. Jangan commit kecuali diminta.

Setelah membaca berkas ini, konfirmasi singkat pemahamanmu, lalu kerjakan hanya permintaan berikutnya.

---

## 1. APA PROYEK INI

**NagariSDLC** — aplikasi web *governance* siklus hidup pengembangan perangkat lunak (*Software Development Life Cycle*) internal PT Bank Pembangunan Daerah Sumatera Barat (Bank Nagari). Sistem membakukan alur proyek teknologi bank dari **pengajuan → review → analisis → pengembangan → SIT → UAT → QA → Keamanan Siber → rilis → produksi**, dengan penekanan pada: kontrol akses berbasis peran (RBAC), *state machine* status proyek, bukti dokumen, persetujuan individual per putaran, riwayat, dan *audit trail*.

**Tumpukan teknologi (tiga lapis):**

| Lapis | Teknologi |
|---|---|
| Klien (peramban) | React 19 · Vite 8 · Tailwind CSS 4 · pola *Single Page Application* (SPA) |
| Server aplikasi | Laravel 13 · PHP 8.3 · Laravel Sanctum · REST API |
| Basis data | MySQL, diakses via Eloquent ORM |
| Realtime | Laravel Reverb (event siaran) — lihat catatan lingkungan di Bagian 10 |
| Berkas | *Document Vault* (unggah berkas + masking nama berkas) |

**Skala kode (git-tracked, tanpa vendor/node_modules):** Backend PHP ± 30.656 baris; Frontend `src` ± 42.165 baris; total ± 72.821 baris. Angka ini indikatif — verifikasi ulang bila perlu presisi.

**Status penyelesaian (per catatan handoff, 26 Agustus 2026):** Fase sebelum SIT sudah dikerjakan. SIT dan UAT Internal lengkap (termasuk siklus revisi mayor & approval individual per putaran). Jalur QA dan Audit Keamanan Siber berjalan penuh (empat langkah identik), berikut pengajuan migrasi/rilis dan Quality Gate Head of IT.

---

## 2. URUTAN BACA DOKUMEN DAN SUMBER KEBENARAN

Dokumentasi resmi ada di folder `docs/` (root repo juga punya `AGENTS.md`, `API_CONTRACT.md`). Baca dengan urutan ini:

1. **`AGENTS.md`** (root) — aturan kerja dan urutan sumber kebenaran.
2. **`docs/AI_HANDOFF.md`** — keputusan serta keadaan proyek paling mutakhir.
3. **`docs/PROJECT_SUMMARY.md`** — ringkasan padat produk dan file penting.
4. **Dokumen domain sesuai kebutuhan:**
   - `docs/WORKFLOW.md` — state machine, tabel transisi valid, otorisasi role per transisi, alur SIT/UAT/QA/Cyber, Change Request UAT. **Rujukan utama alur.**
   - `docs/DATA_MODEL.md` — tabel & field, struktur JSON `sit_uat_data`, persetujuan UAT terstruktur, enum, migration, soft-delete.
   - `docs/API_REFERENCE.md` — daftar endpoint per modul + contoh payload + catatan error.
   - `docs/ARCHITECTURE.md` — diagram lapisan, backend, frontend, auth, keamanan, penyimpanan, realtime.
   - `docs/PRD.md` — kebutuhan produk, persona, fitur, non-functional, out-of-scope.
   - `docs/README.md` — cara menjalankan (Laragon), daftar dokumen.

### Status sinkronisasi

Dokumentasi resmi telah diselaraskan kembali pada 5 September 2026 dengan model
autentikasi cookie `HttpOnly`, akses analitik `super_admin` + `head_of_it`, alur
revisi Mayor yang mengulang UAT dari Tahap 1, dan status migration terbaru yang
tercatat. `API_CONTRACT.md` kini menjadi ringkasan kontrak aktif.

Nama `backend/docs/nagarisdlc_backend_blueprint_v2.md` dipertahankan untuk menjaga
tautan lama, tetapi isinya sudah diganti menjadi ringkasan implementasi Laravel 13.
Jika kelak ada perbedaan baru, ikuti urutan sumber kebenaran pada `AGENTS.md` dan
verifikasi route, config, enum, model, service, migration, serta consumer frontend.

---

## 3. PETA ARSITEKTUR & STRUKTUR DIREKTORI

Dua aplikasi terpisah dalam satu repo: `backend/` (Laravel) dan `frontend/` (React SPA). Komunikasi murni REST JSON di bawah prefix `/api/v1`.

### 3.1 Backend (`backend/`)

- **`app/Http/Controllers/Api/V1/`** — 20 controller: `Auth`, `Project`, `Task`, `Chat`, `Document`, `Notification`, `ActivityLog`, `Dashboard`, `QualityGate`, `ReleaseRequest`, `SitApproval`, `UatApproval`, `TestingTrack`, `QARequest`, `CyberRequest`, `User`, `Role`, `Group`, `Division`, `HealthCheck`. Controller tipis — logika berat ada di Service.
- **`app/Services/`** — inti aturan bisnis. Yang terpenting:
  - `ProjectWorkflowService` — **satu-satunya** *state machine* transisi status proyek (`transition()`, `allowedTransitions`, `$rolePermissions`, `validateTransitionPrerequisites()`, `syncTestingTrackStatuses()`).
  - `TestingTrackService` — orkestrator empat langkah jalur QA/Siber dan kolom jalur (`qa_status`/`cyber_status`) + putaran pengembalian.
  - `ProjectReturnRoundService` — **satu-satunya** penulis `project_return_rounds` (`open()`, `assertResubmitAllowed()`, `close()`).
  - `UatExecutionService` — draft/final UAT, penahanan revisi (`holdForMinorRevision()`, `holdForMajorRevision()`).
  - `UatApprovalService` — putaran & keputusan approval UAT, *inbox* lintas proyek.
  - `SitApprovalService`, `ReleaseReadinessService`, `ProjectAccessService` (cakupan visibilitas proyek), `FileUploadService`.
- **`app/Enums/`** — 12 enum termasuk `ProjectStatus`, `UserRole`, `UatApprovalRole`, `TrackStatus`, `ReturnRoundStatus`. Enum ini adalah sumber kebenaran daftar nilai.
- **`app/Models/`** — 17 model Eloquent (`User`, `Project`, `ProjectTask`, dst.). `Project` adalah hub.
- **`app/Http/Middleware/`** — `AuthenticateFromSessionCookie` (cookie → header Authorization), `RoleMiddleware` (`role:` guard).
- **`app/Http/Requests/`** — 14 subdirektori Form Request untuk validasi & otorisasi per aksi.
- **`app/Support/`** — `SessionTokenCookie` (pabrik cookie sesi), `PasswordPolicy`.
- **`app/Traits/LogsActivity.php`** — audit trail otomatis.
- **`app/Events/`** — `ProjectUpdated`, `NotificationCreated` (keduanya `ShouldBroadcast`, di-*queue*).
- **`routes/api.php`** — kontrak route aktual (± 214 baris). `channels.php`, `console.php`, `web.php`.
- **`database/migrations/`** — 44 migration. **`config/`** — termasuk `auth_cookie.php`, `cors.php`, `sanctum.php`, `broadcasting.php`.
- **`tests/`** — PHPUnit (Feature + Unit). Berjalan di SQLite `:memory:` (lihat Bagian 11).

### 3.2 Frontend (`frontend/src/`)

- **`App.jsx`**, **`main.jsx`** — bootstrap SPA.
- **`services/api.js`** — **satu pintu** seluruh panggilan API. Semua fetch lewat sini (auth cookie, envelope respons, refresh token).
- **`router/index.jsx`** — definisi route + `ProtectedRoute` + daftar `ALL_ROLES`/guard per role.
- **`contexts/`** — 6 context provider: `Auth`, `Project`, `Notification`, `Chat`, `Activity`, `MasterData`.
- **`constants/`** — 12 berkas konstanta (mis. `projectStatus.js`, `roles.js`, `uatChangeRequest.js`). `roles.js` mencerminkan enum backend dan **sumber otorisasi grup Perencanaan/QA di FE**.
- **`data/menuConfig.js`** — konfigurasi menu/sidebar per role + `filterSectionsByMenuAccess()`.
- **`pages/`** — 43 halaman dalam subfolder `admin/`, `approvals/`, `mytasks/`, `pm/`, `projects/`, `workspace/`.
- **`components/`** — 19 komponen; yang paling berat: `SITUATWizard.jsx` (alur SIT & UAT), `SITTaskExecution.jsx`.
- **`hooks/`**, **`utils/`**, **`layouts/`** — pendukung.

---

## 4. KONVENSI WAJIB (jangan dilanggar)

1. **Format respons API seragam:** setiap respons berupa objek `{ status, message, data, meta? }`. Frontend `api.js` mengurai amplop ini secara terpusat.
2. **Semua transisi status proyek lewat `ProjectWorkflowService::transition()`** — yang mencatat riwayat (`project_status_histories`), menyiarkan `ProjectUpdated`, dan membuat notifikasi. Jangan mengubah `projects.status` langsung dari controller/model.
3. **Kolom jalur uji (`qa_status`/`cyber_status`) hanya boleh ditulis** oleh endpoint jalur (`/qa-requests/*`, `/cyber-requests/*`) dan `ProjectWorkflowService::syncTestingTrackStatuses()`. `PATCH /projects/{id}` menolak semua nilai jalur kecuali `FAILED`, dan `FAILED` wajib disertai `status = RETURN_TO_DEV` pada request yang sama.
4. **`project_return_rounds` hanya ditulis `ProjectReturnRoundService`.** Jangan menulisnya dari tempat lain.
5. **Audit trail via trait `LogsActivity`.** Pertahankan pencatatan pada aksi yang mengubah data.
6. **Otorisasi = peran (role), bukan grup.** Grup kerja hanya penyajian (lihat Bagian 6).
7. **Bahasa Indonesia** untuk UI, pesan bisnis, komentar. Data pribadi/administratif jangan ditebak.
8. **Cakupan visibilitas proyek terpusat** di `ProjectAccessService::applyVisibilityScope()`. Jangan menyalin aturan `if role` ke controller dasbor — tambahkan di service agar `GET /projects` dan dasbor tidak menyimpang.

---

## 5. MODEL AUTENTIKASI (TERVERIFIKASI DARI KODE — ganti model lama di docs)

Token akses Sanctum dikirim **ganda**, dan **cookie adalah jalur utama SPA**:

1. **Penerbitan (login/refresh).** `AuthController` memanggil `$user->createToken('auth_token')->plainTextToken`, lalu membungkus respons dengan `->withCookie(SessionTokenCookie::issue($token))`. Cookie bernama **`nagari_sdlc_token`**, atribut **`HttpOnly`**, `SameSite=lax` (default), `Secure` di semua environment kecuali `local`, masa berlaku diikat `SANCTUM_TOKEN_EXPIRATION` (default 480 menit / 8 jam).
2. **Sisi klien (`frontend/src/services/api.js`).** Tidak ada lagi header `Authorization` yang dikirim SPA. Setiap fetch memakai **`credentials: 'include'`** agar peramban melampirkan cookie. Ada header penjaga **`X-Requested-With: XMLHttpRequest`**. `localStorage['nagari_sdlc_session']` **hanya** menyimpan profil `user` + `issuedAt` + `expiresInMinutes` — **tidak ada token di `localStorage`**.
3. **Sisi server (`AuthenticateFromSessionCookie`).** Middleware membaca cookie dan mengisinya sebagai header `Authorization: Bearer` **hanya bila** request tidak membawa header sendiri, sehingga guard `auth:sanctum`, seluruh route, policy, dan test lama tetap berjalan tanpa perubahan. **Header eksplisit selalu menang** — inilah jalur kompatibilitas: klien lama, test otomatis, dan tautan approver eksternal tetap bisa memakai Bearer.
4. **Proteksi CSRF.** Untuk request berbasis cookie, header `X-Requested-With` **wajib**; bila tidak ada, dijawab **`400`, bukan `401`** (401 memicu logout otomatis di frontend). Formulir HTML lintas situs tidak bisa menyetel header khusus tanpa memicu preflight CORS. Request yang membawa `Authorization` sendiri dibebaskan dari syarat header ini.
5. **CORS (`config/cors.php`).** `supports_credentials => true` (wajib untuk cookie lintas origin). Wildcard `*` dibuang di **semua** environment (credentialed request melarang `Access-Control-Allow-Origin: *`). Origin diambil dari `CORS_ALLOWED_ORIGINS`; saat `local`, origin dev Vite (5173/4173) ditambahkan otomatis. `allowed_headers` memuat `Authorization`, `X-Requested-With`, `X-UAT-Approval-Access`.
6. **Rotasi & keluar.** `POST /auth/refresh` menerbitkan token baru + cookie baru. Logout mencabut token Sanctum + `SessionTokenCookie::forget()`.
7. **Approver eksternal UAT** memakai sesi terpisah (header `X-UAT-Approval-Access` + token tautan yang disimpan sebagai hash SHA-256), **bukan** cookie sesi ini.

> Catatan produksi: `config/auth_cookie.php` punya `expose_token_in_body` (default `true` demi kompatibilitas Postman/test). Di produksi sebaiknya `false` agar token tidak pernah melewati JavaScript sama sekali.

---

## 6. DOMAIN INTI (aturan bisnis yang sudah dikunci)

### 6.1 Peran Pengguna — 12 peran, DAFTAR TETAP
`super_admin`, `head_of_it`, `lead_group`, `analyst`, `development_lead`, `project_manager`, `developer`, `qa_lead`, `qa_tester`, `cyber_lead`, `pentester`, `business_user`.

`super_admin` = akses global. Role lain memperoleh akses dari keterlibatan/penugasan proyek + kebutuhan approval. **Peran baru yang dibuat lewat Administrasi bersifat mati** (tidak ada di `ALL_ROLES` frontend, tidak ada baris di `$rolePermissions`, `ProjectAccessService` jatuh ke `whereRaw('1 = 0')`). Jangan menjanjikan role dinamis.

### 6.2 Grup Kerja — 5 grup, HANYA penyajian (BUKAN otorisasi)
Manajemen TI · Perencanaan & QA · Pengembangan · Keamanan Siber · Pemohon. Tabel `groups` + `roles.group_id`/`roles.menu_access` dikelola Super Admin di `/admin/groups`. **Hak transisi status tetap di kode** (`ProjectWorkflowService::$rolePermissions`), cakupan proyek di `ProjectAccessService`, hak pelaksana uji di `TestingTrack::testerRoles()`. `roles.menu_access` bersifat **mengurangi saja & gagal-terbuka** (`null`/kosong = tanpa pembatasan); menyembunyikan menu **tidak** menutup route.

### 6.3 Mesin Status Proyek — 27 status (`ProjectStatus`)
- **Fase 1 — Perencanaan & Analisis (4):** `PENDING`, `IN_REVIEW`, `ANALYSIS_APPROVED`, `REJECTED`.
- **Fase 2 — Pengembangan → SIT → UAT (13):** `READY_FOR_DEVELOPMENT`, `DEV_ANALYSIS`, `DEV_ANALYSIS_DONE`, `IN_DEVELOPMENT`, `SIT_IN_PROGRESS`, `SIT_REVISION`, `SIT_PASSED`, `UAT_IN_PROGRESS`, `UAT_REVISION_SIT`, `UAT_REVISION_DEV`, `UAT_PASSED`, `DEV_COMPLETED`, `RETURN_TO_DEV`.
- **Fase 3 — QA & Keamanan Siber, paralel (5):** `READY_FOR_QA`, `QA_IN_PROGRESS`, `QA_PASSED`, `CYBER_IN_PROGRESS`, `CYBER_PASSED`.
- **Fase 4 — Rilis & Produksi (2):** `PENDING_GOLIVE`, `LIVE_PRODUCTION`.
- **Non-linear (2):** `ON_HOLD`, `CANCELLED`.
- **Legacy / tanpa transisi aktif (1):** `READY_FOR_UAT`. Dipertahankan agar riwayat lama terbaca; **jangan** dipakai untuk alur baru dan **jangan** dihapus dari enum. `UAT_PASSED` masih memiliki transisi aktif menuju `DEV_COMPLETED`, tetapi hanya sebagai keluaran opsional UAT Internal dan bukan bagian alur rilis utama.

### 6.4 SIT & UAT
- **SIT** = 3 tab (persiapan data → eksekusi per task + bukti → review/sign-off). Dokumen Berita Acara SIT wajib sebelum lanjut UAT. Approval SIT: seluruh developer assignee + PM/Analyst Pengembangan + Development Lead.
- **UAT Internal** = 3 tab (persiapan + peserta/matriks approver + undangan → eksekusi per skenario → persetujuan final individual).
- **Temuan MINOR:** diperbaiki di tempat, **tanpa rollback**, status tetap `UAT_IN_PROGRESS`, tetapi **menahan penutupan UAT** (`uat_hold.reason='minor_revision'`) sampai seluruh Change Request minor `resolved`.
- **Temuan MAYOR:** jadi Change Request → `UAT_REVISION_DEV` → developer perbaiki → **SIT ulang menyeluruh** (seluruh task aktif kecuali `TAKE_DOWN`) → setelah lulus, **UAT diulang dari Tab 1** (putaran approval baru). **Daftar peserta UAT tidak pernah dikosongkan** — jangan pernah menulis kode yang me-reset roster.

### 6.5 Matriks Persetujuan UAT — 7 peran approver (`UatApprovalRole`)
`requester` (Pemohon Proyek), `requester_group_lead`, `requester_division_lead`, `developer`, `analyst_pm`, `development_group_lead`, `technology_division_lead`. Enam sebagai *required single roles* (semua kecuali `developer`). Dua mode: **INTERNAL_ACCOUNT** (akun aplikasi) dan **EXTERNAL_LINK** (tautan unik + verifikasi nomor HP; dipakai pihak peminta). **Persetujuan pemohon ADA di matriks ini** (peran `requester`) — bukan langkah terpisah.

### 6.6 Jalur QA & Keamanan Siber — paralel & independen
Dua jalur, masing-masing **4 langkah: Pengajuan → Disposisi → Laporan → Sign-off**.
- QA: Pengajuan (PM/Analis) → Disposisi (QA Lead) → Laporan (QA Tester) → Sign-off (QA Lead).
- Siber: Pengajuan (PM/Analis) → Disposisi (Cyber Lead) → Laporan (Pentester) → Sign-off (Cyber Lead).
Status gabungan **tidak** dipakai — tiap jalur punya kolomnya sendiri (`qa_status`/`cyber_status`); `projects.status` menyusul. Sign-off `fail` membuka **Putaran Pengembalian** (`project_return_rounds`) → `RETURN_TO_DEV`; pengajuan ulang ditahan sampai seluruh task perbaikan putaran itu selesai. Beban kerja analis untuk disposisi diambil server-side dari `GET /users/workload`.

### 6.7 Gerbang Rilis (Quality Gate)
`PENDING_GOLIVE` hanya bila **KEDUA** jalur (QA + Siber) `PASSED`. Persetujuan go-live akhir oleh **Head of IT** → `LIVE_PRODUCTION`. **TIDAK ADA UAT final** setelah QA/Siber — UAT berada di Fase 2, sebelumnya.

---

## 7. MODEL DATA (ringkas — detail di `docs/DATA_MODEL.md`)

- **25 tabel** = 17 domain + 8 bawaan framework.
- **Domain:** `users`, `roles`, `groups`, `divisions`, `projects`, `project_tasks`, `project_team_members`, `project_return_rounds`, `project_status_histories`, `release_requests`, `test_reports`, `uat_approval_rounds`, `uat_approvers`, `document_vaults`, `chat_messages`, `activity_logs`, `notifications`.
- **Bawaan:** `sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `password_reset_tokens`, `personal_access_tokens`.
- **Hub `projects`** menautkan seluruh entitas anak. Kolom penting: `created_by`, `pm_id`, `analyst_id`, `status`, `qa_status`, `cyber_status`, `sit_uat_data` (JSON besar berisi tab SIT/UAT, peserta, approval, Change Request, arsip putaran `uat_cycles`).
- **Aturan relasi:** anak-ke-`projects` = **CASCADE**; FK audit ke `users` = **RESTRICT**; FK penugasan = **SET NULL**.
- **Praktis tidak terpakai:** `cache_locks`, `job_batches` (ada semata karena driver default `database`). `cache` dipakai rate limiting; `jobs` dipakai event siaran yang di-*queue*.
- Token link/sesi eksternal disimpan sebagai **hash SHA-256**; soft-delete + proteksi jejak audit berlaku (lihat `docs/DATA_MODEL.md` §6).

---

## 8. FILE PALING PENTING (titik masuk pemahaman)

**Backend:**
- `backend/app/Services/ProjectWorkflowService.php` — state machine.
- `backend/app/Services/TestingTrackService.php` — jalur QA/Siber + putaran pengembalian.
- `backend/app/Services/ProjectReturnRoundService.php` — penulis tunggal `project_return_rounds`.
- `backend/app/Services/UatExecutionService.php` & `UatApprovalService.php` — UAT.
- `backend/app/Http/Controllers/Api/V1/ProjectController.php` — endpoint workflow proyek.
- `backend/routes/api.php` — kontrak route aktual.
- `backend/app/Enums/ProjectStatus.php`, `UserRole.php`, `UatApprovalRole.php` — daftar nilai kanonik.

**Frontend:**
- `frontend/src/services/api.js` — satu pintu API + auth cookie.
- `frontend/src/components/SITUATWizard.jsx` — UI/alur SIT & UAT (besar; jangan refactor untuk perubahan kecil).
- `frontend/src/components/SITTaskExecution.jsx` — eksekusi SIT per task.
- `frontend/src/router/index.jsx` + `frontend/src/data/menuConfig.js` — akses & navigasi role.
- `frontend/src/constants/roles.js` — cermin `UserRole::PLANNING_QA_*`; sumber otorisasi grup itu di FE.

---

## 9. CARA MENELUSURI SEBUAH FITUR (ujung ke ujung)

Untuk memahami atau mengubah fitur apa pun, telusuri rantai ini dan jangan berhenti di tengah:

```
Halaman/komponen (frontend/src/pages, components)
  → panggilan di frontend/src/services/api.js
    → route di backend/routes/api.php (+ middleware role:/throttle:)
      → Form Request (validasi + otorisasi) di app/Http/Requests
        → Controller di app/Http/Controllers/Api/V1
          → Service (aturan bisnis) di app/Services
            → Model/Eloquent + migration di app/Models & database/migrations
              → Resource (bentuk respons) di app/Http/Resources
```

Pada setiap perubahan: pastikan otorisasi (role + visibilitas proyek) benar, audit trail tetap tercatat, dan status hanya berpindah lewat `ProjectWorkflowService`.

---

## 10. CATATAN LINGKUNGAN & JEBAKAN (rawan salah)

1. **Auth = cookie `HttpOnly` (jalur utama) + Bearer (kompatibilitas).** Jangan menulis "token di `localStorage`". Lihat Bagian 5; dokumentasi resmi telah diselaraskan pada 5 September 2026.
2. **`UNLOCK_ALL_STAGES = false`** di `SITUATWizard.jsx` — **harus tetap `false`** (keputusan pengguna 22 Agustus 2026). Boleh dinyalakan untuk debug lokal, **jangan pernah di-commit** menyala.
3. **12 role = daftar tetap.** Role baru lewat Administrasi mati by design.
4. **5 grup = penyajian, bukan otorisasi.** Otorisasi dari peran.
5. **`READY_FOR_UAT` = legacy** tanpa transisi aktif. `UAT_PASSED` tetap aktif sebagai keluaran opsional UAT Internal menuju `DEV_COMPLETED`, bukan gerbang rilis. Jangan hapus keduanya dari enum.
6. **Tidak ada UAT final** setelah QA/Siber.
7. **Realtime:** event `ProjectUpdated`/`NotificationCreated` `ShouldBroadcast` (di-*queue*). Pada `.env` saat ini `BROADCAST_CONNECTION=log` — **Reverb belum aktif di environment ini**; default konfigurasi = `reverb`. Realtime nyata butuh `BROADCAST_CONNECTION=reverb` + server Reverb + *queue worker*.
8. **Driver:** `SESSION_DRIVER=database`, `QUEUE_CONNECTION=database`, `CACHE_STORE=database`.
9. **Basis data live pada port 3306.** Ada salinan usang `nagarisdlc` di **port 3307** — **jangan** query 3307, kesimpulannya keliru.
10. **Enum sebagai kunci array = jebakan.** `projects.status` dicast ke enum; `Model::pluck($v, 'status')` menghasilkan kunci objek enum dan melempar `TypeError: Cannot access offset of type App\Enums\ProjectStatus on array`. Untuk agregat berkunci kolom enum pakai `DB::table` + `whereNull('deleted_at')` manual.
11. **Test jalan di SQLite `:memory:`** (selalu migrasi bersih), jadi selisih skema DB sungguhan vs migration **tidak** terlihat dari hasil test — verifikasi lewat `php artisan migrate:status` / `php artisan db:table <tabel>`.
12. **Dokumentasi bisa tertinggal dari kode.** Bila bertentangan, verifikasi route, migration, enum, model cast, service, dan konsumen frontend sebelum menyimpulkan.

---

## 11. VERIFIKASI & PENGUJIAN YANG DIIZINKAN

- **Boleh dijalankan AI untuk verifikasi:** `php vendor/bin/phpunit`, `npx eslint src`, `npx vite build`.
- **Dilarang tanpa izin baru:** perintah yang menyentuh database sungguhan — `php artisan migrate`, `db:seed`, `migrate:fresh`. Pengguna menjalankan migrasi sendiri.
- **Snapshot pengujian terakhir (26 Agustus 2026, historis):** 236 test / 1.467 assertion lulus; ESLint bersih; Vite build sukses. `backend/phpunit.xml` memaksa `DB_CONNECTION=sqlite` `:memory:`, `MAIL_MAILER=array`, `QUEUE_CONNECTION=sync`.
- **Repo melacak `node_modules`** — jangan `npm install` di dalam pohon repo bila tidak diminta.

---

## 12. CARA MEMAKAI PROMPT INI

1. Tempel seluruh isi berkas ini sebagai pesan/konteks pertama ke AI.
2. Minta AI mengonfirmasi pemahamannya secara singkat (peta arsitektur, aturan kritis, model auth yang benar).
3. Baru berikan tugas nyatamu. AI wajib mencocokkan setiap klaim di sini dengan kode aktual sebelum bertindak, dan melaporkan bila menemukan dokumentasi yang usang.
