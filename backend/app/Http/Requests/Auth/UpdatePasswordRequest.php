<?php

namespace App\Http\Requests\Auth;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi penggantian password oleh pemilik akun (`PATCH /auth/password`).
 *
 * Kecocokan `current_password` dengan hash tersimpan tetap diperiksa di
 * controller, karena di sana pengguna yang sedang masuk sudah tersedia beserta
 * hash-nya dan kegagalannya perlu dibalas pesan khusus. Yang ditangani di sini
 * adalah bentuk masukan: password baru wajib memenuhi kebijakan bersama
 * (`App\Support\PasswordPolicy`) dan tidak boleh sama dengan password lama.
 */
class UpdatePasswordRequest extends FormRequest
{
    /** Route sudah berada di dalam `auth:sanctum`; sasarannya selalu diri sendiri. */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string'],

            // `different` mencegah "penggantian" yang sebenarnya tidak mengubah
            // apa pun namun tercatat di jejak audit sebagai perubahan password.
            'new_password' => array_merge(
                PasswordPolicy::rules(),
                ['different:current_password'],
            ),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'new_password.regex' => PasswordPolicy::regexMessage(),
            'new_password.different' => 'Password baru harus berbeda dari password saat ini.',
        ];
    }
}
