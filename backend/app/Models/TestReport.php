<?php

namespace App\Models;

use App\Enums\TestResult;
use App\Enums\TestingTrack;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Laporan satu siklus pengujian pada jalur QA atau Keamanan Siber.
 *
 * Satu baris memuat dua keputusan dari dua orang berbeda:
 * - Hasil tester (`result`, `severity`, `notes`, `tested_scenarios`,
 *   `evidence_document_ids`) yang ditulis saat laporan dikirim.
 * - Keputusan Lead (`reviewed_result`, `review_notes`, `reviewed_by`, `reviewed_at`)
 *   yang ditulis saat sign-off.
 *
 * Keduanya sengaja tidak saling menimpa: Lead boleh mengembalikan proyek meskipun
 * tester menyatakan lulus, dan jejak audit harus tetap menunjukkan kedua penilaian.
 *
 * `checklist` adalah kolom warisan. Dulu cakupan pengujian ditulis sebagai enam
 * skenario tetap berisi nilai boolean; sekarang penguji menuliskannya sendiri di
 * `tested_scenarios`. Kolomnya tetap ada karena laporan lama memakainya dan laporan
 * pengujian merupakan bagian jejak audit rilis.
 */
class TestReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'test_type',
        'tester_id',
        'result',
        'severity',
        'notes',
        'checklist',
        'tested_scenarios',
        'attachment_url',
        'evidence_document_ids',
        'reviewed_by',
        'reviewed_result',
        'review_notes',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'result' => TestResult::class,
            'reviewed_result' => TestResult::class,
            'checklist' => 'array',
            'evidence_document_ids' => 'array',
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

    /**
     * Batasi query pada satu jalur pengujian.
     *
     * @param  Builder<TestReport>  $query
     * @return Builder<TestReport>
     */
    public function scopeForTrack(Builder $query, TestingTrack $track): Builder
    {
        return $query->where('test_type', $track->value);
    }

    /**
     * Laporan sudah di-sign-off Lead.
     */
    public function isReviewed(): bool
    {
        return $this->reviewed_at !== null;
    }

    /**
     * ID berkas bukti pada document vault yang dirujuk laporan ini.
     *
     * Bukti dirujuk lewat ID, bukan disalin, supaya berkas tetap tunggal di vault
     * beserta otorisasi unduh dan catatan pengunggahnya. Penghidratan menjadi objek
     * dokumen dilakukan pemanggil dari relasi `documents` proyek yang sudah dimuat,
     * agar daftar proyek tidak memicu satu query tambahan per laporan.
     *
     * @return list<int>
     */
    public function evidenceDocumentIdList(): array
    {
        return collect($this->evidence_document_ids ?? [])
            ->filter(fn ($id): bool => is_numeric($id))
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
    }
}
