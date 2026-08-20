<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UatApproval\SubmitUatApprovalDecisionRequest;
use App\Http\Requests\UatApproval\VerifyExternalUatApproverRequest;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\UatApprover;
use App\Services\UatApprovalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class UatApprovalController extends Controller
{
    public function __construct(private readonly UatApprovalService $service) {}

    public function matrix(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $this->authorizeProjectMatrix($request, $project);

        return response()->json([
            'status' => 'success',
            'data' => $this->service->activeMatrix($project),
        ]);
    }

    public function myAssignments(Request $request): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $this->service->myInternalAssignments($request->user()),
        ]);
    }

    public function restart(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $this->authorizeProjectManagement($request, $project);
        $this->service->startNewRound($project, $request->user(), 'Putaran baru dibuat oleh PM/Super Admin');

        return response()->json([
            'status' => 'success',
            'message' => 'Putaran persetujuan UAT baru berhasil dibuat.',
            'data' => $this->service->activeMatrix($project),
        ], 201);
    }

    public function sync(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $this->authorizeProjectManagement($request, $project);

        return response()->json([
            'status' => 'success',
            'message' => 'Peserta approval UAT berhasil disinkronkan dengan UAT Tab 1.',
            'data' => $this->service->syncActiveRound($project, $request->user()),
        ]);
    }

    public function generateLink(Request $request, int $id, UatApprover $approver): JsonResponse
    {
        $project = Project::findOrFail($id);
        $result = $this->service->generateExternalLink($project, $approver, $request->user());

        return response()->json([
            'status' => 'success',
            'message' => 'Link pribadi berhasil dibuat. Link lama otomatis tidak berlaku.',
            'data' => $result,
        ]);
    }

    public function internalDecision(SubmitUatApprovalDecisionRequest $request, int $id, UatApprover $approver): JsonResponse
    {
        $project = Project::findOrFail($id);
        $decision = $this->service->decideInternal(
            $project,
            $approver,
            $request->user(),
            $request->validated('decision'),
            $request->validated('note'),
            $request
        );

        return response()->json([
            'status' => 'success',
            'message' => $decision['status'] === 'approved'
                ? 'Persetujuan UAT berhasil disimpan.'
                : 'Penolakan UAT berhasil disimpan.',
            'data' => $decision,
        ]);
    }

    public function preview(string $token): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $this->service->publicPreview($token)]);
    }

    public function verify(VerifyExternalUatApproverRequest $request, string $token): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'message' => 'Identitas berhasil diverifikasi.',
            'data' => $this->service->verifyPhone($token, $request->validated('phone')),
        ]);
    }

    public function detail(Request $request, string $token): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $this->service->publicDetail($token, (string) $request->header('X-UAT-Approval-Access')),
        ]);
    }

    public function externalDecision(SubmitUatApprovalDecisionRequest $request, string $token): JsonResponse
    {
        $decision = $this->service->decideExternal(
            $token,
            (string) $request->header('X-UAT-Approval-Access'),
            $request->validated('decision'),
            $request->validated('note'),
            $request
        );

        return response()->json([
            'status' => 'success',
            'message' => $decision['status'] === 'approved'
                ? 'Terima kasih. Persetujuan UAT Anda berhasil dicatat.'
                : 'Keputusan dan catatan revisi Anda berhasil dicatat.',
            'data' => $decision,
        ]);
    }

    public function download(Request $request, string $token, DocumentVault $document): BinaryFileResponse|JsonResponse
    {
        $document = $this->service->downloadExternalDocument(
            $token,
            (string) $request->header('X-UAT-Approval-Access'),
            $document
        );
        if (! Storage::disk('local')->exists($document->file_path)) {
            return response()->json(['status' => 'error', 'message' => 'File tidak ditemukan di server.'], 404);
        }

        return response()->download(
            Storage::disk('local')->path($document->file_path),
            str_replace(['/', '\\'], '-', $document->file_name)
        );
    }

    private function authorizeProjectMatrix(Request $request, Project $project): void
    {
        $user = $request->user();
        $role = $user->role?->name;
        $canView = in_array($role, ['super_admin', 'head_of_it', 'development_lead'], true)
            || in_array((int) $user->id, array_map('intval', [$project->created_by, $project->pm_id, $project->analyst_id]), true)
            || $project->teamMembers()->where('user_id', $user->id)->exists()
            || $project->uatApprovalRounds()->whereHas('approvers', fn ($query) => $query->where('user_id', $user->id))->exists();
        abort_unless($canView, 403, 'Anda tidak memiliki akses ke persetujuan UAT proyek ini.');
    }

    private function authorizeProjectManagement(Request $request, Project $project): void
    {
        $user = $request->user();
        $role = $user->role?->name;
        $canManage = in_array($role, ['super_admin', 'head_of_it'], true)
            || (in_array($role, ['project_manager', 'dev_analyst'], true)
                && (int) $project->pm_id === (int) $user->id);
        abort_unless($canManage, 403, 'Anda tidak berhak mengelola approval UAT proyek ini.');
    }
}
