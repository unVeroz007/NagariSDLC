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
}
