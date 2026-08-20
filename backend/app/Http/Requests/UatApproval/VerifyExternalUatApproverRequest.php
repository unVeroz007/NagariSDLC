<?php

namespace App\Http\Requests\UatApproval;

use Illuminate\Foundation\Http\FormRequest;

class VerifyExternalUatApproverRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['phone' => ['required', 'string', 'max:30']];
    }

    public function messages(): array
    {
        return ['phone.required' => 'Nomor HP wajib diisi untuk memverifikasi akses.'];
    }
}
