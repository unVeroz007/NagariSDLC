<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReleaseRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'requested_by',
        'target_release_date',
        'notes',
        'head_of_it_approval',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'target_release_date' => 'date',
            'head_of_it_approval' => 'boolean',
            'approved_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
