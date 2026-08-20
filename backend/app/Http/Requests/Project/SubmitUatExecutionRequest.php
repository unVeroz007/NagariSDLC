<?php

namespace App\Http\Requests\Project;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SubmitUatExecutionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = Project::find($this->route('id'));
        $user = $this->user();

        if (! $project || ! $user) {
            return false;
        }

        $role = $user->role?->name;

        return in_array($role, ['super_admin', 'head_of_it'], true)
            || (in_array($role, ['dev_analyst', 'project_manager'], true)
                && (int) $project->pm_id === (int) $user->id)
            || ($role === 'business_user'
                && (int) $project->created_by === (int) $user->id);
    }

    public function rules(): array
    {
        return [
            'scenarios' => ['required', 'array', 'min:1'],
            'scenarios.*.id' => ['required', 'string', 'max:100', 'distinct'],
            'scenarios.*.task_id' => ['required', 'integer', 'distinct'],
            'scenarios.*.scenario' => ['required', 'string', 'max:500'],
            'scenarios.*.result' => ['required', 'string', 'in:accepted,revision'],
            'scenarios.*.change_type' => ['nullable', 'string', 'in:minor,mayor'],
            'scenarios.*.request' => ['nullable', 'string', 'max:5000'],
            'scenarios.*.comment' => ['nullable', 'string', 'max:2000'],
            'scenarios.*.attachments' => ['sometimes', 'array', 'max:10'],
            'scenarios.*.attachments.*.docId' => ['required', 'integer', 'distinct'],
            'additional_requests' => ['sometimes', 'array', 'max:20'],
            'additional_requests.*.id' => ['required', 'string', 'max:100', 'distinct'],
            'additional_requests.*.title' => ['required', 'string', 'max:500'],
            'additional_requests.*.change_type' => ['required', 'string', 'in:minor,mayor'],
            'additional_requests.*.detail' => ['required', 'string', 'max:5000'],
            'additional_requests.*.comment' => ['nullable', 'string', 'max:2000'],
            'additional_requests.*.attachments' => ['sometimes', 'array', 'max:10'],
            'additional_requests.*.attachments.*.docId' => ['required', 'integer', 'distinct'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach ($this->input('scenarios', []) as $index => $scenario) {
                    if (($scenario['result'] ?? null) !== 'revision') {
                        continue;
                    }

                    if (empty($scenario['change_type'])) {
                        $validator->errors()->add(
                            "scenarios.{$index}.change_type",
                            'Tipe perubahan wajib dipilih untuk skenario yang memerlukan revisi.'
                        );
                    }

                    if (blank($scenario['request'] ?? null)) {
                        $validator->errors()->add(
                            "scenarios.{$index}.request",
                            'Detail permintaan perubahan wajib diisi untuk skenario yang memerlukan revisi.'
                        );
                    }
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'scenarios.required' => 'Hasil eksekusi UAT wajib diisi.',
            'scenarios.min' => 'Minimal satu skenario UAT harus dieksekusi.',
            'scenarios.*.task_id.distinct' => 'Satu task hanya boleh dicatat satu kali dalam eksekusi UAT.',
            'scenarios.*.attachments.*.docId.distinct' => 'Lampiran bukti yang sama tidak boleh dicantumkan lebih dari satu kali.',
            'additional_requests.*.title.required' => 'Judul permintaan tambahan user wajib diisi.',
            'additional_requests.*.change_type.required' => 'Tipe Minor atau Mayor wajib dipilih untuk setiap permintaan tambahan.',
            'additional_requests.*.detail.required' => 'Detail permintaan tambahan user wajib diisi.',
        ];
    }
}
