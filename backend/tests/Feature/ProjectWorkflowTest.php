<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Models\ProjectTeamMember;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    /**
     * Developer penanggung jawab task, dibutuhkan gerbang kelulusan SIT.
     *
     * `ProjectWorkflowService` menuntut setiap developer pada
     * `Project::sitApprovalDeveloperIds()` menandatangani persetujuan Tahap 3, dan
     * daftar itu kosong bila proyek tidak punya satu pun task ber-assignee. Nol
     * developer wajib bukan keadaan sah untuk meluluskan SIT karena berarti tidak ada
     * pihak yang bertanggung jawab atas hasil pengujian.
     */
    protected User $developer;

    protected Division $division;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create([
            'name' => UserRole::SUPER_ADMIN->value,
            'display_name' => 'Super Admin',
        ]);

        $developerRole = Role::create([
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

        $this->developer = User::create([
            'name' => 'Developer SIT',
            'email' => 'developer-sit@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $developerRole->id,
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

    public function test_sit_cannot_pass_without_review_or_sign_off_document(): void
    {
        $project = $this->makeSitProject('Proyek SIT Tanpa Berita Acara');

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_PASSED->value,
            'notes' => 'Seluruh pengujian SIT telah selesai.',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath(
                'message',
                'Dokumen Hasil Review / Berita Acara SIT wajib diunggah sebelum SIT dapat dinyatakan lulus.'
            );

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ]);
        $this->assertDatabaseMissing('project_status_histories', [
            'project_id' => $project->id,
            'to_status' => ProjectStatus::SIT_PASSED->value,
        ]);
    }

    public function test_unrelated_document_does_not_satisfy_sit_sign_off_gate(): void
    {
        $project = $this->makeSitProject('Proyek SIT Dengan Dokumen Tidak Sesuai');
        $document = $this->createDocument($project, 'BRD');
        $this->linkDocumentToSitReview($project, $document);

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_PASSED->value,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ]);
    }

    public function test_sign_off_document_must_be_linked_to_sit_review_step(): void
    {
        $project = $this->makeSitProject('Proyek SIT Dengan Dokumen Belum Ditautkan');
        $this->createDocument($project, 'SIT_SIGNOFF');

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_PASSED->value,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ]);
    }

    public function test_sit_can_pass_with_uploaded_sign_off_document(): void
    {
        $project = $this->makeSitProject('Proyek SIT Dengan Berita Acara');
        $task = $this->makeSitTask($project, 'Perbaikan alur transfer');
        $document = $this->createDocument($project, 'SIT_SIGNOFF');
        $this->linkDocumentToSitReview($project, $document);
        $this->completeSitApprovals($project, [$task]);

        $response = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_PASSED->value,
            'notes' => 'Berita acara telah diverifikasi.',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', ProjectStatus::SIT_PASSED->value);

        $this->assertDatabaseHas('project_status_histories', [
            'project_id' => $project->id,
            'from_status' => ProjectStatus::SIT_IN_PROGRESS->value,
            'to_status' => ProjectStatus::SIT_PASSED->value,
        ]);
    }

    /**
     * Berita acara adalah bukti dokumen, bukan bukti persetujuan.
     *
     * Sebelum gerbang kelengkapan Tahap 3 dipasang di `ProjectWorkflowService`,
     * kelengkapan tanda tangan hanya dijaga tombol pada `SITUATWizard.jsx`. Satu
     * permintaan langsung ke `PATCH /projects/{id}/status` karena itu dapat
     * meluluskan SIT tanpa satu pun tanda tangan developer, PM, maupun Pimpinan
     * Grup Pengembangan asalkan berkas berita acaranya sudah tertaut.
     */
    public function test_sit_cannot_pass_when_stage_three_approvals_are_incomplete(): void
    {
        $project = $this->makeSitProject('Proyek SIT Tanpa Tanda Tangan');
        $task = $this->makeSitTask($project, 'Perbaikan alur transfer');
        $document = $this->createDocument($project, 'SIT_SIGNOFF');
        $this->linkDocumentToSitReview($project, $document);

        // Task sudah disetujui pada Eksekusi Pengujian, tetapi seluruh slot tanda tangan
        // Tahap 3 masih kosong — inilah celah yang ditutup gerbang tersebut.
        $project->update([
            'sit_uat_data' => [
                ...(array) $project->sit_uat_data,
                'sit2_task_approvals' => ["task_{$task->id}" => ['approved' => true]],
            ],
        ]);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_PASSED->value,
        ])
            ->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ]);
    }

    private function makeSitProject(string $title): Project
    {
        return Project::create([
            'req_id' => Project::generateReqId(),
            'title' => $title,
            'created_by' => $this->admin->id,
            'pm_id' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ]);
    }

    /**
     * Task SIT beserta keanggotaan timnya.
     *
     * `Project::sitApprovalDeveloperIds()` menggabungkan assignee task dengan anggota
     * tim berperan developer, jadi keduanya dibuat sekaligus supaya daftar developer
     * wajib tetap satu orang dan fixture tidak menuntut tanda tangan yang tak terduga.
     */
    private function makeSitTask(Project $project, string $title): ProjectTask
    {
        ProjectTeamMember::firstOrCreate([
            'project_id' => $project->id,
            'user_id' => $this->developer->id,
        ], [
            'role_in_project' => 'developer',
            'assigned_by' => $this->admin->id,
        ]);

        return ProjectTask::create([
            'project_id' => $project->id,
            'title' => $title,
            'status' => TaskStatus::DONE->value,
            'assignee_id' => $this->developer->id,
        ]);
    }

    /**
     * Isi seluruh prasyarat persetujuan SIT putaran pertama.
     *
     * Empat hal yang dituntut `ProjectWorkflowService`: setiap task pada scope SIT
     * disetujui di Eksekusi Pengujian (`sit2_task_approvals`), setiap developer wajib
     * menandatangani (`sit3_approvals.developer.developers`), lalu slot PM dan
     * Pimpinan Grup Pengembangan terisi.
     *
     * @param  array<int, ProjectTask>  $tasks
     */
    private function completeSitApprovals(Project $project, array $tasks): void
    {
        $taskApprovals = [];
        foreach ($tasks as $task) {
            // Prefix `task_` adalah bentuk yang ditulis `SITUATWizard.jsx`; pembacanya
            // (`ProjectWorkflowService::sitTaskApproval()`) menerima ketiga bentuk kunci,
            // dan fixture memakai bentuk yang benar-benar diproduksi frontend.
            $taskApprovals["task_{$task->id}"] = [
                'approved' => true,
                'approvedAt' => now()->toIso8601String(),
                'approvedById' => $this->developer->id,
            ];
        }

        $project->update([
            'sit_uat_data' => [
                ...(array) $project->sit_uat_data,
                'sit2_task_approvals' => $taskApprovals,
                'sit3_approvals' => [
                    'developer' => [
                        'developers' => [[
                            'userId' => $this->developer->id,
                            'name' => $this->developer->name,
                            'approvedAt' => now()->toIso8601String(),
                        ]],
                    ],
                    'pm' => [
                        'approved' => true,
                        'userId' => $this->admin->id,
                        'approvedAt' => now()->toIso8601String(),
                    ],
                    'development_lead' => [
                        'approved' => true,
                        'userId' => $this->admin->id,
                        'approvedAt' => now()->toIso8601String(),
                    ],
                ],
            ],
        ]);
    }

    private function createDocument(Project $project, string $documentType): DocumentVault
    {
        return DocumentVault::create([
            'project_id' => $project->id,
            'uploaded_by' => $this->admin->id,
            'document_type' => $documentType,
            'file_path' => "documents/{$project->id}/sit-sign-off.pdf",
            'file_name' => '001/GPTD/SIT_SIGNOFF/Berita_Acara_SIT.pdf',
            'original_filename' => 'berita-acara-sit.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);
    }

    private function linkDocumentToSitReview(Project $project, DocumentVault $document): void
    {
        $project->update([
            'sit_uat_data' => [
                'sit3_docs' => [[
                    'docId' => $document->id,
                    'doc_type' => $document->document_type,
                ]],
            ],
        ]);
    }
}
