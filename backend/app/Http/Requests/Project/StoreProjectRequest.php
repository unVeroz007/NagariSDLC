<?php

namespace App\Http\Requests\Project;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $targetDate = $this->target_date ?? $this->targetDate;
        if ($targetDate === 'TBD' || empty($targetDate)) {
            $this->merge(['target_date' => null]);
        }
    }

    public function rules(): array
    {
        return [
            // FE bisa kirim 'title' ATAU 'name'
            'title'       => ['nullable', 'string', 'max:255'],
            'name'        => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            // FE bisa kirim 'division_id' (int) ATAU 'division' (string)
            'division_id' => ['nullable', 'exists:divisions,id'],
            'division'    => ['nullable', 'string'],
            'target_date' => ['required', 'date'],
            'type'        => ['nullable', 'string'],
            'rbb_deadline'=> ['nullable', 'date'],
        ];
    }

    /**
     * Pastikan minimal 'title' atau 'name' diisi.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            if (empty($this->title) && empty($this->name)) {
                $v->errors()->add('title', 'Nama/judul proyek wajib diisi.');
            }
        });
    }
}

