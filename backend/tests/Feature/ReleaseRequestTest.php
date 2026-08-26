<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Project;
use App\Models\ReleaseRequest;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pengajuan migrasi & rilis produksi ke Grup Infrastruktur.
 *
 * Dua hal yang dikunci pengujian ini:
 *
 * 1. Gerbang go-live. Rilis hanya boleh diajukan setelah jalur Pengujian QA dan
 *    Audit Keamanan Siber keduanya lulus. Satu jalur lulus sendirian tidak cukup,
 *    meski bentuk transisinya (`QA_PASSED` menuju `PENDING_GOLIVE`) sah.
 * 2. Keutuhan transaksi. Baris `release_requests` dan perpindahan status adalah satu
 *    kesatuan; pengajuan yang ditolak tidak boleh meninggalkan baris yatim yang
 *    tetap tampil di antrean Quality Gate.
 */
class ReleaseRequestTest extends TestCase
{
    use RefreshDatabase;

    private Division $division;

    /**
     * @var array<string, Role>
     */
    private array $roles = [];

    private User $pm;

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create([
            'code' => 'IT-REL',
            'name' => 'Divisi Teknologi Informasi',
        ]);
        $this->pm = $this->makeUser(UserRole::PROJECT_MANAGER, 'Analis Pengembangan', 'pm-release@nagari.co.id');
    }

    public function test_release_request_is_recorded_and_moves_project_to_pending_golive(): void
    {
        $project = $this->makeProject('Proyek Siap Rilis', [
            'status' => ProjectStatus::CYBER_PASSED->value,
            'qa_status' => TrackStatus::PASSED->value,
            'cyber_status' => TrackStatus::PASSED->value,
        ]);
        $targetDate = now()->addDays(10)->format('Y-m-d');

        $this->actingAs($this->pm)->postJson('/api/v1/release-requests', [
            'project_id' => $project->id,
            'target_release_date' => $targetDate,
            'downtime_estimate' => '30 menit, pukul 23.00–23.30 WIB',
            'rollback_plan' => 'Kembalikan image versi sebelumnya dan restore dump basis data pra-rilis.',
            'notes' => 'Perlu pendampingan Grup Infrastruktur saat cutover.',
        ])->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.project_id', $project->id)
            ->assertJsonPath('data.target_release_date', $targetDate)
            // Ketiga bagian rencana rilis dipaparkan terpisah, bukan sebagai satu
            // teks gabungan berlabel.
            ->assertJsonPath('data.downtime_estimate', '30 menit, pukul 23.00–23.30 WIB')
            ->assertJsonPath('data.rollback_plan', 'Kembalikan image versi sebelumnya dan restore dump basis data pra-rilis.')
            ->assertJsonPath('data.notes', 'Perlu pendampingan Grup Infrastruktur saat cutover.')
            ->assertJsonPath('data.head_of_it_approval', false)
            ->assertJsonPath('data.is_pending', true);

        $this->assertSame(ProjectStatus::PENDING_GOLIVE, $project->fresh()->status);
        $this->assertDatabaseHas('release_requests', [
            'project_id' => $project->id,
            'requested_by' => $this->pm->id,
            'downtime_estimate' => '30 menit, pukul 23.00–23.30 WIB',
            'head_of_it_approval' => false,
        ]);
        $this->assertDatabaseHas('project_status_histories', [
            'project_id' => $project->id,
            'to_status' => ProjectStatus::PENDING_GOLIVE->value,
        ]);
    }

    public function test_blank_release_plan_fields_are_stored_as_null(): void
    {
        $project = $this->makeProject('Proyek Rencana Rilis Kosong', [
            'status' => ProjectStatus::QA_PASSED->value,
            'qa_status' => TrackStatus::PASSED->value,
            'cyber_status' => TrackStatus::PASSED->value,
        ]);

        $this->actingAs($this->pm)->postJson('/api/v1/release-requests', [
            'project_id' => $project->id,
            'target_release_date' => now()->addDays(5)->format('Y-m-d'),
            'downtime_estimate' => '   ',
            'rollback_plan' => '',
        ])->assertCreated()
            ->assertJsonPath('data.downtime_estimate', null)
            ->assertJsonPath('data.rollback_plan', null)
            ->assertJsonPath('data.notes', null);

        // Kolom berisi spasi tidak boleh terhitung sebagai rencana rilis yang sudah
        // terisi saat kelengkapannya diperiksa.
        $this->assertNull(ReleaseRequest::where('project_id', $project->id)->value('downtime_estimate'));
    }

    public function test_release_cannot_be_requested_while_a_testing_track_has_not_passed(): void
    {
        $project = $this->makeProject('Proyek Siber Belum Lulus', [
            'status' => ProjectStatus::QA_PASSED->value,
            'qa_status' => TrackStatus::PASSED->value,
            'cyber_status' => TrackStatus::IN_PROGRESS->value,
        ]);

        $this->actingAs($this->pm)->postJson('/api/v1/release-requests', [
            'project_id' => $project->id,
            'target_release_date' => now()->addDays(7)->format('Y-m-d'),
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertSame(ProjectStatus::QA_PASSED, $project->fresh()->status);
        // Inti pengujian ini: penolakan transisi ikut membatalkan baris pengajuan,
        // sehingga antrean Quality Gate tidak menerima rilis yatim.
        $this->assertDatabaseMissing('release_requests', ['project_id' => $project->id]);
    }

    public function test_project_still_in_development_cannot_request_release(): void
    {
        $project = $this->makeProject('Proyek Masih Dikembangkan', [
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);

        $this->actingAs($this->pm)->postJson('/api/v1/release-requests', [
            'project_id' => $project->id,
            'target_release_date' => now()->addDays(7)->format('Y-m-d'),
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertSame(ProjectStatus::IN_DEVELOPMENT, $project->fresh()->status);
        $this->assertDatabaseMissing('release_requests', ['project_id' => $project->id]);
    }

    public function test_only_the_assigned_project_manager_may_request_release(): void
    {
        $project = $this->makeProject('Proyek PM Lain', [
            'status' => ProjectStatus::CYBER_PASSED->value,
            'qa_status' => TrackStatus::PASSED->value,
            'cyber_status' => TrackStatus::PASSED->value,
        ]);
        $qaLead = $this->makeUser(UserRole::QA_LEAD, 'QA Lead', 'qa-lead-release@nagari.co.id');
        $otherPm = $this->makeUser(UserRole::PROJECT_MANAGER, 'Analis Pengembangan Lain', 'pm-lain-release@nagari.co.id');

        foreach ([$qaLead, $otherPm] as $actor) {
            $this->actingAs($actor)->postJson('/api/v1/release-requests', [
                'project_id' => $project->id,
                'target_release_date' => now()->addDays(7)->format('Y-m-d'),
            ])->assertStatus(422)
                ->assertJsonPath('status', 'error');
        }

        $this->assertSame(ProjectStatus::CYBER_PASSED, $project->fresh()->status);
        $this->assertDatabaseMissing('release_requests', ['project_id' => $project->id]);
    }

    public function test_target_release_date_is_required(): void
    {
        $project = $this->makeProject('Proyek Tanpa Tanggal Rilis', [
            'status' => ProjectStatus::CYBER_PASSED->value,
            'qa_status' => TrackStatus::PASSED->value,
            'cyber_status' => TrackStatus::PASSED->value,
        ]);

        $this->actingAs($this->pm)->postJson('/api/v1/release-requests', [
            'project_id' => $project->id,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['target_release_date']);
    }

    public function test_release_list_only_shows_requests_of_visible_projects(): void
    {
        $ownProject = $this->makeProject('Proyek Rilis Sendiri', [
            'status' => ProjectStatus::CYBER_PASSED->value,
            'qa_status' => TrackStatus::PASSED->value,
            'cyber_status' => TrackStatus::PASSED->value,
        ]);
        $otherPm = $this->makeUser(UserRole::PROJECT_MANAGER, 'Analis Pengembangan Lain', 'pm-lain-list@nagari.co.id');
        $otherProject = $this->makeProject('Proyek Rilis PM Lain', [
            'status' => ProjectStatus::CYBER_PASSED->value,
            'qa_status' => TrackStatus::PASSED->value,
            'cyber_status' => TrackStatus::PASSED->value,
            'created_by' => $otherPm->id,
            'pm_id' => $otherPm->id,
        ]);

        foreach ([[$this->pm, $ownProject], [$otherPm, $otherProject]] as [$actor, $project]) {
            $this->actingAs($actor)->postJson('/api/v1/release-requests', [
                'project_id' => $project->id,
                'target_release_date' => now()->addDays(7)->format('Y-m-d'),
            ])->assertCreated();
        }

        // Rencana rilis dan estimasi downtime seluruh portofolio bukan bacaan umum:
        // masing-masing PM hanya melihat pengajuan pada proyek yang dipegangnya.
        $this->actingAs($this->pm)->getJson('/api/v1/release-requests')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.project_id', $ownProject->id);

        $this->actingAs($otherPm)->getJson('/api/v1/release-requests')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.project_id', $otherProject->id);

        $admin = $this->makeUser(UserRole::SUPER_ADMIN, 'Super Admin', 'admin-release@nagari.co.id');
        $this->actingAs($admin)->getJson('/api/v1/release-requests')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    private function makeProject(string $title, array $attributes = []): Project
    {
        return Project::create(array_merge([
            'req_id' => Project::generateReqId(),
            'title' => $title,
            'created_by' => $this->pm->id,
            'pm_id' => $this->pm->id,
            'division_id' => $this->division->id,
        ], $attributes));
    }

    /**
     * Buat pengguna beserta rolenya, dengan role dibuat sekali per kelas pengujian
     * karena `roles.name` bersifat UNIQUE.
     */
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
