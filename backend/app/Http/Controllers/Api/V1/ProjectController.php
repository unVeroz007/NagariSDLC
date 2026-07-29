<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Project\StoreProjectRequest;
use App\Http\Requests\Project\UpdateProjectStatusRequest;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\ProjectStatusHistoryResource;
use App\Models\Project;
use App\Services\ProjectWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class ProjectController extends Controller
{
    public function __construct(
        protected ProjectWorkflowService $workflowService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Project::with(['creator', 'pm', 'analyst', 'division']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('req_id', 'like', "%{$search}%");
            });
        }

        $projects = $query->orderBy('created_at', 'desc')->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => ProjectResource::collection($projects)->response()->getData(true)['data'],
            'meta' => [
                'current_page' => $projects->currentPage(),
                'last_page' => $projects->lastPage(),
                'per_page' => $projects->perPage(),
                'total' => $projects->total(),
            ],
        ]);
    }

    public function store(StoreProjectRequest $request): JsonResponse
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => $request->title,
            'description' => $request->description,
            'division_id' => $request->division_id,
            'target_date' => $request->target_date,
            'created_by' => $request->user()->id,
            'status' => ProjectStatus::PENDING->value,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Pengajuan proyek berhasil dibuat.',
            'data' => new ProjectResource($project->load(['creator', 'division'])),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $project = Project::with(['creator', 'pm', 'analyst', 'division', 'statusHistories.changedBy'])
            ->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => new ProjectResource($project),
        ]);
    }

    public function updateStatus(UpdateProjectStatusRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);

        try {
            $targetStatus = ProjectStatus::from($request->status);
            $updatedProject = $this->workflowService->transition(
                $project,
                $targetStatus,
                $request->user(),
                $request->notes
            );

            return response()->json([
                'status' => 'success',
                'message' => "Status proyek berhasil diperbarui ke {$targetStatus->value}.",
                'data' => new ProjectResource($updatedProject),
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function timeline(int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $histories = $project->statusHistories()->with('changedBy.role')->get();

        return response()->json([
            'status' => 'success',
            'data' => ProjectStatusHistoryResource::collection($histories),
        ]);
    }
}
