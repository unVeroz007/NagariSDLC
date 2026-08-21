<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Enums\TestResult;
use App\Enums\TrackStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\TestReport\StoreTestReportRequest;
use App\Http\Resources\TestReportResource;
use App\Models\Project;
use App\Models\TestReport;
use App\Services\ProjectWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class QARequestController extends Controller
{
    public function __construct(
        protected ProjectWorkflowService $workflowService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing('role');
        $roleName = $user->role?->name;

        $query = TestReport::with(['project', 'tester', 'reviewer'])
            ->where('test_type', 'qa');

        if (! in_array($roleName, ['super_admin', 'qa_lead', 'lead_group'])) {
            $query->where('tester_id', $user->id);
        }

        $reports = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => TestReportResource::collection($reports),
        ]);
    }

    public function store(StoreTestReportRequest $request): JsonResponse
    {
        $project = Project::findOrFail($request->project_id);
        $result = TestResult::from($request->result);

        $report = TestReport::create([
            'project_id' => $project->id,
            'test_type' => 'qa',
            'tester_id' => $request->user()->id,
            'result' => $result,
            'notes' => $request->notes,
            'attachment_url' => $request->attachment_url,
        ]);

        // Auto transition status project based on QA result
        try {
            $targetStatus = ($result === TestResult::PASS)
                ? ProjectStatus::QA_PASSED
                : ProjectStatus::RETURN_TO_DEV;

            $this->workflowService->transition(
                $project,
                $targetStatus,
                $request->user(),
                "QA Test Result: {$result->value}. " . ($request->notes ?? '')
            );

            // Jalur QA wajib mencatat hasil akhirnya sendiri, terlepas dari status
            // utama proyek. Ditulis setelah transisi lolos supaya hasil pengujian
            // tidak pernah tercatat oleh pengguna yang tidak berwenang.
            $project->update([
                'qa_status' => ($result === TestResult::PASS)
                    ? TrackStatus::PASSED->value
                    : TrackStatus::FAILED->value,
            ]);
        } catch (Throwable $e) {
            // Report saved but transition failed — return warning
            return response()->json([
                'status'  => 'success',
                'message' => 'Laporan QA tersimpan, namun transisi status gagal: ' . $e->getMessage(),
                'data'    => new TestReportResource($report->load(['tester', 'project'])),
            ], 201);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Laporan pengujian QA berhasil disimpan.',
            'data' => new TestReportResource($report->load(['tester', 'project'])),
        ], 201);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string'],
            'notes'  => ['nullable', 'string'],
        ]);

        $report = TestReport::where('test_type', 'qa')->findOrFail($id);

        // Update review fields
        $report->update([
            'notes'       => $request->notes ?? $report->notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        // If status provided, attempt workflow transition
        if ($request->status !== $report->result->value) {
            try {
                if (! $report->project) {
                    return response()->json(['status' => 'error', 'message' => 'Proyek terkait tidak ditemukan.'], 404);
                }
                $project = $report->project;
                $targetStatus = ProjectStatus::from($request->status);
                $this->workflowService->transition(
                    $project,
                    $targetStatus,
                    $request->user(),
                    $request->notes ?? ''
                );
            } catch (Throwable $e) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Update catatan berhasil, namun transisi status gagal: ' . $e->getMessage(),
                ], 422);
            }
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'Status QA request berhasil diperbarui.',
            'data'    => new TestReportResource($report->fresh(['tester', 'project'])),
        ]);
    }
}
