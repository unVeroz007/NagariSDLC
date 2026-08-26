<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\ProjectStatusHistory;
use App\Models\ProjectTask;
use App\Models\ProjectTeamMember;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Gerbang kelengkapan SIT putaran pertama dan cakupan penyetujunya.
 *
 * Dua cacat yang diuji di sini pernah hidup bersamaan:
 *
 *   1. Kelengkapan tanda tangan Tahap 3 hanya dijaga tombol pada `SITUATWizard.jsx`.
 *      Gerbang SIT ULANG di `ProjectWorkflowService::validateTransitionPrerequisites()`
 *      sudah ketat, tetapi putaran pertama hanya menuntut berita acara terunggah —
 *      sehingga satu permintaan langsung `PATCH /projects/{id}/status` dapat meluluskan
 *      SIT tanpa satu pun persetujuan developer, PM, maupun Pimpinan Grup Pengembangan.
 *
 *   2. Slot `development_lead` tidak punya pemeriksaan cakupan per proyek, sedangkan
 *      inbox `GET /me/sit-approvals` menyaring dengan aturannya sendiri. Daftar
 *      pekerjaan dan yang benar-benar diterima server karena itu bisa berbeda —
 *      dan perbedaan itulah cacatnya, bukan salah satu sisinya.
 */
class SitFirstRoundGateTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $developer;

    private User $pm;

    private User $projectDevLead;

    private User $foreignDevLead;

    private Division $division;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create(['name' => UserRole::SUPER_ADMIN->value, 'display_name' => 'Super Admin']);
        $developerRole = Role::create(['name' => UserRole::DEVELOPER->value, 'display_name' => 'Developer']);
        $pmRole = Role::create(['name' => UserRole::PROJECT_MANAGER->value, 'display_name' => 'Analis Pengembangan']);
        $devLeadRole = Role::create([
            'name' => UserRole::DEVELOPMENT_LEAD->value,
            'display_name' => 'Pimpinan Grup Pengembangan',
        ]);

        $this->division = Division::create(['code' => 'IT-DEV', 'name' => 'Divisi Pengembangan TI']);

        $this->admin = $this->makeUser($adminRole, 'Super Admin', 'admin-sit-gate@nagari.co.id');
        $this->developer = $this->makeUser($developerRole, 'Developer SIT', 'dev-sit-gate@nagari.co.id');
        $this->pm = $this->makeUser($pmRole, 'Analis Pengembangan', 'pm-sit-gate@nagari.co.id');
        // Dua Pimpinan Grup Pengembangan yang keduanya dapat MELIHAT proyek fase
        // pengembangan. Pembedanya hanya jejak disposisi, jadi fixture ini yang
        // membuktikan pemeriksaan cakupan benar-benar bekerja.
        $this->projectDevLead = $this->makeUser($devLeadRole, 'Pimpinan Grup Proyek', 'lead-in@nagari.co.id');
        $this->foreignDevLead = $this->makeUser($devLeadRole, 'Pimpinan Grup Lain', 'lead-out@nagari.co.id');
    }

    // ---------------------------------------------------------------------
    // Gerbang kelengkapan SIT putaran pertama
    // ---------------------------------------------------------------------

    public function test_first_round_sit_refused_when_a_task_approval_is_missing(): void
    {
        $project = $this->makeSitProject();
        $task = $this->makeSitTask($project);
        $this->attachSignOffDocument($project);
        // Seluruh tanda tangan Tahap 3 lengkap, tetapi task-nya belum disetujui pada
        // Eksekusi Pengujian. Nomor task ikut disebut agar pengguna tahu mana yang kurang.
        $this->mergeSitData($project, [
            'sit2_task_approvals' => [],
            'sit3_approvals' => $this->completeStageThreeApprovals(),
        ]);

        $this->attemptSitPass($project)
            ->assertStatus(422)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath(
                'message',
                'Semua task dalam scope SIT harus disetujui pada Eksekusi Pengujian sebelum SIT dinyatakan lulus. Task yang belum disetujui: '.$task->id.'.'
            );

        $this->assertSitStillInProgress($project);
    }

    public function test_first_round_sit_refused_when_a_developer_signature_is_missing(): void
    {
        $project = $this->makeSitProject();
        $task = $this->makeSitTask($project);
        $this->attachSignOffDocument($project);
        $approvals = $this->completeStageThreeApprovals();
        $approvals['developer']['developers'] = [];

        $this->mergeSitData($project, [
            'sit2_task_approvals' => $this->approvedTaskApprovals([$task]),
            'sit3_approvals' => $approvals,
        ]);

        $this->attemptSitPass($project)
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Semua developer pada tim proyek wajib memberikan persetujuan SIT. Developer yang belum menyetujui: '.$this->developer->id.'.'
            );

        $this->assertSitStillInProgress($project);
    }

    /**
     * Nol developer wajib bukan keadaan lengkap, melainkan keadaan tanpa penanggung jawab.
     *
     * `Project::sitApprovalDeveloperIds()` kosong bila proyek tidak punya satu pun task
     * ber-assignee maupun anggota tim berperan developer. Tanpa aturan ini, "semua
     * developer sudah menyetujui" bernilai benar secara hampa dan SIT lulus tanpa
     * seorang pun bertanggung jawab atas hasilnya — persis penilaian yang sudah dipakai
     * `ProjectController::sitApprovalStatus()` untuk mengunci tombol di layar.
     */
    public function test_first_round_sit_refused_when_project_has_no_responsible_developer(): void
    {
        $project = $this->makeSitProject();
        $this->attachSignOffDocument($project);
        $this->mergeSitData($project, [
            'sit2_task_approvals' => [],
            'sit3_approvals' => $this->completeStageThreeApprovals(),
        ]);

        $this->attemptSitPass($project)
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'SIT tidak dapat diluluskan karena proyek belum memiliki developer penanggung jawab task yang dapat memberikan persetujuan.'
            );

        $this->assertSitStillInProgress($project);
    }

    public function test_first_round_sit_refused_when_pm_signature_is_missing(): void
    {
        $project = $this->makeSitProject();
        $task = $this->makeSitTask($project);
        $this->attachSignOffDocument($project);
        $approvals = $this->completeStageThreeApprovals();
        unset($approvals['pm']);

        $this->mergeSitData($project, [
            'sit2_task_approvals' => $this->approvedTaskApprovals([$task]),
            'sit3_approvals' => $approvals,
        ]);

        $this->attemptSitPass($project)
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Persetujuan Analyst / Project Manager wajib ada sebelum SIT dinyatakan lulus.'
            );

        $this->assertSitStillInProgress($project);
    }

    /**
     * Slot PM yang tersimpan bernilai null tetap dianggap belum menandatangani.
     *
     * `$approvals['pm']['approved'] ?? false` juga menelan nilai `null` yang benar-benar
     * tersimpan, jadi keberadaan kunci diperiksa terpisah dari nilainya supaya jelas
     * bahwa yang diuji adalah "kunci ada tetapi belum disetujui", bukan "kunci hilang".
     */
    public function test_first_round_sit_refused_when_pm_slot_exists_but_holds_null(): void
    {
        $project = $this->makeSitProject();
        $task = $this->makeSitTask($project);
        $this->attachSignOffDocument($project);
        $approvals = $this->completeStageThreeApprovals();
        $approvals['pm'] = ['approved' => null];

        $this->mergeSitData($project, [
            'sit2_task_approvals' => $this->approvedTaskApprovals([$task]),
            'sit3_approvals' => $approvals,
        ]);

        $storedPm = $project->fresh()->sit_uat_data['sit3_approvals']['pm'];
        $this->assertArrayHasKey('approved', $storedPm);
        $this->assertNull($storedPm['approved']);

        $this->attemptSitPass($project)
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Persetujuan Analyst / Project Manager wajib ada sebelum SIT dinyatakan lulus.'
            );

        $this->assertSitStillInProgress($project);
    }

    public function test_first_round_sit_refused_when_development_lead_signature_is_missing(): void
    {
        $project = $this->makeSitProject();
        $task = $this->makeSitTask($project);
        $this->attachSignOffDocument($project);
        $approvals = $this->completeStageThreeApprovals();
        unset($approvals['development_lead']);

        $this->mergeSitData($project, [
            'sit2_task_approvals' => $this->approvedTaskApprovals([$task]),
            'sit3_approvals' => $approvals,
        ]);

        $this->attemptSitPass($project)
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Persetujuan Pimpinan Grup Pengembangan wajib ada sebelum SIT dinyatakan lulus.'
            );

        $this->assertSitStillInProgress($project);
    }

    public function test_first_round_sit_passes_when_stage_three_is_complete(): void
    {
        $project = $this->makeSitProject();
        $task = $this->makeSitTask($project);
        $this->attachSignOffDocument($project);
        $this->mergeSitData($project, [
            'sit2_task_approvals' => $this->approvedTaskApprovals([$task]),
            'sit3_approvals' => $this->completeStageThreeApprovals(),
        ]);

        $this->attemptSitPass($project)
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', ProjectStatus::SIT_PASSED->value);

        $this->assertDatabaseHas('project_status_histories', [
            'project_id' => $project->id,
            'from_status' => ProjectStatus::SIT_IN_PROGRESS->value,
            'to_status' => ProjectStatus::SIT_PASSED->value,
        ]);
    }

    /**
     * Kunci `sit2_task_approvals` berbentuk angka pun tetap terbaca.
     *
     * Tiga bentuk kunci sama-sama sudah tersimpan di produksi (integer, string angka,
     * dan berawalan `task_`). Gerbang putaran pertama memakai pencari toleran yang sama
     * dengan gerbang SIT ulang, jadi bentuk mana pun tidak boleh menahan kelulusan.
     */
    public function test_first_round_sit_accepts_numeric_task_approval_keys(): void
    {
        $project = $this->makeSitProject();
        $task = $this->makeSitTask($project);
        $this->attachSignOffDocument($project);
        $this->mergeSitData($project, [
            'sit2_task_approvals' => [(string) $task->id => ['approved' => true]],
            'sit3_approvals' => $this->completeStageThreeApprovals(),
        ]);

        $this->attemptSitPass($project)->assertOk();
    }

    // ---------------------------------------------------------------------
    // Cakupan slot `development_lead`: gerbang dan inbox harus sepakat
    // ---------------------------------------------------------------------

    public function test_development_lead_outside_project_scope_cannot_approve_sit(): void
    {
        $project = $this->makeStageThreeProject();

        $this->actingAs($this->foreignDevLead)
            ->postJson("/api/v1/projects/{$project->id}/sit-approval", ['note' => 'Ikut menyetujui.'])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Proyek ini berada di luar cakupan persetujuan SIT Anda.');

        // Inbox wajib sepakat dengan gerbangnya: proyek yang keputusannya akan ditolak
        // tidak boleh pernah tampil sebagai pekerjaan yang menunggu tanda tangannya.
        $this->actingAs($this->foreignDevLead)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->assertJsonPath('data.pending_count', 0)
            ->assertJsonCount(0, 'data.items');

        $this->assertArrayNotHasKey(
            'development_lead',
            (array) ($project->fresh()->sit_uat_data['sit3_approvals'] ?? [])
        );
    }

    public function test_development_lead_of_the_project_can_approve_sit(): void
    {
        $project = $this->makeStageThreeProject();

        $this->actingAs($this->projectDevLead)
            ->postJson("/api/v1/projects/{$project->id}/sit-approval", ['note' => 'Disetujui.'])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertTrue(
            $project->fresh()->sit_uat_data['sit3_approvals']['development_lead']['approved']
        );

        $this->actingAs($this->projectDevLead)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.approval_role', 'development_lead')
            ->assertJsonPath('data.items.0.status', 'approved')
            ->assertJsonPath('data.items.0.project.id', $project->id);
    }

    /**
     * Sebelum Tahap 3, keputusan SIT tidak dapat dititipkan.
     *
     * Inbox sudah menyembunyikan proyek yang eksekusi pengujiannya belum difinalkan,
     * tetapi gerbangnya dahulu tetap menerima tanda tangan — tanda tangan yang bahkan
     * tidak muncul di halaman "Persetujuan Saya" milik penandatangannya sendiri.
     */
    public function test_sit_approval_before_stage_three_is_refused_and_absent_from_inbox(): void
    {
        $project = $this->makeSitProject();
        $this->makeSitTask($project);
        $this->recordDevLeadDisposition($project);

        $this->actingAs($this->projectDevLead)
            ->postJson("/api/v1/projects/{$project->id}/sit-approval")
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Persetujuan SIT baru dapat diberikan setelah eksekusi pengujian difinalkan dan proyek berada pada Tahap 3 Review & Sign-off.'
            );

        $this->actingAs($this->projectDevLead)
            ->getJson('/api/v1/me/sit-approvals')
            ->assertOk()
            ->assertJsonCount(0, 'data.items');
    }

    // ---------------------------------------------------------------------
    // Fixture
    // ---------------------------------------------------------------------

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

    private function makeSitProject(): Project
    {
        return Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Gerbang SIT',
            'created_by' => $this->admin->id,
            'pm_id' => $this->pm->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ]);
    }

    /**
     * Proyek SIT yang formulir persetujuan Tahap 3-nya sudah terbuka dan sudah punya
     * jejak disposisi Pimpinan Grup Pengembangan.
     */
    private function makeStageThreeProject(): Project
    {
        $project = $this->makeSitProject();
        $this->makeSitTask($project);
        $this->recordDevLeadDisposition($project);
        $this->mergeSitData($project, ['activeSitStep' => 3]);

        return $project;
    }

    /**
     * Task SIT beserta keanggotaan timnya.
     *
     * Keduanya dibuat sekaligus karena `Project::sitApprovalDeveloperIds()` menggabungkan
     * assignee task dengan anggota tim berperan developer; membuat salah satunya saja
     * membuat daftar developer wajib berbeda dari yang dimaksud fixture.
     */
    private function makeSitTask(Project $project): ProjectTask
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
            'title' => 'Perbaikan alur transfer',
            'status' => TaskStatus::DONE->value,
            'assignee_id' => $this->developer->id,
        ]);
    }

    /**
     * Jejak disposisi yang menautkan seorang Pimpinan Grup Pengembangan ke proyek ini.
     *
     * Transisi ke `DEV_ANALYSIS` hanya dapat dilakukan `development_lead` atau
     * `super_admin`, sehingga baris riwayat inilah satu-satunya bukti per proyek yang
     * benar-benar dimiliki skema — `projects` tidak punya `dev_lead_id`.
     */
    private function recordDevLeadDisposition(Project $project): void
    {
        ProjectStatusHistory::create([
            'project_id' => $project->id,
            'from_status' => ProjectStatus::READY_FOR_DEVELOPMENT->value,
            'to_status' => ProjectStatus::DEV_ANALYSIS->value,
            'changed_by' => $this->projectDevLead->id,
            'notes' => 'Didisposisikan untuk analisis pengembangan.',
        ]);
    }

    private function attachSignOffDocument(Project $project): void
    {
        $document = DocumentVault::create([
            'project_id' => $project->id,
            'uploaded_by' => $this->admin->id,
            'document_type' => 'SIT_SIGNOFF',
            'file_path' => "documents/{$project->id}/berita-acara-sit.pdf",
            'file_name' => '001/GPTD/SIT_SIGNOFF/Berita_Acara_SIT.pdf',
            'original_filename' => 'berita-acara-sit.pdf',
            'file_size' => 2048,
            'mime_type' => 'application/pdf',
        ]);

        $this->mergeSitData($project, [
            'sit3_docs' => [[
                'docId' => $document->id,
                'doc_type' => $document->document_type,
            ]],
        ]);
    }

    /**
     * @param  array<string, mixed>  $patch
     */
    private function mergeSitData(Project $project, array $patch): void
    {
        $project->refresh();
        $project->update(['sit_uat_data' => [...(array) $project->sit_uat_data, ...$patch]]);
    }

    /**
     * @param  array<int, ProjectTask>  $tasks
     * @return array<string, array<string, mixed>>
     */
    private function approvedTaskApprovals(array $tasks): array
    {
        $approvals = [];
        foreach ($tasks as $task) {
            // Bentuk berawalan `task_` adalah yang benar-benar ditulis `SITUATWizard.jsx`.
            $approvals["task_{$task->id}"] = [
                'approved' => true,
                'approvedAt' => now()->toIso8601String(),
                'approvedById' => $this->developer->id,
            ];
        }

        return $approvals;
    }

    /**
     * @return array<string, mixed>
     */
    private function completeStageThreeApprovals(): array
    {
        return [
            'developer' => [
                'developers' => [[
                    'userId' => $this->developer->id,
                    'name' => $this->developer->name,
                    'approvedAt' => now()->toIso8601String(),
                ]],
            ],
            'pm' => [
                'approved' => true,
                'userId' => $this->pm->id,
                'approvedAt' => now()->toIso8601String(),
            ],
            'development_lead' => [
                'approved' => true,
                'userId' => $this->projectDevLead->id,
                'approvedAt' => now()->toIso8601String(),
            ],
        ];
    }

    private function attemptSitPass(Project $project): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_PASSED->value,
        ]);
    }

    private function assertSitStillInProgress(Project $project): void
    {
        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ]);
        $this->assertDatabaseMissing('project_status_histories', [
            'project_id' => $project->id,
            'to_status' => ProjectStatus::SIT_PASSED->value,
        ]);
    }
}
