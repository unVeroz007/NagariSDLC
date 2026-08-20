<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\DocumentVault;
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
        $document = $this->createDocument($project, 'SIT_SIGNOFF');
        $this->linkDocumentToSitReview($project, $document);

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

    private function makeSitProject(string $title): Project
    {
        return Project::create([
            'req_id' => Project::generateReqId(),
            'title' => $title,
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
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
