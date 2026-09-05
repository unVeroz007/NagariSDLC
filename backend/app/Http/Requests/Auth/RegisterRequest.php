<?php

namespace App\Http\Requests\Auth;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pendaftaran akun mandiri.
 *
 * Karena endpoint bersifat publik, klien tidak boleh menentukan role, divisi harus
 * sudah terdaftar, dan password mengikuti kebijakan perubahan password.
 */
class RegisterRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],

            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],

            // Kebijakan kekuatan password dipegang satu tempat
            // (`App\Support\PasswordPolicy`) agar seluruh jalur pembuatan dan
            // penggantian password bergerak bersamaan. `confirmed` mewajibkan
            // field `password_confirmation` ikut dikirim.
            'password' => PasswordPolicy::rules(confirmed: true),

            // Dua bentuk masukan divisi yang diterima, tepat satu wajib ada.
            // `division_id` adalah bentuk yang dipakai formulir sekarang;
            // `department` (nama divisi) dipertahankan untuk klien lama dan
            // tetap wajib menunjuk divisi yang sudah terdaftar.
            'division_id' => [
                'required_without:department',
                'nullable',
                'integer',
                Rule::exists('divisions', 'id'),
            ],

            'department' => [
                'required_without:division_id',
                'nullable',
                'string',
                'max:255',
                Rule::exists('divisions', 'name'),
            ],

            // Wajib diisi: nomor telepon dipakai sebagai faktor verifikasi pada
            // approval UAT non-IT, jadi setiap akun harus punya satu sejak dibuat.
            // Batas atas 20 mengikuti lebar kolom `users.phone_number`.
            'phone_number' => ['required', 'string', 'min:8', 'max:20'],

            // Ditolak secara eksplisit, bukan diabaikan diam-diam, supaya upaya
            // menaikkan hak akses lewat pendaftaran mandiri terlihat sebagai
            // kegagalan validasi 422 dan bukan sebagai keberhasilan palsu.
            'role' => ['prohibited'],
            'role_id' => ['prohibited'],
            'is_active' => ['prohibited'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'password.confirmed' => 'Konfirmasi password tidak sama dengan password baru.',
            'password.regex' => PasswordPolicy::regexMessage(),
            'division_id.exists' => 'Divisi yang dipilih tidak terdaftar.',
            'division_id.required_without' => 'Divisi wajib dipilih.',
            'department.exists' => 'Divisi yang dipilih tidak terdaftar.',
            'department.required_without' => 'Divisi wajib dipilih.',
            'phone_number.required' => 'Nomor handphone wajib diisi.',
            'phone_number.min' => 'Nomor handphone minimal 8 karakter.',
            'phone_number.max' => 'Nomor handphone maksimal 20 karakter.',
            'role.prohibited' => 'Peran akun tidak dapat ditentukan sendiri saat mendaftar. Semua pendaftaran mandiri terdaftar sebagai Business User.',
            'role_id.prohibited' => 'Peran akun tidak dapat ditentukan sendiri saat mendaftar. Semua pendaftaran mandiri terdaftar sebagai Business User.',
            'is_active.prohibited' => 'Status aktif akun tidak dapat ditentukan sendiri saat mendaftar.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->input('name')) ? trim($this->input('name')) : $this->input('name'),
            'email' => is_string($this->input('email')) ? mb_strtolower(trim($this->input('email'))) : $this->input('email'),
        ]);
    }
}
