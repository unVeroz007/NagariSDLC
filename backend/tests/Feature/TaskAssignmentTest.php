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
}
