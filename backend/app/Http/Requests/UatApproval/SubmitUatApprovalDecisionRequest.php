<?php

namespace App\Http\Requests\UatApproval;

use Illuminate\Foundation\Http\FormRequest;

class SubmitUatApprovalDecisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'decision' => ['required', 'string', 'in:approved,rejected'],
            'note' => ['nullable', 'string', 'max:5000', 'required_if:decision,rejected'],
        ];
    }

    public function messages(): array
    {
        return [
            'decision.in' => 'Keputusan harus berupa setuju atau tolak.',
            'note.required_if' => 'Alasan penolakan wajib diisi.',
        ];
    }
}
