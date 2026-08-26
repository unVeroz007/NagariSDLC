<?php

namespace App\Http\Requests\TestingTrack;

use App\Enums\TestResult;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Sign-off Lead: menutup jalur pengujian dengan lulus, atau mengembalikan proyek.
 *
 * Pilihannya sengaja biner. `conditional_pass` yang dikenal enum hasil pengujian tidak
 * diterima di sini karena keputusan Lead adalah gerbang: proyek boleh lanjut ke
 * pengajuan go-live, atau kembali ke pengembangan. Tidak ada keadaan ketiga yang bisa
 * ditindaklanjuti alur kerja.
 */
class SignOffTrackRequest extends FormRequest
{
    /**
     * Otorisasi dijaga `TestingTrackService::signOff()` (pengirim adalah Lead jalur)
     * dan `ProjectWorkflowService::transition()` (wewenang perpindahan status utama).
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'result' => ['required', Rule::in([TestResult::PASS->value, TestResult::FAIL->value])],

            // Pengembalian ke pengembangan wajib disertai alasan: catatan inilah yang
            // dibaca tim pengembang sebagai daftar perbaikan.
            'notes' => ['required_if:result,' . TestResult::FAIL->value, 'nullable', 'string', 'max:5000'],

            // Tingkat keparahan opsional yang ditetapkan Lead saat mengembalikan proyek.
            // Bila diisi, nilai inilah yang disalin ke putaran pengembalian dan dipakai
            // sisi pengembangan untuk memprioritaskan task perbaikan; bila kosong,
            // putaran memakai severity laporan uji terakhir. Aturannya disamakan dengan
            // `SubmitTestReportRequest` agar satu kosakata severity berlaku di kedua
            // pintu (laporan tester dan sign-off Lead).
            'severity' => ['nullable', 'string', 'max:50'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_id.required' => 'Proyek yang akan di-sign-off wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak ditemukan.',
            'result.required' => 'Keputusan sign-off wajib dipilih: lulus atau tidak lulus.',
            'result.in' => 'Keputusan sign-off hanya boleh lulus atau tidak lulus.',
            'notes.required_if' => 'Alasan pengembalian wajib diisi agar tim pengembang mengetahui apa yang harus diperbaiki.',
        ];
    }
}
