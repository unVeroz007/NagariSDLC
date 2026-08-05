<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectStatusHistory;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\DB;

class ProjectWorkflowService
{
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
            ProjectStatus::CYBER_IN_PROGRESS->value,
        ],
        ProjectStatus::READY_FOR_QA->value => [
            ProjectStatus::QA_IN_PROGRESS->value,
            ProjectStatus::CYBER_IN_PROGRESS->value,
            ProjectStatus::DEV_COMPLETED->value,
            ProjectStatus::IN_DEVELOPMENT->value, // Mundur
        ],
        ProjectStatus::QA_IN_PROGRESS->value => [
            ProjectStatus::QA_PASSED->value,
            ProjectStatus::CYBER_IN_PROGRESS->value, // Paralel Cyber Audit
            ProjectStatus::RETURN_TO_DEV->value, // Mundur (Defect QA)
            ProjectStatus::READY_FOR_QA->value,
        ],
        ProjectStatus::QA_PASSED->value => [
            ProjectStatus::CYBER_IN_PROGRESS->value,
            ProjectStatus::CYBER_PASSED->value,
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
        ProjectStatus::READY_FOR_DEVELOPMENT->value => [UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::DEV_ANALYSIS->value => [UserRole::DEVELOPMENT_LEAD->value, UserRole::ANALYST->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::DEV_ANALYSIS_DONE->value => [UserRole::ANALYST->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::IN_DEVELOPMENT->value => [UserRole::PROJECT_MANAGER->value, UserRole::DEVELOPER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::SIT_IN_PROGRESS->value => [UserRole::PROJECT_MANAGER->value, UserRole::DEVELOPMENT_LEAD->value, UserRole::DEVELOPER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::SIT_PASSED->value => [UserRole::PROJECT_MANAGER->value, UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::SIT_REVISION->value => [UserRole::PROJECT_MANAGER->value, UserRole::DEVELOPMENT_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_IN_PROGRESS->value => [UserRole::PROJECT_MANAGER->value, UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_REVISION_SIT->value => [UserRole::PROJECT_MANAGER->value, UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_REVISION_DEV->value => [UserRole::PROJECT_MANAGER->value, UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::DEV_COMPLETED->value => [UserRole::PROJECT_MANAGER->value, UserRole::BUSINESS_USER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::RETURN_TO_DEV->value => [UserRole::QA_LEAD->value, UserRole::QA_TESTER->value, UserRole::CYBER_LEAD->value, UserRole::PENTESTER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::READY_FOR_QA->value => [UserRole::PROJECT_MANAGER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::QA_IN_PROGRESS->value => [UserRole::QA_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::QA_PASSED->value => [UserRole::QA_TESTER->value, UserRole::QA_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::CYBER_IN_PROGRESS->value => [UserRole::CYBER_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::CYBER_PASSED->value => [UserRole::PENTESTER->value, UserRole::CYBER_LEAD->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::READY_FOR_UAT->value => [UserRole::PROJECT_MANAGER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::UAT_PASSED->value => [UserRole::BUSINESS_USER->value, UserRole::PROJECT_MANAGER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::PENDING_GOLIVE->value => [UserRole::PROJECT_MANAGER->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::LIVE_PRODUCTION->value => [UserRole::HEAD_OF_IT->value, UserRole::SUPER_ADMIN->value],
        ProjectStatus::ON_HOLD->value => [UserRole::PROJECT_MANAGER->value, UserRole::SUPER_ADMIN->value],
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
            throw new Exception("Proyek sudah berada pada status '{$nextStatus}'.");
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

        // 4. Eksekusi Transisi dalam DB Transaction
        return DB::transaction(function () use ($project, $currentStatus, $targetStatus, $user, $notes) {
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

            return $project->fresh(['creator', 'pm', 'analyst', 'division', 'statusHistories']);
        });
    }
}
