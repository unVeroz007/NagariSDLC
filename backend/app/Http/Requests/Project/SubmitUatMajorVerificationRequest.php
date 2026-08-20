<?php

namespace App\Http\Requests\Project;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SubmitUatMajorVerificationRequest extends FormRequest
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
            'items' => ['required', 'array', 'min:1'],
            'items.*.source' => ['required', 'string', 'in:scenario,additional_request'],
            'items.*.id' => ['required', 'string', 'max:100'],
            'items.*.result' => ['required', 'string', 'in:accepted,revision'],
            'items.*.comment' => ['nullable', 'string', 'max:5000'],
            'items.*.attachments' => ['required', 'array', 'min:1', 'max:10'],
            'items.*.attachments.*.docId' => ['required', 'integer', 'distinct'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $keys = [];
                foreach ($this->input('items', []) as $index => $item) {
                    $key = ($item['source'] ?? '').':'.($item['id'] ?? '');
                    if (isset($keys[$key])) {
                        $validator->errors()->add("items.{$index}.id", 'Item verifikasi yang sama tidak boleh dikirim dua kali.');
                    }
                    $keys[$key] = true;

                    if (($item['result'] ?? null) === 'revision' && blank($item['comment'] ?? null)) {
                        $validator->errors()->add(
                            "items.{$index}.comment",
                            'Alasan penolakan wajib diisi jika perbaikan masih memerlukan revisi.'
                        );
                    }
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'items.*.attachments.required' => 'Lampiran bukti verifikasi wajib diunggah untuk setiap item Mayor.',
            'items.*.attachments.min' => 'Minimal satu lampiran bukti verifikasi wajib tersedia untuk setiap item Mayor.',
            'items.*.attachments.*.docId.distinct' => 'Lampiran bukti verifikasi yang sama tidak boleh dikirim dua kali.',
        ];
    }
}
