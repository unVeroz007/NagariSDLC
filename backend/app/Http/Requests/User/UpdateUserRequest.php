<?php

namespace App\Http\Requests\User;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pembaruan akun oleh Super Admin (`PATCH /users/{id}`).
 *
 * Route-nya dijaga middleware `role:super_admin`. Dua perbaikan dibanding versi
 * sebelumnya:
 *
 *   1. Controller kini memakai `validated()`, bukan `$request->except('password')`.
 *      Bentuk lama meneruskan seluruh isi request ke `User::update()` dan hanya
 *      mengandalkan `$fillable` model sebagai penyaring terakhir; field yang tidak
 *      pernah divalidasi bisa ikut tersimpan begitu daftar `$fillable` berubah.
 *   2. Password opsional tetap wajib memenuhi kebijakan bersama
 *      `App\Support\PasswordPolicy`, sama seperti jalur lain.
 */
class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        $userId = (int) $this->route('id');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],

            // Dikirim hanya bila administrator memang mengganti password. String
            // kosong diperlakukan sebagai "tidak diubah" (lihat prepareForValidation).
            'password' => PasswordPolicy::rules(confirmed: false, required: false),

            'role_id' => ['sometimes', 'integer', Rule::exists('roles', 'id')],
            'division_id' => ['sometimes', 'nullable', 'integer', Rule::exists('divisions', 'id')],
            'phone_number' => ['sometimes', 'nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'password.regex' => PasswordPolicy::regexMessage(),
            'role_id.exists' => 'Peran yang dipilih tidak terdaftar.',
            'division_id.exists' => 'Divisi yang dipilih tidak terdaftar.',
            'email.unique' => 'Alamat email sudah dipakai akun lain.',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Formulir mengirim password kosong saat administrator tidak berniat
        // mengubahnya. Dibuang di sini supaya tidak lolos sebagai password kosong.
        if ($this->has('password') && ! $this->filled('password')) {
            $this->request->remove('password');
        }

        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }

        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }
}
