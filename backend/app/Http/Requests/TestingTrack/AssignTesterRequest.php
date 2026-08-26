<?php

namespace App\Http\Requests\TestingTrack;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Disposisi Lead: menugaskan satu tester / auditor pada jalur pengujian.
 */
class AssignTesterRequest extends FormRequest
{
    /**
     * Otorisasi dijaga `TestingTrackService::assignTester()`, yang memeriksa dua hal
     * sekaligus: pengirim adalah Lead jalur tersebut, dan penerima disposisi memang
     * berperan sebagai pelaksana pengujian pada jalur itu.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'assignee_id' => ['required', 'integer', 'exists:users,id'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_id.required' => 'Proyek yang akan didisposisikan wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak ditemukan.',
            'assignee_id.required' => 'Pelaksana pengujian wajib dipilih.',
            'assignee_id.exists' => 'Pelaksana pengujian yang dipilih tidak ditemukan.',
        ];
    }
}
