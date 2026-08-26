<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Project;
use App\Models\ProjectStatusHistory;
use App\Models\ProjectTask;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Mengunci dua hal pada endpoint dasbor.
 *
 * 1. **Gerbangnya ada di server, bukan di router frontend.** `GET /dashboard/analytics`
 *    mengembalikan agregat lintas portofolio — distribusi status seluruh proyek, beban
 *    tiap developer, komposisi role tiap akun. Route frontend yang memakainya dijaga
 *    daftar role yang sama dengan middleware endpoint (`super_admin`, `head_of_it`),
 *    tetapi penjagaan router hanya menyembunyikan menu; endpointnya tetap dapat
 *    dipanggil langsung dengan token akun apa pun, jadi gerbang otoritatifnya server.
 *
 * 2. **Ringkasan dasbor memakai penyaring visibilitas yang sama dengan daftar proyek.**
 *    Selama `summary()` menyimpan salinan aturannya sendiri, salinan itu akan menyimpang
 *    — dan pernah menyimpang: role yang tidak tercantum menghitung seluruh portofolio,
 *    dan cabang `analyst` kehilangan pengelompokan `OR` sehingga angka per status
 *    tercampur.
 */
class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private Division $division;

    /** @var array<string, Role> */
    private array $roles = [];

    private User $superAdmin;

    private User $headOfIt;

    private User $pm;

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create([
            'code' => 'IT-DASH',
            'name' => 'Divisi Teknologi Informasi',
        ]);

        $this->superAdmin = $this->makeUser(UserRole::SUPER_ADMIN->value, 'Super Admin', 'admin-dash@nagari.co.id');
        $this->headOfIt = $this->makeUser(UserRole::HEAD_OF_IT->value, 'Head of IT', 'head-dash@nagari.co.id');
        $this->pm = $this->makeUser(UserRole::PROJECT_MANAGER->value, 'Analis Pengembangan', 'pm-dash@nagari.co.id');
    }

    public function test_analytics_open_to_super_admin_and_head_of_it_only(): void
    {
        $this->actingAs($this->superAdmin)
            ->getJson('/api/v1/dashboard/analytics')
            ->assertOk()
            ->assertJsonPath('status', 'success');

        // Keputusan tata kelola 26 Agustus 2026: Head of IT memegang pengawasan rilis
        // lintas portofolio, sehingga analitik SDLC (distribusi status, beban developer,
        // komposisi akun) kini termasuk wewenangnya.
        $this->actingAs($this->headOfIt)
            ->getJson('/api/v1/dashboard/analytics')
            ->assertOk()
            ->assertJsonPath('status', 'success');

        // Role lain tetap ditolak: angka ini agregat seluruh bank, bukan konsumsi umum.
        $businessUser = $this->makeUser(UserRole::BUSINESS_USER->value, 'Pemohon', 'pemohon-dash@nagari.co.id');

        $this->actingAs($businessUser)
            ->getJson('/api/v1/dashboard/analytics')
            ->assertStatus(403);
    }

    public function test_analytics_requires_authentication(): void
    {
        $this->getJson('/api/v1/dashboard/analytics')->assertStatus(401);
    }

    public function test_summary_counts_only_projects_the_user_may_see(): void
    {
        $otherPm = $this->makeUser(UserRole::PROJECT_MANAGER->value, 'PM Lain', 'pm-lain-dash@nagari.co.id');

        $this->makeProject('Proyek PM Ini', ['pm_id' => $this->pm->id]);
        $this->makeProject('Proyek PM Lain', ['pm_id' => $otherPm->id]);
        $this->makeProject('Proyek PM Lain Kedua', ['pm_id' => $otherPm->id]);

        $this->actingAs($this->pm)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.total_projects', 1);

        $this->actingAs($otherPm)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.total_projects', 2);

        $this->actingAs($this->superAdmin)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.total_projects', 3);
    }

    public function test_summary_status_counts_are_not_mixed_for_an_analyst(): void
    {
        $analyst = $this->makeUser(UserRole::ANALYST->value, 'Analis Sistem', 'analis-dash@nagari.co.id');

        // Proyek analis ini sudah masuk pengembangan, jadi tidak boleh terhitung
        // sebagai "pending". Versi lama menyusun `analyst_id = X OR (status IN (...)
        // AND status = 'PENDING')`, sehingga proyek ini tetap ikut terhitung.
        $this->makeProject('Proyek Analis', [
            'analyst_id' => $analyst->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);

        $response = $this->actingAs($analyst)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk();

        $response->assertJsonPath('data.total_projects', 1);
        $response->assertJsonPath('data.pending_projects', 0);
        $response->assertJsonPath('data.in_development', 1);
    }

    public function test_summary_closes_the_portfolio_for_an_unknown_role(): void
    {
        $strangeRole = $this->makeUser('peran_belum_terdaftar', 'Peran Baru', 'peran-dash@nagari.co.id');

        $this->makeProject('Proyek Rahasia', ['pm_id' => $this->pm->id]);

        $this->actingAs($strangeRole)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.total_projects', 0)
            ->assertJsonPath('data.total_tasks', 0);
    }

    public function test_summary_counts_tasks_only_from_visible_projects(): void
    {
        $otherPm = $this->makeUser(UserRole::PROJECT_MANAGER->value, 'PM Lain', 'pm-lain-task@nagari.co.id');

        $mine = $this->makeProject('Proyek Saya', ['pm_id' => $this->pm->id]);
        $theirs = $this->makeProject('Proyek Orang Lain', ['pm_id' => $otherPm->id]);

        ProjectTask::create(['project_id' => $mine->id, 'title' => 'Task saya']);
        ProjectTask::create(['project_id' => $theirs->id, 'title' => 'Task orang lain']);
        ProjectTask::create(['project_id' => $theirs->id, 'title' => 'Task orang lain kedua']);

        $this->actingAs($this->pm)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.total_tasks', 1);
    }

    public function test_summary_hides_the_account_total_from_roles_without_oversight(): void
    {
        $this->actingAs($this->pm)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.total_users', null);

        $this->actingAs($this->headOfIt)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.total_users', User::count());
    }

    public function test_status_distribution_is_keyed_by_the_status_string(): void
    {
        // `Project::$casts` memetakan `status` ke enum, sehingga
        // `Model::pluck('count', 'status')` menghasilkan kunci berupa objek enum dan
        // PHP menolaknya sebagai kunci array. Seluruh endpoint analitik melempar 500
        // begitu ada satu proyek; halaman analitik hanya bisa dimuat pada database
        // kosong, sehingga cacatnya tidak terlihat pada test yang tidak membuat proyek.
        $this->makeProject('Proyek Pending', ['pm_id' => $this->pm->id]);
        $this->makeProject('Proyek Pengembangan', [
            'pm_id' => $this->pm->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);
        $this->makeProject('Proyek Pengembangan Kedua', [
            'pm_id' => $this->pm->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);

        $distribution = $this->actingAs($this->superAdmin)
            ->getJson('/api/v1/dashboard/analytics')
            ->assertOk()
            ->json('data.status_distribution');

        $this->assertSame(
            [
                ProjectStatus::IN_DEVELOPMENT->value => 2,
                ProjectStatus::PENDING->value => 1,
            ],
            $distribution
        );
    }

    public function test_status_distribution_ignores_soft_deleted_projects(): void
    {
        $this->makeProject('Proyek Aktif', ['pm_id' => $this->pm->id]);
        $this->makeProject('Proyek Dihapus', ['pm_id' => $this->pm->id])->delete();

        $distribution = $this->actingAs($this->superAdmin)
            ->getJson('/api/v1/dashboard/analytics')
            ->assertOk()
            ->json('data.status_distribution');

        $this->assertSame([ProjectStatus::PENDING->value => 1], $distribution);
    }

    public function test_cycle_time_is_measured_from_the_status_history_not_the_updated_timestamp(): void
    {
        $project = $this->makeProject('Proyek Rilis', [
            'pm_id' => $this->pm->id,
            'status' => ProjectStatus::LIVE_PRODUCTION->value,
        ]);

        $project->created_at = now()->subDays(10);
        $project->save();

        $history = ProjectStatusHistory::create([
            'project_id' => $project->id,
            'from_status' => ProjectStatus::PENDING_GOLIVE->value,
            'to_status' => ProjectStatus::LIVE_PRODUCTION->value,
            'changed_by' => $this->headOfIt->id,
        ]);

        $history->created_at = now()->subDays(4);
        $history->save();

        // Penyuntingan sesudah rilis menggeser `projects.updated_at` ke hari ini.
        // Cycle time tetap harus 6 hari — jarak pengajuan ke rilis, bukan ke
        // penyuntingan terakhir.
        $project->touch();

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/v1/dashboard/analytics')
            ->assertOk();

        $this->assertEquals(6, $response->json('data.avg_cycle_time.value'));
    }

    public function test_release_trend_places_a_project_in_the_month_it_went_live(): void
    {
        $project = $this->makeProject('Proyek Rilis Bulan Ini', [
            'pm_id' => $this->pm->id,
            'status' => ProjectStatus::LIVE_PRODUCTION->value,
        ]);

        ProjectStatusHistory::create([
            'project_id' => $project->id,
            'from_status' => ProjectStatus::PENDING_GOLIVE->value,
            'to_status' => ProjectStatus::LIVE_PRODUCTION->value,
            'changed_by' => $this->headOfIt->id,
        ]);

        $trend = $this->actingAs($this->superAdmin)
            ->getJson('/api/v1/dashboard/analytics')
            ->assertOk()
            ->json('data.release_trend');

        $this->assertCount(6, $trend);
        $this->assertSame(now()->translatedFormat('M Y'), $trend[5]['month']);
        $this->assertSame(1, $trend[5]['value']);
        $this->assertSame(0, $trend[0]['value']);
    }

    public function test_bug_density_counts_a_failed_qa_track(): void
    {
        // `qa_status` pernah dibandingkan dengan 'REJECTED', nilai yang tidak ada pada
        // enum TrackStatus, sehingga metrik ini selalu 0.
        $this->makeProject('Proyek Gagal QA', [
            'pm_id' => $this->pm->id,
            'qa_status' => TrackStatus::FAILED->value,
        ]);
        $this->makeProject('Proyek Sehat', ['pm_id' => $this->pm->id]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/v1/dashboard/analytics')
            ->assertOk();

        $this->assertEquals(0.5, $response->json('data.bug_density.value'));
    }

    public function test_developer_workload_does_not_expose_email_addresses(): void
    {
        $developer = $this->makeUser(UserRole::DEVELOPER->value, 'Developer Satu', 'dev-dash@nagari.co.id');

        $workloads = $this->actingAs($this->superAdmin)
            ->getJson('/api/v1/dashboard/analytics')
            ->assertOk()
            ->json('data.developer_workloads');

        $this->assertCount(1, $workloads);
        $this->assertSame('Developer Satu', $workloads[0]['name']);
        $this->assertSame(0, $workloads[0]['workload']);
        $this->assertArrayNotHasKey('email', $workloads[0]);
        $this->assertNotNull($developer->email);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function makeProject(string $title, array $attributes = []): Project
    {
        return Project::create(array_merge([
            'req_id' => Project::generateReqId(),
            'title' => $title,
            'created_by' => $this->pm->id,
            'pm_id' => $this->pm->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ], $attributes));
    }

    private function makeUser(string $roleName, string $name, string $email): User
    {
        $role = $this->roles[$roleName] ??= Role::create([
            'name' => $roleName,
            'display_name' => $name,
        ]);

        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $role->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }
}
