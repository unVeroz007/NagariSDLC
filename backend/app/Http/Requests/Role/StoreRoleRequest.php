<?php

namespace App\Http\Requests\Role;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi pembuatan role oleh Super Admin (`POST /roles`).
 *
 * `name` adalah kunci teknis yang dipakai middleware `role:...`, pengecekan
 * `$user->role->name` di service, dan pemetaan peran di frontend. Karena itu
 * bentuknya dibatasi huruf kecil, angka, dan garis bawah: satu spasi atau huruf
 * besar di dalamnya membuat role tersebut tidak akan pernah cocok dengan
 * pengecekan yang ada, dan kegagalannya baru terasa jauh setelah role dibuat.
 */
class StoreRoleRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9_]+$/', 'unique:roles,name'],
            'display_name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],

            // Grup kerja yang menaungi role ini. Boleh kosong: role sistem tidak
            // mewakili unit kerja mana pun.
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],

            // Daftar path menu yang boleh dilihat role ini. Kosong berarti tanpa
            // pembatasan — lihat `Role::menuAccessPaths()`.
            'menu_access' => ['nullable', 'array', 'max:200'],
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
