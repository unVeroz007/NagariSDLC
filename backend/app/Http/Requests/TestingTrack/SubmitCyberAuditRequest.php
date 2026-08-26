<?php

namespace App\Http\Requests\TestingTrack;

use App\Enums\CyberCheckType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Pengajuan PM ke jalur Audit Keamanan Siber.
 *
 * Berbeda dari pengajuan QA, PM wajib memilih jenis pemeriksaan lebih dulu karena
 * keduanya menuntut masukan yang tidak dapat saling menggantikan:
 *
 * - Penetration Test menguji aplikasi berjalan, sehingga alamat lingkungan uji wajib.
 * - Secure Code Review menelaah kode, sehingga rujukan kode sumber wajib.
 *
 * Aturan wajib-isi bersyarat ditegakkan di sini — bukan di controller — supaya PM
 * langsung menerima pesan 422 yang menunjuk field yang salah, bukan pesan umum.
 */
class SubmitCyberAuditRequest extends FormRequest
{
    /**
     * Otorisasi dijaga `TestingTrackService::submitRequest()` — hanya PM pemegang
     * disposisi proyek (atau Super Admin) yang lolos.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Normalisasi jenis pemeriksaan sebelum divalidasi.
     *
     * Frontend mengirim nilai enum apa adanya, tetapi klien lain (mis. pengujian
     * manual lewat API) mudah mengirim "PENTEST". Menormalkan di sini membuat aturan
     * `Rule::in` di bawah tidak menolak masukan yang sebenarnya sah.
     */
    protected function prepareForValidation(): void
    {
        $checkType = CyberCheckType::normalize($this->input('cyber_check_type'));

        if ($checkType) {
            $this->merge(['cyber_check_type' => $checkType->value]);
        }
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'cyber_check_type' => ['required', Rule::in(CyberCheckType::values())],

            // Penetration Test: alamat aplikasi yang akan diuji.
            'cyber_target_url' => [
                'exclude_unless:cyber_check_type,' . CyberCheckType::PENTEST->value,
                'required',
                'string',
                'max:2048',
                'url',
            ],

            // Secure Code Review: rujukan repositori atau lokasi berkas kode.
            'cyber_source_code_ref' => [
                'exclude_unless:cyber_check_type,' . CyberCheckType::SECURE_CODE->value,
                'required',
                'string',
                'max:2000',
            ],

            'staging_url' => ['nullable', 'string', 'max:2048', 'url'],
            'target_completion_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_id.required' => 'Proyek yang akan diaudit wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak ditemukan.',
            'cyber_check_type.required' => 'Jenis pemeriksaan wajib dipilih: Penetration Test atau Secure Code Review.',
            'cyber_check_type.in' => 'Jenis pemeriksaan hanya boleh Penetration Test atau Secure Code Review.',
            'cyber_target_url.required' => 'Penetration Test menguji aplikasi yang berjalan, jadi alamat web target wajib diisi.',
            'cyber_target_url.url' => 'Alamat web target harus berupa URL yang valid, mis. https://staging.banknagari.co.id/aplikasi.',
            'cyber_source_code_ref.required' => 'Secure Code Review menelaah kode sumber, jadi rujukan kode (repositori, branch, atau lokasi berkas) wajib diisi.',
            'staging_url.url' => 'Alamat lingkungan uji harus berupa URL yang valid.',
            'target_completion_date.date' => 'Tanggal target penyelesaian audit tidak valid.',
        ];
    }
}
