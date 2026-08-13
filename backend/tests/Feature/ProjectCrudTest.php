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
}
