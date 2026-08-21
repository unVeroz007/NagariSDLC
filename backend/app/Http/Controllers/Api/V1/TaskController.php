<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Task\StoreTaskRequest;
use App\Http\Requests\Task\UpdateTaskRequest;
use App\Http\Resources\ProjectTaskResource;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Services\ProjectAccessService;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    use LogsActivity;

    public function __construct(protected ProjectAccessService $accessService) {}

    private function logTaskActivity(string $action, string $label, string $description, Project $project, ?ProjectTask $task, array $metadata = []): void
    {
        $this->logActivity(
            $action,
            $label,
            $description,
            $task,
            array_merge([
                'project_id'   => $project->id,
                'project_name' => $project->title ?? $project->name,
            ], $metadata, $task ? ['task_id' => $task->id, 'task_title' => $task->title] : [])
        );
    }

    public function getByProject(Request $request, int $projectId): JsonResponse
    {
        $project = Project::findOrFail($projectId);

        $user = $request->user();
        $user->loadMissing('role');

        // Daftar task memuat rincian kerja proyek, jadi gerbangnya harus sama dengan
        // gerbang baca proyeknya. Tanpa ini, membaca task proyek milik orang lain cukup
        // dengan menebak ID proyek pada URL.
        if (! $this->accessService->canView($user, $project)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki akses ke proyek ini.',
            ], 403);
        }

        $tasks = $project->tasks()
            ->with(['assignee.role'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => ProjectTaskResource::collection($tasks),
        ]);
    }

    public function store(StoreTaskRequest $request, int $projectId): JsonResponse
    {
        $project = Project::findOrFail($projectId);

        $user = $request->user();
        $user->loadMissing('role');

        // Membuat task berarti menulis ke proyek, sehingga gerbangnya mengikuti gerbang
        // ubah proyek — sejalan dengan canModifyTask() yang sudah menjaga update dan
        // destroy. Sebelumnya endpoint ini tidak memeriksa apa pun.
        if (! $this->accessService->canUpdate($user, $project)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki wewenang untuk membuat task pada proyek ini.',
            ], 403);
        }

        $assigneeId = $request->assignee_id;
        if ($assigneeId && ! $this->isProjectMember($project, (int) $assigneeId)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Assignee harus merupakan anggota tim yang sudah dialokasikan ke proyek ini.',
            ], 422);
        }

        $task = ProjectTask::create([
            'project_id' => $project->id,
            'title' => $request->title,
            'description' => $request->description,
            'assignee_id' => $assigneeId,
            'status' => $request->filled('status') ? TaskStatus::from($request->status) : TaskStatus::TODO,
            'due_date' => $request->due_date,
            'priority' => $request->priority ?? 'Medium',
        ]);

        $this->logTaskActivity(
            'create_task',
            'Membuat Task Baru',
            "Task \"{$task->title}\" dibuat pada proyek \"{$project->title}\".",
            $project,
            $task,
            ['status' => $task->status instanceof \BackedEnum ? $task->status->value : $task->status]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Task berhasil dibuat.',
            'data' => new ProjectTaskResource($task->load(['assignee'])),
        ], 201);
    }

    public function update(UpdateTaskRequest $request, int $taskId): JsonResponse
    {
        $task = ProjectTask::findOrFail($taskId);
        $project = $task->project;

        if (! $this->canModifyTask($request->user(), $project, $task)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki wewenang untuk mengubah task ini.',
            ], 403);
        }

        $oldStatus = $task->status instanceof \BackedEnum ? $task->status->value : $task->status;
        $oldTitle = $task->title;

        $assigneeId = $request->has('assignee_id') ? $request->assignee_id : $task->assignee_id;
        if ($assigneeId && ! $this->isProjectMember($project, (int) $assigneeId)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Assignee harus merupakan anggota tim yang sudah dialokasikan ke proyek ini.',
            ], 422);
        }

        $data = $request->validated();
        if (isset($data['status'])) {
            $data['status'] = TaskStatus::from($data['status']);
        }

        // Jika status diubah menjadi "Selesai", bersihkan tanda revisi (task sudah
        // memenuhi arahan revisi). Dokumentasikan selesainya revisi ke activity log.
        $wasUnderRevision = (bool) $task->revision_note;
        $revisionNote = $task->revision_note;
        $becomesDone = isset($data['status'])
            && $data['status']->value === TaskStatus::DONE->value
            && $oldStatus !== TaskStatus::DONE->value;
        if ($becomesDone) {
            $data['revision_note'] = null;
            $data['revision_requested_at'] = null;
            $data['revision_requested_by'] = null;
        }

        $task->update($data);

        if ($wasUnderRevision && ($becomesDone || ($request->has('assignee_id') && $assigneeId))) {
            $sitUatData = (array) $project->sit_uat_data;
            $nextRequestStatus = $becomesDone ? 'resolved' : 'in_progress';
            $sitUatData['uat_change_requests'] = collect($sitUatData['uat_change_requests'] ?? [])
                ->map(function (array $changeRequest) use ($task, $nextRequestStatus, $becomesDone): array {
                    if (
                        (int) ($changeRequest['taskId'] ?? 0) !== (int) $task->id
                        || ! in_array($changeRequest['status'] ?? null, ['open', 'in_progress'], true)
                    ) {
                        return $changeRequest;
                    }

                    return [
                        ...$changeRequest,
                        'status' => $nextRequestStatus,
                        ...($becomesDone ? ['resolvedAt' => now()->toIso8601String()] : []),
                    ];
                })
                ->values()
                ->all();

            if ($becomesDone) {
                foreach (['uat2_scenarios', 'uat2_additional_requests'] as $key) {
                    $sitUatData[$key] = collect($sitUatData[$key] ?? [])
                        ->map(fn (array $item): array => (int) ($item['taskId'] ?? 0) === (int) $task->id
                            && ($item['verificationStatus'] ?? null) === 'waiting_development'
                                ? [...$item, 'verificationStatus' => 'waiting_sit']
                                : $item)
                        ->values()
                        ->all();
                }
            }

            $project->update(['sit_uat_data' => $sitUatData]);
        }

        $newStatus = $task->status instanceof \BackedEnum ? $task->status->value : $task->status;

        if ($becomesDone && $wasUnderRevision) {
            $this->logTaskActivity(
                'task_revision_completed',
                'Revisi Task Selesai',
                "Task \"{$task->title}\" telah diselesaikan setelah revisi dan siap diverifikasi pada proyek \"{$project->title}\".",
                $project,
                $task,
                ['revision_note' => $revisionNote]
            );
        }

        if ($newStatus !== $oldStatus) {
            $this->logTaskActivity(
                'update_task_status',
                'Mengubah Status Task',
                "Status task \"{$task->title}\" diubah dari {$oldStatus} menjadi {$newStatus} pada proyek \"{$project->title}\".",
                $project,
                $task,
                ['from_status' => $oldStatus, 'to_status' => $newStatus]
            );
        } else {
            $this->logTaskActivity(
                'update_task',
                'Memperbarui Task',
                "Task \"{$oldTitle}\" diperbarui pada proyek \"{$project->title}\".",
                $project,
                $task
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Task berhasil diperbarui.',
            'data' => new ProjectTaskResource($task->fresh(['assignee'])),
        ]);
    }

    /**
     * Cek apakah seorang user benar-benar terlibat di proyek ini:
     * anggota tim developer yang dialokasikan, PM, atau analyst proyek.
     */
    private function isProjectMember(Project $project, int $userId): bool
    {
        return $project->teamMembers()->where('user_id', $userId)->exists()
            || (int) $project->pm_id === $userId
            || (int) $project->analyst_id === $userId;
    }

    /**
     * Siapa yang boleh mengubah/menghapus task:
     * super_admin/head_of_it/development_lead (global), PM proyek,
     * atau developer yang menjadi assignee task itu sendiri.
     */
    private function canModifyTask($user, Project $project, ProjectTask $task): bool
    {
        $role = $user?->role?->name;

        if (in_array($role, ['super_admin', 'head_of_it', 'development_lead'], true)) {
            return true;
        }

        if ($role === 'project_manager' && (int) $project->pm_id === (int) $user->id) {
            return true;
        }

        // Assignee task itu sendiri (developer/analyst) boleh update statusnya
        return (int) $task->assignee_id === (int) $user->id;
    }

    public function destroy(int $taskId): JsonResponse
    {
        $task = ProjectTask::findOrFail($taskId);
        $project = $task->project;

        if (! $this->canModifyTask(request()->user(), $project, $task)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki wewenang untuk menghapus task ini.',
            ], 403);
        }

        $title = $task->title;

        $this->logTaskActivity(
            'delete_task',
            'Menghapus Task',
            "Task \"{$title}\" dihapus dari proyek \"{$project->title}\".",
            $project,
            $task
        );

        $task->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Task berhasil dihapus.',
        ]);
    }

    /**
     * Kembalikan task ke developer untuk revisi (dipicu PM saat SIT/Review).
     * Status task mundur ke in_progress, catatan revisi disimpan, assignee dinotifikasi.
     */
    public function requestRevision(Request $request, int $taskId): JsonResponse
    {
        $task = ProjectTask::findOrFail($taskId);
        $project = $task->project;

        if (! $this->canModifyTask($request->user(), $project, $task)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki wewenang untuk merevisi task ini.',
            ], 403);
        }

        $request->validate([
            'revision_note' => ['required', 'string', 'max:2000'],
        ]);

        $task->update([
            'status' => TaskStatus::IN_PROGRESS,
            'revision_note' => $request->revision_note,
            'revision_requested_at' => now(),
            'revision_requested_by' => $request->user()->id,
        ]);

        $this->logTaskActivity(
            'request_task_revision',
            'Kembalikan Task untuk Revisi',
            "Task \"{$task->title}\" dikembalikan ke developer untuk revisi pada proyek \"{$project->title}\". Catatan: {$request->revision_note}",
            $project,
            $task,
            ['revision_note' => $request->revision_note]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Task dikembalikan ke developer untuk revisi.',
            'data' => new ProjectTaskResource($task->fresh(['assignee', 'revisionRequester'])),
        ]);
    }
}
