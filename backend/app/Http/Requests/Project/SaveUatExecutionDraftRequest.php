<?php

namespace App\Http\Requests\Project;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;

class SaveUatExecutionDraftRequest extends FormRequest
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
            'scenarios.*.result' => ['nullable', 'string', 'in:accepted,revision'],
            'scenarios.*.change_type' => ['nullable', 'string', 'in:minor,mayor'],
            'scenarios.*.request' => ['nullable', 'string', 'max:5000'],
            'scenarios.*.comment' => ['nullable', 'string', 'max:2000'],
            'scenarios.*.attachments' => ['sometimes', 'array', 'max:10'],
            'scenarios.*.attachments.*.docId' => ['required', 'integer', 'distinct'],
            'additional_requests' => ['sometimes', 'array', 'max:20'],
            'additional_requests.*.id' => ['required', 'string', 'max:100', 'distinct'],
            'additional_requests.*.title' => ['nullable', 'string', 'max:500'],
            'additional_requests.*.change_type' => ['nullable', 'string', 'in:minor,mayor'],
            'additional_requests.*.detail' => ['nullable', 'string', 'max:5000'],
            'additional_requests.*.comment' => ['nullable', 'string', 'max:2000'],
            'additional_requests.*.attachments' => ['sometimes', 'array', 'max:10'],
            'additional_requests.*.attachments.*.docId' => ['required', 'integer', 'distinct'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
