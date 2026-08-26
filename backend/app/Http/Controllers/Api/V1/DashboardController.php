<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectStatusHistory;
use App\Models\ProjectTask;
use App\Models\User;
use App\Services\ProjectAccessService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Jumlah bulan yang ditampilkan pada tren rilis.
     */
    private const RELEASE_TREND_MONTHS = 6;

    public function __construct(
        protected ProjectAccessService $access
    ) {}

    /**
     * Ringkasan angka untuk kartu dasbor, disaring sesuai wewenang pengguna.
     *
     * Penyaringannya didelegasikan ke `ProjectAccessService` — sumber kebenaran yang
     * sama dengan `GET /projects`. Sebelumnya method ini menyimpan salinan aturan
     * visibilitasnya sendiri sebagai rangkaian `elseif`, dan salinan itu sudah
     * menyimpang dari aslinya dalam tiga hal:
     *
     *   1. role yang tidak tercantum (`development_lead`, `dev_analyst`, `lead_group`)
     *      jatuh ke luar seluruh cabang tanpa satu pun filter, sehingga menghitung
     *      seluruh portofolio bank;
     *   2. cabang `analyst` memakai `where(...)->orWhereIn(...)` tanpa pengelompokan,
     *      sehingga setiap hitungan turunan menjadi
     *      `analyst_id = X OR (status IN (...) AND status = 'PENDING')` — angka
     *      "pending" ikut memuat seluruh proyek analis itu apa pun statusnya;
     *   3. cabang QA/Siber hanya melihat `projects.status`, padahal kolom jalur
     *      (`qa_status`/`cyber_status`) adalah kebenaran jalurnya.
     *
     * Satu query agregat dipakai untuk kelima angka. Lima `clone` + lima `count()`
     * sebelumnya menjalankan lima kali penyaring yang sama, termasuk subkueri
     * `whereHas` milik role developer.
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $visibleProjects = $this->access->applyVisibilityScope(Project::query(), $user);

        $counts = (clone $visibleProjects)
            ->selectRaw(
                'COUNT(*) as total_projects,'
                .' SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_projects,'
                .' SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as in_development,'
                .' SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as in_qa,'
                .' SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as live_production',
                [
                    ProjectStatus::PENDING->value,
                    ProjectStatus::IN_DEVELOPMENT->value,
                    ProjectStatus::QA_IN_PROGRESS->value,
                    ProjectStatus::LIVE_PRODUCTION->value,
                ]
            )
            ->first();

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_projects' => (int) ($counts->total_projects ?? 0),
                'pending_projects' => (int) ($counts->pending_projects ?? 0),
                'in_development' => (int) ($counts->in_development ?? 0),
                'in_qa' => (int) ($counts->in_qa ?? 0),
                'live_production' => (int) ($counts->live_production ?? 0),
                // Task dihitung hanya pada proyek yang boleh dilihat. Angka global
                // membocorkan besaran portofolio kepada pengguna yang hanya berhak
                // atas satu proyek.
                'total_tasks' => ProjectTask::whereIn(
                    'project_id',
                    (clone $visibleProjects)->select('projects.id')
                )->count(),
                // Jumlah akun adalah data administratif, bukan angka proyek. Hanya
                // role pengawas yang memperolehnya; yang lain menerima null agar
                // bentuk responsnya tetap sama.
                'total_users' => $this->access->hasOversightAccess($user)
                    ? User::count()
                    : null,
            ],
        ]);
    }

    /**
     * Statistik lintas portofolio untuk halaman Analitik SDLC.
     *
     * Dibatasi `role:super_admin` di `routes/api.php`. Isinya memang agregat seluruh
     * bank — distribusi status, beban tiap developer, komposisi role — sehingga tidak
     * ada penyaringan per pengguna yang masuk akal di sini; gerbangnya adalah route.
     * Sebelum pembatasan itu ada, halaman analitik dijaga hanya oleh router frontend
     * sementara endpointnya terbuka bagi setiap akun terautentikasi.
     */
    public function analytics(): JsonResponse
    {
        $statusDistribution = $this->statusDistribution();
        $goLiveMoments = $this->firstGoLiveMoments();
        $liveProjectCount = Project::where('status', ProjectStatus::LIVE_PRODUCTION->value)->count();

        $totalFinished = Project::whereIn('status', [
            ProjectStatus::LIVE_PRODUCTION->value,
            ProjectStatus::CANCELLED->value,
            ProjectStatus::REJECTED->value,
        ])->count();

        $successRate = $totalFinished > 0
            ? round(($liveProjectCount / $totalFinished) * 100, 1)
            : 0;

        $totalProjects = Project::count();

        // Proyek dengan jalur QA bertanda TIDAK LULUS. Sebelumnya dihitung dari
        // `qa_status = 'REJECTED'`, nilai yang tidak ada pada enum `TrackStatus`,
        // sehingga metriknya selalu 0 tanpa pernah terlihat salah.
        $qaFailedCount = Project::where('qa_status', TrackStatus::FAILED->value)->count();
        $bugDensity = $totalProjects > 0
            ? round($qaFailedCount / $totalProjects, 2)
            : 0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'status_distribution' => $statusDistribution,
                'avg_cycle_time' => ['value' => $this->averageCycleTimeInDays($goLiveMoments), 'change' => 0],
                'success_rate' => ['value' => $successRate, 'change' => 0],
                'bug_density' => ['value' => $bugDensity, 'change' => 0],
                'velocity' => ['value' => $liveProjectCount, 'change' => 0],
                'release_trend' => $this->releaseTrend($goLiveMoments),
                'developer_workloads' => $this->developerWorkloads(),
                'role_distribution' => $this->roleDistribution(),
                'total_projects' => $totalProjects,
                'total_users' => User::count(),
                'total_tasks' => ProjectTask::count(),
            ],
        ]);
    }

    /**
     * Jumlah proyek per status, dipakai diagram batang halaman analitik.
     *
     * Dibaca lewat query builder, bukan Eloquent. `Project::$casts` memetakan `status`
     * ke enum `ProjectStatus`, jadi `Model::pluck('count', 'status')` menghasilkan
     * kunci berupa objek enum — dan objek tidak bisa menjadi kunci array PHP.
     * Akibatnya seluruh endpoint ini melempar
     * `TypeError: Cannot access offset of type App\Enums\ProjectStatus on array`
     * setiap kali ada minimal satu proyek. Halaman analitik hanya bisa dimuat pada
     * database kosong. Frontend juga mengharapkan kunci berupa string status
     * (`frontend/src/pages/admin/Analytics.jsx` memetakannya ke label dan warna).
     *
     * `whereNull('deleted_at')` menggantikan global scope `SoftDeletes` yang tidak
     * berlaku pada query builder.
     *
     * @return Collection<string, int>
     */
    private function statusDistribution(): Collection
    {
        return DB::table('projects')
            ->whereNull('deleted_at')
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->map(static fn ($count): int => (int) $count);
    }

    /**
     * Waktu pertama setiap proyek masuk produksi, dibaca dari histori status.
     *
     * `projects.updated_at` pernah dipakai sebagai penanda waktu go-live. Kolom itu
     * berubah pada setiap penyuntingan sesudahnya — satu perbaikan catatan seminggu
     * setelah rilis langsung menggeser cycle time dan tren rilis proyek tersebut.
     * `project_status_histories` menyimpan momen transisinya dan tidak pernah berubah.
     *
     * `MIN` dipakai agar proyek yang pernah dirilis lebih dari sekali hanya dihitung
     * pada rilis pertamanya.
     *
     * Proyek yang berstatus produksi tanpa baris histori (data lama, sebelum histori
     * dicatat) tidak ikut terhitung. Lebih baik rata-rata dari sebagian data yang
     * benar daripada seluruh data yang salah.
     *
     * @return Collection<int, Carbon>
     */
    private function firstGoLiveMoments(): Collection
    {
        return ProjectStatusHistory::query()
            ->where('to_status', ProjectStatus::LIVE_PRODUCTION->value)
            ->selectRaw('project_id, MIN(created_at) as went_live_at')
            ->groupBy('project_id')
            ->pluck('went_live_at', 'project_id')
            ->map(static fn ($moment): Carbon => Carbon::parse($moment));
    }

    /**
     * Rata-rata hari dari pengajuan proyek sampai rilis produksi pertamanya.
     *
     * @param  Collection<int, Carbon>  $goLiveMoments
     */
    private function averageCycleTimeInDays(Collection $goLiveMoments): float
    {
        if ($goLiveMoments->isEmpty()) {
            return 0;
        }

        $createdAt = Project::whereIn('id', $goLiveMoments->keys())->pluck('created_at', 'id');

        $durations = $goLiveMoments
            ->map(static function (Carbon $wentLiveAt, int $projectId) use ($createdAt): ?float {
                $start = $createdAt[$projectId] ?? null;

                return $start === null ? null : $start->diffInDays($wentLiveAt);
            })
            ->filter(static fn (?float $days): bool => $days !== null);

        return $durations->isEmpty() ? 0 : round($durations->avg(), 1);
    }

    /**
     * Jumlah proyek yang mulai produksi per bulan, enam bulan terakhir.
     *
     * @param  Collection<int, Carbon>  $goLiveMoments
     * @return list<array{month: string, value: int}>
     */
    private function releaseTrend(Collection $goLiveMoments): array
    {
        $countsPerMonth = $goLiveMoments
            ->groupBy(static fn (Carbon $moment): string => $moment->format('Y-m'))
            ->map(static fn (Collection $moments): int => $moments->count());

        $trend = [];

        for ($offset = self::RELEASE_TREND_MONTHS - 1; $offset >= 0; $offset--) {
            $month = now()->subMonths($offset);

            $trend[] = [
                'month' => $month->translatedFormat('M Y'),
                'value' => (int) ($countsPerMonth[$month->format('Y-m')] ?? 0),
            ];
        }

        return $trend;
    }

    /**
     * Beban tiap developer: jumlah proyek aktif yang mengikutsertakannya.
     *
     * Dihitung dengan satu query agregat. Versi sebelumnya menjalankan satu
     * `Project::whereHas(...)->count()` di dalam `map()` per developer, jadi jumlah
     * query-nya tumbuh mengikuti jumlah developer.
     *
     * `email` tidak lagi dikirim: halaman analitik hanya menampilkan nama dan angka
     * bebannya, sehingga alamat surel seluruh developer tidak perlu meninggalkan
     * server.
     *
     * @return list<array{name: string, workload: int}>
     */
    private function developerWorkloads(): array
    {
        $workloadPerUser = DB::table('project_team_members')
            ->join('projects', 'projects.id', '=', 'project_team_members.project_id')
            ->whereNull('projects.deleted_at')
            ->whereNotIn('projects.status', [
                ProjectStatus::LIVE_PRODUCTION->value,
                ProjectStatus::CANCELLED->value,
            ])
            ->selectRaw('project_team_members.user_id as user_id, COUNT(DISTINCT projects.id) as total')
            ->groupBy('project_team_members.user_id')
            ->pluck('total', 'user_id');

        return User::query()
            ->whereHas('role', static fn ($role) => $role->where('name', UserRole::DEVELOPER->value))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(static fn (User $developer): array => [
                'name' => $developer->name,
                'workload' => (int) ($workloadPerUser[$developer->id] ?? 0),
            ])
            ->all();
    }

    /**
     * Komposisi akun per role, diurutkan agar diagramnya stabil antar permintaan.
     *
     * @return list<array{role: string, count: int}>
     */
    private function roleDistribution(): array
    {
        return DB::table('users')
            ->join('roles', 'users.role_id', '=', 'roles.id')
            ->whereNull('users.deleted_at')
            ->selectRaw('roles.display_name as role, COUNT(users.id) as count')
            ->groupBy('roles.display_name')
            ->orderBy('roles.display_name')
            ->get()
            ->map(static fn ($row): array => [
                'role' => (string) $row->role,
                'count' => (int) $row->count,
            ])
            ->all();
    }
}
