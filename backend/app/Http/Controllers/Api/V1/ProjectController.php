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
use Illuminate\Support\Facades\DB;
use Throwable;

class ProjectController extends Controller
{
    public function __construct(
        protected ProjectWorkflowService $workflowService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $roleName = $user->role?->name;

        $query = Project::with(['creator', 'pm', 'analyst', 'division', 'documents', 'teamMembers.user']);

        // ─── ROLE-BASED DATA ISOLATION ───
        // Super Admin, Head of IT, Lead Group: bisa lihat SEMUA proyek
        // Role lain: hanya lihat proyek yang menjadi tanggung jawab mereka
        if (! in_array($roleName, ['super_admin', 'head_of_it', 'lead_group'])) {

            if ($roleName === 'business_user') {
                // Business User hanya lihat proyek yang diajukan sendiri
                $query->where('created_by', $user->id);

            } elseif ($roleName === 'analyst') {
                // Analyst hanya lihat proyek yang ditugaskan ke dia
                $query->where('analyst_id', $user->id);

            } elseif ($roleName === 'development_lead') {
                // Development Lead: semua proyek di fase pengembangan (bukan cuma punya dia)
                // Karena Lead Dev mengelola alokasi semua proyek, biarkan semua proyek terlihat
                // (opsional: bisa ditambah filter jika dibutuhkan)

            } elseif ($roleName === 'project_manager') {
                // PM hanya lihat proyek yang dikelola dia
                $query->where('pm_id', $user->id);

            } elseif ($roleName === 'developer') {
                // Developer hanya lihat proyek di mana dia anggota tim
                $query->whereHas('teamMembers', fn($q) => $q->where('user_id', $user->id));

            } elseif (in_array($roleName, ['qa_lead', 'qa_tester'])) {
                // QA: proyek di fase QA atau sudah pernah masuk QA
                $query->whereIn('status', [
                    ProjectStatus::READY_FOR_QA->value,
                    ProjectStatus::QA_IN_PROGRESS->value,
                    ProjectStatus::QA_PASSED->value,
                    ProjectStatus::RETURN_TO_DEV->value,
                    ProjectStatus::CYBER_IN_PROGRESS->value,
                    ProjectStatus::CYBER_PASSED->value,
                    ProjectStatus::READY_FOR_UAT->value,
                    ProjectStatus::UAT_PASSED->value,
                    ProjectStatus::PENDING_GOLIVE->value,
                    ProjectStatus::LIVE_PRODUCTION->value,
                ]);

            } elseif (in_array($roleName, ['cyber_lead', 'pentester'])) {
                // Cyber: proyek di fase Cyber atau sudah pernah masuk Cyber
                $query->whereIn('status', [
                    ProjectStatus::DEV_COMPLETED->value,
                    ProjectStatus::READY_FOR_QA->value,
                    ProjectStatus::QA_IN_PROGRESS->value,
                    ProjectStatus::QA_PASSED->value,
                    ProjectStatus::RETURN_TO_DEV->value,
                    ProjectStatus::CYBER_IN_PROGRESS->value,
                    ProjectStatus::CYBER_PASSED->value,
                    ProjectStatus::READY_FOR_UAT->value,
                    ProjectStatus::UAT_PASSED->value,
                    ProjectStatus::PENDING_GOLIVE->value,
                    ProjectStatus::LIVE_PRODUCTION->value,
                ]);
            }
        }

        // ─── EXISTING FILTERS ───
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
     * Status changes MUST go through updateStatus() endpoint via ProjectWorkflowService.
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
            'sit_uat_data'           => ['sometimes', 'nullable'],
            'qa_status'              => ['sometimes', 'nullable', 'string'],
            'cyber_status'           => ['sometimes', 'nullable', 'string'],
        ]);

        $updateData = $request->only([
            'title', 'description', 'pm_id', 'analyst_id',
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
            'team.*' => ['required', 'array'],
        ]);

        $teamData = $request->input('team', []);

        // Use DB transaction to prevent race conditions
        DB::transaction(function () use ($project, $teamData) {
            \App\Models\ProjectTeamMember::where('project_id', $project->id)->delete();

            foreach ($teamData as $member) {
                $userId = null;
                $roleInProject = $member['skill'] ?? $member['role'] ?? 'Developer';

                // Resolve by ID first (most reliable)
                if (!empty($member['id']) && is_numeric($member['id'])) {
                    $userId = (int) $member['id'];
                }
                // Resolve by email as fallback
                if (!$userId && !empty($member['email'])) {
                    $u = \App\Models\User::where('email', $member['email'])->first();
                    if ($u) $userId = $u->id;
                }

                if ($userId) {
                    \App\Models\ProjectTeamMember::create([
                        'project_id'      => $project->id,
                        'user_id'         => $userId,
                        'role_in_project' => $roleInProject,
                    ]);
                }
            }
        });

        $saved = count($teamData);

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

