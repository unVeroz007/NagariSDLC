<?php

use App\Http\Middleware\AuthenticateFromSessionCookie;
use App\Http\Middleware\RoleMiddleware;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => RoleMiddleware::class,
        ]);

        /*
         * Token sesi dibaca dari cookie `HttpOnly` sebelum guard berjalan.
         *
         * Harus di-prepend: `auth:sanctum` mencari header `Authorization`, jadi
         * cookienya perlu sudah diterjemahkan sebelum guard mana pun sempat
         * menyimpulkan permintaannya tidak terautentikasi. Dipasang pada seluruh
         * grup `api` — bukan per-route — supaya tidak ada endpoint baru yang
         * diam-diam tertinggal dari jalur ini.
         */
        $middleware->api(prepend: [
            AuthenticateFromSessionCookie::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        /*
         * Bungkus error API dengan envelope `{ status, message, ... }`.
         *
         * Controller sudah mengembalikan envelope itu untuk kegagalan yang ditangkapnya
         * sendiri, tetapi error yang dilempar kerangka kerja (validasi gagal, token
         * kedaluwarsa, `findOrFail`, `abort(403)`, throttle) sebelumnya lolos dengan
         * bentuk bawaan Laravel yang hanya berisi `message`. Klien jadi menghadapi dua
         * bentuk respons error untuk satu API — `frontend/src/services/api.js` harus
         * menebak mana yang berlaku, dan `status` yang hilang membuat penanganan
         * seragam tidak mungkin.
         */
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            // Bentuk `{ status, message, errors }` — `errors` dipertahankan apa adanya
            // karena formulir frontend menyorot field dari kunci itu.
            if ($e instanceof ValidationException) {
                return response()->json([
                    'status' => 'error',
                    'message' => $e->getMessage(),
                    'errors' => $e->errors(),
                ], $e->status);
            }

            $isHttpException = $e instanceof HttpExceptionInterface;

            // Kegagalan tak terduga saat debug aktif tetap diserahkan ke penangan
            // bawaan, supaya jejak tumpukan lengkap masih terlihat saat pengembangan.
            $isKnownException = $isHttpException
                || $e instanceof AuthenticationException
                || $e instanceof AuthorizationException
                || $e instanceof ModelNotFoundException;

            if (! $isKnownException && config('app.debug')) {
                return null;
            }

            $statusCode = match (true) {
                $isHttpException => $e->getStatusCode(),
                $e instanceof AuthenticationException => 401,
                $e instanceof AuthorizationException => 403,
                $e instanceof ModelNotFoundException => 404,
                default => 500,
            };

            // Pesan bawaan per kode status, dipakai bila error tidak membawa
            // penjelasan yang memang ditulis untuk pengguna.
            $defaultMessages = [
                400 => 'Permintaan tidak dapat diproses.',
                401 => 'Sesi Anda sudah berakhir atau token tidak valid. Silakan masuk kembali.',
                403 => 'Anda tidak memiliki wewenang untuk tindakan ini.',
                404 => 'Data yang diminta tidak ditemukan.',
                405 => 'Metode HTTP ini tidak tersedia untuk endpoint tersebut.',
                413 => 'Berkas yang dikirim melebihi batas ukuran unggah.',
                429 => 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.',
                // Pesan asli kegagalan internal tidak dipaparkan: isinya dapat memuat
                // nama tabel, kueri, atau jalur berkas. Rinciannya tetap tercatat di
                // `storage/logs` lewat penangan bawaan.
                500 => 'Terjadi kesalahan pada server. Silakan hubungi administrator.',
                503 => 'Layanan sedang dalam pemeliharaan. Silakan coba lagi beberapa saat.',
            ];

            /*
             * Hanya `abort(...)` dari controller yang pesannya dipertahankan.
             *
             * Penjelasan seperti "Anda tidak memiliki akses ke proyek ini." memang
             * ditulis untuk pengguna, dan hanya jalur itu yang menghasilkan
             * HttpException. Sebaliknya pesan exception kerangka kerja berbahasa
             * Inggris dan dapat memuat rincian internal — 404 dari `findOrFail`
             * menyebut nama kelas model, 405 menyebut pola route-nya — jadi kode
             * status yang pesannya selalu dibuat kerangka kerja ikut dikecualikan.
             */
            $frameworkOwnedStatuses = [404, 405, 429, 500, 503];
            $carriesUserFacingMessage = $isHttpException
                && $e->getMessage() !== ''
                && ! in_array($statusCode, $frameworkOwnedStatuses, true);

            return response()->json([
                'status' => 'error',
                'message' => $carriesUserFacingMessage
                    ? $e->getMessage()
                    : ($defaultMessages[$statusCode] ?? $defaultMessages[500]),
            ], $statusCode, $isHttpException ? $e->getHeaders() : []);
            // Header respons asli dipertahankan — `Retry-After` pada 429 dan `Allow`
            // pada 405 adalah bagian dari kontrak HTTP-nya.
        });
    })->create();
