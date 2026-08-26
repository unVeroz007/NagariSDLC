<?php

namespace App\Http\Requests\QualityGate;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi persetujuan Quality Gate oleh Head of IT.
 *
 * Otorisasi role dijaga middleware `role:super_admin,head_of_it` pada rute, dan
 * kewenangan transisi statusnya dijaga `ProjectWorkflowService`. Yang diperiksa di
 * sini hanya bentuk masukannya.
 */
class ApproveQualityGateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'project_id.required' => 'Proyek yang disetujui wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak ditemukan.',
            'notes.max' => 'Catatan persetujuan maksimal 2000 karakter.',
        ];
    }
}
