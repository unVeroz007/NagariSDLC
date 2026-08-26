<?php

namespace App\Http\Requests\Division;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pembaruan divisi oleh Super Admin (`PATCH /divisions/{id}`).
 *
 * Pengecualian keunikan memakai `Rule::unique()->ignore()` alih-alih string
 * `"unique:divisions,code,{$id}"` yang dirangkai manual, sehingga nilai id tidak
 * pernah disisipkan langsung ke dalam definisi aturan.
 */
class UpdateDivisionRequest extends FormRequest
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
        $divisionId = (int) $this->route('id');

        return [
            'code' => [
                'sometimes',
                'string',
                'max:20',
                Rule::unique('divisions', 'code')->ignore($divisionId),
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
            'code.unique' => 'Kode divisi sudah dipakai divisi lain.',
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
