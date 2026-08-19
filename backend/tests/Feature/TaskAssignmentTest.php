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

class TaskAssignmentTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Division $division;
    protected Role $developerRole;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create([
            'name' => UserRole::SUPER_ADMIN->value,
            'display_name' => 'Super Admin',
        ]);

        $this->developerRole = Role::create([
            'name' => UserRole::DEVELOPER->value,
            'display_name' => 'Developer',
        ]);

        $this->division = Division::create([
            'code' => 'IT-DEV',
            'name' => 'Divisi Pengembangan TI',
        ]);

        $this->admin = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }

    protected function makeDeveloper(string $name, string $email): User
    {
        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $this->developerRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }

    protected function makeProject(): Project
    {
        return Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Task Assignment',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);
    }

    public function test_task_can_be_assigned_to_project_team_member()
    {
        $project = $this->makeProject();
        $dev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');

        $project->teamMembers()->create([
            'user_id' => $dev->id,
            'role_in_project' => 'Backend',
        ]);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Setup Environment',
            'description' => 'Siapkan environment dev',
            'assignee_id' => $dev->id,
            'due_date' => now()->addDays(5)->format('Y-m-d'),
            'priority' => 'High',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.assignee.name', 'Dimas Anggara');

        $this->assertDatabaseHas('project_tasks', [
            'project_id' => $project->id,
            'assignee_id' => $dev->id,
            'priority' => 'High',
        ]);
    }

    public function test_task_assignment_to_non_team_member_is_rejected()
    {
        $project = $this->makeProject();
        $teamDev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');
        $outsider = $this->makeDeveloper('Eka Putri', 'dev2@nagari.co.id');

        // Hanya Dimas yang masuk tim proyek
        $project->teamMembers()->create([
            'user_id' => $teamDev->id,
            'role_in_project' => 'Backend',
        ]);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Integrasi API',
            'assignee_id' => $outsider->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseMissing('project_tasks', [
            'project_id' => $project->id,
            'assignee_id' => $outsider->id,
        ]);
    }

    public function test_task_update_assignee_to_non_member_is_rejected()
    {
        $project = $this->makeProject();
        $teamDev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');
        $outsider = $this->makeDeveloper('Eka Putri', 'dev2@nagari.co.id');

        $project->teamMembers()->create([
            'user_id' => $teamDev->id,
            'role_in_project' => 'Backend',
        ]);

        $task = ProjectTask::create([
            'project_id' => $project->id,
            'title' => 'Task Awal',
            'assignee_id' => $teamDev->id,
            'status' => TaskStatus::TODO,
        ]);

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/tasks/{$task->id}", [
            'assignee_id' => $outsider->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('status', 'error');
    }

    public function test_task_can_be_assigned_to_project_manager()
    {
        $pmRole = Role::create([
            'name' => UserRole::PROJECT_MANAGER->value,
            'display_name' => 'Project Manager',
        ]);

        $pm = User::create([
            'name' => 'Andi Wijaya',
            'email' => 'pm@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $pmRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $project = $this->makeProject();
        $project->update(['pm_id' => $pm->id]);

        // PM bukan anggota teamMembers, tapi boleh di-assign karena dia PM proyek ini
        $response = $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Review Rencana Rilis',
            'assignee_id' => $pm->id,
            'priority' => 'High',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.assignee.name', 'Andi Wijaya');

        $this->assertDatabaseHas('project_tasks', [
            'project_id' => $project->id,
            'assignee_id' => $pm->id,
        ]);
    }

    public function test_task_can_be_assigned_to_project_analyst()
    {
        $analystRole = Role::create([
            'name' => UserRole::ANALYST->value,
            'display_name' => 'System Analyst',
        ]);

        $analyst = User::create([
            'name' => 'Ahmad Fauzi',
            'email' => 'analyst4@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $analystRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $project = $this->makeProject();
        $project->update(['analyst_id' => $analyst->id]);

        // Analyst boleh di-assign (fleksibel) meskipun bukan anggota teamMembers
        $response = $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Validasi FSD Lanjutan',
            'assignee_id' => $analyst->id,
            'priority' => 'Medium',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.assignee.name', 'Ahmad Fauzi');

        $this->assertDatabaseHas('project_tasks', [
            'project_id' => $project->id,
            'assignee_id' => $analyst->id,
        ]);
    }

    public function test_task_create_records_activity_log_with_project_metadata()
    {
        $project = $this->makeProject();
        $dev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');

        $project->teamMembers()->create([
            'user_id' => $dev->id,
            'role_in_project' => 'Backend',
        ]);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Setup Env',
            'assignee_id' => $dev->id,
        ])->assertStatus(201);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'create_task',
            'subject_type' => ProjectTask::class,
        ]);
    }

    public function test_activity_logs_filtered_by_project_id()
    {
        $project = $this->makeProject();
        $dev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $dev->id, 'role_in_project' => 'Backend']);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Setup Env',
            'assignee_id' => $dev->id,
        ])->assertStatus(201);

        $response = $this->actingAs($this->admin)->getJson("/api/v1/activity-logs?project_id={$project->id}");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $titles = collect($response->json('data'))->pluck('description')->all();
        $this->assertNotEmpty($titles);
        $this->assertStringContainsString('Setup Env', $titles[0]);
    }

    public function test_sit_gate_blocks_when_task_incomplete()
    {
        $project = $this->makeProject();
        $dev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $dev->id, 'role_in_project' => 'Backend']);

        // Task belum selesai (todo) → SIT harus terblokir
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task Belum Selesai',
            'assignee_id' => $dev->id,
        ])->assertStatus(201);

        $response = $this->actingAs($this->admin)->getJson("/api/v1/projects/{$project->id}/sit-gate");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.can_start_sit', false)
            ->assertJsonPath('data.done_task', 0)
            ->assertJsonPath('data.total_task', 1);
    }

    public function test_sit_gate_allows_when_all_tasks_done_and_ignores_take_down()
    {
        $project = $this->makeProject();
        $dev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $dev->id, 'role_in_project' => 'Backend']);

        // Task 1 selesai
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task Done',
            'assignee_id' => $dev->id,
            'status' => 'done',
        ])->assertStatus(201);

        // Task 2 TAKE DOWN → diabaikan (tidak menghalangi SIT)
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task Take Down',
            'assignee_id' => $dev->id,
            'status' => 'take_down',
        ])->assertStatus(201);

        $response = $this->actingAs($this->admin)->getJson("/api/v1/projects/{$project->id}/sit-gate");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.can_start_sit', true)
            ->assertJsonPath('data.total_task', 1)
            ->assertJsonPath('data.done_task', 1)
            ->assertJsonPath('data.take_down_task', 1);
    }

    public function test_request_revision_moves_task_back_and_saves_note()
    {
        $project = $this->makeProject();
        $dev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $dev->id, 'role_in_project' => 'Backend']);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task Awal',
            'assignee_id' => $dev->id,
            'status' => 'done',
        ])->assertStatus(201);

        $task = ProjectTask::where('project_id', $project->id)->first();

        $response = $this->actingAs($this->admin)->postJson("/api/v1/tasks/{$task->id}/request-revision", [
            'revision_note' => 'Perbaiki logic validasi tanggal.',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.revision_note', 'Perbaiki logic validasi tanggal.');

        $this->assertDatabaseHas('project_tasks', [
            'id' => $task->id,
            'status' => 'in_progress',
            'revision_note' => 'Perbaiki logic validasi tanggal.',
        ]);
    }

    public function test_completing_task_clears_revision_note()
    {
        $project = $this->makeProject();
        $dev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $dev->id, 'role_in_project' => 'Backend']);

        // Task selesai, lalu direvisi (mundur ke in_progress + catatan revisi)
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task Revisi',
            'assignee_id' => $dev->id,
            'status' => 'done',
        ])->assertStatus(201);

        $task = ProjectTask::where('project_id', $project->id)->first();
        $this->actingAs($this->admin)->postJson("/api/v1/tasks/{$task->id}/request-revision", [
            'revision_note' => 'Perbaiki validasi tanggal.',
        ])->assertStatus(200);

        // Developer menyelesaikan task → status done → revision_note harus bersih
        $this->actingAs($this->admin)->patchJson("/api/v1/tasks/{$task->id}", [
            'status' => 'done',
        ])->assertStatus(200);

        $this->assertDatabaseHas('project_tasks', [
            'id' => $task->id,
            'status' => 'done',
            'revision_note' => null,
            'revision_requested_at' => null,
            'revision_requested_by' => null,
        ]);

        // Dokumentasi: revisi selesai tercatat
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'task_revision_completed',
            'subject_type' => ProjectTask::class,
            'subject_id' => $task->id,
        ]);
    }

    public function test_activity_logs_filtered_by_task_id()
    {
        $project = $this->makeProject();
        $dev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $dev->id, 'role_in_project' => 'Backend']);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task A',
            'assignee_id' => $dev->id,
        ])->assertStatus(201);

        $task = ProjectTask::where('project_id', $project->id)->first();

        // Lakukan revisi agar tercatat aktivitas request_task_revision
        $this->actingAs($this->admin)->postJson("/api/v1/tasks/{$task->id}/request-revision", [
            'revision_note' => 'Perbaiki validasi.',
        ])->assertStatus(200);

        $response = $this->actingAs($this->admin)->getJson("/api/v1/activity-logs?task_id={$task->id}");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $actions = collect($response->json('data'))->pluck('action')->all();
        $this->assertNotEmpty($actions);
        $this->assertContains('request_task_revision', $actions);
        $this->assertContains('create_task', $actions);
    }

    public function test_sit_approval_by_developer()
    {
        $project = $this->makeProject();
        $project->update(['status' => ProjectStatus::SIT_IN_PROGRESS->value]);
        $dev = $this->makeDeveloper('Dimas Anggara', 'dev1@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $dev->id, 'role_in_project' => 'Backend']);

        // Dev harus menjadi assignee minimal 1 task
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task SIT',
            'assignee_id' => $dev->id,
            'status' => 'done',
        ])->assertStatus(201);

        $response = $this->actingAs($dev)->postJson("/api/v1/projects/{$project->id}/sit-approval", [
            'note' => 'SIT disetujui oleh developer.',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $fresh = $project->fresh();
        $this->assertCount(1, $fresh->sit_uat_data['sit3_approvals']['developer']['developers']);
        $this->assertEquals('Dimas Anggara', $fresh->sit_uat_data['sit3_approvals']['developer']['developers'][0]['name']);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'sit_approval',
            'subject_id' => $project->id,
        ]);
    }

    public function test_sit_approval_rejects_non_member_developer()
    {
        $project = $this->makeProject();
        $project->update(['status' => ProjectStatus::SIT_IN_PROGRESS->value]);
        $otherDev = $this->makeDeveloper('Orang Lain', 'other@nagari.co.id');

        $response = $this->actingAs($otherDev)->postJson("/api/v1/projects/{$project->id}/sit-approval");

        $response->assertStatus(403);
    }

    public function test_sit_approval_by_pm()
    {
        $pmRole = Role::create(['name' => UserRole::PROJECT_MANAGER->value, 'display_name' => 'Project Manager / PM']);
        $pm = User::create([
            'name' => 'PM SIT',
            'email' => 'pmsit@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $pmRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $project = $this->makeProject();
        $project->update([
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            'pm_id' => $pm->id,
        ]);

        $response = $this->actingAs($pm)->postJson("/api/v1/projects/{$project->id}/sit-approval", [
            'note' => 'SIT disetujui oleh PM (Analyst Pengembangan).',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $fresh = $project->fresh();
        $this->assertTrue($fresh->sit_uat_data['sit3_approvals']['pm']['approved']);
    }

    public function test_sit_approval_requires_all_developers()
    {
        $project = $this->makeProject();
        $project->update(['status' => ProjectStatus::SIT_IN_PROGRESS->value]);
        $dev1 = $this->makeDeveloper('Dev Satu', 'dev1@nagari.co.id');
        $dev2 = $this->makeDeveloper('Dev Dua', 'dev2@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $dev1->id, 'role_in_project' => 'Backend']);
        $project->teamMembers()->create(['user_id' => $dev2->id, 'role_in_project' => 'Frontend']);

        // Dua task di-assign ke dua developer berbeda
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task 1',
            'assignee_id' => $dev1->id,
            'status' => 'done',
        ])->assertStatus(201);
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task 2',
            'assignee_id' => $dev2->id,
            'status' => 'done',
        ])->assertStatus(201);

        // Dev1 approve
        $this->actingAs($dev1)->postJson("/api/v1/projects/{$project->id}/sit-approval")
            ->assertStatus(200);

        $fresh = $project->fresh();
        $devApproval = $fresh->sit_uat_data['sit3_approvals']['developer'];
        $this->assertEquals(2, $devApproval['required']);
        $this->assertEquals(1, $devApproval['approvedCount']);
        $this->assertCount(1, $devApproval['developers']);

        // Dev2 approve → approvedCount jadi 2
        $this->actingAs($dev2)->postJson("/api/v1/projects/{$project->id}/sit-approval")
            ->assertStatus(200);

        $fresh = $project->fresh();
        $devApproval = $fresh->sit_uat_data['sit3_approvals']['developer'];
        $this->assertEquals(2, $devApproval['approvedCount']);
        $this->assertCount(2, $devApproval['developers']);

        // Dev1 approve lagi → tidak duplikat
        $this->actingAs($dev1)->postJson("/api/v1/projects/{$project->id}/sit-approval")
            ->assertStatus(200);
        $fresh = $project->fresh();
        $this->assertCount(2, $fresh->sit_uat_data['sit3_approvals']['developer']['developers']);
    }

    public function test_uat_approval_by_business_user()
    {
        $bizRole = Role::create(['name' => UserRole::BUSINESS_USER->value, 'display_name' => 'Business User']);
        $biz = User::create([
            'name' => 'Pemohon UAT',
            'email' => 'pemohon@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $bizRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $project = $this->makeProject();
        $project->update([
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
            'created_by' => $biz->id,
        ]);

        $response = $this->actingAs($biz)->postJson("/api/v1/projects/{$project->id}/uat-approval", [
            'note' => 'UAT disetujui oleh pemohon.',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $fresh = $project->fresh();
        $this->assertTrue($fresh->sit_uat_data['uat3_approvals']['business_user']['approved']);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'uat_approval',
            'subject_id' => $project->id,
        ]);
    }

    public function test_uat_change_request_major_returns_to_development()
    {
        $bizRole = Role::create(['name' => UserRole::BUSINESS_USER->value, 'display_name' => 'Business User']);
        $biz = User::create([
            'name' => 'Pemohon UAT',
            'email' => 'pemohon2@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $bizRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $project = $this->makeProject();
        $project->update([
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
            'created_by' => $biz->id,
        ]);

        // Pemohon mengajukan change request mayor
        $this->actingAs($biz)->postJson("/api/v1/projects/{$project->id}/uat-change-request", [
            'type' => 'mayor',
            'title' => 'Perubahan alur utama',
            'detail' => 'Perlu perubahan besar pada logika transaksi.',
        ])->assertStatus(200);

        $fresh = $project->fresh();
        $crs = $fresh->sit_uat_data['uat_change_requests'];
        $this->assertCount(1, $crs);
        $this->assertEquals('mayor', $crs[0]['type']);
        $this->assertEquals('pending', $crs[0]['status']);

        // Admin menyetujui → kembali ke UAT_REVISION_DEV (kembali ke development)
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-change-request/decision", [
            'cr_id' => $crs[0]['id'],
            'decision' => 'approved',
            'note' => 'Disetujui.',
        ])->assertStatus(200);

        $fresh = $project->fresh();
        $this->assertEquals(ProjectStatus::UAT_REVISION_DEV->value, $fresh->status instanceof \BackedEnum ? $fresh->status->value : $fresh->status);
        $this->assertEquals('approved', $fresh->sit_uat_data['uat_change_requests'][0]['status']);
    }
}
