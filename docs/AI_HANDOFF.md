# NagariSDLC — Handoff untuk AI Baru

**Terakhir diperbarui:** 20 Agustus 2026  
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
- Fokus aktif pengembangan adalah SIT dan UAT Internal.
- QA, Cyber Security, dan Release belum selesai seluruhnya.
- QA dan Cyber direncanakan dapat berjalan paralel. Status gabungan untuk kondisi
  paralel memang diperlukan, tetapi implementasi final fase ini harus diperiksa
  lagi ketika mulai dikerjakan.
- Status sesudah Cyber seperti `READY_FOR_UAT`/`UAT_PASSED` masih ada di state
  machine. Makna bisnis UAT final setelah Cyber dan perbedaannya dari UAT Internal
  yang sekarang dikerjakan belum dikunci sepenuhnya; jangan menyatukan atau
  menghapusnya tanpa konfirmasi pengguna.

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
   SIT ulang terarah hanya untuk task terdampak dan task tambahan mayor. Task yang
   tidak terdampak tidak boleh dipaksa diuji ulang.

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
- Minor dapat diperbaiki tanpa memundurkan alur.
- Mayor menjadi Change Request: UAT di-hold → developer memperbaiki → SIT ulang
  terarah → kembali ke UAT Tab 2 hanya untuk verifikasi item mayor.
- Setiap item verifikasi mayor memerlukan bukti/lampiran baru per task. Bukti siklus
  lama tetap menjadi histori.
- Jika verifikasi mayor masih ditolak, siklus developer → SIT terarah → verifikasi
  mayor diulang.

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
- `backend/app/Services/UatExecutionService.php` — draft/final/verifikasi UAT.
- `backend/app/Services/UatApprovalService.php` — putaran dan keputusan approval UAT.
- `backend/app/Http/Controllers/Api/V1/ProjectController.php` — endpoint workflow proyek.
- `backend/routes/api.php` — kontrak route aktual.
- `frontend/src/components/SITUATWizard.jsx` — UI/alur SIT dan UAT.
- `frontend/src/components/SITTaskExecution.jsx` — eksekusi SIT per task.
- `frontend/src/services/api.js` — satu pintu panggilan API frontend.
- `frontend/src/router/index.jsx` dan `frontend/src/data/menuConfig.js` — akses dan navigasi role.

## 7. Kondisi teknis dan risiko yang harus diketahui

- `frontend/src/components/SITUATWizard.jsx` masih memakai
  `UNLOCK_ALL_STAGES = true` untuk inspeksi development. Ini harus `false` sebelum
  produksi, tetapi jangan diubah tanpa permintaan pengguna.
- `SITUATWizard.jsx` besar dan memiliki beberapa temuan lint lama. Jangan memperluas
  refactor hanya untuk memperbaiki permintaan kecil.
- Repo dapat berada dalam kondisi dirty karena perubahan fitur pengguna yang belum
  di-commit. Selalu cek `git status` dan pertahankan perubahan yang tidak terkait.
- Test backend terakhir yang diketahui: 49 test, 179 assertions lulus. Ini hanya
  snapshot historis, bukan jaminan bahwa perubahan sesudahnya sudah diuji.
- `docs/` saat terakhir diperiksa masih untracked di Git. Pengguna telah menetapkan
  bahwa isi `docs/` adalah acuan resmi; pastikan folder ini ikut dipindahkan/di-commit.
- Dokumentasi bisa tertinggal dari kode. Bila bertentangan, verifikasi route,
  migration, enum, model cast, service, dan frontend consumer sebelum menyimpulkan.

## 8. Cara AI baru memulai setiap pekerjaan

1. Baca `AGENTS.md` root dan file ini.
2. Baca hanya dokumen domain yang relevan.
3. Periksa `git status` dan diff pada file target.
4. Telusuri alur FE → service API → route → request/controller/service → model/DB.
5. Jelaskan diagnosis singkat sebelum melakukan perubahan material.
6. Implementasikan hanya scope yang diminta dan pertahankan kompatibilitas data lama.
7. Jangan menjalankan test/build otomatis; pengguna akan menguji kecuali secara
   eksplisit meminta AI melakukannya.
8. Pada handoff, sebutkan perubahan, file terkait, langkah migration bila ada, serta
   hal yang belum terverifikasi.

## 9. Hal yang masih perlu dikonfirmasi

- Definisi dan peserta UAT final setelah Cyber dibanding UAT Internal setelah SIT.
- Bentuk final state/status gabungan QA dan Cyber paralel.
- Database, realtime transport, queue, dan storage produksi.
- Kebijakan retensi, cascade, soft delete, dan status terminal `CANCELLED`.
- Strategi deployment, CI/CD, environment staging/production, backup, monitoring,
  audit/security hardening, dan SLA.

