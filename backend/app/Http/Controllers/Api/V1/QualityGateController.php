<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\QualityGate\ApproveQualityGateRequest;
use App\Http\Requests\QualityGate\RejectQualityGateRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Models\ReleaseRequest;
use App\Services\ProjectWorkflowService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Quality Gate Fase 4 — keputusan go-live produksi oleh Head of IT.
 *
 * Dua keputusan yang sah atas satu pengajuan rilis: setujui (LIVE_PRODUCTION) atau
 * tolak (REJECTED). Keduanya dicatat pada baris `release_requests` beserta identitas
 * pemutusnya, dan keduanya melewati `ProjectWorkflowService` agar riwayat status,
 * pemeriksaan wewenang, serta notifikasi pemangku kepentingan tetap satu jalur.
 *
 * Sebelumnya hanya persetujuan yang tersedia, sehingga Head of IT yang menemukan
 * pengajuan tidak layak tidak punya jalan resmi menolaknya — layar Quality Gate
 * memakai `PATCH /projects/{id}` tanpa alasan penolakan, tanpa mencatat siapa yang
 * menolak, dan tanpa menyentuh baris pengajuan rilisnya sama sekali.
 */
class QualityGateController extends Controller
{
    public function __construct(
        protected ProjectWorkflowService $workflowService
    ) {}

    /**
     * GET /api/v1/quality-gate/queue
     *
     * Daftar proyek yang menunggu keputusan Quality Gate.
     *
     * Relasi dimuat memakai `Project::RESOURCE_RELATIONS` supaya isi antrean sama
     * lengkapnya dengan daftar proyek biasa — termasuk dokumen, laporan pengujian,
     * dan pengajuan rilis yang menjadi dasar penilaian empat pilar kelayakan.
     */
    public function queue(): JsonResponse
    {
        $projects = Project::with(Project::RESOURCE_RELATIONS)
            ->where('status', ProjectStatus::PENDING_GOLIVE->value)
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Antrean Quality Gate berhasil dimuat.',
            'data' => ProjectResource::collection($projects),
        ]);
    }

    /**
     * POST /api/v1/quality-gate/approve
     *
     * Head of IT menyetujui rilis: proyek berpindah ke LIVE_PRODUCTION.
     */
    public function approve(ApproveQualityGateRequest $request): JsonResponse
    {
        $project = Project::findOrFail($request->integer('project_id'));
        $user = $request->user();
        $notes = trim((string) $request->input('notes'));

        try {
            // Transisi status dan pencatatan keputusan wajib satu kesatuan. Bila
            // pembaruan baris pengajuan gagal setelah status sudah berpindah, proyek
            // akan tampil LIVE_PRODUCTION sementara pengajuannya tetap "menunggu
            // keputusan" — jejak audit yang saling bertentangan.
            $updatedProject = DB::transaction(function () use ($project, $user, $notes): Project {
                $updatedProject = $this->workflowService->transition(
                    $project,
                    ProjectStatus::LIVE_PRODUCTION,
                    $user,
                    'Quality Gate disetujui Head of IT.'.($notes === '' ? '' : ' '.$notes)
                );

                $this->pendingReleaseRequests($project)->update([
                    'head_of_it_approval' => true,
                    'approved_at' => now(),
                    'approved_by' => $user->id,
                ]);

                return $updatedProject;
            });
        } catch (Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Rilis disetujui. Proyek berstatus LIVE_PRODUCTION.',
            'data' => new ProjectResource($updatedProject->load(Project::RESOURCE_RELATIONS)),
        ]);
    }

    /**
     * POST /api/v1/quality-gate/reject
     *
     * Head of IT menolak pengajuan rilis: proyek berpindah ke REJECTED.
     *
     * REJECTED — bukan RETURN_TO_DEV — karena RETURN_TO_DEV adalah jalur pengembalian
     * milik jalur pengujian QA dan Keamanan Siber, sedangkan penolakan di gerbang ini
     * adalah keputusan tata kelola atas pengajuan rilisnya. `ProjectWorkflowService`
     * menuliskan alasan penolakan ke `projects.rejection_reason` pada transisi ini.
     */
    public function reject(RejectQualityGateRequest $request): JsonResponse
    {
        $project = Project::findOrFail($request->integer('project_id'));
        $user = $request->user();
        $reason = trim((string) $request->input('reason'));

        try {
            $updatedProject = DB::transaction(function () use ($project, $user, $reason): Project {
                $updatedProject = $this->workflowService->transition(
                    $project,
                    ProjectStatus::REJECTED,
                    $user,
                    $reason
                );

                $this->pendingReleaseRequests($project)->update([
                    'rejected_at' => now(),
                    'rejected_by' => $user->id,
                    'rejection_notes' => $reason,
                ]);

                return $updatedProject;
            });
        } catch (Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Pengajuan rilis ditolak dan dikembalikan kepada pengaju.',
            'data' => new ProjectResource($updatedProject->load(Project::RESOURCE_RELATIONS)),
        ]);
    }

    /**
     * Query pengajuan rilis proyek yang belum menerima keputusan apa pun.
     *
     * Keputusan hanya boleh menyentuh baris yang masih menunggu. Satu proyek dapat
     * memiliki beberapa pengajuan bila rilis sebelumnya ditolak, dan menimpa baris
     * lama akan menghapus riwayat keputusan yang justru menjadi bukti audit.
     *
     * @return \Illuminate\Database\Eloquent\Builder<ReleaseRequest>
     */
    private function pendingReleaseRequests(Project $project): Builder
    {
        return ReleaseRequest::where('project_id', $project->id)
            ->where('head_of_it_approval', false)
            ->whereNull('rejected_at');
    }
}
