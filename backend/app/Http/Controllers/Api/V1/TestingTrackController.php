<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TestResult;
use App\Enums\TestingTrack;
use App\Http\Controllers\Controller;
use App\Http\Requests\TestingTrack\AssignTesterRequest;
use App\Http\Requests\TestingTrack\SignOffTrackRequest;
use App\Http\Requests\TestingTrack\SubmitTestReportRequest;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\TestReportResource;
use App\Models\Project;
use App\Models\TestReport;
use App\Services\ProjectAccessService;
use App\Services\TestingTrackService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * Dasar bersama endpoint dua jalur pengujian paralel: QA dan Keamanan Siber.
 *
 * Kedua jalur memiliki empat langkah yang bentuknya identik — pengajuan PM, disposisi
 * Lead, laporan pelaksana, sign-off Lead — dan hanya berbeda pada peran yang berwenang
 * serta masukan pengajuannya. Sebelumnya kesamaan itu ditulis dua kali sebagai dua
 * controller yang saling menyalin, sehingga setiap perbaikan pada satu jalur harus
 * diingat untuk diterapkan pada jalur lain, dan sebagian di antaranya terlewat.
 *
 * Di sini yang dibagikan adalah tiga langkah yang benar-benar sama, sedangkan langkah
 * pengajuan tetap dimiliki masing-masing subclass karena Form Request-nya berbeda:
 * pengajuan Siber wajib menyertakan jenis pemeriksaan beserta masukannya.
 *
 * Controller tidak memuat logika alur kerja sama sekali. Seluruh aturan urutan langkah,
 * wewenang, audit, dan notifikasi berada di `TestingTrackService`; di sini hanya
 * penerjemahan HTTP dan pemeriksaan visibilitas data.
 */
abstract class TestingTrackController extends Controller
{
    public function __construct(
        protected TestingTrackService $trackService,
        protected ProjectAccessService $accessService,
    ) {}

    /**
     * Jalur pengujian yang ditangani controller ini.
     */
    abstract protected function track(): TestingTrack;

    /**
     * Daftar laporan pengujian pada jalur ini.
     *
     * Penyaringannya diturunkan dari visibilitas proyek, bukan dari daftar role yang
     * ditulis ulang di sini. Sebelumnya controller menyaring sendiri dengan
     * `in_array($roleName, [...])` lalu jatuh ke `where('tester_id', ...)`, sehingga
     * seorang QA Tester tidak dapat melihat laporan rekannya pada proyek yang sedang
     * ia kerjakan bersama, sementara aturan visibilitas proyek sudah mengizinkannya.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing('role');

        $reports = TestReport::query()
            ->with(['project', 'tester', 'reviewer'])
            ->forTrack($this->track())
            ->whereHas(
                'project',
                fn (Builder $project) => $this->accessService->applyVisibilityScope($project, $user)
            )
            ->when(
                $request->filled('project_id'),
                fn (Builder $query) => $query->where('project_id', $request->integer('project_id'))
            )
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => "Daftar laporan {$this->track()->label()} berhasil dimuat.",
            'data' => TestReportResource::collection($reports),
        ]);
    }

    /**
     * Langkah 2 — Lead mendisposisikan pengujian kepada pelaksana.
     */
    public function assign(AssignTesterRequest $request): JsonResponse
    {
        $project = $this->findProject($request->integer('project_id'));

        try {
            $project = $this->trackService->assignTester(
                $project,
                $this->track(),
                $request->user(),
                $request->integer('assignee_id'),
                $request->input('notes')
            );
        } catch (Throwable $e) {
            return $this->failed($e);
        }

        return $this->projectResponse(
            $project,
            "Disposisi {$this->track()->label()} berhasil disimpan."
        );
    }

    /**
     * Langkah 3 — pelaksana mengirim laporan hasil pengujian.
     *
     * Laporan berhenti di status REVIEW: keputusan lulus atau tidak lulus tetap milik
     * Lead lewat `signOff()`.
     */
    public function storeReport(SubmitTestReportRequest $request): JsonResponse
    {
        $project = $this->findProject($request->integer('project_id'));

        try {
            $report = $this->trackService->submitReport(
                $project,
                $this->track(),
                $request->user(),
                $request->validated()
            );
        } catch (Throwable $e) {
            return $this->failed($e);
        }

        return response()->json([
            'status' => 'success',
            'message' => "Laporan {$this->track()->label()} berhasil dikirim dan menunggu sign-off Lead.",
            'data' => new TestReportResource($report->load(['tester', 'project'])),
        ], 201);
    }

    /**
     * Langkah 4 — Lead menutup jalur: lulus, atau kembalikan ke pengembangan.
     */
    public function signOff(SignOffTrackRequest $request): JsonResponse
    {
        $project = $this->findProject($request->integer('project_id'));

        try {
            $this->trackService->signOff(
                $project,
                $this->track(),
                $request->user(),
                TestResult::from($request->input('result')),
                $request->input('notes'),
                $request->input('severity')
            );
        } catch (Throwable $e) {
            return $this->failed($e);
        }

        return $this->projectResponse(
            $project,
            "Sign-off {$this->track()->label()} berhasil dicatat."
        );
    }

    /**
     * Proyek yang dituju, sekaligus gerbang visibilitas datanya.
     *
     * Pemeriksaan wewenang langkah alur kerja tetap dilakukan service; yang dijaga di
     * sini adalah hal berbeda, yaitu pengguna tidak dapat menyentuh proyek yang tidak
     * boleh ia lihat hanya dengan menebak ID.
     *
     * Dipanggil di luar blok `try` setiap aksi dengan sengaja: `abort_unless` melempar
     * HttpException, dan bila ikut tertangkap penangkap `Throwable` di bawah, penolakan
     * 403 akan berubah menjadi 422 sehingga tidak terbaca sebagai pelanggaran akses.
     */
    protected function findProject(int $projectId): Project
    {
        $project = Project::with(Project::RESOURCE_RELATIONS)->findOrFail($projectId);
        $user = request()->user();
        $user->loadMissing('role');

        abort_unless(
            $this->accessService->canView($user, $project),
            403,
            'Anda tidak memiliki akses ke proyek ini.'
        );

        return $project;
    }

    /**
     * Balasan sukses berisi proyek yang sudah dimuat ulang beserta relasinya.
     *
     * Frontend memakai satu objek proyek sebagai sumber tampilan jalur pengujian, jadi
     * mengembalikan bentuk yang sama seperti endpoint proyek membuat layar Lead tidak
     * perlu memuat ulang daftar setelah setiap tindakan.
     */
    protected function projectResponse(Project $project, string $message): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'message' => $message,
            'data' => new ProjectResource(
                $project->fresh(Project::RESOURCE_RELATIONS)
            ),
        ]);
    }

    /**
     * Pelanggaran aturan alur kerja dibalas 422 dengan pesan aslinya.
     *
     * Pesan dari service ditulis untuk dibaca pengguna akhir dan sudah dipaparkan
     * frontend lewat `buildApiErrorMessage`. Status 422 dipakai — bukan 500 — karena
     * penyebabnya adalah keadaan permintaan, bukan kegagalan sistem.
     */
    protected function failed(Throwable $e): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => $e->getMessage(),
        ], 422);
    }
}
