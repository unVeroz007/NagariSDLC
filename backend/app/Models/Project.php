<?php

namespace App\Models;

use App\Enums\ProjectStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'req_id',
        'title',
        'description',
        'contact_phone',
        'type',
        'project_type',
        'status',
        'created_by',
        'pm_id',
        'analyst_id',
        'division_id',
        'target_date',
        'current_stage_deadline',
        'rejection_reason',
        'uat_notes',
        'analyst_result',
        'dev_analyst_result',
        'staging_url',
        'sit_uat_data',
        'qa_status',
        'cyber_status',
        'team_allocated_by_pm',
    ];

    protected function casts(): array
    {
        return [
            'status' => ProjectStatus::class,
            'target_date' => 'date',
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
            $last = self::where('req_id', 'like', "REQ-{$year}-%")
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
     * SIT ulang setelah UAT Mayor hanya menguji task pada scope siklus revisi aktif.
     * SIT pertama tetap memakai seluruh task aktif proyek.
     */
    public function isTargetedSitRetest(): bool
    {
        $sitUatData = (array) $this->sit_uat_data;

        return ($sitUatData['uat2_resume_after_sit'] ?? false) === true
            && (int) ($sitUatData['uat_hold']['cycle'] ?? 0) > 0;
    }

    /**
     * Sumber tunggal task yang wajib diuji pada siklus SIT saat ini.
     * Task TAKE DOWN selalu dikeluarkan dari scope.
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

        if (! $this->isTargetedSitRetest()) {
            return $eligibleTasks->values();
        }

        $sitUatData = (array) $this->sit_uat_data;
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
}
