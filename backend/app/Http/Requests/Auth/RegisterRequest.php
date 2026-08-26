<?php

namespace App\Http\Requests\Auth;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pendaftaran akun mandiri.
 *
 * Endpoint registrasi berada di luar `auth:sanctum`, sehingga setiap field yang
 * diterima di sini dapat dikirim oleh siapa pun di jaringan. Tiga hal karena itu
 * dijaga ketat:
 *
 *   1. `role` DILARANG. Sebelumnya field ini divalidasi sebagai string biasa lalu
 *      dipakai langsung untuk mencari baris `roles`, sehingga satu request tanpa
 *      autentikasi bisa membuat akun `super_admin`. Peran akun hasil pendaftaran
 *      mandiri sekarang dipatok di controller dan tidak bisa dipengaruhi klien.
 *      Penambahan pengguna berperan lain adalah wewenang Super Admin lewat
 *      `POST /users`.
 *   2. Divisi wajib menunjuk baris yang SUDAH ADA. Sebelumnya nama departemen
 *      bebas dari klien otomatis membuat baris `divisions` baru, sehingga master
 *      data bisa dipenuhi divisi karangan. Formulir kini memilih dari daftar
 *      resmi (`GET /auth/divisions`).
 *   3. Kekuatan password sama dengan aturan penggantian password di
 *      `AuthController@updatePassword`, plus konfirmasi ulang. Tanpa ini akun baru
 *      boleh memakai password yang lebih lemah daripada saat menggantinya.
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

            'phone_number' => ['nullable', 'string', 'max:20'],

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
