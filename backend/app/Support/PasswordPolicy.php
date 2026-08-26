<?php

namespace App\Support;

/**
 * Kebijakan kekuatan password aplikasi, di satu tempat.
 *
 * Password lahir di empat jalur: pendaftaran mandiri (`RegisterRequest`),
 * penyetelan lewat tautan reset (`ResetPasswordRequest`), penggantian oleh
 * pemiliknya (`UpdatePasswordRequest`), dan pembuatan akun oleh Super Admin
 * (`StoreUserRequest` / `UpdateUserRequest`). Sebelumnya aturannya ditulis ulang
 * di tiap tempat, dan jalur admin bahkan hanya mewajibkan `min:8` — akun yang
 * dibuat administrator boleh memakai password yang lebih lemah daripada yang
 * dibuat penggunanya sendiri. Satu sumber aturan menutup celah itu sekaligus
 * memastikan perubahan kebijakan berlaku serentak.
 */
final class PasswordPolicy
{
    /** Karakter spesial yang diterima; dipakai juga di pesan kesalahan. */
    public const SPECIAL_CHARACTERS = '@$!%*#?&._-';

    /**
     * Aturan validasi password.
     *
     * @param  bool  $confirmed  Wajibkan field `<nama>_confirmation` ikut dikirim.
     * @param  bool  $required   Wajib ada. Setel false untuk pembaruan opsional.
     * @return list<string>
     */
    public static function rules(bool $confirmed = false, bool $required = true): array
    {
        $rules = [
            $required ? 'required' : 'nullable',
            'string',
            'min:8',
            'regex:/[a-z]/',
            'regex:/[A-Z]/',
            'regex:/[0-9]/',
            'regex:/['.preg_quote(self::SPECIAL_CHARACTERS, '/').']/',
        ];

        if ($confirmed) {
            array_splice($rules, 3, 0, ['confirmed']);
        }

        return $rules;
    }

    /** Pesan tunggal untuk seluruh aturan `regex` di atas. */
    public static function regexMessage(): string
    {
        return 'Password harus mengandung huruf kecil, huruf besar, angka, dan karakter spesial ('
            .self::SPECIAL_CHARACTERS.').';
    }
}
