<?php

namespace App\Http\Requests\Group;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pembaruan grup kerja oleh Super Admin (`PATCH /groups/{id}`).
 *
 * Aturannya menyeragamkan `StoreGroupRequest`, dengan `sometimes` agar pembaruan
 * sebagian tidak memaksa pengirim menyertakan seluruh field.
 */
class UpdateGroupRequest extends FormRequest
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
        $groupId = (int) $this->route('id');

        return [
            'code' => [
                'sometimes',
                'string',
                'max:50',
                'regex:/^[A-Z0-9-]+$/',
                Rule::unique('groups', 'code')->ignore($groupId),
            ],
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.regex' => 'Kode grup hanya boleh berisi huruf besar, angka, dan tanda hubung (contoh: PERENCANAAN-QA).',
            'code.unique' => 'Kode grup sudah dipakai grup lain.',
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
