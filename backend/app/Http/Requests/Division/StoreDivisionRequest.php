<?php

namespace App\Http\Requests\Division;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi pembuatan divisi oleh Super Admin (`POST /divisions`).
 *
 * Route-nya dijaga middleware `role:super_admin`. Aturannya dipindahkan dari
 * `$request->validate()` di controller ke Form Request agar seragam dengan
 * endpoint write lainnya dan agar controller cukup memakai `validated()`.
 */
class StoreDivisionRequest extends FormRequest
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
            'code' => ['required', 'string', 'max:20', 'unique:divisions,code'],
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
            'code.unique' => 'Kode divisi sudah dipakai divisi lain.',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Kode divisi dipakai sebagai penanda singkat di seluruh tampilan, jadi
        // disimpan seragam dalam huruf besar tanpa spasi berlebih.
        if (is_string($this->input('code'))) {
            $this->merge(['code' => mb_strtoupper(trim($this->input('code')))]);
        }

        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }
}
