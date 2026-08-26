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

            // Snapshot hasil UAT dikunci supaya satu putaran tidak pernah punya dua
            // versi hasil. Pengecualiannya tepat satu: putaran yang berkesimpulan
            // revisi Minor masih menahan persetujuan, dan unit peminta berhak
            // mengajukan permintaan revisi berikutnya pada proyek yang sama. Putaran
            // lama diarsipkan ke `uat_cycles` sebelum ditimpa, jadi snapshot auditnya
            // tetap utuh. Revisi Mayor tidak lewat sini: `holdForMajorRevision()`
            // sudah mengosongkan `uat2_summary` sehingga kunci ini tidak aktif.
            $isMinorReexecution = filled($sitUatData['uat2_summary']['submittedAt'] ?? null)
                && ($sitUatData['uat_hold']['reason'] ?? null) === 'minor_revision';

            if (filled($sitUatData['uat2_summary']['submittedAt'] ?? null) && ! $isMinorReexecution) {
                throw ValidationException::withMessages([
                    'project' => 'Hasil eksekusi UAT sudah disimpan dan dikunci sebagai snapshot audit.',
                ]);
            }

            // Permintaan Tambahan yang sudah tersimpan pada putaran sebelumnya, dikunci
            // pada `id` yang stabil dari wizard. Dipakai dua hal: memakai ulang task CR
            // yang sudah dibuat, dan mempertahankan kemajuan verifikasinya. Dibaca dari
            // data tersimpan — bukan dari payload — karena Form Request eksekusi UAT
            // tidak menerima `task_id`, jadi klien tidak dapat mengarang kepemilikan task.
            $savedRequests = collect($sitUatData['uat2_additional_requests'] ?? [])
                ->filter(fn ($request): bool => is_array($request) && filled($request['id'] ?? null))
                ->keyBy(fn (array $request): string => (string) $request['id']);

            $eligibleTasks = $project->tasks()
                ->where('status', '!=', TaskStatus::TAKE_DOWN->value)
                ->get()
                ->keyBy('id');
            // Task CR milik Permintaan Tambahan tidak pernah memperoleh baris skenario:
            // ia sudah diwakili barisnya sendiri pada daftar Permintaan Tambahan, dan
            // wizard mengecualikannya di sisi klien. Hanya id yang benar-benar menunjuk
            // task aktif proyek ini yang dikecualikan, supaya id sisa dari data lama
            // tidak menghapus kewajiban menguji satu task nyata.
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
                    // Setiap permintaan revisi — Minor maupun Mayor — menunggu tim
                    // pengembangan. Sebelumnya hanya Mayor yang ditandai, sehingga
                    // perbaikan Minor tidak pernah terlihat sedang dikerjakan siapa pun.
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
                    // Task CR yang sudah pernah dibuat untuk permintaan ini dipakai ulang,
                    // supaya pengiriman ulang pada hold revisi Minor tidak melahirkan task
                    // kembar untuk satu permintaan yang sama.
                    'taskId' => $savedTaskId,
                    // Kemajuan verifikasi permintaan lama dipertahankan: penandanya
                    // digerakkan penyelesaian task oleh developer, bukan oleh pengiriman
                    // ulang hasil UAT. Menyetelnya ulang akan memundurkan perbaikan yang
                    // sudah selesai menjadi seolah belum dikerjakan.
                    'verificationStatus' => $savedTaskId !== null
                        ? ($saved['verificationStatus'] ?? 'waiting_development')
                        : 'waiting_development',
                ];
            })->values();

            // Setiap Permintaan Tambahan menjadi task CR tersendiri, baik Minor maupun
            // Mayor: keduanya pekerjaan pengembangan yang harus terlihat di Manajemen
            // Task. Task sengaja belum memiliki assignee agar PM tetap menentukan
            // developer yang tepat. Bedanya hanya penanda tingkat perubahan pada judul
            // dan prioritasnya — Mayor menahan rilis sampai SIT ulang, Minor hanya
            // menahan persetujuan final.
            //
            // `$createdRequestTaskIds` mencatat task yang benar-benar baru dibuat pada
            // permintaan ini. Permintaan yang memakai ulang task lama tidak masuk, sebab
            // task lamanya justru harus dibuka kembali oleh jalur hold.
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

            // Putaran yang sedang di-hold revisi Minor diarsipkan lebih dulu, sebelum
            // satu kunci `uat2_*` pun ditimpa. Tanpa langkah ini, permintaan revisi
            // kedua akan menghapus hasil dan persetujuan putaran pertama tanpa jejak.
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
            // Revisi Mayor mengembalikan UAT ke Tahap 1: seluruh siklus diulang,
            // bukan hanya item Mayor-nya, karena perbaikannya dapat meregresi
            // skenario lain yang sudah lulus. Revisi Minor tidak memundurkan tahap:
            // perbaikannya sempit, jadi Tahap 3 tetap terbuka dan hanya keputusan
            // penanda tangan yang ditahan.
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
                // UAT tidak di-hold, jadi tidak ada pengulangan yang menunggu SIT.
                // Sisa penanda siklus lama sekaligus dibuang agar baris yang pernah
                // melalui mode verifikasi tidak membawa kunci yang sudah pensiun.
                $sitUatData['uat_restart_after_sit'] = false;
                unset(
                    $sitUatData['uat2_resume_after_sit'],
                    $sitUatData['uat2_verification_mode'],
                    $sitUatData['uat2_major_revision_resolved_at']
                );

                // Hasil terakhir tidak lagi meminta perubahan apa pun, sehingga hold
                // revisi Minor beserta permintaan yang belum tuntas tidak boleh
                // menggantung dan menahan persetujuan selamanya.
                $sitUatData = $this->supersedeOpenMinorRequests(
                    $sitUatData,
                    $actor,
                    $submittedAt,
                    'Hasil eksekusi UAT terakhir tidak lagi meminta perubahan Minor.'
                );
                $sitUatData = $this->closeMinorRevisionHold($sitUatData, $submittedAt, 'no_minor_request');
            }

            // Persetujuan lama tidak boleh tetap berlaku bila hasil UAT diubah.
            // Pengosongannya menunggu percabangan di atas selesai supaya
            // `holdForMajorRevision()` masih melihat persetujuan putaran berjalan
            // dan dapat mengarsipkannya ke `uat_cycles` sebelum hilang.
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
            // Sama seperti `submit()`, satu-satunya putaran yang masih boleh disunting
            // setelah difinalkan adalah putaran yang berkesimpulan revisi Minor: unit
            // peminta berhak menyusun permintaan revisi berikutnya, dan draft adalah
            // langkah wajar sebelum mengirimnya.
            $isMinorReexecution = ($sitUatData['uat_hold']['reason'] ?? null) === 'minor_revision';

            if (filled($sitUatData['uat2_summary']['submittedAt'] ?? null) && ! $isMinorReexecution) {
                throw ValidationException::withMessages([
                    'project' => 'Snapshot UAT final sudah dikunci dan tidak dapat disimpan kembali sebagai draft.',
                ]);
            }

            // Permintaan Tambahan yang sudah tersimpan beserta task CR-nya. Draft tidak
            // boleh menghapus tautan task itu: task-nya sudah nyata di Manajemen Task,
            // dan tanpa tautannya `submit()` berikutnya akan membuat task kembar.
            $savedRequests = collect($sitUatData['uat2_additional_requests'] ?? [])
                ->filter(fn ($request): bool => is_array($request) && filled($request['id'] ?? null))
                ->keyBy(fn (array $request): string => (string) $request['id']);

            $activeTaskIds = $project->tasks()
                ->where('status', '!=', TaskStatus::TAKE_DOWN->value)
                ->pluck('id')
                ->map(fn ($id) => (int) $id);
            // Task CR milik Permintaan Tambahan tidak memperoleh baris skenario, persis
            // seperti pada `submit()` dan pada wizard di sisi klien.
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

            // Kemajuan verifikasi per skenario juga dipertahankan lewat pemetaan `id`,
            // dengan alasan yang sama seperti Permintaan Tambahan di bawah.
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
                        // Tautan task CR dan kemajuan verifikasinya dipertahankan: keduanya
                        // milik jalur pengembangan, bukan milik draft yang sedang disusun
                        // unit peminta.
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
     * Tahan UAT karena revisi Mayor: pekerjaan kembali ke developer, SIT diulang
     * menyeluruh, lalu UAT dimulai lagi dari Tahap 1.
     *
     * Publik karena keputusan Change Request Mayor di `ProjectController` menahan
     * UAT dengan konsekuensi yang persis sama; menyalin logikanya ke sana berarti
     * dua jalur bisa menulis bentuk `sit_uat_data` yang berbeda untuk peristiwa
     * yang sama.
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

        // Putaran UAT yang sedang berjalan diarsipkan lebih dulu ke `uat_cycles`,
        // sebelum satu kunci pun disentuh. Pengulangan penuh mengosongkan hasil
        // eksekusi beserta persetujuannya, dan data persetujuan tidak boleh hilang:
        // arsip inilah satu-satunya bukti bahwa putaran itu pernah dijalankan.
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

        // Permintaan Minor yang belum tuntas ikut dibatalkan keberlakuannya. Revisi
        // Mayor mengulang seluruh siklus dari SIT, jadi daftar perbaikan Minor lama
        // tidak lagi mewakili apa pun; bila dibiarkan `open`, Tahap 3 akan menampilkan
        // permintaan yang tidak pernah dapat diselesaikan lagi.
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
        // SIT ulang menguji seluruh task aktif, bukan hanya yang direvisi:
        // perbaikan Mayor menyentuh kode bersama sehingga dapat meregresi fungsi
        // yang tidak diminta berubah. `affectedItems` tetap disimpan sebagai
        // penjelasan asal-usul siklus, bukan sebagai pembatas scope.
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

        // Hasil eksekusi baru dikosongkan setelah arsip putaran ini tersimpan, agar
        // UAT benar-benar dimulai ulang dari Tahap 1 — termasuk melepas kunci
        // snapshot `uat2_summary.submittedAt` yang menahan penyimpanan berikutnya.
        $sitUatData['uat2_summary'] = [];
        $sitUatData['uat2_scenarios'] = [];
        $sitUatData['uat2_additional_requests'] = [];
        $sitUatData['uat2_executedCount'] = 0;
        $sitUatData['uat2_passedCount'] = 0;
        $sitUatData['uat2_findings'] = 0;
        $sitUatData['uat2_execNotes'] = null;
        // Sisa jejak draft dan mode verifikasi yang sudah pensiun ikut dibuang:
        // isinya milik putaran yang baru saja diarsipkan, sehingga bila terbaca
        // oleh putaran baru justru menyesatkan.
        unset(
            $sitUatData['uat2_draft_saved_at'],
            $sitUatData['uat2_draft_saved_by'],
            $sitUatData['uat2_verification_history'],
            $sitUatData['uat2_major_revision_verified_at'],
            $sitUatData['uat2_sit_retest_passed_at'],
            $sitUatData['uat2_verification_mode'],
            $sitUatData['uat2_resume_after_sit']
        );

        // `uat1_participants` dan `uat1_docs` sengaja tidak disentuh. Daftar
        // penanda tangan UAT dan dokumen persiapannya adalah hasil kesepakatan
        // orang, bukan hasil eksekusi; mengosongkannya memaksa PM menyusun ulang
        // roster yang sama pada setiap pengulangan.
        $sitUatData['activeUatStep'] = 1;

        return $sitUatData;
    }

    /**
     * Tahan persetujuan final UAT karena revisi Minor, tanpa memundurkan proyek.
     *
     * Ini kebalikan dari `holdForMajorRevision()`. Revisi Minor tidak mengulang
     * siklus: status proyek tetap `UAT_IN_PROGRESS`, Tahap 3 tetap terbuka, SIT
     * tidak diulang, dan peserta UAT tidak berubah. Yang ditahan hanya keputusan
     * penanda tangan, sebab berita acara UAT menjadi dasar rilis — menandatanganinya
     * sebelum perbaikan dikerjakan berarti menyetujui versi aplikasi yang sudah
     * diketahui salah.
     *
     * Efek yang benar-benar dikerjakan:
     *
     *   1. Permintaan Minor yang belum tuntas dari siklus sebelumnya di-supersede,
     *      supaya hasil eksekusi terbaru menjadi satu-satunya daftar pekerjaan aktif.
     *   2. Setiap item Minor memperoleh satu Change Request bertipe `minor` sehingga
     *      terlihat pada Tahap 3 dan pada layar Manajemen Task.
     *   3. Task yang menjadi sumber item dibuka kembali dengan catatan revisi, agar
     *      pekerjaannya tidak tampak "belum dikerjakan" pada daftar task.
     *   4. `uat_hold` dipasang dengan `reason = 'minor_revision'` sebagai satu-satunya
     *      penanda penahanan, dibaca lewat `Project::isUatMinorRevisionPending()`.
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
        // Daftar pekerjaan Minor yang lama tidak lagi berlaku: hasil eksekusi terbaru
        // adalah pernyataan resmi tentang apa yang masih perlu diperbaiki. Item yang
        // masih diminta akan memperoleh Change Request baru pada siklus ini.
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
                // Task baru belum punya penerima, jadi statusnya `open` sampai PM
                // menugaskannya. Task lama yang dibuka kembali sudah punya penerima
                // dan langsung berjalan.
                'status' => ($workItem['newTask'] ?? false) ? 'open' : 'in_progress',
                'origin' => 'uat_execution',
                'at' => $submittedAt,
                'decisionBy' => $actor->name,
                'decisionAt' => $submittedAt,
                'decisionNote' => 'Ditetapkan otomatis dari kesimpulan eksekusi UAT.',
            ];

            // Task Permintaan Tambahan sudah dibuat lengkap dengan catatan revisinya
            // di `submit()`; yang perlu dibuka kembali hanyalah task lama sumber
            // skenario, termasuk task yang perbaikan siklus sebelumnya sudah tuntas
            // lalu diminta revisi lagi.
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
            // Tahap yang dilanjutkan setelah hold lepas tetap Tahap 3: hanya
            // persetujuannya yang tertunda, bukan eksekusinya.
            'resumeStep' => 3,
        ];

        // SIT tidak diulang oleh revisi Minor, jadi penanda pengulangan justru harus
        // ditegaskan mati agar `Project::isSitRetestCycle()` tidak salah membaca
        // siklus ini sebagai SIT ulang.
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
     * Revisi Minor sengaja tidak mengubah status proyek — proyeknya tetap
     * `UAT_IN_PROGRESS` karena tahapnya tidak mundur. Konsekuensinya, notifikasi
     * berbasis transisi status di `ProjectWorkflowService` tidak pernah terpicu, dan
     * tanpa pemberitahuan ini permintaan revisi Minor hanya terlihat bagi orang yang
     * kebetulan membuka wizard SIT/UAT sehingga mudah terlewat.
     *
     * Penerimanya adalah pihak yang harus bertindak: assignee task yang dibuka
     * kembali, PM proyek yang menugaskan task revisi baru, serta pemegang wewenang
     * penugasan task lintas proyek (`development_lead` dan `super_admin`, sama seperti
     * daftar pada `TaskController::canModifyTask()`).
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
     * Dipanggil dari jalur pembaruan task setelah `releaseMinorRevisionHold()`
     * benar-benar melepas hold. Tanpa pemberitahuan ini penanda tangan tidak punya
     * cara mengetahui bahwa keputusannya kembali terbuka, sebab pelepasan hold juga
     * tidak mengubah status proyek.
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
     * Tabel `notifications` hanya memiliki kolom `user_id`, `title`, `message`,
     * `type`, dan `is_read` — tidak ada kolom tautan — jadi seluruh konteks harus
     * termuat di dalam pesannya.
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
     * Dipanggil dari jalur pembaruan task (`TaskController`) begitu satu task revisi
     * dinyatakan selesai. Pelepasannya tidak boleh disimpulkan dari satu task itu
     * saja: satu siklus revisi Minor dapat berisi beberapa permintaan, dan
     * persetujuan hanya boleh dibuka bila tidak ada lagi permintaan yang menggantung.
     *
     * Mengembalikan `sit_uat_data` yang sudah diperbarui — pemanggil yang menyimpan,
     * supaya seluruh perubahan satu permintaan HTTP tetap satu kali tulis.
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
     * `uat_hold` tidak dihapus melainkan ditandai: baris ini satu-satunya jejak bahwa
     * persetujuan pernah ditahan, dan hilangnya membuat riwayat penahanan tidak dapat
     * ditelusuri. Siklus terkait pada `uat_revision_cycles` ikut ditutup agar kedua
     * catatan tidak saling bertentangan.
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
     * Dipakai saat hasil eksekusi UAT ditulis ulang: daftar permintaan Minor yang
     * lama tidak lagi mewakili apa yang diminta unit peminta. Barisnya tidak dihapus
     * — audit trail persetujuan dan permintaan perubahan wajib utuh — melainkan
     * ditandai `superseded` beserta alasannya.
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
     * Permintaan revisi kedua menulis ulang seluruh kunci `uat2_*` dan mengosongkan
     * `uat3_approvals`. Tanpa arsip ini, putaran pertama beserta persetujuan yang
     * sudah masuk akan hilang tanpa jejak — padahal berita acara UAT adalah dokumen
     * tata kelola. Nomor siklusnya diambil dari `uat_hold.cycle`, yaitu siklus yang
     * memang menghasilkan putaran tersebut.
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
     * Susun daftar pekerjaan satu tingkat perubahan dari skenario dan Permintaan
     * Tambahan, dalam bentuk yang dipahami kedua jalur hold.
     *
     * `newTask` menandai item yang task-nya baru dibuat pada permintaan ini, sehingga
     * jalur hold tahu ia tidak perlu (dan tidak boleh) membuka kembali task lama.
     * Permintaan Tambahan yang memakai ulang task siklus sebelumnya karena itu bernilai
     * `false`: task lamanya justru wajib dibuka kembali.
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
