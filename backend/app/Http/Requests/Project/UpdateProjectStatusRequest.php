<?php

namespace App\Http\Requests\Project;

use App\Enums\ProjectStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateProjectStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', new Enum(ProjectStatus::class)],
            'notes' => ['nullable', 'string'],
        ];
    }
}
