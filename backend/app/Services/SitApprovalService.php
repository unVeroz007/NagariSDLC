<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectStatusHistory;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Aturan bersama persetujuan SIT (Tahap 3).
 *
 * Berbeda dengan persetujuan UAT yang memiliki tabel `uat_approvers`, persetujuan
 * SIT disimpan sebagai JSON pada `projects.sit_uat_data['sit3_approvals']`. Karena
 * itu tidak ada baris yang bisa dikueri langsung sebagai "tugas approval saya".
 * Service ini menyatukan dua hal yang sebelumnya tersebar:
 *
 *   1. Pemetaan role akun ke slot approval SIT — dipakai `ProjectController@sitApproval`
 *      saat menerima keputusan dan dipakai inbox saat menyusun daftar.
 *   2. Penyusunan inbox lintas proyek untuk endpoint `GET /me/sit-approvals`, supaya
 *      halaman "Persetujuan Saya" tidak perlu menyaring sendiri seluruh daftar proyek
 *      di sisi klien.
 *
 * Keputusan approval tetap ditulis oleh `ProjectController@sitApproval`; service ini
 * hanya membaca.
 */
class SitApprovalService
{
    /**
     * Status proyek yang membuka persetujuan SIT.
     *
     * Nilai yang sama dipakai gerbang penerimaan keputusan di
     * `ProjectController@sitApproval`, sehingga daftar inbox tidak pernah memuat
     * proyek yang keputusannya akan ditolak.
     */
    public const APPROVABLE_STATUSES = [
        ProjectStatus::SIT_IN_PROGRESS->value,
        ProjectStatus::SIT_REVISION->value,
    ];

    /** Label slot approval SIT untuk tampilan. */
    private const ROLE_LABELS = [
        'developer' => 'Developer',
        'pm' => 'Analyst / Project Manager',
        'development_lead' => 'Pimpinan Grup Pengembangan',
    ];

    /**
     * Tahap wizard SIT paling awal yang sudah membuka formulir persetujuan.
     *
     * Sebelum Tahap 3, eksekusi pengujian belum difinalkan dan tidak ada yang bisa
     * ditandatangani. Nilai ini dipakai inbox maupun gerbang penerimaan keputusan.
     */
    public const MINIMUM_DECISION_STEP = 3;

    public function __construct(private readonly ProjectAccessService $accessService) {}

    /**
     * Slot approval SIT untuk sebuah role akun, atau null bila role tersebut tidak
     * berhak menyetujui SIT.
     */
    public function roleKeyFor(?string $roleName): ?string
    {
        return match ($roleName) {
            'developer' => 'developer',
            'dev_analyst', 'project_manager' => 'pm',
            'development_lead' => 'development_lead',
            default => null,
        };
    }

    /**
     * Apakah formulir persetujuan SIT proyek ini sudah terbuka?
     *
     * Dipakai bersama oleh inbox dan gerbang keputusan. Sebelumnya hanya inbox yang
     * memeriksanya, sehingga keputusan SIT dapat dititipkan lewat
     * `POST /projects/{id}/sit-approval` untuk proyek yang eksekusi pengujiannya belum
     * difinalkan — tanda tangan yang bahkan tidak muncul di halaman "Persetujuan Saya"
     * milik penandatangannya sendiri.
     */
    public function isDecisionStageOpen(Project $project): bool
    {
        return (int) (((array) $project->sit_uat_data)['activeSitStep'] ?? 1) >= self::MINIMUM_DECISION_STEP;
    }

    /**
     * Apakah pengguna berada dalam cakupan slot approval SIT proyek ini?
     *
     * Satu definisi untuk dua pemakai: penyusun inbox di service ini dan gerbang
     * penerimaan keputusan di `ProjectController@sitApproval`. Selama keduanya
     * memutuskan sendiri-sendiri, daftar pekerjaan dan yang benar-benar diterima server
     * pasti menyimpang — dan penyimpangan itulah cacat sebenarnya.
     *
     * Catatan untuk slot `development_lead`: skema memang TIDAK memiliki kolom penugasan
     * per proyek untuk role ini. `projects` tidak punya `dev_lead_id`;
     * `project_team_members.role_in_project` adalah teks bebas yang hanya pernah diisi
     * 'Developer'/skill, dan `assigned_by` menyimpan 'lead'/'pm' — bukan identitas orang.
     * Penyaringan per divisi juga sengaja tidak dipakai: `projects.division_id` adalah
     * divisi PEMINTA (`ProjectController@store` mengisinya dari divisi pengaju), sedangkan
     * Pimpinan Grup Pengembangan berada di IT-DEV, sehingga aturan divisi akan menolak
     * hampir semua persetujuan yang sah. Penautan yang benar-benar ada di data adalah
     * jejak disposisinya sendiri — lihat `projectDevelopmentLeadIds()`.
     *
     * @param  list<int>  $requiredDeveloperIds
     */
    public function isInScope(Project $project, User $user, string $roleKey, array $requiredDeveloperIds): bool
    {
        if (! $this->accessService->canView($user, $project)) {
            return false;
        }

        return match ($roleKey) {
            'developer' => in_array((int) $user->id, $requiredDeveloperIds, true),
            'pm' => (int) $project->pm_id === (int) $user->id,
            'development_lead' => $this->isProjectDevelopmentLead($project, $user),
            default => false,
        };
    }

    /**
     * Apakah pengguna ini adalah Pimpinan Grup Pengembangan proyek ini?
     *
     * Penautan diambil dari `project_status_histories`: transisi ke `DEV_ANALYSIS` hanya
     * dapat dilakukan `development_lead` atau `super_admin`
     * (`ProjectWorkflowService::$rolePermissions`), jadi dev lead yang pernah
     * mendisposisikan proyek ini tercatat di sana dengan namanya sendiri. Itulah satu-satunya
     * bukti per proyek yang benar-benar dimiliki data, dan memakainya tidak memerlukan
     * tabel maupun kolom baru.
     *
     * Bila proyek tidak memiliki satu pun jejak disposisi dev lead — baris lama hasil
     * seeder, atau proyek yang dipindahkan Super Admin — tidak ada orang yang dapat
     * diistimewakan. Untuk keadaan itu cakupan berbasis fase (`canView()`) berlaku apa
     * adanya, supaya proyek tidak pernah terjebak tanpa satu pun penandatangan yang sah.
     */
    private function isProjectDevelopmentLead(Project $project, User $user): bool
    {
        if ((int) $project->pm_id === (int) $user->id || (int) $project->created_by === (int) $user->id) {
            return true;
        }

        $leadIds = $this->projectDevelopmentLeadIds($project);

        return $leadIds === [] || in_array((int) $user->id, $leadIds, true);
    }

    /**
     * Id dev lead yang pernah mendisposisikan proyek ini pada riwayat statusnya.
     *
     * @return list<int>
     */
    public function projectDevelopmentLeadIds(Project $project): array
    {
        return ProjectStatusHistory::query()
            ->where('project_id', $project->id)
            ->whereHas(
                'changedBy.role',
                fn (Builder $role): Builder => $role->where('name', UserRole::DEVELOPMENT_LEAD->value)
            )
            ->pluck('changed_by')
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Inbox persetujuan SIT milik satu pengguna.
     *
     * Bentuk keluarannya disengaja mengikuti `UatApprovalService::myInternalAssignments()`
     * agar satu komponen kartu di frontend dapat menampilkan kedua jenis approval.
     *
     * @return array{pending_count: int, items: list<array<string, mixed>>}
     */
    public function myAssignments(User $user): array
    {
        $user->loadMissing('role');
        $roleKey = $this->roleKeyFor($user->role?->name);

        if (! $roleKey) {
            return ['pending_count' => 0, 'items' => []];
        }

        $projects = $this->accessService
            ->applyVisibilityScope(
                Project::query()
                    ->with(['division', 'teamMembers.user.role', 'tasks'])
                    ->whereIn('status', self::APPROVABLE_STATUSES),
                $user
            )
            ->orderByDesc('updated_at')
            ->get();

        $items = $projects
            ->map(fn (Project $project): ?array => $this->assignmentFor($project, $user, $roleKey))
            ->filter()
            ->values();

        // Yang belum diputuskan didahulukan agar pekerjaan yang tersisa terlihat lebih
        // dahulu tanpa pengguna harus mengganti filter.
        $items = $items
            ->sortBy(fn (array $item): int => $item['status'] === 'pending' ? 0 : 1)
            ->values();

        return [
            'pending_count' => $items->where('status', 'pending')->count(),
            'items' => $items->all(),
        ];
    }

    /**
     * Satu baris inbox, atau null bila pengguna bukan penyetuju SIT pada proyek ini.
     *
     * @return array<string, mixed>|null
     */
    private function assignmentFor(Project $project, User $user, string $roleKey): ?array
    {
        $data = (array) $project->sit_uat_data;

        // Sebelum Tahap 3, eksekusi SIT belum difinalkan dan formulir persetujuan
        // belum terbuka. Menampilkannya di inbox hanya akan mengarahkan pengguna ke
        // halaman yang belum bisa ia kerjakan.
        if (! $this->isDecisionStageOpen($project)) {
            return null;
        }

        $approvals = (array) ($data['sit3_approvals'] ?? []);
        $requiredDeveloperIds = $project->sitApprovalDeveloperIds();

        if (! $this->isInScope($project, $user, $roleKey, $requiredDeveloperIds)) {
            return null;
        }

        if ($roleKey === 'developer') {
            $ownDecision = collect((array) ($approvals['developer']['developers'] ?? []))
                ->first(fn ($row): bool => (int) (($row['userId'] ?? $row['approvedById'] ?? 0)) === (int) $user->id);
        } elseif ($roleKey === 'pm') {
            $ownDecision = ($approvals['pm']['approved'] ?? false) === true ? $approvals['pm'] : null;
        } else {
            $ownDecision = ($approvals['development_lead']['approved'] ?? false) === true
                ? $approvals['development_lead']
                : null;
        }

        return [
            // Tidak ada baris tabel untuk approval SIT, jadi kuncinya disusun dari
            // proyek dan slot supaya tetap stabil sebagai `key` daftar di frontend.
            'id' => "sit-{$project->id}-{$roleKey}",
            'kind' => 'sit',
            'status' => $ownDecision ? 'approved' : 'pending',
            'approval_role' => $roleKey,
            'approval_role_label' => self::ROLE_LABELS[$roleKey],
            // Penolakan SIT tidak dilakukan lewat formulir persetujuan; temuan dicatat
            // per task pada Tahap 2 lalu proyek dipindahkan ke `SIT_REVISION`.
            'can_reject' => false,
            'position' => self::ROLE_LABELS[$roleKey],
            'decision_note' => $ownDecision['note'] ?? null,
            'decided_at' => $ownDecision['at'] ?? null,
            'project' => [
                'id' => $project->id,
                'req_id' => $project->req_id,
                'title' => $project->title,
                'description' => $project->description,
                'status' => $project->status instanceof ProjectStatus
                    ? $project->status->value
                    : (string) $project->status,
                'division' => $project->division?->name,
                'sit_date' => $data['sit2_submitted_at'] ?? null,
            ],
            'summary' => $this->summaryFor($project, $data, $approvals, $requiredDeveloperIds),
        ];
    }

    /**
     * Ringkasan progres SIT untuk kartu inbox.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $approvals
     * @param  list<int>  $requiredDeveloperIds
     * @return array<string, mixed>
     */
    private function summaryFor(Project $project, array $data, array $approvals, array $requiredDeveloperIds): array
    {
        $scopeTasks = $project->sitScopeTasks();
        $taskApprovals = (array) ($data['sit2_task_approvals'] ?? []);

        $approvedTaskCount = $scopeTasks
            ->filter(fn ($task): bool => (self::taskApproval($taskApprovals, $task->id)['approved'] ?? false) === true)
            ->count();
        $defectTaskCount = $scopeTasks
            ->filter(fn ($task): bool => filled(self::taskApproval($taskApprovals, $task->id)['comment'] ?? null))
            ->count();

        $approvedDeveloperIds = collect((array) ($approvals['developer']['developers'] ?? []))
            ->map(fn ($row): int => (int) (($row['userId'] ?? $row['approvedById'] ?? 0)))
            ->filter()
            ->unique();

        return [
            'totalTask' => $scopeTasks->count(),
            'approvedTask' => $approvedTaskCount,
            'defectTask' => $defectTaskCount,
            // `isSitRetestCycle()` hanya menyatakan bahwa SIT ini milik siklus revisi,
            // bukan bahwa scope-nya sempit. Sejak revisi Mayor menguji ulang seluruh
            // task, mode sempit hanya tersisa pada baris produksi lama yang masih
            // menyimpan `sit_retest_scope.mode = 'targeted'`.
            'scopeMode' => $project->isSitRetestCycle()
                && (($data['sit_retest_scope']['mode'] ?? 'full') === 'targeted')
                    ? 'targeted_retest'
                    : 'full',
            'developerApproved' => collect($requiredDeveloperIds)->intersect($approvedDeveloperIds)->count(),
            'developerRequired' => count($requiredDeveloperIds),
            'pmApproved' => ($approvals['pm']['approved'] ?? false) === true,
            'developmentLeadApproved' => ($approvals['development_lead']['approved'] ?? false) === true,
        ];
    }

    /**
     * Ambil satu baris `sit2_task_approvals` tanpa bergantung pada bentuk kuncinya.
     *
     * Kuncinya bisa berupa integer, string angka, atau berawalan `task_` — tiga bentuk
     * yang sama-sama sudah tersimpan di produksi dan juga ditangani gerbang SIT ulang
     * di `ProjectWorkflowService`.
     *
     * @param  array<array-key, mixed>  $taskApprovals
     * @return array<string, mixed>
     */
    private static function taskApproval(array $taskApprovals, int|string $taskId): array
    {
        $approval = $taskApprovals[$taskId]
            ?? $taskApprovals[(string) $taskId]
            ?? $taskApprovals['task_'.$taskId]
            ?? null;

        return is_array($approval) ? $approval : [];
    }
}
