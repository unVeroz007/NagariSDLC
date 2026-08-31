<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\TestingTrack;
use App\Enums\TrackStatus;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Sumber kebenaran isolasi data proyek per role: satu definisi dipakai penyaring
 * daftar (index) dan pemeriksa akses tunggal (show/update) agar keduanya tak pernah beda.
 */
class ProjectAccessService
{
    /** Role pengawas: lihat seluruh portofolio (admin sistem, go-live, disposisi Fase 1). */
    public const OVERSIGHT_ROLES = [
        'super_admin',
        'head_of_it',
        'lead_group',
    ];

    /** Wewenang Development Lead: berbasis fase, bukan personal (tak ada kolom `dev_lead_id`). */
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
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
    ];

    /** Wewenang jalur QA. Mulai READY_FOR_QA — sebelum itu bukan urusan QA. */
    private const QA_PHASE_STATUSES = [
        ProjectStatus::READY_FOR_QA->value,
        ProjectStatus::QA_IN_PROGRESS->value,
        ProjectStatus::QA_PASSED->value,
        ProjectStatus::RETURN_TO_DEV->value,
        ProjectStatus::CYBER_IN_PROGRESS->value,
        ProjectStatus::CYBER_PASSED->value,
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
    ];

    /** Wewenang jalur Keamanan Siber. Mulai DEV_COMPLETED (bisa paralel dengan QA). */
    private const CYBER_PHASE_STATUSES = [
        ProjectStatus::DEV_COMPLETED->value,
        ProjectStatus::READY_FOR_QA->value,
        ProjectStatus::QA_IN_PROGRESS->value,
        ProjectStatus::QA_PASSED->value,
        ProjectStatus::RETURN_TO_DEV->value,
        ProjectStatus::CYBER_IN_PROGRESS->value,
        ProjectStatus::CYBER_PASSED->value,
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
    ];

    /**
     * Kolom jalur sudah bergerak = jalur jadi urusan timnya. `projects.status` cuma penunjuk
     * siklus bergiliran, jadi tanpa cek kolom jalur, pengajuan bisa tak terlihat oleh tim.
     */
    private const TRACK_ENGAGED_STATUSES = [
        TrackStatus::SUBMITTED->value,
        TrackStatus::IN_PROGRESS->value,
        TrackStatus::REVIEW->value,
        TrackStatus::PASSED->value,
        TrackStatus::FAILED->value,
    ];

    /**
     * Role penetap penanggung jawab (disposisi, bukan edit biasa). Lebih sempit dari
     * `canUpdate()` yang harus meloloskan PM/analis proyek untuk mengisi hasil kerjanya.
     */
    public const PERSONNEL_ASSIGNER_ROLES = [
        'super_admin',
        'head_of_it',
        'lead_group',
        'development_lead',
    ];

    /** Role boleh lihat seluruh proyek tanpa penyaringan? */
    public function hasOversightAccess(?User $user): bool
    {
        return in_array($user?->role?->name, self::OVERSIGHT_ROLES, true);
    }

    /**
     * Boleh ganti PM/analis penanggung jawab? Tanpa gerbang ini, PM bisa mengalihkan
     * proyeknya sendiri tanpa lewat Dev Lead/Kadiv, merusak rantai disposisi pada audit.
     */
    public function canAssignPersonnel(?User $user): bool
    {
        return in_array($user?->role?->name, self::PERSONNEL_ASSIGNER_ROLES, true);
    }

    /**
     * Boleh tulis ulang alokasi tim? Disamakan dengan disposisi personel; PM diloloskan
     * hanya untuk proyeknya sendiri. `canUpdate()` tak dipakai sendirian di sini karena
     * ia meloloskan jalur pengujian, sehingga QA/Pentester bisa menimpa susunan tim dev.
     */
    public function canAllocateTeam(?User $user, Project $project): bool
    {
        if ($this->canAssignPersonnel($user)) {
            return true;
        }

        return in_array($user?->role?->name, ['project_manager', 'dev_analyst'], true)
            && (int) $project->pm_id === (int) $user->id;
    }

    /**
     * Batasi daftar proyek pada yang boleh dilihat pengguna. Wajib konsisten dengan
     * `canView()`: setiap baris yang lolos di sini harus lolos `canView()` juga.
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

            // Grup Perencanaan & QA: `analyst`/`qa_tester` orang yang sama di dua fase, cakupan digabung.
            'analyst', 'qa_tester' => $this->applyPlanningQaGroupScope($query, $user),

            // PM = Analis Pengembangan (Fase 2), penugasan di `projects.pm_id`. `dev_analyst`
            // (nama role sisi frontend, tak ada di enum backend) ikut dicocokkan agar hasilnya sama.
            'project_manager', 'dev_analyst' => $query->where('pm_id', $user->id),

            'development_lead' => $query->where(function (Builder $scoped) use ($user): void {
                $scoped->whereIn('status', self::DEVELOPMENT_PHASE_STATUSES)
                    ->orWhere('pm_id', $user->id)
                    ->orWhere('created_by', $user->id);
            }),

            'developer' => $query->where(function (Builder $scoped) use ($user): void {
                $scoped->whereHas('teamMembers', fn (Builder $member) => $member->where('user_id', $user->id))
                    ->orWhereHas('tasks', fn (Builder $task) => $task->where('assignee_id', $user->id));
            }),

            'qa_lead' => $this->applyTestingTrackScope($query, $user, TestingTrack::QA),

            'cyber_lead', 'pentester' => $this->applyTestingTrackScope($query, $user, TestingTrack::CYBER),

            // Role tak dikenal: fail-closed, jangan bocorkan portofolio.
            default => $query->whereRaw('1 = 0'),
        };
    }

    /**
     * Penyaring untuk Grup Perencanaan & QA (analis yang sama di dua fase). Gabungan:
     * (1) proyek Fase 1 yang didisposisikan padanya (`analyst_id`, per-orang); (2) seluruh
     * cakupan jalur QA (antrean bersama). Tanpa gabungan, satu pekerjaan sahnya hilang dari daftar.
     *
     * @param  Builder<Project>  $query
     * @return Builder<Project>
     */
    private function applyPlanningQaGroupScope(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $scoped) use ($user): void {
            $scoped->where('analyst_id', $user->id)
                ->orWhere(fn (Builder $qa) => $this->applyTrackPredicate($qa, $user, TestingTrack::QA));
        });
    }

    /**
     * Penyaring satu jalur pengujian. OR tiga jalan masuk: (1) `status` di fase jalur ini;
     * (2) kolom jalurnya sudah bergerak (celah di `TRACK_ENGAGED_STATUSES`); (3) pengguna
     * penerima disposisi jalur ini.
     *
     * @param  Builder<Project>  $query
     * @return Builder<Project>
     */
    private function applyTestingTrackScope(Builder $query, User $user, TestingTrack $track): Builder
    {
        return $query->where(fn (Builder $scoped) => $this->applyTrackPredicate($scoped, $user, $track));
    }

    /**
     * Isi predikat satu jalur tanpa membungkus, agar bisa jadi cabang OR di grup lain
     * (`applyPlanningQaGroupScope()`). Versi terbungkus `where()` selalu ter-AND.
     *
     * @param  Builder<Project>  $query
     * @return Builder<Project>
     */
    private function applyTrackPredicate(Builder $query, User $user, TestingTrack $track): Builder
    {
        $phaseStatuses = $track === TestingTrack::QA
            ? self::QA_PHASE_STATUSES
            : self::CYBER_PHASE_STATUSES;

        return $query->whereIn('status', $phaseStatuses)
            ->orWhereIn($track->statusColumn(), self::TRACK_ENGAGED_STATUSES)
            ->orWhere($track->assigneeColumn(), $user->id);
    }

    /**
     * Boleh baca satu proyek? Cerminan `applyVisibilityScope()` untuk satu baris, plus
     * keterlibatan personal yang selalu memberi akses (pemohon, PM, analis, tim, penerima
     * task/disposisi, approver UAT) agar tak hilang akses saat status bergerak maju.
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
            // Grup Perencanaan & QA: sisi Fase 1 lewat `isPersonallyInvolved()`; baris ini
            // menambah sisi QA agar sejalan dengan daftar (kalau tidak, muncul tapi gagal dibuka).
            'analyst', 'qa_tester', 'qa_lead' => in_array($status, self::QA_PHASE_STATUSES, true)
                || $this->isTrackEngaged($project, TestingTrack::QA),
            'development_lead' => in_array($status, self::DEVELOPMENT_PHASE_STATUSES, true),
            'cyber_lead', 'pentester' => in_array($status, self::CYBER_PHASE_STATUSES, true)
                || $this->isTrackEngaged($project, TestingTrack::CYBER),
            default => false,
        };
    }

    /**
     * Boleh ubah field proyek? Sengaja lebih ketat dari `canView()`: baca fase QA wajar,
     * menimpa `analyst_result` milik analis lain tidak — jadi bertumpu pada keterlibatan
     * personal. Melengkapi, bukan mengganti, gerbang transisi status di `ProjectWorkflowService`.
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
            // Dev Lead alokasikan tim proyek fase dev yang belum punya PM: tulis tanpa keterlibatan personal.
            'development_lead' => in_array($status, self::DEVELOPMENT_PHASE_STATUSES, true),

            // Jalur pengujian catat hasil pada proyek yang masuk fasenya (atau jalurnya sudah
            // diajukan). `analyst` ikut (anggota Grup Perencanaan & QA, bisa terima disposisi QA);
            // terbatas fase QA, kerja Fase 1 milik analis lain tetap tertutup.
            'analyst', 'qa_lead', 'qa_tester' => in_array($status, self::QA_PHASE_STATUSES, true)
                || $this->isTrackEngaged($project, TestingTrack::QA),
            'cyber_lead', 'pentester' => in_array($status, self::CYBER_PHASE_STATUSES, true)
                || $this->isTrackEngaged($project, TestingTrack::CYBER),

            default => false,
        };
    }

    /** Jalur ini sudah diajukan, dikerjakan, atau diputuskan. */
    private function isTrackEngaged(Project $project, TestingTrack $track): bool
    {
        return in_array($project->trackStatus($track)->value, self::TRACK_ENGAGED_STATUSES, true);
    }

    /** Keterlibatan langsung pengguna pada proyek, lepas dari role dan fase. */
    private function isPersonallyInvolved(User $user, Project $project): bool
    {
        $userId = (int) $user->id;

        if ((int) $project->created_by === $userId
            || (int) $project->pm_id === $userId
            || (int) $project->analyst_id === $userId
            || (int) $project->qa_assignee_id === $userId
            || (int) $project->cyber_assignee_id === $userId) {
            return true;
        }

        if ($project->teamMembers()->where('user_id', $userId)->exists()) {
            return true;
        }

        if ($project->tasks()->where('assignee_id', $userId)->exists()) {
            return true;
        }

        // Approver UAT internal harus bisa membuka proyek yang menunggu keputusannya.
        return $project->uatApprovalRounds()
            ->whereHas('approvers', fn (Builder $approver) => $approver->where('user_id', $userId))
            ->exists();
    }
}
