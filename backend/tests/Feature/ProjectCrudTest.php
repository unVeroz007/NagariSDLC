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

class ProjectCrudTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $businessUser;
    protected Division $division;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create(['name' => UserRole::SUPER_ADMIN->value, 'display_name' => 'Super Admin']);
        $businessRole = Role::create(['name' => UserRole::BUSINESS_USER->value, 'display_name' => 'Business User']);
        $this->division = Division::create(['code' => 'IT', 'name' => 'Divisi TI']);

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $this->businessUser = User::create([
            'name' => 'Business User',
            'email' => 'business@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $businessRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }

    public function test_create_project()
    {
        $response = $this->actingAs($this->admin)->postJson('/api/v1/projects', [
            'title' => 'Proyek Baru',
            'description' => 'Deskripsi proyek',
            'division_id' => $this->division->id,
            'target_date' => now()->addDays(30)->format('Y-m-d'),
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'PENDING');
    }

    public function test_list_projects()
    {
        Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Tes',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ]);

        $response = $this->actingAs($this->admin)->getJson('/api/v1/projects');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }

    public function test_update_project()
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Lama',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ]);

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'title' => 'Proyek Baru Updated',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }

    /**
     * Prioritas pilihan pengaju tersimpan pada baris proyek.
     *
     * Sebelum kolom `projects.priority` ada, nilai ini dikirim form inisiasi tetapi
     * tidak pernah divalidasi maupun ditulis, sehingga setiap proyek tampil dengan
     * prioritas terendah di layar Lead.
     */
    public function test_create_project_saves_priority()
    {
        $response = $this->actingAs($this->admin)->postJson('/api/v1/projects', [
            'title' => 'Proyek Prioritas',
            'division_id' => $this->division->id,
            'priority' => 'High',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.priority', 'High');

        $this->assertDatabaseHas('projects', [
            'title' => 'Proyek Prioritas',
            'priority' => 'High',
        ]);
    }

    /**
     * Label prioritas versi lama tetap diterima dan dipetakan ke nilai kanonis.
     *
     * Form inisiasi pernah mengirim `Rendah|Medium|Urgent` sementara seluruh layar
     * pembaca membandingkan dengan `High|Medium|Low`. Klien versi lama tidak boleh
     * ditolak validasi hanya karena memakai label lamanya.
     */
    public function test_create_project_maps_legacy_priority_labels()
    {
        $this->actingAs($this->admin)->postJson('/api/v1/projects', [
            'title' => 'Proyek Urgent',
            'division_id' => $this->division->id,
            'priority' => 'Urgent',
        ])->assertStatus(201)->assertJsonPath('data.priority', 'High');

        $this->actingAs($this->admin)->postJson('/api/v1/projects', [
            'title' => 'Proyek Rendah',
            'division_id' => $this->division->id,
            'priority' => 'Rendah',
        ])->assertStatus(201)->assertJsonPath('data.priority', 'Low');
    }

    public function test_create_project_rejects_unknown_priority()
    {
        $this->actingAs($this->admin)->postJson('/api/v1/projects', [
            'title' => 'Proyek Prioritas Ngawur',
            'division_id' => $this->division->id,
            'priority' => 'Sangat Sangat Penting',
        ])->assertStatus(422)->assertJsonValidationErrors('priority');
    }

    /**
     * Pengajuan tanpa prioritas tetap sah dan memakai nilai bawaan.
     */
    public function test_create_project_defaults_priority_to_medium()
    {
        $this->actingAs($this->admin)->postJson('/api/v1/projects', [
            'title' => 'Proyek Tanpa Prioritas',
            'division_id' => $this->division->id,
        ])->assertStatus(201)->assertJsonPath('data.priority', 'Medium');
    }

    public function test_create_project_saves_contact_phone()
    {
        $response = $this->actingAs($this->admin)->postJson('/api/v1/projects', [
            'title' => 'Proyek Kontak',
            'description' => 'Deskripsi',
            'contact_phone' => '081234567890',
            'division_id' => $this->division->id,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.contact_phone', '081234567890');

        $this->assertDatabaseHas('projects', [
            'title' => 'Proyek Kontak',
            'contact_phone' => '081234567890',
        ]);
    }

    public function test_update_project_saves_contact_phone()
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Kontak Update',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ]);

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'contact_phone' => '082211223344',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.contact_phone', '082211223344');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'contact_phone' => '082211223344',
        ]);
    }

    public function test_update_project_saves_deadline()
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Deadline',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ]);

        $deadline = now()->addDays(7)->format('Y-m-d');

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'deadline' => $deadline,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.current_stage_deadline', $deadline)
            ->assertJsonPath('data.deadline', $deadline);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'current_stage_deadline' => $deadline . ' 00:00:00',
        ]);
    }

    public function test_update_project_saves_team_allocated_by_pm()
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Alokasi PM',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'team_allocated_by_pm' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.team_allocated_by_pm', true);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'team_allocated_by_pm' => 1,
        ]);
    }

    public function test_update_project_saves_sit_uat_data_via_camel_case_key()
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek SIT UAT',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);

        $sitData = [
            'activeSitStep' => 2,
            'sit2_task_approvals' => [
                10 => ['approved' => true, 'comment' => 'Lolos', 'attachments' => [['id' => 'a1', 'name' => 'bukti.png']]],
            ],
        ];

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'sitUatData' => $sitData,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
        ]);

        $fresh = $project->fresh();
        $this->assertEquals(2, $fresh->sit_uat_data['activeSitStep']);
        $this->assertTrue($fresh->sit_uat_data['sit2_task_approvals'][10]['approved']);
        $this->assertEquals('bukti.png', $fresh->sit_uat_data['sit2_task_approvals'][10]['attachments'][0]['name']);
    }

    public function test_sit_task_approvals_are_frozen_after_sit_passed()
    {
        // Berita acara SIT sudah final begitu proyek melewati SIT. Kiriman PATCH yang
        // mencoba mengubah `sit2_task_approvals` pada status pasca-SIT harus diabaikan,
        // menyisakan bukti yang tersimpan apa adanya.
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek SIT Beku',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::SIT_PASSED->value,
            'sit_uat_data' => [
                'activeSitStep' => 3,
                'sit2_task_approvals' => [
                    'task_10' => ['approved' => true, 'comment' => 'Lolos final', 'attachments' => []],
                ],
            ],
        ]);

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'sitUatData' => [
                'sit2_task_approvals' => [
                    'task_10' => ['approved' => false, 'comment' => 'Diubah setelah beku', 'attachments' => []],
                ],
            ],
        ]);

        $response->assertStatus(200)->assertJsonPath('status', 'success');

        // Nilai tersimpan dipertahankan, bukan nilai kiriman.
        $fresh = $project->fresh();
        $this->assertTrue($fresh->sit_uat_data['sit2_task_approvals']['task_10']['approved']);
        $this->assertEquals('Lolos final', $fresh->sit_uat_data['sit2_task_approvals']['task_10']['comment']);
    }

    public function test_sit_task_approvals_writable_during_sit_in_progress()
    {
        // Selama SIT masih berjalan, layar Eksekusi SIT sah menulis persetujuan task.
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek SIT Berjalan',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            'sit_uat_data' => [
                'activeSitStep' => 2,
                'sit2_task_approvals' => [
                    'task_10' => ['approved' => false, 'comment' => '', 'attachments' => []],
                ],
            ],
        ]);

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'sitUatData' => [
                'sit2_task_approvals' => [
                    'task_10' => ['approved' => true, 'comment' => 'Lolos SIT', 'attachments' => []],
                ],
            ],
        ]);

        $response->assertStatus(200)->assertJsonPath('status', 'success');

        $fresh = $project->fresh();
        $this->assertTrue($fresh->sit_uat_data['sit2_task_approvals']['task_10']['approved']);
        $this->assertEquals('Lolos SIT', $fresh->sit_uat_data['sit2_task_approvals']['task_10']['comment']);
    }

    public function test_pm_sees_only_projects_they_manage_in_development()
    {
        $pmRole = Role::create(['name' => UserRole::PROJECT_MANAGER->value, 'display_name' => 'Project Manager']);
        $pm = User::create([
            'name' => 'Andi Wijaya',
            'email' => 'pmtest@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $pmRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $managedProject = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Dikelola PM',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
            'pm_id' => $pm->id,
        ]);

        $otherProject = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Orang Lain',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);

        $response = $this->actingAs($pm)->getJson('/api/v1/projects');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Proyek Dikelola PM', $titles);
        $this->assertNotContains('Proyek Orang Lain', $titles);
    }

    public function test_delete_project_admin()
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Hapus',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ]);

        $response = $this->actingAs($this->admin)->deleteJson("/api/v1/projects/{$project->id}");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }

    public function test_cannot_delete_project_business_user()
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Tes',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ]);

        $response = $this->actingAs($this->businessUser)->deleteJson("/api/v1/projects/{$project->id}");

        $response->assertStatus(403);
    }

    public function test_any_authenticated_user_can_read_users_list()
    {
        // Non-admin (business user) harus tetap bisa membaca daftar users
        // (dipakai dropdown assignee/developer/PM di banyak halaman)
        $response = $this->actingAs($this->businessUser)->getJson('/api/v1/users');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }

    public function test_business_user_cannot_create_user()
    {
        $response = $this->actingAs($this->businessUser)->postJson('/api/v1/users', [
            'name' => 'Hacker',
            'email' => 'hacker@nagari.co.id',
            'password' => 'password123',
        ]);

        $response->assertStatus(403);
    }

    public function test_analyst_sees_sit_project_they_are_assigned_to()
    {
        $analystRole = Role::create(['name' => UserRole::ANALYST->value, 'display_name' => 'System Analyst']);
        $analyst = User::create([
            'name' => 'Analis SIT',
            'email' => 'analissit@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $analystRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $sitProject = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek SIT Analyst',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            'analyst_id' => $analyst->id,
        ]);

        $otherProject = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek SIT Bukan Analyst',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ]);

        $response = $this->actingAs($analyst)->getJson('/api/v1/projects');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Proyek SIT Analyst', $titles);
        $this->assertNotContains('Proyek SIT Bukan Analyst', $titles);
    }

    public function test_developer_sees_sit_project_where_they_are_assignee()
    {
        $dev = $this->makeDeveloperForTest('Dev SIT', 'devsit@nagari.co.id');
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek SIT Dev',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ]);
        $project->teamMembers()->create(['user_id' => $dev->id, 'role_in_project' => 'Backend']);
        \App\Models\ProjectTask::create([
            'project_id' => $project->id,
            'title' => 'Task SIT Dev',
            'assignee_id' => $dev->id,
            'status' => 'done',
        ]);

        $response = $this->actingAs($dev)->getJson('/api/v1/projects');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Proyek SIT Dev', $titles);
    }

    protected function makeDeveloperForTest(string $name, string $email): User
    {
        $devRole = Role::create(['name' => UserRole::DEVELOPER->value, 'display_name' => 'Developer']);
        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $devRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }
}
