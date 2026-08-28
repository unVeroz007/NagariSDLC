# PROMPT MASTER — Penyusunan Laporan Kerja Praktek (Magang) Proyek "NagariSDLC"

> Salin SELURUH isi berkas ini ke AI yang kamu pilih. Ini adalah satu paket konteks + instruksi yang lengkap dan mandiri. Fakta di bawah sudah diverifikasi dari kode sumber proyek. **Jangan menambah, mengurangi, atau mengarang angka/istilah apa pun di luar yang tertulis di sini.**

---

## 0. INSTRUKSI UNTUK AI

Kamu adalah asisten penulisan akademik. Tugasmu menyusun **Laporan Kerja Praktek (Magang)** yang lengkap, profesional, runtut, dan siap dijilid, berdasarkan konteks proyek dan aturan format yang diberikan di berkas ini.

Aturan kerja wajib:
1. **Bahasa Indonesia baku** untuk seluruh isi laporan.
2. **Dilarang mengarang.** Hanya gunakan fakta pada berkas ini. Jika sebuah data pribadi/administratif tidak tersedia (nama, NIM, dosen, tanggal, logo, alamat resmi, visi–misi resmi), tulis sebagai isian dalam kurung siku, contoh: `[ NAMA MAHASISWA ]`, `[ NIM ]`, `[ TANGGAL ]`. Jangan mengisi sendiri.
3. **Istilah asing dicetak miring** (italic), contoh: *state machine*, *back end*, *front end*, *Single Page Application*.
4. Patuhi **aturan format UNAND** (Bagian 3) dan **struktur laporan** (Bagian 4) secara persis.
5. Jangan menyalahi "Daftar Pernyataan yang TIDAK Boleh Keliru" (Bagian 5). Ini rawan salah — patuhi apa adanya.
6. Jika kamu tidak yakin pada satu detail, tandai dengan `[ perlu dilengkapi ]`, bukan menebak.

Parameter laporan (sudah ditetapkan):
- Program Studi: **Informatika**, Fakultas Teknologi Informasi, Universitas Andalas.
- Periode Kerja Praktek: **± 2 bulan (8 minggu)** → tabel kegiatan 8 baris.
- Peran mahasiswa: **Pengembang *fullstack*** (menangani *back end* dan *front end*) → Bab IV ditulis dari sudut pandang ini.
- Instansi: **PT Bank Pembangunan Daerah Sumatera Barat (Bank Nagari)**, Divisi Teknologi Informasi, Padang.

---

## 1. IDENTITAS & RINGKASAN PROYEK

**Nama sistem:** NagariSDLC — aplikasi web tata kelola siklus hidup pengembangan perangkat lunak (*Software Development Life Cycle*, SDLC) internal Bank Nagari.

**Masalah yang diselesaikan:** membakukan seluruh alur proyek perangkat lunak internal bank (pengajuan → analisis → pengembangan → SIT → UAT → QA → keamanan siber → rilis) dengan pemisahan tugas antarunit, keterlacakan riwayat, dan kontrol akses berbasis peran.

**Judul laporan yang disarankan:** "Pengembangan Sistem Informasi Tata Kelola Siklus Hidup Pengembangan Perangkat Lunak (SDLC) Berbasis Web pada PT Bank Pembangunan Daerah Sumatera Barat (Bank Nagari)".

**Skala kode (git-tracked, tanpa vendor/node_modules):**
- Backend PHP (app, routes, database, tests, config): **30.656 baris**.
- Frontend src (js/jsx/ts/tsx/css): **42.165 baris**.
- Total: **± 72.821 baris**.

**Status kualitas (snapshot 26 Agustus 2026):**
- Uji otomatis backend (PHPUnit): **236 pengujian / 1.467 asersi**, seluruhnya lulus.
- Analisis statis frontend (ESLint): bersih, 0 error.
- *Build* produksi (Vite): sukses.

---

## 2. FAKTA TEKNIS TERVERIFIKASI (jangan diubah)

### 2.1 Arsitektur & Tumpukan Teknologi (tiga lapis)
| Lapis | Teknologi |
|---|---|
| Klien (peramban) | React 19 · Vite 8 · Tailwind CSS 4 · pola *Single Page Application* (SPA) |
| Server aplikasi | Laravel 13 · PHP 8.3 · Laravel Sanctum · REST API |
| Basis data | MySQL, diakses via Eloquent ORM |
| Realtime | Laravel Reverb (siaran/notifikasi *realtime*) — lihat catatan 2.9 |
| Berkas | Document Vault (unggah berkas + masking nama berkas) |

- **Autentikasi:** token akses **Sanctum** dikirim ganda — jalur **utama** berupa **cookie `HttpOnly`** (`nagari_sdlc_token`) yang dilampirkan peramban lewat `credentials: 'include'`, dan jalur **kompatibilitas** berupa header `Authorization: Bearer` (klien lama, pengujian, tautan approver eksternal). SPA tidak menyimpan token di `localStorage` — `localStorage` hanya memuat profil `user` + waktu terbit/kedaluwarsa. Proteksi CSRF lewat header wajib `X-Requested-With`. (BUKAN JWT.)
- **Format respons API seragam:** objek `{ status, message, data, meta? }`.
- **CORS:** dikendalikan variabel lingkungan `CORS_ALLOWED_ORIGINS`.
- **Rate limiting:** middleware `throttle:` dipakai di banyak route (mis. login `throttle:5,1`).

### 2.2 Peran Pengguna (12 peran — daftar tetap)
`super_admin`, `head_of_it`, `lead_group`, `analyst`, `development_lead`, `project_manager`, `developer`, `qa_lead`, `qa_tester`, `cyber_lead`, `pentester`, `business_user`.

Ringkasan tanggung jawab:
- **super_admin** — administrasi penuh sistem (pengguna, peran, master data).
- **head_of_it** — persetujuan strategis & gerbang rilis (*go-live*) ke produksi.
- **lead_group** — pimpinan grup perencanaan/analisis.
- **analyst** — analisis kebutuhan & kelayakan.
- **development_lead** — pimpinan tim pengembang.
- **project_manager** — perencanaan & pemantauan proyek.
- **developer** — implementasi perangkat lunak (**posisi mahasiswa KP**).
- **qa_lead** — disposisi & *sign-off* QA.
- **qa_tester** — eksekusi pengujian QA.
- **cyber_lead** — disposisi & *sign-off* keamanan siber.
- **pentester** — pengujian penetrasi.
- **business_user** — pemohon kebutuhan & peserta UAT.

### 2.3 Grup Kerja (5 — HANYA pengelompokan tampilan, BUKAN dasar otorisasi)
Otorisasi ditentukan oleh **peran**, bukan grup. Grup hanya untuk penyajian.
| Grup | Peran anggota |
|---|---|
| Manajemen TI | super_admin, head_of_it |
| Perencanaan & QA | lead_group, analyst, qa_lead, qa_tester |
| Pengembangan | development_lead, project_manager, developer |
| Keamanan Siber | cyber_lead, pentester |
| Pemohon | business_user |

### 2.4 Mesin Status Proyek (27 status)
Seluruh transisi HANYA melalui satu layanan terpusat: **`ProjectWorkflowService::transition()`** — yang mencatat riwayat, menyiarkan pembaruan, dan membuat notifikasi.

- **Fase 1 — Perencanaan & Analisis (5):** `PENDING`, `IN_REVIEW`, `ANALYSIS_APPROVED`, `READY_FOR_DEVELOPMENT`, `REJECTED`.
- **Fase 2 — Pengembangan → SIT → UAT (10):** `DEV_ANALYSIS`, `DEV_ANALYSIS_DONE`, `IN_DEVELOPMENT`, `SIT_IN_PROGRESS`, `SIT_REVISION`, `SIT_PASSED`, `UAT_IN_PROGRESS`, `UAT_REVISION_SIT`, `UAT_REVISION_DEV`, `DEV_COMPLETED`.
- **Fase 3 — QA & Keamanan Siber, paralel (6):** `READY_FOR_QA`, `QA_IN_PROGRESS`, `QA_PASSED`, `CYBER_IN_PROGRESS`, `CYBER_PASSED`, `RETURN_TO_DEV`.
- **Fase 4 — Rilis & Produksi (2):** `PENDING_GOLIVE`, `LIVE_PRODUCTION`.
- **Non-linear (2):** `ON_HOLD`, `CANCELLED`.
- **Legacy / tanpa transisi aktif (2):** `READY_FOR_UAT`, `UAT_PASSED`.

### 2.5 Alur SIT & UAT
- **SIT (System Integration Test):** 3 tahap.
- **UAT (User Acceptance Test):** 3 tahap (Tahap 1 skenario + peserta/matriks approver + undangan; Tahap 2 eksekusi per skenario; Tahap 3 persetujuan final individual).
- **Percabangan temuan UAT pada Tahap 2:**
  - **MINOR (perubahan kecil):** diperbaiki di tempat, **tanpa *rollback*** dan tanpa pindah status (tetap `UAT_IN_PROGRESS`), tetapi **menahan penutupan UAT** hingga seluruh *Change Request* minor berstatus *resolved*.
  - **MAYOR (perubahan besar):** menjadi *Change Request* → `UAT_REVISION_DEV` → developer memperbaiki → **SIT ulang menyeluruh** → setelah lulus, **UAT diulang dari Tahap 1** (putaran persetujuan baru). Daftar peserta UAT **tidak pernah dikosongkan**.

### 2.6 Matriks Persetujuan UAT (approver) — 7 peran persetujuan
Persetujuan pemohon TERMASUK di sini (bukan langkah terpisah). Enum `UatApprovalRole`:
| Kode | Label |
|---|---|
| `requester` | Pemohon Proyek |
| `requester_group_lead` | Pimpinan Grup Pemohon |
| `requester_division_lead` | Pimpinan Divisi Pemohon |
| `developer` | Developer |
| `analyst_pm` | Analyst / Project Manager |
| `development_group_lead` | Pimpinan Grup Pengembangan |
| `technology_division_lead` | Pimpinan Divisi Teknologi dan Digitalisasi |

- Enam peran sebagai *required single roles* (persetujuan tunggal wajib): requester, requester_group_lead, requester_division_lead, analyst_pm, development_group_lead, technology_division_lead.
- Dua mode approver: **INTERNAL_ACCOUNT** (akun internal) dan **EXTERNAL_LINK** (tautan eksternal). `requester_division_lead` memakai mode *external link*; selain itu umumnya *internal account*.
- Ada konsep satu *inbox* lintas proyek untuk seluruh tugas persetujuan UAT internal milik seorang pengguna (`uat_approvers` + `uat_approval_rounds` berstatus ACTIVE).

### 2.7 Jalur QA & Keamanan Siber (paralel & independen)
- Dua jalur berjalan **paralel dan independen**: **QA** dan **Keamanan Siber**.
- Tiap jalur **4 langkah**: **Pengajuan → Disposisi → Laporan → Sign-off**.
  - QA: Pengajuan (PM/Analis) → Disposisi (QA Lead) → Laporan (QA Tester) → Sign-off (QA Lead).
  - Siber: Pengajuan (PM/Analis) → Disposisi (Cyber Lead) → Laporan (Pentester) → Sign-off (Cyber Lead).
- **FAILED** membuka **Putaran Pengembalian** (`project_return_rounds`) → proyek `RETURN_TO_DEV`; pengajuan ulang ditahan sampai seluruh task perbaikan selesai.
- Beban kerja analis untuk disposisi diambil server-side dari `GET /users/workload`.

### 2.8 Gerbang Rilis (Quality Gate)
- Proyek dapat berstatus `PENDING_GOLIVE` hanya jika **KEDUA** jalur (QA dan Siber) berstatus `PASSED`.
- Persetujuan *go-live* akhir oleh **Head of IT** → status `LIVE_PRODUCTION`.
- **TIDAK ADA UAT final** setelah tahap QA/Siber. (UAT berada di Fase 2, sebelum QA/Siber.)

### 2.9 Model Data (basis data)
- **25 tabel** total. Terbagi **17 tabel domain** + **8 tabel bawaan framework**.
- **17 tabel domain:** `users`, `roles`, `groups`, `divisions`, `projects`, `project_tasks`, `project_team_members`, `project_return_rounds`, `project_status_histories`, `release_requests`, `test_reports`, `uat_approval_rounds`, `uat_approvers`, `document_vaults`, `chat_messages`, `activity_logs`, `notifications`.
- **8 tabel bawaan:** `sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `password_reset_tokens`, `personal_access_tokens`.
- **Hub `projects`** menautkan seluruh entitas anak. Kolom penting: `created_by`, `pm_id`, `analyst_id`, `status`, `qa_status`, `cyber_status`, `sit_uat_data` (JSON).
- **Aturan relasi:** anak-ke-`projects` = **CASCADE**; FK audit ke `users` = **RESTRICT**; FK penugasan = **SET NULL**.
- Catatan kebersihan skema: `cache_locks` dan `job_batches` praktis tidak terpakai (ada semata karena driver default `database`). `cache` terpakai oleh rate limiting; `jobs` terpakai oleh event siaran yang di-*queue*.

### 2.10 Catatan Lingkungan (penting untuk akurasi klaim)
- Broadcasting: event `ProjectUpdated` dan `NotificationCreated` mengimplementasikan `ShouldBroadcast` (di-*queue*). Pada `.env` saat ini `BROADCAST_CONNECTION=log` (siaran masuk log; **Reverb belum aktif di environment ini**), sedangkan default konfigurasi = `reverb`. Untuk realtime nyata: set `BROADCAST_CONNECTION=reverb` + jalankan server Reverb + *queue worker*.
- Driver: `SESSION_DRIVER=database`, `QUEUE_CONNECTION=database`, `CACHE_STORE=database`.
- Basis data live pada port 3306.

### 2.11 Endpoint API (representatif)
| Metode | Path / Aksi | Fungsi |
|---|---|---|
| POST | `/login` | Autentikasi; menerbitkan token Sanctum sebagai cookie `HttpOnly` (jalur utama) sekaligus mendukung header Bearer (kompatibilitas). |
| POST | `/logout` | Mencabut token sesi aktif. |
| POST | `/register` | Registrasi pengguna baru (nomor telepon **wajib**). |
| POST | `/auth/forgot-password` | Permintaan tautan reset kata sandi. |
| POST | `/auth/reset-password` | Reset kata sandi. |
| GET | `/users/workload` | Beban kerja analis untuk disposisi QA/Siber. |
| GET/POST | `/projects` | Daftar/pembuatan proyek (sesuai lingkup visibilitas peran). |
| — | Transisi status | Perubahan status via `ProjectWorkflowService::transition()`. |

Catatan registrasi: `phone_number` wajib (min 8, maks 20); field `role`, `role_id`, `is_active` bersifat *prohibited* pada registrasi.

---

## 3. ATURAN FORMAT PENULISAN (UNAND) — WAJIB

**Kertas & huruf:**
- Kertas A4 putih, berat ≥ 70 gsm.
- Margin: **kiri 4 cm, kanan 3 cm, atas 3 cm, bawah 3 cm**.
- Font **Times New Roman 12 pt** (judul boleh 14 pt).
- Spasi baris **1,15**, teks rata kiri–kanan (*justify*).
- Istilah asing **dicetak miring**.

**Penomoran:**
- Bab dinomori angka Romawi (I, II, III, …); judul bab HURUF KAPITAL.
- Subbab & anak-subbab: penomoran desimal (1.1, 1.1.1) tanpa titik di belakang; judul *Title Case* tebal.
- Nomor halaman **bagian awal**: angka Romawi kecil (i, ii, iii) di **tengah bawah**.
- Nomor halaman **bagian isi**: angka Arab (1, 2, 3) di tengah (sesuai ketentuan prodi).

**Tabel & gambar:**
- **Judul tabel di ATAS tabel**; **judul gambar di BAWAH gambar**; keduanya rata tengah.
- Penomoran per-bab: `Tabel 4.1` = tabel pertama Bab IV; `Gambar 2.1` = gambar pertama Bab II.
- Logo Universitas Andalas: lebar 3 cm × tinggi 3,5 cm.

---

## 4. STRUKTUR LAPORAN — WAJIB LENGKAP

### Bagian Awal (nomor halaman Romawi kecil)
1. Halaman Judul (Sampul) — memuat judul, logo UNAND `[ LOGO ]`, `[ NAMA ]`, `[ NIM ]`, Program Studi Informatika, FTI, Universitas Andalas, Padang, `[ TAHUN ]`.
2. Halaman Pernyataan Keaslian.
3. Halaman Pengesahan Dosen (Dosen Pembimbing, Dosen Penguji, Ketua Departemen/Program Studi).
4. Halaman Pengesahan Pembimbing Lapangan (Divisi TI Bank Nagari).
5. Abstrak (satu paragraf + kata kunci).
6. Kata Pengantar.
7. Daftar Isi.
8. Daftar Tabel.
9. Daftar Gambar.
10. Daftar Lampiran.

### Bagian Isi (nomor halaman Arab)
- **BAB I PENDAHULUAN:** 1.1 Latar Belakang · 1.2 Rumusan Masalah · 1.3 Tujuan · 1.4 Batasan Masalah.
- **BAB II PROFIL INSTANSI DAN PELAKSANAAN KERJA PRAKTEK:** 2.1 Profil Instansi · 2.2 Visi dan Misi · 2.3 Struktur Organisasi (sertakan **Gambar 2.1** struktur organisasi Divisi TI, posisi mahasiswa sebagai *developer*) · 2.4 Jadwal dan Uraian Kegiatan (**Tabel 2.1**, 8 minggu).
- **BAB III TINJAUAN PUSTAKA:** SDLC; SIT & UAT; QA & Keamanan Siber (pengujian penetrasi); Arsitektur Web Modern (SPA, REST, Laravel, React, Sanctum); RBAC & *state machine*.
- **BAB IV HASIL DAN PEMBAHASAN:**
  - 4.1 Hasil — Arsitektur Sistem (**Gambar 4.1**); Peran Pengguna (**Tabel 4.1** 12 peran; **Tabel 4.2** 5 grup); Mesin Status (**Gambar 4.2**; **Tabel 4.3** 27 status); Alur QA & Siber (**Gambar 4.3**); Alur SIT & UAT (**Gambar 4.4**); Matriks Persetujuan UAT (7 peran approver); Gerbang Rilis; Model Data/ERD (**Gambar 4.5**); Antarmuka Aplikasi (**Gambar 4.6–4.11**, tandai sebagai placeholder tangkapan layar).
  - 4.2 Pembahasan — Peran mahasiswa sebagai pengembang *fullstack*; Implementasi *back end*; Implementasi *front end*; Pengujian & verifikasi (**Tabel 4.4** ringkasan uji); Kendala dan solusi.
- **BAB V PENUTUP:** 5.1 Kesimpulan · 5.2 Saran.

### Bagian Akhir
- Daftar Pustaka (mis. Sommerville; Pressman & Maxim; Fielding (REST); dokumentasi Laravel; dokumentasi React; OWASP — tulis sebagai rujukan representatif).
- Lampiran (A: tangkapan layar aplikasi; B: ringkasan endpoint API; C: log kegiatan harian `[ lampirkan ]`; D: lembar penilaian pembimbing lapangan `[ lampirkan ]`).

**Isi Tabel 2.1 (Jadwal 8 minggu) — gunakan persis:**
1. Orientasi, pengenalan proses tata kelola SDLC bank, penyiapan lingkungan (PHP 8.3, Laravel 13, React 19, MySQL).
2. Analisis kebutuhan, penelusuran basis kode, pemahaman model data, peran, dan alur proses.
3. Backend: model, migrasi, RBAC, autentikasi Sanctum.
4. Backend: mesin status (`ProjectWorkflowService`), riwayat status, notifikasi.
5. Backend: modul SIT/UAT, jalur QA & keamanan siber, gerbang mutu rilis.
6. Frontend: dasbor, papan Kanban, modul registrasi & manajemen pengguna.
7. Frontend: wizard SIT/UAT, halaman tugas QA/Siber, matriks persetujuan UAT.
8. Pengujian menyeluruh (PHPUnit, ESLint, *build*), perbaikan akhir, dokumentasi, finalisasi.

---

## 5. DAFTAR PERNYATAAN YANG TIDAK BOLEH KELIRU (rawan salah)

1. Autentikasi = token **Sanctum** via **cookie `HttpOnly`** (jalur utama SPA) + header **Bearer** (kompatibilitas). SPA **tidak** menyimpan token di `localStorage`; proteksi CSRF lewat header `X-Requested-With`. JANGAN tulis JWT, dan JANGAN tulis "token disimpan di localStorage".
2. **Tidak ada UAT final** setelah QA/Siber. UAT ada di Fase 2 (sebelum QA/Siber).
3. `READY_FOR_UAT` dan `UAT_PASSED` = status **legacy** (tanpa transisi aktif). Jangan gambarkan sebagai alur utama.
4. 5 grup kerja = **tampilan saja**, BUKAN dasar otorisasi. Otorisasi dari peran.
5. Persetujuan pemohon **ADA** — di dalam **matriks approver UAT** (peran `requester`), bukan langkah terpisah.
6. Gerbang rilis butuh **KEDUA** jalur (QA + Siber) `PASSED`, lalu **Head of IT** menyetujui *go-live*.
7. 12 peran = daftar tetap. Jangan menambah/mengurangi peran.
8. Jumlah tepat: **12 peran**, **5 grup**, **27 status**, **2 jalur uji × 4 langkah**, **236 tes / 1.467 asersi**, **25 tabel (17 domain + 8 bawaan)**, **7 peran approver UAT**.
9. Reverb: pada environment saat ini `BROADCAST_CONNECTION=log` (belum aktif); realtime lewat Reverb adalah rancangan produksi.
10. Semua data pribadi/administratif ⇒ **isian kurung siku**, jangan ditebak.

---

## 6. CARA MEMAKAI (untuk kamu, mahasiswa)

- Tempel berkas ini ke AI, lalu perintahkan: *"Susun laporan Kerja Praktek lengkap sesuai konteks dan aturan di atas, dalam Bahasa Indonesia, format .docx/Word, dengan seluruh bab dan tabel. Gunakan placeholder kurung siku untuk data pribadi."*
- Enam gambar diagram (struktur organisasi, arsitektur, mesin status, QA/Siber, SIT/UAT, ERD) sudah tersedia sebagai berkas PNG di proyek — sisipkan sendiri pada posisi Gambar 2.1 dan Gambar 4.1–4.5. Untuk Gambar 4.6–4.11, sisipkan tangkapan layar aplikasi.
- Setelah AI menghasilkan draf, isi seluruh `[ ... ]` dan perbarui daftar isi/nomor halaman di Word (Ctrl+A lalu F9).
