<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentVault extends Model
{
    use HasFactory;

    public const UAT_EVIDENCE_TYPE = 'UAT_EVIDENCE';

    public const SIT_TASK_EVIDENCE_TYPE = 'SIT_TASK_EVIDENCE';

    /**
     * Tipe dokumen yang memenuhi bukti wajib Review & Sign-Off SIT.
     */
    public const SIT_SIGN_OFF_TYPES = [
        'SIT_RESULT',
        'SIT_SIGNOFF',
    ];

    protected $fillable = [
        'project_id',
        'uploaded_by',
        'document_type',
        'file_path',
        'file_name',
        'original_filename',
        'file_size',
        'mime_type',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
