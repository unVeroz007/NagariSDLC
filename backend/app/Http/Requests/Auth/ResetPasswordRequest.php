<?php

namespace App\Http\Requests\Auth;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi penyetelan password baru lewat tautan reset.
 *
 * `token` dan `email` berasal dari tautan yang dikirim ke email pengguna. Keduanya
 * hanya divalidasi bentuknya di sini — kecocokan, masa berlaku, dan pemakaian
 * ulangnya diperiksa broker password Laravel di controller, karena hanya di sana
 * perbandingan token dilakukan dengan `Hash::check` (bukan perbandingan string
 * biasa) dan barisnya langsung dihapus setelah dipakai.
 *
 * Aturan kekuatan password sama dengan `AuthController@updatePassword` dan
 * `RegisterRequest`. Tiga tempat itu harus tetap seragam: password yang lahir dari
 * reset tidak boleh lebih lemah daripada password yang lahir dari penggantian
 * biasa.
 */
class ResetPasswordRequest extends FormRequest
{
    /**
     * Endpoint publik: pemegang token yang sah adalah satu-satunya otorisasi.
     * Pembatasan laju permintaan ditangani middleware `throttle` pada route.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string'],

            'email' => ['required', 'string', 'email', 'max:255'],

            'password' => PasswordPolicy::rules(confirmed: true),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'token.required' => 'Token reset tidak ditemukan. Buka kembali tautan dari email Anda.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.confirmed' => 'Konfirmasi password tidak sama dengan password baru.',
            'password.regex' => PasswordPolicy::regexMessage(),
        ];
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');

        $this->merge([
            'email' => is_string($email) ? mb_strtolower(trim($email)) : $email,
        ]);
    }
}
