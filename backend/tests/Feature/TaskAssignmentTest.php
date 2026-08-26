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
        $project->update([
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            // Formulir persetujuan SIT baru terbuka pada Tahap 3. Gerbang
            // `POST /projects/{id}/sit-approval` sekarang memakai predikat yang sama
            // dengan inbox `GET /me/sit-approvals`, jadi tahapnya harus disiapkan.
            'sit_uat_data' => ['activeSitStep' => 3],
        ]);
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
        $project->update([
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            // Formulir persetujuan SIT baru terbuka pada Tahap 3. Gerbang
            // `POST /projects/{id}/sit-approval` sekarang memakai predikat yang sama
            // dengan inbox `GET /me/sit-approvals`, jadi tahapnya harus disiapkan.
            'sit_uat_data' => ['activeSitStep' => 3],
        ]);
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
            'sit_uat_data' => ['activeSitStep' => 3],
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
        $project->update([
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            // Formulir persetujuan SIT baru terbuka pada Tahap 3. Gerbang
            // `POST /projects/{id}/sit-approval` sekarang memakai predikat yang sama
            // dengan inbox `GET /me/sit-approvals`, jadi tahapnya harus disiapkan.
            'sit_uat_data' => ['activeSitStep' => 3],
        ]);
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

    /**
     * Seluruh developer pada tim proyek wajib menyetujui SIT, termasuk yang tidak
     * memegang satu pun task.
     *
     * Sebelumnya daftar wajib diambil dari `assignee_id` task scope SIT, sehingga
     * developer yang berada pada tim namun tidak menerima task revisi tidak pernah
     * dapat memberikan persetujuan — permintaannya ditolak 403 dan namanya juga tidak
     * ikut dihitung sebagai prasyarat kelulusan SIT.
     */
    public function test_sit_approval_includes_team_developer_without_task()
    {
        $project = $this->makeProject();
        $project->update([
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            // Formulir persetujuan SIT baru terbuka pada Tahap 3. Gerbang
            // `POST /projects/{id}/sit-approval` sekarang memakai predikat yang sama
            // dengan inbox `GET /me/sit-approvals`, jadi tahapnya harus disiapkan.
            'sit_uat_data' => ['activeSitStep' => 3],
        ]);
        $assignedDev = $this->makeDeveloper('Dev Bertugas', 'dev-assigned@nagari.co.id');
        $idleDev = $this->makeDeveloper('Dev Tanpa Task', 'dev-idle@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $assignedDev->id, 'role_in_project' => 'Backend']);
        $project->teamMembers()->create(['user_id' => $idleDev->id, 'role_in_project' => 'Frontend']);

        // Hanya satu developer yang menerima task.
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task Revisi',
            'assignee_id' => $assignedDev->id,
            'status' => 'done',
        ])->assertStatus(201);

        $this->actingAs($idleDev)->postJson("/api/v1/projects/{$project->id}/sit-approval", [
            'note' => 'Ikut menyetujui sebagai anggota tim.',
        ])->assertStatus(200);

        $devApproval = $project->fresh()->sit_uat_data['sit3_approvals']['developer'];

        $this->assertEquals(2, $devApproval['required']);
        $this->assertEquals(1, $devApproval['approvedCount']);
        $this->assertEqualsCanonicalizing(
            [$assignedDev->id, $idleDev->id],
            $devApproval['requiredDeveloperIds']
        );
    }

    /**
     * Penerima task pada scope SIT tetap wajib menyetujui walau namanya sudah tidak
     * tercatat pada tim proyek.
     *
     * `TaskController::store` mengharuskan assignee merupakan anggota tim, jadi kondisi
     * ini muncul ketika susunan tim diubah setelah task dibagikan: tanggung jawab atas
     * task yang sudah dipegang tidak hilang hanya karena baris keanggotaannya dihapus.
     */
    public function test_sit_approval_includes_task_assignee_removed_from_team()
    {
        $project = $this->makeProject();
        $project->update([
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            // Formulir persetujuan SIT baru terbuka pada Tahap 3. Gerbang
            // `POST /projects/{id}/sit-approval` sekarang memakai predikat yang sama
            // dengan inbox `GET /me/sit-approvals`, jadi tahapnya harus disiapkan.
            'sit_uat_data' => ['activeSitStep' => 3],
        ]);
        $dev = $this->makeDeveloper('Dev Pemegang Task', 'dev-task-holder@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $dev->id, 'role_in_project' => 'Backend']);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task Masih Dipegang',
            'assignee_id' => $dev->id,
            'status' => 'done',
        ])->assertStatus(201);

        // Keanggotaan tim dicabut, task tetap tercatat atas namanya.
        $project->teamMembers()->where('user_id', $dev->id)->delete();

        $this->actingAs($dev)->postJson("/api/v1/projects/{$project->id}/sit-approval")
            ->assertStatus(200);

        $devApproval = $project->fresh()->sit_uat_data['sit3_approvals']['developer'];

        $this->assertEquals(1, $devApproval['required']);
        $this->assertEquals(1, $devApproval['approvedCount']);
    }

    /**
     * Persetujuan yang sudah tercatat tidak pernah dibuang saat daftar wajib berubah.
     *
     * Daftar `developers[]` adalah jejak audit: ia menyatakan siapa yang benar-benar
     * pernah menyetujui. Sebelumnya daftar itu disaring ulang terhadap daftar wajib
     * setiap kali ada persetujuan baru, sehingga satu pengalihan task cukup untuk
     * menghapus catatan persetujuan seseorang. Kelengkapan tetap dinilai dari
     * `approvedCount`, yang hanya menimbang penyetuju yang masih wajib.
     */
    public function test_sit_approval_keeps_history_of_developer_removed_from_team()
    {
        $project = $this->makeProject();
        $project->update([
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
            // Formulir persetujuan SIT baru terbuka pada Tahap 3. Gerbang
            // `POST /projects/{id}/sit-approval` sekarang memakai predikat yang sama
            // dengan inbox `GET /me/sit-approvals`, jadi tahapnya harus disiapkan.
            'sit_uat_data' => ['activeSitStep' => 3],
        ]);
        $leavingDev = $this->makeDeveloper('Dev Pindah', 'dev-leaving@nagari.co.id');
        $stayingDev = $this->makeDeveloper('Dev Tetap', 'dev-staying@nagari.co.id');
        $project->teamMembers()->create(['user_id' => $leavingDev->id, 'role_in_project' => 'Backend']);
        $project->teamMembers()->create(['user_id' => $stayingDev->id, 'role_in_project' => 'Frontend']);

        $this->actingAs($leavingDev)->postJson("/api/v1/projects/{$project->id}/sit-approval")
            ->assertStatus(200);

        // Developer pertama keluar dari tim proyek.
        $project->teamMembers()->where('user_id', $leavingDev->id)->delete();

        $this->actingAs($stayingDev)->postJson("/api/v1/projects/{$project->id}/sit-approval")
            ->assertStatus(200);

        $devApproval = $project->fresh()->sit_uat_data['sit3_approvals']['developer'];

        $this->assertCount(2, $devApproval['developers']);
        $this->assertEquals(1, $devApproval['required']);
        $this->assertEquals(1, $devApproval['approvedCount']);
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
            'sit_uat_data' => ['activeUatStep' => 3],
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

    /**
     * Change Request mayor lahir dari Eksekusi UAT dan mengembalikan proyek ke developer.
     *
     * Pengganti pengujian lama yang mengajukan CR lewat `POST /projects/{id}/uat-change-request`.
     * Endpoint itu sudah pensiun: tidak ada satu pun komponen frontend yang memanggilnya, dan
     * CR yang dihasilkannya tidak membawa `cycle` sehingga tidak pernah terlihat oleh gerbang
     * `UAT_REVISION_DEV -> SIT_IN_PROGRESS` yang menyaring
     * `type === 'mayor' && cycle === siklus berjalan`. Perilaku yang diuji tetap sama —
     * CR mayor tercatat dan proyek kembali ke pengembangan — hanya pintunya yang kini pintu
     * yang benar-benar dipakai UI.
     *
     * `cycle` dan `origin` ikut ditegaskan karena keduanyalah yang membuat CR ini dapat
     * dibaca gerbang siklus; tanpa keduanya CR hanya menjadi baris riwayat yang mati.
     */
    public function test_uat_execution_major_records_change_request_and_returns_to_development()
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
        $dev = $this->makeDeveloper('Dev Revisi Mayor', 'dev-mayor@nagari.co.id');

        $project = $this->makeProject();
        $project->update([
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
            'created_by' => $biz->id,
            // Eksekusi hasil UAT hanya dapat dikirim setelah persiapan skenario selesai.
            'sit_uat_data' => ['activeUatStep' => 2],
        ]);
        $task = ProjectTask::create([
            'project_id' => $project->id,
            'title' => 'Alur transaksi utama',
            'assignee_id' => $dev->id,
            'status' => TaskStatus::DONE,
        ]);

        // Pemohon mencatat temuan mayor pada eksekusi UAT Tahap 2.
        $this->actingAs($biz)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => 'sc-mayor-1',
                'task_id' => $task->id,
                'scenario' => 'Perubahan alur utama',
                'result' => 'revision',
                'change_type' => 'mayor',
                'request' => 'Perlu perubahan besar pada logika transaksi.',
            ]],
        ])->assertStatus(200);

        $fresh = $project->fresh();
        $crs = $fresh->sit_uat_data['uat_change_requests'];

        $this->assertCount(1, $crs);
        $this->assertEquals('mayor', $crs[0]['type']);
        $this->assertEquals('uat_execution', $crs[0]['origin']);
        $this->assertEquals(1, $crs[0]['cycle']);
        $this->assertEquals(
            ProjectStatus::UAT_REVISION_DEV->value,
            $fresh->status instanceof \BackedEnum ? $fresh->status->value : $fresh->status
        );
        // Task yang direvisi dibuka kembali agar developer punya pekerjaan yang jelas.
        $this->assertEquals(TaskStatus::IN_PROGRESS->value, $task->fresh()->status->value);
    }

    /**
     * Keputusan atas Change Request mayor tetap memindahkan proyek ke pengembangan.
     *
     * `POST /projects/{id}/uat-change-request/decision` sengaja dipertahankan walau
     * endpoint pengajuannya dihapus: ia memutuskan CR yang sudah ada, dan transisi
     * "CR mayor disetujui -> UAT_REVISION_DEV" adalah perilaku yang sedang dipakai.
     * CR-nya disemai langsung ke `sit_uat_data` karena yang diuji di sini adalah paruh
     * keputusan, bukan paruh pengajuan — dan pengajuan lewat endpoint yang sudah pensiun
     * bukan lagi cara CR terbentuk.
     */
    public function test_uat_change_request_major_decision_returns_to_development()
    {
        $project = $this->makeProject();
        $project->update([
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
            'sit_uat_data' => [
                'activeUatStep' => 3,
                'uat_change_requests' => [[
                    'id' => 'cr_legacy_0001',
                    'type' => 'mayor',
                    'title' => 'Perubahan alur utama',
                    'detail' => 'Perlu perubahan besar pada logika transaksi.',
                    'status' => 'pending',
                    'submittedBy' => $this->admin->name,
                    'submittedById' => $this->admin->id,
                    'at' => now()->toIso8601String(),
                ]],
            ],
        ]);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-change-request/decision", [
            'cr_id' => 'cr_legacy_0001',
            'decision' => 'approved',
            'note' => 'Disetujui.',
        ])->assertStatus(200);

        $fresh = $project->fresh();

        $this->assertEquals(
            ProjectStatus::UAT_REVISION_DEV->value,
            $fresh->status instanceof \BackedEnum ? $fresh->status->value : $fresh->status
        );
        $this->assertEquals('approved', $fresh->sit_uat_data['uat_change_requests'][0]['status']);
        $this->assertEquals('Disetujui.', $fresh->sit_uat_data['uat_change_requests'][0]['decisionNote']);
    }

    /**
     * Role tanpa wewenang tidak dapat memutuskan Change Request UAT.
     *
     * Ditegaskan juga bahwa status CR tidak berubah: penolakan yang membiarkan sebagian
     * data tertulis akan meninggalkan jejak audit yang menyatakan keputusan pernah
     * diambil oleh orang yang justru ditolak.
     */
    public function test_developer_cannot_decide_uat_change_request()
    {
        $dev = $this->makeDeveloper('Dev Tanpa Wewenang', 'dev-no-cr@nagari.co.id');

        $project = $this->makeProject();
        $project->update([
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
            'sit_uat_data' => [
                'activeUatStep' => 3,
                'uat_change_requests' => [[
                    'id' => 'cr_legacy_0002',
                    'type' => 'mayor',
                    'title' => 'Perubahan alur utama',
                    'detail' => 'Perlu perubahan besar pada logika transaksi.',
                    'status' => 'pending',
                ]],
            ],
        ]);

        $this->actingAs($dev)->postJson("/api/v1/projects/{$project->id}/uat-change-request/decision", [
            'cr_id' => 'cr_legacy_0002',
            'decision' => 'approved',
        ])->assertStatus(403);

        $fresh = $project->fresh();

        $this->assertEquals('pending', $fresh->sit_uat_data['uat_change_requests'][0]['status']);
        $this->assertEquals(
            ProjectStatus::UAT_IN_PROGRESS->value,
            $fresh->status instanceof \BackedEnum ? $fresh->status->value : $fresh->status
        );
    }
}
