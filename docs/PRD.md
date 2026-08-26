# PRD — NagariSDLC (SDLC Governance Bank Nagari)

## 1. Latar Belakang

Bank Nagari membutuhkan sistem terpusat untuk mengelola siklus hidup proyek IT
dari pengajuan hingga produksi, memastikan setiap tahapan terdokumentasi,
terotorisasi, dan sesuai standar (SDLC). Sistem ini menggantikan proses manual
yang tidak transparan & sulit dilacak.

## 2. Tujuan

1. Digitalisasi seluruh alur SDLC (pengajuan → review → development → testing → rilis).
2. Transparansi status proyek kepada semua pemangku kepentingan.
3. Kontrol otorisasi berbasis role (RBAC) di setiap tahapan.
4. Dokumentasi lengkap: dokumen, task, bukti pengujian, approval, change request.
5. Notifikasi & real-time tracking.

## 3. Persona & Kebutuhan

| Persona | Kebutuhan Utama |
|---|---|
| Business User / pihak peminta | Mengajukan proyek, melacak status, serta menyetujui UAT sebagai pemohon/pimpinan melalui link pribadi. |
| Lead Group / Kadiv | Review pengajuan, menyetujui/reject. |
| System Analyst (plan) | Kajian kelayakan dokumen (BRD/FSD). |
| Development Lead | Mengelola alokasi, menyetujui SIT & UAT. |
| PM (dev_analyst) | Mengelola proyek, alokasi tim, task, SIT/UAT. |
| Developer | Mengerjakan task, update status, menyetujui SIT, chat proyek. |
| QA Lead/Tester | Pengujian QA independen. |
| Cyber Lead/Pentester | Pentest keamanan. |
| Head of IT | Quality gate, dashboard, analitik. |
| Super Admin | Kelola user/role/divisi, audit log, semua akses. |

## 4. Fitur Utama (Feature List)

### Fase 1 — Inisiasi & Review
- [x] Business user mengajukan proyek (nama, deskripsi, **nomor telepon kontak**,
      divisi, tipe RBB/Non-RBB, prioritas, target selesai, dokumen awal).
- [x] Lead Group meninjau & menyetujui/menolak pengajuan.
- [x] System Analyst melakukan kajian BRD/FSD & rekomendasi.

### Fase 2 — Pengembangan
- [x] PM (dev_analyst) alokasi tim developer.
- [x] Manajemen task (CRUD, status: Belum Mulai / Sedang Dikerjakan / Hold /
      Selesai / Take Down).
- [x] Kanban board, PM workspace.
- [x] Chat per proyek (real-time via backend).

### Fase SIT (System Integration Testing)
- [x] Gate: semua task Selesai (TAKE DOWN diabaikan) sebelum SIT dimulai.
- [x] Tahap 1: URL staging + jumlah skenario otomatis.
- [x] Tahap 2: tabel task dengan approval OK + komentar + **lampiran bukti per task** + revisi.
- [x] Tahap 3: ringkasan otomatis + persetujuan Developer + PM + Dev Lead →
      "SIT Lulus".

### Fase UAT (User Acceptance Testing)
- [x] Tahap 1: skenario otomatis dari task, unit peminta, tanggal, peserta
      (pemohon/PM/analyst/developer + **nomor kontak**), **dokumen undangan UAT**.
- [x] Tahap 2: eksekusi (skenario dieksekusi/diterima/temuan).
- [x] Tahap 3: matrix persetujuan individual pihak peminta dan pihak IT; pihak
      peminta memakai link pribadi + pencocokan nomor HP, pihak IT memakai akun.
- [x] **Change Request UAT** (minor diperbaiki tanpa rollback; mayor → kembali dev → SIT ulang → langsung approval final UAT).

### Fase QA & Cyber
- [x] Pengajuan QA & Cyber, pelaksanaan, sign-off.
- [x] Dua jalur berjalan paralel dan independen; masing-masing dapat mengembalikan
      proyek ke development (`RETURN_TO_DEV`) bila ada temuan kode atau keamanan.

### Fase Rilis
- [x] Setelah **kedua** jalur pengujian lulus, PM mengajukan migrasi & rilis ke Grup
      Infrastruktur (`PENDING_GOLIVE`). Tidak ada UAT final setelah QA & Siber.
- [x] Quality gate oleh Head of IT, lalu live production.

### Cross-cutting
- [x] Dokumen vault (upload/download/view, masking nama, tipe file).
- [x] Activity log & audit trail.
- [x] Notifikasi.
- [x] Chat proyek.

## 5. Non-Functional Requirements

- **Keamanan**: RBAC, Sanctum token, validasi input, otorisasi download dokumen.
- **Kinerja**: polling/refresh otomatis; OPCache aktif di server.
- **Usability**: UI Bahasa Indonesia, brand `#00529C`, responsive.
- **Reliabilitas**: state machine mencegah transisi ilegal.

## 6. Metrik Keberhasilan

- 100% proyek IT melalui alur SDLC terstandarisasi.
- Waktu tracking status real-time.
- Dokumentasi lengkap per proyek.

## 7. Out of Scope (saat ini)

- Penggantian UI/UX framework.
- Integrasi dengan sistem HRIS/core banking.
- Realtime chat via WebSocket (saat ini polling 10 detik).

## 8. Risiko & Catatan

- `UNLOCK_ALL_STAGES = false` di `SITUATWizard.jsx` (mode produksi). Nilai `true`
  hanya escape hatch debug lokal dan tidak boleh di-commit.
- Role `dev_analyst` belum ada di enum backend (masih `project_manager`).
