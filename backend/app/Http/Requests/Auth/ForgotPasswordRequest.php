<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi permintaan tautan reset password.
 *
 * Hanya alamat email yang diterima. Endpoint ini sengaja TIDAK memakai aturan
 * `exists:users,email`: balasan yang berbeda antara email terdaftar dan tidak
 * terdaftar akan mengubah formulir "lupa password" menjadi alat pemeriksa daftar
 * pegawai. Keberadaan akun diperiksa di controller, dan hasilnya selalu dijawab
 * dengan pesan yang sama.
 */
class ForgotPasswordRequest extends FormRequest
{
    /**
     * Endpoint publik: tidak ada pengguna yang bisa diotorisasi di sini.
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
            'email' => ['required', 'string', 'email', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
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
