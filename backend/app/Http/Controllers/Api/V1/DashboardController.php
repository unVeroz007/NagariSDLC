<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        $totalProjects = Project::count();
        $pendingProjects = Project::where('status', ProjectStatus::PENDING->value)->count();
        $inDevelopment = Project::where('status', ProjectStatus::IN_DEVELOPMENT->value)->count();
        $inQa = Project::where('status', ProjectStatus::QA_IN_PROGRESS->value)->count();
        $liveProduction = Project::where('status', ProjectStatus::LIVE_PRODUCTION->value)->count();

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
}
