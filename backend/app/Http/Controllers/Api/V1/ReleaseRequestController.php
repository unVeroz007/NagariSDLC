<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReleaseRequestResource;
use App\Models\Project;
use App\Models\ReleaseRequest;
use App\Services\ProjectWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class ReleaseRequestController extends Controller
{
    public function __construct(
        protected ProjectWorkflowService $workflowService
    ) {}

    public function index(): JsonResponse
    {
        $releases = ReleaseRequest::with(['project', 'requester'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => ReleaseRequestResource::collection($releases),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'target_release_date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $project = Project::findOrFail($request->project_id);

        $release = ReleaseRequest::create([
            'project_id' => $project->id,
            'requested_by' => $request->user()->id,
            'target_release_date' => $request->target_release_date,
            'notes' => $request->notes,
        ]);

        // Transition project to PENDING_GOLIVE
        try {
            $this->workflowService->transition(
                $project,
                ProjectStatus::PENDING_GOLIVE,
                $request->user(),
                "Pengajuan Rilis Produksi. Target: {$request->target_release_date}"
            );
        } catch (Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ReleaseRequest transition failed: ' . $e->getMessage(), [
                'project_id' => $project->id,
                'user_id' => $request->user()->id,
            ]);

            return response()->json([
                'status'  => 'success',
                'message' => 'Pengajuan rilis berhasil dibuat, namun transisi status proyek gagal: ' . $e->getMessage(),
                'data'    => new ReleaseRequestResource($release->load(['requester', 'project'])),
            ], 201);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Pengajuan rilis berhasil dikirim.',
            'data' => new ReleaseRequestResource($release->load(['requester', 'project'])),
        ], 201);
    }
}
