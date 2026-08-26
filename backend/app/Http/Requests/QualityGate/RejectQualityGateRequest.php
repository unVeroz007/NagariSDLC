<?php

namespace App\Http\Requests\QualityGate;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi penolakan rilis pada Quality Gate.
 *
 * Alasan penolakan wajib dan tidak boleh sekadar satu kata. Penolakan go-live
 * mengembalikan proyek yang sudah melewati seluruh rangkaian pengujian, jadi PM
 * harus mendapat keterangan yang cukup untuk memperbaiki pengajuannya — dan jejak
 * audit harus dapat menjelaskan mengapa rilis dibatalkan.
 */
class RejectQualityGateRequest extends FormRequest
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
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'project_id.required' => 'Proyek yang ditolak wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak ditemukan.',
            'reason.required' => 'Alasan penolakan rilis wajib diisi.',
            'reason.min' => 'Alasan penolakan minimal 10 karakter agar dapat ditindaklanjuti pengaju.',
            'reason.max' => 'Alasan penolakan maksimal 2000 karakter.',
        ];
    }
}
