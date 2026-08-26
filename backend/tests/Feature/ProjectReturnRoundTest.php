<?php

namespace Tests\Feature;

use App\Enums\CyberCheckType;
use App\Enums\ProjectStatus;
use App\Enums\ReturnRoundStatus;
use App\Enums\TaskStatus;
use App\Enums\TestResult;
use App\Enums\TestingTrack;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Project;
use App\Models\ProjectReturnRound;
use App\Models\ProjectStatusHistory;
use App\Models\ProjectTask;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Siklus hidup satu Putaran Pengembalian, dari sign-off TIDAK LULUS sampai tertutup.
 *
 * Yang dikunci pengujian ini adalah hal-hal yang membuat putaran pengembalian bermakna;
 * tanpa salah satunya, "pengembalian ke pengembangan" kembali menjadi sekadar satu baris
 * riwayat status yang tidak menuntut apa pun:
 *
 * 1. Putaran lahir tepat sekali pada sign-off TIDAK LULUS, dan tidak lahir pada LULUS.
 * 2. Nomor putaran diurut per (proyek, jalur) — dua jalur paralel tidak berbagi nomor.
 * 3. Gerbang keras pengajuan ulang menolak tiga hal dengan urutan dan pesannya sendiri:
 *    putaran tanpa task perbaikan, task tanpa penerima, dan task yang belum selesai.
 *    `take_down` sengaja tidak menahan — permintaan yang dibatalkan secara sadar tidak
 *    boleh mengunci proyek selamanya.
 * 4. Gerbang yang sama berlaku pada `PATCH /projects/{id}/status`, sehingga endpoint
 *    status tidak dapat dipakai memintas perbaikan. Penilaiannya per jalur: proyek yang
 *    dikembalikan Keamanan Siber tetap boleh memulai Pengujian QA.
 * 5. Verdikt `can_resubmit` pada `ProjectResource` harus selalu sepakat dengan
 *    `ProjectReturnRoundService::assertResubmitAllowed()`. Tombol "Ajukan Ulang" di layar
 *    mempercayai verdikt itu, jadi perbedaan pendapat di antara keduanya adalah cacat.
 *
 * @see \App\Services\ProjectReturnRoundService
 */
class ProjectReturnRoundTest extends TestCase
{
    use RefreshDatabase;

    private Division $division;

    /**
     * @var array<string, Role>
     */
    private array $roles = [];

    private User $admin;

    private User $pm;

    private User $developer;

    private User $qaLead;

    private User $qaTester;

    private User $otherQaTester;

    private User $cyberLead;

    private User $pentester;

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create([
            'code' => 'IT-RR',
            'name' => 'Divisi Teknologi Informasi',
        ]);

        $this->admin = $this->makeUser(UserRole::SUPER_ADMIN, 'Super Admin', 'admin-rr@nagari.co.id');
        $this->pm = $this->makeUser(UserRole::PROJECT_MANAGER, 'Analis Pengembangan', 'pm-rr@nagari.co.id');
        $this->developer = $this->makeUser(UserRole::DEVELOPER, 'Developer Perbaikan', 'dev-rr@nagari.co.id');
        $this->qaLead = $this->makeUser(UserRole::QA_LEAD, 'QA Lead', 'qa-lead-rr@nagari.co.id');
        $this->qaTester = $this->makeUser(UserRole::QA_TESTER, 'QA Tester', 'qa-tester-rr@nagari.co.id');
        $this->otherQaTester = $this->makeUser(UserRole::QA_TESTER, 'QA Tester Kedua', 'qa-tester-2-rr@nagari.co.id');
        $this->cyberLead = $this->makeUser(UserRole::CYBER_LEAD, 'Cyber Lead', 'cyber-lead-rr@nagari.co.id');
        $this->pentester = $this->makeUser(UserRole::PENTESTER, 'Pentester', 'pentester-rr@nagari.co.id');
    }

    // ---------------------------------------------------------------------
    // Pembukaan putaran
    // ---------------------------------------------------------------------

    public function test_failed_qa_sign_off_opens_exactly_one_open_return_round(): void
    {
        $project = $this->makeProject('Proyek Pengembalian QA');

        $this->runQaTrackUntilReview($project, 'Perhitungan bunga tidak sesuai ketentuan.', 'high');

        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/sign-off', [
            'project_id' => $project->id,
            'result' => TestResult::FAIL->value,
            'notes' => 'Dikembalikan untuk perbaikan perhitungan bunga.',
        ])->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::FAILED->value)
            ->assertJsonPath('data.status', ProjectStatus::RETURN_TO_DEV->value);

        $rounds = ProjectReturnRound::where('project_id', $project->id)->get();

        $this->assertCount(1, $rounds);
        $this->assertDatabaseHas('project_return_rounds', [
            'project_id' => $project->id,
            'track' => TestingTrack::QA->value,
            'round_number' => 1,
            'status' => ReturnRoundStatus::OPEN->value,
            'returned_by' => $this->qaLead->id,
            'lead_notes' => 'Dikembalikan untuk perbaikan perhitungan bunga.',
            // Tingkat keparahan disalin dari laporan uji, bukan dibaca ulang lewat
            // `test_report_id`; sisi pengembangan memakainya untuk memprioritaskan
            // task perbaikan.
            'severity' => 'high',
        ]);

        $round = $rounds->first();
        $this->assertNotNull($round->returned_at);
        $this->assertNotNull($round->test_report_id);
        $this->assertNull($round->resubmitted_by);
        $this->assertNull($round->resubmitted_at);
        $this->assertTrue($round->isOpen());
    }

    public function test_passing_qa_sign_off_does_not_open_a_return_round(): void
    {
        $project = $this->makeProject('Proyek Lulus QA');

        $this->runQaTrackUntilReview($project, 'Seluruh skenario berjalan sesuai kebutuhan.', null, TestResult::PASS);

        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/sign-off', [
            'project_id' => $project->id,
            'result' => TestResult::PASS->value,
            'notes' => 'Hasil pengujian diterima.',
        ])->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::PASSED->value)
            ->assertJsonPath('data.status', ProjectStatus::QA_PASSED->value)
            ->assertJsonCount(0, 'data.return_rounds');

        $this->assertDatabaseCount('project_return_rounds', 0);
    }

    /**
     * Nomor putaran diurut per (proyek, jalur), bukan per proyek.
     *
     * Kedua jalur berjalan paralel dan dapat mengembalikan proyek secara terpisah, jadi
     * "Pengembalian QA ke-2" harus tetap terbaca sebagai putaran kedua jalur QA meskipun
     * jalur Keamanan Siber juga pernah mengembalikan proyek yang sama di antaranya.
     */
    public function test_round_numbers_are_sequenced_per_project_and_track(): void
    {
        $project = $this->makeProject('Proyek Dua Jalur Mengembalikan');

        $firstQaRound = $this->returnQaTrack($project, 'Temuan putaran pertama.');
        $this->assertSame(1, $firstQaRound->round_number);

        // Putaran pertama diselesaikan lalu jalurnya gagal lagi: yang lahir adalah
        // putaran BARU bernomor 2, bukan putaran lama yang dibuka kembali.
        $this->makeFixTask($project, $firstQaRound, $this->developer, TaskStatus::DONE, 'Perbaikan putaran pertama');
        $secondQaRound = $this->returnQaTrack($project, 'Temuan putaran kedua.');
        $this->assertSame(2, $secondQaRound->round_number);
        $this->assertNotSame($firstQaRound->id, $secondQaRound->id);

        // Jalur Keamanan Siber pada proyek yang sama memulai penomorannya dari 1.
        $cyberRound = $this->returnCyberTrack($project, 'Temuan kerentanan.');
        $this->assertSame(1, $cyberRound->round_number);

        $this->assertDatabaseHas('project_return_rounds', [
            'project_id' => $project->id,
            'track' => TestingTrack::QA->value,
            'round_number' => 2,
            'status' => ReturnRoundStatus::OPEN->value,
        ]);
        $this->assertDatabaseHas('project_return_rounds', [
            'project_id' => $project->id,
            'track' => TestingTrack::CYBER->value,
            'round_number' => 1,
            'status' => ReturnRoundStatus::OPEN->value,
        ]);
        $this->assertDatabaseHas('project_return_rounds', [
            'id' => $firstQaRound->id,
            'status' => ReturnRoundStatus::RESUBMITTED->value,
        ]);
    }

    // ---------------------------------------------------------------------
    // Gerbang keras pengajuan ulang
    // ---------------------------------------------------------------------

    public function test_resubmit_is_refused_when_the_open_round_has_no_fix_task(): void
    {
        $project = $this->makeProject('Proyek Tanpa Task Perbaikan');
        $round = $this->returnQaTrack($project, 'Perbaiki validasi tanggal.');

        $this->submitQa($project, 'Sudah diperbaiki.')
            ->assertStatus(422)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath(
                'message',
                'Pengujian QA — Pengembalian ke-1 belum memiliki satu pun task perbaikan. '
                . 'Buat task perbaikan atas temuan yang dikembalikan lebih dulu, '
                . 'kerjakan sampai selesai, baru pengujiannya dapat diajukan ulang.'
            );

        $this->assertRoundStillOpen($project, $round);
    }

    public function test_resubmit_is_refused_when_a_fix_task_has_no_assignee(): void
    {
        $project = $this->makeProject('Proyek Task Tanpa Penerima');
        $round = $this->returnQaTrack($project, 'Perbaiki validasi tanggal.');

        // Task tanpa penerima tidak punya penanggung jawab, sehingga "sudah dikerjakan"
        // tidak dapat dipertanggungjawabkan siapa pun — walau statusnya sudah selesai.
        $task = $this->makeFixTask($project, $round, null, TaskStatus::DONE, 'Perbaikan tanpa penerima');

        $this->submitQa($project, 'Sudah diperbaiki.')
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Setiap task perbaikan pada Pengujian QA — Pengembalian ke-1 wajib memiliki penerima '
                . 'sebelum pengujiannya diajukan ulang. Task tanpa penerima: '
                . "#{$task->id} Perbaikan tanpa penerima."
            );

        $this->assertRoundStillOpen($project, $round);
    }

    public function test_resubmit_is_refused_when_a_fix_task_is_not_done_yet(): void
    {
        $project = $this->makeProject('Proyek Task Belum Selesai');
        $round = $this->returnQaTrack($project, 'Perbaiki validasi tanggal.');

        $this->makeFixTask($project, $round, $this->developer, TaskStatus::DONE, 'Perbaikan selesai');
        $pending = $this->makeFixTask($project, $round, $this->developer, TaskStatus::IN_PROGRESS, 'Perbaikan berjalan');

        $this->submitQa($project, 'Sudah diperbaiki.')
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Seluruh task perbaikan pada Pengujian QA — Pengembalian ke-1 harus selesai sebelum '
                . 'pengujiannya diajukan ulang. Task yang belum selesai: '
                . "#{$pending->id} Perbaikan berjalan."
            );

        $this->assertRoundStillOpen($project, $round);
    }

    /**
     * `take_down` tidak menahan pengajuan ulang.
     *
     * Permintaan perbaikan yang dibatalkan secara sadar tidak boleh mengunci proyek pada
     * task yang memang tidak akan pernah dikerjakan. Aturan pengecualian yang sama sudah
     * dipakai gerbang SIT lewat `Project::sitScopeTasks()`.
     */
    public function test_a_taken_down_fix_task_does_not_block_the_resubmit(): void
    {
        $project = $this->makeProject('Proyek Task Dibatalkan');
        $round = $this->returnQaTrack($project, 'Dua temuan, satu dibatalkan.');

        $this->makeFixTask($project, $round, $this->developer, TaskStatus::DONE, 'Perbaikan dikerjakan');
        $this->makeFixTask($project, $round, $this->developer, TaskStatus::TAKE_DOWN, 'Perbaikan dibatalkan');

        $this->submitQa($project, 'Satu temuan diperbaiki, satu dibatalkan atas kesepakatan.')
            ->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::SUBMITTED->value);

        $this->assertDatabaseHas('project_return_rounds', [
            'id' => $round->id,
            'status' => ReturnRoundStatus::RESUBMITTED->value,
        ]);
    }

    public function test_successful_resubmit_closes_the_round(): void
    {
        $project = $this->makeProject('Proyek Ditutup Setelah Diajukan Ulang');
        $round = $this->returnQaTrack($project, 'Perbaiki perhitungan bunga.');
        $this->makeFixTask($project, $round, $this->developer, TaskStatus::DONE, 'Perbaikan perhitungan bunga');

        $this->submitQa($project, 'Perhitungan bunga sudah diperbaiki dan diuji ulang internal.')
            ->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::SUBMITTED->value)
            ->assertJsonPath('data.status', ProjectStatus::READY_FOR_QA->value);

        // Penutupan tidak menghapus sisi pengujian barisnya: putaran tertutup tetap
        // menjadi riwayat lengkap siapa mengembalikan, apa pesannya, dan siapa yang
        // akhirnya mengajukan ulang.
        $this->assertDatabaseHas('project_return_rounds', [
            'id' => $round->id,
            'status' => ReturnRoundStatus::RESUBMITTED->value,
            'returned_by' => $this->qaLead->id,
            'lead_notes' => 'Perbaiki perhitungan bunga.',
            'resubmitted_by' => $this->pm->id,
            'resubmit_notes' => 'Perhitungan bunga sudah diperbaiki dan diuji ulang internal.',
        ]);

        $this->assertNotNull($round->fresh()->resubmitted_at);
    }

    // ---------------------------------------------------------------------
    // Pintu belakang: PATCH /projects/{id}/status
    // ---------------------------------------------------------------------

    public function test_status_endpoint_cannot_bypass_the_qa_resubmit_gate(): void
    {
        $project = $this->makeProject('Proyek Pintu Belakang QA');
        $round = $this->returnQaTrack($project, 'Perbaiki validasi tanggal.');

        $expectedMessage = 'Pengujian QA — Pengembalian ke-1 belum memiliki satu pun task perbaikan. '
            . 'Buat task perbaikan atas temuan yang dikembalikan lebih dulu, '
            . 'kerjakan sampai selesai, baru pengujiannya dapat diajukan ulang.';

        // Riwayat dihitung sebelum percobaan, bukan diasumsikan kosong: penyiapan proyek
        // ini memang sudah melewati `READY_FOR_QA` lalu `QA_IN_PROGRESS` secara sah pada
        // putaran pengujian pertamanya, jadi keberadaan barisnya bukan bukti kebocoran.
        // Yang harus dibuktikan adalah tidak ada baris BARU setelah gerbang menolak.
        $historyCount = fn (ProjectStatus $status): int => ProjectStatusHistory::query()
            ->where('project_id', $project->id)
            ->where('to_status', $status->value)
            ->count();

        $readyForQaBefore = $historyCount(ProjectStatus::READY_FOR_QA);
        $qaInProgressBefore = $historyCount(ProjectStatus::QA_IN_PROGRESS);

        // Dua status tujuan sekaligus: `READY_FOR_QA` (pengajuan) dan `QA_IN_PROGRESS`
        // (disposisi ulang tanpa lewat READY_FOR_QA). Keduanya ada pada `match` gerbang.
        $this->patchStatus($project, ProjectStatus::READY_FOR_QA)
            ->assertStatus(422)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('message', $expectedMessage);

        $this->patchStatus($project, ProjectStatus::QA_IN_PROGRESS)
            ->assertStatus(422)
            ->assertJsonPath('message', $expectedMessage);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'status' => ProjectStatus::RETURN_TO_DEV->value,
        ]);
        // `RETURN_TO_DEV` adalah baris riwayat terakhir: gerbang menolak sebelum
        // transisi sempat menulis apa pun, jadi kedua status tujuan tidak boleh
        // menambah satu baris pun.
        $this->assertSame(
            $readyForQaBefore,
            $historyCount(ProjectStatus::READY_FOR_QA),
            'Gerbang menolak, jadi tidak boleh ada baris riwayat READY_FOR_QA baru.'
        );
        $this->assertSame(
            $qaInProgressBefore,
            $historyCount(ProjectStatus::QA_IN_PROGRESS),
            'Gerbang menolak, jadi tidak boleh ada baris riwayat QA_IN_PROGRESS baru.'
        );
        $this->assertRoundStillOpen($project, $round);
    }

    public function test_status_endpoint_cannot_bypass_the_cyber_resubmit_gate(): void
    {
        $project = $this->makeProject('Proyek Pintu Belakang Siber');
        $round = $this->returnCyberTrack($project, 'Perbaiki kerentanan injeksi.');

        $this->patchStatus($project, ProjectStatus::CYBER_IN_PROGRESS)
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Audit Keamanan Siber — Pengembalian ke-1 belum memiliki satu pun task perbaikan. '
                . 'Buat task perbaikan atas temuan yang dikembalikan lebih dulu, '
                . 'kerjakan sampai selesai, baru pengujiannya dapat diajukan ulang.'
            );

        $this->assertRoundStillOpen($project, $round, TestingTrack::CYBER);
    }

    /**
     * Gerbangnya per jalur, bukan per proyek.
     *
     * Dua jalur pengujian berjalan paralel. Proyek yang dikembalikan Keamanan Siber tetap
     * boleh memulai Pengujian QA yang belum berjalan: menahannya berarti satu jalur dapat
     * membekukan pekerjaan jalur lain yang tidak punya temuan apa pun.
     */
    public function test_a_cyber_return_does_not_block_starting_the_qa_track(): void
    {
        $project = $this->makeProject('Proyek Siber Mengembalikan, QA Jalan');
        $this->returnCyberTrack($project, 'Perbaiki kerentanan injeksi.');

        $this->assertSame(TrackStatus::NOT_SUBMITTED, $project->fresh()->qaTrackStatus());

        $this->patchStatus($project, ProjectStatus::READY_FOR_QA)
            ->assertOk()
            ->assertJsonPath('data.status', ProjectStatus::READY_FOR_QA->value);
    }

    /**
     * Gerbangnya dinyatakan atas status TUJUAN, bukan atas status sekarang.
     *
     * Membatasinya pada `RETURN_TO_DEV` saja menyisakan lubang: begitu jalur lain
     * menggerakkan penunjuk siklus utama keluar dari `RETURN_TO_DEV` — misalnya disposisi
     * Keamanan Siber yang sah memindahkannya ke `CYBER_IN_PROGRESS` — gerbang tidak akan
     * pernah menyala lagi, dan jalur QA dapat kembali masuk antrean pengujian tanpa satu
     * pun perbaikan selesai.
     *
     * Statusnya disetel langsung pada fixture, bukan lewat disposisi Keamanan Siber,
     * karena lapisan service kini sudah mencegah keadaan ini terbentuk (`assignTester()`
     * menolak jalur yang putarannya masih terbuka). Yang sedang diuji di sini adalah
     * gerbang `ProjectWorkflowService` sendirian.
     */
    public function test_resubmit_gate_still_applies_after_the_project_left_return_to_dev(): void
    {
        $project = $this->makeProject('Proyek Keluar dari RETURN_TO_DEV');
        $round = $this->returnQaTrack($project, 'Perbaiki validasi tanggal.');

        $project->update(['status' => ProjectStatus::CYBER_IN_PROGRESS->value]);

        $this->patchStatus($project, ProjectStatus::QA_IN_PROGRESS)
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Pengujian QA — Pengembalian ke-1 belum memiliki satu pun task perbaikan. '
                . 'Buat task perbaikan atas temuan yang dikembalikan lebih dulu, '
                . 'kerjakan sampai selesai, baru pengujiannya dapat diajukan ulang.'
            );

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'status' => ProjectStatus::CYBER_IN_PROGRESS->value,
        ]);
        $this->assertRoundStillOpen($project, $round);
    }

    // ---------------------------------------------------------------------
    // Disposisi ulang jalur yang sedang dikembalikan
    // ---------------------------------------------------------------------

    /**
     * Lead tidak dapat mendisposisikan ulang jalur yang putarannya masih terbuka.
     *
     * Status jalur `FAILED` bukan `NOT_SUBMITTED` dan bukan pula lulus, sehingga tanpa
     * gerbang khusus ia lolos kedua pemeriksaan lain pada `assignTester()` — pengujian
     * dapat diulang tanpa pernah melewati `submitRequest()`, sehingga putarannya tidak
     * pernah tertutup dan gerbang pengajuan ulang tidak pernah dinilai.
     */
    public function test_failed_track_with_an_open_round_cannot_be_dispositioned_again(): void
    {
        $project = $this->makeProject('Proyek Disposisi Saat Dikembalikan');
        $round = $this->returnQaTrack($project, 'Perbaiki validasi tanggal.');
        $assigneeBefore = $project->fresh()->qa_assignee_id;

        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/assign', [
            'project_id' => $project->id,
            'assignee_id' => $this->otherQaTester->id,
        ])->assertStatus(422)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath(
                'message',
                'Pengujian QA proyek ini sedang dikembalikan ke pengembangan melalui '
                . 'Pengujian QA — Pengembalian ke-1. Disposisi baru dapat dilakukan setelah PM '
                . 'menyelesaikan task perbaikannya dan mengajukan pengujiannya ulang.'
            );

        $fresh = $project->fresh();
        $this->assertSame(TrackStatus::FAILED, $fresh->qaTrackStatus());
        $this->assertSame($assigneeBefore, $fresh->qa_assignee_id);
        $this->assertRoundStillOpen($project, $round);

        // Pasangan positifnya: setelah perbaikan selesai dan jalurnya diajukan ulang,
        // disposisi kembali terbuka untuk Lead.
        $this->makeFixTask($project, $round, $this->developer, TaskStatus::DONE, 'Perbaikan validasi tanggal');
        $this->submitQa($project, 'Validasi tanggal sudah diperbaiki.')->assertOk();

        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/assign', [
            'project_id' => $project->id,
            'assignee_id' => $this->otherQaTester->id,
        ])->assertOk()
            ->assertJsonPath('data.qa_status', TrackStatus::IN_PROGRESS->value)
            ->assertJsonPath('data.qa_assignee_id', $this->otherQaTester->id);
    }

    // ---------------------------------------------------------------------
    // Task perbaikan bertanda putaran
    // ---------------------------------------------------------------------

    public function test_fix_task_can_be_tagged_to_an_open_round_of_the_same_project(): void
    {
        $project = $this->makeProject('Proyek Task Bertanda Putaran');
        $round = $this->returnQaTrack($project, 'Perbaiki validasi tanggal.');
        $project->teamMembers()->create([
            'user_id' => $this->developer->id,
            'role_in_project' => 'Backend',
        ]);

        $this->actingAs($this->pm)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Perbaiki validasi tanggal jatuh tempo',
            'assignee_id' => $this->developer->id,
            'return_round_id' => $round->id,
            'priority' => 'High',
        ])->assertStatus(201)
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('project_tasks', [
            'project_id' => $project->id,
            'title' => 'Perbaiki validasi tanggal jatuh tempo',
            'return_round_id' => $round->id,
        ]);
        $this->assertSame(1, $round->tasks()->count());
    }

    public function test_fix_task_tagged_to_another_projects_round_is_rejected(): void
    {
        $project = $this->makeProject('Proyek Penerima Task');
        $otherProject = $this->makeProject('Proyek Pemilik Putaran');
        $foreignRound = $this->returnQaTrack($otherProject, 'Temuan proyek lain.');

        $this->actingAs($this->pm)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task menumpang putaran proyek lain',
            'return_round_id' => $foreignRound->id,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['return_round_id'])
            ->assertJsonPath(
                'errors.return_round_id.0',
                'Putaran pengembalian yang dipilih bukan milik proyek ini atau sudah diajukan ulang, sehingga task perbaikan tidak dapat ditambahkan ke dalamnya.'
            );

        $this->assertDatabaseMissing('project_tasks', ['project_id' => $project->id]);
    }

    /**
     * Putaran yang sudah diajukan ulang tidak dapat menerima task perbaikan baru.
     *
     * Riwayatnya sudah tertutup, jadi gerbang pengajuan ulangnya tidak akan pernah
     * menilai task yang ditambahkan sesudahnya — task itu hanya menjadi pekerjaan yang
     * tidak dituntut siapa pun.
     */
    public function test_fix_task_tagged_to_a_resubmitted_round_is_rejected(): void
    {
        $project = $this->makeProject('Proyek Putaran Sudah Tertutup');
        $round = $this->returnQaTrack($project, 'Perbaiki validasi tanggal.');
        $this->makeFixTask($project, $round, $this->developer, TaskStatus::DONE, 'Perbaikan validasi tanggal');
        $this->submitQa($project, 'Sudah diperbaiki.')->assertOk();

        $this->actingAs($this->pm)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task menyusul pada putaran tertutup',
            'return_round_id' => $round->id,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['return_round_id']);

        $this->assertSame(1, $round->tasks()->count());
    }

    // ---------------------------------------------------------------------
    // Verdikt gerbang pada payload proyek
    // ---------------------------------------------------------------------

    /**
     * `can_resubmit` pada `ProjectResource` wajib sepakat dengan verdikt service.
     *
     * Verdikt itu dihitung server dan dipercaya tombol "Ajukan Ulang" di layar. Bila
     * resource dan `assertResubmitAllowed()` berbeda pendapat, pengguna melihat tombol
     * aktif yang selalu ditolak — atau tombol mati pada pekerjaan yang sudah boleh
     * diajukan. Karena itu keempat keadaan gerbang diperiksa berpasangan: verdikt
     * payload dan jawaban endpoint pengajuan pada keadaan yang sama.
     */
    public function test_return_round_payload_mirrors_the_service_gate_verdict(): void
    {
        $project = $this->makeProject('Proyek Verdikt Gerbang');
        $round = $this->returnQaTrack($project, 'Perbaiki perhitungan bunga.');

        // Keadaan 1 — putaran terbuka tanpa satu pun task perbaikan.
        $payload = $this->readRoundPayload($project);
        $this->assertSame($round->id, $payload['id']);
        $this->assertSame(TestingTrack::QA->value, $payload['track']);
        $this->assertSame(ReturnRoundStatus::OPEN->value, $payload['status']);
        $this->assertTrue($payload['is_open']);
        $this->assertFalse($payload['can_resubmit']);
        $this->assertSame('Belum ada task perbaikan atas temuan yang dikembalikan.', $payload['resubmit_blocker']);
        $this->assertSame(['total' => 0, 'blocking' => 0, 'unassigned' => 0], $payload['fix_task_summary']);
        $this->submitQa($project, 'Coba ajukan ulang.')->assertStatus(422);

        // Keadaan 2 — task perbaikan ada, tetapi belum punya penerima.
        $task = $this->makeFixTask($project, $round, null, TaskStatus::TODO, 'Perbaikan perhitungan bunga');
        $payload = $this->readRoundPayload($project);
        $this->assertFalse($payload['can_resubmit']);
        $this->assertSame('1 task perbaikan belum memiliki penerima.', $payload['resubmit_blocker']);
        $this->assertSame(['total' => 1, 'blocking' => 1, 'unassigned' => 1], $payload['fix_task_summary']);
        $this->submitQa($project, 'Coba ajukan ulang.')->assertStatus(422);

        // Keadaan 3 — penerima sudah ada, pekerjaannya belum selesai.
        $task->update(['assignee_id' => $this->developer->id]);
        $payload = $this->readRoundPayload($project);
        $this->assertFalse($payload['can_resubmit']);
        $this->assertSame('1 task perbaikan belum selesai.', $payload['resubmit_blocker']);
        $this->assertSame(['total' => 1, 'blocking' => 1, 'unassigned' => 0], $payload['fix_task_summary']);
        $this->submitQa($project, 'Coba ajukan ulang.')->assertStatus(422);

        // Keadaan 4 — perbaikan selesai: verdikt terbuka dan pengajuannya diterima.
        $task->update(['status' => TaskStatus::DONE->value]);
        $payload = $this->readRoundPayload($project);
        $this->assertTrue($payload['can_resubmit']);
        $this->assertNull($payload['resubmit_blocker']);
        $this->assertSame(['total' => 1, 'blocking' => 0, 'unassigned' => 0], $payload['fix_task_summary']);
        $this->assertSame($this->developer->name, $payload['fix_tasks'][0]['assignee']);
        $this->submitQa($project, 'Perhitungan bunga sudah diperbaiki.')->assertOk();

        // Putaran yang sudah tertutup tidak lagi mengumumkan penghalang apa pun.
        $payload = $this->readRoundPayload($project);
        $this->assertFalse($payload['is_open']);
        $this->assertFalse($payload['can_resubmit']);
        $this->assertNull($payload['resubmit_blocker']);
        $this->assertSame($this->pm->name, $payload['resubmitted_by_name']);
    }

    // ---------------------------------------------------------------------
    // Fixture
    // ---------------------------------------------------------------------

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

    /**
     * Tiga langkah pertama jalur QA, sampai laporan pelaksana menunggu sign-off.
     */
    private function runQaTrackUntilReview(
        Project $project,
        string $testerNotes,
        ?string $severity = null,
        TestResult $testerResult = TestResult::FAIL
    ): void {
        $this->submitQa($project)->assertOk();

        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/assign', [
            'project_id' => $project->id,
            'assignee_id' => $this->qaTester->id,
        ])->assertOk();

        $this->actingAs($this->qaTester)->postJson('/api/v1/qa-requests/report', [
            'project_id' => $project->id,
            'result' => $testerResult->value,
            'severity' => $severity,
            'notes' => $testerNotes,
        ])->assertCreated();
    }

    /**
     * Jalankan jalur QA sampai Lead menyatakannya TIDAK LULUS, lalu kembalikan putarannya.
     *
     * Empat langkah dijalankan lewat endpoint aslinya supaya putaran yang diuji benar-benar
     * lahir dari sign-off, bukan disemai langsung ke tabel.
     */
    private function returnQaTrack(Project $project, string $leadNotes): ProjectReturnRound
    {
        $this->runQaTrackUntilReview($project, 'Temuan pelaksana: ' . $leadNotes, 'high');

        $this->actingAs($this->qaLead)->postJson('/api/v1/qa-requests/sign-off', [
            'project_id' => $project->id,
            'result' => TestResult::FAIL->value,
            'notes' => $leadNotes,
        ])->assertOk();

        return $this->openRound($project, TestingTrack::QA);
    }

    /**
     * Padanan `returnQaTrack()` untuk jalur Audit Keamanan Siber.
     */
    private function returnCyberTrack(Project $project, string $leadNotes): ProjectReturnRound
    {
        $this->actingAs($this->pm)->postJson('/api/v1/cyber-requests/submit', [
            'project_id' => $project->id,
            'cyber_check_type' => CyberCheckType::PENTEST->value,
            'cyber_target_url' => 'https://staging.banknagari.co.id/los',
        ])->assertOk();

        $this->actingAs($this->cyberLead)->postJson('/api/v1/cyber-requests/assign', [
            'project_id' => $project->id,
            'assignee_id' => $this->pentester->id,
        ])->assertOk();

        $this->actingAs($this->pentester)->postJson('/api/v1/cyber-requests/report', [
            'project_id' => $project->id,
            'result' => TestResult::FAIL->value,
            'severity' => 'critical',
            'notes' => 'Temuan pelaksana: ' . $leadNotes,
        ])->assertCreated();

        $this->actingAs($this->cyberLead)->postJson('/api/v1/cyber-requests/sign-off', [
            'project_id' => $project->id,
            'result' => TestResult::FAIL->value,
            'notes' => $leadNotes,
        ])->assertOk();

        return $this->openRound($project, TestingTrack::CYBER);
    }

    private function submitQa(Project $project, ?string $notes = null): TestResponse
    {
        return $this->actingAs($this->pm)->postJson('/api/v1/qa-requests/submit', array_filter([
            'project_id' => $project->id,
            'notes' => $notes,
        ], fn ($value): bool => $value !== null));
    }

    private function patchStatus(Project $project, ProjectStatus $status): TestResponse
    {
        // Dilakukan `super_admin` supaya yang menolak permintaan pasti gerbang prasyarat
        // bisnis, bukan matriks wewenang role.
        return $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}/status", [
            'status' => $status->value,
        ]);
    }

    /**
     * Task perbaikan bertanda putaran, dibuat langsung ke tabel.
     *
     * Pintu resminya `POST /projects/{projectId}/tasks` dan itu diuji terpisah; di sini
     * yang dibutuhkan hanyalah keadaan task, sehingga membuatnya lewat model menjaga
     * pengujian gerbang tetap terbaca sebagai pengujian gerbang.
     */
    private function makeFixTask(
        Project $project,
        ProjectReturnRound $round,
        ?User $assignee,
        TaskStatus $status,
        string $title
    ): ProjectTask {
        return ProjectTask::create([
            'project_id' => $project->id,
            'return_round_id' => $round->id,
            'title' => $title,
            'assignee_id' => $assignee?->id,
            'status' => $status->value,
        ]);
    }

    private function openRound(Project $project, TestingTrack $track): ProjectReturnRound
    {
        $round = $project->fresh()->openReturnRound($track);

        $this->assertNotNull($round, "Sign-off TIDAK LULUS {$track->label()} tidak membuka putaran pengembalian.");

        return $round;
    }

    private function assertRoundStillOpen(
        Project $project,
        ProjectReturnRound $round,
        TestingTrack $track = TestingTrack::QA
    ): void {
        $this->assertDatabaseHas('project_return_rounds', [
            'id' => $round->id,
            'status' => ReturnRoundStatus::OPEN->value,
            'resubmitted_by' => null,
            'resubmitted_at' => null,
        ]);
        $this->assertSame(TrackStatus::FAILED, $project->fresh()->trackStatus($track));
    }

    /**
     * Satu putaran pertama pada payload `return_rounds` milik `ProjectResource`.
     *
     * @return array<string, mixed>
     */
    private function readRoundPayload(Project $project): array
    {
        $response = $this->actingAs($this->pm)
            ->getJson("/api/v1/projects/{$project->id}")
            ->assertOk();

        $rounds = $response->json('data.return_rounds');

        $this->assertIsArray($rounds);
        $this->assertNotEmpty($rounds, 'Payload proyek tidak memuat satu pun putaran pengembalian.');

        return $rounds[0];
    }
}
