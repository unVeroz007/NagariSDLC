<?php

namespace App\Http\Requests\Role;

use App\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Validasi pembaruan role oleh Super Admin (`PATCH /roles/{id}`).
 *
 * Selain menyeragamkan aturan dengan `StoreRoleRequest`, di sini ditambahkan dua
 * pengaman yang sebelumnya tidak ada:
 *
 *   1. Kunci teknis role `super_admin` tidak boleh diganti. Controller sudah melarang
 *      penghapusannya, tetapi tidak melarang penggantian namanya — padahal middleware
 *      `role:super_admin` dan sejumlah pengecekan di service mencocokkan string itu
 *      secara langsung, sehingga sekali kuncinya berubah seluruh hak Super Admin ikut
 *      hilang dan tidak ada lagi akun yang bisa mengembalikannya.
 *   2. Akses menu `super_admin` tidak boleh dibatasi, karena halaman Administrasi yang
 *      mengatur pembatasan itu sendiri berada di dalam menu.
 */
class UpdateRoleRequest extends FormRequest
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
        $roleId = (int) $this->route('id');

        return [
            'name' => [
                'sometimes',
                'string',
                'max:100',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('roles', 'name')->ignore($roleId),
            ],
            'display_name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],

            // Grup kerja yang menaungi role ini. Boleh kosong: role sistem tidak
            // mewakili unit kerja mana pun.
            'group_id' => ['sometimes', 'nullable', 'integer', 'exists:groups,id'],

            // Daftar path menu yang boleh dilihat role ini. Kosong berarti tanpa
            // pembatasan — lihat `Role::menuAccessPaths()`.
            'menu_access' => ['sometimes', 'nullable', 'array', 'max:200'],
            'menu_access.*' => ['string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.regex' => 'Kunci role hanya boleh berisi huruf kecil, angka, dan garis bawah (contoh: dev_analyst).',
            'name.unique' => 'Kunci role sudah dipakai role lain.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $role = Role::find((int) $this->route('id'));

            if ($role === null || $role->name !== 'super_admin') {
                return;
            }

            // Pembatasan menu pada Super Admin tidak diizinkan. Halaman Administrasi
            // sendiri berada di dalam menu, jadi Super Admin yang membatasi dirinya
            // sendiri akan kehilangan satu-satunya jalan untuk membatalkannya.
            if ($this->has('menu_access') && ! empty($this->input('menu_access'))) {
                $validator->errors()->add(
                    'menu_access',
                    'Akses menu role "super_admin" tidak dapat dibatasi, karena halaman Administrasi yang mengatur pembatasan itu sendiri berada di dalam menu.'
                );
            }

            if ($this->has('name') && $this->input('name') !== 'super_admin') {
                $validator->errors()->add(
                    'name',
                    'Kunci role "super_admin" adalah kunci sistem dan tidak dapat diubah. Nama tampilannya masih boleh disesuaikan.'
                );
            }
        });
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => mb_strtolower(trim($this->input('name')))]);
        }

        if (is_string($this->input('display_name'))) {
            $this->merge(['display_name' => trim($this->input('display_name'))]);
        }
    }
}
