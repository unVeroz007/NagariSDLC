<?php

namespace App\Http\Requests\Group;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi pembuatan grup kerja oleh Super Admin (`POST /groups`).
 *
 * `code` adalah penanda pendek yang muncul di daftar Administrasi dan dipakai
 * mencocokkan grup antar lingkungan (backfill migration memakainya, bukan ID, karena
 * ID grup berbeda di setiap basis data). Bentuknya dibatasi huruf besar, angka, dan
 * tanda hubung supaya konsisten dengan `divisions.code` yang sudah berjalan.
 */
class StoreGroupRequest extends FormRequest
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
            'code' => ['required', 'string', 'max:50', 'regex:/^[A-Z0-9-]+$/', 'unique:groups,code'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.required' => 'Kode grup wajib diisi.',
            'code.regex' => 'Kode grup hanya boleh berisi huruf besar, angka, dan tanda hubung (contoh: PERENCANAAN-QA).',
            'code.unique' => 'Kode grup sudah dipakai grup lain.',
            'name.required' => 'Nama grup wajib diisi.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => mb_strtoupper(trim($this->input('code')))]);
        }

        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }
}
