<?php

namespace App\Models;

use App\Enums\UatApprovalRoundStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UatApprovalRound extends Model
{
    protected $fillable = [
        'project_id', 'round_number', 'status', 'opened_by', 'opened_at',
        'completed_at', 'superseded_at', 'superseded_reason',
    ];

    protected function casts(): array
    {
        return [
            'status' => UatApprovalRoundStatus::class,
            'opened_at' => 'datetime',
            'completed_at' => 'datetime',
            'superseded_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function approvers(): HasMany
    {
        return $this->hasMany(UatApprover::class);
    }
}
