<?php

namespace App\Http\Requests\ReleaseRequest;

use Illuminate\Foundation\Http\FormRequest;

class StoreReleaseRequestRequest extends FormRequest
{
    /**
     * Otorisasi sebenarnya dijaga `ProjectWorkflowService::transition()` saat proyek
     * dipindahkan ke PENDING_GOLIVE: hanya PM pemegang disposisi proyek (atau Super
     * Admin) yang lolos, dan hanya bila jalur QA serta Siber sudah dinyatakan lulus.
     * Menduplikasi aturan itu di sini akan membuat dua sumber kebenaran.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'target_release_date' => ['required', 'date'],
            'downtime_estimate' => ['nullable', 'string', 'max:255'],
            'rollback_plan' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_id.required' => 'Proyek yang akan dirilis wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak ditemukan.',
            'target_release_date.required' => 'Tanggal target rilis wajib diisi.',
            'target_release_date.date' => 'Tanggal target rilis tidak valid.',
        ];
    }
}
