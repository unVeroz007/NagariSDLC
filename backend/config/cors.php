<?php

/*
| Origin: CORS_ALLOWED_ORIGINS → FRONTEND_URL → APP_URL.
| Origin Vite dan wildcard hanya diizinkan pada lingkungan local.
| Jalankan ulang `config:cache` setelah mengubah environment.
*/

$localDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
];

$isLocal = env('APP_ENV', 'production') === 'local';

$allowedOrigins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))
), static fn ($origin) => $origin !== ''));

if ($allowedOrigins === []) {
    $allowedOrigins = array_values(array_filter([
        env('FRONTEND_URL'),
        env('APP_URL'),
    ]));
}

if ($isLocal) {
    // Dev server Vite selalu diizinkan saat lokal supaya pengembangan tidak
    // bergantung pada isi `.env`.
    $allowedOrigins = array_merge($allowedOrigins, $localDevOrigins);
}

/*
 * Wildcard dibuang di semua lingkungan.
 *
 * Sejak token sesi dibawa cookie `HttpOnly`, permintaan SPA menjadi credentialed
 * (`credentials: 'include'`). Spesifikasi CORS melarang `Access-Control-Allow-Origin: *`
 * pada permintaan credentialed — peramban menolak responsnya, bukan sekadar
 * mengabaikan cookienya — jadi `*` yang dahulu masih ditoleransi saat
 * `APP_ENV=local` kini justru mematikan seluruh pemanggilan API di lokal.
 * Origin dev server sudah ditambahkan secara eksplisit di atas, sehingga
 * tidak ada alasan tersisa untuk mempertahankan `*`.
 */
$allowedOrigins = array_values(array_filter(
    $allowedOrigins,
    static fn ($origin) => $origin !== '*'
));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_values(array_unique($allowedOrigins)),

    'allowed_origins_patterns' => [],

    // Header yang dipakai frontend: Authorization (Bearer token Sanctum),
    // Content-Type/Accept (JSON), dan X-UAT-Approval-Access (sesi approver
    // eksternal UAT). Upload dokumen memakai multipart tanpa header tambahan.
    'allowed_headers' => [
        'Accept',
        'Authorization',
        'Content-Type',
        'X-Requested-With',
        'X-UAT-Approval-Access',
    ],

    // Diperlukan agar browser dapat membaca nama berkas asli saat unduh dokumen.
    'exposed_headers' => ['Content-Disposition'],

    'max_age' => 600,

    /*
     * Wajib aktif: token sesi dibawa cookie `HttpOnly`, dan peramban hanya
     * menyertakan cookie pada permintaan lintas origin bila responsnya
     * mengembalikan `Access-Control-Allow-Credentials: true`.
     *
     * Konsekuensinya `allowed_origins` tidak boleh memuat `*` — lihat penyaring
     * di bagian atas berkas ini. Header Bearer tetap didukung, jadi klien yang
     * belum memakai cookie tidak terpengaruh.
     */
    'supports_credentials' => true,

];
