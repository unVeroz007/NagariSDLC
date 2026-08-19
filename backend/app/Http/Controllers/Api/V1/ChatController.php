<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    /**
     * Ambil pesan chat untuk satu proyek (terbaru ke bawah, paginated).
     * User harus memiliki akses ke proyek (anggota tim / PM / analyst / pemohon / admin).
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = Project::findOrFail($projectId);
        $user = $request->user();

        if (! $this->canAccessProject($user, $project)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki akses ke proyek ini.',
            ], 403);
        }

        $messages = ChatMessage::with('user:id,name')
            ->where('project_id', $projectId)
            ->orderByDesc('created_at')
            ->paginate(50);

        $data = $messages->getCollection()->reverse()->values()->map(function ($m) {
            return [
                'id'        => $m->id,
                'message'   => $m->message,
                'type'      => $m->type,
                'userId'    => $m->user_id,
                'name'      => $m->user?->name ?? 'Sistem SDLC',
                'timestamp' => $m->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => $data,
            'meta'   => [
                'current_page' => $messages->currentPage(),
                'last_page'    => $messages->lastPage(),
                'total'        => $messages->total(),
            ],
        ]);
    }

    /**
     * Kirim pesan baru untuk satu proyek.
     */
    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = Project::findOrFail($projectId);
        $user = $request->user();

        if (! $this->canAccessProject($user, $project)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki akses ke proyek ini.',
            ], 403);
        }

        $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'type'    => ['nullable', 'string', 'in:text,system'],
        ]);

        $message = ChatMessage::create([
            'project_id' => $projectId,
            'user_id'    => $user->id,
            'message'    => trim($request->message),
            'type'       => $request->type ?? 'text',
            'created_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Pesan berhasil dikirim.',
            'data' => [
                'id'        => $message->id,
                'message'   => $message->message,
                'type'      => $message->type,
                'userId'    => $message->user_id,
                'name'      => $user->name,
                'timestamp' => $message->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    private function canAccessProject($user, Project $project): bool
    {
        $roleName = $user->role?->name;

        // Admin/Head of IT/Lead Group/Dev Lead: akses penuh
        if (in_array($roleName, ['super_admin', 'head_of_it', 'lead_group', 'development_lead'])) {
            return true;
        }

        // Pemohon proyek
        if ((int) $project->created_by === (int) $user->id) {
            return true;
        }

        // PM / Analyst proyek
        if ((int) $project->pm_id === (int) $user->id || (int) $project->analyst_id === (int) $user->id) {
            return true;
        }

        // Anggota tim proyek
        if ($project->teamMembers()->where('user_id', $user->id)->exists()) {
            return true;
        }

        // QA / Cyber yang terlibat
        if (in_array($roleName, ['qa_lead', 'qa_tester', 'cyber_lead', 'pentester'])) {
            return true;
        }

        return false;
    }
}
