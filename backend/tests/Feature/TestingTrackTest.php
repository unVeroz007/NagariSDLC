<?php

namespace Tests\Feature;

use App\Enums\CyberCheckType;
use App\Enums\ProjectStatus;
use App\Enums\TestResult;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Empat langkah jalur pengujian QA dan Audit Keamanan Siber.
 *
 * Yang dikunci pengujian ini adalah hal-hal yang mudah luruh saat kode berubah:
 *
 * 1. Urutan langkah tidak dapat dilewati — laporan sebelum disposisi dan sign-off
 *    sebelum laporan keduanya ditolak.
 * 2. Langkah 3 (laporan pelaksana) tidak menutup jalur; hanya sign-off Lead yang
 *    memindahkan jalur ke PASSED atau FAILED. Pemisahan inilah alasan
 *    `TestingTrackService` dibuat, jadi kemundurannya harus terlihat sebagai gagal.
 * 3. Kolom jalur adalah kebenaran, `projects.status` hanya penunjuk siklus yang
 *    bergerak menyusul — jalur Siber tidak menggerakkannya saat diajukan.
 * 4. Gerbang masuk fase: pengujian baru dapat diajukan setelah pengembangan selesai.
 * 5. `PATCH /projects/{id}` tidak dapat dipakai memalsukan kemajuan jalur.
 */
class TestingTrackTest extends TestCase
{
    use RefreshDatabase;

    private Division $division;

    /**
     * @var array<string, Role>
     */
    private array $roles = [];

    private User $pm;

    private User $qaLead;

    private User $qaTester;

    private User $cyberLead;

    private User $pentester;

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create([
            'code' => 'IT-QA',
            'name' => 'Divisi Teknologi Informasi',
        ]);

        $this->pm = $this->makeUser(UserRole::PROJECT_MANAGER, 'Analis Pengembangan', 'pm-track@nagari.co.id');
        $this->qaLead = $this->makeUser(UserRole::QA_LEAD, 'QA Lead', 'qa-lead@nagari.co.id');
        $this->qaTester = $this->makeUser(UserRole::QA_TESTER, 'QA Tester', 'qa-tester@nagari.co.id');
        $this->cyberLead = $this->makeUser(UserRole::CYBER_LEAD, 'Cyber Lead', 'cyber-lead@nagari.co.id');
        $this->pentester = $this->makeUser(UserRole::PENTESTER, 'Pentester', 'pentester@nagari.co.id');
    }

    public function test_qa_track_runs_through_its_four_steps(): void
    {
        $project = $this->makeProject('Proyek Jalur QA');

        // Langkah 1 — PM mengajukan. Jalur QA punya status utama khusus untuk
        // "sudah diajukan, menunggu disposisi", jadi penunjuk siklus ikut bergerak.
        $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
            'staging_url' => 'https://staging.banknagari.co.id/los',
            'target_completion_date' => now()->addDays(7)->format('Y-m-d'),
            'notes' => 'Modul simulasi kredit siap diuji.',
        ])->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::SUBMITTED->value)
            ->assertJsonPath('data.status', ProjectStatus::READY_FOR_QA->value)
            ->assertJsonPath('data.staging_url', 'https://staging.banknagari.co.id/los');

        // Langkah 2 — QA Lead mendisposisikan pengujian kepada tester.
        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/assign', [
            'project_id' => $project->id,
            'assignee_id' => $this->qaTester->id,
            'notes' => 'Prioritaskan skenario simulasi angsuran.',
        ])->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::IN_PROGRESS->value)
            ->assertJsonPath('data.qa_assignee_id', $this->qaTester->id)
            ->assertJsonPath('data.status', ProjectStatus::QA_IN_PROGRESS->value);

        // Langkah 3 — tester mengirim laporan. Jalur berhenti di REVIEW: status utama
        // tetap QA_IN_PROGRESS karena keputusan lulus belum ada.
        $evidence = $this->makeDocument($project, DocumentVault::QA_EVIDENCE_TYPE);

        $this->actingAs($this->qaTester)->postJson('/api/v1/qa-requests/report', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
            'notes' => 'Seluruh skenario fungsional berjalan sesuai kebutuhan.',
            'tested_scenarios' => "- Simulasi angsuran nominal normal\n- Cetak laporan mutasi",
            'evidence_document_ids' => [$evidence->id],
        ])->assertCreated()
            ->assertJsonPath('data.test_type', 'qa')
            ->assertJsonPath('data.result', TestResult::PASS->value)
            ->assertJsonPath('data.is_reviewed', false)
            ->assertJsonPath('data.tested_scenarios', "- Simulasi angsuran nominal normal\n- Cetak laporan mutasi")
            ->assertJsonPath('data.evidence_document_ids.0', $evidence->id);

        $this->assertSame(TrackStatus::REVIEW, $project->fresh()->qaTrackStatus());
        $this->assertSame(ProjectStatus::QA_IN_PROGRESS, $project->fresh()->status);

        // Langkah 4 — QA Lead menutup jalur.
        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/sign-off', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
            'notes' => 'Hasil pengujian diterima.',
        ])->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::PASSED->value)
            ->assertJsonPath('data.status', ProjectStatus::QA_PASSED->value);

        $this->assertDatabaseHas('test_reports', [
            'project_id' => $project->id,
            'test_type' => 'qa',
            'tester_id' => $this->qaTester->id,
            'result' => TestResult::PASS->value,
            'reviewed_by' => $this->qaLead->id,
            'reviewed_result' => TestResult::PASS->value,
        ]);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'update_project_track_status',
            'subject_id' => $project->id,
        ]);
    }

    public function test_cyber_track_runs_through_its_four_steps_without_moving_main_status_on_submission(): void
    {
        $project = $this->makeProject('Proyek Audit Siber');

        $this->actingAs($this->pm)->postJson('/api/v1/cyber-requests/submit', [
            'project_id' => $project->id,
            'cyber_check_type' => CyberCheckType::PENTEST->value,
            'cyber_target_url' => 'https://staging.banknagari.co.id/los',
            'notes' => 'Mohon diaudit sebelum rilis.',
        ])->assertOk()
            ->assertJsonPath('data.cyber_status', TrackStatus::SUBMITTED->value)
            ->assertJsonPath('data.cyber_check_type', CyberCheckType::PENTEST->value)
            ->assertJsonPath('data.cyber_target_url', 'https://staging.banknagari.co.id/los')
            // Jalur Siber tidak punya padanan READY_FOR_QA, jadi penunjuk siklus
            // utama sengaja dibiarkan sampai disposisi Lead.
            ->assertJsonPath('data.status', ProjectStatus::DEV_COMPLETED->value);

        $this->actingAs($this->cyberLead)->postJson('/api/v1/cyber-requests/assign', [
            'project_id' => $project->id,
            'assignee_id' => $this->pentester->id,
        ])->assertOk()
            ->assertJsonPath('data.cyber_status', TrackStatus::IN_PROGRESS->value)
            ->assertJsonPath('data.cyber_assignee_id', $this->pentester->id)
            ->assertJsonPath('data.status', ProjectStatus::CYBER_IN_PROGRESS->value);

        $this->actingAs($this->pentester)->postJson('/api/v1/cyber-requests/report', [
            'project_id' => $project->id,
            'result' => TestResult::CONDITIONAL_PASS->value,
            'severity' => 'low',
            'notes' => 'Dua temuan informasional, tidak memblokir rilis.',
        ])->assertCreated()
            ->assertJsonPath('data.test_type', 'cyber')
            ->assertJsonPath('data.result', TestResult::CONDITIONAL_PASS->value);

        $this->assertSame(TrackStatus::REVIEW, $project->fresh()->cyberTrackStatus());

        // Penilaian pelaksana "lulus dengan catatan" tetap dapat ditutup Lead sebagai
        // lulus; kedua nilai disimpan berdampingan sebagai jejak audit.
        $this->actingAs($this->cyberLead)->postJson('/api/v1/cyber-requests/sign-off', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
            'notes' => 'Temuan informasional dicatat sebagai backlog, rilis dilanjutkan.',
        ])->assertOk()
            ->assertJsonPath('data.cyber_status', TrackStatus::PASSED->value)
            ->assertJsonPath('data.status', ProjectStatus::CYBER_PASSED->value);

        $this->assertDatabaseHas('test_reports', [
            'project_id' => $project->id,
            'test_type' => 'cyber',
            'result' => TestResult::CONDITIONAL_PASS->value,
            'reviewed_result' => TestResult::PASS->value,
            'reviewed_by' => $this->cyberLead->id,
        ]);
    }

    public function test_pentest_submission_requires_target_url(): void
    {
        $project = $this->makeProject('Proyek Pentest Tanpa Target');

        $this->actingAs($this->pm)->postJson('/api/v1/cyber-requests/submit', [
            'project_id' => $project->id,
            'cyber_check_type' => CyberCheckType::PENTEST->value,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['cyber_target_url']);

        $this->assertSame(TrackStatus::NOT_SUBMITTED, $project->fresh()->cyberTrackStatus());
    }

    public function test_secure_code_submission_requires_source_code_reference_and_clears_target_url(): void
    {
        $project = $this->makeProject('Proyek Secure Code Review');

        $this->actingAs($this->pm)->postJson('/api/v1/cyber-requests/submit', [
            'project_id' => $project->id,
            'cyber_check_type' => CyberCheckType::SECURE_CODE->value,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['cyber_source_code_ref']);

        // Alamat target yang ikut terkirim tidak relevan untuk Secure Code Review dan
        // wajib dikosongkan, supaya Pentester tidak mengerjakan ruang lingkup lama.
        $this->actingAs($this->pm)->postJson('/api/v1/cyber-requests/submit', [
            'project_id' => $project->id,
            'cyber_check_type' => CyberCheckType::SECURE_CODE->value,
            'cyber_source_code_ref' => 'git@internal.banknagari.co.id:los/backend.git branch release/1.4',
            'cyber_target_url' => 'https://staging.banknagari.co.id/los',
        ])->assertOk()
            ->assertJsonPath('data.cyber_check_type', CyberCheckType::SECURE_CODE->value)
            ->assertJsonPath('data.cyber_source_code_ref', 'git@internal.banknagari.co.id:los/backend.git branch release/1.4')
            ->assertJsonPath('data.cyber_target_url', null);
    }

    public function test_testing_cannot_be_requested_before_development_is_completed(): void
    {
        $project = $this->makeProject('Proyek Masih Dikembangkan', ProjectStatus::IN_DEVELOPMENT);

        $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->actingAs($this->pm)->postJson('/api/v1/cyber-requests/submit', [
            'project_id' => $project->id,
            'cyber_check_type' => CyberCheckType::PENTEST->value,
            'cyber_target_url' => 'https://staging.banknagari.co.id/los',
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $fresh = $project->fresh();
        $this->assertSame(TrackStatus::NOT_SUBMITTED, $fresh->qaTrackStatus());
        $this->assertSame(TrackStatus::NOT_SUBMITTED, $fresh->cyberTrackStatus());
        $this->assertSame(ProjectStatus::IN_DEVELOPMENT, $fresh->status);
    }

    public function test_only_the_assigned_project_manager_may_request_testing(): void
    {
        $project = $this->makeProject('Proyek PM Lain');
        $otherPm = $this->makeUser(UserRole::PROJECT_MANAGER, 'Analis Pengembangan Lain', 'pm-lain@nagari.co.id');

        $this->actingAs($otherPm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
        ])->assertStatus(403);

        $this->assertSame(TrackStatus::NOT_SUBMITTED, $project->fresh()->qaTrackStatus());
    }

    public function test_duplicate_submission_of_a_running_track_is_rejected(): void
    {
        $project = $this->makeProject('Proyek Pengajuan Ganda');

        $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
        ])->assertOk();

        $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');
    }

    public function test_report_cannot_be_submitted_before_the_lead_assigns_a_tester(): void
    {
        $project = $this->makeProject('Proyek Laporan Mendahului Disposisi');

        $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
        ])->assertOk();

        $this->actingAs($this->qaTester)->postJson('/api/v1/qa-requests/report', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertSame(TrackStatus::SUBMITTED, $project->fresh()->qaTrackStatus());
        $this->assertDatabaseMissing('test_reports', ['project_id' => $project->id]);
    }

    public function test_a_tester_without_the_disposition_cannot_submit_the_report(): void
    {
        $project = $this->makeProject('Proyek Disposisi Orang Lain');
        $otherTester = $this->makeUser(UserRole::QA_TESTER, 'QA Tester Lain', 'qa-tester-lain@nagari.co.id');

        $this->submitAndAssignQa($project);

        $this->actingAs($otherTester)->postJson('/api/v1/qa-requests/report', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseMissing('test_reports', ['project_id' => $project->id]);
    }

    public function test_disposition_target_must_hold_a_tester_role_of_that_track(): void
    {
        $project = $this->makeProject('Proyek Disposisi Salah Peran');

        $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
        ])->assertOk();

        // Pentester adalah pelaksana jalur Siber, bukan jalur QA.
        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/assign', [
            'project_id' => $project->id,
            'assignee_id' => $this->pentester->id,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertNull($project->fresh()->qa_assignee_id);
    }

    public function test_sign_off_requires_a_submitted_report(): void
    {
        $project = $this->makeProject('Proyek Sign-off Mendahului Laporan');

        $this->submitAndAssignQa($project);

        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/sign-off', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertSame(TrackStatus::IN_PROGRESS, $project->fresh()->qaTrackStatus());
    }

    public function test_only_the_track_lead_may_sign_off(): void
    {
        $project = $this->makeProject('Proyek Sign-off Bukan Lead');

        $this->submitAndAssignQa($project);
        $this->actingAs($this->qaTester)->postJson('/api/v1/qa-requests/report', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
        ])->assertCreated();

        // Cyber Lead adalah Lead jalur lain, sehingga tidak berwenang di sini.
        $this->actingAs($this->cyberLead)->postJson('/api/v1/qa-requests/sign-off', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertSame(TrackStatus::REVIEW, $project->fresh()->qaTrackStatus());
    }

    public function test_failed_sign_off_returns_project_to_development_and_voids_the_other_passed_track(): void
    {
        $project = $this->makeProject('Proyek Defect QA');

        $this->submitAndAssignQa($project);
        $this->actingAs($this->qaTester)->postJson('/api/v1/qa-requests/report', [
            'project_id' => $project->id,
            'result' => TestResult::FAIL->value,
            'severity' => 'high',
            'notes' => 'Perhitungan bunga tidak sesuai ketentuan.',
        ])->assertCreated();

        // Jalur Siber sudah lulus lebih dulu. Karena kode akan berubah, kelulusan itu
        // tidak lagi berlaku dan jalurnya wajib diajukan ulang.
        $project->update(['cyber_status' => TrackStatus::PASSED->value]);

        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/sign-off', [
            'project_id' => $project->id,
            'result' => TestResult::FAIL->value,
            'notes' => 'Dikembalikan ke pengembangan untuk perbaikan perhitungan bunga.',
        ])->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::FAILED->value)
            ->assertJsonPath('data.cyber_status', TrackStatus::NOT_SUBMITTED->value)
            ->assertJsonPath('data.status', ProjectStatus::RETURN_TO_DEV->value);

        $this->assertDatabaseHas('project_status_histories', [
            'project_id' => $project->id,
            'to_status' => ProjectStatus::RETURN_TO_DEV->value,
        ]);
    }

    public function test_project_returned_for_a_defect_may_be_resubmitted_directly(): void
    {
        $project = $this->makeProject('Proyek Ajukan Ulang', ProjectStatus::RETURN_TO_DEV);
        $project->update(['qa_status' => TrackStatus::FAILED->value]);

        $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
            'notes' => 'Perhitungan bunga sudah diperbaiki.',
        ])->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::SUBMITTED->value)
            ->assertJsonPath('data.status', ProjectStatus::READY_FOR_QA->value);
    }

    public function test_passed_track_cannot_be_resubmitted(): void
    {
        $project = $this->makeProject('Proyek Sudah Lulus QA');
        $project->update(['qa_status' => TrackStatus::PASSED->value]);

        $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');
    }

    public function test_evidence_from_another_project_is_rejected(): void
    {
        $project = $this->makeProject('Proyek Bukti Milik Orang Lain');
        $otherProject = $this->makeProject('Proyek Sumber Bukti');
        $foreignEvidence = $this->makeDocument($otherProject, DocumentVault::QA_EVIDENCE_TYPE);

        $this->submitAndAssignQa($project);

        $this->actingAs($this->qaTester)->postJson('/api/v1/qa-requests/report', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
            'evidence_document_ids' => [$foreignEvidence->id],
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseMissing('test_reports', ['project_id' => $project->id]);
    }

    public function test_generic_project_update_cannot_fake_track_progress(): void
    {
        $project = $this->makeProject('Proyek Pemalsuan Jalur');

        // Nilai kemajuan jalur ditolak validasi: kolom jalur hanya boleh ditulis oleh
        // empat endpoint jalur pengujian.
        $this->actingAs($this->pm)->patchJson("/api/v1/projects/{$project->id}", [
            'qa_status' => TrackStatus::PASSED->value,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['qa_status']);

        $this->actingAs($this->pm)->patchJson("/api/v1/projects/{$project->id}", [
            'qa_status' => TrackStatus::SUBMITTED->value,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['qa_status']);

        // TIDAK LULUS kini juga ditolak: keputusan gagal hanya lahir dari sign-off Lead,
        // yang sekaligus membuka putaran pengembalian. Menuliskannya lewat endpoint ini
        // akan menandai proyek gagal tanpa satu pun putaran terbuka.
        $this->actingAs($this->pm)->patchJson("/api/v1/projects/{$project->id}", [
            'qa_status' => TrackStatus::FAILED->value,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['qa_status']);

        // Bahkan disertai transisi RETURN_TO_DEV pun ditolak: dulu justru kombinasi
        // inilah lubangnya — proyek ditandai gagal tanpa putaran pengembalian yang
        // menjelaskan apa yang harus diperbaiki.
        $this->actingAs($this->pm)->patchJson("/api/v1/projects/{$project->id}", [
            'qa_status' => TrackStatus::FAILED->value,
            'status' => ProjectStatus::RETURN_TO_DEV->value,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['qa_status']);

        $this->assertSame(TrackStatus::NOT_SUBMITTED, $project->fresh()->qaTrackStatus());
    }

    public function test_track_report_list_is_limited_to_visible_projects(): void
    {
        $project = $this->makeProject('Proyek Laporan Terlihat');

        $this->submitAndAssignQa($project);
        $this->actingAs($this->qaTester)->postJson('/api/v1/qa-requests/report', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
        ])->assertCreated();

        $this->actingAs($this->qaLead)->getJson('/api/v1/qa-requests')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.project_id', $project->id);

        // Jalur Siber tidak memiliki laporan apa pun, jadi daftarnya wajib kosong —
        // laporan QA tidak boleh ikut terbawa.
        $this->actingAs($this->cyberLead)->getJson('/api/v1/cyber-requests')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    private function submitAndAssignQa(Project $project): void
    {
        $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', [
            'project_id' => $project->id,
        ])->assertOk();

        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/assign', [
            'project_id' => $project->id,
            'assignee_id' => $this->qaTester->id,
        ])->assertOk();
    }

    private function makeProject(string $title, ProjectStatus $status = ProjectStatus::DEV_COMPLETED): Project
    {
        return Project::create([
            'req_id' => Project::generateReqId(),
            'title' => $title,
            'created_by' => $this->pm->id,
            'pm_id' => $this->pm->id,
            'division_id' => $this->division->id,
            'status' => $status->value,
        ]);
    }

    private function makeDocument(Project $project, string $documentType): DocumentVault
    {
        return DocumentVault::create([
            'project_id' => $project->id,
            'uploaded_by' => $this->pm->id,
            'document_type' => $documentType,
            'file_path' => "documents/{$project->id}/bukti-pengujian.pdf",
            'file_name' => "001/GPTD/{$documentType}/bukti-pengujian.pdf",
            'original_filename' => 'bukti-pengujian.pdf',
            'file_size' => 2048,
            'mime_type' => 'application/pdf',
        ]);
    }

    /**
     * Buat pengguna beserta rolenya, dengan role dibuat sekali per kelas pengujian.
     *
     * `roles.name` bersifat UNIQUE, jadi role yang sama tidak boleh dibuat dua kali
     * ketika satu pengujian membutuhkan dua orang dengan peran yang sama.
     */
    private function makeUser(UserRole $role, string $name, string $email): User
    {
        $roleRow = $this->roles[$role->value] ??= Role::create([
            'name' => $role->value,
            'display_name' => $role->label(),
        ]);

        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $roleRow->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }
}
