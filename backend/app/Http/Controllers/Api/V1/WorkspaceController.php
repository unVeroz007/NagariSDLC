<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\ProjectTaskResource;
use App\Models\Project;
use App\Models\ProjectTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceController extends Controller
{
    /**
     * Mengambil item kerja spesifik sesuai role yang sedang login.
     */
    public function show(Request $request, string $role): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing('role');

        $userRole = $user->role?->name;

        if ($userRole !== $role && $userRole !== 'super_admin') {
            // Lead Group juga Lead QA — boleh akses workspace qa, cyber, analyst
            $isLeadGroupOverride = $userRole === 'lead_group' && in_array($role, ['qa', 'qa_lead', 'qa_tester', 'cyber', 'cyber_lead', 'pentester', 'analyst']);
            if (! $isLeadGroupOverride) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Role workspace tidak sesuai dengan role Anda.',
                ], 403);
            }
        }

        // Mendapatkan proyek yang relevan berdasarkan role
        $query = Project::with(['creator', 'pm', 'analyst', 'division']);

        switch ($role) {
            case 'lead_group':
                $query->whereIn('status', [ProjectStatus::IN_REVIEW->value, ProjectStatus::ANALYSIS_APPROVED->value]);
                break;

            case 'analyst':
                $query->whereIn('status', [ProjectStatus::IN_REVIEW->value, ProjectStatus::DEV_ANALYSIS->value]);
                break;

            case 'development_lead':
                $query->whereIn('status', [ProjectStatus::READY_FOR_DEVELOPMENT->value, ProjectStatus::DEV_ANALYSIS_DONE->value]);
                break;

            case 'project_manager':
                $query->where('pm_id', $user->id)
                      ->orWhereIn('status', [ProjectStatus::DEV_ANALYSIS_DONE->value, ProjectStatus::IN_DEVELOPMENT->value, ProjectStatus::RETURN_TO_DEV->value]);
                break;

            case 'developer':
                // Developer melihat task yang diassign padanya
                $myTasks = ProjectTask::with(['project', 'assignee'])
                    ->where('assignee_id', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->get();

                return response()->json([
                    'status' => 'success',
                    'role' => $role,
                    'data' => [
                        'assigned_tasks' => ProjectTaskResource::collection($myTasks),
                    ],
                ]);

            case 'qa':
                $query->whereIn('status', [ProjectStatus::READY_FOR_QA->value, ProjectStatus::QA_IN_PROGRESS->value]);
                break;

            case 'cyber':
                $query->whereIn('status', [ProjectStatus::QA_PASSED->value, ProjectStatus::CYBER_IN_PROGRESS->value]);
                break;

            case 'qa_lead':
            case 'lead_group':
                $query->whereIn('status', [ProjectStatus::READY_FOR_QA->value, ProjectStatus::QA_IN_PROGRESS->value]);
                break;

            case 'qa_tester':
                $query->whereIn('status', [ProjectStatus::QA_IN_PROGRESS->value]);
                break;

            case 'cyber_lead':
                $query->whereIn('status', [ProjectStatus::QA_PASSED->value, ProjectStatus::CYBER_IN_PROGRESS->value]);
                break;

            case 'pentester':
                $query->whereIn('status', [ProjectStatus::CYBER_IN_PROGRESS->value]);
                break;

            case 'business_user':
                $query->whereIn('status', [ProjectStatus::READY_FOR_UAT->value, ProjectStatus::UAT_PASSED->value]);
                break;

            default:
                break;
        }

        $projects = $query->orderBy('updated_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'role' => $role,
            'data' => [
                'projects' => ProjectResource::collection($projects),
            ],
        ]);
    }
}
