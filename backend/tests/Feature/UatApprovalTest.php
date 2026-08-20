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

class UatApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_external_approver_verifies_phone_and_records_individual_decision(): void
    {
        [$project, $admin] = $this->makeProject();

        $round = $this->actingAs($admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated()
            ->json('data');
        $external = collect($round['approvers'])->firstWhere('approval_role', 'requester');
        $link = $this->actingAs($admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$external['id']}/link")
            ->assertOk()
            ->json('data.token');

        $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081299999999'])
            ->assertUnprocessable();

        $accessToken = $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '+62 812-1111-1111'])
            ->assertOk()
            ->json('data.access_token');

        $this->withHeader('X-UAT-Approval-Access', $accessToken)
            ->getJson("/api/v1/uat-approvals/{$link}/detail")
            ->assertOk()
            ->assertJsonPath('data.approver.name', 'Pemohon UAT');

        $this->withHeader('X-UAT-Approval-Access', $accessToken)
            ->postJson("/api/v1/uat-approvals/{$link}/decision", [
                'decision' => 'approved',
                'note' => 'Hasil UAT sesuai kebutuhan.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_internal_approval_cannot_be_decided_by_another_account(): void
    {
        [$project, $admin, $developer, $otherDeveloper] = $this->makeProject();
        $round = $this->actingAs($admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated()
            ->json('data');
        $developerApproval = collect($round['approvers'])->firstWhere('approval_role', 'developer');

        $this->actingAs($otherDeveloper)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$developerApproval['id']}/decision", [
                'decision' => 'approved',
            ])
            ->assertUnprocessable();

        $this->actingAs($developer)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$developerApproval['id']}/decision", [
                'decision' => 'approved',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    private function makeProject(): array
    {
        $division = Division::create(['code' => 'IT', 'name' => 'Divisi TI']);
        $adminRole = Role::create(['name' => UserRole::SUPER_ADMIN->value, 'display_name' => 'Super Admin']);
        $developerRole = Role::create(['name' => UserRole::DEVELOPER->value, 'display_name' => 'Developer']);
        $admin = $this->makeUser($adminRole, $division, 'Admin', 'admin-approval@nagari.co.id');
        $developer = $this->makeUser($developerRole, $division, 'Developer UAT', 'developer-approval@nagari.co.id');
        $otherDeveloper = $this->makeUser($developerRole, $division, 'Developer Lain', 'developer-lain@nagari.co.id');
        $participants = [
            $this->external('Pemohon UAT', 'requester', '081211111111'),
            $this->external('Pimpinan Grup', 'requester_group_lead', '081222222222'),
            $this->external('Pimpinan Divisi', 'requester_division_lead', '081233333333'),
            $this->internal('Developer UAT', 'developer', $developer->id),
            $this->internal('Analyst PM', 'analyst_pm', $admin->id),
            $this->internal('Pimpinan Pengembangan', 'development_group_lead', $admin->id),
            $this->internal('Pimpinan Divisi TI', 'technology_division_lead', $admin->id),
        ];
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Approval UAT',
            'description' => 'Pengujian approval individual.',
            'created_by' => $admin->id,
            'pm_id' => $admin->id,
            'division_id' => $division->id,
            'status' => ProjectStatus::UAT_IN_PROGRESS,
            'sit_uat_data' => [
                'activeUatStep' => 3,
                'uat1_participants' => $participants,
                'uat2_summary' => ['conclusion' => 'accepted', 'submittedAt' => now()->toIso8601String()],
                'uat2_scenarios' => [],
            ],
        ]);

        return [$project, $admin, $developer, $otherDeveloper];
    }

    private function makeUser(Role $role, Division $division, string $name, string $email): User
    {
        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $role->id,
            'division_id' => $division->id,
            'is_active' => true,
        ]);
    }

    private function external(string $name, string $role, string $phone): array
    {
        return [
            'id' => fake()->uuid(), 'name' => $name, 'role' => $name, 'unit' => 'Divisi Peminta',
            'phone' => $phone, 'isApprover' => true, 'approvalRole' => $role,
            'approvalMode' => 'external_link', 'userId' => null,
        ];
    }

    private function internal(string $name, string $role, int $userId): array
    {
        return [
            'id' => fake()->uuid(), 'name' => $name, 'role' => $name, 'unit' => 'Divisi TI',
            'phone' => '', 'isApprover' => true, 'approvalRole' => $role,
            'approvalMode' => 'internal_account', 'userId' => $userId,
        ];
    }
}
