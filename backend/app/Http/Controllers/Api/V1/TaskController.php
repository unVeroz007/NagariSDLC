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
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    use LogsActivity;

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

        $task->update($data);

        $newStatus = $task->status instanceof \BackedEnum ? $task->status->value : $task->status;

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
