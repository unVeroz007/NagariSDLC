<?php

namespace App\Http\Middleware;

use App\Support\SessionTokenCookie;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Terjemahkan cookie sesi `HttpOnly` menjadi header `Authorization`.
 *
 * Guard `auth:sanctum` hanya membaca token dari header `Authorization: Bearer`.
 * Middleware ini mengisi header itu dari cookie ketika permintaannya tidak
 * membawa header sendiri, sehingga seluruh route, kebijakan, dan pengujian yang
 * sudah ada tetap berjalan tanpa perubahan — yang berpindah hanyalah tempat
 * token disimpan di sisi peramban, dari `localStorage` ke cookie `HttpOnly`.
 *
 * Header yang dikirim klien selalu menang. Itu yang membuat jalur lama tetap
 * hidup: klien yang masih memegang tokennya sendiri, pengujian otomatis, dan
 * tautan persetujuan approver eksternal tidak terpengaruh perubahan ini.
 *
 * Catatan pemeliharaan: cookie ini ditulis dan dibaca dalam bentuk mentah karena
 * grup middleware `api` tidak menyertakan `EncryptCookies`. Bila suatu saat
 * `statefulApi()` atau enkripsi cookie diaktifkan pada grup ini, nama cookie
 * `SessionTokenCookie::name()` wajib dimasukkan ke daftar pengecualian enkripsi —
 * kalau tidak, nilainya gagal didekripsi dan dibaca sebagai null, dan setiap
 * pengguna terlempar ke halaman masuk tanpa pesan yang menjelaskan sebabnya.
 */
class AuthenticateFromSessionCookie
{
    public function handle(Request $request, Closure $next): Response
    {
        // Header eksplisit tidak pernah ditimpa.
        if ($request->hasHeader('Authorization')) {
            return $next($request);
        }

        $token = $request->cookie(SessionTokenCookie::name());

        if (! is_string($token) || trim($token) === '') {
            return $next($request);
        }

        /*
         * Syarat header khusus untuk permintaan berbasis cookie.
         *
         * Peramban mengirim cookie secara otomatis, termasuk pada permintaan yang
         * dipicu halaman lain — dasar dari CSRF. `SameSite` sudah menahan sebagian
         * besar bentuknya, tetapi formulir HTML lintas situs juga tidak dapat
         * menyetel header khusus tanpa memicu preflight CORS yang akan ditolak
         * daftar origin. Mensyaratkan satu header menutup sisanya tanpa
         * memperkenalkan token CSRF terpisah yang harus ikut dikelola SPA.
         *
         * Dijawab 400, bukan 401: 401 memicu logout otomatis di frontend, sehingga
         * satu pemanggilan yang lupa menyertakan header akan mengeluarkan pengguna
         * dari aplikasi. Ini kesalahan bentuk permintaan, bukan sesi yang berakhir.
         */
        if (! $request->hasHeader(SessionTokenCookie::requiredHeader())) {
            return response()->json([
                'status' => 'error',
                'message' => 'Permintaan berbasis cookie sesi wajib menyertakan header '
                    . SessionTokenCookie::requiredHeader() . '.',
            ], 400);
        }

        $request->headers->set('Authorization', 'Bearer ' . trim($token));

        return $next($request);
    }
}
