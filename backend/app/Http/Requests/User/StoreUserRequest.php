<?php

namespace App\Http\Requests\User;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pembuatan akun oleh Super Admin (`POST /users`).
 *
 * Route-nya sudah dijaga middleware `role:super_admin`, jadi bagian ini murni soal
 * bentuk masukan. Dua hal yang diperketat dibanding versi sebelumnya:
 *
 *   1. Password mengikuti kebijakan bersama `App\Support\PasswordPolicy`.
 *      Sebelumnya jalur admin hanya mewajibkan `min:8`, sehingga akun buatan
 *      administrator boleh memakai password yang lebih lemah daripada akun hasil
 *      pendaftaran mandiri maupun hasil penggantian password.
 *   2. `is_active` ditolak. Controller selalu membuat akun dalam keadaan aktif;
 *      menerima field yang lalu diabaikan hanya menyesatkan pemanggilnya.
 */
class StoreUserRequest extends FormRequest
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
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => PasswordPolicy::rules(),
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')],
            'division_id' => ['nullable', 'integer', Rule::exists('divisions', 'id')],
            'phone_number' => ['nullable', 'string', 'max:20'],

            'is_active' => ['prohibited'],
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
            'is_active.prohibited' => 'Akun baru selalu dibuat dalam keadaan aktif. Gunakan PATCH /users/{id} untuk menonaktifkannya.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'name' => is_string($this->input('name')) ? trim($this->input('name')) : null,
            'email' => is_string($this->input('email')) ? mb_strtolower(trim($this->input('email'))) : null,
        ], static fn ($value): bool => $value !== null));
    }
}
