<?php

namespace App\Http\Requests\Project;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi catatan pada endpoint persetujuan gerbang SIT-3 dan UAT-3
 * (`POST /projects/{id}/sit-approval` dan `POST /projects/{id}/uat-approval`).
 *
 * Keduanya hanya menerima satu field opsional yang sama, sehingga memakai satu
 * Form Request. Seluruh pemeriksaan wewenang — peran mana yang boleh menyetujui,
 * apakah pengguna benar-benar PM/developer proyek tersebut, dan apakah fase
 * proyeknya memang sedang di gerbang itu — tetap di controller karena keputusannya
 * bergantung pada isi `projects.sit_uat_data` dan alokasi tim.
 */
class SubmitApprovalNoteRequest extends FormRequest
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
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.max' => 'Catatan persetujuan maksimal 2000 karakter.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('note'))) {
            $this->merge(['note' => trim($this->input('note'))]);
        }
    }
}
