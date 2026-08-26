<?php

namespace App\Http\Requests\Task;

use App\Enums\ReturnRoundStatus;
use App\Enums\TaskStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class StoreTaskRequest extends FormRequest
{
    /**
     * Wewenang membuat task dinilai `TaskController::store()` lewat
     * `ProjectAccessService::canUpdate()`, bukan di sini.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assignee_id' => ['nullable', 'exists:users,id'],
            'status' => ['nullable', new Enum(TaskStatus::class)],
            'due_date' => ['nullable', 'date'],
            'priority' => ['nullable', 'string', 'in:High,Medium,Low'],
            // Penanda asal task perbaikan: putaran pengembalian QA / Keamanan Siber yang
            // memintanya. Dibatasi pada putaran proyek yang sama DAN yang masih terbuka —
            // menempelkan task baru pada putaran yang sudah diajukan ulang akan menambah
            // pekerjaan ke sebuah putaran yang riwayatnya sudah tertutup, sehingga
            // gerbang pengajuan ulangnya tidak akan pernah menilai task itu.
            'return_round_id' => [
                'nullable',
                'integer',
                Rule::exists('project_return_rounds', 'id')
                    ->where('project_id', $this->route('projectId'))
                    ->where('status', ReturnRoundStatus::OPEN->value),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'return_round_id.exists' => 'Putaran pengembalian yang dipilih bukan milik proyek ini atau sudah diajukan ulang, sehingga task perbaikan tidak dapat ditambahkan ke dalamnya.',
        ];
    }
}
