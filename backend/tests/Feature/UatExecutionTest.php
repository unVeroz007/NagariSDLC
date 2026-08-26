<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Enums\UatApprovalRoundStatus;
use App\Enums\UatApprovalStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Models\ProjectTeamMember;
use App\Models\Role;
use App\Models\UatApprovalRound;
use App\Models\User;
use App\Services\UatExecutionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class UatExecutionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Role $developerRole;

    private User $developer;

    /**
     * Tiga slot approval sisi IT wajib diisi tiga akun berbeda.
     *
     * `UatApprovalService::validateParticipants()` menolak satu akun yang menempati
     * dua slot sisi IT (prinsip empat mata): satu klik orang yang sama akan memenuhi
     * dua persetujuan wajib sekaligus. Slot pemohon dikecualikan karena wajib memakai
     * akun `created_by`, jadi akun admin di kelas ini masih boleh memegangnya
     * bersamaan dengan satu slot IT.
     */
    private User $devGroupLead;

    private User $techDivisionLead;

    private Division $division;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create([
            'name' => UserRole::SUPER_ADMIN->value,
            'display_name' => 'Super Admin',
        ]);
        $this->developerRole = Role::create([
            'name' => UserRole::DEVELOPER->value,
            'display_name' => 'Developer',
        ]);
        $this->division = Division::create([
            'code' => 'IT-DEV',
            'name' => 'Divisi Pengembangan TI',
        ]);
        $this->admin = $this->makeUser($adminRole, 'Admin UAT', 'admin-uat@nagari.co.id');
        $this->devGroupLead = $this->makeUser($adminRole, 'Pimpinan Grup Pengembangan', 'dev-lead-uat@nagari.co.id');
        $this->techDivisionLead = $this->makeUser($adminRole, 'Pimpinan Divisi Teknologi', 'tech-lead-uat@nagari.co.id');
        // Developer approver UAT wajib merupakan assignee task proyek, jadi setiap
        // task pengujian di kelas ini ditugaskan ke akun developer yang sama.
        $this->developer = $this->makeUser($this->developerRole, 'Developer UAT', 'developer-uat@nagari.co.id');
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

        // Revisi Minor tidak memundurkan proyek, tetapi perbaikannya tetap pekerjaan
        // pengembangan: task sumbernya dibuka kembali dengan catatan revisi supaya
        // tidak tampak "sudah selesai" di layar Manajemen Task, dan persetujuan final
        // ditahan sampai perbaikannya tuntas.
        $reportTask->refresh();
        $this->assertSame(TaskStatus::IN_PROGRESS, $reportTask->status);
        $this->assertSame('Ubah label tombol menjadi Unduh PDF.', $reportTask->revision_note);
        $this->assertNotNull($reportTask->revision_requested_at);
        $this->assertSame($this->admin->id, (int) $reportTask->revision_requested_by);

        // Skenario yang diterima tidak tersentuh sama sekali.
        $this->assertSame(TaskStatus::DONE, $loginTask->fresh()->status);

        $freshData = (array) $project->fresh()->sit_uat_data;
        $this->assertTrue($project->fresh()->isUatMinorRevisionPending());
        $this->assertSame('minor_revision', $freshData['uat_hold']['reason']);
        $this->assertSame(3, (int) $freshData['uat_hold']['resumeStep']);
        // SIT tidak diulang oleh revisi Minor.
        $this->assertFalse($freshData['uat_restart_after_sit']);
        $this->assertFalse($project->fresh()->isSitRetestCycle());

        // Satu Change Request Minor terbit agar perbaikannya terlacak di Tahap 3.
        $minorRequests = collect($freshData['uat_change_requests'] ?? [])
            ->where('type', 'minor')
            ->values();
        $this->assertCount(1, $minorRequests);
        $this->assertSame('in_progress', $minorRequests[0]['status']);
        $this->assertSame($reportTask->id, (int) $minorRequests[0]['taskId']);
        $this->assertSame('UAT_EXECUTION', $minorRequests[0]['category']);
        $this->assertSame('waiting_development', $freshData['uat2_scenarios'][1]['verificationStatus']);
        $this->assertSame('UAT_CHANGE_MINOR', collect($freshData['revisions'])->last()['type']);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'uat_execution_submitted',
            'subject_id' => $project->id,
        ]);
    }

    public function test_minor_revision_holds_final_uat_closure_until_the_change_request_is_resolved(): void
    {
        $project = $this->makeUatProject();
        $task = $this->makeTask($project, 'Unduh laporan');

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Unduh laporan',
                'result' => 'revision',
                'change_type' => 'minor',
                'request' => 'Ubah label tombol menjadi Unduh PDF.',
                'comment' => 'Tidak mengubah proses bisnis.',
                'attachments' => [],
            ]],
        ])->assertOk();

        // Revisi Minor sengaja tidak mengubah status proyek, sehingga notifikasi
        // berbasis transisi status tidak pernah terpicu. Pemberitahuannya wajib datang
        // dari jalur revisi ini sendiri — tanpa itu pekerjaannya hanya terlihat oleh
        // orang yang kebetulan membuka wizard SIT/UAT dan mudah terlewat.
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->developer->id,
            'title' => 'Revisi Minor UAT — Perlu Dikerjakan',
        ]);

        // Selama perbaikan Minor belum tuntas, UAT tidak boleh ditutup: berita acara
        // UAT adalah dasar rilis, jadi menutupnya berarti menyatakan lulus atas versi
        // aplikasi yang sudah diketahui salah.
        $held = $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::DEV_COMPLETED->value,
        ])->assertStatus(422);
        $this->assertStringContainsString('Minor', (string) $held->json('message'));
        $this->assertSame(ProjectStatus::UAT_IN_PROGRESS, $project->fresh()->status);

        // Penanda tangan pun ditahan, bukan hanya penutupan statusnya. Putaran
        // persetujuannya sendiri tetap terbuka dengan roster yang sama — revisi Minor
        // tidak memundurkan tahap — jadi yang diuji adalah keputusannya, bukan
        // keberadaan putarannya.
        $approver = UatApprovalRound::query()
            ->where('project_id', $project->id)
            ->where('status', UatApprovalRoundStatus::ACTIVE->value)
            ->firstOrFail()
            ->approvers()
            ->where('user_id', $this->admin->id)
            ->firstOrFail();
        $decision = $this->actingAs($this->admin)->postJson(
            "/api/v1/projects/{$project->id}/uat-approvers/{$approver->id}/decision",
            ['decision' => 'approved']
        )->assertStatus(422);
        $this->assertStringContainsString('Minor', (string) $decision->json('message'));

        // Developer menyelesaikan perbaikannya lewat jalur task biasa.
        $this->actingAs($this->developer)->patchJson("/api/v1/tasks/{$task->id}", [
            'status' => TaskStatus::DONE->value,
        ])->assertOk();

        $freshProject = $project->fresh();
        $freshData = (array) $freshProject->sit_uat_data;
        $this->assertFalse($freshProject->isUatMinorRevisionPending());
        // Penanda tangan diberi tahu bahwa keputusannya kembali terbuka; pelepasan
        // hold juga tidak mengubah status proyek, jadi tanpa notifikasi ini tidak ada
        // cara mengetahuinya selain membuka wizard.
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->devGroupLead->id,
            'title' => 'Revisi Minor UAT Selesai — Persetujuan Dibuka',
        ]);
        $this->assertSame('released', $freshData['uat_hold']['status']);
        $this->assertSame('all_minor_requests_resolved', $freshData['uat_hold']['releaseReason']);
        $this->assertSame('resolved', collect($freshData['uat_change_requests'])->firstWhere('type', 'minor')['status']);
        // Revisi Minor tidak mengulang SIT, jadi item yang selesai langsung `resolved`
        // — bukan `waiting_sit` seperti pada revisi Mayor.
        $this->assertSame('resolved', $freshData['uat2_scenarios'][0]['verificationStatus']);
        $this->assertSame(
            'resolved',
            collect($freshData['uat_revision_cycles'])->firstWhere('reason', 'minor_revision')['status']
        );
    }

    public function test_second_minor_revision_request_archives_the_previous_round_and_reopens_the_task(): void
    {
        $project = $this->makeUatProject();
        $task = $this->makeTask($project, 'Unduh laporan');
        $scenario = [
            'id' => "task_{$task->id}",
            'task_id' => $task->id,
            'scenario' => 'Unduh laporan',
            'result' => 'revision',
            'change_type' => 'minor',
            'comment' => 'Tidak mengubah proses bisnis.',
            'attachments' => [],
        ];

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[...$scenario, 'request' => 'Ubah label tombol menjadi Unduh PDF.']],
        ])->assertOk();
        $this->actingAs($this->developer)->patchJson("/api/v1/tasks/{$task->id}", [
            'status' => TaskStatus::DONE->value,
        ])->assertOk();

        // Permintaan revisi kedua atas proyek yang sama harus diterima: sebelumnya
        // kunci snapshot `uat2_summary.submittedAt` menolaknya tanpa pesan yang terlihat
        // di layar, sehingga permintaan unit peminta seolah diabaikan.
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[...$scenario, 'request' => 'Tambahkan ikon unduh pada tombol.']],
        ])->assertOk()
            ->assertJsonPath('meta.conclusion', 'minor_revision')
            ->assertJsonPath('data.status', ProjectStatus::UAT_IN_PROGRESS->value)
            ->assertJsonPath('data.sit_uat_data.activeUatStep', 3);

        $freshProject = $project->fresh();
        $freshData = (array) $freshProject->sit_uat_data;

        // Putaran pertama diarsipkan, bukan dibuang: berita acara UAT wajib dapat
        // ditelusuri meski hasilnya sudah ditulis ulang.
        $this->assertCount(1, $freshData['uat_cycles']);
        $this->assertSame('minor_revision_reexecution', $freshData['uat_cycles'][0]['reason']);
        $this->assertSame(
            'Ubah label tombol menjadi Unduh PDF.',
            $freshData['uat_cycles'][0]['scenarios'][0]['request']
        );

        // Task dibuka kembali dengan catatan revisi yang baru.
        $task->refresh();
        $this->assertSame(TaskStatus::IN_PROGRESS, $task->status);
        $this->assertSame('Tambahkan ikon unduh pada tombol.', $task->revision_note);

        // Siklus kedua menahan persetujuan lagi, dan Change Request lama yang sudah
        // tuntas tetap `resolved` sebagai jejak audit.
        $this->assertTrue($freshProject->isUatMinorRevisionPending());
        $this->assertSame(2, (int) $freshData['uat_hold']['cycle']);
        $minorRequests = collect($freshData['uat_change_requests'])->where('type', 'minor')->values();
        $this->assertCount(2, $minorRequests);
        $this->assertSame('resolved', $minorRequests[0]['status']);
        $this->assertSame('in_progress', $minorRequests[1]['status']);
        $this->assertSame(1, (int) $minorRequests[0]['cycle']);
        $this->assertSame(2, (int) $minorRequests[1]['cycle']);

        // Putaran persetujuan lama tidak boleh tetap berlaku atas hasil yang berubah.
        $rounds = UatApprovalRound::query()->where('project_id', $project->id)->orderBy('id')->get();
        $this->assertCount(2, $rounds);
        $this->assertSame(UatApprovalRoundStatus::SUPERSEDED, $rounds[0]->status);
        $this->assertSame(UatApprovalRoundStatus::ACTIVE, $rounds[1]->status);
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

        // Revisi Mayor mengulang DUA siklus: SIT diuji ulang menyeluruh, lalu UAT
        // dijalankan lagi dari Tahap 1 — bukan dilanjutkan di Tahap 2.
        $response->assertOk()
            ->assertJsonPath('meta.conclusion', 'major_revision')
            ->assertJsonPath('meta.requires_development_revision', true)
            ->assertJsonPath('meta.next_uat_step', 1)
            ->assertJsonPath('data.status', ProjectStatus::UAT_REVISION_DEV->value)
            ->assertJsonPath('data.sit_uat_data.uat_restart_after_sit', true)
            ->assertJsonPath('data.sit_uat_data.activeSitStep', 1)
            ->assertJsonPath('data.sit_uat_data.activeUatStep', 1)
            ->assertJsonPath('data.sit_uat_data.uat_hold.status', 'developer_revision')
            ->assertJsonPath('data.sit_uat_data.uat_hold.resumeStep', 1)
            ->assertJsonPath('data.sit_uat_data.sit_retest_scope.mode', 'full')
            ->assertJsonPath('data.sit_uat_data.sit_retest_scope.taskIds', [])
            ->assertJsonPath('data.sit_uat_data.sit_retest_scope.status', 'waiting_development')
            ->assertJsonCount(1, 'data.sit_uat_data.sit_cycles')
            ->assertJsonCount(1, 'data.sit_uat_data.uat_cycles')
            ->assertJsonPath('data.sit_uat_data.uat_cycles.0.cycle', 1)
            ->assertJsonPath('data.sit_uat_data.uat_cycles.0.reason', 'major_revision')
            ->assertJsonPath('data.sit_uat_data.uat_change_requests.0.source', 'scenario')
            ->assertJsonPath('data.sit_uat_data.uat_change_requests.0.category', 'UAT_EXECUTION')
            ->assertJsonPath('data.sit_uat_data.uat_change_requests.0.origin', 'uat_execution')
            ->assertJsonPath('data.sit_uat_data.uat_change_requests.0.status', 'in_progress');

        $sitUatData = (array) $project->fresh()->sit_uat_data;

        // Hasil eksekusi putaran yang ditahan dikosongkan agar UAT benar-benar
        // dapat dijalankan ulang; arsipnya sudah tersimpan di `uat_cycles`.
        $this->assertEmpty($sitUatData['uat2_summary'] ?? []);
        $this->assertEmpty($sitUatData['uat2_scenarios'] ?? []);
        $this->assertEmpty($sitUatData['uat2_additional_requests'] ?? []);
        $this->assertSame(0, (int) ($sitUatData['uat2_executedCount'] ?? -1));
        $this->assertSame(0, (int) ($sitUatData['uat2_passedCount'] ?? -1));
        $this->assertSame(0, (int) ($sitUatData['uat2_findings'] ?? -1));
        // `??` ikut menelan nilai null, jadi keberadaan kuncinya diperiksa terpisah
        // dari nilainya. Yang ditegaskan di sini: catatan eksekusi benar-benar
        // dikosongkan menjadi null, bukan sekadar hilang dari data.
        $this->assertArrayHasKey('uat2_execNotes', $sitUatData);
        $this->assertNull($sitUatData['uat2_execNotes']);

        // Hasil SIT sebelumnya juga direset karena SIT diuji ulang dari awal.
        $this->assertEmpty($sitUatData['sit2_task_approvals'] ?? []);
        $this->assertEmpty($sitUatData['sit3_docs'] ?? []);
        $this->assertEmpty($sitUatData['sit3_approvals'] ?? []);
        $this->assertEmpty($sitUatData['uat3_approvals'] ?? []);

        // Mode verifikasi item Mayor sudah pensiun: kuncinya tidak boleh ditulis lagi.
        $this->assertArrayNotHasKey('uat2_verification_mode', $sitUatData);
        $this->assertArrayNotHasKey('uat2_resume_after_sit', $sitUatData);
        $this->assertTrue($project->fresh()->isUatRestartPending());

        $reopenedTask = $task->fresh();
        $this->assertSame(TaskStatus::IN_PROGRESS, $reopenedTask->status);
        $this->assertSame('Tambahkan alur otorisasi dua tingkat.', $reopenedTask->revision_note);
        $this->assertSame($this->admin->id, $reopenedTask->revision_requested_by);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-approval")
            ->assertStatus(422);
    }

    public function test_major_revision_restarts_uat_from_step_one_after_full_sit_retest_passes(): void
    {
        $project = $this->makeUatProject();
        $revisedTask = $this->makeTask($project, 'Proses transaksi');
        $untouchedTask = $this->makeTask($project, 'Cetak bukti transaksi');

        // 1. Tahap 2: satu skenario ditolak sebagai revisi mayor, UAT ditahan dan
        //    pekerjaan kembali ke developer.
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [
                [
                    'id' => "task_{$revisedTask->id}",
                    'task_id' => $revisedTask->id,
                    'scenario' => 'Proses transaksi',
                    'result' => 'revision',
                    'change_type' => 'mayor',
                    'request' => 'Tambahkan alur otorisasi dua tingkat.',
                    'comment' => 'Mengubah proses bisnis utama.',
                    'attachments' => [],
                ],
                [
                    'id' => "task_{$untouchedTask->id}",
                    'task_id' => $untouchedTask->id,
                    'scenario' => 'Cetak bukti transaksi',
                    'result' => 'accepted',
                    'attachments' => [],
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('data.status', ProjectStatus::UAT_REVISION_DEV->value)
            ->assertJsonPath('data.sit_uat_data.uat_hold.status', 'developer_revision')
            ->assertJsonPath('data.sit_uat_data.uat_hold.resumeStep', 1);

        // 2. Developer menyelesaikan perbaikan, SIT ulang menyeluruh dijalankan dan
        //    lulus, lalu UAT dibuka kembali.
        $response = $this->runFullSitRetestUntilUatRestart($project, $revisedTask);

        // 3. UAT dimulai ULANG dari Tahap 1 — skenario disusun ulang dan seluruhnya
        //    dieksekusi kembali, bukan hanya item Mayor-nya yang diverifikasi.
        $response
            ->assertJsonPath('data.status', ProjectStatus::UAT_IN_PROGRESS->value)
            ->assertJsonPath('data.sit_uat_data.activeUatStep', 1)
            ->assertJsonPath('data.sit_uat_data.uat_restart_after_sit', false)
            ->assertJsonPath('data.sit_uat_data.uat_hold.status', 'uat_restart')
            ->assertJsonPath('data.sit_uat_data.sit_retest_scope.status', 'passed')
            ->assertJsonPath('data.sit_uat_data.uat_change_requests.0.status', 'sit_verified');

        $freshProject = $project->fresh();
        $sitUatData = (array) $freshProject->sit_uat_data;
        $this->assertFalse($freshProject->isUatRestartPending());
        $this->assertFalse($freshProject->isSitRetestCycle());
        $this->assertNotEmpty($sitUatData['uat_sit_retest_passed_at']);
        $this->assertNotEmpty($sitUatData['uat_hold']['sitPassedAt']);
        $this->assertNotEmpty($sitUatData['uat_change_requests'][0]['sitVerifiedAt']);
        $this->assertArrayNotHasKey('uat2_verification_mode', $sitUatData);
        $this->assertArrayNotHasKey('uat2_resume_after_sit', $sitUatData);

        // Kunci snapshot ikut lepas, sehingga Tahap 2 dapat diisi lagi dari nol.
        $this->assertEmpty($sitUatData['uat2_summary'] ?? []);
    }

    public function test_uat_participant_roster_survives_a_major_revision_hold(): void
    {
        $scenarioDoc = 0;
        $project = $this->makeUatProject([
            'uat1_docs' => [['docId' => 4242, 'doc_type' => 'UAT_SCENARIO', 'name' => 'Skenario UAT.pdf']],
        ]);
        $task = $this->makeTask($project, 'Proses transaksi');
        $rosterBefore = (array) $project->fresh()->sit_uat_data['uat1_participants'];
        $docsBefore = (array) $project->fresh()->sit_uat_data['uat1_docs'];
        $this->assertCount(7, $rosterBefore);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Proses transaksi',
                'result' => 'revision',
                'change_type' => 'mayor',
                'request' => 'Tambahkan alur otorisasi dua tingkat.',
                'attachments' => [],
            ]],
        ])->assertOk()
            ->assertJsonPath('data.status', ProjectStatus::UAT_REVISION_DEV->value);

        // Daftar penanda tangan adalah hasil kesepakatan orang, bukan hasil eksekusi:
        // pengulangan UAT tidak boleh memaksa PM menyusun ulang roster yang sama.
        $sitUatData = (array) $project->fresh()->sit_uat_data;
        $this->assertSame($rosterBefore, $sitUatData['uat1_participants']);
        $this->assertSame($docsBefore, $sitUatData['uat1_docs']);
        $this->assertSame(0, $scenarioDoc);
    }

    public function test_uat_participant_roster_survives_the_whole_revision_round_trip(): void
    {
        $project = $this->makeUatProject();
        $task = $this->makeTask($project, 'Proses transaksi');
        $rosterBefore = (array) $project->fresh()->sit_uat_data['uat1_participants'];

        $this->submitMajorUatRevision($project, $task);
        $this->runFullSitRetestUntilUatRestart($project, $task);

        // UAT_REVISION_DEV -> SIT_IN_PROGRESS -> SIT_PASSED -> UAT_IN_PROGRESS:
        // tidak satu pun transisi tersebut boleh menyentuh roster.
        $freshProject = $project->fresh();
        $this->assertSame(ProjectStatus::UAT_IN_PROGRESS, $freshProject->status);
        $this->assertSame($rosterBefore, (array) $freshProject->sit_uat_data['uat1_participants']);
    }

    public function test_generic_project_update_cannot_wipe_the_uat_participant_roster(): void
    {
        $project = $this->makeUatProject();
        $rosterBefore = (array) $project->fresh()->sit_uat_data['uat1_participants'];

        // 1. Kiriman yang mengosongkan roster ditolak diam-diam: nilai tersimpan
        //    dipertahankan.
        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'sitUatData' => [
                'activeUatStep' => 2,
                'uat1_participants' => [],
            ],
        ])->assertOk();
        $this->assertSame($rosterBefore, (array) $project->fresh()->sit_uat_data['uat1_participants']);

        // 2. Formulir lain yang mengirim `sit_uat_data` tanpa kunci roster juga tidak
        //    boleh menghapusnya.
        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'sitUatData' => ['activeUatStep' => 2],
        ])->assertOk();
        $this->assertSame($rosterBefore, (array) $project->fresh()->sit_uat_data['uat1_participants']);

        // 3. Menyunting dan menambah peserta tetap berjalan seperti biasa — yang
        //    ditolak hanya pengosongan.
        $observer = [
            'id' => fake()->uuid(), 'name' => 'Observer Bisnis', 'role' => 'Observer',
            'unit' => 'Divisi Peminta', 'phone' => '', 'isApprover' => false,
            'approvalRole' => 'requester', 'approvalMode' => 'internal_account',
            'userId' => $this->admin->id,
        ];
        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'sitUatData' => [
                'uat1_participants' => [...$rosterBefore, $observer],
            ],
        ])->assertOk();

        $rosterAfter = (array) $project->fresh()->sit_uat_data['uat1_participants'];
        $this->assertCount(8, $rosterAfter);
        $this->assertSame('Observer Bisnis', $rosterAfter[7]['name']);

        // Middleware `ConvertEmptyStringsToNull` bawaan framework mengubah setiap
        // string kosong pada payload HTTP menjadi null, termasuk `phone` milik
        // penyetuju internal yang memang tidak memakai nomor HP. Perbandingan mentah
        // akan gagal pada kolom itu saja padahal rosternya utuh, jadi yang diuji di
        // sini adalah identitas dan urutan pesertanya.
        $this->assertSame(
            array_column(array_slice($rosterBefore, 0, 7), 'id'),
            array_column(array_slice($rosterAfter, 0, 7), 'id')
        );
        $this->assertSame(
            array_column(array_slice($rosterBefore, 0, 7), 'name'),
            array_column(array_slice($rosterAfter, 0, 7), 'name')
        );
        $this->assertSame(
            array_column(array_slice($rosterBefore, 0, 7), 'approvalRole'),
            array_column(array_slice($rosterAfter, 0, 7), 'approvalRole')
        );
    }

    public function test_major_revision_sit_retest_covers_every_active_task(): void
    {
        $project = $this->makeUatProject();
        $revisedTask = $this->makeTask($project, 'Proses transaksi');
        $firstUntouchedTask = $this->makeTask($project, 'Cetak bukti transaksi');
        $secondUntouchedTask = $this->makeTask($project, 'Kirim notifikasi');
        $takenDownTask = $this->makeTask($project, 'Menu lama', TaskStatus::TAKE_DOWN);

        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [
                [
                    'id' => "task_{$revisedTask->id}",
                    'task_id' => $revisedTask->id,
                    'scenario' => 'Proses transaksi',
                    'result' => 'revision',
                    'change_type' => 'mayor',
                    'request' => 'Tambahkan alur otorisasi dua tingkat.',
                    'attachments' => [],
                ],
                [
                    'id' => "task_{$firstUntouchedTask->id}",
                    'task_id' => $firstUntouchedTask->id,
                    'scenario' => 'Cetak bukti transaksi',
                    'result' => 'accepted',
                    'attachments' => [],
                ],
                [
                    'id' => "task_{$secondUntouchedTask->id}",
                    'task_id' => $secondUntouchedTask->id,
                    'scenario' => 'Kirim notifikasi',
                    'result' => 'accepted',
                    'attachments' => [],
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('data.sit_uat_data.sit_retest_scope.mode', 'full')
            ->assertJsonPath('data.sit_uat_data.sit_retest_scope.taskIds', [])
            ->assertJsonCount(1, 'data.sit_uat_data.sit_retest_scope.affectedItems')
            ->assertJsonPath('data.sit_uat_data.sit_retest_scope.affectedItems.0.taskId', $revisedTask->id);

        // Perbaikan Mayor menyentuh kode bersama, jadi SIT ulang menguji SELURUH task
        // aktif — bukan hanya task yang direvisi. Task TAKE DOWN tetap di luar scope.
        $freshProject = $project->fresh();
        $this->assertTrue($freshProject->isSitRetestCycle());
        $this->assertSame(
            [$revisedTask->id, $firstUntouchedTask->id, $secondUntouchedTask->id],
            $freshProject->sitScopeTasks()->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all()
        );
        $this->assertFalse(
            $freshProject->sitScopeTasks()->pluck('id')->map(fn ($id) => (int) $id)->contains($takenDownTask->id)
        );
    }

    public function test_legacy_targeted_sit_retest_scope_still_narrows_to_its_task_ids(): void
    {
        $project = $this->makeUatProject();
        $scopedTask = $this->makeTask($project, 'Proses transaksi');
        $this->makeTask($project, 'Cetak bukti transaksi');
        $this->makeTask($project, 'Kirim notifikasi');

        // Baris yang sudah berjalan sebelum aturan pengulangan penuh berlaku masih
        // menyimpan scope `targeted` beserta nama flag lamanya. Siklus yang sedang
        // berjalan tidak boleh berubah cakupan di tengah jalan.
        $project->update(['sit_uat_data' => [
            ...(array) $project->sit_uat_data,
            'uat2_resume_after_sit' => true,
            'uat_hold' => [
                'status' => 'developer_revision',
                'reason' => 'major_revision',
                'cycle' => 1,
                'resumeStep' => 2,
            ],
            'sit_retest_scope' => [
                'mode' => 'targeted',
                'cycle' => 1,
                'status' => 'waiting_development',
                'taskIds' => [$scopedTask->id],
            ],
        ]]);

        $freshProject = $project->fresh();
        $this->assertTrue($freshProject->isUatRestartPending());
        $this->assertTrue($freshProject->isSitRetestCycle());
        $this->assertSame(
            [$scopedTask->id],
            $freshProject->sitScopeTasks()->pluck('id')->map(fn ($id) => (int) $id)->all()
        );
    }

    public function test_uat_cycles_archive_keeps_each_cleared_round_and_appends_the_next(): void
    {
        $project = $this->makeUatProject([
            'uat3_approvals' => ['pm' => ['approved' => true]],
        ]);
        $task = $this->makeTask($project, 'Proses transaksi');

        $this->submitMajorUatRevision($project, $task, 'Tambahkan alur otorisasi dua tingkat.');

        // Arsip diambil SEBELUM satu kunci pun dikosongkan: tanpa itu tidak ada bukti
        // bahwa putaran UAT pertama pernah dijalankan beserta persetujuannya.
        $firstCycles = (array) $project->fresh()->sit_uat_data['uat_cycles'];
        $this->assertCount(1, $firstCycles);
        $this->assertSame(1, $firstCycles[0]['cycle']);
        $this->assertSame('major_revision', $firstCycles[0]['reason']);
        $this->assertSame('major_revision', $firstCycles[0]['summary']['conclusion']);
        $this->assertSame(1, $firstCycles[0]['summary']['executedCount']);
        $this->assertSame($this->admin->name, $firstCycles[0]['archivedBy']);
        $this->assertNotEmpty($firstCycles[0]['archivedAt']);
        $this->assertCount(1, $firstCycles[0]['scenarios']);
        $this->assertSame('Proses transaksi', $firstCycles[0]['scenarios'][0]['scenario']);
        $this->assertSame(1, $firstCycles[0]['executedCount']);
        $this->assertSame(0, $firstCycles[0]['passedCount']);
        $this->assertSame(1, $firstCycles[0]['findings']);
        $this->assertTrue($firstCycles[0]['approvals']['pm']['approved']);

        // Revisi Mayor kedua MENAMBAH entri, tidak menimpa entri pertama.
        $this->runFullSitRetestUntilUatRestart($project, $task);
        $this->reopenUatExecutionStep($project);
        $this->submitMajorUatRevision($project, $task, 'Pisahkan limit otorisasi per jabatan.');

        $secondCycles = (array) $project->fresh()->sit_uat_data['uat_cycles'];
        $this->assertCount(2, $secondCycles);
        $this->assertSame([1, 2], array_column($secondCycles, 'cycle'));
        $this->assertSame($firstCycles[0], $secondCycles[0]);
        $this->assertSame('major_revision', $secondCycles[1]['reason']);
        $this->assertSame(
            'Pisahkan limit otorisasi per jabatan.',
            $secondCycles[1]['scenarios'][0]['request']
        );
    }

    public function test_uat_execution_can_be_saved_again_after_a_major_revision_restart(): void
    {
        $project = $this->makeUatProject();
        $task = $this->makeTask($project, 'Proses transaksi');

        $this->submitMajorUatRevision($project, $task);
        $this->runFullSitRetestUntilUatRestart($project, $task);

        // Kunci snapshot `uat2_summary.submittedAt` ikut dilepas saat putaran lama
        // diarsipkan. Tanpa itu penyimpanan Tahap 2 berikutnya selalu ditolak dengan
        // "Hasil eksekusi UAT sudah disimpan dan dikunci sebagai snapshot audit."
        $sitUatData = (array) $project->fresh()->sit_uat_data;
        $this->assertSame(1, (int) $sitUatData['activeUatStep']);
        $this->assertEmpty($sitUatData['uat2_summary'] ?? []);

        $this->reopenUatExecutionStep($project);

        // Draft kembali dapat dipakai.
        $this->actingAs($this->admin)->putJson("/api/v1/projects/{$project->id}/uat-execution/draft", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Proses transaksi (uji ulang)',
                'result' => 'accepted',
                'attachments' => [],
            ]],
        ])->assertOk()
            ->assertJsonPath('status', 'success');
        $this->assertNotEmpty($project->fresh()->sit_uat_data['uat2_draft_saved_at']);

        // Dan Tahap 2 dapat disimpan final untuk kedua kalinya.
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Proses transaksi (uji ulang)',
                'result' => 'accepted',
                'comment' => 'Otorisasi dua tingkat sudah sesuai permintaan.',
                'attachments' => [],
            ]],
            'notes' => 'UAT dijalankan ulang penuh setelah SIT ulang lulus.',
        ])->assertOk()
            ->assertJsonPath('meta.conclusion', 'accepted')
            ->assertJsonPath('meta.requires_development_revision', false)
            ->assertJsonPath('meta.next_uat_step', 3)
            ->assertJsonPath('data.status', ProjectStatus::UAT_IN_PROGRESS->value)
            ->assertJsonPath('data.sit_uat_data.activeUatStep', 3)
            ->assertJsonPath('data.sit_uat_data.uat2_summary.conclusion', 'accepted');

        $this->assertNotEmpty($project->fresh()->sit_uat_data['uat2_summary']['submittedAt']);
    }

    public function test_leaving_uat_for_a_major_revision_supersedes_the_active_approval_round(): void
    {
        $project = $this->makeFinalizedUatProject();
        $this->makeTask($project, 'Proses transaksi');

        $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertStatus(201);

        $round = UatApprovalRound::query()->where('project_id', $project->id)->firstOrFail();
        $approvers = $round->approvers()->orderBy('id')->get();
        $approvedApprover = $approvers->first();
        $pendingApprover = $approvers->last();
        $approvedApprover->update([
            'status' => UatApprovalStatus::APPROVED,
            'decided_at' => now(),
            'link_token_hash' => hash('sha256', 'link-disetujui'),
            'access_token_hash' => hash('sha256', 'akses-disetujui'),
            'access_expires_at' => now()->addHour(),
        ]);
        $pendingApprover->update([
            'link_token_hash' => hash('sha256', 'link-menunggu'),
            'access_token_hash' => hash('sha256', 'akses-menunggu'),
            'access_expires_at' => now()->addHour(),
        ]);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::UAT_REVISION_DEV->value,
        ])->assertOk();

        $freshRound = $round->fresh();
        $this->assertSame(UatApprovalRoundStatus::SUPERSEDED, $freshRound->status);
        $this->assertNotNull($freshRound->superseded_at);
        $this->assertNotEmpty($freshRound->superseded_reason);
        $this->assertStringContainsString('Mayor', $freshRound->superseded_reason);

        // Baris `approved` TETAP `approved` sebagai jejak audit — yang dicabut hanya
        // aksesnya, sehingga tanda tangan lama tidak dapat dipakai lagi.
        $freshApproved = $approvedApprover->fresh();
        $this->assertSame(UatApprovalStatus::APPROVED, $freshApproved->status);
        $this->assertNull($freshApproved->link_token_hash);
        $this->assertNull($freshApproved->access_token_hash);
        $this->assertNull($freshApproved->access_expires_at);

        $freshPending = $pendingApprover->fresh();
        $this->assertSame(UatApprovalStatus::REVOKED, $freshPending->status);
        $this->assertNull($freshPending->link_token_hash);
        $this->assertNull($freshPending->access_token_hash);
        $this->assertNull($freshPending->access_expires_at);

        // Dari UAT_REVISION_DEV, DEV_COMPLETED ditolak state machine.
        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::DEV_COMPLETED->value,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');

        // Dan bahkan bila proyek dikembalikan ke UAT dengan Tahap 2 final terisi,
        // putaran yang sudah di-supersede tidak lagi dihitung sebagai persetujuan
        // lengkap. Keadaan ini disiapkan lewat penulisan model karena tidak ada
        // endpoint yang boleh menaikkan status tanpa melewati gerbang yang sama.
        //
        // `refresh()` wajib lebih dulu: instance ini dibuat saat status masih
        // `UAT_IN_PROGRESS`, sedangkan transisi di atas terjadi lewat HTTP. Tanpa
        // menyegarkannya, menetapkan `UAT_IN_PROGRESS` tidak dianggap perubahan oleh
        // Eloquent sehingga kolom status tidak ikut ditulis dan proyek tetap berada
        // di `UAT_REVISION_DEV` — gerbang DEV_COMPLETED lalu menolak karena state
        // machine, bukan karena putaran persetujuannya sudah tidak berlaku.
        $project->refresh();
        $project->update([
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
            'sit_uat_data' => [
                ...(array) $project->sit_uat_data,
                'activeUatStep' => 3,
                'uat_restart_after_sit' => false,
                'uat2_summary' => [
                    'conclusion' => 'accepted',
                    'submittedAt' => now()->toIso8601String(),
                ],
            ],
        ]);
        $this->assertSame(ProjectStatus::UAT_IN_PROGRESS, $project->fresh()->status);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::DEV_COMPLETED->value,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error');
        $this->assertSame(ProjectStatus::UAT_IN_PROGRESS, $project->fresh()->status);
    }

    public function test_new_approval_round_after_a_restart_carries_the_same_participants(): void
    {
        $project = $this->makeFinalizedUatProject();
        $task = $this->makeTask($project, 'Proses transaksi');

        $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertStatus(201);
        $firstRound = UatApprovalRound::query()->where('project_id', $project->id)->firstOrFail();
        $firstRoundKeys = $firstRound->approvers()->pluck('participant_key')->sort()->values()->all();
        $this->assertCount(7, $firstRoundKeys);

        // Keputusan Change Request Mayor menahan UAT dengan konsekuensi yang persis
        // sama seperti kesimpulan Eksekusi UAT, jadi jalur itu memanggil layanan yang
        // sama. Di sini layanannya dipanggil langsung karena putaran approval pertama
        // hanya bisa ada saat Tahap 2 belum terkunci sebagai snapshot.
        $project = $project->fresh();
        $heldSitUatData = app(UatExecutionService::class)->holdForMajorRevision(
            $project,
            $this->admin,
            (array) $project->sit_uat_data,
            [[
                'id' => "task_{$task->id}",
                'source' => 'scenario',
                'title' => 'Proses transaksi',
                'detail' => 'Tambahkan alur otorisasi dua tingkat.',
                'taskId' => $task->id,
                'attachments' => [],
                'newTask' => false,
            ]],
            now()->toIso8601String()
        );
        $project->update(['sit_uat_data' => $heldSitUatData]);
        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::UAT_REVISION_DEV->value,
        ])->assertOk();

        $this->runFullSitRetestUntilUatRestart($project, $task);
        $this->reopenUatExecutionStep($project);

        // Tahap 2 diisi ulang; penyimpanannya membuka putaran persetujuan baru.
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$project->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Proses transaksi (uji ulang)',
                'result' => 'accepted',
                'attachments' => [],
            ]],
        ])->assertOk()
            ->assertJsonPath('data.sit_uat_data.activeUatStep', 3);

        $rounds = UatApprovalRound::query()
            ->where('project_id', $project->id)
            ->orderBy('round_number')
            ->get();
        $this->assertCount(2, $rounds);

        // Putaran lama tetap terbaca sebagai `superseded` — arsipnya tidak dihapus.
        $this->assertSame(UatApprovalRoundStatus::SUPERSEDED, $rounds[0]->status);
        $this->assertSame(1, $rounds[0]->round_number);

        // Putaran baru memakai peserta yang sama. `uat_approvers` unik per
        // (round, participant_key) — bukan unik global — sehingga kunci peserta yang
        // sama sah dipakai lagi di putaran berikutnya.
        $this->assertSame(2, $rounds[1]->round_number);
        $this->assertSame(UatApprovalRoundStatus::ACTIVE, $rounds[1]->status);
        $secondRoundKeys = $rounds[1]->approvers()->pluck('participant_key')->sort()->values()->all();
        $this->assertSame($firstRoundKeys, $secondRoundKeys);
        $this->assertSame(
            $firstRound->approvers()->orderBy('approval_role')->pluck('name')->all(),
            $rounds[1]->approvers()->orderBy('approval_role')->pluck('name')->all()
        );
    }

    public function test_new_approval_round_cannot_be_opened_while_a_uat_restart_is_pending(): void
    {
        $pendingProject = $this->makeFinalizedUatProject(['uat_restart_after_sit' => true]);
        $this->makeTask($pendingProject, 'Proses transaksi');

        $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$pendingProject->id}/uat-approval-rounds")
            ->assertStatus(422);
        $this->assertSame(0, UatApprovalRound::query()->where('project_id', $pendingProject->id)->count());

        // Baris lama yang masih memakai nama flag sebelumnya ditolak dengan alasan
        // yang sama — pembacaannya dipusatkan di `Project::isUatRestartPending()`.
        $legacyProject = $this->makeFinalizedUatProject(['uat2_resume_after_sit' => true]);
        $this->makeTask($legacyProject, 'Proses transaksi');
        $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$legacyProject->id}/uat-approval-rounds")
            ->assertStatus(422);
        $this->assertSame(0, UatApprovalRound::query()->where('project_id', $legacyProject->id)->count());

        // Setelah SIT ulang lulus, `ProjectWorkflowService` melepas flag dan UAT
        // kembali ke Tahap 1. Pelepasan itu ditiru di sini lewat penulisan model
        // karena flagnya server-managed dan tidak dapat ditulis lewat API.
        $pendingProject->update(['sit_uat_data' => [
            ...(array) $pendingProject->fresh()->sit_uat_data,
            'uat_restart_after_sit' => false,
            'activeUatStep' => 2,
            'uat2_summary' => [],
        ]]);
        $task = $pendingProject->tasks()->firstOrFail();

        // Tahap 2 diisi ulang, dan putaran persetujuan terbuka kembali.
        $this->actingAs($this->admin)->postJson("/api/v1/projects/{$pendingProject->id}/uat-execution", [
            'scenarios' => [[
                'id' => "task_{$task->id}",
                'task_id' => $task->id,
                'scenario' => 'Proses transaksi (uji ulang)',
                'result' => 'accepted',
                'attachments' => [],
            ]],
        ])->assertOk();
        $this->assertSame(1, UatApprovalRound::query()->where('project_id', $pendingProject->id)->count());

        $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$pendingProject->id}/uat-approval-rounds")
            ->assertStatus(201);
        $this->assertSame(
            UatApprovalRoundStatus::ACTIVE,
            UatApprovalRound::query()
                ->where('project_id', $pendingProject->id)
                ->orderByDesc('round_number')
                ->firstOrFail()
                ->status
        );
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
        $developer = $this->makeUser($this->developerRole, 'Developer Luar', 'developer-luar@nagari.co.id');
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
            'uat_restart_after_sit' => true,
            // Nama flag lama ikut dilindungi selama baris produksi lama masih ada.
            'uat2_resume_after_sit' => true,
            'uat_sit_retest_passed_at' => '2026-08-20T10:00:00+07:00',
            'uat_cycles' => [['cycle' => 1, 'reason' => 'major_revision']],
            'uat3_approvals' => [],
        ]);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'sitUatData' => [
                'activeSitStep' => 2,
                'uat2_summary' => ['conclusion' => 'accepted'],
                'uat_restart_after_sit' => false,
                'uat2_resume_after_sit' => false,
                'uat_sit_retest_passed_at' => '2026-01-01T00:00:00+07:00',
                'uat_cycles' => [],
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
        $this->assertTrue($sitUatData['uat_restart_after_sit']);
        $this->assertTrue($sitUatData['uat2_resume_after_sit']);
        $this->assertSame('2026-08-20T10:00:00+07:00', $sitUatData['uat_sit_retest_passed_at']);
        $this->assertSame([['cycle' => 1, 'reason' => 'major_revision']], $sitUatData['uat_cycles']);
        $this->assertSame([], $sitUatData['uat3_approvals']);
        $this->assertTrue($project->fresh()->isUatRestartPending());
    }

    /**
     * Simpan hasil Tahap 2 dengan satu skenario revisi Mayor. Skenario untuk task
     * lain diisi `accepted` karena hasil UAT wajib memuat tepat satu baris untuk
     * setiap task aktif proyek.
     */
    private function submitMajorUatRevision(
        Project $project,
        ProjectTask $revisedTask,
        string $request = 'Tambahkan alur otorisasi dua tingkat.'
    ): TestResponse {
        $scenarios = $project->fresh()->tasks()
            ->where('status', '!=', TaskStatus::TAKE_DOWN->value)
            ->get()
            ->map(fn (ProjectTask $task): array => (int) $task->id === (int) $revisedTask->id
                ? [
                    'id' => "task_{$task->id}",
                    'task_id' => $task->id,
                    'scenario' => $task->title,
                    'result' => 'revision',
                    'change_type' => 'mayor',
                    'request' => $request,
                    'attachments' => [],
                ]
                : [
                    'id' => "task_{$task->id}",
                    'task_id' => $task->id,
                    'scenario' => $task->title,
                    'result' => 'accepted',
                    'attachments' => [],
                ])
            ->values()
            ->all();

        return $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-execution", ['scenarios' => $scenarios])
            ->assertOk()
            ->assertJsonPath('data.status', ProjectStatus::UAT_REVISION_DEV->value);
    }

    /**
     * Jalankan sisa siklus revisi Mayor sampai UAT dibuka kembali: developer
     * menuntaskan task yang direvisi, SIT ulang menyeluruh dijalankan dan lulus,
     * lalu proyek kembali ke UAT_IN_PROGRESS. Respons transisi terakhir
     * dikembalikan agar pemanggilnya dapat memeriksa bentuk `sit_uat_data`-nya.
     */
    private function runFullSitRetestUntilUatRestart(Project $project, ProjectTask ...$revisedTasks): TestResponse
    {
        // Task selesai → Change Request Mayor siklus ini menjadi `resolved`.
        foreach ($revisedTasks as $task) {
            $this->actingAs($this->developer)->patchJson("/api/v1/tasks/{$task->id}", [
                'status' => TaskStatus::DONE->value,
            ])->assertOk();
        }

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_IN_PROGRESS->value,
        ])->assertOk()
            ->assertJsonPath('data.sit_uat_data.sit_retest_scope.status', 'in_progress');

        $this->recordFullSitRetestResult($project);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::SIT_PASSED->value,
        ])->assertOk();

        return $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => ProjectStatus::UAT_IN_PROGRESS->value,
        ])->assertOk();
    }

    /**
     * Isi hasil SIT ulang MENYELURUH seperti yang ditulis wizard SIT/UAT:
     * persetujuan per task beserta bukti barunya untuk seluruh task dalam scope,
     * persetujuan Tahap 3 dari setiap developer wajib, dan dokumen Berita Acara
     * SIT. Ditulis langsung ke `sit_uat_data` karena pengujian ini menyorot
     * gerbang statusnya, bukan UI wizard-nya.
     */
    private function recordFullSitRetestResult(Project $project): void
    {
        $signOff = $this->makeDocument($project, 'SIT_SIGNOFF');
        $project = $project->fresh();
        $sitUatData = (array) $project->sit_uat_data;

        // Scope SIT ulang kini seluruh task aktif, jadi setiap task wajib punya
        // persetujuan dan lampiran bukti pengujian barunya sendiri.
        $taskApprovals = [];
        foreach ($project->sitScopeTasks() as $task) {
            $evidence = $this->makeDocument($project, DocumentVault::SIT_TASK_EVIDENCE_TYPE);
            $taskApprovals["task_{$task->id}"] = [
                'approved' => true,
                'attachments' => [['docId' => $evidence->id]],
            ];
        }
        $sitUatData['sit2_task_approvals'] = $taskApprovals;

        $sitUatData['sit3_approvals'] = [
            'developer' => [
                'developers' => collect($project->sitApprovalDeveloperIds())
                    ->map(fn (int $userId): array => ['userId' => $userId, 'approved' => true])
                    ->values()
                    ->all(),
            ],
            'pm' => ['approved' => true],
            'development_lead' => ['approved' => true],
        ];
        $sitUatData['sit3_docs'] = [['docId' => $signOff->id, 'doc_type' => 'SIT_SIGNOFF']];

        $project->update(['sit_uat_data' => $sitUatData]);
    }

    /**
     * PM menyelesaikan Tahap 1 (Persiapan Skenario UAT) lagi setelah pengulangan.
     * `activeUatStep` bukan kunci server-managed sehingga jalannya lewat form
     * proyek biasa, sama seperti di aplikasi.
     */
    private function reopenUatExecutionStep(Project $project): void
    {
        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'sitUatData' => ['activeUatStep' => 2],
        ])->assertOk()
            ->assertJsonPath('data.sit_uat_data.activeUatStep', 2);
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
        // Pemohon proyek memakai akun aplikasinya sendiri — akun yang sama dengan
        // `created_by` — sesuai `UatApprovalRole::requiredMode()`. Link eksternal hanya
        // untuk pimpinan grup dan pimpinan divisi pemohon yang belum tentu punya akun.
        $defaultParticipants = [
            $this->internalApprover('Requester', 'requester'),
            $this->externalApprover('Requester Group Lead', 'requester_group_lead', '081222222222'),
            $this->externalApprover('Requester Division Lead', 'requester_division_lead', '081233333333'),
            $this->internalApprover('Developer', 'developer', $this->developer->id),
            $this->internalApprover('Analyst PM', 'analyst_pm'),
            $this->internalApprover('Development Group Lead', 'development_group_lead', $this->devGroupLead->id),
            $this->internalApprover('Technology Division Lead', 'technology_division_lead', $this->techDivisionLead->id),
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

    /**
     * Proyek yang sudah berada di Tahap 3 dengan kesimpulan UAT final, yaitu
     * keadaan minimum yang dituntut `UatApprovalService::startNewRound()`.
     * `uat2_summary.submittedAt` sengaja dibiarkan kosong agar Tahap 2 masih dapat
     * disimpan — kunci snapshot itu yang menahan penyimpanan berikutnya.
     */
    private function makeFinalizedUatProject(array $sitUatData = []): Project
    {
        return $this->makeUatProject(array_merge([
            'activeUatStep' => 3,
            'uat2_summary' => ['conclusion' => 'accepted'],
            'uat2_scenarios' => [],
        ], $sitUatData));
    }

    private function externalApprover(string $name, string $role, string $phone): array
    {
        return [
            'id' => fake()->uuid(), 'name' => $name, 'role' => $name, 'unit' => 'Divisi Peminta',
            'phone' => $phone, 'isApprover' => true, 'approvalRole' => $role,
            'approvalMode' => 'external_link', 'userId' => null,
        ];
    }

    private function internalApprover(string $name, string $role, ?int $userId = null): array
    {
        return [
            'id' => fake()->uuid(), 'name' => $name, 'role' => $name, 'unit' => 'Divisi TI',
            'phone' => '', 'isApprover' => true, 'approvalRole' => $role,
            'approvalMode' => 'internal_account', 'userId' => $userId ?? $this->admin->id,
        ];
    }

    private function makeTask(Project $project, string $title, TaskStatus $status = TaskStatus::DONE): ProjectTask
    {
        // Assignee wajib menjadi anggota tim proyek agar task dapat diperbarui
        // lewat `PATCH /tasks/{id}` (lihat TaskController::isProjectMember).
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
            'status' => $status->value,
            'assignee_id' => $this->developer->id,
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
