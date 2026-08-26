<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bentuk respons error API.
 *
 * `AGENTS.md` menetapkan satu bentuk respons untuk seluruh API:
 * `{ status, message, data?, meta? }`. Controller sudah memenuhinya untuk kegagalan
 * yang ditangkapnya sendiri, tetapi error yang dilempar kerangka kerja — validasi,
 * token kedaluwarsa, `findOrFail`, `abort(403)`, metode HTTP salah — dahulu lolos
 * dengan bentuk bawaan Laravel yang hanya berisi `message`. Pengujian ini menjaga
 * penyeragamannya di `bootstrap/app.php` supaya klien tidak perlu menangani dua
 * bentuk error untuk satu API.
 */
class ApiErrorEnvelopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_request_is_enveloped(): void
    {
        $this->getJson('/api/v1/projects')
            ->assertStatus(401)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('message', 'Sesi Anda sudah berakhir atau token tidak valid. Silakan masuk kembali.');
    }

    public function test_validation_failure_keeps_its_error_bag_and_gains_a_status(): void
    {
        $this->actingAs($this->makeUser(UserRole::PROJECT_MANAGER, 'pm-envelope@nagari.co.id'))
            ->postJson('/api/v1/qa-requests/submit', [])
            ->assertStatus(422)
            ->assertJsonPath('status', 'error')
            ->assertJsonValidationErrors(['project_id']);
    }

    public function test_missing_record_is_enveloped_as_not_found(): void
    {
        $this->actingAs($this->makeUser(UserRole::SUPER_ADMIN, 'admin-envelope@nagari.co.id'))
            ->getJson('/api/v1/projects/999999')
            ->assertStatus(404)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('message', 'Data yang diminta tidak ditemukan.');
    }

    public function test_wrong_http_method_is_enveloped(): void
    {
        $this->deleteJson('/api/v1/health')
            ->assertStatus(405)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('message', 'Metode HTTP ini tidak tersedia untuk endpoint tersebut.');
    }

    public function test_abort_message_from_a_controller_is_preserved(): void
    {
        $division = Division::create(['code' => 'IT-ENV', 'name' => 'Divisi Teknologi Informasi']);
        $owner = $this->makeUser(UserRole::PROJECT_MANAGER, 'pm-pemilik@nagari.co.id', $division);
        $outsider = $this->makeUser(UserRole::QA_TESTER, 'qa-luar@nagari.co.id', $division);
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Di Luar Akses',
            'created_by' => $owner->id,
            'pm_id' => $owner->id,
            'division_id' => $division->id,
            // Belum masuk fase QA, jadi QA Tester tidak berhak melihatnya.
            'status' => ProjectStatus::DEV_COMPLETED->value,
        ]);

        // Penjelasan pada `abort(403, '...')` memang ditulis untuk pengguna, jadi
        // penyeragaman envelope tidak boleh menggantinya dengan pesan generik.
        $this->actingAs($outsider)
            ->postJson('/api/v1/qa-requests/report', [
                'project_id' => $project->id,
                'result' => 'pass',
            ])
            ->assertStatus(403)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('message', 'Anda tidak memiliki akses ke proyek ini.');
    }

    private function makeUser(UserRole $role, string $email, ?Division $division = null): User
    {
        $division ??= Division::firstOrCreate(
            ['code' => 'IT-ENV'],
            ['name' => 'Divisi Teknologi Informasi']
        );
        $roleRow = Role::firstOrCreate(
            ['name' => $role->value],
            ['display_name' => $role->label()]
        );

        return User::create([
            'name' => $role->label(),
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $roleRow->id,
            'division_id' => $division->id,
            'is_active' => true,
        ]);
    }
}
