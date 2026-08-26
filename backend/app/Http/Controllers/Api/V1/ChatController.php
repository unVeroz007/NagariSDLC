<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\StoreChatMessageRequest;
use App\Models\ChatMessage;
use App\Models\Project;
use App\Models\User;
use App\Services\ProjectAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function __construct(
        protected ProjectAccessService $accessService
    ) {}

    /**
     * Ambil pesan chat untuk satu proyek (terbaru ke bawah, paginated).
     * User harus memiliki akses baca ke proyek tersebut.
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
    public function store(StoreChatMessageRequest $request, int $projectId): JsonResponse
    {
        $project = Project::findOrFail($projectId);
        $user = $request->user();

        if (! $this->canAccessProject($user, $project)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki akses ke proyek ini.',
            ], 403);
        }

        $message = ChatMessage::create([
            'project_id' => $projectId,
            'user_id'    => $user->id,
            'message'    => trim($request->input('message')),
            // Tipe ditetapkan server. Lihat StoreChatMessageRequest: pesan bertipe
            // `system` tidak boleh berasal dari klien.
            'type'       => 'text',
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

    /**
     * Hak baca ruang diskusi satu proyek.
     *
     * Diturunkan dari `ProjectAccessService::canView()` — sumber kebenaran yang sama
     * dengan daftar proyek, `show()`, dan daftar dokumen. Sebelumnya controller ini
     * menulis aturannya sendiri, dan aturan itu jauh lebih longgar: setiap akun jalur
     * pengujian (QA maupun Siber) lolos tanpa syarat, sehingga seorang QA Tester dapat
     * membaca seluruh percakapan proyek yang belum pernah masuk fase pengujian —
     * termasuk pengajuan Fase 1 yang masih dalam kajian Kadiv. Sebaliknya developer
     * penerima task yang belum tercatat sebagai anggota tim justru tertutup.
     *
     * Berdiskusi pada proyek yang tidak boleh dibuka tidak punya arti, jadi tidak ada
     * alasan mempertahankan definisi akses kedua yang dapat menyimpang dari yang pertama.
     */
    private function canAccessProject(User $user, Project $project): bool
    {
        $user->loadMissing('role');

        return $this->accessService->canView($user, $project);
    }
}
