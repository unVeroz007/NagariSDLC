<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Enums\TrackStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\ChatMessage;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\ProjectStatusHistory;
use App\Models\ProjectTask;
use App\Models\ProjectTeamMember;
use App\Models\ReleaseRequest;
use App\Models\TestReport;
use App\Models\UatApprovalRound;
use App\Models\UatApprover;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    use LogsActivity;

    public function index(): JsonResponse
    {
        $users = User::with(['role', 'division'])->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => UserResource::collection($users),
        ]);
    }

    /**
     * Beban aktif lintas-fase tiap analis/pelaksana, dihitung server-side.
     *
     * Dropdown disposisi QA dan Audit Keamanan Siber menampilkan beban tiap orang agar
     * Lead dapat membagi pekerjaan secara merata. Beban itu tidak dapat dihitung di sisi
     * Lead: `ProjectAccessService::applyVisibilityScope()` membatasi daftar proyek
     * `qa_lead`/`cyber_lead` pada fase pengujian saja, sehingga proyek Fase 1 (analisis
     * perencanaan) yang dipegang orang yang sama tidak pernah sampai ke browser Lead dan
     * bebannya selalu terbaca nol.
     *
     * Karena satu orang merangkap analisis perencanaan (Fase 1) dan pengujian QA (Fase 3)
     * — lihat `UserRole::PLANNING_QA_ANALYST_ROLES` — angka yang berguna adalah TOTAL
     * proyek aktif yang ia pegang lintas fase, bukan satu jalur saja. Endpoint ini
     * menghitung gabungan itu dari SELURUH proyek, lepas dari scope pemanggil, lalu
     * memaparkan hanya jumlah agregat per pengguna — bukan detail proyeknya — sehingga
     * tidak membocorkan portofolio yang tak boleh dilihat Lead.
     *
     * Definisi "beban" mengikuti persis aturan yang dipakai layar QA & Siber, agar angka
     * di dropdown identik dengan yang akan dihitung klien seandainya datanya tersedia:
     *
     *   - Fase 1 aktif : `analyst_id` = pengguna DAN status proyek `IN_REVIEW` (satu-
     *     satunya status "sedang dianalisis"; setelahnya proyek pindah ke
     *     ANALYSIS_APPROVED/REJECTED dan bukan lagi beban analis);
     *   - Jalur QA aktif: `qa_assignee_id` = pengguna DAN `qa_status` belum PASSED/REVIEW
     *     (REVIEW berarti laporan sudah naik dan bola ada di tangan Lead, bukan lagi
     *     beban aktif pelaksana);
     *   - Jalur Siber aktif: `cyber_assignee_id` = pengguna DAN `cyber_status` belum
     *     PASSED/REVIEW (aturan sama dengan jalur QA).
     *
     * Proyek terminal (LIVE_PRODUCTION/CANCELLED/REJECTED) dikecualikan. Satu proyek
     * dihitung sekali per orang meski ia memegang lebih dari satu peran di dalamnya
     * (mis. analis sekaligus penerima disposisi QA), sesuai definisi "beban = jumlah
     * proyek aktif" yang dipakai layar.
     *
     * Hanya pengguna yang bebannya lebih dari nol yang dikembalikan; sisanya dianggap 0
     * oleh pemanggil. Bentuk data: `[{ id, name, active_load }]`.
     */
    public function workload(): JsonResponse
    {
        $terminalStatuses = array_map(
            static fn (ProjectStatus $status): string => $status->value,
            [ProjectStatus::LIVE_PRODUCTION, ProjectStatus::CANCELLED, ProjectStatus::REJECTED],
        );

        // Status jalur yang berarti pekerjaan pelaksana sudah selesai — tidak dihitung
        // sebagai beban aktif.
        $settledTrackStatuses = [TrackStatus::PASSED->value, TrackStatus::REVIEW->value];

        $projects = Project::query()
            ->whereNotIn('status', $terminalStatuses)
            ->where(function ($query): void {
                $query->whereNotNull('analyst_id')
                    ->orWhereNotNull('qa_assignee_id')
                    ->orWhereNotNull('cyber_assignee_id');
            })
            ->get(['id', 'status', 'analyst_id', 'qa_assignee_id', 'qa_status', 'cyber_assignee_id', 'cyber_status']);

        // user id => himpunan id proyek aktif miliknya (dedupe lintas peran).
        /** @var array<int, array<int, true>> $projectsByUser */
        $projectsByUser = [];
        $attach = static function (?int $userId, int $projectId) use (&$projectsByUser): void {
            if ($userId === null) {
                return;
            }
            $projectsByUser[$userId][$projectId] = true;
        };

        foreach ($projects as $project) {
            $status = $project->status instanceof ProjectStatus
                ? $project->status->value
                : (string) $project->status;

            if ($status === ProjectStatus::IN_REVIEW->value) {
                $attach($project->analyst_id, $project->id);
            }

            if ($project->qa_assignee_id !== null
                && ! in_array(TrackStatus::normalize($project->qa_status)->value, $settledTrackStatuses, true)) {
                $attach($project->qa_assignee_id, $project->id);
            }

            if ($project->cyber_assignee_id !== null
                && ! in_array(TrackStatus::normalize($project->cyber_status)->value, $settledTrackStatuses, true)) {
                $attach($project->cyber_assignee_id, $project->id);
            }
        }

        $loadByUser = collect($projectsByUser)->map(static fn (array $set): int => count($set));

        $data = User::whereIn('id', $loadByUser->keys())
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(static fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'active_load' => $loadByUser[$user->id] ?? 0,
            ])
            ->values();

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role_id' => $data['role_id'],
            'division_id' => $data['division_id'] ?? null,
            'phone_number' => $data['phone_number'] ?? null,
            'is_active' => true,
        ]);

        $user->load(['role', 'division']);

        $this->logActivity(
            'create_user',
            'Membuat Pengguna Baru',
            "Pengguna \"{$user->name}\" ({$user->email}) berhasil dibuat dengan role {$user->role?->display_name}.",
            $user
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Pengguna berhasil dibuat.',
            'data' => new UserResource($user),
        ], 201);
    }

    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $oldRole = $user->role?->display_name;

        // Hanya field yang lolos validasi yang disimpan. Bentuk sebelumnya memakai
        // `$request->except('password')`, sehingga seluruh isi request diteruskan ke
        // `User::update()` dan penyaring terakhirnya hanya daftar `$fillable` pada
        // model — field yang tidak pernah divalidasi ikut tersimpan begitu daftar itu
        // bertambah.
        $data = $request->validated();
        if (array_key_exists('password', $data)) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);
        $user->load(['role', 'division']);

        $this->logActivity(
            'update_user',
            'Memperbarui Pengguna',
            "Data pengguna \"{$user->name}\" berhasil diperbarui.",
            $user,
            ['old_role' => $oldRole, 'new_role' => $user->role?->display_name]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Data pengguna berhasil diperbarui.',
            'data' => new UserResource($user),
        ]);
    }

    /**
     * Hapus pengguna (penghapusan lunak), setelah dipastikan tidak memutus jejak audit.
     *
     * `User` memakai `SoftDeletes`, jadi baris pengguna hanya ditandai terhapus dan
     * setiap catatan yang menunjuk padanya tetap bisa menampilkan nama pelakunya.
     * Meski begitu penghapusan tetap ditolak bila pengguna masih membawa jejak tata
     * kelola, karena:
     *
     *   1. Enam kunci asing ke `users` bersifat `RESTRICT` (`projects.created_by`,
     *      `project_status_histories.changed_by`, `project_team_members.user_id`,
     *      `test_reports.tester_id`, `document_vaults.uploaded_by`,
     *      `release_requests.requested_by`). Penghapusan permanen di kemudian hari akan
     *      ditolak database; pemeriksaan di sini memberi alasannya dalam bahasa manusia
     *      sebelum hal itu terjadi.
     *   2. Kunci asing penugasan bersifat `SET NULL` (`pm_id`, `analyst_id`,
     *      `qa_assignee_id`, `cyber_assignee_id`, `project_tasks.assignee_id`, dan
     *      seterusnya). Penghapusan permanen tidak akan gagal, tetapi atribusinya hilang
     *      diam-diam — proyek berjalan kehilangan PM-nya tanpa jejak.
     *
     * Untuk mencabut akses pengguna yang sudah memiliki jejak, gunakan penonaktifkan
     * akun (`is_active = false`) lewat `PUT /users/{id}`: aksesnya hilang seketika,
     * seluruh atribusinya tetap terbaca.
     *
     * `activity_logs` sengaja tidak dihitung sebagai penghalang. Setiap pengguna punya
     * catatan login, sehingga menjadikannya penghalang berarti tidak ada satu akun pun
     * yang bisa dihapus — termasuk akun yang salah dibuat dan belum pernah dipakai.
     * Kolomnya `SET NULL`, jadi catatannya tetap ada dengan pelaku "System".
     */
    public function destroy(int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        // Proteksi: tidak bisa hapus diri sendiri
        if (auth()->id() === $user->id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak dapat menghapus akun Anda sendiri.',
            ], 403);
        }

        $references = $this->auditTrailReferences($user);

        if ($references !== []) {
            $summary = collect($references)
                ->map(static fn (int $count, string $label): string => "{$count} {$label}")
                ->implode(', ');

            $this->logActivity(
                'delete_user',
                'Menghapus Pengguna',
                "Penghapusan pengguna \"{$user->name}\" ({$user->email}) ditolak karena masih memiliki jejak audit: {$summary}.",
                $user,
                ['audit_trail_references' => $references],
                'error'
            );

            return response()->json([
                'status' => 'error',
                'message' => "Pengguna \"{$user->name}\" tidak dapat dihapus karena masih terhubung dengan jejak audit: {$summary}. "
                    . 'Nonaktifkan akun ini agar aksesnya dicabut tanpa menghilangkan riwayat.',
                'data' => ['audit_trail_references' => $references],
            ], 422);
        }

        $name = $user->name;
        $email = $user->email;

        $user->delete();

        $this->logActivity(
            'delete_user',
            'Menghapus Pengguna',
            "Pengguna \"{$name}\" ({$email}) berhasil dihapus dari sistem."
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Pengguna berhasil dihapus.',
        ]);
    }

    /**
     * Jejak tata kelola yang masih menunjuk pengguna, beserta jumlahnya.
     *
     * Proyek dihitung dengan `withTrashed()` karena `Project` pun memakai penghapusan
     * lunak: barisnya masih menempati tabel dan kunci asing `RESTRICT` tetap berlaku
     * atasnya, sehingga proyek yang sudah dihapus lunak tetap menjadi penghalang.
     *
     * Label ditulis siap tampil agar pesan penolakan bisa menyebutkan alasannya secara
     * spesifik, bukan sekadar "pengguna masih dipakai".
     *
     * @return array<string, int>  label => jumlah, hanya yang jumlahnya lebih dari nol
     */
    private function auditTrailReferences(User $user): array
    {
        $userId = $user->id;

        $references = [
            'proyek yang diajukan' => Project::withTrashed()->where('created_by', $userId)->count(),
            'proyek yang dikelola sebagai PM' => Project::withTrashed()->where('pm_id', $userId)->count(),
            'proyek yang dianalisis' => Project::withTrashed()->where('analyst_id', $userId)->count(),
            'disposisi pengujian QA' => Project::withTrashed()->where('qa_assignee_id', $userId)->count(),
            'disposisi audit keamanan siber' => Project::withTrashed()->where('cyber_assignee_id', $userId)->count(),
            'keanggotaan tim proyek' => ProjectTeamMember::where('user_id', $userId)->count(),
            'task yang ditugaskan' => ProjectTask::where('assignee_id', $userId)->count(),
            'permintaan revisi task' => ProjectTask::where('revision_requested_by', $userId)->count(),
            'perubahan status proyek' => ProjectStatusHistory::where('changed_by', $userId)->count(),
            'laporan pengujian sebagai penguji' => TestReport::where('tester_id', $userId)->count(),
            'laporan pengujian sebagai peninjau' => TestReport::where('reviewed_by', $userId)->count(),
            'dokumen yang diunggah' => DocumentVault::where('uploaded_by', $userId)->count(),
            'pengajuan rilis' => ReleaseRequest::where('requested_by', $userId)->count(),
            'putaran approval UAT yang dibuka' => UatApprovalRound::where('opened_by', $userId)->count(),
            'penugasan approver UAT' => UatApprover::where('user_id', $userId)->count(),
            'pesan diskusi proyek' => ChatMessage::where('user_id', $userId)->count(),
        ];

        return array_filter($references, static fn (int $count): bool => $count > 0);
    }
}
