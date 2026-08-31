<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Events\NotificationCreated;
use App\Models\ActivityLog;
use App\Models\DocumentVault;
use App\Models\Notification;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UatExecutionService
{
    public function __construct(
        private readonly ProjectWorkflowService $workflowService,
        private readonly UatApprovalService $uatApprovalService
    ) {}

    /**
     * Simpan snapshot lengkap hasil UAT & tentukan alur berikutnya dari data per skenario;
     * ringkasan tak pernah dipercaya dari client.
     */
    public function submit(Project $project, User $actor, array $payload): Project
    {
        return DB::transaction(function () use ($project, $actor, $payload): Project {
            $project->refresh();
            $status = $project->status instanceof ProjectStatus
                ? $project->status->value
                : (string) $project->status;
            $sitUatData = (array) $project->sit_uat_data;

            if ($status !== ProjectStatus::UAT_IN_PROGRESS->value) {
                throw ValidationException::withMessages([
                    'project' => 'Eksekusi UAT hanya dapat disimpan saat proyek berstatus UAT_IN_PROGRESS.',
                ]);
            }

            if ((int) ($sitUatData['activeUatStep'] ?? 1) < 2) {
                throw ValidationException::withMessages([
                    'project' => 'Selesaikan tahap Persiapan Skenario UAT terlebih dahulu.',
                ]);
            }

            // Snapshot dikunci: satu putaran satu versi hasil. Pengecualian: hold revisi Minor boleh
            // re-eksekusi (putaran lama diarsipkan ke `uat_cycles` dulu, audit utuh). Mayor tak lewat
            // sini: `holdForMajorRevision()` sudah mengosongkan `uat2_summary`.
            $isMinorReexecution = filled($sitUatData['uat2_summary']['submittedAt'] ?? null)
                && ($sitUatData['uat_hold']['reason'] ?? null) === 'minor_revision';

            if (filled($sitUatData['uat2_summary']['submittedAt'] ?? null) && ! $isMinorReexecution) {
                throw ValidationException::withMessages([
                    'project' => 'Hasil eksekusi UAT sudah disimpan dan dikunci sebagai snapshot audit.',
                ]);
            }

            // Permintaan Tambahan tersimpan, di-key pada `id` stabil wizard: dipakai memakai ulang
            // task CR & mempertahankan progres verifikasi. Dibaca dari data tersimpan (bukan payload)
            // karena Form Request UAT tak terima `task_id`, jadi klien tak bisa mengarang kepemilikan task.
            $savedRequests = collect($sitUatData['uat2_additional_requests'] ?? [])
                ->filter(fn ($request): bool => is_array($request) && filled($request['id'] ?? null))
                ->keyBy(fn (array $request): string => (string) $request['id']);

            $eligibleTasks = $project->tasks()
                ->where('status', '!=', TaskStatus::TAKE_DOWN->value)
                ->get()
                ->keyBy('id');
            // Task CR Permintaan Tambahan tak dapat baris skenario (sudah diwakili barisnya sendiri;
            // wizard kecualikan di klien). Hanya id yang menunjuk task aktif nyata yang dikecualikan,
            // agar id sisa data lama tak menghapus kewajiban menguji task nyata.
            $requestTaskIdSet = $savedRequests
                ->pluck('taskId')
                ->filter(fn ($taskId): bool => is_numeric($taskId) && $eligibleTasks->has((int) $taskId))
                ->map(fn ($taskId): int => (int) $taskId)
                ->unique()
                ->flip();
            $submittedTaskIds = collect($payload['scenarios'])
                ->pluck('task_id')
                ->map(fn ($id) => (int) $id)
                ->sort()
                ->values();
            $eligibleTaskIds = $eligibleTasks->keys()
                ->map(fn ($id) => (int) $id)
                ->reject(fn (int $id): bool => $requestTaskIdSet->has($id))
                ->sort()
                ->values();

            if ($eligibleTaskIds->isEmpty() || $submittedTaskIds->all() !== $eligibleTaskIds->all()) {
                throw ValidationException::withMessages([
                    'scenarios' => 'Hasil UAT harus mencakup tepat satu baris untuk setiap task aktif proyek.',
                ]);
            }

            $documentIds = collect($payload['scenarios'])
                ->flatMap(fn (array $scenario) => collect($scenario['attachments'] ?? [])->pluck('docId'))
                ->merge(
                    collect($payload['additional_requests'] ?? [])
                        ->flatMap(fn (array $request) => collect($request['attachments'] ?? [])->pluck('docId'))
                )
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();
            $documents = DocumentVault::query()
                ->where('project_id', $project->id)
                ->where('document_type', DocumentVault::UAT_EVIDENCE_TYPE)
                ->whereKey($documentIds->all())
                ->get()
                ->keyBy('id');

            if ($documents->count() !== $documentIds->count()) {
                throw ValidationException::withMessages([
                    'scenarios' => 'Satu atau lebih lampiran bukan bukti UAT yang valid untuk proyek ini.',
                ]);
            }

            $scenarios = collect($payload['scenarios'])->map(function (array $input) use ($documents): array {
                $isRevision = $input['result'] === 'revision';

                return [
                    'id' => $input['id'],
                    'taskId' => (int) $input['task_id'],
                    'scenario' => trim($input['scenario']),
                    'result' => $input['result'],
                    'changeType' => $isRevision ? $input['change_type'] : null,
                    'request' => $isRevision ? trim($input['request']) : null,
                    'comment' => filled($input['comment'] ?? null) ? trim($input['comment']) : null,
                    'attachments' => $this->mapAttachments($input['attachments'] ?? [], $documents),
                    // Setiap revisi (Minor & Mayor) menunggu tim dev; dulu hanya Mayor ditandai
                    // sehingga perbaikan Minor tak pernah terlihat dikerjakan siapa pun.
                    'verificationStatus' => $isRevision ? 'waiting_development' : null,
                ];
            })->values();

            $additionalRequests = collect($payload['additional_requests'] ?? [])->map(function (array $input) use ($documents, $savedRequests): array {
                $saved = (array) ($savedRequests[(string) $input['id']] ?? []);
                $savedTaskId = is_numeric($saved['taskId'] ?? null) ? (int) $saved['taskId'] : null;

                return [
                    'id' => $input['id'],
                    'title' => trim($input['title']),
                    'changeType' => $input['change_type'],
                    'detail' => trim($input['detail']),
                    'comment' => filled($input['comment'] ?? null) ? trim($input['comment']) : null,
                    'attachments' => $this->mapAttachments($input['attachments'] ?? [], $documents),
                    // Task CR lama dipakai ulang agar re-submit pada hold revisi Minor tak
                    // melahirkan task kembar untuk permintaan yang sama.
                    'taskId' => $savedTaskId,
                    // Progres verifikasi lama dipertahankan: digerakkan penyelesaian task oleh
                    // developer, bukan re-submit UAT; reset memundurkan perbaikan selesai jadi seolah belum.
                    'verificationStatus' => $savedTaskId !== null
                        ? ($saved['verificationStatus'] ?? 'waiting_development')
                        : 'waiting_development',
                ];
            })->values();

            // Tiap Permintaan Tambahan jadi task CR tersendiri (Minor & Mayor) agar terlihat di
            // Manajemen Task; sengaja belum ada assignee agar PM tentukan developer. Beda hanya penanda
            // tingkat di judul & prioritas: Mayor tahan rilis sampai SIT ulang, Minor tahan persetujuan final.
            // `$createdRequestTaskIds` mencatat task yang benar-benar baru; yang reuse task lama tak
            // masuk sebab task lamanya justru harus dibuka kembali oleh jalur hold.
            $createdRequestTaskIds = [];
            $additionalRequests = $additionalRequests->map(function (array $request) use ($project, $actor, &$createdRequestTaskIds): array {
                if (filled($request['taskId'])) {
                    return $request;
                }

                $isMajor = $request['changeType'] === 'mayor';
                $task = $project->tasks()->create([
                    'title' => ($isMajor ? '[CR UAT Mayor] ' : '[CR UAT Minor] ').$request['title'],
                    'description' => $request['detail'],
                    'assignee_id' => null,
                    'status' => TaskStatus::TODO,
                    'due_date' => null,
                    'priority' => $isMajor ? 'High' : 'Medium',
                    'revision_note' => $request['detail'],
                    'revision_requested_at' => now(),
                    'revision_requested_by' => $actor->id,
                ]);
                $createdRequestTaskIds[] = (int) $task->id;

                return [...$request, 'taskId' => $task->id];
            });

            $acceptedCount = $scenarios->where('result', 'accepted')->count();
            $minorCount = $scenarios->where('changeType', 'minor')->count()
                + $additionalRequests->where('changeType', 'minor')->count();
            $majorCount = $scenarios->where('changeType', 'mayor')->count()
                + $additionalRequests->where('changeType', 'mayor')->count();
            $conclusion = $majorCount > 0
                ? 'major_revision'
                : ($minorCount > 0 ? 'minor_revision' : 'accepted');
            $submittedAt = now()->toIso8601String();
            $summary = [
                'executedCount' => $scenarios->count(),
                'acceptedCount' => $acceptedCount,
                'revisionCount' => $minorCount + $majorCount,
                'minorCount' => $minorCount,
                'majorCount' => $majorCount,
                'additionalRequestCount' => $additionalRequests->count(),
                'conclusion' => $conclusion,
                'notes' => filled($payload['notes'] ?? null) ? trim($payload['notes']) : null,
                'submittedBy' => $actor->name,
                'submittedById' => $actor->id,
                'submittedAt' => $submittedAt,
            ];

            // Arsipkan putaran hold revisi Minor sebelum satu kunci `uat2_*` pun ditimpa; tanpa ini
            // revisi kedua menghapus hasil & persetujuan putaran pertama tanpa jejak.
            if ($isMinorReexecution) {
                $sitUatData = $this->archiveUatRoundForMinorReexecution($sitUatData, $actor, $submittedAt);
            }

            $sitUatData['uat2_scenarios'] = $scenarios->all();
            $sitUatData['uat2_additional_requests'] = $additionalRequests->all();
            $sitUatData['uat2_summary'] = $summary;
            $sitUatData['uat2_executedCount'] = $summary['executedCount'];
            $sitUatData['uat2_passedCount'] = $summary['acceptedCount'];
            $sitUatData['uat2_findings'] = $summary['revisionCount'];
            $sitUatData['uat2_execNotes'] = $summary['notes'];
            // Mayor → Tahap 1: seluruh siklus diulang (bukan hanya item Mayor) karena bisa meregresi
            // skenario lain yang sudah lulus. Minor tak memundurkan tahap: perbaikannya sempit, Tahap 3
            // tetap terbuka dan hanya keputusan penanda tangan yang ditahan.
            $sitUatData['activeUatStep'] = $majorCount > 0 ? 1 : 3;

            if ($majorCount > 0) {
                $majorWorkItems = $this->buildWorkItems($scenarios, $additionalRequests, 'mayor', $createdRequestTaskIds);
                $sitUatData = $this->holdForMajorRevision(
                    $project,
                    $actor,
                    $sitUatData,
                    $majorWorkItems,
                    $submittedAt
                );
            } elseif ($minorCount > 0) {
                $sitUatData = $this->holdForMinorRevision(
                    $project,
                    $actor,
                    $sitUatData,
                    $this->buildWorkItems($scenarios, $additionalRequests, 'minor', $createdRequestTaskIds),
                    $submittedAt
                );
            } else {
                // UAT tak di-hold, tak ada pengulangan menunggu SIT. Buang sisa penanda siklus lama
                // agar baris bekas mode verifikasi tak membawa kunci yang sudah pensiun.
                $sitUatData['uat_restart_after_sit'] = false;
                unset(
                    $sitUatData['uat2_resume_after_sit'],
                    $sitUatData['uat2_verification_mode'],
                    $sitUatData['uat2_major_revision_resolved_at']
                );

                // Hasil terakhir tak lagi minta perubahan, jadi hold revisi Minor & permintaan belum
                // tuntas tak boleh menggantung menahan persetujuan selamanya.
                $sitUatData = $this->supersedeOpenMinorRequests(
                    $sitUatData,
                    $actor,
                    $submittedAt,
                    'Hasil eksekusi UAT terakhir tidak lagi meminta perubahan Minor.'
                );
                $sitUatData = $this->closeMinorRevisionHold($sitUatData, $submittedAt, 'no_minor_request');
            }

            // Persetujuan lama tak boleh berlaku bila hasil UAT diubah. Dikosongkan setelah percabangan
            // agar `holdForMajorRevision()` masih lihat persetujuan berjalan & mengarsipkannya ke `uat_cycles` dulu.
            $sitUatData['uat3_approvals'] = [];

            $project->update(['sit_uat_data' => $sitUatData]);

            if ($majorCount > 0) {
                $this->uatApprovalService->supersedeActiveRounds($project, 'UAT di-hold karena revisi Mayor');
            } else {
                $this->uatApprovalService->startNewRound($project, $actor);
            }

            ActivityLog::create([
                'user_id' => $actor->id,
                'action' => 'uat_execution_submitted',
                'action_label' => 'Menyimpan Hasil Eksekusi UAT',
                'description' => "{$actor->name} menyimpan hasil UAT proyek \"{$project->title}\" dengan kesimpulan {$conclusion}.",
                'subject_type' => Project::class,
                'subject_id' => $project->id,
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->title,
                    'conclusion' => $conclusion,
                    'executed_count' => $summary['executedCount'],
                    'accepted_count' => $summary['acceptedCount'],
                    'minor_count' => $minorCount,
                    'major_count' => $majorCount,
                ],
            ]);

            if ($majorCount > 0) {
                $this->workflowService->transition(
                    $project,
                    ProjectStatus::UAT_REVISION_DEV,
                    $actor,
                    'Change Request mayor dari hasil UAT: '.collect($majorWorkItems)
                        ->pluck('detail')
                        ->implode('; ')
                );
            }

            return $project->fresh([
                'creator', 'pm', 'analyst', 'division', 'documents.uploader',
                'tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user', 'statusHistories.changedBy',
            ]);
        });
    }

    public function saveDraft(Project $project, User $actor, array $payload): Project
    {
        return DB::transaction(function () use ($project, $actor, $payload): Project {
            $project->refresh();
            $status = $project->status instanceof ProjectStatus
                ? $project->status->value
                : (string) $project->status;
            $sitUatData = (array) $project->sit_uat_data;

            if ($status !== ProjectStatus::UAT_IN_PROGRESS->value) {
                throw ValidationException::withMessages([
                    'project' => 'Draft UAT hanya dapat disimpan saat proyek berstatus UAT_IN_PROGRESS.',
                ]);
            }
            if ((int) ($sitUatData['activeUatStep'] ?? 1) < 2) {
                throw ValidationException::withMessages([
                    'project' => 'Selesaikan tahap Persiapan Skenario UAT terlebih dahulu.',
                ]);
            }
            // Seperti `submit()`: hanya putaran hold revisi Minor yang boleh disunting setelah final —
            // unit peminta berhak susun revisi berikutnya, draft langkah wajar sebelum mengirimnya.
            $isMinorReexecution = ($sitUatData['uat_hold']['reason'] ?? null) === 'minor_revision';

            if (filled($sitUatData['uat2_summary']['submittedAt'] ?? null) && ! $isMinorReexecution) {
                throw ValidationException::withMessages([
                    'project' => 'Snapshot UAT final sudah dikunci dan tidak dapat disimpan kembali sebagai draft.',
                ]);
            }

            // Permintaan Tambahan tersimpan + task CR-nya. Draft tak boleh hapus tautan task itu:
            // task sudah nyata di Manajemen Task, tanpa tautannya `submit()` berikutnya membuat task kembar.
            $savedRequests = collect($sitUatData['uat2_additional_requests'] ?? [])
                ->filter(fn ($request): bool => is_array($request) && filled($request['id'] ?? null))
                ->keyBy(fn (array $request): string => (string) $request['id']);

            $activeTaskIds = $project->tasks()
                ->where('status', '!=', TaskStatus::TAKE_DOWN->value)
                ->pluck('id')
                ->map(fn ($id) => (int) $id);
            // Task CR Permintaan Tambahan tak dapat baris skenario, seperti `submit()` & wizard klien.
            $requestTaskIdSet = $savedRequests
                ->pluck('taskId')
                ->filter(fn ($taskId): bool => is_numeric($taskId) && $activeTaskIds->contains((int) $taskId))
                ->map(fn ($taskId): int => (int) $taskId)
                ->unique()
                ->flip();
            $eligibleTaskIds = $activeTaskIds
                ->reject(fn (int $id): bool => $requestTaskIdSet->has($id))
                ->sort()
                ->values();
            $submittedTaskIds = collect($payload['scenarios'])
                ->pluck('task_id')
                ->map(fn ($id) => (int) $id)
                ->sort()
                ->values();
            if ($eligibleTaskIds->isEmpty() || $eligibleTaskIds->all() !== $submittedTaskIds->all()) {
                throw ValidationException::withMessages([
                    'scenarios' => 'Draft UAT harus tetap memuat tepat satu skenario untuk setiap task aktif proyek.',
                ]);
            }

            $documentIds = collect($payload['scenarios'])
                ->flatMap(fn (array $scenario) => collect($scenario['attachments'] ?? [])->pluck('docId'))
                ->merge(
                    collect($payload['additional_requests'] ?? [])
                        ->flatMap(fn (array $request) => collect($request['attachments'] ?? [])->pluck('docId'))
                )
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();
            $documents = DocumentVault::query()
                ->where('project_id', $project->id)
                ->where('document_type', DocumentVault::UAT_EVIDENCE_TYPE)
                ->whereKey($documentIds->all())
                ->get()
                ->keyBy('id');
            if ($documents->count() !== $documentIds->count()) {
                throw ValidationException::withMessages([
                    'attachments' => 'Satu atau lebih lampiran draft bukan bukti UAT yang valid untuk proyek ini.',
                ]);
            }

            // Progres verifikasi per skenario dipertahankan lewat pemetaan `id`, alasan sama seperti Permintaan Tambahan di bawah.
            $savedScenarios = collect($sitUatData['uat2_scenarios'] ?? [])
                ->filter(fn ($scenario): bool => is_array($scenario) && filled($scenario['id'] ?? null))
                ->keyBy(fn (array $scenario): string => (string) $scenario['id']);

            $sitUatData['uat2_scenarios'] = collect($payload['scenarios'])->map(fn (array $input): array => [
                'id' => $input['id'],
                'taskId' => (int) $input['task_id'],
                'scenario' => trim($input['scenario']),
                'result' => $input['result'] ?? '',
                'changeType' => $input['change_type'] ?? '',
                'request' => filled($input['request'] ?? null) ? trim($input['request']) : '',
                'comment' => filled($input['comment'] ?? null) ? trim($input['comment']) : '',
                'attachments' => $this->mapAttachments($input['attachments'] ?? [], $documents),
                'verificationStatus' => $savedScenarios[(string) $input['id']]['verificationStatus'] ?? null,
            ])->values()->all();
            $sitUatData['uat2_additional_requests'] = collect($payload['additional_requests'] ?? [])
                ->map(function (array $input) use ($documents, $savedRequests): array {
                    $saved = (array) ($savedRequests[(string) $input['id']] ?? []);

                    return [
                        'id' => $input['id'],
                        'title' => filled($input['title'] ?? null) ? trim($input['title']) : '',
                        'changeType' => $input['change_type'] ?? '',
                        'detail' => filled($input['detail'] ?? null) ? trim($input['detail']) : '',
                        'comment' => filled($input['comment'] ?? null) ? trim($input['comment']) : '',
                        'attachments' => $this->mapAttachments($input['attachments'] ?? [], $documents),
                        // Tautan task CR & progres verifikasinya dipertahankan: milik jalur
                        // pengembangan, bukan draft yang sedang disusun unit peminta.
                        'taskId' => is_numeric($saved['taskId'] ?? null) ? (int) $saved['taskId'] : null,
                        'verificationStatus' => $saved['verificationStatus'] ?? null,
                    ];
                })
                ->values()
                ->all();
            $sitUatData['uat2_execNotes'] = filled($payload['notes'] ?? null) ? trim($payload['notes']) : '';
            $sitUatData['uat2_draft_saved_at'] = now()->toIso8601String();
            $sitUatData['uat2_draft_saved_by'] = $actor->name;
            $project->update(['sit_uat_data' => $sitUatData]);

            ActivityLog::create([
                'user_id' => $actor->id,
                'action' => 'uat_execution_draft_saved',
                'action_label' => 'Menyimpan Draft Eksekusi UAT',
                'description' => "{$actor->name} menyimpan draft Eksekusi UAT proyek \"{$project->title}\".",
                'subject_type' => Project::class,
                'subject_id' => $project->id,
                'metadata' => ['project_id' => $project->id],
            ]);

            return $project->fresh([
                'creator', 'pm', 'analyst', 'division', 'documents.uploader',
                'tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user', 'statusHistories.changedBy',
            ]);
        });
    }

    /**
     * Tahan UAT karena revisi Mayor: kembali ke developer, SIT diulang menyeluruh, UAT dari Tahap 1.
     *
     * Publik karena keputusan CR Mayor di `ProjectController` berkonsekuensi persis sama; menyalin
     * logikanya berarti dua jalur menulis bentuk `sit_uat_data` berbeda untuk peristiwa yang sama.
     *
     * @param  list<array{id:string,source:string,title:?string,detail:?string,taskId:?int,attachments:array,newTask:bool}>  $majorWorkItems
     */
    public function holdForMajorRevision(
        Project $project,
        User $actor,
        array $sitUatData,
        array $majorWorkItems,
        string $submittedAt
    ): array {
        $revisionCycles = (array) ($sitUatData['uat_revision_cycles'] ?? []);
        $cycleNumber = count($revisionCycles) + 1;

        // Arsipkan putaran berjalan ke `uat_cycles` sebelum satu kunci pun disentuh. Pengulangan
        // penuh mengosongkan hasil & persetujuannya; arsip ini satu-satunya bukti putaran pernah dijalankan.
        $uatCycles = (array) ($sitUatData['uat_cycles'] ?? []);
        $uatCycles[] = [
            'cycle' => $cycleNumber,
            'summary' => (array) ($sitUatData['uat2_summary'] ?? []),
            'scenarios' => (array) ($sitUatData['uat2_scenarios'] ?? []),
            'additionalRequests' => (array) ($sitUatData['uat2_additional_requests'] ?? []),
            'executedCount' => (int) ($sitUatData['uat2_executedCount'] ?? 0),
            'passedCount' => (int) ($sitUatData['uat2_passedCount'] ?? 0),
            'findings' => (int) ($sitUatData['uat2_findings'] ?? 0),
            'execNotes' => filled($sitUatData['uat2_execNotes'] ?? null)
                ? (string) $sitUatData['uat2_execNotes']
                : null,
            'approvals' => (array) ($sitUatData['uat3_approvals'] ?? []),
            'verificationHistory' => (array) ($sitUatData['uat2_verification_history'] ?? []),
            'archivedAt' => $submittedAt,
            'archivedBy' => $actor->name,
            'reason' => 'major_revision',
        ];
        $sitUatData['uat_cycles'] = $uatCycles;

        // Permintaan Minor belum tuntas ikut di-supersede: Mayor mengulang seluruh siklus dari SIT,
        // jadi Minor lama tak mewakili apa pun; bila dibiarkan `open`, Tahap 3 menampilkan permintaan yang tak bisa diselesaikan lagi.
        $sitUatData = $this->supersedeOpenMinorRequests(
            $sitUatData,
            $actor,
            $submittedAt,
            'Siklus UAT diulang penuh karena revisi Mayor.'
        );

        $sitCycles = (array) ($sitUatData['sit_cycles'] ?? []);
        $sitCycles[] = [
            'cycle' => count($sitCycles) + 1,
            'closedAt' => $submittedAt,
            'reason' => 'UAT_MAJOR_REVISION',
            'taskApprovals' => $sitUatData['sit2_task_approvals'] ?? [],
            'reviewNotes' => $sitUatData['sit3_reviewNotes'] ?? null,
            'documents' => $sitUatData['sit3_docs'] ?? [],
            'approvals' => $sitUatData['sit3_approvals'] ?? [],
            'scope' => $sitUatData['sit_retest_scope'] ?? [
                'mode' => 'full',
                'taskIds' => collect($sitUatData['uat2_scenarios'] ?? [])
                    ->pluck('taskId')
                    ->filter()
                    ->map(fn ($id) => (int) $id)
                    ->values()
                    ->all(),
            ],
        ];
        $sitUatData['sit_cycles'] = $sitCycles;

        $requests = (array) ($sitUatData['uat_change_requests'] ?? []);
        $cycleRequestIds = [];
        foreach ($majorWorkItems as $workItem) {
            $requestId = 'cr_'.now()->format('YmdHisv').'_'.random_int(1000, 9999);
            $cycleRequestIds[] = $requestId;
            $requests[] = [
                'id' => $requestId,
                'type' => 'mayor',
                'title' => $workItem['title'],
                'detail' => $workItem['detail'],
                'category' => $workItem['source'] === 'additional_request'
                    ? 'UAT_ADDITIONAL_REQUEST'
                    : 'UAT_EXECUTION',
                'source' => $workItem['source'],
                'sourceItemId' => $workItem['id'],
                'cycle' => $cycleNumber,
                'taskId' => $workItem['taskId'],
                'attachments' => $workItem['attachments'],
                'submittedBy' => $actor->name,
                'submittedById' => $actor->id,
                'status' => ($workItem['newTask'] ?? false) ? 'open' : 'in_progress',
                'origin' => 'uat_execution',
                'at' => $submittedAt,
                'decisionBy' => $actor->name,
                'decisionAt' => $submittedAt,
                'decisionNote' => 'Ditetapkan otomatis dari kesimpulan eksekusi UAT.',
            ];

            if (! ($workItem['newTask'] ?? false)) {
                $project->tasks()->whereKey($workItem['taskId'])->update([
                    'status' => TaskStatus::IN_PROGRESS->value,
                    'revision_note' => $workItem['detail'],
                    'revision_requested_at' => now(),
                    'revision_requested_by' => $actor->id,
                ]);
            }
        }

        $revisionCycles[] = [
            'cycle' => $cycleNumber,
            'status' => 'developer_revision',
            'changeRequestIds' => $cycleRequestIds,
            'affectedItems' => collect($majorWorkItems)->map(fn (array $item): array => [
                'source' => $item['source'],
                'id' => $item['id'],
                'taskId' => $item['taskId'],
            ])->values()->all(),
            'heldAt' => $submittedAt,
            'heldBy' => $actor->name,
        ];

        $revisions = (array) ($sitUatData['revisions'] ?? []);
        $revisions[] = [
            'type' => 'UAT_CHANGE_MAYOR',
            'notes' => collect($majorWorkItems)->pluck('detail')->implode('; '),
            'at' => $submittedAt,
            'by' => $actor->name,
        ];

        $sitUatData['uat_change_requests'] = $requests;
        $sitUatData['uat_revision_cycles'] = $revisionCycles;
        $sitUatData['revisions'] = $revisions;
        // SIT ulang menguji seluruh task aktif, bukan hanya yang direvisi: Mayor menyentuh kode
        // bersama sehingga dapat meregresi fungsi yang tak diminta berubah. `affectedItems` tetap disimpan sebagai penjelasan asal-usul, bukan pembatas scope.
        $sitUatData['sit_retest_scope'] = [
            'mode' => 'full',
            'cycle' => $cycleNumber,
            'status' => 'waiting_development',
            'taskIds' => [],
            'affectedItems' => collect($majorWorkItems)->map(fn (array $item): array => [
                'source' => $item['source'],
                'id' => $item['id'],
                'taskId' => (int) $item['taskId'],
                'title' => $item['title'],
            ])->values()->all(),
            'createdAt' => $submittedAt,
        ];
        $sitUatData['uat_restart_after_sit'] = true;
        $sitUatData['uat_hold'] = [
            'status' => 'developer_revision',
            'reason' => 'major_revision',
            'cycle' => $cycleNumber,
            'heldAt' => $submittedAt,
            'heldBy' => $actor->name,
            'resumeStep' => 1,
        ];
        $sitUatData['activeSitStep'] = 1;
        $sitUatData['sit2_task_approvals'] = [];
        $sitUatData['sit3_reviewNotes'] = '';
        $sitUatData['sit3_docs'] = [];
        $sitUatData['sit3_approvals'] = [];
        $sitUatData['uat3_approvals'] = [];

        // Hasil dikosongkan setelah arsip putaran tersimpan agar UAT benar-benar dimulai ulang dari
        // Tahap 1 — termasuk melepas kunci snapshot `uat2_summary.submittedAt` yang menahan penyimpanan berikutnya.
        $sitUatData['uat2_summary'] = [];
        $sitUatData['uat2_scenarios'] = [];
        $sitUatData['uat2_additional_requests'] = [];
        $sitUatData['uat2_executedCount'] = 0;
        $sitUatData['uat2_passedCount'] = 0;
        $sitUatData['uat2_findings'] = 0;
        $sitUatData['uat2_execNotes'] = null;
        // Buang sisa jejak draft & mode verifikasi yang sudah pensiun: isinya milik putaran yang
        // baru diarsipkan, sehingga menyesatkan bila terbaca putaran baru.
        unset(
            $sitUatData['uat2_draft_saved_at'],
            $sitUatData['uat2_draft_saved_by'],
            $sitUatData['uat2_verification_history'],
            $sitUatData['uat2_major_revision_verified_at'],
            $sitUatData['uat2_sit_retest_passed_at'],
            $sitUatData['uat2_verification_mode'],
            $sitUatData['uat2_resume_after_sit']
        );

        // `uat1_participants` & `uat1_docs` sengaja tak disentuh: roster penanda tangan & dokumen
        // persiapan = kesepakatan orang, bukan hasil eksekusi; mengosongkannya memaksa PM menyusun ulang roster sama tiap pengulangan.
        $sitUatData['activeUatStep'] = 1;

        return $sitUatData;
    }

    /**
     * Tahan persetujuan final UAT karena revisi Minor, tanpa memundurkan proyek.
     *
     * Kebalikan `holdForMajorRevision()`: Minor tak mengulang siklus — status tetap `UAT_IN_PROGRESS`,
     * Tahap 3 terbuka, SIT tak diulang, peserta tak berubah. Yang ditahan hanya keputusan penanda
     * tangan: berita acara UAT dasar rilis, tanda tangan sebelum perbaikan = setujui versi yang diketahui salah.
     *
     * Efeknya:
     *   1. Permintaan Minor belum tuntas dari siklus lama di-supersede (hasil terbaru jadi satu-satunya daftar aktif).
     *   2. Tiap item Minor memperoleh CR `minor` agar terlihat di Tahap 3 & Manajemen Task.
     *   3. Task sumber item dibuka kembali dengan catatan revisi agar tak tampak "belum dikerjakan".
     *   4. `uat_hold` dipasang `reason = 'minor_revision'` sebagai satu-satunya penanda, dibaca `Project::isUatMinorRevisionPending()`.
     *
     * @param  list<array{id:string,source:string,title:?string,detail:?string,taskId:?int,attachments:array,newTask:bool}>  $minorWorkItems
     */
    private function holdForMinorRevision(
        Project $project,
        User $actor,
        array $sitUatData,
        array $minorWorkItems,
        string $submittedAt
    ): array {
        // Daftar pekerjaan Minor lama tak lagi berlaku: hasil eksekusi terbaru adalah pernyataan
        // resmi apa yang masih perlu diperbaiki. Item yang masih diminta memperoleh CR baru pada siklus ini.
        $sitUatData = $this->supersedeOpenMinorRequests(
            $sitUatData,
            $actor,
            $submittedAt,
            'Digantikan permintaan revisi Minor dari hasil eksekusi UAT terbaru.'
        );

        $revisionCycles = (array) ($sitUatData['uat_revision_cycles'] ?? []);
        $cycleNumber = count($revisionCycles) + 1;

        $requests = (array) ($sitUatData['uat_change_requests'] ?? []);
        $cycleRequestIds = [];

        foreach ($minorWorkItems as $workItem) {
            $requestId = 'cr_'.now()->format('YmdHisv').'_'.random_int(1000, 9999);
            $cycleRequestIds[] = $requestId;
            $requests[] = [
                'id' => $requestId,
                'type' => 'minor',
                'title' => $workItem['title'],
                'detail' => $workItem['detail'],
                'category' => $workItem['source'] === 'additional_request'
                    ? 'UAT_ADDITIONAL_REQUEST'
                    : 'UAT_EXECUTION',
                'source' => $workItem['source'],
                'sourceItemId' => $workItem['id'],
                'cycle' => $cycleNumber,
                'taskId' => $workItem['taskId'],
                'attachments' => $workItem['attachments'],
                'submittedBy' => $actor->name,
                'submittedById' => $actor->id,
                // Task baru belum punya penerima → `open` sampai PM menugaskannya; task lama yang
                // dibuka kembali sudah punya penerima dan langsung berjalan.
                'status' => ($workItem['newTask'] ?? false) ? 'open' : 'in_progress',
                'origin' => 'uat_execution',
                'at' => $submittedAt,
                'decisionBy' => $actor->name,
                'decisionAt' => $submittedAt,
                'decisionNote' => 'Ditetapkan otomatis dari kesimpulan eksekusi UAT.',
            ];

            // Task Permintaan Tambahan sudah dibuat lengkap dengan catatan revisinya di `submit()`;
            // yang perlu dibuka kembali hanya task lama sumber skenario, termasuk yang siklus lalu tuntas lalu diminta revisi lagi.
            if (! ($workItem['newTask'] ?? false) && filled($workItem['taskId'])) {
                $project->tasks()->whereKey($workItem['taskId'])->update([
                    'status' => TaskStatus::IN_PROGRESS->value,
                    'revision_note' => $workItem['detail'],
                    'revision_requested_at' => now(),
                    'revision_requested_by' => $actor->id,
                ]);
            }
        }

        $revisionCycles[] = [
            'cycle' => $cycleNumber,
            'status' => 'developer_revision',
            'reason' => 'minor_revision',
            'changeRequestIds' => $cycleRequestIds,
            'affectedItems' => collect($minorWorkItems)->map(fn (array $item): array => [
                'source' => $item['source'],
                'id' => $item['id'],
                'taskId' => $item['taskId'],
            ])->values()->all(),
            'heldAt' => $submittedAt,
            'heldBy' => $actor->name,
        ];

        $revisions = (array) ($sitUatData['revisions'] ?? []);
        $revisions[] = [
            'type' => 'UAT_CHANGE_MINOR',
            'notes' => collect($minorWorkItems)->pluck('detail')->filter()->implode('; '),
            'at' => $submittedAt,
            'by' => $actor->name,
        ];

        $sitUatData['uat_change_requests'] = $requests;
        $sitUatData['uat_revision_cycles'] = $revisionCycles;
        $sitUatData['revisions'] = $revisions;
        $sitUatData['uat_hold'] = [
            'status' => 'developer_revision',
            'reason' => 'minor_revision',
            'cycle' => $cycleNumber,
            'heldAt' => $submittedAt,
            'heldBy' => $actor->name,
            // Resume setelah hold lepas tetap Tahap 3: hanya persetujuannya yang tertunda, bukan eksekusinya.
            'resumeStep' => 3,
        ];

        // SIT tak diulang oleh revisi Minor, jadi penanda pengulangan ditegaskan mati agar
        // `Project::isSitRetestCycle()` tak salah membaca siklus ini sebagai SIT ulang.
        $sitUatData['uat_restart_after_sit'] = false;
        unset(
            $sitUatData['uat2_resume_after_sit'],
            $sitUatData['uat2_verification_mode'],
            $sitUatData['uat2_major_revision_resolved_at']
        );

        $this->notifyMinorRevisionRequested($project, $minorWorkItems, $cycleNumber);

        return $sitUatData;
    }

    /**
     * Beri tahu tim pengembangan bahwa ada revisi Minor yang harus dikerjakan.
     *
     * Minor sengaja tak mengubah status proyek (tetap `UAT_IN_PROGRESS`), jadi notifikasi berbasis
     * transisi status di `ProjectWorkflowService` tak terpicu; tanpa ini revisi Minor hanya terlihat bagi yang kebetulan buka wizard SIT/UAT.
     *
     * Penerima = pihak yang harus bertindak: assignee task yang dibuka kembali, PM yang menugaskan
     * task revisi baru, serta wewenang penugasan lintas proyek (`development_lead` & `super_admin`, sama seperti `TaskController::canModifyTask()`).
     *
     * @param  list<array{id:string,source:string,title:?string,detail:?string,taskId:?int,attachments:array,newTask:bool}>  $minorWorkItems
     */
    private function notifyMinorRevisionRequested(Project $project, array $minorWorkItems, int $cycleNumber): void
    {
        $workItems = collect($minorWorkItems);
        $unassignedCount = $workItems->filter(fn (array $item): bool => $item['newTask'] ?? false)->count();

        $reopenedTaskIds = $workItems
            ->reject(fn (array $item): bool => $item['newTask'] ?? false)
            ->pluck('taskId')
            ->filter()
            ->all();
        $assigneeIds = $reopenedTaskIds === []
            ? []
            : $project->tasks()->whereKey($reopenedTaskIds)->pluck('assignee_id')->all();

        $managerIds = User::query()
            ->whereHas('role', fn ($query) => $query->whereIn('name', ['development_lead', 'super_admin']))
            ->pluck('id')
            ->all();

        $message = "Proyek '{$project->title}' memperoleh {$workItems->count()} permintaan revisi Minor dari hasil UAT (siklus {$cycleNumber}). "
            .'Task revisinya sudah tercatat di Manajemen Task dan persetujuan final UAT ditahan sampai seluruh perbaikan dinyatakan selesai.';

        if ($unassignedCount > 0) {
            $message .= " {$unassignedCount} task revisi belum memiliki assignee dan menunggu penugasan dari PM.";
        }

        $this->notifyUsers(
            [...$assigneeIds, $project->pm_id, ...$managerIds],
            'Revisi Minor UAT — Perlu Dikerjakan',
            $message,
            'warning'
        );
    }

    /**
     * Beri tahu penanda tangan bahwa penahanan persetujuan revisi Minor sudah lepas.
     *
     * Dipanggil dari jalur pembaruan task setelah `releaseMinorRevisionHold()` melepas hold. Tanpa
     * ini penanda tangan tak tahu keputusannya kembali terbuka, sebab pelepasan hold tak mengubah status proyek.
     */
    public function notifyMinorRevisionHoldReleased(Project $project, User $actor): void
    {
        $this->notifyUsers(
            [...$this->uatApprovalService->activeInternalApproverUserIds($project), $project->pm_id],
            'Revisi Minor UAT Selesai — Persetujuan Dibuka',
            "Seluruh perbaikan revisi Minor proyek '{$project->title}' telah diselesaikan oleh {$actor->name}. "
                .'Persetujuan final hasil UAT kini dapat dilanjutkan.',
            'info'
        );
    }

    /**
     * Tulis notifikasi untuk sekumpulan user sekaligus, tanpa duplikat.
     *
     * Tabel `notifications` tak punya kolom tautan, jadi seluruh konteks harus termuat di dalam pesannya.
     *
     * @param  array<int, int|string|null>  $userIds
     */
    private function notifyUsers(array $userIds, string $title, string $message, string $type = 'info'): void
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
            'type' => $type,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all());

        foreach ($uniqueIds as $userId) {
            broadcast(new NotificationCreated(
                userId: $userId,
                title: $title,
                message: $message,
                type: $type
            ));
        }
    }


    /**
     * Lepas hold revisi Minor setelah seluruh Change Request Minor tuntas.
     *
     * Dipanggil dari `TaskController` begitu satu task revisi selesai. Tak boleh disimpulkan dari satu
     * task: satu siklus bisa berisi beberapa permintaan, hold dibuka hanya bila tak ada lagi yang menggantung.
     *
     * Mengembalikan `sit_uat_data` terbarui — pemanggil yang menyimpan agar seluruh perubahan satu permintaan HTTP tetap satu kali tulis.
     */
    public function releaseMinorRevisionHold(array $sitUatData, string $releasedAt): array
    {
        if (($sitUatData['uat_hold']['reason'] ?? null) !== 'minor_revision'
            || ($sitUatData['uat_hold']['status'] ?? null) !== 'developer_revision') {
            return $sitUatData;
        }

        $stillPending = collect($sitUatData['uat_change_requests'] ?? [])
            ->contains(fn ($request): bool => is_array($request)
                && ($request['type'] ?? null) === 'minor'
                && in_array($request['status'] ?? null, ['open', 'in_progress'], true));

        if ($stillPending) {
            return $sitUatData;
        }

        return $this->closeMinorRevisionHold($sitUatData, $releasedAt, 'all_minor_requests_resolved');
    }

    /**
     * Tandai hold revisi Minor sebagai lepas, beserta alasan pelepasannya.
     *
     * `uat_hold` ditandai, bukan dihapus: baris ini satu-satunya jejak persetujuan pernah ditahan,
     * hilangnya membuat riwayat penahanan tak tertelusuri. Siklus terkait di `uat_revision_cycles` ikut ditutup agar kedua catatan tak bertentangan.
     */
    private function closeMinorRevisionHold(array $sitUatData, string $releasedAt, string $reason): array
    {
        if (($sitUatData['uat_hold']['reason'] ?? null) !== 'minor_revision'
            || ($sitUatData['uat_hold']['status'] ?? null) !== 'developer_revision') {
            return $sitUatData;
        }

        $cycle = (int) ($sitUatData['uat_hold']['cycle'] ?? 0);
        $sitUatData['uat_hold'] = [
            ...$sitUatData['uat_hold'],
            'status' => 'released',
            'releasedAt' => $releasedAt,
            'releaseReason' => $reason,
        ];

        $sitUatData['uat_revision_cycles'] = collect($sitUatData['uat_revision_cycles'] ?? [])
            ->map(function ($revisionCycle) use ($cycle, $releasedAt) {
                if (! is_array($revisionCycle)
                    || (int) ($revisionCycle['cycle'] ?? 0) !== $cycle
                    || ($revisionCycle['status'] ?? null) !== 'developer_revision') {
                    return $revisionCycle;
                }

                return [...$revisionCycle, 'status' => 'resolved', 'resolvedAt' => $releasedAt];
            })
            ->values()
            ->all();

        return $sitUatData;
    }

    /**
     * Batalkan keberlakuan Change Request Minor yang belum tuntas.
     *
     * Dipakai saat hasil eksekusi UAT ditulis ulang: Minor lama tak lagi mewakili apa yang diminta
     * unit peminta. Baris tak dihapus (audit trail wajib utuh), melainkan ditandai `superseded` beserta alasannya.
     */
    private function supersedeOpenMinorRequests(
        array $sitUatData,
        User $actor,
        string $at,
        string $reason
    ): array {
        $sitUatData['uat_change_requests'] = collect($sitUatData['uat_change_requests'] ?? [])
            ->map(function ($request) use ($actor, $at, $reason) {
                if (! is_array($request)
                    || ($request['type'] ?? null) !== 'minor'
                    || ! in_array($request['status'] ?? null, ['open', 'in_progress'], true)) {
                    return $request;
                }

                return [
                    ...$request,
                    'status' => 'superseded',
                    'supersededAt' => $at,
                    'supersededBy' => $actor->name,
                    'supersededReason' => $reason,
                ];
            })
            ->values()
            ->all();

        return $sitUatData;
    }

    /**
     * Arsipkan putaran UAT yang sedang di-hold revisi Minor sebelum hasilnya ditimpa.
     *
     * Revisi kedua menulis ulang seluruh `uat2_*` & mengosongkan `uat3_approvals`; tanpa arsip ini
     * putaran pertama + persetujuannya hilang tanpa jejak (berita acara UAT = dokumen tata kelola).
     * Nomor siklus dari `uat_hold.cycle`, yaitu siklus yang memang menghasilkan putaran tersebut.
     */
    private function archiveUatRoundForMinorReexecution(array $sitUatData, User $actor, string $archivedAt): array
    {
        $uatCycles = (array) ($sitUatData['uat_cycles'] ?? []);
        $uatCycles[] = [
            'cycle' => (int) ($sitUatData['uat_hold']['cycle'] ?? 0) ?: count($uatCycles) + 1,
            'summary' => (array) ($sitUatData['uat2_summary'] ?? []),
            'scenarios' => (array) ($sitUatData['uat2_scenarios'] ?? []),
            'additionalRequests' => (array) ($sitUatData['uat2_additional_requests'] ?? []),
            'executedCount' => (int) ($sitUatData['uat2_executedCount'] ?? 0),
            'passedCount' => (int) ($sitUatData['uat2_passedCount'] ?? 0),
            'findings' => (int) ($sitUatData['uat2_findings'] ?? 0),
            'execNotes' => filled($sitUatData['uat2_execNotes'] ?? null)
                ? (string) $sitUatData['uat2_execNotes']
                : null,
            'approvals' => (array) ($sitUatData['uat3_approvals'] ?? []),
            'verificationHistory' => (array) ($sitUatData['uat2_verification_history'] ?? []),
            'archivedAt' => $archivedAt,
            'archivedBy' => $actor->name,
            'reason' => 'minor_revision_reexecution',
        ];
        $sitUatData['uat_cycles'] = $uatCycles;

        return $sitUatData;
    }

    /**
     * Susun daftar pekerjaan satu tingkat perubahan dari skenario & Permintaan Tambahan,
     * dalam bentuk yang dipahami kedua jalur hold.
     *
     * `newTask` menandai item yang task-nya baru dibuat, jadi jalur hold tahu ia tak perlu (dan tak
     * boleh) membuka kembali task lama; yang reuse task siklus lama bernilai `false` karena task lamanya wajib dibuka kembali.
     *
     * @param  \Illuminate\Support\Collection<int, array>  $scenarios
     * @param  \Illuminate\Support\Collection<int, array>  $additionalRequests
     * @param  list<int>  $createdRequestTaskIds
     * @return list<array{id:string,source:string,title:?string,detail:?string,taskId:?int,attachments:array,newTask:bool}>
     */
    private function buildWorkItems(
        Collection $scenarios,
        Collection $additionalRequests,
        string $changeType,
        array $createdRequestTaskIds = []
    ): array {
        return $scenarios
            ->where('changeType', $changeType)
            ->map(fn (array $scenario): array => [
                'id' => $scenario['id'],
                'source' => 'scenario',
                'title' => $scenario['scenario'],
                'detail' => $scenario['request'],
                'taskId' => $scenario['taskId'],
                'attachments' => $scenario['attachments'],
                'newTask' => false,
            ])
            ->concat(
                $additionalRequests
                    ->where('changeType', $changeType)
                    ->map(fn (array $request): array => [
                        'id' => $request['id'],
                        'source' => 'additional_request',
                        'title' => $request['title'],
                        'detail' => $request['detail'],
                        'taskId' => $request['taskId'],
                        'attachments' => $request['attachments'],
                        'newTask' => in_array((int) $request['taskId'], $createdRequestTaskIds, true),
                    ])
            )
            ->values()
            ->all();
    }

    private function mapAttachments(array $attachments, Collection $documents): array
    {
        return collect($attachments)->map(function (array $attachment) use ($documents): array {
            $document = $documents->get((int) $attachment['docId']);
            $extension = strtoupper(pathinfo($document->original_filename, PATHINFO_EXTENSION) ?: 'FILE');

            return [
                'docId' => $document->id,
                'name' => $document->file_name,
                'maskedName' => $document->file_name,
                'originalName' => $document->original_filename,
                'doc_type' => $document->document_type,
                'type' => $extension,
                'fileSize' => $document->file_size,
                'mimeType' => $document->mime_type,
                'uploadedAt' => $document->created_at?->toIso8601String(),
                'category' => 'UAT_EVIDENCE',
            ];
        })->values()->all();
    }
}
