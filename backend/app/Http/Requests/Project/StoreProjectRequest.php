<?php

namespace App\Http\Requests\Project;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // FE bisa kirim 'title' ATAU 'name'
            'title'       => ['nullable', 'string', 'max:255'],
            'name'        => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            // FE bisa kirim 'division_id' (int) ATAU 'division_name' (string)
            'division_id' => ['nullable', 'exists:divisions,id'],
            'target_date' => ['nullable', 'date'],
            'type'        => ['nullable', 'string', 'in:RBB,Non-RBB,NON_RBB'],
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

