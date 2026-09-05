# NagariSDLC Backend — Instruksi AI

Instruksi root `../AGENTS.md` tetap berlaku dan wajib dibaca lebih dahulu.

## Sumber kebenaran

- Dokumentasi resmi berada di `../docs/`.
- Konteks keputusan terbaru berada di `../docs/AI_HANDOFF.md`.
- Blueprint backend lama bukan lagi acuan resmi bila berbeda dengan dokumentasi
  tersebut atau kode aktual.
- Verifikasi keputusan backend terhadap migration, enum, model, route, Form Request,
  service, controller, dan consumer frontend yang terkait.

## Stack aktual

- PHP 8.3 dan Laravel 13.
- Laravel Sanctum; SPA memakai cookie token `HttpOnly`, sedangkan Bearer
  eksplisit tetap didukung untuk test dan klien non-browser.
- Laravel Reverb tersedia, tetapi rancangan infrastruktur produksi belum final.
- Database mengikuti konfigurasi environment; target produksi belum diputuskan.
- PHPUnit/Pest-compatible Laravel test runner tersedia, tetapi test dijalankan hanya
  jika pengguna memintanya.

## Aturan backend

- Semua perubahan status proyek melalui `app/Services/ProjectWorkflowService.php`.
- Gunakan Form Request untuk validasi write dan service untuk logic bisnis kompleks.
- Pertahankan format API `{ status, message, data, meta? }`.
- Endpoint dokumen wajib memeriksa akses proyek.
- Jangan mengedit migration yang sudah diterapkan untuk perubahan baru; buat migration
  lanjutan setelah mendapat scope/izin yang sesuai.
- Pertahankan audit trail. Jangan hard-delete approval, histori status, atau bukti
  tanpa keputusan eksplisit.
- Jangan membaca atau menampilkan secret `.env`.

## Scope pekerjaan

Frontend belum dianggap selesai dan kontrak FE/BE masih berkembang, terutama pada
SIT/UAT. Untuk setiap perubahan backend, periksa consumer di
`../frontend/src/services/api.js` dan komponen terkait agar field serta status tetap
sinkron.
