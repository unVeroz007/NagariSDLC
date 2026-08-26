<?php

namespace App\Http\Requests\Project;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi alokasi anggota tim ke proyek (`POST|PUT /projects/{id}/team`).
 *
 * Wewenangnya diperiksa controller karena bergantung pada proyek yang dituju.
 * Bentuk elemen `team.*` sengaja tidak dipatok lebih rinci daripada "array":
 * controller menerima beberapa bentuk penunjuk anggota (`user_id`, `id`, `email`,
 * atau `name`) untuk kompatibilitas dengan formulir yang sudah ada, dan memetakan
 * masing-masing ke `project_team_members`.
 */
class AllocateTeamRequest extends FormRequest
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
            'team' => ['required', 'array', 'min:1'],
            'team.*' => ['required', 'array'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'team.required' => 'Daftar anggota tim wajib dikirim.',
            'team.min' => 'Alokasi tim harus berisi minimal satu anggota.',
            'team.*.array' => 'Setiap anggota tim harus berupa objek berisi data anggota.',
        ];
    }
}
