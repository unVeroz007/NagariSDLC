<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\TestingTrack;
use App\Enums\TrackStatus;
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
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
    ];

    /**
     * Nilai kolom jalur yang berarti jalur itu sudah menjadi urusan tim pengujiannya.
     *
     * Daftar fase di atas dihitung dari `projects.status`, yang hanyalah satu penunjuk
     * siklus dipegang bergiliran oleh kedua jalur pengujian. Akibatnya sebuah proyek
     * bisa sudah diajukan ke Audit Keamanan Siber sementara penunjuknya masih berada di
     * fase pengembangan — dan tanpa pemeriksaan kolom jalur, pengajuan itu tidak terlihat
     * sama sekali oleh tim yang harus mengerjakannya.
     */
    private const TRACK_ENGAGED_STATUSES = [
        TrackStatus::SUBMITTED->value,
        TrackStatus::IN_PROGRESS->value,
        TrackStatus::REVIEW->value,
        TrackStatus::PASSED->value,
        TrackStatus::FAILED->value,
    ];

    /**
     * Role yang berwenang menetapkan penanggung jawab proyek.
     *
     * Penetapan PM dan analis adalah keputusan disposisi, bukan penyuntingan biasa:
     * Kadiv mendisposisikan analis pada Fase 1, dan Development Lead menetapkan
     * Analis Pengembangan (PM) sebelum pengembangan dimulai. Karena itu daftar ini
     * lebih sempit daripada `canUpdate()`, yang memang harus meloloskan PM dan
     * analis proyek agar mereka bisa mengisi hasil kerjanya sendiri.
     */
    public const PERSONNEL_ASSIGNER_ROLES = [
        'super_admin',
        'head_of_it',
        'lead_group',
        'development_lead',
    ];

    /**
     * Apakah role ini berwenang melihat seluruh proyek tanpa penyaringan?
     */
    public function hasOversightAccess(?User $user): bool
    {
        return in_array($user?->role?->name, self::OVERSIGHT_ROLES, true);
    }

    /**
     * Apakah pengguna berwenang mengganti PM atau analis penanggung jawab?
     *
     * Tanpa gerbang ini, PM proyek — yang lolos `canUpdate()` karena keterlibatan
     * personalnya — dapat mengalihkan proyeknya sendiri ke orang lain tanpa melalui
     * Development Lead maupun Kadiv, sehingga rantai disposisi pada jejak audit
     * menjadi tidak dapat dipercaya.
     */
    public function canAssignPersonnel(?User $user): bool
    {
        return in_array($user?->role?->name, self::PERSONNEL_ASSIGNER_ROLES, true);
    }

    /**
     * Apakah pengguna boleh menulis ulang alokasi tim proyek ini?
     *
     * Alokasi tim menghapus lalu membuat ulang seluruh baris `project_team_members`,
     * jadi wewenangnya disamakan dengan disposisi personel: Super Admin, Head of IT,
     * Kadiv, dan Development Lead. Analis Pengembangan (PM) ikut diloloskan, tetapi
     * hanya untuk proyek yang memang dipegangnya — dua layar yang memanggil endpoint
     * ini adalah halaman Alokasi milik PM dan Workspace Development Lead.
     *
     * `canUpdate()` sengaja tidak dipakai sendirian di sini. Aturan itu meloloskan
     * jalur pengujian untuk setiap proyek yang masuk fasenya, sehingga QA Tester atau
     * Pentester dapat menimpa susunan tim pengembang yang bukan wewenangnya.
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

            // Grup Perencanaan dan Quality Assurance: `analyst` dan `qa_tester` adalah
            // kumpulan analis yang sama pada dua fase berbeda, jadi cakupannya digabung.
            // Lihat `applyPlanningQaGroupScope()`.
            'analyst', 'qa_tester' => $this->applyPlanningQaGroupScope($query, $user),

            // Project Manager = Analis Pengembangan (Fase 2). Satu orang, satu role,
            // satu kolom penugasan: `projects.pm_id`. Nama role `dev_analyst` hanya
            // hidup di router/menu frontend dan tidak ada di enum backend, tetapi
            // ikut dicocokkan agar kedua sebutan selalu memberi hasil yang sama.
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

            // Role tidak dikenal: tutup total. Lebih baik daftar kosong daripada
            // membocorkan seluruh portofolio karena satu role belum terdaftar.
            default => $query->whereRaw('1 = 0'),
        };
    }

    /**
     * Penyaring daftar proyek untuk anggota Grup Perencanaan dan Quality Assurance.
     *
     * Grup ini menaungi dua fase dengan kumpulan analis yang sama
     * (`UserRole::PLANNING_QA_ANALYST_ROLES`): analisis perencanaan di Fase 1 dan
     * pengujian QA di Fase 3. Karena orangnya sama, cakupannya adalah gabungan kedua
     * pekerjaan itu:
     *
     *   1. proyek Fase 1 yang didisposisikan kepadanya (`projects.analyst_id`) — tetap
     *      per-orang, karena hasil analisis satu orang tidak boleh ditimpa yang lain;
     *   2. seluruh cakupan jalur QA (lihat `applyTestingTrackScope()`) — antrean QA
     *      memang antrean bersama, dan tanpa ini seorang analis Perencanaan yang
     *      menerima disposisi QA tidak akan menemukan proyeknya di daftar mana pun.
     *
     * Tanpa penggabungan ini, daftar akan menyembunyikan salah satu dari dua pekerjaan
     * yang sah dimiliki orang yang sama, tergantung nama role-nya saja.
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
     * Penyaring daftar proyek untuk satu jalur pengujian.
     *
     * Tiga jalan masuk, digabung dengan OR:
     *
     *   1. `projects.status` berada di fase jalur ini — proyek yang memang sedang
     *      dipegang jalur ini pada siklus utama;
     *   2. kolom jalurnya sendiri sudah bergerak — menutup celah penunjuk siklus
     *      yang dijelaskan pada `TRACK_ENGAGED_STATUSES`;
     *   3. pengguna adalah penerima disposisi jalur ini — tugas pribadi tidak boleh
     *      hilang dari daftarnya hanya karena status proyek sudah bergerak maju.
     *
     * @param  Builder<Project>  $query
     * @return Builder<Project>
     */
    private function applyTestingTrackScope(Builder $query, User $user, TestingTrack $track): Builder
    {
        return $query->where(fn (Builder $scoped) => $this->applyTrackPredicate($scoped, $user, $track));
    }

    /**
     * Isi penyaring satu jalur pengujian, tanpa membungkusnya sendiri.
     *
     * Dipisahkan dari `applyTestingTrackScope()` supaya predikat yang sama bisa dipasang
     * sebagai cabang OR di dalam grup lain — dipakai `applyPlanningQaGroupScope()`.
     * Bila pemanggil memakai `applyTestingTrackScope()` yang membungkus dengan `where()`,
     * predikatnya selalu ter-AND dan tidak dapat menjadi alternatif.
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
     * Apakah pengguna boleh membaca satu proyek ini?
     *
     * Dipakai `ProjectController@show`. Cerminan `applyVisibilityScope()` untuk satu
     * baris, ditambah keterlibatan personal yang selalu memberi akses baca: pemohon,
     * PM, analis yang ditugaskan, anggota tim, penerima task, penerima disposisi
     * pengujian, dan approver UAT. Tanpa jalur personal itu, seseorang bisa kehilangan
     * akses ke proyek yang sedang menunggu keputusannya hanya karena statusnya sudah
     * bergerak maju.
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
            // Grup Perencanaan dan Quality Assurance. Pekerjaan Fase 1 sudah tertangkap
            // `isPersonallyInvolved()` lewat `projects.analyst_id`; baris ini menambahkan
            // sisi QA-nya, sama seperti yang diberikan `applyPlanningQaGroupScope()` pada
            // daftar. Tanpa keduanya sejalan, proyek bisa muncul di daftar lalu gagal
            // dibuka.
            'analyst', 'qa_tester', 'qa_lead' => in_array($status, self::QA_PHASE_STATUSES, true)
                || $this->isTrackEngaged($project, TestingTrack::QA),
            'development_lead' => in_array($status, self::DEVELOPMENT_PHASE_STATUSES, true),
            'cyber_lead', 'pentester' => in_array($status, self::CYBER_PHASE_STATUSES, true)
                || $this->isTrackEngaged($project, TestingTrack::CYBER),
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

            // Jalur pengujian mencatat hasil pada proyek yang masuk fasenya, atau pada
            // proyek yang jalurnya sudah diajukan meski penunjuk siklus belum bergerak.
            //
            // `analyst` ikut disertakan sebagai anggota Grup Perencanaan dan Quality
            // Assurance: ia boleh menerima disposisi QA, jadi ia harus bisa menulis hasil
            // pengujiannya. Wewenang ini hanya berlaku pada proyek fase QA — pekerjaan
            // Fase 1 milik analis lain tetap tertutup karena statusnya di luar daftar ini.
            'analyst', 'qa_lead', 'qa_tester' => in_array($status, self::QA_PHASE_STATUSES, true)
                || $this->isTrackEngaged($project, TestingTrack::QA),
            'cyber_lead', 'pentester' => in_array($status, self::CYBER_PHASE_STATUSES, true)
                || $this->isTrackEngaged($project, TestingTrack::CYBER),

            default => false,
        };
    }

    /**
     * Jalur pengujian ini sudah diajukan, dikerjakan, atau diputuskan.
     */
    private function isTrackEngaged(Project $project, TestingTrack $track): bool
    {
        return in_array($project->trackStatus($track)->value, self::TRACK_ENGAGED_STATUSES, true);
    }

    /**
     * Keterlibatan langsung pengguna pada proyek, terlepas dari role dan fase.
     */
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

        // Approver UAT internal harus tetap bisa membuka proyek yang menunggu
        // keputusannya, termasuk ketika ia tidak terlibat lewat jalur lain.
        return $project->uatApprovalRounds()
            ->whereHas('approvers', fn (Builder $approver) => $approver->where('user_id', $userId))
            ->exists();
    }
}
