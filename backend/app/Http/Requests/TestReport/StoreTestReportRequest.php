<?php

namespace App\Http\Requests\TestReport;

use App\Enums\TestResult;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreTestReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'exists:projects,id'],
            'result' => ['required', new Enum(TestResult::class)],
            'notes' => ['nullable', 'string'],
            'attachment_url' => ['nullable', 'string'],
        ];
    }
}
