<?php

// Cookie Sesi API

return [

    /*
    | Nama cookie. Diberi awalan `__Host-` secara otomatis? Tidak — awalan itu
    | melarang atribut `Domain`, sedangkan deployment bank ini menempatkan API
    | dan SPA pada subdomain berbeda dan membutuhkannya. Namanya dibiarkan polos
    | dan keamanannya ditegakkan lewat atribut `secure`/`same_site` di bawah.
    */
    'name' => env('AUTH_COOKIE_NAME', 'nagari_sdlc_token'),

    /*
    | Masa berlaku cookie dalam menit.
    |
    | Diikatkan pada `SANCTUM_TOKEN_EXPIRATION` supaya cookie tidak hidup lebih
    | lama daripada tokennya sendiri. Cookie yang tersisa setelah tokennya mati
    | hanya menghasilkan 401 yang membingungkan: peramban tetap mengirimkannya,
    | server menolaknya, dan pengguna melihat "sesi berakhir" berulang tanpa
    | sebab yang terlihat.
    */
    'lifetime' => (int) env('AUTH_COOKIE_LIFETIME', (int) env('SANCTUM_TOKEN_EXPIRATION', 480)),

    'path' => env('AUTH_COOKIE_PATH', '/'),

    /*
    | Domain cookie. Kosongkan untuk mengunci cookie pada host yang menerbitkannya.
    |
    | Isi dengan domain induk (mis. `.banknagari.co.id`) hanya bila SPA dan API
    | benar-benar berada di subdomain berbeda. Setiap huruf yang ditambahkan di
    | sini memperluas daftar host yang menerima token — jadi jangan diisi
    | "untuk berjaga-jaga".
    */
    'domain' => env('AUTH_COOKIE_DOMAIN'),

    /*
    | Kirim cookie hanya lewat HTTPS.
    |
    | Default `true` dan hanya dimatikan otomatis saat `APP_ENV=local`, karena
    | dev server berjalan di `http://localhost`. Kesalahan yang ingin dicegah di
    | sini adalah kebalikannya: default `false` yang terbawa ke produksi membuat
    | token melintas sebagai teks polos tanpa satu pun pesan error.
    */
    'secure' => (bool) env('AUTH_COOKIE_SECURE', env('APP_ENV', 'production') !== 'local'),

    /*
    | Kebijakan SameSite.
    |
    | `lax` cukup ketika SPA dan API berbagi domain induk. Bila keduanya berada
    | di domain yang benar-benar berbeda, peramban hanya mengirim cookie bila
    | nilainya `none` — dan `none` mewajibkan `secure = true`. Kombinasi
    | `none` + `secure=false` ditolak peramban modern, jadi keduanya diperiksa
    | bersamaan oleh `SessionTokenCookie::assertUsableConfiguration()`.
    */
    'same_site' => env('AUTH_COOKIE_SAME_SITE', 'lax'),

    /*
    | Header wajib untuk permintaan yang mengandalkan cookie.
    |
    | Cookie dikirim peramban secara otomatis, termasuk pada permintaan yang
    | dipicu situs lain — itulah bentuk dasar CSRF. Formulir HTML lintas situs
    | tidak dapat menyetel header khusus tanpa memicu preflight CORS, sehingga
    | mensyaratkan satu header khusus menutup jalur itu tanpa perlu token CSRF
    | terpisah. Permintaan yang membawa `Authorization` sendiri tidak terkena
    | syarat ini: header itu memang tidak pernah ikut terkirim otomatis.
    */
    'required_header' => env('AUTH_COOKIE_REQUIRED_HEADER', 'X-Requested-With'),

    /*
    | Sertakan token pada body respons login/refresh.
    |
    | Default `true` demi kompatibilitas: klien non-peramban (Postman, alat
    | internal) dan pengujian otomatis masih membaca `data.token`.
    |
    | Setel `false` di produksi. Selama nilainya `true`, manfaat cookie `HttpOnly`
    | belum utuh: skrip yang berhasil disuntikkan ke SPA dapat memanggil
    | `POST /auth/refresh` — cookienya ikut terkirim otomatis — lalu membaca token
    | baru dari body respons. Dengan `false`, token tidak pernah melewati
    | JavaScript sama sekali dan celah itu tertutup.
    |
    | SPA tidak lagi membutuhkan nilai ini: `frontend/src/services/api.js`
    | mengandalkan cookie dan hanya menyimpan `user` beserta `issuedAt`.
    */
    'expose_token_in_body' => (bool) env('AUTH_COOKIE_EXPOSE_TOKEN', true),

];
