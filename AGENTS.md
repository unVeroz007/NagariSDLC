# NagariSDLC — Instruksi Utama untuk AI

File ini berlaku untuk seluruh repository. AI baru wajib membaca file ini sebelum
memberi saran atau mengubah kode.

## Urutan sumber kebenaran

Jika ada perbedaan informasi, gunakan urutan berikut:

1. Permintaan dan keputusan terbaru pengguna.
2. File ini dan `docs/AI_HANDOFF.md`.
3. Source code, migration/schema, route, config, dan dependency yang sedang aktif.
4. Dokumen resmi di `docs/`.
5. README lama atau dokumen historis lain.

`docs/` adalah dokumentasi resmi proyek. Blueprint backend lama bukan lagi sumber
kebenaran apabila bertentangan dengan `docs/` atau implementasi aktual.

## Bacaan awal wajib

1. `docs/AI_HANDOFF.md` — keadaan dan keputusan proyek terkini.
2. `docs/PROJECT_SUMMARY.md` — ringkasan produk.
3. Hanya dokumen yang relevan dengan tugas:
   - alur/status: `docs/WORKFLOW.md`
   - arsitektur: `docs/ARCHITECTURE.md`
   - database: `docs/DATA_MODEL.md`
   - endpoint: `docs/API_REFERENCE.md`
   - kebutuhan produk: `docs/PRD.md`

Jangan membaca ulang seluruh repository pada setiap permintaan kecil. Mulai dari
handoff, lalu inspeksi hanya file, dependensi, dan alur yang terkait dengan tugas.

## Cara bekerja

- Jangan mengarang requirement. Tandai informasi yang belum diputuskan dan minta
  konfirmasi hanya jika keputusan itu benar-benar memengaruhi implementasi.
- Jaga scope: perubahan kecil harus menghasilkan diff kecil dan terarah.
- Jangan melakukan refactor luas, menambah dependency, mengubah skema, menjalankan
  migration/seeder, atau menyentuh fase lain tanpa kebutuhan eksplisit.
- Worktree dapat berisi perubahan pengguna. Jangan menghapus, me-reset, atau
  menimpa perubahan yang tidak terkait.
- Pengguna memilih menjalankan pengujian sendiri. Jangan menjalankan test suite,
  build, atau browser/E2E kecuali diminta. Pemeriksaan read-only dan syntax check
  terarah boleh dilakukan, lalu laporkan batas verifikasinya.
- Gunakan Bahasa Indonesia untuk UI dan komunikasi proyek.

## Aturan teknis kritis

- Semua transisi status proyek harus melalui
  `backend/app/Services/ProjectWorkflowService.php`.
- Validasi write backend menggunakan Form Request; logic bisnis lintas endpoint
  ditempatkan di service.
- Pertahankan format respons API `{ status, message, data, meta? }`.
- Panggilan API frontend dipusatkan di `frontend/src/services/api.js`.
- Data wizard SIT/UAT berada di `projects.sit_uat_data`; pahami kompatibilitas
  key `task_` sebelum mengubah serialisasinya.
- Approval UAT aktif berada pada `uat_approval_rounds` dan `uat_approvers`, bukan
  hanya pada JSON legacy `uat3_approvals`.
- Jangan hard-delete data approval atau histori tanpa keputusan eksplisit karena
  audit trail merupakan kebutuhan penting.
- Jangan commit secret atau menampilkan isi `.env`.

## Sebelum menyerahkan perubahan

- Pastikan FE dan BE menggunakan kontrak field/endpoint yang sama.
- Periksa diff hanya pada scope pekerjaan dan jalankan syntax/static check yang
  proporsional bila diizinkan.
- Jelaskan file yang berubah, perilaku akhirnya, hal yang belum diverifikasi, dan
  migration atau langkah manual yang benar-benar diperlukan.

