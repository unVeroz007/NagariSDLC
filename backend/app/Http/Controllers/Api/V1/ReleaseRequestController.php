<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReleaseRequest\StoreReleaseRequestRequest;
use App\Http\Resources\ReleaseRequestResource;
use App\Models\Project;
use App\Models\ReleaseRequest;
use App\Services\ProjectAccessService;
use App\Services\ProjectWorkflowService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Pengajuan migrasi & rilis produksi ke Grup Infrastruktur.
 *
 * Ini adalah jalur resmi menuju PENDING_GOLIVE — satu-satunya yang sekaligus
 * mencatat baris `release_requests` berisi rencana rilis. Gerbangnya berlapis:
 * `ProjectWorkflowService` memastikan hanya PM pemegang disposisi yang boleh
 * mengajukan, dan hanya setelah jalur Pengujian QA serta Audit Keamanan Siber
 * dinyatakan lulus. Tidak ada UAT final setelah kedua jalur itu.
 *
 * Catatan: `PATCH /projects/{id}/status` secara teknis juga dapat memindahkan
 * proyek ke PENDING_GOLIVE. Gerbang otorisasi dan prasyarat dua jalur lulus tetap
 * berlaku di sana karena keduanya hidup di dalam service, tetapi jalur itu tidak
 * membuat baris rencana rilis — antrean Quality Gate akan kosong detailnya.
 */
class ReleaseRequestController extends Controller
{
    public function __construct(
        protected ProjectWorkflowService $workflowService,
        protected ProjectAccessService $accessService,
    ) {}

    /**
     * GET /api/v1/release-requests
     *
     * Daftar dibatasi pada proyek yang memang boleh dilihat pengguna. Tanpa
     * penyaringan ini, setiap pengguna terautentikasi dapat membaca rencana rilis
     * dan estimasi downtime seluruh portofolio.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $releases = ReleaseRequest::with(['project', 'requester', 'approver', 'rejecter'])
            ->whereHas(
                'project',
                fn (Builder $project): Builder => $this->accessService->applyVisibilityScope($project, $user)
            )
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Daftar pengajuan rilis berhasil dimuat.',
            'data' => ReleaseRequestResource::collection($releases),
        ]);
    }

    /**
     * POST /api/v1/release-requests
     */
    public function store(StoreReleaseRequestRequest $request): JsonResponse
    {
        $project = Project::findOrFail($request->integer('project_id'));
        $user = $request->user();

        try {
            // Baris pengajuan dan transisi status wajib satu kesatuan. Sebelumnya
            // baris dibuat lebih dulu di luar transaction, sehingga transisi yang
            // ditolak (mis. jalur pengujian belum lulus) meninggalkan pengajuan
            // rilis yatim yang tetap muncul di antrean Quality Gate.
            $release = DB::transaction(function () use ($request, $project, $user): ReleaseRequest {
                $release = ReleaseRequest::create([
                    'project_id' => $project->id,
                    'requested_by' => $user->id,
                    'target_release_date' => $request->date('target_release_date'),
                    // Ketiga bagian rencana rilis disimpan pada kolomnya sendiri.
                    // Sebelumnya semuanya digabung menjadi satu teks `notes` berlabel,
                    // sehingga layar Quality Gate tidak dapat menampilkan estimasi
                    // downtime dan prosedur rollback secara terpisah — dan kekosongan
                    // itu dahulu ditutup teks bawaan di frontend.
                    'downtime_estimate' => $this->normalizeText($request->input('downtime_estimate')),
                    'rollback_plan' => $this->normalizeText($request->input('rollback_plan')),
                    'notes' => $this->normalizeText($request->input('notes')),
                ]);

                $this->workflowService->transition(
                    $project,
                    ProjectStatus::PENDING_GOLIVE,
                    $user,
                    'Pengajuan migrasi & rilis ke Grup Infrastruktur. Target rilis: '
                        . $request->date('target_release_date')->format('d-m-Y')
                );

                return $release;
            });
        } catch (Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Pengajuan rilis berhasil dikirim ke Grup Infrastruktur.',
            'data' => new ReleaseRequestResource($release->load(['requester', 'project'])),
        ], 201);
    }

    /**
     * Rapikan masukan teks bebas menjadi nilai simpan yang konsisten.
     *
     * String kosong dan string berisi spasi disimpan sebagai null supaya pemeriksaan
     * kelengkapan rencana rilis pada `ReleaseReadinessService` tidak menganggap
     * kolom berisi spasi sebagai sudah terisi.
     */
    private function normalizeText(mixed $value): ?string
    {
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }
}
