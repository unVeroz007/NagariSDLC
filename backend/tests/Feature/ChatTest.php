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

class ChatTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Division $division;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create(['name' => UserRole::SUPER_ADMIN->value, 'display_name' => 'Super Admin']);
        $this->division = Division::create(['code' => 'IT-DEV', 'name' => 'Divisi TI']);

        $this->admin = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }

    protected function makeProject(): Project
    {
        return Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Chat',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);
    }

    public function test_send_and_get_chat_message_per_project()
    {
        $project = $this->makeProject();
        $other = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Lain',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::IN_DEVELOPMENT->value,
        ]);

        // Kirim pesan ke proyek A
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/chat", [
            'message' => 'Halo tim, ini pesan proyek A.',
        ])->assertStatus(201);

        // Pesan hanya muncul di proyek A, bukan proyek lain
        $responseA = $this->actingAs($this->admin)->getJson("/api/v1/projects/{$project->id}/chat");
        $responseA->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $messagesA = collect($responseA->json('data'))->pluck('message')->all();
        $this->assertContains('Halo tim, ini pesan proyek A.', $messagesA);

        $responseB = $this->actingAs($this->admin)->getJson("/api/v1/projects/{$other->id}/chat");
        $messagesB = collect($responseB->json('data'))->pluck('message')->all();
        $this->assertNotContains('Halo tim, ini pesan proyek A.', $messagesB);
    }

    public function test_chat_requires_project_access()
    {
        $project = $this->makeProject();
        $role = Role::create(['name' => UserRole::BUSINESS_USER->value, 'display_name' => 'Business User']);
        $outsider = User::create([
            'name' => 'Orang Luar',
            'email' => 'luar@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $role->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        // Bukan anggota/pemohon/PM/analyst proyek → ditolak
        $this->actingAs($outsider)->getJson("/api/v1/projects/{$project->id}/chat")
            ->assertStatus(403);
        $this->actingAs($outsider)->postJson("/api/v1/projects/{$project->id}/chat", [
            'message' => 'Coba masuk.',
        ])->assertStatus(403);
    }
}
