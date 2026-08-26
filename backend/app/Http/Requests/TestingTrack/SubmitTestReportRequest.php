<?php

namespace App\Http\Requests\TestingTrack;

use App\Enums\TestResult;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Laporan hasil pengujian dari tester / auditor.
 *
 * Laporan ini tidak menutup jalur. Hasil di sini adalah penilaian pelaksana; keputusan
 * lulus atau tidak lulus tetap milik Lead pada endpoint sign-off. Karena itu
 * `conditional_pass` diterima di sini — pelaksana boleh melaporkan "lulus bersyarat" —
 * sementara sign-off Lead hanya mengenal lulus atau tidak lulus.
 */
class SubmitTestReportRequest extends FormRequest
{
    /**
     * Otorisasi dijaga `TestingTrackService::submitReport()`: hanya penerima disposisi
     * atau Lead jalur itu yang boleh mengirim laporan. ID berkas bukti juga diperiksa
     * di sana terhadap kepemilikan proyek, karena aturan validasi tidak melihat proyek
     * mana yang sedang dilaporkan.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'result' => ['required', Rule::in(TestResult::values())],

            // Hasil selain lulus bersih wajib disertai penjelasan: tanpa itu tim
            // pengembang tidak punya bahan untuk memperbaiki apa pun.
            'notes' => ['required_unless:result,' . TestResult::PASS->value, 'nullable', 'string', 'max:5000'],

            'severity' => ['nullable', 'string', 'max:50'],

            // Cakupan pengujian ditulis pelaksana sendiri. Bentuk lamanya adalah enam
            // skenario tetap berisi nilai boleh/tidak, yang memaksa penguji mencentang
            // skenario tak relevan sekaligus menyembunyikan skenario yang sungguh
            // dijalankan.
            'tested_scenarios' => ['nullable', 'string', 'max:5000'],

            // Kolom warisan. Klien saat ini tidak lagi mengirimnya, tetapi aturannya
            // dipertahankan agar laporan dari klien lama tidak ditolak validasi.
            'checklist' => ['nullable', 'array'],
            'checklist.*' => ['boolean'],

            // Berkas bukti diunggah lebih dulu ke document vault; di sini hanya ID-nya.
            'evidence_document_ids' => ['nullable', 'array', 'max:50'],
            'evidence_document_ids.*' => ['integer'],

            'attachment_url' => ['nullable', 'string', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_id.required' => 'Proyek yang dilaporkan wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak ditemukan.',
            'result.required' => 'Hasil pengujian wajib dipilih.',
            'result.in' => 'Hasil pengujian tidak dikenali.',
            'notes.required_unless' => 'Catatan temuan wajib diisi ketika hasil pengujian bukan lulus bersih.',
            'evidence_document_ids.max' => 'Jumlah berkas bukti pada satu laporan maksimal 50 berkas.',
        ];
    }
}
