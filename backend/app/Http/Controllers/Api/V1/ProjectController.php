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
        $query = Project::with(['creator', 'pm', 'analyst', 'division', 'documents', 'teamMembers.user']);

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
            $divisionId = $division?->id;
        }
        if (! $divisionId) {
            $divisionId = $request->user()->division_id ?? 1;
        }

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
        $project = Project::with(['creator', 'pm', 'analyst', 'division', 'statusHistories.changedBy', 'teamMembers.user'])
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
            'status'                 => ['sometimes', 'nullable', 'string'],
            'pm_id'                  => ['sometimes', 'nullable', 'exists:users,id'],
            'analyst_id'             => ['sometimes', 'nullable', 'exists:users,id'],
            'division_id'            => ['sometimes', 'nullable', 'exists:divisions,id'],
            'target_date'            => ['sometimes', 'nullable', 'date'],
            'current_stage_deadline' => ['sometimes', 'nullable', 'date'],
            'staging_url'            => ['sometimes', 'nullable', 'string'],
            'uat_notes'              => ['sometimes', 'nullable', 'string'],
            'sit_uat_data'           => ['sometimes', 'nullable'],
            'qa_status'              => ['sometimes', 'nullable', 'string'],
            'cyber_status'           => ['sometimes', 'nullable', 'string'],
        ]);

        $updateData = $request->only([
            'title', 'description', 'status', 'pm_id', 'analyst_id',
            'division_id', 'target_date', 'current_stage_deadline',
            'staging_url', 'uat_notes', 'sit_uat_data',
            'qa_status', 'cyber_status',
        ]);

        $project->update(array_filter($updateData, fn($v) => !is_null($v)));


        if ($request->has('team') || $request->has('team_ids') || $request->has('developers')) {
            $teamData = $request->input('team') ?? $request->input('team_ids') ?? $request->input('developers');
            if (is_array($teamData)) {
                \App\Models\ProjectTeamMember::where('project_id', $project->id)->delete();
                foreach ($teamData as $member) {
                    $userId = null;
                    $roleInProject = 'Developer';

                    if (is_array($member) || is_object($member)) {
                        $member = (array) $member;
                        $userId = $member['id'] ?? null;
                        $roleInProject = $member['skill'] ?? $member['role'] ?? 'Developer';
                        if (!$userId && !empty($member['email'])) {
                            $u = \App\Models\User::where('email', $member['email'])->first();
                            $userId = $u?->id;
                        }
                        if (!$userId && !empty($member['name'])) {
                            $u = \App\Models\User::where('name', 'like', "%{$member['name']}%")->first();
                            $userId = $u?->id;
                        }
                    } elseif (is_numeric($member)) {
                        $userId = (int) $member;
                    }

                    if ($userId) {
                        \App\Models\ProjectTeamMember::create([
                            'project_id'      => $project->id,
                            'user_id'         => $userId,
                            'role_in_project' => $roleInProject,
                        ]);
                    }
                }
            }
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'Data proyek dan alokasi tim berhasil diperbarui.',
            'data'    => new ProjectResource($project->fresh(['creator', 'pm', 'analyst', 'division', 'teamMembers.user'])),
        ]);
    }

    /**
     * Allocate team members to a project — writes directly to project_team_members table.
     * POST/PUT /projects/{id}/team
     */
    public function allocateTeam(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);

        $request->validate([
            'team'   => ['required', 'array', 'min:1'],
            'team.*' => ['array'],
        ]);

        $teamData = $request->input('team', []);

        // Clear all existing team members for this project
        \App\Models\ProjectTeamMember::where('project_id', $project->id)->delete();

        $saved = 0;
        foreach ($teamData as $member) {
            $userId = null;
            $roleInProject = 'Developer';

            if (is_array($member)) {
                $roleInProject = $member['skill'] ?? $member['role'] ?? 'Developer';

                // 1. Resolve by email FIRST to guarantee exact DB user match
                if (!empty($member['email'])) {
                    $u = \App\Models\User::where('email', $member['email'])->first();
                    if ($u) $userId = $u->id;
                }
                // 2. Resolve by name if email didn't match
                if (!$userId && !empty($member['name'])) {
                    $u = \App\Models\User::where('name', 'like', "%{$member['name']}%")->first();
                    if ($u) $userId = $u->id;
                }
                // 3. Fallback to id if valid numeric ID
                if (!$userId && !empty($member['id']) && is_numeric($member['id'])) {
                    $userId = (int) $member['id'];
                }
            } elseif (is_numeric($member)) {
                $userId = (int) $member;
            }

            if ($userId) {
                // Skip duplicate (project_id + user_id combo)
                \App\Models\ProjectTeamMember::firstOrCreate(
                    ['project_id' => $project->id, 'user_id' => $userId],
                    ['role_in_project' => $roleInProject]
                );
                $saved++;
            }
        }

        return response()->json([
            'status'  => 'success',
            'message' => "{$saved} anggota tim berhasil dialokasikan ke proyek.",
            'data'    => new ProjectResource($project->fresh(['creator', 'pm', 'analyst', 'division', 'teamMembers.user'])),
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
        $project   = Project::findOrFail($id);
        $histories = $project->statusHistories()->with('changedBy.role')->get();

        return response()->json([
            'status' => 'success',
            'data'   => ProjectStatusHistoryResource::collection($histories),
        ]);
    }
}

