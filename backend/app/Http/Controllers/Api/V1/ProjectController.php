<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Project\StoreProjectRequest;
use App\Http\Requests\Project\UpdateProjectStatusRequest;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\ProjectStatusHistoryResource;
use App\Models\Division;
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
        $query = Project::with(['creator', 'pm', 'analyst', 'division', 'documents']);

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

        if ($request->filled('pm_id')) {
            $query->where('pm_id', $request->pm_id);
        }

        $projects = $query->orderBy('created_at', 'desc')->paginate(50);

        return response()->json([
            'status' => 'success',
            'data' => ProjectResource::collection($projects)->response()->getData(true)['data'],
            'meta' => [
                'current_page' => $projects->currentPage(),
                'last_page'    => $projects->lastPage(),
                'per_page'     => $projects->perPage(),
                'total'        => $projects->total(),
            ],
        ]);
    }

    public function store(StoreProjectRequest $request): JsonResponse
    {
        // Support both 'title' and 'name' from FE
        $title = $request->title ?? $request->name;

        // Resolve division_id — FE might send division_id directly or division name
        $divisionId = $request->division_id;
        if (! $divisionId && $request->filled('division')) {
            $division = Division::where('name', $request->division)
                ->orWhere('code', $request->division)
                ->first();
            $divisionId = $division?->id ?? 1; // fallback ke id 1 jika tidak ditemukan
        }
        $divisionId = $divisionId ?? 1;

        $project = Project::create([
            'req_id'      => Project::generateReqId(),
            'title'       => $title,
            'description' => $request->description,
            'division_id' => $divisionId,
            'target_date' => $request->target_date,
            'created_by'  => $request->user()->id,
            'status'      => ProjectStatus::PENDING->value,
        ]);

        return response()->json([
            'status'  => 'success',
            'message' => 'Pengajuan proyek berhasil dibuat.',
            'data'    => new ProjectResource($project->load(['creator', 'division'])),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $project = Project::with(['creator', 'pm', 'analyst', 'division', 'statusHistories.changedBy'])
            ->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data'   => new ProjectResource($project),
        ]);
    }

    /**
     * General project update (non-status fields: pm_id, analyst_id, staging_url, uat_notes, etc.)
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);

        $request->validate([
            'title'                  => ['sometimes', 'string', 'max:255'],
            'description'            => ['sometimes', 'nullable', 'string'],
            'pm_id'                  => ['sometimes', 'nullable', 'exists:users,id'],
            'analyst_id'             => ['sometimes', 'nullable', 'exists:users,id'],
            'division_id'            => ['sometimes', 'nullable', 'exists:divisions,id'],
            'target_date'            => ['sometimes', 'nullable', 'date'],
            'current_stage_deadline' => ['sometimes', 'nullable', 'date'],
            'staging_url'            => ['sometimes', 'nullable', 'string'],
            'uat_notes'              => ['sometimes', 'nullable', 'string'],
        ]);

        $project->update($request->only([
            'title', 'description', 'pm_id', 'analyst_id',
            'division_id', 'target_date', 'current_stage_deadline',
            'staging_url', 'uat_notes',
        ]));

        return response()->json([
            'status'  => 'success',
            'message' => 'Data proyek berhasil diperbarui.',
            'data'    => new ProjectResource($project->fresh(['creator', 'pm', 'analyst', 'division'])),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $project->delete();

        return response()->json([
            'status'  => 'success',
            'message' => 'Proyek berhasil dihapus.',
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
                'status'  => 'success',
                'message' => "Status proyek berhasil diperbarui ke {$targetStatus->value}.",
                'data'    => new ProjectResource($updatedProject),
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function timeline(int $id): JsonResponse
    {
        $project  = Project::findOrFail($id);
        $histories = $project->statusHistories()->with('changedBy.role')->get();

        return response()->json([
            'status' => 'success',
            'data'   => ProjectStatusHistoryResource::collection($histories),
        ]);
    }
}

