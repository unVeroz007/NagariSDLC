<?php

namespace App\Services;

use App\Enums\CyberCheckType;
use App\Enums\ProjectStatus;
use App\Enums\TestResult;
use App\Enums\TestingTrack;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use App\Events\NotificationCreated;
use App\Models\ActivityLog;
use App\Models\DocumentVault;
use App\Models\Notification;
use App\Models\Project;
use App\Models\TestReport;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\DB;

/**
 * Satu sumber kebenaran untuk dua jalur pengujian paralel: QA dan Keamanan Siber.
 *
 * Alurnya `submitRequest → assignTester → submitReport → signOff`; laporan berhenti
 * di REVIEW hingga Lead memutuskan. Status utama selalu melalui workflow dan bukti
 * hanya dirujuk dari document vault. Kolom jalur menjadi sumber kebenaran independen;
 * sinkronisasi status utama boleh tertunda ketika jalur paralel sedang aktif.
 */
class TestingTrackService
{
    /**
     * Status jalur yang berarti jalur ini sudah menjadi urusan tim pengujiannya.
     *
     * Dipakai untuk menolak pengajuan ganda dari PM.
     */
    private const ENGAGED_TRACK_STATUSES = [
        TrackStatus::SUBMITTED,
        TrackStatus::IN_PROGRESS,
        TrackStatus::REVIEW,
    ];

    /**
     * Status utama proyek yang sah untuk mengajukan salah satu jalur pengujian.
     *
     * Pengujian QA dan Keamanan Siber adalah fase sesudah pengembangan. Seluruh
     * pekerjaan pengembangan, termasuk SIT dan UAT Internal, harus dinyatakan selesai
     * lebih dulu — dan penanda selesainya adalah `DEV_COMPLETED`. Karena itu status
     * pengembangan (`IN_DEVELOPMENT`, `SIT_*`, `UAT_*`) tidak ada di daftar ini.
     *
     * `RETURN_TO_DEV` tetap sah: proyek yang dikembalikan karena defect boleh diajukan
     * ulang langsung setelah perbaikan tanpa mengulang seluruh siklus SIT/UAT.
     *
     * Status pengujian yang sedang berjalan (`READY_FOR_QA` sampai `CYBER_PASSED`) juga
     * sah karena dua jalur berjalan paralel: penunjuk siklus utama bisa sedang dipegang
     * jalur lain saat PM mengajukan jalur yang belum berjalan.
     *
     * Cermin frontend: `STATUSES_ALLOWING_QA_TRACK_START` dan
     * `STATUSES_ALLOWING_CYBER_TRACK_START` di `frontend/src/constants/projectStatus.js`.
     */
    private const SUBMITTABLE_MAIN_STATUSES = [
        ProjectStatus::DEV_COMPLETED,
        ProjectStatus::RETURN_TO_DEV,
        ProjectStatus::READY_FOR_QA,
        ProjectStatus::QA_IN_PROGRESS,
        ProjectStatus::QA_PASSED,
        ProjectStatus::CYBER_IN_PROGRESS,
        ProjectStatus::CYBER_PASSED,
    ];

    public function __construct(
        private readonly ProjectWorkflowService $workflowService,
        private readonly ProjectReturnRoundService $returnRoundService,
    ) {}

    /**
     * Langkah 1 — PM mengajukan proyek ke satu jalur pengujian.
     *
     * @param  array<string, mixed>  $payload  Sudah tervalidasi Form Request.
     */
    public function submitRequest(Project $project, TestingTrack $track, User $actor, array $payload): Project
    {
        $this->assertActorIsAssignedProjectManager($project, $actor);
        $this->assertProjectIsReadyForTesting($project, $track);

        $currentTrackStatus = $project->trackStatus($track);

        if (in_array($currentTrackStatus, self::ENGAGED_TRACK_STATUSES, true)) {
            throw new Exception(
                "{$track->label()} proyek ini sudah diajukan dan sedang berjalan ({$currentTrackStatus->label()}). Tidak perlu diajukan ulang."
            );
        }

        if ($currentTrackStatus->isPassed()) {
            throw new Exception(
                "{$track->label()} proyek ini sudah dinyatakan lulus. Pengajuan ulang hanya relevan setelah proyek kembali dikembangkan."
            );
        }

        // Gerbang keras pengajuan ulang. Diletakkan sesudah pemeriksaan keadaan dasar di
        // atas supaya pengajuan ganda tetap dijawab pesannya sendiri, bukan pesan
        // "perbaikan belum selesai" yang menyesatkan. Tidak berefek bila jalur ini tidak
        // sedang dikembalikan.
        $this->returnRoundService->assertResubmitAllowed($project, $track);

        return DB::transaction(function () use ($project, $track, $actor, $payload, $currentTrackStatus): Project {
            $attributes = [
                $track->statusColumn() => TrackStatus::SUBMITTED->value,
                // Disposisi lama dikosongkan: pengajuan baru berarti jalur kembali
                // menunggu keputusan Lead, bukan langsung menjadi tugas tester lama.
                $track->assigneeColumn() => null,
            ];

            if (filled($payload['staging_url'] ?? null)) {
                $attributes['staging_url'] = $payload['staging_url'];
            }

            if (filled($payload['target_completion_date'] ?? null)) {
                $attributes['current_stage_deadline'] = $payload['target_completion_date'];
            }

            if ($track === TestingTrack::CYBER) {
                $attributes += $this->cyberCheckAttributes($payload);
            }

            $project->fill($attributes)->save();

            // Putaran pengembalian yang perbaikannya baru saja dinyatakan selesai ditutup
            // pada transaksi yang sama dengan pengajuannya. Mengembalikan `null` bila ini
            // pengajuan pertama jalur tersebut, bukan pengajuan ulang.
            $closedRound = $this->returnRoundService->close($project, $track, $actor, $payload['notes'] ?? null);

            // Jalur QA memiliki status utama khusus untuk "sudah diajukan, menunggu
            // disposisi". Jalur Siber tidak punya padanannya, jadi penunjuk siklusnya
            // baru bergerak saat disposisi (CYBER_IN_PROGRESS).
            if ($track === TestingTrack::QA) {
                $this->advanceMainStatusWhenPermitted(
                    $project,
                    ProjectStatus::READY_FOR_QA,
                    $actor,
                    $this->composeSubmissionNote($track, $payload)
                );
            }

            $this->recordTrackAudit(
                $project,
                $track,
                $currentTrackStatus,
                TrackStatus::SUBMITTED,
                $actor,
                $payload['notes'] ?? null,
                $closedRound ? [
                    'return_round_id' => $closedRound->id,
                    'return_round_number' => $closedRound->round_number,
                    'resubmitted_fix_task_count' => $closedRound->tasks()->count(),
                ] : []
            );

            $this->notifyRoles(
                $track->leadRoles(),
                $closedRound ? "{$track->label()} Diajukan Ulang" : "{$track->label()} Diajukan",
                $closedRound
                    ? "Proyek '{$project->title}' diajukan ulang ke {$track->label()} oleh {$actor->name} setelah perbaikan {$closedRound->roundLabel()} selesai. Menunggu disposisi."
                    : "Proyek '{$project->title}' diajukan ke {$track->label()} oleh {$actor->name} dan menunggu disposisi."
            );

            return $project->refresh();
        });
    }

    /**
     * Langkah 2 — Lead mendisposisikan pengujian kepada seorang tester / auditor.
     *
     * Boleh dipanggil ulang untuk mengganti tester selama jalur belum ditutup.
     */
    public function assignTester(Project $project, TestingTrack $track, User $actor, int $assigneeId, ?string $notes = null): Project
    {
        $this->assertActorIsTrackLead($track, $actor);

        $currentTrackStatus = $project->trackStatus($track);

        if ($currentTrackStatus === TrackStatus::NOT_SUBMITTED) {
            throw new Exception(
                "{$track->label()} proyek ini belum diajukan oleh PM, sehingga belum dapat didisposisikan."
            );
        }

        if ($currentTrackStatus->isPassed()) {
            throw new Exception(
                "{$track->label()} proyek ini sudah dinyatakan lulus, sehingga tidak dapat didisposisikan ulang."
            );
        }

        // Jalur yang gagal dan putaran pengembaliannya masih terbuka tidak boleh
        // didisposisikan ulang: bolanya sedang di pengembangan, bukan di Lead.
        //
        // Tanpa gerbang ini pengujian dapat diulang tanpa melewati
        // `submitRequest()` sama sekali — status jalur `FAILED` bukan
        // `NOT_SUBMITTED` dan bukan pula lulus, jadi kedua pemeriksaan di atas
        // meloloskannya. Gerbang pada `ProjectWorkflowService` memang ikut
        // menahannya lewat transisi status utama, tetapi pesannya ditulis untuk PM
        // ("kerjakan task perbaikannya"), sehingga Lead yang membacanya tidak
        // mengerti apa yang harus ia lakukan. Karena itu penolakannya dinyatakan di
        // sini, dengan bahasa yang menyebut siapa yang sedang ditunggu.
        $openReturnRound = $project->openReturnRound($track);

        if ($currentTrackStatus === TrackStatus::FAILED && $openReturnRound) {
            throw new Exception(
                "{$track->label()} proyek ini sedang dikembalikan ke pengembangan melalui "
                . "{$openReturnRound->roundLabel()}. Disposisi baru dapat dilakukan setelah PM "
                . 'menyelesaikan task perbaikannya dan mengajukan pengujiannya ulang.'
            );
        }

        $assignee = User::with('role')->find($assigneeId);

        if (! $assignee) {
            throw new Exception('Pengguna yang dipilih sebagai pelaksana pengujian tidak ditemukan.');
        }

        if (! in_array($assignee->role?->name, $track->testerRoles(), true)) {
            throw new Exception(
                "{$assignee->name} bukan {$track->testerLabel()}, sehingga tidak dapat menerima disposisi {$track->label()}."
            );
        }

        return DB::transaction(function () use ($project, $track, $actor, $assignee, $notes, $currentTrackStatus): Project {
            $project->fill([
                $track->assigneeColumn() => $assignee->id,
                $track->statusColumn() => TrackStatus::IN_PROGRESS->value,
            ])->save();

            $this->advanceMainStatusWhenPermitted(
                $project,
                $track->inProgressStatus(),
                $actor,
                trim("Disposisi {$track->label()} kepada {$assignee->name}. " . ($notes ?? ''))
            );

            $this->recordTrackAudit($project, $track, $currentTrackStatus, TrackStatus::IN_PROGRESS, $actor, $notes, [
                'assignee_id' => $assignee->id,
                'assignee_name' => $assignee->name,
            ]);

            // Notifikasi bergantung peran pada transisi status utama menyapu seluruh
            // role; penerima disposisi berhak mendapat pesan yang menyebut namanya.
            $this->notifyUsers(
                [$assignee->id],
                "Disposisi {$track->label()}",
                "Anda ditugaskan mengerjakan {$track->label()} untuk proyek '{$project->title}' oleh {$actor->name}."
            );

            return $project->refresh();
        });
    }

    /**
     * Langkah 3 — tester / auditor mengirim laporan hasil pengujian.
     *
     * Tidak menutup jalur: statusnya berhenti di REVIEW dan keputusan lulus atau
     * tidak lulus tetap menjadi wewenang Lead pada `signOff()`.
     *
     * @param  array<string, mixed>  $payload  Sudah tervalidasi Form Request.
     */
    public function submitReport(Project $project, TestingTrack $track, User $actor, array $payload): TestReport
    {
        $this->assertActorMaySubmitReport($project, $track, $actor);

        $currentTrackStatus = $project->trackStatus($track);

        if (! in_array($currentTrackStatus, [TrackStatus::IN_PROGRESS, TrackStatus::REVIEW], true)) {
            throw new Exception(
                "Laporan {$track->label()} hanya dapat dikirim setelah Lead mendisposisikan pengujian. Status jalur saat ini: {$currentTrackStatus->label()}."
            );
        }

        $evidenceDocumentIds = $this->resolveEvidenceDocumentIds($project, $track, $payload['evidence_document_ids'] ?? []);
        $result = TestResult::from($payload['result']);

        return DB::transaction(function () use ($project, $track, $actor, $payload, $result, $evidenceDocumentIds, $currentTrackStatus): TestReport {
            $report = TestReport::create([
                'project_id' => $project->id,
                'test_type' => $track->value,
                'tester_id' => $actor->id,
                'result' => $result->value,
                'severity' => $payload['severity'] ?? null,
                'notes' => $payload['notes'] ?? null,
                'checklist' => $payload['checklist'] ?? null,
                'tested_scenarios' => isset($payload['tested_scenarios'])
                    ? (trim((string) $payload['tested_scenarios']) ?: null)
                    : null,
                'attachment_url' => $payload['attachment_url'] ?? null,
                'evidence_document_ids' => $evidenceDocumentIds,
            ]);

            $project->fill([
                $track->statusColumn() => TrackStatus::REVIEW->value,
            ])->save();

            $this->recordTrackAudit($project, $track, $currentTrackStatus, TrackStatus::REVIEW, $actor, $payload['notes'] ?? null, [
                'test_report_id' => $report->id,
                'tester_result' => $result->value,
                'severity' => $payload['severity'] ?? null,
                'evidence_document_ids' => $evidenceDocumentIds,
            ]);

            $this->notifyRoles(
                $track->leadRoles(),
                "Laporan {$track->label()} Menunggu Review",
                "{$actor->name} mengirim laporan {$track->label()} untuk proyek '{$project->title}' dengan hasil {$result->value}. Menunggu sign-off Lead."
            );

            return $report;
        });
    }

    /**
     * Langkah 4 — Lead menutup jalur: lulus, atau kembalikan ke pengembangan.
     *
     * Keputusan Lead disimpan pada kolom terpisah dari hasil tester supaya jejak
     * audit tetap menampilkan keduanya ketika penilaiannya berbeda.
     *
     * `$severity` opsional: bila Lead menetapkannya saat mengembalikan proyek, nilai
     * itu disalin ke putaran pengembalian; jika kosong, putaran memakai severity
     * laporan uji terakhir. Diabaikan pada keputusan LULUS (tidak ada putaran).
     */
    public function signOff(Project $project, TestingTrack $track, User $actor, TestResult $decision, ?string $notes = null, ?string $severity = null): TestReport
    {
        $this->assertActorIsTrackLead($track, $actor);

        $currentTrackStatus = $project->trackStatus($track);

        if ($currentTrackStatus !== TrackStatus::REVIEW) {
            throw new Exception(
                "Sign-off {$track->label()} hanya dapat dilakukan setelah {$track->testerLabel()} mengirim laporan. Status jalur saat ini: {$currentTrackStatus->label()}."
            );
        }

        $report = $project->latestTestReport($track);

        if (! $report) {
            throw new Exception(
                "Belum ada laporan {$track->label()} yang dapat di-sign-off untuk proyek ini."
            );
        }

        $isPass = $decision === TestResult::PASS;
        $targetTrackStatus = $isPass ? TrackStatus::PASSED : TrackStatus::FAILED;
        $targetMainStatus = $isPass ? $track->passedStatus() : ProjectStatus::RETURN_TO_DEV;

        return DB::transaction(function () use (
            $project,
            $track,
            $actor,
            $report,
            $decision,
            $notes,
            $severity,
            $currentTrackStatus,
            $targetTrackStatus,
            $targetMainStatus,
            $isPass
        ): TestReport {
            $report->fill([
                'reviewed_by' => $actor->id,
                'reviewed_result' => $decision->value,
                'review_notes' => $notes,
                'reviewed_at' => now(),
            ])->save();

            $project->fill([
                $track->statusColumn() => $targetTrackStatus->value,
            ])->save();

            // Pengembalian melahirkan satu putaran yang dapat dibaca: jalur mana yang
            // menolak, pesan Lead-nya, dan — setelah PM membuat task perbaikan — apa saja
            // yang harus selesai sebelum jalurnya boleh diajukan ulang. Dibuka di dalam
            // transaksi ini supaya tidak ada keadaan proyek berstatus RETURN_TO_DEV tanpa
            // putaran yang menjelaskan sebabnya.
            $returnRound = $isPass
                ? null
                : $this->returnRoundService->open($project, $track, $actor, $report, $notes, $severity);

            $decisionLabel = $isPass ? 'LULUS' : 'TIDAK LULUS — dikembalikan ke pengembangan';
            $transitionNote = trim("Sign-off {$track->label()}: {$decisionLabel}. " . ($notes ?? ''));

            // Pengembalian ke pengembangan adalah keputusan yang tidak boleh gagal
            // separuh: bila status utama tidak dapat dipindahkan ke RETURN_TO_DEV,
            // seluruh sign-off dibatalkan agar tidak ada jalur bertanda TIDAK LULUS
            // sementara proyek tetap duduk di antrean rilis.
            if ($isPass) {
                $this->advanceMainStatusWhenPermitted($project, $targetMainStatus, $actor, $transitionNote);
            } else {
                $this->workflowService->transition($project, $targetMainStatus, $actor, $transitionNote);
            }

            $this->recordTrackAudit($project, $track, $currentTrackStatus, $targetTrackStatus, $actor, $notes, [
                'test_report_id' => $report->id,
                'tester_result' => $report->result?->value,
                'lead_decision' => $decision->value,
                // Hanya ada pada keputusan TIDAK LULUS. Menaruhnya bernilai null pada
                // keputusan LULUS akan membuat baris audit seolah menyebut putaran yang
                // tidak pernah ada.
                ...($returnRound ? [
                    'return_round_id' => $returnRound->id,
                    'return_round_number' => $returnRound->round_number,
                ] : []),
            ]);

            $this->notifyUsers(
                array_filter([$project->pm_id, $report->tester_id, $project->created_by]),
                "Sign-off {$track->label()}",
                "{$actor->name} menyatakan {$track->label()} proyek '{$project->title}' {$decisionLabel}."
                    . ($notes ? " Catatan: {$notes}" : '')
                    . ($returnRound
                        ? " Buka laman Putaran Pengembalian untuk membuat task perbaikan {$returnRound->roundLabel()}; pengujiannya baru dapat diajukan ulang setelah seluruh task itu selesai."
                        : '')
            );

            return $report->refresh();
        });
    }

    /**
     * Kolom jenis pemeriksaan Siber, sekaligus membersihkan masukan yang tidak relevan.
     *
     * Alamat target hanya bermakna untuk Penetration Test dan rujukan kode hanya
     * bermakna untuk Secure Code Review. Nilai jenis yang tidak dipilih dikosongkan
     * supaya Pentester tidak pernah membaca sisa masukan pengajuan sebelumnya dan
     * mengerjakan ruang lingkup yang salah.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function cyberCheckAttributes(array $payload): array
    {
        $checkType = CyberCheckType::normalize($payload['cyber_check_type'] ?? null);

        if (! $checkType) {
            throw new Exception('Jenis pemeriksaan Audit Keamanan Siber wajib dipilih.');
        }

        return [
            'cyber_check_type' => $checkType->value,
            'cyber_target_url' => $checkType->requiresTargetUrl()
                ? ($payload['cyber_target_url'] ?? null)
                : null,
            'cyber_source_code_ref' => $checkType->requiresSourceCodeRef()
                ? ($payload['cyber_source_code_ref'] ?? null)
                : null,
        ];
    }

    /**
     * Pastikan ID bukti benar-benar milik proyek dan jalur ini.
     *
     * Tanpa pemeriksaan ini, laporan dapat merujuk dokumen proyek lain hanya dengan
     * menebak ID — kebocoran lintas proyek sekaligus jejak audit yang menyesatkan.
     *
     * @param  mixed  $documentIds
     * @return list<int>
     */
    private function resolveEvidenceDocumentIds(Project $project, TestingTrack $track, mixed $documentIds): array
    {
        $requestedIds = collect(is_array($documentIds) ? $documentIds : [])
            ->filter(fn ($id): bool => is_numeric($id))
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values();

        if ($requestedIds->isEmpty()) {
            return [];
        }

        $validIds = DocumentVault::query()
            ->where('project_id', $project->id)
            ->where('document_type', $track->evidenceDocumentType())
            ->whereKey($requestedIds->all())
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id): int => (int) $id);

        $rejectedIds = $requestedIds->diff($validIds);

        if ($rejectedIds->isNotEmpty()) {
            throw new Exception(
                'Sebagian berkas bukti tidak dikenali sebagai dokumen bukti proyek ini: ' . $rejectedIds->implode(', ') . '.'
            );
        }

        return $validIds->values()->all();
    }

    /**
     * Pindahkan penunjuk `projects.status` hanya bila matriks transisi mengizinkan.
     *
     * Lihat catatan kelas: kolom jalur adalah kebenaran, status utama menyusul.
     */
    private function advanceMainStatusWhenPermitted(Project $project, ProjectStatus $targetStatus, User $actor, ?string $notes): void
    {
        if (! $this->workflowService->canTransition($project, $targetStatus)) {
            return;
        }

        $this->workflowService->transition($project, $targetStatus, $actor, $notes);
    }

    /**
     * Hanya PM pemegang disposisi proyek yang boleh mengajukan pengujian.
     */
    private function assertActorIsAssignedProjectManager(Project $project, User $actor): void
    {
        $actor->loadMissing('role');
        $roleName = $actor->role?->name;

        if ($roleName === UserRole::SUPER_ADMIN->value) {
            return;
        }

        if (! in_array($roleName, [UserRole::PROJECT_MANAGER->value, 'dev_analyst'], true)) {
            throw new Exception('Pengajuan jalur pengujian hanya dapat dilakukan oleh Analis Pengembangan (PM) proyek ini.');
        }

        if ((int) $project->pm_id !== (int) $actor->id) {
            throw new Exception('Proyek ini tidak didisposisikan kepada Anda, sehingga pengujiannya tidak dapat Anda ajukan.');
        }
    }

    /**
     * Pengujian hanya boleh diajukan setelah fase pengembangan dinyatakan selesai.
     *
     * Pemeriksaan ini berdiri sendiri, tidak bergantung pada matriks transisi status.
     * Alasannya: jalur Siber tidak menggerakkan status utama saat diajukan, sehingga
     * tanpa gerbang eksplisit di sini proyek yang masih dikembangkan tetap bisa masuk
     * antrean audit keamanan.
     */
    private function assertProjectIsReadyForTesting(Project $project, TestingTrack $track): void
    {
        if (in_array($project->status, self::SUBMITTABLE_MAIN_STATUSES, true)) {
            return;
        }

        throw new Exception(
            "{$track->label()} baru dapat diajukan setelah pengembangan dinyatakan selesai. "
            . "Status proyek saat ini masih '{$project->status->value}'. "
            . "Selesaikan SIT dan UAT Internal lebih dulu sampai proyek berstatus 'DEV_COMPLETED'."
        );
    }

    private function assertActorIsTrackLead(TestingTrack $track, User $actor): void
    {
        $actor->loadMissing('role');

        if (! in_array($actor->role?->name, $track->leadRoles(), true)) {
            throw new Exception(
                "Tindakan ini hanya dapat dilakukan oleh Lead {$track->label()}."
            );
        }
    }

    /**
     * Laporan hanya boleh dikirim penerima disposisi, atau Lead jalur itu sendiri.
     *
     * Lead disertakan karena pada tim kecil ia kadang mengerjakan pengujiannya
     * sendiri. Pengguna lain — termasuk QA Tester yang tidak memegang disposisi
     * proyek ini — ditolak agar laporan tidak pernah tercatat atas nama orang yang
     * tidak ditugaskan.
     */
    private function assertActorMaySubmitReport(Project $project, TestingTrack $track, User $actor): void
    {
        $actor->loadMissing('role');
        $roleName = $actor->role?->name;

        if ($roleName === UserRole::SUPER_ADMIN->value) {
            return;
        }

        if ((int) $project->{$track->assigneeColumn()} === (int) $actor->id) {
            return;
        }

        if (in_array($roleName, $track->leadRoles(), true)) {
            return;
        }

        throw new Exception(
            "{$track->label()} proyek ini tidak didisposisikan kepada Anda, sehingga laporannya tidak dapat Anda kirim."
        );
    }

    /**
     * Catatan pengajuan yang menyertakan jenis pemeriksaan bila ada.
     *
     * @param  array<string, mixed>  $payload
     */
    private function composeSubmissionNote(TestingTrack $track, array $payload): string
    {
        $checkType = $track === TestingTrack::CYBER
            ? CyberCheckType::normalize($payload['cyber_check_type'] ?? null)
            : null;

        $note = "Pengajuan {$track->label()}"
            . ($checkType ? " — {$checkType->label()}" : '')
            . '.';

        return trim($note . ' ' . (string) ($payload['notes'] ?? ''));
    }

    /**
     * Catat perubahan status jalur pada activity log.
     *
     * Memakai action key `update_project_track_status` yang sama dengan
     * `ProjectController` supaya seluruh perubahan jalur — dari endpoint mana pun —
     * tetap terbaca sebagai satu aliran audit.
     *
     * @param  array<string, mixed>  $extraMetadata
     */
    private function recordTrackAudit(
        Project $project,
        TestingTrack $track,
        TrackStatus $from,
        TrackStatus $to,
        User $actor,
        ?string $notes = null,
        array $extraMetadata = []
    ): void {
        $actor->loadMissing('role');

        ActivityLog::create([
            'user_id' => $actor->id,
            'action' => 'update_project_track_status',
            'action_label' => 'Mengubah Status Jalur Pengujian',
            'description' => "Status {$track->label()} proyek \"{$project->title}\" diubah dari {$from->label()} menjadi {$to->label()}.",
            'subject_type' => Project::class,
            'subject_id' => $project->id,
            'metadata' => [
                'project_id' => $project->id,
                'project_name' => $project->title,
                'track' => $track->statusColumn(),
                'from_status' => $from->value,
                'to_status' => $to->value,
                'user_name' => $actor->name,
                'user_role' => $actor->role?->display_name ?? $actor->role?->name,
                // Catatan pengirim disimpan apa adanya sebagai lampiran konteks.
                // Deskripsi di atas tetap ditulis server, jadi isi kiriman klien
                // tidak dapat menyamarkan apa yang sebenarnya terjadi.
                'notes' => $notes,
                ...$extraMetadata,
            ],
            'ip_address' => request()?->ip(),
            'status' => 'success',
            'created_at' => now(),
        ]);
    }

    /**
     * @param  list<string>  $roleNames
     */
    private function notifyRoles(array $roleNames, string $title, string $message): void
    {
        $userIds = User::query()
            ->whereHas('role', fn ($query) => $query->whereIn('name', $roleNames))
            ->pluck('id')
            ->all();

        $this->notifyUsers($userIds, $title, $message);
    }

    /**
     * @param  array<int, int|string|null>  $userIds
     */
    private function notifyUsers(array $userIds, string $title, string $message): void
    {
        $uniqueIds = collect($userIds)
            ->filter(fn ($id): bool => is_numeric($id))
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values();

        if ($uniqueIds->isEmpty()) {
            return;
        }

        $now = now();

        Notification::insert($uniqueIds->map(fn (int $userId): array => [
            'user_id' => $userId,
            'title' => $title,
            'message' => $message,
            'type' => 'info',
            'created_at' => $now,
            'updated_at' => $now,
        ])->all());

        foreach ($uniqueIds as $userId) {
            broadcast(new NotificationCreated(
                userId: $userId,
                title: $title,
                message: $message,
                type: 'info'
            ));
        }
    }
}
