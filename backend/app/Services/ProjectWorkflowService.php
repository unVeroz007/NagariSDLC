<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Enums\TestingTrack;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\ProjectStatusHistory;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Broadcast;

class ProjectWorkflowService
{
    public function __construct(
        private readonly UatApprovalService $uatApprovalService,
        private readonly ProjectReturnRoundService $returnRoundService,
    ) {}

    /**
     * Matriks Transisi Status yang diperbolehkan (Maju & Mundur / Rollback).
     */
    protected array $allowedTransitions = [
        ProjectStatus::PENDING->value => [
            ProjectStatus::IN_REVIEW->value,
            ProjectStatus::REJECTED->value,
            ProjectStatus::CANCELLED->value,
        ],
        ProjectStatus::IN_REVIEW->value => [
            ProjectStatus::ANALYSIS_APPROVED->value,
            ProjectStatus::PENDING->value, // Mundur
            ProjectStatus::REJECTED->value,
        ],
        ProjectStatus::ANALYSIS_APPROVED->value => [
            ProjectStatus::READY_FOR_DEVELOPMENT->value,
            ProjectStatus::IN_REVIEW->value, // Mundur
            ProjectStatus::REJECTED->value,
        ],
        ProjectStatus::READY_FOR_DEVELOPMENT->value => [
            ProjectStatus::DEV_ANALYSIS->value,
            ProjectStatus::IN_DEVELOPMENT->value,
            ProjectStatus::ANALYSIS_APPROVED->value, // Mundur
        ],
        ProjectStatus::DEV_ANALYSIS->value => [
            ProjectStatus::DEV_ANALYSIS_DONE->value,
            ProjectStatus::READY_FOR_DEVELOPMENT->value, // Mundur
            ProjectStatus::REJECTED->value,
        ],
        ProjectStatus::DEV_ANALYSIS_DONE->value => [
            ProjectStatus::IN_DEVELOPMENT->value,
            ProjectStatus::DEV_ANALYSIS->value, // Mundur
        ],
        ProjectStatus::IN_DEVELOPMENT->value => [
            ProjectStatus::SIT_IN_PROGRESS->value,
            ProjectStatus::DEV_COMPLETED->value,
            // QA/Siber sengaja tak ada di sini: pengujian baru boleh mulai setelah semua
            // pengembangan (termasuk SIT & UAT Internal) selesai lewat DEV_COMPLETED.
            ProjectStatus::DEV_ANALYSIS_DONE->value, // Mundur
            ProjectStatus::ON_HOLD->value,
        ],
        ProjectStatus::SIT_IN_PROGRESS->value => [
            ProjectStatus::SIT_PASSED->value,
            ProjectStatus::SIT_REVISION->value,
            ProjectStatus::IN_DEVELOPMENT->value,
        ],
        ProjectStatus::SIT_PASSED->value => [
            ProjectStatus::UAT_IN_PROGRESS->value,
            ProjectStatus::DEV_COMPLETED->value,
            ProjectStatus::SIT_REVISION->value,
            ProjectStatus::IN_DEVELOPMENT->value,
        ],
        ProjectStatus::SIT_REVISION->value => [
            ProjectStatus::SIT_IN_PROGRESS->value,
            ProjectStatus::IN_DEVELOPMENT->value,
        ],
        ProjectStatus::UAT_IN_PROGRESS->value => [
            ProjectStatus::UAT_PASSED->value,
            ProjectStatus::DEV_COMPLETED->value,
            ProjectStatus::UAT_REVISION_SIT->value,
            ProjectStatus::UAT_REVISION_DEV->value,
        ],
        ProjectStatus::UAT_REVISION_SIT->value => [
            ProjectStatus::SIT_IN_PROGRESS->value,
            ProjectStatus::UAT_IN_PROGRESS->value,
        ],
        ProjectStatus::UAT_REVISION_DEV->value => [
            ProjectStatus::IN_DEVELOPMENT->value,
            ProjectStatus::SIT_IN_PROGRESS->value,
        ],
        ProjectStatus::DEV_COMPLETED->value => [
            ProjectStatus::READY_FOR_QA->value,
            ProjectStatus::QA_IN_PROGRESS->value,
            ProjectStatus::CYBER_IN_PROGRESS->value,
            ProjectStatus::IN_DEVELOPMENT->value,
        ],
        ProjectStatus::RETURN_TO_DEV->value => [
            ProjectStatus::IN_DEVELOPMENT->value,
            ProjectStatus::READY_FOR_DEVELOPMENT->value,
            ProjectStatus::READY_FOR_QA->value,
            ProjectStatus::QA_IN_PROGRESS->value, // Disposisi ulang QA tanpa lewat READY_FOR_QA
            ProjectStatus::CYBER_IN_PROGRESS->value,
        ],
        ProjectStatus::READY_FOR_QA->value => [
            ProjectStatus::QA_IN_PROGRESS->value,
            ProjectStatus::CYBER_IN_PROGRESS->value,
            ProjectStatus::DEV_COMPLETED->value,
            ProjectStatus::RETURN_TO_DEV->value, // Mundur (jalur Siber gagal lebih dulu)
            ProjectStatus::IN_DEVELOPMENT->value, // Mundur
        ],
        ProjectStatus::QA_IN_PROGRESS->value => [
            ProjectStatus::QA_PASSED->value,
            ProjectStatus::CYBER_IN_PROGRESS->value, // Paralel Cyber Audit
            ProjectStatus::CYBER_PASSED->value, // Sign-off Siber menyusul saat QA masih berjalan
            ProjectStatus::RETURN_TO_DEV->value, // Mundur (Defect QA)
            ProjectStatus::READY_FOR_QA->value,
        ],
        // QA_PASSED & CYBER_PASSED simetris (dua jalur paralel, sign-off mana pun duluan).
        // Syarat "kedua wajib lulus" dijaga `validateTransitionPrerequisites()`, bukan matriks.
        ProjectStatus::QA_PASSED->value => [
            ProjectStatus::CYBER_IN_PROGRESS->value,
            ProjectStatus::CYBER_PASSED->value,
            ProjectStatus::PENDING_GOLIVE->value, // Dua jalur lulus, PM ajukan go-live ke Infra
            ProjectStatus::RETURN_TO_DEV->value, // Mundur (Vulnerability Defect menyusul)
            ProjectStatus::QA_IN_PROGRESS->value, // Mundur
        ],
        ProjectStatus::CYBER_IN_PROGRESS->value => [
            ProjectStatus::CYBER_PASSED->value,
            ProjectStatus::QA_IN_PROGRESS->value, // Paralel QA Audit
            ProjectStatus::QA_PASSED->value,
            ProjectStatus::RETURN_TO_DEV->value, // Mundur (Vulnerability Defect)
        ],
        ProjectStatus::CYBER_PASSED->value => [
            ProjectStatus::PENDING_GOLIVE->value, // Dua jalur lulus, PM ajukan go-live ke Infra
            ProjectStatus::QA_IN_PROGRESS->value, // Paralel QA baru mulai
            ProjectStatus::QA_PASSED->value, // Sign-off QA menyusul
            ProjectStatus::RETURN_TO_DEV->value, // Mundur (Defect QA menyusul)
            ProjectStatus::CYBER_IN_PROGRESS->value, // Mundur
        ],
        // READY_FOR_UAT tanpa transisi: tak ada UAT final setelah QA & Siber (enum disimpan
        // agar histori lama terbaca). UAT_PASSED = keluaran opsional UAT internal, maju ke
        // DEV_COMPLETED; jalur ke PENDING_GOLIVE dihapus — go-live wajib lewat sign-off QA & Siber.
        ProjectStatus::UAT_PASSED->value => [
            ProjectStatus::DEV_COMPLETED->value,
            ProjectStatus::RETURN_TO_DEV->value, // Mundur
        ],
        ProjectStatus::PENDING_GOLIVE->value => [
            ProjectStatus::LIVE_PRODUCTION->value, // Quality Gate disetujui Head of IT
            ProjectStatus::QA_PASSED->value, // Mundur ke sign-off jalur QA
            ProjectStatus::CYBER_PASSED->value, // Mundur ke sign-off jalur Siber
            // Temuan terlambat QA/Siber saat sudah antre rilis (wewenang role jalur uji;
            // Head of IT yang menolak di Quality Gate pakai REJECTED, bukan ini).
            ProjectStatus::RETURN_TO_DEV->value,
            ProjectStatus::REJECTED->value, // Quality Gate ditolak Head of IT
        ],
        ProjectStatus::REJECTED->value => [
            ProjectStatus::PENDING->value, // Re-open
            ProjectStatus::IN_REVIEW->value,
        ],
        ProjectStatus::ON_HOLD->value => [
            ProjectStatus::IN_DEVELOPMENT->value,
            ProjectStatus::PENDING->value,
        ],
    ];

    /**
     * Matriks Otorisasi Role per Transisi.
     *
     * Fase 2: PM = Analis Pengembangan, jadi DEV_ANALYSIS_DONE wewenang `project_manager`
     * (bukan `analyst` Fase 1); alias `dev_analyst` ikut karena router/menu FE masih memakainya.
     * `analyst` & `qa_tester` = analis yang sama di dua fase (`PLANNING_QA_ANALYST_ROLES`),
     * jadi muncul berpasangan di Fase 1 & jalur QA; hapus salah satu, anggota grup lolos
     * gerbang penugasan tapi gagal menyimpan hasil kerjanya.
     */
    protected array $rolePermissions = [
        ProjectStatus::PENDING->value => [UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::IN_REVIEW->value => [UserRole::LEAD_GROUP->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::ANALYSIS_APPROVED->value => [UserRole::LEAD_GROUP->value, ...UserRole::PLANNING_QA_ANALYST_ROLES, UserRole::SUPER_ADMIN->value],
        ProjectStatus::REJECTED->value => [UserRole::LEAD_GROUP->value, ...UserRole::PLANNING_QA_ANALYST_ROLES, UserRole::HEAD_OF_IT->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::READY_FOR_DEVELOPMENT->value => [UserRole::LEAD_GROUP->value, UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::DEV_ANALYSIS->value => [UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::DEV_ANALYSIS_DONE->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::SUPER_ADMIN->value],
        ProjectStatus::IN_DEVELOPMENT->value => [UserRole::PROJECT_MANAGER->value, UserRole::DEVELOPER->value, UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::SIT_IN_PROGRESS->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::DEVELOPMENT_LEAD->value, UserRole::DEVELOPER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::SIT_PASSED->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::SIT_REVISION->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_IN_PROGRESS->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        // Kedua arah revisi UAT sengaja identik (dipicu eksekusi UAT: peminta menolak,
        // PM menindaklanjuti). `head_of_it` bukan aktor revisi UAT (perannya di Quality Gate).
        ProjectStatus::UAT_REVISION_SIT->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_REVISION_DEV->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::DEV_COMPLETED->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::DEVELOPMENT_LEAD->value, UserRole::DEVELOPER->value, UserRole::SUPER_ADMIN->value],
        // Pengembalian ke pengembangan = wewenang jalur pengujian. `lead_group` ikut karena
        // ia sudah bisa meluluskan QA (QA_PASSED); tanpa ini ia bisa meloloskan tapi tak bisa
        // mengembalikan — wewenang setengah yang berisiko.
        ProjectStatus::RETURN_TO_DEV->value => [UserRole::QA_LEAD->value, ...UserRole::PLANNING_QA_ANALYST_ROLES, UserRole::CYBER_LEAD->value, UserRole::PENTESTER->value, UserRole::LEAD_GROUP->value, UserRole::SUPER_ADMIN->value],
        // Pengajuan pengujian QA = wewenang PM (Analis Pengembangan); alias `dev_analyst` ikut.
        ProjectStatus::READY_FOR_QA->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::SUPER_ADMIN->value],
        ProjectStatus::QA_IN_PROGRESS->value => [UserRole::QA_LEAD->value, UserRole::LEAD_GROUP->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::QA_PASSED->value => [...UserRole::PLANNING_QA_ANALYST_ROLES, UserRole::QA_LEAD->value, UserRole::LEAD_GROUP->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::CYBER_IN_PROGRESS->value => [UserRole::CYBER_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::CYBER_PASSED->value => [UserRole::PENTESTER->value, UserRole::CYBER_LEAD->value, UserRole::SUPER_ADMIN->value],
        // READY_FOR_UAT tak punya transisi masuk, jadi tak perlu wewenang. Lihat $allowedTransitions.
        ProjectStatus::UAT_PASSED->value => [UserRole::BUSINESS_USER->value, UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::SUPER_ADMIN->value],
        // Pengajuan go-live ke Grup Infrastruktur = wewenang PM; alias `dev_analyst` ikut.
        ProjectStatus::PENDING_GOLIVE->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::SUPER_ADMIN->value],
        ProjectStatus::LIVE_PRODUCTION->value => [UserRole::HEAD_OF_IT->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::ON_HOLD->value => [UserRole::PROJECT_MANAGER->value, UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::CANCELLED->value => [UserRole::LEAD_GROUP->value, UserRole::HEAD_OF_IT->value, UserRole::SUPER_ADMIN->value],
    ];


    /**
     * Apakah BENTUK transisi ini dikenal matriks? Hanya cek bentuk — bukan wewenang role
     * atau prasyarat bisnis. Untuk pemanggil yang perubahan utamanya di tempat lain dan
     * pemindahan `projects.status` menyusul bila memungkinkan (kasus nyata: dua jalur
     * pengujian paralel, `qa_status`/`cyber_status` kebenaran jalurnya sedangkan
     * `projects.status` cuma penunjuk bergiliran — disposisi QA harus tetap berhasil saat
     * penunjuk dipegang Siber). Tanpa ini pemanggil hanya bisa memaksa transisi (gagal
     * total) atau menelan exception buta (sembunyikan kegagalan wewenang asli).
     */
    public function canTransition(Project $project, ProjectStatus $targetStatus): bool
    {
        $currentStatus = $project->status instanceof ProjectStatus
            ? $project->status->value
            : (string) $project->status;

        if ($currentStatus === $targetStatus->value) {
            return true;
        }

        if (in_array($targetStatus->value, [ProjectStatus::ON_HOLD->value, ProjectStatus::CANCELLED->value], true)) {
            return $currentStatus !== ProjectStatus::LIVE_PRODUCTION->value;
        }

        return in_array($targetStatus->value, $this->allowedTransitions[$currentStatus] ?? [], true);
    }

    /**
     * Eksekusi transisi status secara aman.
     */
    public function transition(Project $project, ProjectStatus $targetStatus, User $user, ?string $notes = null): Project
    {
        $user->loadMissing('role');

        $currentStatus = $project->status instanceof ProjectStatus ? $project->status->value : $project->status;
        $nextStatus = $targetStatus->value;

        if ($currentStatus === $nextStatus) {
            return $project;
        }

        // 1. Cek transisi non-linear (ON_HOLD / CANCELLED)
        if (in_array($nextStatus, [ProjectStatus::ON_HOLD->value, ProjectStatus::CANCELLED->value])) {
            if ($currentStatus === ProjectStatus::LIVE_PRODUCTION->value) {
                throw new Exception("Proyek yang sudah LIVE_PRODUCTION tidak dapat di-hold atau dibatalkan.");
            }
        } else {
            // 2. Validasi alur state machine (maju/mundur) - Berlaku untuk SEMUA User
            $allowed = $this->allowedTransitions[$currentStatus] ?? [];
            if (! in_array($nextStatus, $allowed)) {
                throw new Exception("Transisi status dari '{$currentStatus}' ke '{$nextStatus}' tidak diperbolehkan.");
            }
        }

        // 3. Validasi Hak Akses Role User
        $userRoleName = $user->role?->name;
        $allowedRoles = $this->rolePermissions[$nextStatus] ?? [UserRole::SUPER_ADMIN->value];

        if (! $userRoleName || (! in_array($userRoleName, $allowedRoles) && $userRoleName !== UserRole::SUPER_ADMIN->value)) {
            $roleLabel = $user->role?->display_name ?? 'Tanpa Role';
            throw new Exception("User dengan role '{$roleLabel}' tidak memiliki wewenang untuk mengubah status ke '{$nextStatus}'.");
        }

        // 3b. Validasi penugasan personal. Matriks role cuma jawab "role apa", bukan "orang
        // mana"; tanpa ini analis bisa menyetujui/menolak proyek analis lain dan tercatat
        // atas namanya di `status_histories` — merusak audit trail. Hanya dua role punya
        // kolom penugasan: Analyst Fase 1 (`analyst_id`) & PM/Analis Pengembangan (`pm_id`).
        // Role lintas proyek (Lead Group, Dev Lead, QA, Siber) tak punya pembanding, dilewati.
        $assignmentColumn = match ($userRoleName) {
            UserRole::ANALYST->value => 'analyst_id',
            UserRole::PROJECT_MANAGER->value, 'dev_analyst' => 'pm_id',
            default => null,
        };

        if ($assignmentColumn !== null && (int) $project->{$assignmentColumn} !== (int) $user->id) {
            throw new Exception('Proyek ini tidak didisposisikan kepada Anda, sehingga statusnya tidak dapat Anda ubah.');
        }

        // 4. Validasi prasyarat bisnis yang tidak boleh dilewati melalui API.
        $this->validateTransitionPrerequisites($project, $targetStatus);

        // 5. Eksekusi Transisi dalam DB Transaction
        return DB::transaction(function () use ($project, $currentStatus, $targetStatus, $user, $notes) {
            if (
                $currentStatus === ProjectStatus::UAT_REVISION_DEV->value
                && $targetStatus === ProjectStatus::SIT_IN_PROGRESS
            ) {
                $sitUatData = (array) $project->sit_uat_data;
                $sitUatData['sit_retest_scope'] = [
                    ...(array) ($sitUatData['sit_retest_scope'] ?? []),
                    'status' => 'in_progress',
                    'startedAt' => now()->toIso8601String(),
                    'startedBy' => $user->name,
                ];
                $project->sit_uat_data = $sitUatData;
            }

            if (
                $currentStatus === ProjectStatus::SIT_IN_PROGRESS->value
                && $targetStatus === ProjectStatus::SIT_PASSED
                && $project->isSitRetestCycle()
            ) {
                $sitUatData = (array) $project->sit_uat_data;
                $sitUatData['sit_retest_scope'] = [
                    ...(array) ($sitUatData['sit_retest_scope'] ?? []),
                    'status' => 'passed',
                    'passedAt' => now()->toIso8601String(),
                    'passedBy' => $user->name,
                ];
                $project->sit_uat_data = $sitUatData;
            }

            if (
                $currentStatus === ProjectStatus::SIT_PASSED->value
                && $targetStatus === ProjectStatus::UAT_IN_PROGRESS
            ) {
                $sitUatData = (array) $project->sit_uat_data;
                // Mencerminkan `Project::isUatRestartPending()`; di sini yang dimutasi
                // adalah array-nya, bukan modelnya, jadi flagnya dibaca langsung.
                $isUatRestartPending = ($sitUatData['uat_restart_after_sit']
                    ?? $sitUatData['uat2_resume_after_sit']
                    ?? false) === true;

                if ($isUatRestartPending) {
                    // Revisi Mayor mengulang dua siklus: SIT ulang (seluruh task) lalu UAT
                    // dari Tahap 1 (skenario disusun ulang, dieksekusi ulang, putaran
                    // persetujuan baru). Kalau UAT cuma "dilanjut" di Tahap 2 dgn hanya item
                    // Mayor dicek, kesimpulannya gabungan hasil lama + tambalan — bukan menilai
                    // versi yang benar-benar dirilis.
                    $now = now()->toIso8601String();
                    $sitUatData['activeUatStep'] = 1;
                    $sitUatData['uat_restart_after_sit'] = false;
                    unset($sitUatData['uat2_resume_after_sit'], $sitUatData['uat2_verification_mode']);
                    $sitUatData['uat_sit_retest_passed_at'] = $now;
                    // Jejak Change Request mencatat bahwa perbaikannya sudah divalidasi
                    // SIT. Penerimaan oleh pengguna menyusul saat UAT dijalankan ulang.
                    $sitUatData['uat_change_requests'] = collect($sitUatData['uat_change_requests'] ?? [])
                        ->map(fn (array $request): array => ($request['status'] ?? null) === 'resolved'
                            ? [...$request, 'status' => 'sit_verified', 'sitVerifiedAt' => $now]
                            : $request)
                        ->values()
                        ->all();
                    $sitUatData['uat_hold'] = [
                        ...(array) ($sitUatData['uat_hold'] ?? []),
                        'status' => 'uat_restart',
                        'sitPassedAt' => $now,
                    ];
                    $project->sit_uat_data = $sitUatData;
                }
            }

            // Keluar UAT untuk revisi membatalkan putaran persetujuan berjalan. Tanpa ini
            // baris `approved` lama tetap hidup dan `allRequiredApproved()` bisa lolos pakai
            // tanda tangan atas hasil UAT usang. Di dalam transaksi (ikut rollback bila gagal),
            // aman diulang.
            if ($currentStatus === ProjectStatus::UAT_IN_PROGRESS->value) {
                $supersedeReason = match ($targetStatus) {
                    ProjectStatus::UAT_REVISION_DEV => 'UAT dikembalikan ke pengembangan untuk revisi Mayor; persetujuan atas hasil UAT sebelumnya tidak lagi berlaku.',
                    ProjectStatus::UAT_REVISION_SIT => 'UAT dikembalikan ke pengujian SIT; persetujuan atas hasil UAT sebelumnya tidak lagi berlaku.',
                    default => null,
                };

                if ($supersedeReason !== null) {
                    $this->uatApprovalService->supersedeActiveRounds($project, $supersedeReason);
                }
            }

            $this->syncTestingTrackStatuses($project, $targetStatus);

            $project->status = $targetStatus;

            if ($targetStatus === ProjectStatus::REJECTED) {
                $project->rejection_reason = $notes;
            }

            $project->save();

            // Insert audit log ke project_status_histories
            ProjectStatusHistory::create([
                'project_id' => $project->id,
                'from_status' => $currentStatus,
                'to_status' => $targetStatus->value,
                'changed_by' => $user->id,
                'notes' => $notes,
            ]);

            // Catat juga ke activity_logs (audit trail umum, filterable per proyek)
            \App\Models\ActivityLog::create([
                'user_id'      => $user->id,
                'action'       => 'update_project_status',
                'action_label' => 'Mengubah Status Proyek',
                'description'  => "Status proyek \"{$project->title}\" diubah dari {$currentStatus} menjadi {$targetStatus->value}." . ($notes ? " Catatan: {$notes}" : ''),
                'subject_type' => \App\Models\Project::class,
                'subject_id'   => $project->id,
                'metadata'     => [
                    'project_id'   => $project->id,
                    'project_name' => $project->title ?? $project->name,
                    'from_status'  => $currentStatus,
                    'to_status'    => $targetStatus->value,
                    'user_name'    => $user->name,
                    'user_role'    => $user->role?->display_name ?? $user->role?->name,
                ],
                'ip_address'   => request()->ip(),
                'status'       => 'success',
                'created_at'   => now(),
            ]);

            // Create notification for relevant roles
            $this->notifyRelevantRoles($project, $currentStatus, $targetStatus->value, $user, $notes);

            // Broadcast event ProjectUpdated via Reverb
            broadcast(new \App\Events\ProjectUpdated(
                project: $project,
                oldStatus: $currentStatus,
                newStatus: $targetStatus->value,
                actorName: $user->name
            ));

            return $project->fresh(['creator', 'pm', 'analyst', 'division', 'statusHistories']);
        });
    }

    /**
     * Selaraskan kolom jalur pengujian dengan status tujuan. Backend satu-satunya pemilik
     * `qa_status`/`cyber_status`, jadi endpoint pemicu apa pun (pengajuan PM, laporan tester,
     * sign-off Lead) meninggalkan kedua kolom konsisten. Dipanggil dalam transaksi
     * `transition()` sebelum save, tanpa query tulis tambahan. Hanya jalur relevan disentuh
     * agar dua jalur paralel tak saling menimpa.
     */
    private function syncTestingTrackStatuses(Project $project, ProjectStatus $targetStatus): void
    {
        switch ($targetStatus) {
            case ProjectStatus::READY_FOR_QA:
                // PM mengajukan pengujian QA; jalur Siber tidak tersentuh.
                if (! $project->qaTrackStatus()->isActive()) {
                    $project->qa_status = TrackStatus::SUBMITTED->value;
                }
                break;

            case ProjectStatus::QA_IN_PROGRESS:
                $project->qa_status = TrackStatus::IN_PROGRESS->value;
                break;

            case ProjectStatus::QA_PASSED:
                $project->qa_status = TrackStatus::PASSED->value;
                break;

            case ProjectStatus::CYBER_IN_PROGRESS:
                $project->cyber_status = TrackStatus::IN_PROGRESS->value;
                break;

            case ProjectStatus::CYBER_PASSED:
                $project->cyber_status = TrackStatus::PASSED->value;
                break;

            case ProjectStatus::RETURN_TO_DEV:
                // Ada defect: kelulusan gugur karena kode akan berubah. Tanda FAILED
                // dibiarkan utuh sebagai jejak audit siapa yang menolak.
                foreach (['qa_status', 'cyber_status'] as $column) {
                    if (TrackStatus::normalize($project->{$column})->isPassed()) {
                        $project->{$column} = TrackStatus::NOT_SUBMITTED->value;
                    }
                }
                break;

            default:
                // Fase di luar QA / Siber tidak mengubah kolom jalur.
                break;
        }
    }

    /**
     * Ambil satu baris `sit2_task_approvals` tanpa bergantung bentuk kuncinya (produksi
     * simpan 3 bentuk: integer, string angka, prefiks `task_`). Jangan tambah bentuk ke-4 —
     * `SitApprovalService::taskApproval()` pakai pembacaan yang sama untuk inbox.
     *
     * @param  array<array-key, mixed>  $taskApprovals
     * @return array<string, mixed>
     */
    private static function sitTaskApproval(array $taskApprovals, int|string $taskId): array
    {
        $approval = $taskApprovals[$taskId]
            ?? $taskApprovals[(string) $taskId]
            ?? $taskApprovals['task_'.$taskId]
            ?? null;

        return is_array($approval) ? $approval : [];
    }

    /**
     * Id task pada scope SIT yang belum disetujui pada Eksekusi Pengujian (Tahap 2).
     *
     * Dipakai gerbang SIT putaran pertama maupun gerbang SIT ulang supaya keduanya tidak
     * pernah menyimpang soal apa yang dihitung "sudah disetujui".
     *
     * @param  array<array-key, mixed>  $taskApprovals
     * @return \Illuminate\Support\Collection<int, int>
     */
    private static function unapprovedSitTaskIds(\Illuminate\Support\Enumerable $scopeTasks, array $taskApprovals): \Illuminate\Support\Collection
    {
        return collect($scopeTasks->pluck('id')->all())
            ->filter(fn ($taskId): bool => (self::sitTaskApproval($taskApprovals, $taskId)['approved'] ?? false) !== true)
            ->map(fn ($taskId): int => (int) $taskId)
            ->values();
    }

    /**
     * Id developer wajib yang belum menandatangani persetujuan SIT Tahap 3.
     *
     * Baris approval lama memakai `approvedById`, yang baru memakai `userId`; keduanya
     * harus tetap dihormati agar proyek berjalan tidak mendadak dianggap belum lengkap.
     *
     * @param  \Illuminate\Support\Enumerable<int, int>  $requiredDeveloperIds
     * @param  array<string, mixed>  $approvals
     * @return \Illuminate\Support\Collection<int, int>
     */
    private static function missingSitDeveloperApprovalIds(\Illuminate\Support\Enumerable $requiredDeveloperIds, array $approvals): \Illuminate\Support\Collection
    {
        $approvedDeveloperIds = collect($approvals['developer']['developers'] ?? [])
            ->map(fn ($approval): int => is_array($approval)
                ? (int) ($approval['userId'] ?? $approval['approvedById'] ?? 0)
                : 0)
            ->filter()
            ->unique();

        return collect($requiredDeveloperIds->all())
            ->map(fn ($id): int => (int) $id)
            ->diff($approvedDeveloperIds)
            ->values();
    }

    /**
     * Validasi gate bisnis lintas endpoint sebelum status proyek berubah.
     */
    private function validateTransitionPrerequisites(Project $project, ProjectStatus $targetStatus): void
    {
        // Gerbang go-live: rilis ke Grup Infrastruktur sah hanya setelah KEDUA jalur lulus.
        // Di sini, bukan matriks, karena `allowedTransitions` cuma kenal bentuk transisi
        // (QA_PASSED/CYBER_PASSED ke PENDING_GOLIVE) dan tak lihat status jalur satunya.
        if ($targetStatus === ProjectStatus::PENDING_GOLIVE && ! $project->hasPassedAllTestingTracks()) {
            $pendingTracks = collect([
                'Pengujian QA' => $project->qaTrackStatus(),
                'Audit Keamanan Siber' => $project->cyberTrackStatus(),
            ])
                ->reject(fn (TrackStatus $status): bool => $status->isPassed())
                ->map(fn (TrackStatus $status, string $label): string => "{$label} ({$status->label()})")
                ->values()
                ->implode(' dan ');

            throw new Exception(
                "Pengajuan go-live ke Grup Infrastruktur hanya dapat dilakukan setelah Pengujian QA dan Audit Keamanan Siber dinyatakan lulus. Belum lulus: {$pendingTracks}."
            );
        }

        if ($targetStatus === ProjectStatus::SIT_PASSED && ! $project->hasSitSignOffDocument()) {
            throw new Exception(
                'Dokumen Hasil Review / Berita Acara SIT wajib diunggah sebelum SIT dapat dinyatakan lulus.'
            );
        }

        // Kelengkapan persetujuan Tahap 3 pada SIT putaran pertama. Dulu hanya dijaga tombol
        // `SITUATWizard.jsx`, jadi `PATCH /projects/{id}/status` bisa meluluskan SIT tanpa satu
        // tanda tangan asal berita acara terunggah — padahal berita acara bukti dokumen, bukan
        // bukti developer/PM/Pimpinan Grup Pengembangan menyetujui. Bukti baru per task dari
        // document vault sengaja TIDAK ditiru di sini — itu pembeda SIT ulang (docs/AI_HANDOFF.md §3).
        if ($targetStatus === ProjectStatus::SIT_PASSED && ! $project->isSitRetestCycle()) {
            $sitUatData = (array) $project->sit_uat_data;
            $taskApprovals = (array) ($sitUatData['sit2_task_approvals'] ?? []);
            $approvals = (array) ($sitUatData['sit3_approvals'] ?? []);
            $scopeTasks = $project->sitScopeTasks();

            $unapprovedTaskIds = self::unapprovedSitTaskIds($scopeTasks, $taskApprovals);
            if ($unapprovedTaskIds->isNotEmpty()) {
                throw new Exception(
                    'Semua task dalam scope SIT harus disetujui pada Eksekusi Pengujian sebelum SIT dinyatakan lulus. Task yang belum disetujui: '
                    .$unapprovedTaskIds->implode(', ').'.'
                );
            }

            // Nol developer wajib tak sah untuk meluluskan SIT: tak ada task ber-assignee
            // developer, jadi tak ada penanggung jawab hasil uji. Aturan sama dengan
            // `ProjectController::sitApprovalStatus()` (`$requiredDevCount > 0 && ...`) yang
            // menyalakan tombol FE; server kini menegakkannya juga.
            $requiredDeveloperIds = collect($project->sitApprovalDeveloperIds());
            if ($requiredDeveloperIds->isEmpty()) {
                throw new Exception(
                    'SIT tidak dapat diluluskan karena proyek belum memiliki developer penanggung jawab task yang dapat memberikan persetujuan.'
                );
            }

            $missingDeveloperIds = self::missingSitDeveloperApprovalIds($requiredDeveloperIds, $approvals);
            if ($missingDeveloperIds->isNotEmpty()) {
                throw new Exception(
                    'Semua developer pada tim proyek wajib memberikan persetujuan SIT. Developer yang belum menyetujui: '
                    .$missingDeveloperIds->implode(', ').'.'
                );
            }

            // PM & Pimpinan Grup Pengembangan dipisah agar pesan menyebut slot yang kosong;
            // gerbang SIT ulang menggabungnya, menyulitkan pengguna menebak yang kurang.
            if (($approvals['pm']['approved'] ?? false) !== true) {
                throw new Exception('Persetujuan Analyst / Project Manager wajib ada sebelum SIT dinyatakan lulus.');
            }
            if (($approvals['development_lead']['approved'] ?? false) !== true) {
                throw new Exception('Persetujuan Pimpinan Grup Pengembangan wajib ada sebelum SIT dinyatakan lulus.');
            }
        }

        // Prasyarat berikut hanya untuk SIT dalam siklus revisi Mayor UAT. Cakupan PENUH
        // (seluruh task aktif diuji ulang, seperti SIT pertama) karena UAT juga diulang dari
        // Tahap 1. Bedanya bukan daftar task tapi ketatnya bukti: tiap task wajib selesai,
        // disetujui di Eksekusi Pengujian, punya lampiran bukti BARU dari document vault, dan
        // persetujuan Tahap 3 lengkap. Lolos tanpa bukti baru = UAT gagal untuk kedua kalinya.
        if ($targetStatus === ProjectStatus::SIT_PASSED && $project->isSitRetestCycle()) {
            $scopeTasks = $project->sitScopeTasks();
            if ($scopeTasks->isEmpty()) {
                // Scope SIT ulang = seluruh task aktif, jadi kosong berarti proyek tak punya
                // task yang bisa diuji — bukan soal daftar Change Request.
                throw new Exception('Scope SIT ulang kosong: proyek tidak memiliki task aktif yang dapat diuji.');
            }

            $incompleteTasks = $scopeTasks->filter(function ($task): bool {
                $status = $task->status instanceof \BackedEnum
                    ? $task->status->value
                    : (string) $task->status;

                return $status !== TaskStatus::DONE->value;
            });
            if ($incompleteTasks->isNotEmpty()) {
                throw new Exception('Seluruh task dalam scope SIT ulang harus selesai sebelum SIT dinyatakan lulus.');
            }

            $sitUatData = (array) $project->sit_uat_data;
            $taskApprovals = (array) ($sitUatData['sit2_task_approvals'] ?? []);
            $unapprovedTaskIds = self::unapprovedSitTaskIds($scopeTasks, $taskApprovals);
            if ($unapprovedTaskIds->isNotEmpty()) {
                throw new Exception('Semua task dalam scope SIT ulang harus disetujui pada Eksekusi Pengujian.');
            }

            $tasksWithoutEvidence = $scopeTasks->pluck('id')->filter(function ($taskId) use ($taskApprovals): bool {
                $approval = self::sitTaskApproval($taskApprovals, $taskId);

                return collect($approval['attachments'] ?? [])->doesntContain(
                    fn ($attachment): bool => is_array($attachment)
                        && is_numeric($attachment['docId'] ?? null)
                );
            });
            if ($tasksWithoutEvidence->isNotEmpty()) {
                throw new Exception('Setiap task dalam scope SIT ulang wajib memiliki lampiran bukti pengujian baru.');
            }

            $evidenceDocumentIds = $scopeTasks->pluck('id')
                ->flatMap(function ($taskId) use ($taskApprovals) {
                    $approval = self::sitTaskApproval($taskApprovals, $taskId);

                    return collect($approval['attachments'] ?? [])->pluck('docId');
                })
                ->filter(fn ($id) => is_numeric($id))
                ->map(fn ($id) => (int) $id)
                ->unique();
            $validEvidenceCount = DocumentVault::query()
                ->where('project_id', $project->id)
                ->where('document_type', DocumentVault::SIT_TASK_EVIDENCE_TYPE)
                ->whereKey($evidenceDocumentIds->all())
                ->count();
            if ($validEvidenceCount !== $evidenceDocumentIds->count()) {
                throw new Exception('Lampiran bukti SIT ulang harus berasal dari document vault proyek dan bertipe SIT_TASK_EVIDENCE.');
            }

            $approvals = (array) ($sitUatData['sit3_approvals'] ?? []);

            // Daftar wajibnya seluruh developer tim proyek, bukan hanya penerima task
            // pada scope SIT ulang — satu sumber dengan `ProjectController::sitApproval`.
            $requiredDeveloperIds = collect($project->sitApprovalDeveloperIds());
            if (self::missingSitDeveloperApprovalIds($requiredDeveloperIds, $approvals)->isNotEmpty()) {
                throw new Exception('Semua developer pada tim proyek wajib memberikan persetujuan SIT ulang.');
            }
            if (
                ($approvals['pm']['approved'] ?? false) !== true
                || ($approvals['development_lead']['approved'] ?? false) !== true
            ) {
                throw new Exception('Persetujuan PM dan Development Lead wajib lengkap untuk SIT ulang.');
            }
        }

        $currentStatus = $project->status instanceof ProjectStatus
            ? $project->status->value
            : (string) $project->status;

        if (
            $targetStatus === ProjectStatus::SIT_IN_PROGRESS
            && $currentStatus === ProjectStatus::UAT_REVISION_DEV->value
        ) {
            $sitUatData = (array) $project->sit_uat_data;
            $cycle = (int) ($sitUatData['uat_hold']['cycle'] ?? 0);
            $activeRequests = collect($sitUatData['uat_change_requests'] ?? [])
                ->filter(fn (array $request): bool => ($request['type'] ?? null) === 'mayor'
                    && (int) ($request['cycle'] ?? 0) === $cycle);

            if ($activeRequests->isEmpty() || $activeRequests->contains(
                fn (array $request): bool => ($request['status'] ?? null) !== 'resolved'
            )) {
                throw new Exception('Semua Change Request Mayor pada siklus aktif harus diselesaikan sebelum SIT ulang dimulai.');
            }

            $taskIds = $activeRequests->pluck('taskId')->filter()->map(fn ($id) => (int) $id)->unique();
            $completedTaskIds = $project->tasks()
                ->whereIn('id', $taskIds->all())
                ->whereNotNull('assignee_id')
                ->where('status', TaskStatus::DONE->value)
                ->pluck('id')
                ->map(fn ($id) => (int) $id);
            if ($taskIds->count() !== $completedTaskIds->count()) {
                throw new Exception('Seluruh task Change Request Mayor harus memiliki assignee dan berstatus selesai sebelum SIT ulang dimulai.');
            }
        }

        // Tutup pintu belakang transisi langsung ke fase QA/Siber. Gerbang dinilai dari
        // status tujuan dan per jalur agar putaran terbuka selalu diselesaikan, termasuk
        // saat status utama telah digerakkan oleh jalur paralel.
        $resubmittedTrack = match ($targetStatus) {
            ProjectStatus::READY_FOR_QA, ProjectStatus::QA_IN_PROGRESS, ProjectStatus::QA_PASSED => TestingTrack::QA,
            ProjectStatus::CYBER_IN_PROGRESS, ProjectStatus::CYBER_PASSED => TestingTrack::CYBER,
            default => null,
        };

        if ($resubmittedTrack) {
            $this->returnRoundService->assertResubmitAllowed($project, $resubmittedTrack);
        }

        if ($targetStatus !== ProjectStatus::DEV_COMPLETED) {
            return;
        }

        // Gerbang siklus revisi dinilai sebagai invarian atas status TUJUAN
        // DEV_COMPLETED, bukan atas status sekarang. Matriks mengizinkan DEV_COMPLETED
        // dari SIT_PASSED, UAT_PASSED, READY_FOR_QA, dan IN_DEVELOPMENT; membatasi
        // gerbang ke asal UAT_IN_PROGRESS saja membuat proyek yang siklus revisi
        // Mayor/Minor-nya belum tuntas dapat dinyatakan selesai lewat salah satu jalur
        // itu tanpa UAT dijalankan ulang. Selama restart Mayor masih tertunda — SIT
        // ulang belum lulus atau UAT belum dijalankan kembali dari awal — kesimpulan
        // UAT yang ada belum menilai versi aplikasi yang akan dirilis. Contoh nyatanya:
        // proyek di tengah restart Mayor berada di SIT_PASSED dengan `uat_restart_after_sit`
        // masih benar, lalu didorong SIT_PASSED -> DEV_COMPLETED yang bentuknya sah.
        if ($project->isUatRestartPending()) {
            throw new Exception('Revisi Mayor UAT belum selesai. Selesaikan SIT ulang dan jalankan UAT dari awal sebelum proyek dapat dinyatakan DEV_COMPLETED.');
        }

        // Revisi Minor tidak memundurkan siklus, tetapi tetap menahan penutupan UAT.
        // Berita acara UAT menjadi dasar rilis, jadi menutupnya sebelum perbaikan Minor
        // dikerjakan berarti menyatakan lulus atas versi aplikasi yang sudah diketahui
        // salah. Hold-nya lepas sendiri begitu seluruh Change Request Minor selesai.
        if ($project->isUatMinorRevisionPending()) {
            throw new Exception('Revisi Minor UAT belum selesai. Selesaikan seluruh Change Request Minor sebelum proyek dapat dinyatakan DEV_COMPLETED.');
        }

        // Gerbang di bawah menutup sesi UAT internal yang sedang berjalan, jadi hanya
        // relevan bila DEV_COMPLETED datang dari UAT_IN_PROGRESS. Dari status lain
        // (mis. proyek yang tidak menjalankan UAT internal) tidak ada Tahap 2 untuk
        // diselesaikan maupun putaran persetujuan untuk dinilai.
        if ($currentStatus !== ProjectStatus::UAT_IN_PROGRESS->value) {
            return;
        }

        $sitUatData = (array) $project->sit_uat_data;
        $summary = (array) ($sitUatData['uat2_summary'] ?? []);

        if ((int) ($sitUatData['activeUatStep'] ?? 1) < 3 || empty($summary['conclusion'])) {
            throw new Exception('Eksekusi UAT Tahap 2 wajib diselesaikan sebelum proyek dinyatakan DEV_COMPLETED.');
        }

        if (! $this->uatApprovalService->allRequiredApproved($project)) {
            throw new Exception('Seluruh persetujuan wajib dari pihak peminta dan pihak IT harus lengkap sebelum proyek dinyatakan DEV_COMPLETED.');
        }
    }

    /**
     * Kirim notifikasi ke role terkait berdasarkan transisi status baru.
     */
    protected function notifyRelevantRoles(Project $project, ?string $oldStatus, string $newStatus, User $actor, ?string $notes = null): void
    {
        $message = "Proyek '{$project->title}' telah mengubah status dari " . ($oldStatus ?? 'Baru') . " menjadi {$newStatus} oleh {$actor->name}.";

        $rolesToNotify = [];

        match ($newStatus) {
            ProjectStatus::IN_REVIEW->value, ProjectStatus::REJECTED->value, ProjectStatus::CANCELLED->value => $rolesToNotify = ['lead_group', 'super_admin'],
            ProjectStatus::ANALYSIS_APPROVED->value                     => $rolesToNotify = ['development_lead', 'super_admin'],
            ProjectStatus::READY_FOR_DEVELOPMENT->value,
            ProjectStatus::DEV_ANALYSIS->value                          => $rolesToNotify = ['analyst', 'super_admin'],
            ProjectStatus::DEV_ANALYSIS_DONE->value                     => $rolesToNotify = ['development_lead', 'super_admin'],
            ProjectStatus::DEV_COMPLETED->value                         => $rolesToNotify = ['qa_lead', 'lead_group', 'cyber_lead', 'super_admin'],
            ProjectStatus::IN_DEVELOPMENT->value                        => $rolesToNotify = ['developer', 'super_admin'],
            ProjectStatus::SIT_IN_PROGRESS->value                       => $rolesToNotify = ['developer', 'qa_lead', 'super_admin'],
            ProjectStatus::SIT_PASSED->value                            => $rolesToNotify = ['project_manager', 'super_admin'],
            ProjectStatus::SIT_REVISION->value                          => $rolesToNotify = ['developer', 'project_manager', 'super_admin'],
            ProjectStatus::UAT_IN_PROGRESS->value                       => $rolesToNotify = ['business_user', 'super_admin'],
            ProjectStatus::UAT_REVISION_SIT->value,
            ProjectStatus::UAT_REVISION_DEV->value                      => $rolesToNotify = ['developer', 'project_manager', 'super_admin'],
            ProjectStatus::READY_FOR_QA->value                          => $rolesToNotify = ['qa_lead', 'lead_group', 'super_admin'],
            ProjectStatus::QA_IN_PROGRESS->value                        => $rolesToNotify = ['qa_tester', 'qa_lead', 'super_admin'],
            ProjectStatus::QA_PASSED->value                             => $rolesToNotify = ['project_manager', 'super_admin'],
            ProjectStatus::CYBER_IN_PROGRESS->value                     => $rolesToNotify = ['cyber_lead', 'super_admin'],
            ProjectStatus::CYBER_PASSED->value                          => $rolesToNotify = ['project_manager', 'super_admin'],
            ProjectStatus::UAT_PASSED->value                            => $rolesToNotify = ['project_manager', 'super_admin'],
            // Pengajuan go-live: keputusan ada di Head of IT / Grup Infrastruktur.
            ProjectStatus::PENDING_GOLIVE->value                        => $rolesToNotify = ['head_of_it', 'super_admin'],
            ProjectStatus::RETURN_TO_DEV->value                         => $rolesToNotify = ['developer', 'project_manager', 'super_admin'],
            ProjectStatus::ON_HOLD->value                               => $rolesToNotify = ['lead_group', 'super_admin'],
            default                                                     => null,
        };

        // Collect unique user IDs to avoid duplicates
        $notifiedUserIds = [];
        $notifications = [];
        $now = now();

        // Add creator notification for rejected/cancelled
        if (in_array($newStatus, [ProjectStatus::REJECTED->value, ProjectStatus::CANCELLED->value]) && $project->created_by) {
            $rejectMsg = $newStatus === ProjectStatus::REJECTED->value && $notes
                ? "Proyek '{$project->title}' DITOLAK. Catatan perbaikan: {$notes}"
                : $message;
            $notifiedUserIds[] = $project->created_by;
            $notifications[] = [
                'user_id'    => $project->created_by,
                'title'      => $newStatus === ProjectStatus::REJECTED->value ? 'Proyek Ditolak — Perlu Perbaikan' : 'Update Status Proyek',
                'message'    => $rejectMsg,
                'type'       => $newStatus === ProjectStatus::REJECTED->value ? 'warning' : 'info',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Live in production — notify all stakeholders
        if ($newStatus === ProjectStatus::LIVE_PRODUCTION->value) {
            foreach ([$project->created_by, $project->pm_id] as $uid) {
                if ($uid && !in_array($uid, $notifiedUserIds)) {
                    $notifiedUserIds[] = $uid;
                    $notifications[] = [
                        'user_id'    => $uid,
                        'title'      => 'Proyek Rilis ke Produksi',
                        'message'    => "Selamat! Proyek '{$project->title}' telah berhasil rilis ke production.",
                        'type'       => 'info',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        }

        // Batch insert role-based notifications (deduped)
        if (!empty($rolesToNotify)) {
            $users = User::whereHas('role', fn($q) => $q->whereIn('name', $rolesToNotify))->get();
            foreach ($users as $u) {
                if (in_array($u->id, $notifiedUserIds)) continue;
                $notifiedUserIds[] = $u->id;
                $notifications[] = [
                    'user_id'    => $u->id,
                    'title'      => 'Pembaruan Alur Kerja Proyek',
                    'message'    => $message,
                    'type'       => 'info',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                broadcast(new \App\Events\NotificationCreated(
                    userId: $u->id,
                    title: 'Pembaruan Alur Kerja Proyek',
                    message: $message,
                    type: 'info'
                ));
            }
        }

        if (!empty($notifications)) {
            \App\Models\Notification::insert($notifications);
        }
    }
}
