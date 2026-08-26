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
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Division $division;
    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create(['name' => UserRole::SUPER_ADMIN->value, 'display_name' => 'Super Admin']);
        $this->division = Division::create(['code' => 'IT', 'name' => 'Divisi TI']);
        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $this->project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Tes Dokumen',
            'created_by' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ]);
    }

    public function test_upload_document()
    {
        $file = UploadedFile::fake()->create('test_document.pdf', 100, 'application/pdf');

        $response = $this->actingAs($this->admin)->postJson('/api/v1/documents', [
            'file' => $file,
            'project_id' => $this->project->id,
            'document_type' => 'BRD',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success');
    }

    public function test_list_documents()
    {
        DocumentVault::create([
            'project_id' => $this->project->id,
            'file_name' => 'test.pdf',
            'file_path' => 'documents/test.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'document_type' => 'BRD',
            'uploaded_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin)->getJson('/api/v1/documents');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }

    public function test_delete_document()
    {
        $doc = DocumentVault::create([
            'project_id' => $this->project->id,
            'file_name' => 'test.pdf',
            'file_path' => 'documents/test.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'document_type' => 'BRD',
            'uploaded_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin)->deleteJson("/api/v1/documents/{$doc->id}");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }

    /**
     * Buat satu pemohon beserta proyek yang ia ajukan, lalu isi Document Vault
     * proyek itu dengan satu berkas per tipe pada `$documentTypes`.
     *
     * Seluruh berkas diunggah oleh admin, bukan oleh pemohon, supaya yang diuji
     * benar-benar daftar putih tipe dan bukan pengecualian "berkas unggahan sendiri".
     *
     * @param  list<string>  $documentTypes
     * @return array{0: User, 1: Project, 2: array<string, DocumentVault>}
     */
    private function makeRequesterProjectWithDocuments(array $documentTypes): array
    {
        $requesterRole = Role::create([
            'name' => UserRole::BUSINESS_USER->value,
            'display_name' => 'Business User / Pemohon',
        ]);

        $requester = User::create([
            'name' => 'Pemohon Unit Bisnis',
            'email' => 'pemohon@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $requesterRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Pemohon',
            'created_by' => $requester->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
        ]);

        $documents = [];

        foreach ($documentTypes as $type) {
            $documents[$type] = DocumentVault::create([
                'project_id' => $project->id,
                'file_name' => strtolower($type) . '.pdf',
                'file_path' => 'documents/' . strtolower($type) . '.pdf',
                'file_size' => 2048,
                'mime_type' => 'application/pdf',
                'document_type' => $type,
                'uploaded_by' => $this->admin->id,
            ]);
        }

        return [$requester, $project, $documents];
    }

    public function test_requester_document_list_hides_internal_documents()
    {
        [$requester, $project] = $this->makeRequesterProjectWithDocuments([
            'BRD', 'MEMO', 'UAT_PLAN', 'UAT_SIGNOFF', 'UAT_EVIDENCE',
            'FSD', 'SIT_PLAN', 'SIT_SIGNOFF', 'QA_REPORT', 'CYBER_REPORT', 'RELEASE_PLAN',
        ]);

        $response = $this->actingAs($requester)
            ->getJson("/api/v1/documents?project_id={$project->id}");

        $response->assertStatus(200);

        $types = collect($response->json('data'))->pluck('document_type')->sort()->values()->all();

        $this->assertSame(['BRD', 'MEMO', 'UAT_EVIDENCE', 'UAT_PLAN', 'UAT_SIGNOFF'], $types);
    }

    public function test_requester_project_payload_hides_internal_documents()
    {
        [$requester, $project] = $this->makeRequesterProjectWithDocuments([
            'BRD', 'UAT_RESULT', 'FSD', 'CYBER_REPORT',
        ]);

        $response = $this->actingAs($requester)->getJson("/api/v1/projects/{$project->id}");

        $response->assertStatus(200);

        $types = collect($response->json('data.documents'))->pluck('document_type')->sort()->values()->all();

        $this->assertSame(['BRD', 'UAT_RESULT'], $types);
    }

    public function test_requester_still_sees_own_uploads_of_other_types()
    {
        [$requester, $project] = $this->makeRequesterProjectWithDocuments(['CYBER_REPORT']);

        $ownAttachment = DocumentVault::create([
            'project_id' => $project->id,
            'file_name' => 'lampiran-pemohon.pdf',
            'file_path' => 'documents/lampiran-pemohon.pdf',
            'file_size' => 512,
            'mime_type' => 'application/pdf',
            'document_type' => 'LAMPIRAN',
            'uploaded_by' => $requester->id,
        ]);

        $response = $this->actingAs($requester)
            ->getJson("/api/v1/documents?project_id={$project->id}");

        $response->assertStatus(200);

        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertSame([$ownAttachment->id], $ids);
    }

    public function test_requester_cannot_download_internal_document_by_id()
    {
        [$requester, , $documents] = $this->makeRequesterProjectWithDocuments(['BRD', 'CYBER_REPORT']);

        $this->actingAs($requester)
            ->getJson("/api/v1/documents/{$documents['CYBER_REPORT']->id}/download")
            ->assertStatus(403);

        // Tipe yang diizinkan lolos gerbang wewenang dan berhenti pada pemeriksaan
        // keberadaan berkas fisik — yang memang tidak pernah ditulis di uji ini.
        $this->actingAs($requester)
            ->getJson("/api/v1/documents/{$documents['BRD']->id}/download")
            ->assertStatus(404)
            ->assertJsonPath('message', 'File tidak ditemukan di server.');
    }

    public function test_requester_cannot_delete_internal_document()
    {
        [$requester, , $documents] = $this->makeRequesterProjectWithDocuments(['CYBER_REPORT']);

        $this->actingAs($requester)
            ->deleteJson("/api/v1/documents/{$documents['CYBER_REPORT']->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas($documents['CYBER_REPORT']->getTable(), ['id' => $documents['CYBER_REPORT']->id]);
    }
}
