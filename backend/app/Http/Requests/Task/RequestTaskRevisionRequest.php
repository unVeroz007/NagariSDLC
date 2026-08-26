<?php

namespace App\Http\Requests\Task;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi pengembalian task ke developer untuk revisi
 * (`POST /tasks/{taskId}/request-revision`).
 *
 * Wewenangnya tetap diperiksa di controller lewat `canModifyTask()` karena
 * keputusannya bergantung pada proyek beserta alokasi timnya — sama seperti
 * `UpdateTaskRequest`. Yang dipindahkan ke sini hanya bentuk masukannya, agar
 * seluruh endpoint write memakai Form Request sebagaimana disyaratkan AGENTS.md.
 *
 * `revision_note` wajib ada dan tidak boleh kosong: catatannya ikut tersimpan di
 * `project_tasks.revision_note` sekaligus masuk ke activity log sebagai alasan
 * task dimundurkan, jadi catatan kosong akan meninggalkan jejak audit yang tidak
 * menjelaskan apa pun.
 */
class RequestTaskRevisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'revision_note' => ['required', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'revision_note.required' => 'Catatan revisi wajib diisi agar developer tahu bagian mana yang harus diperbaiki.',
            'revision_note.max' => 'Catatan revisi maksimal 2000 karakter.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('revision_note'))) {
            $this->merge(['revision_note' => trim($this->input('revision_note'))]);
        }
    }
}
