<?php

namespace App\Models;

use App\Enums\TestResult;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'test_type',
        'tester_id',
        'result',
        'notes',
        'attachment_url',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'result' => TestResult::class,
            'reviewed_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function tester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tester_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
