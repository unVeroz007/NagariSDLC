<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
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
    public function __construct(private readonly UatApprovalService $uatApprovalService) {}

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
            ProjectStatus::READY_FOR_QA->value,
            ProjectStatus::CYBER_IN_PROGRESS->value,
            ProjectStatus::QA_IN_PROGRESS->value,
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
        // QA_PASSED & CYBER_PASSED sengaja dibuat simetris: dua jalur pengujian
        // berjalan paralel, jadi jalur mana pun yang sign-off lebih dulu harus
        // tetap bisa menerima sign-off jalur lain, maju ke UAT final, atau mundur.
        ProjectStatus::QA_PASSED->value => [
            ProjectStatus::CYBER_IN_PROGRESS->value,
            ProjectStatus::CYBER_PASSED->value,
            ProjectStatus::READY_FOR_UAT->value, // Dua jalur lulus, PM ajukan UAT final
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
            ProjectStatus::READY_FOR_UAT->value,
            ProjectStatus::QA_IN_PROGRESS->value, // Paralel QA baru mulai
            ProjectStatus::QA_PASSED->value, // Sign-off QA menyusul
            ProjectStatus::RETURN_TO_DEV->value, // Mundur (Defect QA menyusul)
            ProjectStatus::CYBER_IN_PROGRESS->value, // Mundur
        ],
        ProjectStatus::READY_FOR_UAT->value => [
            ProjectStatus::UAT_PASSED->value,
            ProjectStatus::RETURN_TO_DEV->value, // Mundur
            ProjectStatus::CYBER_PASSED->value,
        ],
        ProjectStatus::UAT_PASSED->value => [
            ProjectStatus::PENDING_GOLIVE->value,
            ProjectStatus::READY_FOR_UAT->value, // Mundur
            ProjectStatus::RETURN_TO_DEV->value, // Mundur
        ],
        ProjectStatus::PENDING_GOLIVE->value => [
            ProjectStatus::LIVE_PRODUCTION->value,
            ProjectStatus::UAT_PASSED->value, // Mundur
            ProjectStatus::RETURN_TO_DEV->value, // Mundur (Quality Gate Reject)
            ProjectStatus::REJECTED->value,
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
     */
    protected array $rolePermissions = [
        ProjectStatus::PENDING->value => [UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::IN_REVIEW->value => [UserRole::LEAD_GROUP->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::ANALYSIS_APPROVED->value => [UserRole::LEAD_GROUP->value, UserRole::ANALYST->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::REJECTED->value => [UserRole::LEAD_GROUP->value, UserRole::ANALYST->value, UserRole::HEAD_OF_IT->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::READY_FOR_DEVELOPMENT->value => [UserRole::LEAD_GROUP->value, UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::DEV_ANALYSIS->value => [UserRole::DEVELOPMENT_LEAD->value, UserRole::ANALYST->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::DEV_ANALYSIS_DONE->value => [UserRole::ANALYST->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::IN_DEVELOPMENT->value => [UserRole::PROJECT_MANAGER->value, UserRole::DEVELOPER->value, UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::SIT_IN_PROGRESS->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::DEVELOPMENT_LEAD->value, UserRole::DEVELOPER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::SIT_PASSED->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::SIT_REVISION->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_IN_PROGRESS->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_REVISION_SIT->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_REVISION_DEV->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::BUSINESS_USER->value, UserRole::HEAD_OF_IT->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::DEV_COMPLETED->value => [UserRole::PROJECT_MANAGER->value, 'dev_analyst', UserRole::DEVELOPMENT_LEAD->value, UserRole::DEVELOPER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::RETURN_TO_DEV->value => [UserRole::QA_LEAD->value, UserRole::QA_TESTER->value, UserRole::CYBER_LEAD->value, UserRole::PENTESTER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::READY_FOR_QA->value => [UserRole::PROJECT_MANAGER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::QA_IN_PROGRESS->value => [UserRole::QA_LEAD->value, UserRole::LEAD_GROUP->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::QA_PASSED->value => [UserRole::QA_TESTER->value, UserRole::QA_LEAD->value, UserRole::LEAD_GROUP->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::CYBER_IN_PROGRESS->value => [UserRole::CYBER_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::CYBER_PASSED->value => [UserRole::PENTESTER->value, UserRole::CYBER_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::READY_FOR_UAT->value => [UserRole::PROJECT_MANAGER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_PASSED->value => [UserRole::BUSINESS_USER->value, UserRole::PROJECT_MANAGER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::PENDING_GOLIVE->value => [UserRole::PROJECT_MANAGER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::LIVE_PRODUCTION->value => [UserRole::HEAD_OF_IT->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::ON_HOLD->value => [UserRole::PROJECT_MANAGER->value, UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::CANCELLED->value => [UserRole::LEAD_GROUP->value, UserRole::HEAD_OF_IT->value, UserRole::SUPER_ADMIN->value],
    ];


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

        // 3b. Validasi penugasan personal untuk System Analyst.
        //
        // Matriks role di atas hanya menjawab "role apa yang boleh", bukan "orang mana
        // yang boleh". Tanpa pemeriksaan ini, seorang analis dapat menyetujui atau
        // menolak hasil analisis proyek yang didisposisikan kepada analis lain, dan
        // jejaknya tercatat di `status_histories` atas namanya — merusak audit trail.
        //
        // Sengaja hanya diterapkan pada role analyst: hanya role itulah yang punya
        // kolom penugasan personal (`projects.analyst_id`) pada fase yang ia kelola.
        if ($userRoleName === UserRole::ANALYST->value && (int) $project->analyst_id !== (int) $user->id) {
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
                && $project->isTargetedSitRetest()
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
                if (($sitUatData['uat2_resume_after_sit'] ?? false) === true) {
                    // UAT yang ditahan dilanjutkan di Tahap 2 dalam mode verifikasi.
                    // Hanya item Mayor yang dibuka kembali, bukan seluruh UAT.
                    $sitUatData['activeUatStep'] = 2;
                    $sitUatData['uat2_resume_after_sit'] = false;
                    $sitUatData['uat2_verification_mode'] = true;
                    $sitUatData['uat2_sit_retest_passed_at'] = now()->toIso8601String();
                    foreach (['uat2_scenarios', 'uat2_additional_requests'] as $key) {
                        $sitUatData[$key] = collect($sitUatData[$key] ?? [])
                            ->map(fn (array $item): array => ($item['changeType'] ?? null) === 'mayor'
                                && ($item['verificationStatus'] ?? null) !== 'verified'
                                    ? [
                                        ...$item,
                                        'verificationStatus' => 'pending',
                                        'verificationResult' => null,
                                        'verificationComment' => null,
                                        'verificationAttachments' => [],
                                        'verifiedAt' => null,
                                    ]
                                    : $item)
                            ->values()
                            ->all();
                    }
                    $sitUatData['uat_change_requests'] = collect($sitUatData['uat_change_requests'] ?? [])
                        ->map(fn (array $request): array => ($request['status'] ?? null) === 'resolved'
                            ? [...$request, 'status' => 'sit_verified', 'sitVerifiedAt' => now()->toIso8601String()]
                            : $request)
                        ->values()
                        ->all();
                    $sitUatData['uat_hold'] = [
                        ...(array) ($sitUatData['uat_hold'] ?? []),
                        'status' => 'uat_verification',
                        'sitPassedAt' => now()->toIso8601String(),
                    ];
                    $project->sit_uat_data = $sitUatData;
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
     * Selaraskan kolom jalur pengujian dengan status utama yang sedang dituju.
     *
     * Backend adalah satu-satunya pemilik nilai `qa_status` / `cyber_status` untuk
     * transisi fase QA & Siber, supaya endpoint mana pun yang memicu transisi
     * (pengajuan PM, laporan tester, sign-off Lead) selalu meninggalkan kedua
     * kolom dalam keadaan konsisten. Dipanggil di dalam transaction `transition()`,
     * sebelum `$project->save()`, jadi tidak menambah query tulis.
     *
     * Hanya jalur yang relevan dengan status tujuan yang disentuh — jalur lain
     * dibiarkan apa adanya supaya dua jalur paralel tidak saling menimpa.
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
                // Ada defect: kelulusan yang sudah didapat tidak lagi berlaku
                // karena kode akan berubah. Tanda FAILED dibiarkan utuh sebagai
                // jejak audit siapa yang menolak.
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
     * Validasi gate bisnis lintas endpoint sebelum status proyek berubah.
     */
    private function validateTransitionPrerequisites(Project $project, ProjectStatus $targetStatus): void
    {
        if ($targetStatus === ProjectStatus::READY_FOR_UAT && ! $project->hasPassedAllTestingTracks()) {
            $pendingTracks = collect([
                'Pengujian QA' => $project->qaTrackStatus(),
                'Audit Keamanan Siber' => $project->cyberTrackStatus(),
            ])
                ->reject(fn (TrackStatus $status): bool => $status->isPassed())
                ->map(fn (TrackStatus $status, string $label): string => "{$label} ({$status->label()})")
                ->values()
                ->implode(' dan ');

            throw new Exception(
                "UAT final hanya dapat diajukan setelah Pengujian QA dan Audit Keamanan Siber dinyatakan lulus. Belum lulus: {$pendingTracks}."
            );
        }

        if ($targetStatus === ProjectStatus::SIT_PASSED && ! $project->hasSitSignOffDocument()) {
            throw new Exception(
                'Dokumen Hasil Review / Berita Acara SIT wajib diunggah sebelum SIT dapat dinyatakan lulus.'
            );
        }

        if ($targetStatus === ProjectStatus::SIT_PASSED && $project->isTargetedSitRetest()) {
            $scopeTasks = $project->sitScopeTasks();
            if ($scopeTasks->isEmpty()) {
                throw new Exception('Scope SIT ulang tidak memiliki task Change Request Mayor yang valid.');
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
            $unapprovedTaskIds = $scopeTasks->pluck('id')->filter(function ($taskId) use ($taskApprovals): bool {
                $approval = $taskApprovals[$taskId]
                    ?? $taskApprovals[(string) $taskId]
                    ?? $taskApprovals['task_'.$taskId]
                    ?? null;

                return ! is_array($approval) || ($approval['approved'] ?? false) !== true;
            });
            if ($unapprovedTaskIds->isNotEmpty()) {
                throw new Exception('Semua task dalam scope SIT ulang harus disetujui pada Eksekusi Pengujian.');
            }

            $tasksWithoutEvidence = $scopeTasks->pluck('id')->filter(function ($taskId) use ($taskApprovals): bool {
                $approval = $taskApprovals[$taskId]
                    ?? $taskApprovals[(string) $taskId]
                    ?? $taskApprovals['task_'.$taskId]
                    ?? null;

                return ! is_array($approval)
                    || collect($approval['attachments'] ?? [])->doesntContain(
                        fn ($attachment): bool => is_array($attachment)
                            && is_numeric($attachment['docId'] ?? null)
                    );
            });
            if ($tasksWithoutEvidence->isNotEmpty()) {
                throw new Exception('Setiap task dalam scope SIT ulang wajib memiliki lampiran bukti pengujian baru.');
            }

            $evidenceDocumentIds = $scopeTasks->pluck('id')
                ->flatMap(function ($taskId) use ($taskApprovals) {
                    $approval = $taskApprovals[$taskId]
                        ?? $taskApprovals[(string) $taskId]
                        ?? $taskApprovals['task_'.$taskId]
                        ?? [];

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
            $requiredDeveloperIds = $scopeTasks->pluck('assignee_id')
                ->filter()
                ->map(fn ($id) => (int) $id)
                ->unique();
            $approvedDeveloperIds = collect($approvals['developer']['developers'] ?? [])
                ->map(fn (array $approval): int => (int) ($approval['userId'] ?? $approval['approvedById'] ?? 0))
                ->filter()
                ->unique();
            if ($requiredDeveloperIds->diff($approvedDeveloperIds)->isNotEmpty()) {
                throw new Exception('Semua developer dalam scope SIT ulang wajib memberikan persetujuan.');
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

        if ($targetStatus !== ProjectStatus::DEV_COMPLETED || $currentStatus !== ProjectStatus::UAT_IN_PROGRESS->value) {
            return;
        }

        $sitUatData = (array) $project->sit_uat_data;
        $summary = (array) ($sitUatData['uat2_summary'] ?? []);

        if ((int) ($sitUatData['activeUatStep'] ?? 1) < 3 || empty($summary['conclusion'])) {
            throw new Exception('Eksekusi UAT Tahap 2 wajib diselesaikan sebelum proyek dinyatakan DEV_COMPLETED.');
        }

        if (($sitUatData['uat2_resume_after_sit'] ?? false) === true) {
            throw new Exception('Revisi mayor UAT dan pengujian SIT ulang harus diselesaikan terlebih dahulu.');
        }

        if (($sitUatData['uat2_verification_mode'] ?? false) === true) {
            throw new Exception('Verifikasi user atas perbaikan Mayor UAT harus diselesaikan terlebih dahulu.');
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
            ProjectStatus::READY_FOR_UAT->value                         => $rolesToNotify = ['business_user', 'project_manager', 'super_admin'],
            ProjectStatus::UAT_PASSED->value                            => $rolesToNotify = ['project_manager', 'super_admin'],
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
