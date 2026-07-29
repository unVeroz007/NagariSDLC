# NagariSDLC Backend — Agent Instructions

## Konteks Proyek
Backend REST API untuk sistem SDLC internal Bank Nagari (alur pengajuan proyek IT →
review → development → QA → cyber security test → UAT → release → production).
Frontend (React) sudah selesai, ini adalah pembangunan backend-nya.

## Stack
- Laravel 11 (REST API + WebSocket)
- MySQL 8.0+
- Laravel Sanctum (auth token)
- Laravel Reverb (WebSocket realtime)
- Queue: database driver (dev) → redis (prod)
- Testing: Pest

## Perintah
- dev server: `php artisan serve`
- migrate: `php artisan migrate`
- seed: `php artisan db:seed`
- test: `php artisan test` atau `./vendor/bin/pest`
- realtime: `php artisan reverb:start`
- queue worker: `php artisan queue:work`

## Sumber Kebenaran Arsitektur
**Baca `docs/nagarisdlc_backend_blueprint_v2.md` secara penuh sebelum membuat
migration, model, controller, route, atau service apapun.** Dokumen itu adalah
satu-satunya acuan desain — jangan menebak struktur database, endpoint, atau alur
approval dari luar dokumen tersebut.

Bagian penting yang wajib dirujuk per jenis tugas:
- Membuat/mengubah tabel → Bagian 3 (Database Schema)
- Membuat/mengubah logic status proyek atau approval → Bagian 4 (State Machine) —
  ini bagian paling kritis, semua alur persetujuan berjenjang ada di sini
- Membuat endpoint baru → Bagian 5 (API Endpoints) — cek dulu apakah endpoint
  serupa sudah didefinisikan di sana sebelum menambah endpoint baru
- Auth/RBAC → Bagian 6
- WebSocket/broadcasting → Bagian 7
- Upload/download file → Bagian 8
- Sedang mengerjakan fitur apa sekarang → Bagian 10 (Roadmap Bertahap), ikuti
  urutan fase, jangan loncat fase

Kalau instruksi user bertentangan dengan blueprint, tanyakan dulu apakah blueprint
perlu diupdate — jangan diam-diam menyimpang darinya.

## Aturan Wajib (Critical Safety Rules)
- Semua perubahan kolom `status` pada tabel `projects` WAJIB lewat
  `app/Services/ProjectWorkflowService.php`. Jangan pernah update kolom `status`
  langsung dari controller manapun.
- Transisi status yang tidak terdaftar di tabel transisi (Blueprint Bagian 4.2)
  harus ditolak dengan response 422/403, bukan diloloskan.
- Setiap transisi status otomatis: insert ke `project_status_histories`,
  broadcast event `ProjectUpdated`, buat `Notification` untuk role terkait
  berikutnya. Jangan implementasikan salah satu tanpa yang lain.
- Semua input wajib divalidasi lewat Form Request class, bukan validasi inline
  di controller.
- Response API selalu ikuti format standar di Blueprint Bagian 5
  (`status`, `message`, `data`, `meta`/`errors`).
- Endpoint download dokumen wajib cek otorisasi akses proyek dulu sebelum
  stream file — jangan andalkan URL storage yang bisa ditebak.
- Jangan taruh secret (password DB, app key, kredensial email) di kode; semua
  lewat `.env` dan jangan pernah commit `.env`.
- Sebelum mengubah struktur migration yang sudah pernah dijalankan, buat
  migration baru — jangan edit migration lama.

## Konvensi Kode
- Gunakan native PHP Enum untuk status/role (`app/Enums/`), jangan string mentah
  tersebar di banyak file.
- Gunakan API Resource class (`app/Http/Resources/`) untuk transformasi response,
  jangan return Model langsung dari controller.
- Satu Form Request per aksi write (`StoreXRequest`, `UpdateXRequest`).
- Service class untuk logic bisnis yang dipakai lebih dari satu controller.

## Testing
- Setiap endpoint baru butuh minimal 1 Feature test (skenario sukses) + 1 test
  skenario gagal/unauthorized.
- Setiap baris di tabel transisi status (Blueprint Bagian 4.2) butuh test
  transisi valid dan test transisi invalid yang harus ditolak.
- Jalankan `./vendor/bin/pest` sebelum menganggap sebuah task selesai.

## Yang Harus Dikonfirmasi ke User Dulu
- Sebelum menjalankan migration yang menghapus/mengubah kolom pada data yang
  sudah ada isinya.
- Sebelum deploy atau menjalankan seeder di environment selain lokal.
- Sebelum menambah dependency/package baru yang tidak disebut di blueprint.
