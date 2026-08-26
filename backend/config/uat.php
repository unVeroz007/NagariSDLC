<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Kunci hash nomor HP approver UAT eksternal
    |--------------------------------------------------------------------------
    |
    | `uat_approvers.phone_hash` adalah keyed hash (HMAC-SHA256) dari nomor HP
    | approver eksternal. Nilai ini satu-satunya pembanding pada verifikasi link
    | approval, jadi kuncinya harus stabil selama link masih berlaku.
    |
    | Sebelumnya kunci itu diambil dari `APP_KEY`. Rotasi `APP_KEY` adalah operasi
    | keamanan yang wajar dan disarankan, tetapi efek sampingnya di sini fatal:
    | seluruh `phone_hash` yang sudah tersimpan langsung tidak pernah cocok lagi
    | dan setiap approver eksternal terkunci dari link-nya tanpa pesan error yang
    | menunjuk ke penyebabnya. Karena itu kuncinya dipisah ke variabel sendiri.
    |
    | Fallback ke `APP_KEY` dipertahankan dengan sengaja: deployment yang belum
    | pernah menyetel `UAT_PHONE_HASH_KEY` tetap dapat memverifikasi hash lama
    | yang dulu dihitung dengan `APP_KEY`. Begitu variabel ini diisi, hash lama
    | tidak lagi cocok — lihat peringatannya di `.env.example`.
    |
    */

    'phone_hash_key' => env('UAT_PHONE_HASH_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Rate limit verifikasi nomor HP approver eksternal
    |--------------------------------------------------------------------------
    |
    | Link approval eksternal hanya dijaga oleh nomor HP, sehingga percobaan tebak
    | harus dibatasi. `max_attempts` percobaan gagal mengunci verifikasi selama
    | `lockout_minutes`. Penghitungnya tidak boleh direset oleh percobaan gagal
    | berikutnya — hanya verifikasi yang berhasil atau berakhirnya masa kunci yang
    | mengembalikan kuota.
    |
    */

    'verification' => [
        'max_attempts' => (int) env('UAT_VERIFICATION_MAX_ATTEMPTS', 5),
        'lockout_minutes' => (int) env('UAT_VERIFICATION_LOCKOUT_MINUTES', 15),
    ],

];
