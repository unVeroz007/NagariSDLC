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
use Tests\TestCase;

class UatExecutionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Division $division;

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
        $this->admin = $this->makeUser($adminRole, 'Admin UAT', 'admin-uat@nagari.co.id');
    }

    public function test_minor_revision_is_stored_without_rolling_project_back(): void
    {
        $project = $this->makeUatProject();
        $loginTask = $this->makeTask($project, 'Login aplikasi');
        $reportTask = $this->makeTask($project, 'Unduh laporan');
        $evidence = $this->makeDocument($project, DocumentVault::UAT_EVIDENCE_TYPE);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [
                [
                    'id' => "task_{$loginTask->id}",
                    'task_id' => $loginTask->id,
                    'scenario' => 'Login aplikasi',
                    'result' => 'accepted',
                    'comment' => 'Login sesuai kebutuhan user.',
                    'attachments' => [],
                ],
                [
                    'id' => "task_{$reportTask->id}",
                    'task_id' => $reportTask->id,
                    'scenario' => 'Unduh laporan',
                    'result' => 'revision',
                    'change_type' => 'minor',
                    'request' => 'Ubah label tombol menjadi Unduh PDF.',
                    'comment' => 'Tidak mengubah proses bisnis.',
                    'attachments' => [['docId' => $evidence->id]],
                ],
            ],
            'notes' => 'Demonstrasi dilakukan bersama user pemohon.',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('meta.conclusion', 'minor_revision')
            ->assertJsonPath('meta.requires_development_revision', false)
            ->assertJsonPath('data.status', ProjectStatus::UAT_IN_PROGRESS->value)
            ->assertJsonPath('data.sit_uat_data.uat2_summary.executedCount', 2)
            ->assertJsonPath('data.sit_uat_data.uat2_summary.acceptedCount', 1)
            ->assertJsonPath('data.sit_uat_data.uat2_summary.minorCount', 1)
            ->assertJsonPath('data.sit_uat_data.activeUatStep', 3)
            ->assertJsonPath('data.sit_uat_data.uat2_scenarios.1.attachments.0.docId', $evidence->id);

        $this->assertSame(ProjectStatus::UAT_IN_PROGRESS, $project->fresh()->status);
        $this->assertSame(TaskStatus::DONE, $reportTask->fresh()->status);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'uat_execution_submitted',
            'subject_id' => $project->id,
        ]);
    }

    public function test_major_revision_reopens_task_and_requires_sit_before_final_uat_approval(): void
    {
        $project = $this->makeUatProject([
            'sit2_task_approvals' => ['task_1' => ['approved' => true]],
            'sit3_reviewNotes' => 'SIT pertama lulus.',
            'sit3_docs' => [['docId' => 99]],
            'sit3_approvals' => ['pm' => ['approved' => true]],
            'uat3_approvals' => ['pm' => ['approved' => true]],
        ]);
        $task = $this->makeTask($project, 'Proses transaksi');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Proses transaksi',
                'result' => 'revision',
                'change_type' => 'mayor',
                'request' => 'Tambahkan alur otorisasi dua tingkat.',
                'comment' => 'Mengubah proses bisnis utama.',
                'attachments' => [],
            ]],
        ]);

        $response->assertOk()
            ->assertJsonPath('meta.conclusion', 'major_revision')
            ->assertJsonPath('meta.requires_development_revision', true)
            ->assertJsonPath('data.status', ProjectStatus::UAT_REVISION_DEV->value)
            ->assertJsonPath('data.sit_uat_data.uat2_resume_after_sit', true)
            ->assertJsonPath('data.sit_uat_data.activeSitStep', 1)
            ->assertJsonPath('data.sit_uat_data.activeUatStep', 2)
            ->assertJsonCount(1, 'data.sit_uat_data.sit_cycles')
            ->assertJsonPath('data.sit_uat_data.uat_change_requests.0.source', 'uat_execution')
            ->assertJsonPath('data.sit_uat_data.uat_change_requests.0.status', 'approved');

        $reopenedTask = $task->fresh();
        $this->assertSame(TaskStatus::IN_PROGRESS, $reopenedTask->status);
        $this->assertSame('Tambahkan alur otorisasi dua tingkat.', $reopenedTask->revision_note);
        $this->assertSame($this->admin->id, $reopenedTask->revision_requested_by);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-approval")
            ->assertStatus(422);
    }

    public function test_major_revision_resumes_at_final_uat_approval_after_sit_passes_again(): void
    {
        $project = $this->makeUatProject([
            'activeUatStep' => 2,
            'uat2_resume_after_sit' => true,
            'uat2_summary' => ['conclusion' => 'major_revision'],
        ]);
        $project->update(['status' => ProjectStatus::UAT_REVISION_DEV->value]);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ])->assertOk();

        $signOff = $this->makeDocument($project, 'SIT_SIGNOFF');
        $sitData = (array) $project->fresh()->sit_uat_data;
        $sitData['sit3_docs'] = [['docId' => $signOff->id, 'doc_type' => 'SIT_SIGNOFF']];
        $project->update(['sit_uat_data' => $sitData]);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_PASSED->value,
        ])->assertOk();

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.sit_uat_data.activeUatStep', 3)
            ->assertJsonPath('data.sit_uat_data.uat2_resume_after_sit', false);
        $this->assertNotEmpty($project->fresh()->sit_uat_data['uat2_major_revision_resolved_at']);
    }

    public function test_revision_requires_change_type_and_request_detail(): void
    {
        $project = $this->makeUatProject();
        $task = $this->makeTask($project, 'Validasi transaksi');

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Validasi transaksi',
                'result' => 'revision',
                'attachments' => [],
            ]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors([
                'scenarios.0.change_type',
                'scenarios.0.request',
            ]);
    }

    public function test_evidence_from_another_project_is_rejected(): void
    {
        $project = $this->makeUatProject();
        $task = $this->makeTask($project, 'Cetak laporan');
        $otherProject = $this->makeUatProject();
        $foreignEvidence = $this->makeDocument($otherProject, DocumentVault::UAT_EVIDENCE_TYPE);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Cetak laporan',
                'result' => 'accepted',
                'attachments' => [['docId' => $foreignEvidence->id]],
            ]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['scenarios']);
    }

    public function test_unrelated_developer_cannot_submit_uat_execution(): void
    {
        $developerRole = Role::create([
            'name' => UserRole::DEVELOPER->value,
            'display_name' => 'Developer',
        ]);
        $developer = $this->makeUser($developerRole, 'Developer Luar', 'developer-luar@nagari.co.id');
        $project = $this->makeUatProject();
        $task = $this->makeTask($project, 'Skenario UAT');

        $this->actingAs($developer)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Skenario UAT',
                'result' => 'accepted',
                'attachments' => [],
            ]],
        ])->assertForbidden();

        $this->assertNull($project->fresh()->sit_uat_data['uat2_summary'] ?? null);
    }

    public function test_assigned_dev_analyst_can_record_a_major_uat_revision(): void
    {
        $pmRole = Role::create([
            'name' => 'dev_analyst',
            'display_name' => 'PM / Analyst Pengembangan',
        ]);
        $pm = $this->makeUser($pmRole, 'PM UAT', 'pm-uat@nagari.co.id');
        $project = $this->makeUatProject();
        $project->update(['pm_id' => $pm->id]);
        $task = $this->makeTask($project, 'Otorisasi transaksi');

        $this->actingAs($pm)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Otorisasi transaksi',
                'result' => 'revision',
                'change_type' => 'mayor',
                'request' => 'Tambahkan approval berjenjang.',
                'attachments' => [],
            ]],
        ])->assertOk()
            ->assertJsonPath('data.status', ProjectStatus::UAT_REVISION_DEV->value);
    }

    public function test_generic_project_update_cannot_overwrite_server_managed_uat_results(): void
    {
        $project = $this->makeUatProject([
            'activeSitStep' => 1,
            'uat2_summary' => [
                'conclusion' => 'major_revision',
                'submittedAt' => now()->toIso8601String(),
            ],
            'uat2_resume_after_sit' => true,
            'uat3_approvals' => [],
        ]);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'sitUatData' => [
                'activeSitStep' => 2,
                'uat2_summary' => ['conclusion' => 'accepted'],
                'uat2_resume_after_sit' => false,
                'uat3_approvals' => [
                    'business_user' => ['approved' => true],
                    'pm' => ['approved' => true],
                    'development_lead' => ['approved' => true],
                ],
            ],
        ])->assertOk();

        $sitUatData = $project->fresh()->sit_uat_data;
        $this->assertSame(2, $sitUatData['activeSitStep']);
        $this->assertSame('major_revision', $sitUatData['uat2_summary']['conclusion']);
        $this->assertTrue($sitUatData['uat2_resume_after_sit']);
        $this->assertSame([], $sitUatData['uat3_approvals']);
    }

    private function makeUser(Role $role, string $name, string $email): User
    {
        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $role->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }

    private function makeUatProject(array $sitUatData = []): Project
    {
        $defaultParticipants = [
            $this->externalApprover('Requester', 'requester', '081211111111'),
            $this->externalApprover('Requester Group Lead', 'requester_group_lead', '081222222222'),
            $this->externalApprover('Requester Division Lead', 'requester_division_lead', '081233333333'),
            $this->internalApprover('Developer', 'developer'),
            $this->internalApprover('Analyst PM', 'analyst_pm'),
            $this->internalApprover('Development Group Lead', 'development_group_lead'),
            $this->internalApprover('Technology Division Lead', 'technology_division_lead'),
        ];

        return Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Eksekusi UAT '.uniqid(),
            'created_by' => $this->admin->id,
            'pm_id' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
            'sit_uat_data' => array_merge([
                'activeUatStep' => 2,
                'uat1_participants' => $defaultParticipants,
            ], $sitUatData),
        ]);
    }

    private function externalApprover(string $name, string $role, string $phone): array
    {
        return [
            'id' => fake()->uuid(), 'name' => $name, 'role' => $name, 'unit' => 'Divisi Peminta',
            'phone' => $phone, 'isApprover' => true, 'approvalRole' => $role,
            'approvalMode' => 'external_link', 'userId' => null,
        ];
    }

    private function internalApprover(string $name, string $role): array
    {
        return [
            'id' => fake()->uuid(), 'name' => $name, 'role' => $name, 'unit' => 'Divisi TI',
            'phone' => '', 'isApprover' => true, 'approvalRole' => $role,
            'approvalMode' => 'internal_account', 'userId' => $this->admin->id,
        ];
    }

    private function makeTask(Project $project, string $title): ProjectTask
    {
        return ProjectTask::create([
            'project_id' => $project->id,
            'title' => $title,
            'status' => TaskStatus::DONE->value,
        ]);
    }

    private function makeDocument(Project $project, string $documentType): DocumentVault
    {
        return DocumentVault::create([
            'project_id' => $project->id,
            'uploaded_by' => $this->admin->id,
            'document_type' => $documentType,
            'file_path' => "documents/{$project->id}/evidence.pdf",
            'file_name' => "001/GPTD/{$documentType}/bukti.pdf",
            'original_filename' => 'bukti.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);
    }
}
