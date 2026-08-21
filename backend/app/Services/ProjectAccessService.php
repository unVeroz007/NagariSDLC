<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Satu sumber kebenaran untuk isolasi data proyek per role.
 *
 * Sebelumnya aturan visibilitas hanya hidup sebagai rangkaian `elseif` di dalam
 * `ProjectController@index`, sementara `show()` dan `update()` tidak memeriksa apa pun.
 * Akibatnya daftar proyek bisa disaring rapi tetapi pengguna masih dapat membaca dan
 * menimpa proyek milik orang lain dengan menebak ID lewat endpoint langsung.
 *
 * Service ini memusatkan aturan tersebut sehingga satu definisi dipakai bersama oleh
 * penyaring query (untuk daftar) dan pemeriksa akses tunggal (untuk baca/tulis satu
 * proyek). Menambah role baru cukup dilakukan di satu tempat, dan daftar tidak akan
 * pernah lagi mengembangkan lebih banyak proyek daripada yang boleh dibuka.
 */
class ProjectAccessService
{
    /**
     * Role pengawas: berwenang melihat seluruh portofolio proyek lintas fase.
     *
     * Super Admin (administrasi sistem), Head of IT (persetujuan go-live), dan
     * Lead Group / Kadiv (disposisi & verifikasi Fase 1) memang membutuhkan
     * pandangan menyeluruh untuk menjalankan tugasnya.
     */
    public const OVERSIGHT_ROLES = [
        'super_admin',
        'head_of_it',
        'lead_group',
    ];

    /**
     * Status yang berada dalam wewenang Development Lead.
     *
     * Development Lead mengalokasikan tim dan mengawasi seluruh proyek pada fase
     * pengembangan, sehingga isolasinya berbasis fase — bukan penugasan personal.
     * Tabel `projects` tidak punya kolom `dev_lead_id`, jadi tidak ada penugasan
     * per-orang yang bisa disaring untuk role ini.
     */
    private const DEVELOPMENT_PHASE_STATUSES = [
        ProjectStatus::ANALYSIS_APPROVED->value,
        ProjectStatus::READY_FOR_DEVELOPMENT->value,
        ProjectStatus::DEV_ANALYSIS->value,
        ProjectStatus::DEV_ANALYSIS_DONE->value,
        ProjectStatus::IN_DEVELOPMENT->value,
        ProjectStatus::SIT_IN_PROGRESS->value,
        ProjectStatus::SIT_PASSED->value,
        ProjectStatus::SIT_REVISION->value,
        ProjectStatus::UAT_IN_PROGRESS->value,
        ProjectStatus::UAT_REVISION_SIT->value,
        ProjectStatus::UAT_REVISION_DEV->value,
        ProjectStatus::DEV_COMPLETED->value,
        ProjectStatus::RETURN_TO_DEV->value,
        ProjectStatus::READY_FOR_QA->value,
        ProjectStatus::QA_IN_PROGRESS->value,
        ProjectStatus::QA_PASSED->value,
        ProjectStatus::CYBER_IN_PROGRESS->value,
        ProjectStatus::CYBER_PASSED->value,
        ProjectStatus::READY_FOR_UAT->value,
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
    ];

    /**
     * Status yang berada dalam wewenang jalur QA.
     *
     * Dimulai dari READY_FOR_QA — proyek yang belum diserahkan ke QA bukan urusan QA.
     */
    private const QA_PHASE_STATUSES = [
        ProjectStatus::READY_FOR_QA->value,
        ProjectStatus::QA_IN_PROGRESS->value,
        ProjectStatus::QA_PASSED->value,
        ProjectStatus::RETURN_TO_DEV->value,
        ProjectStatus::CYBER_IN_PROGRESS->value,
        ProjectStatus::CYBER_PASSED->value,
        ProjectStatus::READY_FOR_UAT->value,
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
    ];

    /**
     * Status yang berada dalam wewenang jalur Keamanan Siber.
     *
     * Dimulai dari DEV_COMPLETED karena audit siber dapat berjalan paralel dengan QA.
     */
    private const CYBER_PHASE_STATUSES = [
        ProjectStatus::DEV_COMPLETED->value,
        ProjectStatus::READY_FOR_QA->value,
        ProjectStatus::QA_IN_PROGRESS->value,
        ProjectStatus::QA_PASSED->value,
        ProjectStatus::RETURN_TO_DEV->value,
        ProjectStatus::CYBER_IN_PROGRESS->value,
        ProjectStatus::CYBER_PASSED->value,
        ProjectStatus::READY_FOR_UAT->value,
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
    ];

    /**
     * Status fase analisis yang relevan bagi Analyst Pengembangan (dev_analyst).
     */
    private const DEV_ANALYST_PHASE_STATUSES = [
        ProjectStatus::ANALYSIS_APPROVED->value,
        ProjectStatus::READY_FOR_DEVELOPMENT->value,
        ProjectStatus::DEV_ANALYSIS->value,
        ProjectStatus::DEV_ANALYSIS_DONE->value,
    ];

    /**
     * Apakah role ini berwenang melihat seluruh proyek tanpa penyaringan?
     */
    public function hasOversightAccess(?User $user): bool
    {
        return in_array($user?->role?->name, self::OVERSIGHT_ROLES, true);
    }

    /**
     * Batasi query daftar proyek pada apa yang boleh dilihat pengguna.
     *
     * Dipakai `ProjectController@index`. Harus tetap konsisten dengan `canView()`:
     * setiap proyek yang lolos penyaring ini wajib lolos `canView()` juga, agar
     * pengguna tidak pernah melihat baris di daftar yang gagal ia buka.
     *
     * @param  Builder<Project>  $query
     * @return Builder<Project>
     */
    public function applyVisibilityScope(Builder $query, User $user): Builder
    {
        if ($this->hasOversightAccess($user)) {
            return $query;
        }

        $roleName = $user->role?->name;

        return match ($roleName) {
            'business_user' => $query->where('created_by', $user->id),

            // System Analyst: HANYA proyek yang didisposisikan kepadanya.
            // Proyek analis lain — termasuk yang masih PENDING dan belum
            // didisposisikan — bukan wewenangnya.
            'analyst' => $query->where('analyst_id', $user->id),

            // Analyst Pengembangan: proyek yang dia kelola sebagai PM di semua
            // tahap, ditambah konteks fase analisis pengembangan, ditambah proyek
            // SIT yang menunggu persetujuannya sebagai analis.
            'dev_analyst' => $query->where(function (Builder $scoped) use ($user): void {
                $scoped->where('pm_id', $user->id)
                    ->orWhere('analyst_id', $user->id)
                    ->orWhereIn('status', self::DEV_ANALYST_PHASE_STATUSES);
            }),

            'project_manager' => $query->where('pm_id', $user->id),

            'development_lead' => $query->where(function (Builder $scoped) use ($user): void {
                $scoped->whereIn('status', self::DEVELOPMENT_PHASE_STATUSES)
                    ->orWhere('pm_id', $user->id)
                    ->orWhere('created_by', $user->id);
            }),

            'developer' => $query->where(function (Builder $scoped) use ($user): void {
                $scoped->whereHas('teamMembers', fn (Builder $member) => $member->where('user_id', $user->id))
                    ->orWhereHas('tasks', fn (Builder $task) => $task->where('assignee_id', $user->id));
            }),

            'qa_lead', 'qa_tester' => $query->whereIn('status', self::QA_PHASE_STATUSES),

            'cyber_lead', 'pentester' => $query->whereIn('status', self::CYBER_PHASE_STATUSES),

            // Role tidak dikenal: tutup total. Lebih baik daftar kosong daripada
            // membocorkan seluruh portofolio karena satu role belum terdaftar.
            default => $query->whereRaw('1 = 0'),
        };
    }

    /**
     * Apakah pengguna boleh membaca satu proyek ini?
     *
     * Dipakai `ProjectController@show`. Cerminan `applyVisibilityScope()` untuk satu
     * baris, ditambah keterlibatan personal yang selalu memberi akses baca: pemohon,
     * PM, analis yang ditugaskan, anggota tim, penerima task, dan approver UAT.
     * Tanpa jalur personal itu, seseorang bisa kehilangan akses ke proyek yang
     * sedang menunggu keputusannya hanya karena statusnya sudah bergerak maju.
     */
    public function canView(User $user, Project $project): bool
    {
        if ($this->hasOversightAccess($user)) {
            return true;
        }

        if ($this->isPersonallyInvolved($user, $project)) {
            return true;
        }

        $status = $project->status instanceof ProjectStatus
            ? $project->status->value
            : (string) $project->status;

        return match ($user->role?->name) {
            'analyst' => false,
            'dev_analyst' => in_array($status, self::DEV_ANALYST_PHASE_STATUSES, true),
            'development_lead' => in_array($status, self::DEVELOPMENT_PHASE_STATUSES, true),
            'qa_lead', 'qa_tester' => in_array($status, self::QA_PHASE_STATUSES, true),
            'cyber_lead', 'pentester' => in_array($status, self::CYBER_PHASE_STATUSES, true),
            default => false,
        };
    }

    /**
     * Apakah pengguna boleh mengubah field proyek ini?
     *
     * Sengaja lebih ketat daripada `canView()`. Membaca proyek fase QA sebagai
     * konteks kerja itu wajar; menimpa `analyst_result` proyek yang ditangani
     * analis lain tidak. Aturan tulis karena itu bertumpu pada keterlibatan
     * personal, bukan pada fase proyek.
     *
     * Pemeriksaan ini melengkapi — bukan mengganti — pemeriksaan wewenang transisi
     * status di `ProjectWorkflowService`, yang tetap menjadi satu-satunya gerbang
     * untuk perubahan status.
     */
    public function canUpdate(User $user, Project $project): bool
    {
        if ($this->hasOversightAccess($user)) {
            return true;
        }

        if ($this->isPersonallyInvolved($user, $project)) {
            return true;
        }

        $status = $project->status instanceof ProjectStatus
            ? $project->status->value
            : (string) $project->status;

        return match ($user->role?->name) {
            // Development Lead mengalokasikan tim untuk proyek fase pengembangan
            // yang belum punya PM, sehingga butuh tulis tanpa keterlibatan personal.
            'development_lead' => in_array($status, self::DEVELOPMENT_PHASE_STATUSES, true),

            // Jalur pengujian mencatat hasil pada proyek yang masuk fasenya.
            'qa_lead', 'qa_tester' => in_array($status, self::QA_PHASE_STATUSES, true),
            'cyber_lead', 'pentester' => in_array($status, self::CYBER_PHASE_STATUSES, true),

            default => false,
        };
    }

    /**
     * Keterlibatan langsung pengguna pada proyek, terlepas dari role dan fase.
     */
    private function isPersonallyInvolved(User $user, Project $project): bool
    {
        $userId = (int) $user->id;

        if ((int) $project->created_by === $userId
            || (int) $project->pm_id === $userId
            || (int) $project->analyst_id === $userId) {
            return true;
        }

        if ($project->teamMembers()->where('user_id', $userId)->exists()) {
            return true;
        }

        if ($project->tasks()->where('assignee_id', $userId)->exists()) {
            return true;
        }

        // Approver UAT internal harus tetap bisa membuka proyek yang menunggu
        // keputusannya, termasuk ketika ia tidak terlibat lewat jalur lain.
        return $project->uatApprovalRounds()
            ->whereHas('approvers', fn (Builder $approver) => $approver->where('user_id', $userId))
            ->exists();
    }
}
