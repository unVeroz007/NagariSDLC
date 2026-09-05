<?php

return [

    /*
    | Kunci HMAC nomor HP harus stabil selama link approval berlaku.
    | Fallback APP_KEY menjaga hash lama; mengganti ke UAT_PHONE_HASH_KEY membuat
    | hash yang dibuat dengan kunci sebelumnya tidak lagi cocok.
    */

    'phone_hash_key' => env('UAT_PHONE_HASH_KEY'),

    // Rate limit verifikasi nomor HP approver eksternal

    'verification' => [
        'max_attempts' => (int) env('UAT_VERIFICATION_MAX_ATTEMPTS', 5),
        'lockout_minutes' => (int) env('UAT_VERIFICATION_LOCKOUT_MINUTES', 15),
    ],

];
