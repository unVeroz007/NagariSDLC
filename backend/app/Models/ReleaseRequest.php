<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pengajuan migrasi & rilis produksi beserta keputusan Quality Gate atasnya.
 *
 * Rencana rilis disimpan sebagai kolom tersendiri (`downtime_estimate`,
 * `rollback_plan`) alih-alih digabung ke dalam satu teks `notes`. Head of IT
 * membaca ketiganya sebagai bagian dari keputusan go-live, jadi masing-masing
 * harus dapat ditampilkan, dicari, dan diperiksa kelengkapannya secara terpisah.
 *
 * Keputusan Quality Gate juga dicatat lengkap dengan pelakunya: `approved_by`
 * untuk persetujuan dan `rejected_by` untuk penolakan. Sebelumnya hanya
 * `approved_at` yang terisi, sehingga jejak audit tidak dapat menjawab siapa yang
 * meluluskan sebuah rilis ke produksi.
 */
class ReleaseRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'requested_by',
        'target_release_date',
        'downtime_estimate',
        'rollback_plan',
        'notes',
        'head_of_it_approval',
        'approved_at',
        'approved_by',
        'rejected_at',
        'rejected_by',
        'rejection_notes',
    ];

    protected function casts(): array
    {
        return [
            'target_release_date' => 'date',
            'head_of_it_approval' => 'boolean',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
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

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejecter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    /**
     * Pengajuan masih menunggu keputusan Head of IT.
     *
     * Dipakai untuk memilih baris mana yang boleh menerima keputusan berikutnya:
     * satu proyek dapat memiliki beberapa pengajuan bila rilis sebelumnya ditolak,
     * dan keputusan baru tidak boleh menimpa riwayat keputusan yang lama.
     */
    public function isPending(): bool
    {
        return ! $this->head_of_it_approval && $this->rejected_at === null;
    }
}
