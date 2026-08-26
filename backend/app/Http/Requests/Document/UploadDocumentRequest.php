<?php

namespace App\Http\Requests\Document;

use App\Models\DocumentVault;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Unggah berkas ke Document Vault proyek.
 *
 * Otorisasi tidak dilakukan di sini melainkan di controller lewat
 * `ProjectAccessService::canUpdate()`, karena aturannya bergantung pada baris
 * proyek yang harus dimuat lebih dulu dan dipakai bersama oleh endpoint lain.
 */
class UploadDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],

            // Dahulu `['required', 'string']` tanpa batas nilai. Karena
            // `document_type` menyusun nama berkas resmi dan menjadi dasar
            // pemeriksaan prasyarat per fase, nilainya dibatasi pada kode yang
            // dikenal sistem — lihat `DocumentVault::ALLOWED_TYPES`.
            'document_type' => ['required', 'string', Rule::in(DocumentVault::ALLOWED_TYPES)],

            'file' => ['required', 'file', 'max:5120', 'mimes:pdf,xls,xlsx,jpg,jpeg,png,zip'],
            'original_filename' => ['nullable', 'string', 'max:255'],
            'context_label' => ['nullable', 'string', 'max:40'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'project_id.required' => 'Proyek tujuan unggahan wajib disertakan.',
            'project_id.exists' => 'Proyek yang dipilih tidak ditemukan.',
            'document_type.required' => 'Tipe dokumen wajib dipilih.',
            'document_type.in' => 'Tipe dokumen tidak dikenali sistem.',
            'file.required' => 'Berkas dokumen wajib dilampirkan.',
            'file.max' => 'Ukuran berkas dokumen melebihi batas maksimal 5 MB.',
            'file.mimes' => 'Format yang diizinkan: PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), ZIP.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $documentType = $this->input('document_type');

        if (is_string($documentType)) {
            $this->merge(['document_type' => mb_strtoupper(trim($documentType))]);
        }
    }
}
