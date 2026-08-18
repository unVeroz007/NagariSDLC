<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /**
     * Daftar seluruh log aktivitas dengan filter & pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::with('user:id,name')
            ->orderBy('created_at', 'desc');

        // Filter by user
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        // Filter by action
        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        // Filter by project (metadata.project_id disimpan sebagai array di kolom metadata)
        if ($request->filled('project_id')) {
            $query->where(function ($q) use ($request) {
                $q->whereJsonContains('metadata->project_id', (int) $request->project_id)
                  ->orWhere('metadata->project_id', $request->project_id)
                  ->orWhereRaw("json_extract(metadata, '$.project_id') = ?", [(int) $request->project_id]);
            });
        }

        // Filter by task (subject = ProjectTask dengan id tsb)
        if ($request->filled('task_id')) {
            $query->where('subject_type', \App\Models\ProjectTask::class)
                  ->where('subject_id', (int) $request->task_id);
        }

        // Filter by search term
        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('action_label', 'LIKE', "%{$term}%")
                  ->orWhere('description', 'LIKE', "%{$term}%")
                  ->orWhereHas('user', function ($uq) use ($term) {
                      $uq->where('name', 'LIKE', "%{$term}%");
                  });
            });
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Pagination (default 20 per page)
        $perPage = min($request->get('per_page', 20), 100);
        $logs = $query->paginate($perPage);

        // Format response
        $data = $logs->getCollection()->map(function ($log) {
            return [
                'id'           => $log->id,
                'user'         => $log->user?->name ?? 'System',
                'user_id'      => $log->user_id,
                'action'       => $log->action,
                'actionLabel'  => $log->action_label,
                'description'  => $log->description,
                'role'         => $log->metadata['user_role'] ?? null,
                'project'      => $log->metadata['project_name'] ?? null,
                'status'       => $log->status,
                'ip_address'   => $log->ip_address,
                'metadata'     => $log->metadata,
                'timestamp'    => $log->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => $data,
            'meta'   => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
            ],
        ]);
    }

    /**
     * Ringkasan statistik activity log.
     */
    public function summary(): JsonResponse
    {
        $today = now()->startOfDay();
        $thisWeek = now()->startOfWeek();

        $totalToday = ActivityLog::where('created_at', '>=', $today)->count();
        $totalThisWeek = ActivityLog::where('created_at', '>=', $thisWeek)->count();
        $totalAll = ActivityLog::count();

        // Unique active users today
        $activeUsersToday = ActivityLog::where('created_at', '>=', $today)
            ->distinct('user_id')
            ->count('user_id');

        // Top actions today
        $topActions = ActivityLog::where('created_at', '>=', $today)
            ->selectRaw('action_label, count(*) as count')
            ->groupBy('action_label')
            ->orderByDesc('count')
            ->limit(5)
            ->get();

        return response()->json([
            'status' => 'success',
            'data'   => [
                'total_today'       => $totalToday,
                'total_this_week'   => $totalThisWeek,
                'total_all'         => $totalAll,
                'active_users_today' => $activeUsersToday,
                'top_actions_today' => $topActions,
            ],
        ]);
    }
}
