<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $roleName = $user->role?->name;

        // Base query — filter by role
        $baseQuery = Project::query();

        if (!in_array($roleName, ['super_admin', 'head_of_it'])) {
            if ($roleName === 'business_user') {
                // Business user only sees their own projects
                $baseQuery->where('created_by', $user->id);
            } elseif ($roleName === 'project_manager') {
                // PM sees projects they manage
                $baseQuery->where('pm_id', $user->id);
            } elseif ($roleName === 'developer') {
                // Developer sees projects they're assigned to
                $baseQuery->whereHas('teamMembers', fn($q) => $q->where('user_id', $user->id));
            } elseif (in_array($roleName, ['qa_lead', 'qa_tester'])) {
                // QA sees projects in QA phase or assigned to them
                $baseQuery->whereIn('status', [
                    ProjectStatus::READY_FOR_QA->value,
                    ProjectStatus::QA_IN_PROGRESS->value,
                    ProjectStatus::QA_PASSED->value,
                    ProjectStatus::RETURN_TO_DEV->value,
                ]);
            } elseif (in_array($roleName, ['cyber_lead', 'pentester'])) {
                // Cyber sees projects in Cyber phase
                $baseQuery->whereIn('status', [
                    ProjectStatus::CYBER_IN_PROGRESS->value,
                    ProjectStatus::CYBER_PASSED->value,
                    ProjectStatus::RETURN_TO_DEV->value,
                ]);
            } elseif ($roleName === 'analyst') {
                // Analyst sees projects they're analyzing
                $baseQuery->where('analyst_id', $user->id)
                    ->orWhereIn('status', [
                        ProjectStatus::PENDING->value,
                        ProjectStatus::IN_REVIEW->value,
                        ProjectStatus::ANALYSIS_APPROVED->value,
                    ]);
            }
        }

        $totalProjects = (clone $baseQuery)->count();
        $pendingProjects = (clone $baseQuery)->where('status', ProjectStatus::PENDING->value)->count();
        $inDevelopment = (clone $baseQuery)->where('status', ProjectStatus::IN_DEVELOPMENT->value)->count();
        $inQa = (clone $baseQuery)->where('status', ProjectStatus::QA_IN_PROGRESS->value)->count();
        $liveProduction = (clone $baseQuery)->where('status', ProjectStatus::LIVE_PRODUCTION->value)->count();

        $totalUsers = User::count();
        $totalTasks = ProjectTask::count();

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_projects' => $totalProjects,
                'pending_projects' => $pendingProjects,
                'in_development' => $inDevelopment,
                'in_qa' => $inQa,
                'live_production' => $liveProduction,
                'total_users' => $totalUsers,
                'total_tasks' => $totalTasks,
            ],
        ]);
    }

    /**
     * Analytics endpoint — statistik lanjutan untuk halaman Analitik SDLC.
     */
    public function analytics(): JsonResponse
    {
        // 1. Distribusi status proyek
        $statusDistribution = Project::selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status');

        // 2. Rata-rata cycle time (created_at → updated_at untuk proyek LIVE_PRODUCTION) dalam hari
        $liveProjects = Project::where('status', ProjectStatus::LIVE_PRODUCTION->value)->get();
        $avgCycleTime = 0;
        if ($liveProjects->count() > 0) {
            $totalDays = $liveProjects->sum(function ($p) {
                return $p->created_at->diffInDays($p->updated_at);
            });
            $avgCycleTime = round($totalDays / $liveProjects->count(), 1);
        }

        // 3. Success rate — proyek LIVE_PRODUCTION vs total selesai (termasuk CANCELLED/REJECTED)
        $totalFinished = Project::whereIn('status', [
            ProjectStatus::LIVE_PRODUCTION->value,
            'CANCELLED',
            'REJECTED',
        ])->count();
        $successRate = $totalFinished > 0
            ? round(($liveProjects->count() / $totalFinished) * 100, 1)
            : 0;

        // 4. Project velocity — proyek selesai per bulan (6 bulan terakhir)
        $releaseTrend = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = Carbon::now()->subMonths($i);
            $count = Project::where('status', ProjectStatus::LIVE_PRODUCTION->value)
                ->whereYear('updated_at', $month->year)
                ->whereMonth('updated_at', $month->month)
                ->count();
            $releaseTrend[] = [
                'month' => $month->translatedFormat('M Y'),
                'value' => $count,
            ];
        }

        // 5. Workload per developer (jumlah proyek aktif yang ditugaskan)
        $developers = User::whereHas('role', function ($q) {
            $q->where('name', 'developer');
        })->with('role:id,name,display_name')->get();

        $workloads = $developers->map(function ($dev) {
            $activeCount = Project::where('status', '!=', ProjectStatus::LIVE_PRODUCTION->value)
                ->where('status', '!=', 'CANCELLED')
                ->whereHas('teamMembers', function ($q) use ($dev) {
                    $q->where('user_id', $dev->id);
                })
                ->count();
            return [
                'name'     => $dev->name,
                'email'    => $dev->email,
                'workload' => $activeCount,
            ];
        });

        // 6. User role distribution
        $roleDistribution = User::join('roles', 'users.role_id', '=', 'roles.id')
            ->selectRaw('roles.display_name as role, count(users.id) as count')
            ->groupBy('roles.display_name')
            ->get();

        // 7. Total metrics
        $totalProjects = Project::count();
        $totalUsers = User::count();
        $totalTasks = ProjectTask::count();

        // 8. Bug density placeholder (proyek yang pernah di-reject QA / total modul)
        $qRejectedCount = Project::where('qa_status', 'REJECTED')->count();
        $bugDensity = $totalProjects > 0 ? round($qRejectedCount / max($totalProjects, 1), 2) : 0;

        return response()->json([
            'status' => 'success',
            'data'   => [
                'status_distribution' => $statusDistribution,
                'avg_cycle_time'      => ['value' => $avgCycleTime, 'change' => 0],
                'success_rate'        => ['value' => $successRate, 'change' => 0],
                'bug_density'         => ['value' => $bugDensity, 'change' => 0],
                'velocity'            => ['value' => $liveProjects->count(), 'change' => 0],
                'release_trend'       => $releaseTrend,
                'developer_workloads' => $workloads,
                'role_distribution'   => $roleDistribution,
                'total_projects'      => $totalProjects,
                'total_users'         => $totalUsers,
                'total_tasks'         => $totalTasks,
            ],
        ]);
    }
}
