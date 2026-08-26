<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Endpoint beban aktif lintas-fase: GET /api/v1/users/workload.
 *
 * Dropdown disposisi QA dan Audit Keamanan Siber menampilkan beban tiap orang. Beban
 * itu tidak bisa dihitung di sisi Lead karena `applyVisibilityScope()` menyembunyikan
 * proyek Fase 1 dari qa_lead/cyber_lead, jadi angkanya dihitung server-side di sini.
 *
 * Yang dikunci pengujian ini adalah definisi "beban" yang mudah luruh saat kode berubah:
 *
 * 1. Gabungan lintas fase — analisis perencanaan (Fase 1) dan pengujian QA/Siber
 *    (Fase 3) dijumlahkan, karena orang yang sama merangkap keduanya.
 * 2. Satu proyek dihitung sekali per orang meski ia memegang lebih dari satu peran di
 *    dalamnya (analis sekaligus penerima disposisi).
 * 3. Pekerjaan yang sudah selesai tidak dihitung: proyek terminal, jalur PASSED, dan
 *    jalur REVIEW (bola sudah di tangan Lead) semuanya dikecualikan.
 * 4. Pengguna tanpa beban tidak muncul dalam respons (dianggap nol oleh pemanggil).
 */
class UserWorkloadEndpointTest extends TestCase
{
    use RefreshDatabase;

    private Division $division;

    /**
     * @var array<string, Role>
     */
    private array $roles = [];

    private User $pm;

    private User $dualAnalyst;

    private User $pentester;

    private User $idleAnalyst;

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create([
            'code' => 'IT-QA',
            'name' => 'Divisi Teknologi Informasi',
        ]);

        $this->pm = $this->makeUser(UserRole::PROJECT_MANAGER, 'Analis Pengembangan', 'pm-load@nagari.co.id');
        // Orang yang merangkap analisis perencanaan (Fase 1) dan pengujian QA (Fase 3).
        $this->dualAnalyst = $this->makeUser(UserRole::QA_TESTER, 'Analis QA Rangkap', 'dual-load@nagari.co.id');
        $this->pentester = $this->makeUser(UserRole::PENTESTER, 'Pentester', 'pentest-load@nagari.co.id');
        // Terdaftar tetapi tanpa penugasan aktif mana pun.
        $this->idleAnalyst = $this->makeUser(UserRole::QA_TESTER, 'Analis Nganggur', 'idle-load@nagari.co.id');
    }

    public function test_workload_sums_planning_and_testing_load_and_dedupes_per_project(): void
    {
        // Fase 1 aktif — analisis perencanaan sedang berjalan.
        $this->makeProject('Analisis Berjalan', ProjectStatus::IN_REVIEW, [
            'analyst_id' => $this->dualAnalyst->id,
        ]);

        // Fase 3 aktif — jalur QA sedang diuji orang yang sama, proyek berbeda.
        $this->makeProject('QA Berjalan', ProjectStatus::QA_IN_PROGRESS, [
            'qa_assignee_id' => $this->dualAnalyst->id,
            'qa_status' => TrackStatus::IN_PROGRESS->value,
        ]);

        // Proyek yang sama dipegang sebagai analis DAN penerima disposisi QA: kedua
        // cabang perhitungan menyala, tetapi proyeknya wajib dihitung sekali saja.
        $this->makeProject('Rangkap Satu Proyek', ProjectStatus::IN_REVIEW, [
            'analyst_id' => $this->dualAnalyst->id,
            'qa_assignee_id' => $this->dualAnalyst->id,
            'qa_status' => TrackStatus::IN_PROGRESS->value,
        ]);

        // Pentester: satu audit siber aktif.
        $this->makeProject('Audit Berjalan', ProjectStatus::CYBER_IN_PROGRESS, [
            'cyber_assignee_id' => $this->pentester->id,
            'cyber_status' => TrackStatus::IN_PROGRESS->value,
        ]);

        // ── Semua ini WAJIB tidak terhitung ──
        // Jalur QA sudah lulus.
        $this->makeProject('QA Lulus', ProjectStatus::QA_PASSED, [
            'qa_assignee_id' => $this->dualAnalyst->id,
            'qa_status' => TrackStatus::PASSED->value,
        ]);
        // Jalur QA menunggu sign-off Lead (REVIEW) — bukan lagi beban pelaksana.
        $this->makeProject('QA Menunggu Sign-off', ProjectStatus::QA_IN_PROGRESS, [
            'qa_assignee_id' => $this->dualAnalyst->id,
            'qa_status' => TrackStatus::REVIEW->value,
        ]);
        // Proyek terminal — sudah berakhir walau kolom penugasan masih terisi.
        $this->makeProject('Sudah Live', ProjectStatus::LIVE_PRODUCTION, [
            'qa_assignee_id' => $this->dualAnalyst->id,
            'qa_status' => TrackStatus::IN_PROGRESS->value,
        ]);
        // Analisis sudah selesai (bukan lagi IN_REVIEW) — bukan beban analis.
        $this->makeProject('Analisis Selesai', ProjectStatus::ANALYSIS_APPROVED, [
            'analyst_id' => $this->dualAnalyst->id,
        ]);
        // Audit siber sudah lulus.
        $this->makeProject('Audit Lulus', ProjectStatus::CYBER_PASSED, [
            'cyber_assignee_id' => $this->pentester->id,
            'cyber_status' => TrackStatus::PASSED->value,
        ]);

        $response = $this->actingAs($this->pm)
            ->getJson('/api/v1/users/workload')
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $loadById = collect($response->json('data'))->keyBy('id');

        // 3 proyek aktif berbeda: analisis + QA + proyek rangkap (dihitung sekali).
        $this->assertSame(3, $loadById[$this->dualAnalyst->id]['active_load']);
        // 1 audit siber aktif.
        $this->assertSame(1, $loadById[$this->pentester->id]['active_load']);
        // Tanpa penugasan aktif: tidak muncul sama sekali.
        $this->assertFalse($loadById->has($this->idleAnalyst->id));
    }

    public function test_workload_requires_authentication(): void
    {
        $this->getJson('/api/v1/users/workload')->assertUnauthorized();
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function makeProject(string $title, ProjectStatus $status, array $overrides = []): Project
    {
        return Project::create(array_merge([
            'req_id' => Project::generateReqId(),
            'title' => $title,
            'created_by' => $this->pm->id,
            'pm_id' => $this->pm->id,
            'division_id' => $this->division->id,
            'status' => $status->value,
        ], $overrides));
    }

    private function makeUser(UserRole $role, string $name, string $email): User
    {
        $roleRow = $this->roles[$role->value] ??= Role::create([
            'name' => $role->value,
            'display_name' => $role->label(),
        ]);

        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $roleRow->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }
}
