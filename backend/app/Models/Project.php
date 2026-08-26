<?php

namespace App\Models;

use App\Enums\CyberCheckType;
use App\Enums\ProjectStatus;
use App\Enums\TestingTrack;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class Project extends Model
{
    /**
     * `SoftDeletes` menjaga agar penghapusan proyek tidak menyeret seluruh anaknya.
     *
     * Kunci asing anak-ke-`projects` bersifat `CASCADE`, jadi satu penghapusan
     * permanen ikut memusnahkan riwayat status, task, alokasi tim, laporan
     * pengujian, dokumen, pengajuan rilis, approval UAT, dan percakapan proyek.
     * Dengan penghapusan lunak, aturan cascade itu tidak lagi tersentuh alur
     * aplikasi dan seluruh bukti tata kelola tetap utuh.
     */
    use HasFactory, SoftDeletes;

    /**
     * Relasi yang wajib dimuat sebelum proyek dipaparkan lewat `ProjectResource`.
     *
     * Resource itu memaparkan penugasan jalur pengujian, laporan pengujian terakhir,
     * dan bukti yang dirujuknya. Semuanya hanya dibangun dari relasi yang sudah
     * dimuat — bila tidak dimuat, datanya kosong tanpa pesan kesalahan. Menaruh
     * daftarnya di satu tempat mencegah satu endpoint memaparkan lebih sedikit
     * informasi daripada endpoint lain hanya karena daftarnya lupa disamakan.
     *
     * @var list<string>
     */
    public const RESOURCE_RELATIONS = [
        'creator',
        'pm',
        'analyst',
        'division',
        'qaAssignee',
        'cyberAssignee',
        'documents.uploader',
        'testReports.tester',
        'testReports.reviewer',
        // Rencana rilis dan keputusan Quality Gate atasnya. Dimuat bersama daftar
        // proyek karena layar Quality Gate menilai kelengkapan rencana rilis dari
        // baris ini; tanpa eager load, penilaian itu memicu satu query per proyek.
        'releaseRequests.requester',
        'releaseRequests.approver',
        'releaseRequests.rejecter',
        // Role global tiap anggota tim ikut dimuat: `role_in_project` berupa teks
        // bebas, jadi penanda "developer" yang dapat dipercaya hanyalah role
        // penggunanya — dipakai `sitApprovalDeveloperIds()` dan dipaparkan pada
        // `team[].user_role` agar layar tidak perlu menebaknya dari teks bebas.
        'teamMembers.user.role',
        'statusHistories.changedBy',
        'tasks.assignee',
        'tasks.revisionRequester',
        // Putaran pengembalian QA / Keamanan Siber beserta pelakunya. Task perbaikannya
        // TIDAK dimuat ulang di sini: `ProjectResource` menyaringnya dari relasi `tasks`
        // yang sudah dimuat di atas, sehingga satu proyek tidak memuat task dua kali.
        'returnRounds.returnedBy',
        'returnRounds.resubmittedBy',
    ];

    protected $fillable = [
        'req_id',
        'title',
        'description',
        'contact_phone',
        'type',
        'project_type',
        'priority',
        'status',
        'created_by',
        'pm_id',
        'analyst_id',
        'division_id',
        'target_date',
        // Tenggat Rencana Bisnis Bank. Terpisah dari `target_date` (target internal
        // pengerjaan) karena tenggat RBB adalah komitmen tahunan bank dan hanya bermakna
        // untuk proyek `type = 'RBB'`.
        'rbb_deadline',
        'current_stage_deadline',
        'rejection_reason',
        'uat_notes',
        'analyst_result',
        'dev_analyst_result',
        'staging_url',
        'sit_uat_data',
        'qa_status',
        'cyber_status',
        'qa_assignee_id',
        'cyber_assignee_id',
        'cyber_check_type',
        'cyber_target_url',
        'cyber_source_code_ref',
        'team_allocated_by_pm',
    ];

    protected function casts(): array
    {
        return [
            'status' => ProjectStatus::class,
            'target_date' => 'date',
            'rbb_deadline' => 'date',
            'current_stage_deadline' => 'date',
            'analyst_result' => 'array',
            'dev_analyst_result' => 'array',
            'sit_uat_data' => 'array',
            'team_allocated_by_pm' => 'boolean',
        ];
    }

    /**
     * Auto-generate REQ ID dengan pencegahan race condition.
     */
    public static function generateReqId(): string
    {
        return DB::transaction(function () {
            $year = date('Y');
            // `withTrashed()` wajib: `req_id` unik di tingkat database, termasuk untuk
            // baris yang sudah dihapus lunak. Tanpa ini nomor proyek yang dihapus
            // akan dipakai ulang dan penyimpanannya gagal karena bentrok indeks unik.
            $last = self::withTrashed()
                ->where('req_id', 'like', "REQ-{$year}-%")
                ->lockForUpdate()
                ->orderBy('req_id', 'desc')
                ->first();

            $number = $last ? intval(substr($last->req_id, -3)) + 1 : 1;

            return "REQ-{$year}-".str_pad($number, 3, '0', STR_PAD_LEFT);
        });
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function pm(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pm_id');
    }

    public function analyst(): BelongsTo
    {
        return $this->belongsTo(User::class, 'analyst_id');
    }

    /**
     * QA Tester yang memegang disposisi pengujian QA proyek ini.
     */
    public function qaAssignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'qa_assignee_id');
    }

    /**
     * Pentester yang memegang disposisi audit keamanan siber proyek ini.
     */
    public function cyberAssignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cyber_assignee_id');
    }

    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(ProjectStatusHistory::class)->orderBy('created_at', 'desc');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(ProjectTask::class);
    }

    public function teamMembers(): HasMany
    {
        return $this->hasMany(ProjectTeamMember::class);
    }

    public function testReports(): HasMany
    {
        return $this->hasMany(TestReport::class);
    }

    public function releaseRequests(): HasMany
    {
        return $this->hasMany(ReleaseRequest::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(DocumentVault::class);
    }

    public function uatApprovalRounds(): HasMany
    {
        return $this->hasMany(UatApprovalRound::class);
    }

    /**
     * Riwayat pengembalian proyek dari jalur pengujian ke pengembangan.
     *
     * Diurutkan terbaru lebih dulu supaya layar dan notifikasi selalu menghadapkan
     * putaran yang sedang berjalan tanpa perlu menyortir ulang di tiap pemanggil.
     */
    public function returnRounds(): HasMany
    {
        return $this->hasMany(ProjectReturnRound::class)
            ->orderByDesc('returned_at')
            ->orderByDesc('id');
    }

    /**
     * Putaran pengembalian yang masih terbuka pada satu jalur pengujian.
     *
     * Hanya boleh ada satu pada satu saat: putaran baru lahir dari sign-off TIDAK LULUS,
     * dan sign-off itu menuntut jalurnya berstatus REVIEW — keadaan yang tidak dapat
     * dicapai tanpa pengajuan ulang lebih dulu, yang justru menutup putaran sebelumnya.
     * Bila ternyata ada lebih dari satu (data lama), yang diambil adalah yang terbaru.
     *
     * Memakai relasi yang sudah dimuat bila tersedia agar penilaian gerbang pada daftar
     * proyek tidak memicu query per baris.
     */
    public function openReturnRound(TestingTrack $track): ?ProjectReturnRound
    {
        if ($this->relationLoaded('returnRounds')) {
            return $this->returnRounds
                ->where('track', $track)
                ->first(fn (ProjectReturnRound $round): bool => $round->isOpen());
        }

        return $this->returnRounds()
            ->forTrack($track)
            ->open()
            ->latest('id')
            ->first();
    }

    /**
     * Status jalur QA yang sudah dinormalisasi.
     *
     * Kolom `qa_status` sengaja TIDAK dicast langsung ke TrackStatus agar satu
     * baris lama bernilai di luar enum tidak membuat pembacaan model melempar
     * exception. Gunakan accessor ini sebagai satu-satunya cara membaca jalur QA
     * di sisi backend.
     */
    public function qaTrackStatus(): TrackStatus
    {
        return TrackStatus::normalize($this->qa_status);
    }

    /**
     * Status jalur Keamanan Siber yang sudah dinormalisasi.
     */
    public function cyberTrackStatus(): TrackStatus
    {
        return TrackStatus::normalize($this->cyber_status);
    }

    /**
     * Dua jalur pengujian paralel (QA & Siber) sudah lulus semuanya.
     *
     * Ini prasyarat tunggal untuk maju ke UAT final, dan sengaja dihitung dari
     * kolom jalur — bukan dari `status` — supaya urutan siapa yang selesai lebih
     * dulu tidak memengaruhi hasilnya.
     */
    public function hasPassedAllTestingTracks(): bool
    {
        return $this->qaTrackStatus()->isPassed() && $this->cyberTrackStatus()->isPassed();
    }

    /**
     * Status satu jalur pengujian, dipilih lewat enum jalur.
     *
     * Dipakai kode yang menangani kedua jalur sekaligus (`TestingTrackService`),
     * sehingga tidak perlu menulis percabangan QA/Siber di setiap pemanggil.
     */
    public function trackStatus(TestingTrack $track): TrackStatus
    {
        return TrackStatus::normalize($this->{$track->statusColumn()});
    }

    /**
     * Jenis pemeriksaan Audit Keamanan Siber yang dipilih PM, bila sudah diajukan.
     *
     * Sama seperti `qa_status`, kolomnya tidak dicast langsung ke enum supaya satu
     * baris lama bernilai di luar enum tidak membuat pembacaan model gagal.
     */
    public function cyberCheckTypeValue(): ?CyberCheckType
    {
        return CyberCheckType::normalize($this->cyber_check_type);
    }

    /**
     * Laporan pengujian terakhir pada satu jalur.
     *
     * Memakai relasi yang sudah dimuat bila tersedia, agar pemanggilan dari
     * `ProjectResource` pada daftar proyek tidak memicu query per baris.
     */
    public function latestTestReport(TestingTrack $track): ?TestReport
    {
        if ($this->relationLoaded('testReports')) {
            return $this->testReports
                ->where('test_type', $track->value)
                ->sortByDesc('id')
                ->first();
        }

        return $this->testReports()
            ->where('test_type', $track->value)
            ->latest('id')
            ->first();
    }

    /**
     * Pastikan proyek memiliki bukti Review & Sign-Off SIT yang benar-benar
     * sudah tercatat pada document vault, bukan hanya draft di browser.
     */
    public function hasSitSignOffDocument(): bool
    {
        $sitUatData = (array) $this->sit_uat_data;
        $documentIds = collect($sitUatData['sit3_docs'] ?? [])
            ->pluck('docId')
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($documentIds->isEmpty()) {
            return false;
        }

        return $this->documents()
            ->whereKey($documentIds->all())
            ->whereIn('document_type', DocumentVault::SIT_SIGN_OFF_TYPES)
            ->exists();
    }

    /**
     * UAT sedang di-hold oleh revisi Mayor dan menunggu SIT ulang lulus untuk
     * diulang penuh dari Tahap 1.
     *
     * Penandanya `uat_restart_after_sit`, tetapi baris yang tersimpan sebelum
     * aturan pengulangan penuh berlaku masih membawa nama lama
     * `uat2_resume_after_sit`. Pembacaannya dipusatkan di sini supaya satu baris
     * lama tidak dinilai berbeda oleh tiap pemanggil, dan supaya penghapusan
     * kunci lama kelak cukup dikerjakan di satu tempat.
     */
    public function isUatRestartPending(): bool
    {
        $sitUatData = (array) $this->sit_uat_data;

        return ($sitUatData['uat_restart_after_sit']
            ?? $sitUatData['uat2_resume_after_sit']
            ?? false) === true;
    }

    /**
     * UAT sudah difinalkan dengan kesimpulan revisi Minor dan perbaikannya masih
     * dikerjakan tim pengembangan, sehingga persetujuan final ditahan.
     *
     * Berbeda dari revisi Mayor, revisi Minor tidak memundurkan status proyek:
     * proyek tetap `UAT_IN_PROGRESS` pada Tahap 3, siklus SIT tidak diulang, dan
     * peserta UAT tidak berubah. Yang ditahan hanya keputusan penanda tangan —
     * tanpa penahanan itu, tanda tangan jatuh pada versi aplikasi yang perbaikannya
     * belum dikerjakan, padahal berita acara UAT-lah yang menjadi dasar rilis.
     *
     * Penandanya `uat_hold.reason = 'minor_revision'` dengan `status` masih
     * `developer_revision`. Pelepasannya dikerjakan
     * `UatExecutionService::releaseMinorRevisionHold()` begitu seluruh Change
     * Request Minor pada siklus itu berstatus `resolved`.
     */
    public function isUatMinorRevisionPending(): bool
    {
        $hold = (array) (((array) $this->sit_uat_data)['uat_hold'] ?? []);

        return ($hold['reason'] ?? null) === 'minor_revision'
            && ($hold['status'] ?? null) === 'developer_revision';
    }

    /**
     * SIT yang sedang berjalan adalah SIT ulang milik satu siklus revisi Mayor,
     * bukan SIT pertama proyek.
     *
     * Penanda ini tidak lagi berarti "scope-nya dipersempit" — revisi Mayor kini
     * selalu diuji ulang menyeluruh karena perbaikannya dapat meregresi fungsi
     * yang tidak tersentuh. Yang tersisa adalah maknanya sebagai penanda siklus:
     * prasyarat masuk SIT ulang lebih ketat daripada SIT pertama, mis. setiap
     * task pada scope wajib sudah punya penerima sebelum pengujian dibuka.
     */
    public function isSitRetestCycle(): bool
    {
        $sitUatData = (array) $this->sit_uat_data;

        return (int) ($sitUatData['uat_hold']['cycle'] ?? 0) > 0
            && $this->isUatRestartPending();
    }

    /**
     * Sumber tunggal task yang wajib diuji pada siklus SIT saat ini.
     * Task TAKE DOWN selalu dikeluarkan dari scope.
     *
     * Secara default scope-nya seluruh task aktif — termasuk pada SIT ulang.
     * Penyempitan ke `sit_retest_scope.taskIds` hanya dipertahankan agar baris
     * yang sudah berjalan dengan scope `targeted` tidak berubah scope di tengah
     * siklusnya.
     *
     * @return Collection<int, ProjectTask>
     */
    public function sitScopeTasks(): Collection
    {
        $tasks = $this->relationLoaded('tasks')
            ? $this->tasks
            : $this->tasks()->get();
        $eligibleTasks = $tasks->filter(function (ProjectTask $task): bool {
            $status = $task->status instanceof \BackedEnum
                ? $task->status->value
                : (string) $task->status;

            return $status !== 'take_down';
        });

        $sitUatData = (array) $this->sit_uat_data;

        // Scope hanya dipersempit untuk baris lama yang terlanjur menyimpan
        // `sit_retest_scope.mode = 'targeted'`. Re-test yang dibuat sejak revisi
        // Mayor mengulang seluruh siklus selalu bermode `full`, sebab perbaikan
        // Mayor dapat meregresi fungsi di luar item yang direvisi.
        if (
            ! $this->isSitRetestCycle()
            || ($sitUatData['sit_retest_scope']['mode'] ?? 'full') !== 'targeted'
        ) {
            return $eligibleTasks->values();
        }

        $cycle = (int) ($sitUatData['uat_hold']['cycle'] ?? 0);
        $scope = (array) ($sitUatData['sit_retest_scope'] ?? []);
        $taskIds = collect(
            (int) ($scope['cycle'] ?? 0) === $cycle
                ? ($scope['taskIds'] ?? [])
                : []
        );

        if ($taskIds->isEmpty()) {
            $taskIds = collect($sitUatData['uat_change_requests'] ?? [])
                ->filter(fn (array $request): bool => ($request['type'] ?? null) === 'mayor'
                    && (int) ($request['cycle'] ?? 0) === $cycle)
                ->pluck('taskId');
        }

        $taskIdSet = $taskIds
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->flip();

        return $eligibleTasks
            ->filter(fn (ProjectTask $task): bool => $taskIdSet->has((int) $task->id))
            ->values();
    }

    /**
     * Sumber tunggal daftar developer yang wajib menyetujui hasil SIT proyek ini.
     *
     * Anggotanya adalah gabungan dua himpunan:
     *
     *   1. Seluruh developer pada tim proyek (`project_team_members`) — dinilai dari
     *      role global penggunanya, sebab `role_in_project` berupa teks bebas tanpa
     *      enum sehingga tidak dapat dipercaya sebagai penanda jabatan.
     *   2. Penerima task pada scope SIT yang sedang berjalan, termasuk bila ia tidak
     *      tercatat sebagai anggota tim — mis. task yang dialihkan PM ke developer
     *      luar tim. Tanpa himpunan kedua, seseorang bisa mengerjakan revisi tetapi
     *      tidak pernah dimintai persetujuan atas hasil pengujiannya sendiri.
     *
     * Sebelumnya hanya himpunan kedua yang dipakai, sehingga developer yang berada
     * pada tim proyek namun tidak menerima task revisi tidak dapat memberikan
     * persetujuan SIT sama sekali — padahal ia ikut memikul hasil rilis timnya.
     *
     * @return list<int>
     */
    public function sitApprovalDeveloperIds(): array
    {
        $teamMembers = $this->relationLoaded('teamMembers')
            ? $this->teamMembers
            : $this->teamMembers()->with('user.role')->get();

        $teamDeveloperIds = $teamMembers
            ->filter(fn (ProjectTeamMember $member): bool => $member->user?->role?->name === UserRole::DEVELOPER->value)
            ->pluck('user_id');

        return $teamDeveloperIds
            ->merge($this->sitScopeTasks()->pluck('assignee_id'))
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }
}
