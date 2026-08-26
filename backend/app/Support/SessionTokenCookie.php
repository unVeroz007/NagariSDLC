<?php

namespace App\Support;

use RuntimeException;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Pabrik cookie sesi API.
 *
 * Token akses Sanctum disimpan di cookie `HttpOnly`, bukan di `localStorage`.
 * Nilai di `localStorage` dapat dibaca oleh skrip apa pun yang berhasil
 * dieksekusi di halaman — satu celah XSS pada satu layar cukup untuk
 * mengeluarkan token dan memakainya dari mesin lain sampai masa berlakunya
 * habis. Cookie `HttpOnly` tidak dapat dibaca JavaScript, sehingga celah yang
 * sama hanya memungkinkan penyerang bertindak dari peramban korban.
 *
 * Kelas ini satu-satunya tempat atribut cookie dirakit. Login, refresh, dan
 * logout wajib melewatinya: cookie yang diterbitkan dengan `path` atau `domain`
 * berbeda dari yang dipakai saat menghapusnya tidak akan pernah terhapus, dan
 * sesi yang seharusnya berakhir tetap hidup di peramban.
 */
class SessionTokenCookie
{
    /**
     * Nama cookie sesi.
     */
    public static function name(): string
    {
        return (string) config('auth_cookie.name', 'nagari_sdlc_token');
    }

    /**
     * Header yang wajib menyertai permintaan berbasis cookie.
     */
    public static function requiredHeader(): string
    {
        return (string) config('auth_cookie.required_header', 'X-Requested-With');
    }

    /**
     * Apakah token masih ikut dikirim pada body respons login/refresh.
     *
     * Lihat `config/auth_cookie.php` untuk alasan mengapa nilainya sebaiknya
     * `false` di produksi.
     */
    public static function exposesTokenInBody(): bool
    {
        return (bool) config('auth_cookie.expose_token_in_body', true);
    }

    /**
     * Cookie berisi token akses, siap dilekatkan pada respons login/refresh.
     */
    public static function issue(string $token): Cookie
    {
        self::assertUsableConfiguration();

        return Cookie::create(
            name: self::name(),
            value: $token,
            expire: time() + (self::lifetimeMinutes() * 60),
            path: self::path(),
            domain: self::domain(),
            secure: self::isSecure(),
            httpOnly: true,
            // `raw: false` agar nilainya di-encode. Token Sanctum berbentuk
            // `<id>|<plain>`; karakter `|` sah di dalam cookie, tetapi meng-encode
            // nilai tetap lebih aman terhadap perubahan format token di kemudian hari.
            raw: false,
            sameSite: self::sameSite(),
        );
    }

    /**
     * Cookie kedaluwarsa untuk menghapus sesi di peramban.
     *
     * Atributnya harus identik dengan yang dipakai `issue()` kecuali nilai dan
     * masa berlakunya. Peramban mencocokkan cookie berdasarkan nama, domain, dan
     * path — bukan hanya nama — jadi menghapus dengan `path` berbeda akan
     * meninggalkan cookie aslinya tetap terpasang.
     */
    public static function forget(): Cookie
    {
        return Cookie::create(
            name: self::name(),
            value: '',
            // Waktu di masa lalu, bukan 0. Nilai 0 pada Symfony berarti "cookie
            // sesi" yang justru bertahan sampai peramban ditutup.
            expire: time() - 3600,
            path: self::path(),
            domain: self::domain(),
            secure: self::isSecure(),
            httpOnly: true,
            raw: false,
            sameSite: self::sameSite(),
        );
    }

    public static function lifetimeMinutes(): int
    {
        $minutes = (int) config('auth_cookie.lifetime', 480);

        return $minutes > 0 ? $minutes : 480;
    }

    public static function path(): string
    {
        $path = (string) config('auth_cookie.path', '/');

        return $path !== '' ? $path : '/';
    }

    public static function domain(): ?string
    {
        $domain = config('auth_cookie.domain');

        return is_string($domain) && $domain !== '' ? $domain : null;
    }

    public static function isSecure(): bool
    {
        return (bool) config('auth_cookie.secure', true);
    }

    public static function sameSite(): string
    {
        $sameSite = strtolower((string) config('auth_cookie.same_site', 'lax'));

        return in_array($sameSite, [Cookie::SAMESITE_LAX, Cookie::SAMESITE_STRICT, Cookie::SAMESITE_NONE], true)
            ? $sameSite
            : Cookie::SAMESITE_LAX;
    }

    /**
     * Tolak kombinasi atribut yang pasti ditolak peramban.
     *
     * `SameSite=None` mewajibkan `Secure`. Tanpa pemeriksaan ini cookienya
     * dibuang peramban tanpa pesan error, sementara respons login tetap
     * mengembalikan token pada body sehingga SPA seolah-olah berjalan normal —
     * kegagalan yang baru terlihat ketika seseorang mengandalkan cookienya.
     * Lebih baik login gagal terang-terangan di lingkungan yang salah konfigurasi.
     */
    protected static function assertUsableConfiguration(): void
    {
        if (self::sameSite() === Cookie::SAMESITE_NONE && ! self::isSecure()) {
            throw new RuntimeException(
                'Konfigurasi cookie sesi tidak dapat dipakai: AUTH_COOKIE_SAME_SITE=none '
                . 'mewajibkan AUTH_COOKIE_SECURE=true (peramban membuang cookie tersebut). '
                . 'Setel keduanya secara konsisten lalu jalankan ulang `php artisan config:cache`.'
            );
        }
    }
}
