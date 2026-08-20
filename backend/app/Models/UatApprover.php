<?php

namespace App\Models;

use App\Enums\UatApprovalRole;
use App\Enums\UatApprovalStatus;
use App\Enums\UatApproverMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UatApprover extends Model
{
    protected $fillable = [
        'uat_approval_round_id', 'participant_key', 'user_id', 'side',
        'approval_role', 'approval_mode', 'name', 'position', 'unit',
        'phone_hash', 'phone_masked', 'link_token_hash', 'link_expires_at',
        'link_opened_at', 'access_token_hash', 'access_expires_at',
        'verification_attempts', 'verification_locked_until', 'verified_at',
        'status', 'decision_note', 'decided_at', 'decision_ip',
        'decision_user_agent',
    ];

    protected $hidden = [
        'phone_hash', 'link_token_hash', 'access_token_hash',
    ];

    protected function casts(): array
    {
        return [
            'approval_role' => UatApprovalRole::class,
            'approval_mode' => UatApproverMode::class,
            'status' => UatApprovalStatus::class,
            'link_expires_at' => 'datetime',
            'link_opened_at' => 'datetime',
            'access_expires_at' => 'datetime',
            'verification_locked_until' => 'datetime',
            'verified_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    public function round(): BelongsTo
    {
        return $this->belongsTo(UatApprovalRound::class, 'uat_approval_round_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
