<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Inbox personal persetujuan SIT — `GET /api/v1/me/sit-approvals`.
 *
 * Persetujuan SIT tidak memiliki tabel sendiri: keputusannya tersimpan sebagai JSON
 * pada `projects.sit_uat_data['sit3_approvals']`. Karena itu tidak ada baris yang bisa
 * dikueri langsung sebagai "tugas approval saya", dan `SitApprovalService` harus
 * menyusun daftarnya dari status proyek, cakupan visibilitas, serta slot approval per
 * role. Pengujian di sini menjaga tiga hal yang paling mudah bergeser: siapa yang
 * masuk daftar, kapan sebuah proyek belum layak masuk daftar, dan apakah keputusan
 * yang sudah diambil benar-benar hilang dari hitungan pekerjaan tersisa.
 */
class SitApprovalInboxTest extends TestCase
{
    use RefreshDatabase;

    private Division $division;

    private User $admin;

    private User $pm;

    private User $developer;

    private User $developmentLead;

    private User $qaTester;

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create(['code' => 'IT-DEV', 'name' => 'Divisi Pengembangan TI']);
        $this->admin = $this->makeUser(UserRole::SUPER_ADMIN->value, 'Super Admin', 'admin-sit@nagari.co.id');
        $this->pm = $this->makeUser(UserRole::PROJECT_MANAGER->value, 'Analis Pengembangan', 'pm-sit@nagari.co.id');
        $this->developer = $this->makeUser(UserRole::DEVELOPER->value, 'Developer SIT', 'developer-sit@nagari.co.id');
        $this->developmentLead = $this->makeUser(UserRole::DEVELOPMENT_LEAD->value, 'Pimpinan Grup', 'lead-sit@nagari.co.id');
        $this->qaTester = $this->makeUser(UserRole::QA_TESTER->value, 'QA Tester', 'qa-sit@nagari.co.id');
    }

    public function test_developer_pm_and_development_lead_each_see_their_own_sit_slot(): void
    {
        $project = $this->makeSitProject();

        $developerInbox = $this->actingAs($this->developer)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->json('data');

        $this->assertSame(1, $developerInbox['pending_count']);
        $this->assertCount(1, $developerInbox['items']);
        $this->assertSame("sit-{$project->id}-developer", $developerInbox['items'][0]['id']);
        $this->assertSame('sit', $developerInbox['items'][0]['kind']);
        $this->assertSame('pending', $developerInbox['items'][0]['status']);
        // Persetujuan SIT tidak punya jalur penolakan; temuan dicatat per task di Tahap 2.
        $this->assertFalse($developerInbox['items'][0]['can_reject']);
        $this->assertSame($project->req_id, $developerInbox['items'][0]['project']['req_id']);

        $pmInbox = $this->actingAs($this->pm)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->json('data');
        $this->assertSame(['pm'], collect($pmInbox['items'])->pluck('approval_role')->all());

        $leadInbox = $this->actingAs($this->developmentLead)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->json('data');
        $this->assertSame(['development_lead'], collect($leadInbox['items'])->pluck('approval_role')->all());
    }

    public function test_role_without_sit_slot_gets_an_empty_inbox_instead_of_an_error(): void
    {
        $this->makeSitProject();

        // QA Tester tidak memegang slot approval SIT. Endpoint tetap membalas 200 supaya
        // frontend dapat memanggilnya tanpa syarat, dan lencana sidebar tetap 0.
        $this->actingAs($this->qaTester)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->assertJsonPath('data.pending_count', 0)
            ->assertJsonPath('data.items', []);
    }

    public function test_inbox_summary_counts_task_approvals_across_every_key_form(): void
    {
        $project = $this->makeSitProject();
        $tasks = $project->tasks()->orderBy('id')->get();

        // Tiga bentuk kunci `sit2_task_approvals` sama-sama sudah tersimpan di produksi:
        // integer, string angka, dan berawalan `task_`. Ringkasan inbox wajib membaca
        // ketiganya, sama seperti gerbang SIT ulang di `ProjectWorkflowService`.
        $project->update([
            'sit_uat_data' => [
                ...$project->sit_uat_data,
                'sit2_task_approvals' => [
                    (string) $tasks[0]->id => ['approved' => true],
                    'task_'.$tasks[1]->id => ['approved' => true, 'comment' => 'Masih ada defect kecil.'],
                ],
            ],
        ]);

        $summary = $this->actingAs($this->pm)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->json('data.items.0.summary');

        $this->assertSame(3, $summary['totalTask']);
        $this->assertSame(2, $summary['approvedTask']);
        $this->assertSame(1, $summary['defectTask']);
        $this->assertSame('full', $summary['scopeMode']);
        $this->assertSame(1, $summary['developerRequired']);
        $this->assertSame(0, $summary['developerApproved']);
        $this->assertFalse($summary['pmApproved']);
        $this->assertFalse($summary['developmentLeadApproved']);
    }

    public function test_project_before_sit_stage_three_is_not_listed(): void
    {
        $project = $this->makeSitProject();
        $project->update(['sit_uat_data' => [...$project->sit_uat_data, 'activeSitStep' => 2]]);

        $this->actingAs($this->developer)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->assertJsonPath('data.pending_count', 0)
            ->assertJsonPath('data.items', []);
    }

    public function test_project_outside_the_sit_statuses_is_not_listed(): void
    {
        $project = $this->makeSitProject();
        $project->update(['status' => ProjectStatus::IN_DEVELOPMENT->value]);

        $this->actingAs($this->developer)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->assertJsonPath('data.items', []);
    }

    public function test_own_decision_moves_the_item_out_of_the_pending_count(): void
    {
        $project = $this->makeSitProject();

        $this->actingAs($this->developer)
            ->postJson("/api/v1/projects/{$project->id}/sit-approval", ['note' => 'Hasil SIT sesuai.'])
            ->assertOk();

        $inbox = $this->actingAs($this->developer)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->json('data');

        $this->assertSame(0, $inbox['pending_count']);
        $this->assertCount(1, $inbox['items']);
        $this->assertSame('approved', $inbox['items'][0]['status']);
        $this->assertSame('Hasil SIT sesuai.', $inbox['items'][0]['decision_note']);
        $this->assertNotNull($inbox['items'][0]['decided_at']);
        $this->assertSame(1, $inbox['items'][0]['summary']['developerApproved']);
    }

    public function test_developer_outside_the_project_sees_nothing(): void
    {
        $this->makeSitProject();
        $outsider = $this->makeUser(UserRole::DEVELOPER->value, 'Developer Lain', 'developer-lain-sit@nagari.co.id');

        $this->actingAs($outsider)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->assertJsonPath('data.items', []);
    }

    public function test_pm_of_another_project_is_not_offered_the_pm_slot(): void
    {
        $this->makeSitProject();
        $otherPm = $this->makeUser(UserRole::PROJECT_MANAGER->value, 'Analis Lain', 'pm-lain-sit@nagari.co.id');

        $this->actingAs($otherPm)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->assertJsonPath('data.items', []);
    }

    private function makeSitProject(): Project
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Persetujuan SIT',
            'description' => 'Pengujian inbox persetujuan SIT.',
            'created_by' => $this->admin->id,
            'pm_id' => $this->pm->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            'sit_uat_data' => [
                'activeSitStep' => 3,
                'sit2_submitted_at' => now()->toIso8601String(),
            ],
        ]);

        $project->teamMembers()->create([
            'user_id' => $this->developer->id,
            'role_in_project' => 'Backend',
            'assigned_by' => $this->admin->id,
        ]);

        foreach (['Perbaikan validasi', 'Penyesuaian laporan', 'Penataan menu'] as $title) {
            ProjectTask::create([
                'project_id' => $project->id,
                'title' => $title,
                'status' => TaskStatus::DONE->value,
                'assignee_id' => $this->developer->id,
            ]);
        }

        return $project->fresh();
    }

    private function makeUser(string $roleName, string $name, string $email): User
    {
        $role = Role::firstOrCreate(['name' => $roleName], ['display_name' => $name]);

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
