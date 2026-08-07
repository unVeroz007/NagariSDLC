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

class ProjectWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Division $division;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create([
            'name' => UserRole::SUPER_ADMIN->value,
            'display_name' => 'Super Admin',
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

    public function test_can_create_project_with_auto_req_id()
    {
        $response = $this->actingAs($this->admin)->postJson('/api/v1/projects', [
            'title' => 'Sistem QRIS Bank Nagari',
            'description' => 'Pengembangan fitur QRIS.',
            'division_id' => $this->division->id,
            'target_date' => now()->addDays(30)->format('Y-m-d'),
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'PENDING');

        $this->assertDatabaseHas('projects', [
            'title' => 'Sistem QRIS Bank Nagari',
            'status' => 'PENDING',
        ]);
    }

    public function test_valid_state_machine_transition()
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Tes',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ]);

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => 'IN_REVIEW',
            'notes' => 'Memulai review oleh lead',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'IN_REVIEW');

        $this->assertDatabaseHas('project_status_histories', [
            'project_id' => $project->id,
            'from_status' => 'PENDING',
            'to_status' => 'IN_REVIEW',
        ]);
    }

    public function test_invalid_state_machine_transition_is_rejected()
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Tes Invalid',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ]);

        // Melompati alur dari PENDING langsung ke LIVE_PRODUCTION (harus ditolak HTTP 422)
        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => 'LIVE_PRODUCTION',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('status', 'error');
    }
}
