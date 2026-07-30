<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Models\ReleaseRequest;
use App\Services\ProjectWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class QualityGateController extends Controller
{
    public function __construct(
        protected ProjectWorkflowService $workflowService
    ) {}

    /**
     * GET /api/v1/quality-gate/queue
     * Daftar proyek yang menunggu persetujuan Quality Gate (Head of IT)
     */
    public function queue(): JsonResponse
    {
        $projects = Project::with(['creator', 'pm', 'analyst', 'division', 'releaseRequests.requester'])
            ->where('status', ProjectStatus::PENDING_GOLIVE->value)
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data'   => ProjectResource::collection($projects),
        ]);
    }

    /**
     * POST /api/v1/quality-gate/approve
     * Head of IT menyetujui rilis ke LIVE_PRODUCTION
     */
    public function approve(Request $request): JsonResponse
    {
        $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'notes'      => ['nullable', 'string'],
        ]);

        $project = Project::findOrFail($request->project_id);

        try {
            $updatedProject = $this->workflowService->transition(
                $project,
                ProjectStatus::LIVE_PRODUCTION,
                $request->user(),
                "Quality Gate Approved oleh Head of IT. " . ($request->notes ?? '')
            );

            // Update release request approval flag
            ReleaseRequest::where('project_id', $project->id)
                ->where('head_of_it_approval', false)
                ->update([
                    'head_of_it_approval' => true,
                    'approved_at'         => now(),
                ]);

            return response()->json([
                'status'  => 'success',
                'message' => 'Proyek berhasil disetujui (Quality Gate Approved) dan berstatus LIVE_PRODUCTION.',
                'data'    => new ProjectResource($updatedProject),
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
