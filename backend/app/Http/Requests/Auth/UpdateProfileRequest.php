<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi pembaruan profil oleh pemilik akun (`PATCH /auth/profile`).
 *
 * Endpoint ini hanya menyentuh data milik pengguna yang sedang masuk, jadi tidak
 * ada field kepemilikan atau hak akses yang boleh ikut. Field seperti `email`,
 * `role_id`, `division_id`, dan `is_active` ditolak eksplisit: perubahannya adalah
 * wewenang Super Admin lewat `PATCH /users/{id}`, dan menolaknya dengan 422
 * membuat percobaan menaikkan hak akses terlihat sebagai kegagalan, bukan sebagai
 * keberhasilan yang diam-diam mengabaikan field.
 */
class UpdateProfileRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:20'],

            'email' => ['prohibited'],
            'role_id' => ['prohibited'],
            'division_id' => ['prohibited'],
            'is_active' => ['prohibited'],
            'password' => ['prohibited'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.prohibited' => 'Alamat email tidak dapat diubah dari halaman profil. Hubungi Super Admin.',
            'role_id.prohibited' => 'Peran akun tidak dapat diubah dari halaman profil.',
            'division_id.prohibited' => 'Divisi tidak dapat diubah dari halaman profil. Hubungi Super Admin.',
            'is_active.prohibited' => 'Status aktif akun tidak dapat diubah dari halaman profil.',
            'password.prohibited' => 'Gunakan menu Ubah Password (PATCH /auth/password) untuk mengganti password.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }
}
