<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Enums\TrackStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Project\StoreProjectRequest;
use App\Http\Requests\Project\SaveUatExecutionDraftRequest;
use App\Http\Requests\Project\SubmitUatExecutionRequest;
use App\Http\Requests\Project\SubmitUatMajorVerificationRequest;
use App\Http\Requests\Project\UpdateProjectStatusRequest;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\ProjectStatusHistoryResource;
use App\Models\ActivityLog;
use App\Models\Division;
use App\Models\Project;
use App\Services\ProjectAccessService;
use App\Services\ProjectWorkflowService;
use App\Services\UatExecutionService;
use App\Services\UatApprovalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class ProjectController extends Controller
{
    /** Keys yang hanya boleh ditulis oleh endpoint workflow khusus. */
    private const SERVER_MANAGED_SIT_UAT_KEYS = [
        'uat2_scenarios',
        'uat2_additional_requests',
        'uat2_summary',
        'uat2_executedCount',
        'uat2_passedCount',
        'uat2_findings',
        'uat2_execNotes',
        'uat2_resume_after_sit',
        'uat2_verification_mode',
        'uat2_verification_history',
        'uat2_major_revision_verified_at',
        'uat2_major_revision_resolved_at',
        'uat_hold',
        'uat_revision_cycles',
        'sit_retest_scope',
        'uat3_approvals',
        'uat_change_requests',
        'sit_cycles',
    ];

    /**
     * Nilai jalur pengujian yang boleh ditulis langsung lewat endpoint update umum.
     *
     * PASSED sengaja tidak termasuk: kelulusan hanya boleh lahir dari transisi status
     * (QA_PASSED / CYBER_PASSED) atau dari endpoint laporan pengujian, karena hanya di
     * sana otorisasi role Lead / tester benar-benar diperiksa.
     *
     * FAILED boleh dikirim, namun penulisannya ditahan sampai transisi RETURN_TO_DEV
     * pada request yang sama berhasil, sehingga pemeriksaan role tetap menjadi penentu
     * (lihat penanganan $failedTrackColumns di update()).
     */
    private const CLIENT_WRITABLE_TRACK_STATUSES = [
        TrackStatus::NOT_SUBMITTED->value,
        TrackStatus::SUBMITTED->value,
        TrackStatus::IN_PROGRESS->value,
        TrackStatus::REVIEW->value,
        TrackStatus::FAILED->value,
    ];

    public function __construct(
        protected ProjectWorkflowService $workflowService,
        protected UatExecutionService $uatExecutionService,
        protected UatApprovalService $uatApprovalService,
        protected ProjectAccessService $accessService
    ) {}

    public function nextReqId(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data'   => ['req_id' => Project::generateReqId()],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing('role');

        $query = Project::with(['creator', 'pm', 'analyst', 'division', 'documents', 'teamMembers.user', 'statusHistories.changedBy', 'tasks.assignee', 'tasks.revisionRequester']);

        // ─── ROLE-BASED DATA ISOLATION ───
        // Aturan visibilitas dipusatkan di ProjectAccessService agar daftar ini dan
        // pemeriksaan akses di show()/update() tidak pernah menyimpang satu sama lain.
        $this->accessService->applyVisibilityScope($query, $user);

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

        $projects = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 50));

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
            $divisionId = $request->user()->division_id;
        }

        $project = Project::create([
            'req_id'       => Project::generateReqId(),
            'title'        => $title,
            'description'  => $request->description,
            'contact_phone'=> $request->contact_phone,
            'type'         => $request->type === 'Non-RBB' ? 'NON_RBB' : ($request->type ?? 'RBB'),
            'project_type' => $request->project_type ?? 'baru',
            'division_id'  => $divisionId,
            'target_date'  => $request->target_date,
            'created_by'   => $request->user()->id,
            'status'       => ProjectStatus::PENDING->value,
        ]);

        return response()->json([
            'status'  => 'success',
            'message' => 'Pengajuan proyek berhasil dibuat.',
            'data'    => new ProjectResource($project->load(['creator', 'division'])),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $project = Project::with(['creator', 'pm', 'analyst', 'division', 'statusHistories.changedBy', 'teamMembers.user', 'tasks.assignee', 'tasks.revisionRequester'])
            ->findOrFail($id);

        $user = $request->user();
        $user->loadMissing('role');

        // Penyaringan di index() saja tidak cukup: tanpa pemeriksaan di sini, ID proyek
        // milik orang lain masih dapat dibuka langsung lewat endpoint ini.
        if (! $this->accessService->canView($user, $project)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki akses ke proyek ini.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'data'   => new ProjectResource($project),
        ]);
    }

    /**
     * General project update (non-status fields: pm_id, analyst_id, staging_url, uat_notes, etc.)
     * If 'status' is provided, routes through ProjectWorkflowService.
     */
    /**
     * Catat perubahan status jalur pengujian ke activity_logs.
     *
     * Pengajuan QA / Siber oleh PM tidak selalu memicu transisi status utama —
     * misalnya saat jalur lain sedang memegang penunjuk siklus — sehingga tanpa
     * pencatatan ini ada perubahan keadaan proyek yang tidak punya jejak audit sama
     * sekali. Seluruh isi log ditulis server, bukan diambil dari payload klien.
     */
    private function recordTrackStatusAudit(Project $project, Request $request, array $statusBeforeUpdate): void
    {
        $trackLabels = [
            'qa_status'    => 'Pengujian QA',
            'cyber_status' => 'Audit Keamanan Siber',
        ];

        $user = $request->user();
        $user?->loadMissing('role');

        foreach ($trackLabels as $column => $trackLabel) {
            $previousStatus = TrackStatus::normalize($statusBeforeUpdate[$column] ?? null);
            $currentStatus = TrackStatus::normalize($project->{$column});

            if ($previousStatus === $currentStatus) {
                continue;
            }

            ActivityLog::create([
                'user_id'      => $user?->id,
                'action'       => 'update_project_track_status',
                'action_label' => 'Mengubah Status Jalur Pengujian',
                'description'  => "Status {$trackLabel} proyek \"{$project->title}\" diubah dari {$previousStatus->label()} menjadi {$currentStatus->label()}.",
                'subject_type' => Project::class,
                'subject_id'   => $project->id,
                'metadata'     => [
                    'project_id'   => $project->id,
                    'project_name' => $project->title,
                    'track'        => $column,
                    'from_status'  => $previousStatus->value,
                    'to_status'    => $currentStatus->value,
                    'user_name'    => $user?->name,
                    'user_role'    => $user?->role?->display_name ?? $user?->role?->name,
                    // Catatan pengaju disimpan apa adanya sebagai lampiran konteks.
                    // Deskripsi log di atas tetap ditulis server, jadi isi kiriman
                    // klien tidak bisa menyamarkan apa yang sebenarnya terjadi.
                    'notes'        => $request->input('notes'),
                ],
                'ip_address'   => $request->ip(),
                'status'       => 'success',
                'created_at'   => now(),
            ]);
        }
    }

    /**
     * Samakan bentuk input jalur pengujian sebelum divalidasi.
     *
     * Frontend memakai camelCase (`qaStatus` / `cyberStatus`) sedangkan kolom
     * database snake_case, sehingga tanpa normalisasi ini nilai yang dikirim
     * terbuang tanpa error. Nilainya sekaligus dinaikkan ke huruf kapital supaya
     * satu-satunya bentuk yang tersimpan sesuai enum TrackStatus.
     */
    private function normalizeTrackStatusInput(Request $request): void
    {
        foreach (['qa_status' => 'qaStatus', 'cyber_status' => 'cyberStatus'] as $column => $camelCaseAlias) {
            $value = $request->input($column, $request->input($camelCaseAlias));

            if ($value === null || $value === '') {
                continue;
            }

            $request->merge([$column => mb_strtoupper(trim((string) $value))]);
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);

        $user = $request->user();
        $user->loadMissing('role');

        // Gerbang tulis. Lebih ketat daripada gerbang baca: mengubah field proyek
        // menuntut keterlibatan langsung, bukan sekadar berada di fase yang sama.
        // Tanpa ini, analis lain dapat menimpa `analyst_result` proyek yang bukan
        // tanggung jawabnya. Pemeriksaan wewenang transisi status tetap dijalankan
        // ProjectWorkflowService di bawah.
        if (! $this->accessService->canUpdate($user, $project)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki akses untuk mengubah proyek ini.',
            ], 403);
        }

        $this->normalizeTrackStatusInput($request);

        $request->validate([
            'title'                  => ['sometimes', 'string', 'max:255'],
            'description'            => ['sometimes', 'nullable', 'string'],
            'contact_phone'          => ['sometimes', 'nullable', 'string', 'max:30'],
            'type'                   => ['sometimes', 'nullable', 'string', 'in:RBB,NON_RBB,Non-RBB'],
            'pm_id'                  => ['sometimes', 'nullable', 'exists:users,id'],
            'analyst_id'             => ['sometimes', 'nullable', 'exists:users,id'],
            'division_id'            => ['sometimes', 'nullable', 'exists:divisions,id'],
            'target_date'            => ['sometimes', 'nullable', 'date'],
            'current_stage_deadline' => ['sometimes', 'nullable', 'date'],
            'staging_url'            => ['sometimes', 'nullable', 'string'],
            'uat_notes'              => ['sometimes', 'nullable', 'string'],
            'sit_uat_data'           => ['sometimes', 'nullable'],
            'sitUatData'             => ['sometimes', 'nullable'],
            'analyst_result'         => ['sometimes', 'nullable'],
            'dev_analyst_result'     => ['sometimes', 'nullable'],
            'qa_status'              => ['sometimes', 'nullable', 'string', 'in:'.implode(',', self::CLIENT_WRITABLE_TRACK_STATUSES)],
            'cyber_status'           => ['sometimes', 'nullable', 'string', 'in:'.implode(',', self::CLIENT_WRITABLE_TRACK_STATUSES)],
            'team_allocated_by_pm'   => ['sometimes', 'nullable', 'boolean'],
            'status'                 => ['sometimes', 'string'],
            'project_type'           => ['sometimes', 'nullable', 'string', 'in:baru,perbaikan,update'],
        ], [
            'qa_status.in'    => 'Status jalur QA tidak dikenali. Kelulusan QA hanya dapat ditetapkan melalui sign-off QA Lead.',
            'cyber_status.in' => 'Status jalur Keamanan Siber tidak dikenali. Kelulusan audit hanya dapat ditetapkan melalui sign-off Cyber Lead.',
        ]);

        // Penetapan TIDAK LULUS wajib menyertakan transisi RETURN_TO_DEV pada request
        // yang sama. Pemeriksaan role transisi itulah yang memastikan hanya QA Lead /
        // Cyber Lead (atau tester terkait) yang bisa menjatuhkan keputusan gagal.
        $failedTrackColumns = collect(['qa_status', 'cyber_status'])
            ->filter(fn (string $column): bool => $request->input($column) === TrackStatus::FAILED->value)
            ->values();

        if ($failedTrackColumns->isNotEmpty()
            && $request->input('status') !== ProjectStatus::RETURN_TO_DEV->value) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Penetapan jalur pengujian TIDAK LULUS harus disertai pengembalian proyek ke Development (RETURN_TO_DEV).',
            ], 422);
        }

        // Resolve analyst_id from analyst name if needed (workspace sends analyst name)
        $analystId = $request->analyst_id;
        if (! $analystId && $request->filled('analyst')) {
            $analystName = $request->analyst;
            $analystUser = \App\Models\User::where('name', $analystName)
                ->orWhere('name', 'like', "%{$analystName}%")
                ->whereHas('role', fn($q) => $q->where('name', 'analyst'))
                ->first();
            $analystId = $analystUser?->id;
        }

        $typeValue = $request->type;
        if ($typeValue === 'Non-RBB') {
            $typeValue = 'NON_RBB';
        }

        $incomingSitUatData = $request->input('sit_uat_data', $request->input('sitUatData'));
        $mergedSitUatData = null;
        if (is_array($incomingSitUatData)) {
            $currentSitUatData = (array) $project->sit_uat_data;
            foreach (self::SERVER_MANAGED_SIT_UAT_KEYS as $key) {
                if (array_key_exists($key, $currentSitUatData)) {
                    $incomingSitUatData[$key] = $currentSitUatData[$key];
                } else {
                    unset($incomingSitUatData[$key]);
                }
            }
            $mergedSitUatData = array_replace($currentSitUatData, $incomingSitUatData);
        }

        $updateData = array_filter([
            'title'                  => $request->title,
            'description'            => $request->description,
            'contact_phone'          => $request->contact_phone,
            'type'                   => $typeValue,
            'project_type'           => $request->project_type,
            'pm_id'                  => $request->pm_id,
            'analyst_id'             => $analystId ?? $request->analyst_id,
            'division_id'            => $request->division_id,
            'target_date'            => $request->target_date,
            'current_stage_deadline' => $request->current_stage_deadline ?? $request->input('deadline'),
            'staging_url'            => $request->staging_url,
            'uat_notes'              => $request->uat_notes,
            'sit_uat_data'           => $mergedSitUatData,
            'analyst_result'         => $request->input('analystResult') ?? $request->input('analyst_result'),
            'dev_analyst_result'     => $request->input('devAnalystResult') ?? $request->input('dev_analyst_result'),
            'qa_status'              => $request->input('qa_status'),
            'cyber_status'           => $request->input('cyber_status'),
            'team_allocated_by_pm'   => $request->has('team_allocated_by_pm') ? (bool) $request->team_allocated_by_pm : null,
        ], fn($v) => ! is_null($v));

        // Nilai TIDAK LULUS ditahan sampai transisi RETURN_TO_DEV terbukti berhasil,
        // supaya keputusan gagal tidak pernah tersimpan oleh pemanggil yang ternyata
        // tidak berwenang melakukan transisi tersebut.
        foreach ($failedTrackColumns as $column) {
            unset($updateData[$column]);
        }

        $trackStatusBeforeUpdate = [
            'qa_status'    => $project->qa_status,
            'cyber_status' => $project->cyber_status,
        ];

        $project->update($updateData);

        $this->recordTrackStatusAudit($project, $request, $trackStatusBeforeUpdate);

        // Handle status transition through the state machine
        if ($request->filled('status')) {
            $targetStatus = ProjectStatus::tryFrom($request->status);

            if (! $targetStatus) {
                return response()->json([
                    'status'  => 'error',
                    'message' => "Data proyek diperbarui, namun status tujuan \"{$request->status}\" tidak dikenali sistem.",
                ], 422);
            }

            try {
                $notes = $request->input('notes') ?? $request->input('leadNote') ?? $request->input('lead_note');
                $this->workflowService->transition(
                    $project,
                    $targetStatus,
                    $request->user(),
                    $notes
                );
            } catch (Throwable $e) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Data proyek diperbarui, namun transisi status gagal: ' . $e->getMessage(),
                ], 422);
            }

            if ($failedTrackColumns->isNotEmpty()) {
                $trackStatusBeforeFailure = [
                    'qa_status'    => $project->qa_status,
                    'cyber_status' => $project->cyber_status,
                ];

                $project->update(
                    $failedTrackColumns
                        ->mapWithKeys(fn (string $column): array => [$column => TrackStatus::FAILED->value])
                        ->all()
                );

                $this->recordTrackStatusAudit($project, $request, $trackStatusBeforeFailure);
            }
        }


        if ($request->has('team') || $request->has('team_ids') || $request->has('developers')) {
            $teamData = $request->input('team') ?? $request->input('team_ids') ?? $request->input('developers');
            if (is_array($teamData)) {
                \App\Models\ProjectTeamMember::where('project_id', $project->id)->delete();
                foreach ($teamData as $member) {
                    $userId = null;
                    $roleInProject = 'Developer';

                    if (is_array($member) || is_object($member)) {
                        $member = (array) $member;
                        $userId = $member['user_id'] ?? $member['id'] ?? null;
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
                            'assigned_by'     => $member['assigned_by'] ?? 'lead',
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
                $member = (array) $member;
                $userId = null;
                $roleInProject = $member['skill'] ?? $member['role'] ?? 'Developer';

                // Resolve by user_id (explicit) first, then id, then email
                if (!empty($member['user_id']) && is_numeric($member['user_id'])) {
                    $userId = (int) $member['user_id'];
                } elseif (!empty($member['id']) && is_numeric($member['id'])) {
                    $userId = (int) $member['id'];
                }

                if (!$userId && !empty($member['email'])) {
                    $u = \App\Models\User::where('email', $member['email'])->first();
                    if ($u) $userId = $u->id;
                }

                if ($userId) {
                    \App\Models\ProjectTeamMember::create([
                        'project_id'      => $project->id,
                        'user_id'         => $userId,
                        'role_in_project' => $roleInProject,
                        'assigned_by'     => $member['assigned_by'] ?? 'lead',
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
        $user = request()->user();

        // Hanya super_admin/head_of_it yang bisa hapus proyek manapun
        // PM hanya bisa hapus proyek yang dikelola sendiri
        if (
            !in_array($user->role?->name, ['super_admin', 'head_of_it'])
            && $project->pm_id !== $user->id
        ) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki wewenang untuk menghapus proyek ini.',
            ], 403);
        }

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

    /**
     * Gatekeeper SIT. SIT pertama mencakup seluruh task aktif; SIT ulang akibat
     * UAT Mayor hanya mencakup task pada scope Change Request siklus aktif.
     */
    public function sitGate(int $id): JsonResponse
    {
        $project = Project::with('tasks.assignee')->findOrFail($id);

        $tasks = $project->sitScopeTasks();

        // Semua task yang TIDAK berstatus done / take_down = blocker
        $incomplete = $tasks->filter(function ($t) use ($project) {
            $status = $t->status instanceof \BackedEnum ? $t->status->value : $t->status;
            return ! in_array($status, ['done', 'take_down'])
                || ($project->isTargetedSitRetest() && ! $t->assignee_id);
        })->values();

        $totalCount = $tasks->filter(function ($t) {
            $status = $t->status instanceof \BackedEnum ? $t->status->value : $t->status;
            return $status !== 'take_down';
        })->count();

        $doneCount = $tasks->filter(function ($t) use ($project) {
            $status = $t->status instanceof \BackedEnum ? $t->status->value : $t->status;
            return $status === 'done'
                && (! $project->isTargetedSitRetest() || (bool) $t->assignee_id);
        })->count();

        return response()->json([
            'status' => 'success',
            'data'   => [
                'can_start_sit' => $incomplete->isEmpty(),
                'blockers'      => $incomplete->map(fn($t) => [
                    'id'    => $t->id,
                    'title' => $t->title,
                    'status' => $t->status instanceof \BackedEnum ? $t->status->value : $t->status,
                    'assignee' => $t->assignee?->name,
                ]),
                'total_task'    => $totalCount,
                'done_task'     => $doneCount,
                'take_down_task'=> $project->tasks->filter(fn($t) => ($t->status instanceof \BackedEnum ? $t->status->value : $t->status) === 'take_down')->count(),
                'scope' => [
                    'mode' => $project->isTargetedSitRetest() ? 'targeted_retest' : 'full',
                    'cycle' => $project->isTargetedSitRetest()
                        ? (int) ($project->sit_uat_data['uat_hold']['cycle'] ?? 0)
                        : null,
                    'task_ids' => $tasks->pluck('id')->map(fn ($id) => (int) $id)->values(),
                ],
            ],
        ]);
    }

    /**
     * Persetujuan SIT (Tahap 3) oleh role: developer (semua assignee),
     * PM / Analyst Pengembangan (dev_analyst / project_manager), dan development_lead.
     * Approval developer disimpan per-user di sit_uat_data.sit3_approvals.developer.developers[].
     * PM & development_lead masing-masing 1 slot.
     */
    public function sitApproval(Request $request, int $id): JsonResponse
    {
        $project = Project::with(['teamMembers', 'tasks.assignee'])->findOrFail($id);
        $user = $request->user();
        $roleName = $user->role?->name;

        // Role approval yang diizinkan.
        // PM (dev_analyst / project_manager) = Analyst Pengembangan.
        $roleKey = match ($roleName) {
            'developer' => 'developer',
            'dev_analyst', 'project_manager' => 'pm',
            'development_lead' => 'development_lead',
            default     => null,
        };

        if (! $roleKey) {
            return response()->json([
                'status' => 'error',
                'message' => 'Role Anda tidak diizinkan memberikan persetujuan SIT.',
            ], 403);
        }

        // Validasi status proyek harus SIT_IN_PROGRESS
        $status = $project->status instanceof \BackedEnum ? $project->status->value : $project->status;
        if (! in_array($status, ['SIT_IN_PROGRESS', 'SIT_REVISION'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Persetujuan SIT hanya dapat dilakukan saat proyek berstatus SIT.',
            ], 422);
        }

        // Pada SIT ulang terarah, hanya developer task terdampak yang wajib approve.
        $requiredDeveloperIds = $project->sitScopeTasks()
            ->pluck('assignee_id')
            ->filter(fn($id) => $id !== null)
            ->unique()
            ->values()
            ->map(fn($id) => (int) $id)
            ->all();

        // Validasi keanggotaan:
        // - developer harus menjadi assignee task pada proyek
        // - PM (Analyst Pengembangan) harus pm_id proyek
        // - development_lead harus development_lead (role)
        if ($roleKey === 'developer') {
            $isAssignee = in_array((int) $user->id, $requiredDeveloperIds, true);
            if (! $isAssignee) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda bukan developer yang mengerjakan task pada proyek ini.',
                ], 403);
            }
        }
        if ($roleKey === 'pm') {
            if ((int) $project->pm_id !== (int) $user->id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda bukan Project Manager / Analyst Pengembangan pada proyek ini.',
                ], 403);
            }
        }

        $request->validate([
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $approvals = (array) ($project->sit_uat_data['sit3_approvals'] ?? []);

        if ($roleKey === 'developer') {
            // Inisialisasi slot developer
            $devApproval = (array) ($approvals['developer'] ?? []);
            $devList = collect($devApproval['developers'] ?? [])
                ->filter(fn (array $approval): bool => in_array(
                    (int) ($approval['userId'] ?? $approval['approvedById'] ?? 0),
                    $requiredDeveloperIds,
                    true
                ))
                ->values()
                ->all();
            $userId = (int) $user->id;
            $alreadyApproved = collect($devList)->contains(fn($d) => (int) ($d['userId'] ?? $d['approvedById'] ?? 0) === $userId);
            if (! $alreadyApproved) {
                $devList[] = [
                    'userId' => $userId,
                    'name'   => $user->name,
                    'at'     => now()->toIso8601String(),
                    'note'   => $request->note ?? null,
                ];
            }
            $approvals['developer'] = [
                'required'       => count($requiredDeveloperIds),
                'approvedCount'  => count($devList),
                'developers'     => $devList,
            ];
        } else {
            $approvals[$roleKey] = [
                'approved'  => true,
                'approvedBy'=> $user->name,
                'approvedById' => $user->id,
                'at'        => now()->toIso8601String(),
                'note'      => $request->note ?? null,
            ];
        }

        $sitData = (array) $project->sit_uat_data;
        $sitData['sit3_approvals'] = $approvals;
        $project->update(['sit_uat_data' => $sitData]);

        // Catat aktivitas
        \App\Models\ActivityLog::create([
            'user_id' => $user->id,
            'action'  => 'sit_approval',
            'action_label' => 'Persetujuan SIT',
            'description' => "{$user->name} ({$roleName}) menyetujui SIT pada proyek \"{$project->title}\".",
            'subject_type' => Project::class,
            'subject_id' => $project->id,
            'metadata' => [
                'project_id' => $project->id,
                'project_name' => $project->title,
                'user_role' => $roleName,
                'approval_role' => $roleKey,
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Persetujuan SIT dari {$roleName} berhasil disimpan.",
            'data' => new ProjectResource($project->fresh(['tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user'])),
        ]);
    }

    /**
     * Hitung status kelengkapan approval SIT (dipakai frontend & dokumen).
     * developer: semua assignee unik; analyst & development_lead: 1 slot.
     */
    public static function sitApprovalStatus(array $approvals, $project): array
    {
        $requiredDeveloperIds = $project->sitScopeTasks()
            ->pluck('assignee_id')
            ->filter(fn($id) => $id !== null)
            ->unique()
            ->map(fn ($id) => (int) $id)
            ->values();
        $requiredDevCount = $requiredDeveloperIds->count();

        $devApproval = (array) ($approvals['developer'] ?? []);
        $approvedDeveloperIds = collect($devApproval['developers'] ?? [])
            ->map(fn (array $approval): int => (int) ($approval['userId'] ?? $approval['approvedById'] ?? 0))
            ->filter()
            ->unique();
        $devApproved = $requiredDeveloperIds->intersect($approvedDeveloperIds)->count();

        return [
            'developer' => [
                'required'       => $requiredDevCount,
                'approved'       => $requiredDevCount > 0 && $devApproved >= $requiredDevCount,
                'approvedCount'  => $devApproved,
            ],
            'pm' => [
                'required' => 1,
                'approved' => ($approvals['pm']['approved'] ?? false) === true,
            ],
            'development_lead' => [
                'required' => 1,
                'approved' => ($approvals['development_lead']['approved'] ?? false) === true,
            ],
        ];
    }

    /**
     * Persetujuan UAT (Tahap 3) oleh role: business_user (pemohon), pm, development_lead.
     * Disimpan di sit_uat_data.uat3_approvals.
     */
    public function uatApproval(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $user = $request->user();
        $roleName = $user->role?->name;

        $roleKey = match ($roleName) {
            'business_user' => 'business_user',
            'dev_analyst', 'project_manager' => 'pm',
            'development_lead' => 'development_lead',
            'super_admin', 'head_of_it' => 'pm', // Admin dianggap mewakili PM
            default => null,
        };

        if (! $roleKey) {
            return response()->json([
                'status' => 'error',
                'message' => 'Role Anda tidak diizinkan memberikan persetujuan UAT.',
            ], 403);
        }

        $status = $project->status instanceof \BackedEnum ? $project->status->value : $project->status;
        if ($status !== ProjectStatus::UAT_IN_PROGRESS->value) {
            return response()->json([
                'status' => 'error',
                'message' => 'Persetujuan UAT hanya dapat dilakukan saat proyek berstatus UAT.',
            ], 422);
        }

        $sitData = (array) $project->sit_uat_data;
        if (
            (int) ($sitData['activeUatStep'] ?? 1) < 3
            || ($sitData['uat2_resume_after_sit'] ?? false) === true
            || ($sitData['uat2_verification_mode'] ?? false) === true
        ) {
            return response()->json([
                'status' => 'error',
                'message' => 'Persetujuan final belum tersedia. Selesaikan eksekusi UAT dan seluruh revisi mayor terlebih dahulu.',
            ], 422);
        }

        if ($roleKey === 'business_user') {
            if ((int) $project->created_by !== (int) $user->id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda bukan pemohon proyek ini.',
                ], 403);
            }
        }
        if ($roleKey === 'pm') {
            $isAdminProxy = in_array($roleName, ['super_admin', 'head_of_it']);
            if (! $isAdminProxy && (int) $project->pm_id !== (int) $user->id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda bukan Project Manager proyek ini.',
                ], 403);
            }
        }

        $request->validate([
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $approvals = (array) ($sitData['uat3_approvals'] ?? []);
        $approvals[$roleKey] = [
            'approved'     => true,
            'approvedBy'   => $user->name,
            'approvedById' => $user->id,
            'at'           => now()->toIso8601String(),
            'note'         => $request->note ?? null,
        ];
        $sitData['uat3_approvals'] = $approvals;
        $project->update(['sit_uat_data' => $sitData]);

        \App\Models\ActivityLog::create([
            'user_id' => $user->id,
            'action'  => 'uat_approval',
            'action_label' => 'Persetujuan UAT',
            'description' => "{$user->name} ({$roleName}) menyetujui UAT pada proyek \"{$project->title}\".",
            'subject_type' => Project::class,
            'subject_id' => $project->id,
            'metadata' => [
                'project_id' => $project->id,
                'project_name' => $project->title,
                'user_role' => $roleName,
                'approval_role' => $roleKey,
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Persetujuan UAT dari {$roleName} berhasil disimpan.",
            'data' => new ProjectResource($project->fresh(['tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user'])),
        ]);
    }

    /**
     * Simpan hasil UAT Tahap 2 per skenario. Ringkasan dan keputusan alur
     * dihitung oleh server; revisi mayor otomatis menjadi Change Request.
     */
    public function submitUatExecution(SubmitUatExecutionRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $savedProject = $this->uatExecutionService->submit(
            $project,
            $request->user(),
            $request->validated()
        );
        $summary = (array) ($savedProject->sit_uat_data['uat2_summary'] ?? []);
        $isMajorRevision = ($summary['conclusion'] ?? null) === 'major_revision';

        return response()->json([
            'status' => 'success',
            'message' => $isMajorRevision
                ? 'Hasil UAT tersimpan. Revisi mayor dicatat sebagai Change Request dan proyek dikembalikan ke developer.'
                : 'Hasil UAT tersimpan. Proyek dapat melanjutkan ke persetujuan final UAT.',
            'data' => new ProjectResource($savedProject),
            'meta' => [
                'conclusion' => $summary['conclusion'] ?? null,
                'requires_development_revision' => $isMajorRevision,
                'next_uat_step' => $isMajorRevision ? 2 : 3,
            ],
        ]);
    }

    public function saveUatExecutionDraft(SaveUatExecutionDraftRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $savedProject = $this->uatExecutionService->saveDraft(
            $project,
            $request->user(),
            $request->validated()
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Draft Eksekusi UAT berhasil disimpan.',
            'data' => new ProjectResource($savedProject),
        ]);
    }

    /**
     * Verifikasi item Mayor setelah developer selesai dan SIT ulang lulus.
     * Hanya item terdampak yang diuji ulang; hasil UAT lainnya tetap terkunci.
     */
    public function submitUatMajorVerification(SubmitUatMajorVerificationRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $savedProject = $this->uatExecutionService->verifyMajorRevisions(
            $project,
            $request->user(),
            $request->validated()
        );
        $sitUatData = (array) $savedProject->sit_uat_data;
        $requiresAnotherRevision = ($sitUatData['uat2_resume_after_sit'] ?? false) === true;

        return response()->json([
            'status' => 'success',
            'message' => $requiresAnotherRevision
                ? 'Sebagian perbaikan masih belum sesuai. UAT kembali ditahan dan Change Request lanjutan dibuat.'
                : 'Seluruh perbaikan Mayor diterima. UAT dapat dilanjutkan ke persetujuan final.',
            'data' => new ProjectResource($savedProject),
            'meta' => [
                'requires_development_revision' => $requiresAnotherRevision,
                'next_uat_step' => $requiresAnotherRevision ? 2 : 3,
            ],
        ]);
    }

    /**
     * Change Request UAT — diajukan oleh business_user (pemohon).
     * Tersimpan di sit_uat_data.uat_change_requests[]. Jika mayor, kembali ke dev;
     * minor diselesaikan tanpa rollback. Admin/PM/dev lead dapat memutuskan.
     */
    public function uatChangeRequest(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $user = $request->user();
        $roleName = $user->role?->name;

        // Hanya business_user (pemohon) yang boleh mengajukan change request UAT
        if ($roleName !== 'business_user' || (int) $project->created_by !== (int) $user->id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Hanya pemohon proyek yang dapat mengajukan change request UAT.',
            ], 403);
        }

        $status = $project->status instanceof \BackedEnum ? $project->status->value : $project->status;
        if (! in_array($status, ['UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_REVISION_DEV'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Change request UAT hanya dapat diajukan saat proyek berstatus UAT.',
            ], 422);
        }

        $request->validate([
            'type'      => ['required', 'string', 'in:minor,mayor'],
            'title'     => ['required', 'string', 'max:255'],
            'detail'    => ['required', 'string', 'max:5000'],
            'category'  => ['nullable', 'string', 'max:100'],
        ]);

        $sitData = (array) $project->sit_uat_data;
        $requests = (array) ($sitData['uat_change_requests'] ?? []);
        $requests[] = [
            'id'        => 'cr_' . time() . '_' . random_int(1000, 9999),
            'type'      => $request->type,
            'title'     => $request->title,
            'detail'    => $request->detail,
            'category'  => $request->category,
            'submittedBy' => $user->name,
            'submittedById' => $user->id,
            'status'    => 'pending', // pending | approved | rejected
            'at'        => now()->toIso8601String(),
        ];
        $sitData['uat_change_requests'] = $requests;
        $project->update(['sit_uat_data' => $sitData]);

        \App\Models\ActivityLog::create([
            'user_id' => $user->id,
            'action'  => 'uat_change_request',
            'action_label' => 'Change Request UAT',
            'description' => "{$user->name} mengajukan change request UAT ({$request->type}) pada proyek \"{$project->title}\": {$request->title}",
            'subject_type' => Project::class,
            'subject_id' => $project->id,
            'metadata' => [
                'project_id' => $project->id,
                'project_name' => $project->title,
                'user_role' => $roleName,
                'cr_type' => $request->type,
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Change request UAT berhasil diajukan.',
            'data' => new ProjectResource($project->fresh(['tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user'])),
        ]);
    }

    /**
     * Putuskan (approve/reject) change request UAT — oleh PM / development_lead / super_admin / head_of_it.
     * Jika disetujui & type mayor, proyek kembali ke development dan SIT ulang.
     * Jika disetujui & type minor, status proyek tidak berubah.
     */
    public function uatChangeRequestDecision(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $user = $request->user();
        $roleName = $user->role?->name;

        if (! in_array($roleName, ['super_admin', 'head_of_it', 'dev_analyst', 'project_manager', 'development_lead'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak berwenang memutuskan change request UAT.',
            ], 403);
        }

        $request->validate([
            'cr_id'    => ['required', 'string'],
            'decision' => ['required', 'string', 'in:approved,rejected'],
            'note'     => ['nullable', 'string', 'max:2000'],
        ]);

        $sitData = (array) $project->sit_uat_data;
        $requests = (array) ($sitData['uat_change_requests'] ?? []);
        $found = false;
        foreach ($requests as $i => &$cr) {
            if (($cr['id'] ?? null) === $request->cr_id) {
                $cr['status'] = $request->decision;
                $cr['decisionBy'] = $user->name;
                $cr['decisionAt'] = now()->toIso8601String();
                $cr['decisionNote'] = $request->note ?? null;
                $found = true;
                $crType = $cr['type'] ?? 'minor';
                break;
            }
        }
        unset($cr);

        if (! $found) {
            return response()->json([
                'status' => 'error',
                'message' => 'Change request tidak ditemukan.',
            ], 404);
        }

        $sitData['uat_change_requests'] = $requests;

        // Jika disetujui → alihkan status proyek sesuai tipe change request
        $newStatus = null;
        if ($request->decision === 'approved') {
            // Revisi minor dikerjakan di UAT tanpa rollback. Hanya mayor yang kembali ke development.
            if ($crType === 'mayor') {
                $newStatus = ProjectStatus::UAT_REVISION_DEV;
                $sitData['uat2_resume_after_sit'] = true;
                $sitData['activeSitStep'] = 1;
                $sitData['activeUatStep'] = 2;
                $sitData['sit2_task_approvals'] = [];
                $sitData['sit3_reviewNotes'] = '';
                $sitData['sit3_docs'] = [];
                $sitData['sit3_approvals'] = [];
                $sitData['uat3_approvals'] = [];
            }
            // Tambah riwayat change request ke revisi log
            $revisions = (array) ($sitData['revisions'] ?? []);
            $revisions[] = [
                'type'  => $crType === 'mayor' ? 'UAT_CHANGE_MAYOR' : 'UAT_CHANGE_MINOR',
                'notes' => $request->note ?? ($cr['title'] ?? 'Change Request'),
                'at'    => now()->toIso8601String(),
                'by'    => $user->name,
            ];
            $sitData['revisions'] = $revisions;
        }

        $project->update(['sit_uat_data' => $sitData]);

        if ($newStatus) {
            $this->uatApprovalService->supersedeActiveRounds($project, 'Change Request Mayor UAT disetujui');
            try {
                $this->workflowService->transition($project, $newStatus, $user, "Change Request UAT {$request->decision}: " . ($cr['title'] ?? ''));
            } catch (\Throwable $e) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Change request disimpan, tetapi transisi status gagal: ' . $e->getMessage(),
                ], 422);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Change request UAT {$request->decision}.",
            'data' => new ProjectResource($project->fresh(['tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user'])),
        ]);
    }
}
