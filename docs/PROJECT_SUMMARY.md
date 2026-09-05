# NagariSDLC — Ringkasan Proyek (untuk AI)

> Bacaan cepat agar AI memahami proyek dalam 2 menit.

## Apa ini?
**NagariSDLC** = sistem **SDLC Governance** untuk Bank Nagari. Mengelola proyek IT
dari **pengajuan** sampai **live production**, dengan kontrol role, status
(state machine), dokumen, task, pengujian (SIT/UAT/QA/Cyber), dan approval
berjenjang.

## Stack
- **Backend**: Laravel 13 (PHP 8.3) + Sanctum + MySQL + Reverb.
- **Frontend**: React 19 + Vite + Tailwind 4, Bahasa Indonesia, brand `#00529C`.
- Komunikasi: REST JSON. SPA memakai cookie Sanctum `HttpOnly` + header penjaga
  `X-Requested-With`; Bearer token tetap didukung untuk klien kompatibilitas.

## Alur inti
```
Pengajuan → Review → Analisis → Development → SIT → UAT → QA/Cyber → Release → Live
```

## Role
- **Backend (enum): 12 role** — `super_admin, head_of_it, lead_group, analyst,
  development_lead, project_manager, developer, qa_lead, qa_tester, cyber_lead,
  pentester, business_user`.
- **Frontend tambahan (konseptual)**: `dev_analyst` (= PM modern / Analyst
  Pengembangan) & `cyber_team` (alias tim cyber) — dipakai router/menu, tidak ada
  di enum backend.
- **Grup kerja** (tabel `groups` + `roles.group_id`) mengelompokkan role dan dapat
  diatur Super Admin, tetapi **tidak memberi wewenang apa pun**. Hak transisi status,
  cakupan proyek, dan hak pelaksana uji tetap dicocokkan pada nama role di kode. Daftar
  dua belas role di atas adalah daftar tetap: role baru yang dibuat lewat Administrasi
  belum berfungsi.

## Fitur kunci
- **SIT**: gate (semua task done), tahap eksekusi dengan approval per task +
  bukti + revisi, persetujuan multi-role (Dev + PM + Dev Lead).
- **UAT**: skenario dari task, peserta sekaligus matrix approver, **undangan
  UAT**, link pribadi + pencocokan nomor HP untuk pihak peminta, approval akun
  untuk pihak IT, serta **change request** (minor tanpa rollback; mayor → dev → SIT ulang
  menyeluruh → UAT diulang dari Tahap 1).
- **QA & Siber**: empat langkah identik per jalur (ajukan, disposisi, laporan pelaksana,
  sign-off Lead). Cakupan pengujian ditulis bebas di `test_reports.tested_scenarios`,
  bukan dicentang dari daftar tetap.
- **Task**: 5 status; revisi mundur ke dev; progress mengabaikan TAKE DOWN.
- **Chat per proyek** (backend, polling).
- **Dokumen**: masking nama + tipe file + view/download/hapus.
- **Kontak**: `contact_phone` di proyek (untuk UAT).
- **Administrasi**: pengguna, divisi, **grup kerja**, role berikut pembatasan menunya
  (`roles.menu_access`, sifatnya mengurangi saja dan gagal-terbuka).

## Aturan kritis (jangan dilanggar)
1. Status proyek HANYA via `ProjectWorkflowService::transition()`.
2. Approval SIT/UAT multi-role wajib sebelum lulus.
3. Data SIT/UAT = JSON `projects.sit_uat_data` (prefix `task_` di approvals).
4. Input divalidasi; otorisasi dicek (dokumen/chat).
5. Test dan build dijalankan atas permintaan pengguna; perubahan tetap harus menjaga
   kontrak FE/BE dan dilaporkan bila belum diverifikasi runtime.

## File penting
- `backend/app/Services/ProjectWorkflowService.php` — state machine.
- `backend/app/Http/Controllers/Api/V1/ProjectController.php` — CRUD + approvals.
- `frontend/src/components/SITUATWizard.jsx` — wizard SIT/UAT.
- `frontend/src/services/api.js` — semua panggilan API.
- `frontend/src/router/index.jsx` — routing & role guard.

## Kondisi saat ini
- Snapshot pengujian terakhir yang tercatat (26 Agustus 2026): **236 test backend
  (1467 assertions) lulus**, `npx eslint src` bersih, dan `npx vite build` berhasil.
  Ini snapshot historis; perubahan setelah tanggal tersebut belum tentu sudah diuji.
- Ketiga migration `2026_08_25_*` tercatat sudah diterapkan pada database
  pengembangan per pemeriksaan 25 Agustus 2026. Test memakai SQLite in-memory yang
  selalu bermigrasi bersih, sehingga status database lingkungan aktif tetap harus
  diperiksa dengan `php artisan migrate:status` sebelum deployment.
- `UNLOCK_ALL_STAGES = false` — gate SIT/UAT mengikuti status proyek (mode produksi).
- CORS backend digerakkan environment (`CORS_ALLOWED_ORIGINS`), bukan `*`.
- Token SPA disimpan dalam cookie `HttpOnly`; `localStorage` tidak menyimpan token.
- Template environment produksi: `backend/.env.production.example` dan
  `frontend/.env.production.example`.

Lihat `PRD.md`, `WORKFLOW.md`, `DATA_MODEL.md`, `API_REFERENCE.md`,
`ARCHITECTURE.md` untuk detail.
