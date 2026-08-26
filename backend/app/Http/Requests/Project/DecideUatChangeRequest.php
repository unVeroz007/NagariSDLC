<?php

namespace App\Http\Requests\Project;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi keputusan atas change request UAT
 * (`POST /projects/{id}/uat-change-request/decision`).
 *
 * Peran yang berwenang memutuskan diperiksa controller. `cr_id` menunjuk entri di
 * dalam `projects.sit_uat_data['uat_change_requests']`, jadi keberadaannya juga
 * hanya bisa dipastikan controller — bila tidak ditemukan, jawabannya 404.
 */
class DecideUatChangeRequest extends FormRequest
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
            'cr_id' => ['required', 'string', 'max:100'],
            'decision' => ['required', 'string', 'in:approved,rejected'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'cr_id.required' => 'Change request yang diputuskan tidak disebutkan.',
            'decision.in' => 'Keputusan hanya boleh "approved" atau "rejected".',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('decision'))) {
            $this->merge(['decision' => mb_strtolower(trim($this->input('decision')))]);
        }

        if (is_string($this->input('note'))) {
            $this->merge(['note' => trim($this->input('note'))]);
        }
    }
}
