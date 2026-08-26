<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
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
        $external = collect($round['approvers'])->firstWhere('approval_role', 'requester_group_lead');
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
            ->assertJsonPath('data.approver.name', 'Pimpinan Grup');

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

    /**
     * Sisi pemohon hanya menyetujui; hanya sisi IT yang boleh menolak.
     *
     * Seluruh penolakan dan permintaan revisi dari unit peminta sudah dicatat dan
     * diaudit saat eksekusi UAT (Tahap 2), sehingga tahap persetujuan tidak boleh
     * membuka jalur penolakan kedua atas temuan yang sama.
     */
    public function test_requester_side_approvers_cannot_reject_but_it_side_can(): void
    {
        [$project, $admin, $developer, , $requester] = $this->makeProject();
        $round = $this->actingAs($admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated()
            ->json('data');

        $requesterApproval = collect($round['approvers'])->firstWhere('approval_role', 'requester');
        $this->assertFalse($requesterApproval['can_reject']);
        $this->actingAs($requester)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$requesterApproval['id']}/decision", [
                'decision' => 'rejected',
                'note' => 'Hasil belum sesuai.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('decision');

        // Jalur eksternal memakai `recordDecision` yang sama, jadi satu gerbang menutup
        // kedua permukaan sekaligus.
        $groupLead = collect($round['approvers'])->firstWhere('approval_role', 'requester_group_lead');
        $this->assertFalse($groupLead['can_reject']);
        $link = $this->actingAs($admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$groupLead['id']}/link")
            ->assertOk()
            ->json('data.token');
        $accessToken = $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081211111111'])
            ->assertOk()
            ->json('data.access_token');
        $this->withHeader('X-UAT-Approval-Access', $accessToken)
            ->postJson("/api/v1/uat-approvals/{$link}/decision", [
                'decision' => 'rejected',
                'note' => 'Hasil belum sesuai.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('decision');

        $developerApproval = collect($round['approvers'])->firstWhere('approval_role', 'developer');
        $this->assertTrue($developerApproval['can_reject']);
        $this->actingAs($developer)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$developerApproval['id']}/decision", [
                'decision' => 'rejected',
                'note' => 'Masih ada defect terbuka.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');
    }

    public function test_requester_approves_uat_from_own_account(): void
    {
        [$project, $admin, , , $requester] = $this->makeProject();
        $round = $this->actingAs($admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated()
            ->json('data');
        $requesterApproval = collect($round['approvers'])->firstWhere('approval_role', 'requester');

        $this->assertSame('internal_account', $requesterApproval['approval_mode']);
        $this->assertSame($requester->id, $requesterApproval['user_id']);
        $this->assertNull($requesterApproval['phone_masked']);

        // Pemohon membaca matriksnya sendiri lewat gerbang `created_by`, tanpa link.
        $this->actingAs($requester)
            ->getJson("/api/v1/projects/{$project->id}/uat-approval-matrix")
            ->assertOk();

        $this->actingAs($requester)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$requesterApproval['id']}/decision", [
                'decision' => 'approved',
                'note' => 'Hasil UAT sesuai kebutuhan.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_requester_approver_must_be_the_project_creator(): void
    {
        [$project, $admin] = $this->makeProject();
        $participants = collect($project->sit_uat_data['uat1_participants'])
            ->map(function (array $participant) use ($admin): array {
                if ($participant['approvalRole'] === 'requester') {
                    $participant['userId'] = $admin->id;
                }

                return $participant;
            })->all();
        $project->update(['sit_uat_data' => [...$project->sit_uat_data, 'uat1_participants' => $participants]]);

        $this->actingAs($admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('participants.0.userId');
    }

    public function test_external_approval_page_only_exposes_requester_visible_documents(): void
    {
        [$project, $admin] = $this->makeProject();
        $visible = $this->makeDocument($project, $admin, 'UAT_RESULT', 'Hasil UAT.pdf');
        $hidden = $this->makeDocument($project, $admin, 'CYBER_REPORT', 'Laporan Audit Siber.pdf');
        $project->update([
            'sit_uat_data' => [
                ...$project->sit_uat_data,
                'uat1_docs' => [['docId' => $visible->id], ['docId' => $hidden->id]],
            ],
        ]);

        $round = $this->actingAs($admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated()
            ->json('data');
        $groupLead = collect($round['approvers'])->firstWhere('approval_role', 'requester_group_lead');
        $link = $this->actingAs($admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$groupLead['id']}/link")
            ->assertOk()
            ->json('data.token');
        $accessToken = $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081211111111'])
            ->assertOk()
            ->json('data.access_token');

        $documents = $this->withHeader('X-UAT-Approval-Access', $accessToken)
            ->getJson("/api/v1/uat-approvals/{$link}/detail")
            ->assertOk()
            ->json('data.documents');

        $this->assertSame([$visible->id], collect($documents)->pluck('id')->all());

        // Menyaring payload saja tidak cukup: berkas internal masih dapat diunduh
        // begitu id-nya diketahui, jadi unduhan wajib memakai daftar tipe yang sama.
        $this->withHeader('X-UAT-Approval-Access', $accessToken)
            ->getJson("/api/v1/uat-approvals/{$link}/documents/{$hidden->id}/download")
            ->assertForbidden();
    }

    private function makeDocument(Project $project, User $uploader, string $type, string $fileName): DocumentVault
    {
        return DocumentVault::create([
            'project_id' => $project->id,
            'uploaded_by' => $uploader->id,
            'document_type' => $type,
            'file_path' => 'documents/'.Str::random(12).'.pdf',
            'file_name' => $fileName,
            'original_filename' => $fileName,
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);
    }

    private function makeProject(): array
    {
        $division = Division::create(['code' => 'IT', 'name' => 'Divisi TI']);
        $adminRole = Role::create(['name' => UserRole::SUPER_ADMIN->value, 'display_name' => 'Super Admin']);
        $developerRole = Role::create(['name' => UserRole::DEVELOPER->value, 'display_name' => 'Developer']);
        $requesterRole = Role::create(['name' => UserRole::BUSINESS_USER->value, 'display_name' => 'Business User']);
        $admin = $this->makeUser($adminRole, $division, 'Admin', 'admin-approval@nagari.co.id');
        // Tiga slot approval sisi IT wajib diisi tiga akun berbeda: satu akun yang
        // menempati dua slot membuat satu klik memenuhi dua persetujuan wajib, dan
        // `UatApprovalService::validateParticipants()` menolaknya (prinsip empat mata).
        $devGroupLead = $this->makeUser($adminRole, $division, 'Pimpinan Pengembangan', 'dev-lead-approval@nagari.co.id');
        $techDivisionLead = $this->makeUser($adminRole, $division, 'Pimpinan Divisi TI', 'tech-lead-approval@nagari.co.id');
        $developer = $this->makeUser($developerRole, $division, 'Developer UAT', 'developer-approval@nagari.co.id');
        $otherDeveloper = $this->makeUser($developerRole, $division, 'Developer Lain', 'developer-lain@nagari.co.id');
        $requester = $this->makeUser($requesterRole, $division, 'Pemohon UAT', 'pemohon-approval@nagari.co.id');
        // Pemohon proyek selalu memiliki akun aplikasi, sehingga persetujuannya
        // dikerjakan di dalam aplikasi dan `UatApprovalRole::requiredMode()` memaksa
        // mode `internal_account` dengan akun yang sama dengan `created_by`. Hanya
        // pimpinan grup dan pimpinan divisi pemohon yang memakai link eksternal.
        $participants = [
            $this->internal('Pemohon UAT', 'requester', $requester->id),
            $this->external('Pimpinan Grup', 'requester_group_lead', '081211111111'),
            $this->external('Pimpinan Divisi', 'requester_division_lead', '081233333333'),
            $this->internal('Developer UAT', 'developer', $developer->id),
            $this->internal('Analyst PM', 'analyst_pm', $admin->id),
            $this->internal('Pimpinan Pengembangan', 'development_group_lead', $devGroupLead->id),
            $this->internal('Pimpinan Divisi TI', 'technology_division_lead', $techDivisionLead->id),
        ];
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Approval UAT',
            'description' => 'Pengujian approval individual.',
            'created_by' => $requester->id,
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

        // Developer approver hanya sah bila ia mengerjakan task proyek ini
        // (UatApprovalService::validateParticipants).
        ProjectTask::create([
            'project_id' => $project->id,
            'title' => 'Perbaikan alur transaksi',
            'status' => TaskStatus::DONE->value,
            'assignee_id' => $developer->id,
        ]);

        return [$project, $admin, $developer, $otherDeveloper, $requester];
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
