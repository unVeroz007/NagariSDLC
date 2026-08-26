<?php

namespace App\Http\Requests\TestingTrack;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Pengajuan PM ke jalur Pengujian QA.
 */
class SubmitQaTestingRequest extends FormRequest
{
    /**
     * Otorisasi dijaga `TestingTrackService::submitRequest()` — hanya PM pemegang
     * disposisi proyek (atau Super Admin) yang lolos. Menduplikasi aturan itu di sini
     * akan membuat dua sumber kebenaran yang bisa menyimpang.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'staging_url' => ['nullable', 'string', 'max:2048', 'url'],
            'target_completion_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_id.required' => 'Proyek yang akan diuji wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak ditemukan.',
            'staging_url.url' => 'Alamat lingkungan uji harus berupa URL yang valid, mis. https://staging.banknagari.co.id/aplikasi.',
            'target_completion_date.date' => 'Tanggal target penyelesaian pengujian tidak valid.',
        ];
    }
}
