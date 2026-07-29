<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Task\StoreTaskRequest;
use App\Http\Requests\Task\UpdateTaskRequest;
use App\Http\Resources\ProjectTaskResource;
use App\Models\Project;
use App\Models\ProjectTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
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

        $task = ProjectTask::create([
            'project_id' => $project->id,
            'title' => $request->title,
            'description' => $request->description,
            'assignee_id' => $request->assignee_id,
            'status' => $request->status ? TaskStatus::from($request->status) : TaskStatus::TODO,
            'due_date' => $request->due_date,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Task berhasil dibuat.',
            'data' => new ProjectTaskResource($task->load(['assignee'])),
        ], 201);
    }

    public function update(UpdateTaskRequest $request, int $taskId): JsonResponse
    {
        $task = ProjectTask::findOrFail($taskId);

        $data = $request->validated();
        if (isset($data['status'])) {
            $data['status'] = TaskStatus::from($data['status']);
        }

        $task->update($data);

        return response()->json([
            'status' => 'success',
            'message' => 'Task berhasil diperbarui.',
            'data' => new ProjectTaskResource($task->fresh(['assignee'])),
        ]);
    }

    public function destroy(int $taskId): JsonResponse
    {
        $task = ProjectTask::findOrFail($taskId);
        $task->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Task berhasil dihapus.',
        ]);
    }
}
