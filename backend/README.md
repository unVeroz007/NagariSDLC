# Backend NagariSDLC

REST API Laravel 13 untuk tata kelola siklus proyek teknologi Bank Nagari.

## Stack

- PHP 8.3
- Laravel 13
- Laravel Sanctum
- Laravel Reverb
- MySQL untuk development/target operasional; PHPUnit memakai SQLite in-memory

## Menjalankan secara lokal

```bash
composer install
copy .env.example .env
php artisan key:generate
php artisan serve --port=8000
```

Migration dan seeder dapat mengubah database. Jalankan hanya setelah memeriksa
environment aktif dan status migration:

```bash
php artisan migrate:status
php artisan migrate
php artisan db:seed
```

## Arsitektur

- Route API: `routes/api.php`, prefix `/api/v1`.
- Controller: `app/Http/Controllers/Api/V1`.
- Validasi write: `app/Http/Requests`.
- Aturan bisnis lintas endpoint: `app/Services`.
- Transformasi respons: `app/Http/Resources`.
- Model dan relasi: `app/Models`.
- Skema: `database/migrations`.

Aturan penting:

1. Semua transisi status proyek melewati `ProjectWorkflowService`.
2. `ProjectAccessService` adalah sumber cakupan visibilitas proyek.
3. Jalur QA/Siber diorkestrasi `TestingTrackService`.
4. `project_return_rounds` hanya ditulis `ProjectReturnRoundService`.
5. Approval UAT aktif berada pada `uat_approval_rounds` dan `uat_approvers`.
6. Respons API mempertahankan envelope `{ status, message, data, meta? }`.

## Autentikasi

SPA menggunakan cookie token Sanctum `HttpOnly`. Middleware
`AuthenticateFromSessionCookie` menerjemahkan cookie menjadi Bearer sebelum
`auth:sanctum`. Request berbasis cookie wajib membawa
`X-Requested-With: XMLHttpRequest`. Bearer eksplisit tetap didukung untuk klien
non-browser dan test.

## Verifikasi

```bash
php artisan test
```

Snapshot historis 26 Agustus 2026: 236 test / 1.467 assertion lulus. Snapshot
tersebut bukan jaminan perubahan sesudah tanggal itu.

Dokumentasi lengkap tersedia di [`../docs`](../docs/README.md).
