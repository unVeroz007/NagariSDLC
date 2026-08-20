<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Models\ActivityLog;
use App\Models\DocumentVault;
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
     * Simpan snapshot lengkap hasil UAT dan tentukan alur berikutnya dari data
     * per skenario. Ringkasan tidak pernah dipercaya dari client.
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

            if (filled($sitUatData['uat2_summary']['submittedAt'] ?? null)) {
                throw ValidationException::withMessages([
                    'project' => 'Hasil eksekusi UAT sudah disimpan dan dikunci sebagai snapshot audit.',
                ]);
            }

            $eligibleTasks = $project->tasks()
                ->where('status', '!=', TaskStatus::TAKE_DOWN->value)
                ->get()
                ->keyBy('id');
            $submittedTaskIds = collect($payload['scenarios'])
                ->pluck('task_id')
                ->map(fn ($id) => (int) $id)
                ->sort()
                ->values();
            $eligibleTaskIds = $eligibleTasks->keys()->map(fn ($id) => (int) $id)->sort()->values();

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
                    'verificationStatus' => $isRevision && $input['change_type'] === 'mayor'
                        ? 'waiting_development'
                        : null,
                ];
            })->values();

            $additionalRequests = collect($payload['additional_requests'] ?? [])->map(function (array $input) use ($documents): array {
                return [
                    'id' => $input['id'],
                    'title' => trim($input['title']),
                    'changeType' => $input['change_type'],
                    'detail' => trim($input['detail']),
                    'comment' => filled($input['comment'] ?? null) ? trim($input['comment']) : null,
                    'attachments' => $this->mapAttachments($input['attachments'] ?? [], $documents),
                    'taskId' => null,
                    'verificationStatus' => $input['change_type'] === 'mayor'
                        ? 'waiting_development'
                        : null,
                ];
            })->values();

            // Permintaan baru bertipe Mayor menjadi task CR tersendiri. Task sengaja
            // belum memiliki assignee agar PM tetap menentukan developer yang tepat.
            $additionalRequests = $additionalRequests->map(function (array $request) use ($project, $actor): array {
                if ($request['changeType'] !== 'mayor') {
                    return $request;
                }

                $task = $project->tasks()->create([
                    'title' => '[CR UAT Mayor] '.$request['title'],
                    'description' => $request['detail'],
                    'assignee_id' => null,
                    'status' => TaskStatus::TODO,
                    'due_date' => null,
                    'priority' => 'High',
                    'revision_note' => $request['detail'],
                    'revision_requested_at' => now(),
                    'revision_requested_by' => $actor->id,
                ]);

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

            $sitUatData['uat2_scenarios'] = $scenarios->all();
            $sitUatData['uat2_additional_requests'] = $additionalRequests->all();
            $sitUatData['uat2_summary'] = $summary;
            $sitUatData['uat2_executedCount'] = $summary['executedCount'];
            $sitUatData['uat2_passedCount'] = $summary['acceptedCount'];
            $sitUatData['uat2_findings'] = $summary['revisionCount'];
            $sitUatData['uat2_execNotes'] = $summary['notes'];
            $sitUatData['activeUatStep'] = $majorCount > 0 ? 2 : 3;
            // Persetujuan lama tidak boleh tetap berlaku bila hasil UAT diubah.
            $sitUatData['uat3_approvals'] = [];

            if ($majorCount > 0) {
                $majorWorkItems = $scenarios
                    ->where('changeType', 'mayor')
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
                            ->where('changeType', 'mayor')
                            ->map(fn (array $request): array => [
                                'id' => $request['id'],
                                'source' => 'additional_request',
                                'title' => $request['title'],
                                'detail' => $request['detail'],
                                'taskId' => $request['taskId'],
                                'attachments' => $request['attachments'],
                                'newTask' => true,
                            ])
                    )
                    ->values()
                    ->all();
                $sitUatData = $this->prepareMajorRevision(
                    $project,
                    $actor,
                    $sitUatData,
                    $majorWorkItems,
                    $submittedAt
                );
            } else {
                $sitUatData['uat2_resume_after_sit'] = false;
                unset($sitUatData['uat2_major_revision_resolved_at']);
            }

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
            if (filled($sitUatData['uat2_summary']['submittedAt'] ?? null)) {
                throw ValidationException::withMessages([
                    'project' => 'Snapshot UAT final sudah dikunci dan tidak dapat disimpan kembali sebagai draft.',
                ]);
            }

            $eligibleTaskIds = $project->tasks()
                ->where('status', '!=', TaskStatus::TAKE_DOWN->value)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
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

            $sitUatData['uat2_scenarios'] = collect($payload['scenarios'])->map(fn (array $input): array => [
                'id' => $input['id'],
                'taskId' => (int) $input['task_id'],
                'scenario' => trim($input['scenario']),
                'result' => $input['result'] ?? '',
                'changeType' => $input['change_type'] ?? '',
                'request' => filled($input['request'] ?? null) ? trim($input['request']) : '',
                'comment' => filled($input['comment'] ?? null) ? trim($input['comment']) : '',
                'attachments' => $this->mapAttachments($input['attachments'] ?? [], $documents),
            ])->values()->all();
            $sitUatData['uat2_additional_requests'] = collect($payload['additional_requests'] ?? [])
                ->map(fn (array $input): array => [
                    'id' => $input['id'],
                    'title' => filled($input['title'] ?? null) ? trim($input['title']) : '',
                    'changeType' => $input['change_type'] ?? '',
                    'detail' => filled($input['detail'] ?? null) ? trim($input['detail']) : '',
                    'comment' => filled($input['comment'] ?? null) ? trim($input['comment']) : '',
                    'attachments' => $this->mapAttachments($input['attachments'] ?? [], $documents),
                    'taskId' => null,
                ])
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
     * Verifikasi ulang hanya untuk skenario/permintaan Mayor setelah developer
     * selesai dan SIT ulang dinyatakan lulus. UAT yang di-hold tidak diulang penuh.
     */
    public function verifyMajorRevisions(Project $project, User $actor, array $payload): Project
    {
        return DB::transaction(function () use ($project, $actor, $payload): Project {
            $project->refresh();
            $status = $project->status instanceof ProjectStatus
                ? $project->status->value
                : (string) $project->status;
            $sitUatData = (array) $project->sit_uat_data;

            if (
                $status !== ProjectStatus::UAT_IN_PROGRESS->value
                || ($sitUatData['uat2_verification_mode'] ?? false) !== true
                || (int) ($sitUatData['activeUatStep'] ?? 1) !== 2
            ) {
                throw ValidationException::withMessages([
                    'project' => 'Verifikasi revisi Mayor hanya tersedia setelah SIT ulang lulus dan UAT dilanjutkan.',
                ]);
            }

            $scenarios = collect($sitUatData['uat2_scenarios'] ?? []);
            $additionalRequests = collect($sitUatData['uat2_additional_requests'] ?? []);
            $expectedItems = $scenarios
                ->filter(fn (array $item): bool => ($item['changeType'] ?? null) === 'mayor'
                    && ($item['verificationStatus'] ?? null) === 'pending')
                ->map(fn (array $item): array => ['source' => 'scenario', ...$item])
                ->concat(
                    $additionalRequests
                        ->filter(fn (array $item): bool => ($item['changeType'] ?? null) === 'mayor'
                            && ($item['verificationStatus'] ?? null) === 'pending')
                        ->map(fn (array $item): array => ['source' => 'additional_request', ...$item])
                )
                ->keyBy(fn (array $item): string => $item['source'].':'.$item['id']);
            $submittedItems = collect($payload['items'])
                ->keyBy(fn (array $item): string => $item['source'].':'.$item['id']);

            if (
                $expectedItems->isEmpty()
                || $expectedItems->keys()->sort()->values()->all() !== $submittedItems->keys()->sort()->values()->all()
            ) {
                throw ValidationException::withMessages([
                    'items' => 'Verifikasi wajib mencakup tepat satu hasil untuk setiap item Mayor yang menunggu pemeriksaan user.',
                ]);
            }

            $documentIds = $submittedItems
                ->flatMap(fn (array $item) => collect($item['attachments'] ?? [])->pluck('docId'))
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
                    'items' => 'Satu atau lebih lampiran verifikasi bukan bukti UAT yang valid untuk proyek ini.',
                ]);
            }

            $verifiedAt = now()->toIso8601String();
            $rejectedWorkItems = [];
            $applyVerification = function (array $item, string $source) use (
                $submittedItems,
                $documents,
                $verifiedAt,
                &$rejectedWorkItems
            ): array {
                $key = $source.':'.$item['id'];
                if (! $submittedItems->has($key)) {
                    return $item;
                }

                $input = $submittedItems->get($key);
                $accepted = $input['result'] === 'accepted';
                $comment = filled($input['comment'] ?? null) ? trim($input['comment']) : null;
                $attachments = $this->mapAttachments($input['attachments'] ?? [], $documents);
                $updated = [
                    ...$item,
                    'verificationStatus' => $accepted ? 'verified' : 'waiting_development',
                    'verificationResult' => $input['result'],
                    'verificationComment' => $comment,
                    'verificationAttachments' => $attachments,
                    'verifiedAt' => $accepted ? $verifiedAt : null,
                ];

                if (! $accepted) {
                    $rejectedWorkItems[] = [
                        'id' => $item['id'],
                        'source' => $source,
                        'title' => $source === 'scenario' ? $item['scenario'] : $item['title'],
                        'detail' => $comment,
                        'taskId' => $item['taskId'],
                        'attachments' => $attachments,
                        'newTask' => false,
                    ];
                }

                return $updated;
            };

            $scenarios = $scenarios->map(fn (array $item): array => $applyVerification($item, 'scenario'));
            $additionalRequests = $additionalRequests
                ->map(fn (array $item): array => $applyVerification($item, 'additional_request'));
            $sitUatData['uat2_scenarios'] = $scenarios->values()->all();
            $sitUatData['uat2_additional_requests'] = $additionalRequests->values()->all();

            $verificationHistory = (array) ($sitUatData['uat2_verification_history'] ?? []);
            $verificationHistory[] = [
                'cycle' => (int) ($sitUatData['uat_hold']['cycle'] ?? 1),
                'verifiedAt' => $verifiedAt,
                'verifiedBy' => $actor->name,
                'verifiedById' => $actor->id,
                'result' => count($rejectedWorkItems) > 0 ? 'revision' : 'accepted',
                'items' => $submittedItems->values()->all(),
            ];
            $sitUatData['uat2_verification_history'] = $verificationHistory;
            $sitUatData['uat3_approvals'] = [];

            if (count($rejectedWorkItems) > 0) {
                $sitUatData['uat2_verification_mode'] = false;
                $sitUatData = $this->prepareMajorRevision(
                    $project,
                    $actor,
                    $sitUatData,
                    $rejectedWorkItems,
                    $verifiedAt
                );
            } else {
                $sitUatData['activeUatStep'] = 3;
                $sitUatData['uat2_resume_after_sit'] = false;
                $sitUatData['uat2_verification_mode'] = false;
                $sitUatData['uat2_major_revision_verified_at'] = $verifiedAt;
                $sitUatData['uat_hold'] = [
                    ...(array) ($sitUatData['uat_hold'] ?? []),
                    'status' => 'resumed',
                    'resumedAt' => $verifiedAt,
                    'resumedBy' => $actor->name,
                ];
                $sitUatData['uat_change_requests'] = collect($sitUatData['uat_change_requests'] ?? [])
                    ->map(function (array $request): array {
                        if (in_array($request['status'] ?? null, ['resolved', 'sit_verified'], true)) {
                            return [...$request, 'status' => 'uat_verified', 'uatVerifiedAt' => now()->toIso8601String()];
                        }
                        return $request;
                    })
                    ->values()
                    ->all();
            }

            $project->update(['sit_uat_data' => $sitUatData]);

            if (count($rejectedWorkItems) > 0) {
                $this->uatApprovalService->supersedeActiveRounds($project, 'Verifikasi Mayor ditolak dan UAT kembali di-hold');
            } else {
                $this->uatApprovalService->startNewRound($project, $actor, 'Seluruh perbaikan Mayor telah diverifikasi');
            }

            ActivityLog::create([
                'user_id' => $actor->id,
                'action' => 'uat_major_revision_verified',
                'action_label' => 'Verifikasi Perbaikan Mayor UAT',
                'description' => count($rejectedWorkItems) > 0
                    ? "{$actor->name} menolak sebagian perbaikan Mayor dan menahan kembali UAT proyek \"{$project->title}\"."
                    : "{$actor->name} menerima seluruh perbaikan Mayor dan melanjutkan UAT proyek \"{$project->title}\" ke persetujuan final.",
                'subject_type' => Project::class,
                'subject_id' => $project->id,
                'metadata' => [
                    'project_id' => $project->id,
                    'result' => count($rejectedWorkItems) > 0 ? 'revision' : 'accepted',
                    'rejected_count' => count($rejectedWorkItems),
                    'evidence_count' => $submittedItems
                        ->flatMap(fn (array $item) => $item['attachments'] ?? [])
                        ->count(),
                ],
            ]);

            if (count($rejectedWorkItems) > 0) {
                $this->workflowService->transition(
                    $project,
                    ProjectStatus::UAT_REVISION_DEV,
                    $actor,
                    'Perbaikan Mayor UAT masih belum sesuai: '.collect($rejectedWorkItems)->pluck('detail')->implode('; ')
                );
            }

            return $project->fresh([
                'creator', 'pm', 'analyst', 'division', 'documents.uploader',
                'tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user', 'statusHistories.changedBy',
            ]);
        });
    }

    private function prepareMajorRevision(
        Project $project,
        User $actor,
        array $sitUatData,
        array $majorWorkItems,
        string $submittedAt
    ): array {
        $revisionCycles = (array) ($sitUatData['uat_revision_cycles'] ?? []);
        $cycleNumber = count($revisionCycles) + 1;
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
        $sitUatData['sit_retest_scope'] = [
            'mode' => 'targeted',
            'cycle' => $cycleNumber,
            'status' => 'waiting_development',
            'taskIds' => collect($majorWorkItems)
                ->pluck('taskId')
                ->filter()
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all(),
            'affectedItems' => collect($majorWorkItems)->map(fn (array $item): array => [
                'source' => $item['source'],
                'id' => $item['id'],
                'taskId' => (int) $item['taskId'],
                'title' => $item['title'],
            ])->values()->all(),
            'createdAt' => $submittedAt,
        ];
        $sitUatData['uat2_resume_after_sit'] = true;
        $sitUatData['uat2_verification_mode'] = false;
        $sitUatData['uat_hold'] = [
            'status' => 'developer_revision',
            'reason' => 'major_revision',
            'cycle' => $cycleNumber,
            'heldAt' => $submittedAt,
            'heldBy' => $actor->name,
            'resumeStep' => 2,
        ];
        $sitUatData['activeSitStep'] = 1;
        $sitUatData['sit2_task_approvals'] = [];
        $sitUatData['sit3_reviewNotes'] = '';
        $sitUatData['sit3_docs'] = [];
        $sitUatData['sit3_approvals'] = [];
        $sitUatData['uat3_approvals'] = [];

        return $sitUatData;
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
