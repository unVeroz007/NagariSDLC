<?php

namespace App\Models;

use App\Enums\ReturnRoundStatus;
use App\Enums\TaskStatus;
use App\Enums\TestingTrack;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * Satu peristiwa pengembalian proyek dari jalur pengujian ke pengembangan.
 *
 * Baris ini lahir ketika Lead QA atau Lead Keamanan Siber melakukan sign-off dengan
 * hasil TIDAK LULUS, dan tertutup ketika jalur yang sama berhasil diajukan ulang.
 * Sebelumnya peristiwa itu hanya tersebar sebagai satu baris riwayat status, satu baris
 * activity log, dan catatan review pada laporan uji — tidak ada satu pun tempat yang
 * dapat menjawab "jalur mana yang menolak, apa pesannya, dan perbaikan apa yang
 * dimintanya".
 *
 * Isi barisnya dibagi dua sisi yang ditulis dua orang berbeda:
 *
 * - Sisi pengujian (`track`, `test_report_id`, `returned_by`, `returned_at`,
 *   `lead_notes`, `severity`) ditulis sekali saat pengembalian terjadi dan tidak pernah
 *   berubah lagi.
 * - Sisi pengembangan (`status`, `resubmitted_by`, `resubmitted_at`, `resubmit_notes`)
 *   ditulis saat Project Manager mengajukan jalurnya kembali.
 *
 * `lead_notes` dan `severity` merupakan salinan dari laporan uji, bukan bacaan langsung
 * lewat `test_report_id`. Pesan yang menjadi dasar pengembalian adalah bukti tata
 * kelola: ia harus tetap terbaca apa adanya pada putaran ini meskipun laporan uji
 * berikutnya untuk jalur yang sama sudah menumpuk di atasnya.
 *
 * @see \App\Services\ProjectReturnRoundService  Pemilik seluruh penulisan baris ini.
 */
class ProjectReturnRound extends Model
{
    use HasFactory;

    /**
     * Status task yang tidak menahan pengajuan ulang.
     *
     * `done` berarti perbaikannya sudah dikerjakan. `take_down` berarti permintaannya
     * dibatalkan secara sadar, jadi menahannya sama dengan mengunci proyek pada task
     * yang memang tidak akan pernah dikerjakan. Aturan pengecualian `take_down` yang
     * sama dipakai `Project::sitScopeTasks()`.
     *
     * @var list<string>
     */
    public const NON_BLOCKING_TASK_STATUSES = [
        TaskStatus::DONE->value,
        TaskStatus::TAKE_DOWN->value,
    ];

    protected $fillable = [
        'project_id',
        'track',
        'round_number',
        'test_report_id',
        'returned_by',
        'returned_at',
        'lead_notes',
        'severity',
        'status',
        'resubmitted_by',
        'resubmitted_at',
        'resubmit_notes',
    ];

    /**
     * `status` sengaja TIDAK dicast ke enum, `track` dicast.
     *
     * Nilai `status` menentukan gerbang pengajuan ulang, jadi satu baris yang tidak
     * dapat dibaca tidak boleh membuat pembacaan model melempar exception — ia harus
     * jatuh ke keadaan paling aman lewat `ReturnRoundStatus::normalize()` pada
     * `roundStatus()`. Sebaliknya `track` hanya punya dua penulis, keduanya memakai
     * enum `TestingTrack`, sehingga aman dicast langsung.
     */
    protected function casts(): array
    {
        return [
            'track' => TestingTrack::class,
            'round_number' => 'integer',
            'returned_at' => 'datetime',
            'resubmitted_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Laporan uji yang menjadi dasar pengembalian. Boleh kosong pada putaran lama.
     */
    public function testReport(): BelongsTo
    {
        return $this->belongsTo(TestReport::class, 'test_report_id');
    }

    /**
     * Lead yang mengembalikan proyek.
     */
    public function returnedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'returned_by');
    }

    /**
     * Project Manager yang mengajukan jalurnya kembali.
     */
    public function resubmittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resubmitted_by');
    }

    /**
     * Task perbaikan yang lahir dari putaran pengembalian ini.
     *
     * Penanda asalnya berupa relasi, bukan salinan teks jalur pada task, supaya
     * "task ini milik putaran mana" hanya punya satu sumber kebenaran.
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(ProjectTask::class, 'return_round_id');
    }

    /**
     * Status putaran yang sudah dinormalisasi.
     *
     * Satu-satunya cara membaca status putaran di sisi backend. Lihat catatan
     * `casts()` untuk alasan kolomnya tidak dicast langsung.
     */
    public function roundStatus(): ReturnRoundStatus
    {
        return ReturnRoundStatus::normalize($this->status);
    }

    /**
     * Putaran masih menunggu perbaikan diajukan ulang.
     */
    public function isOpen(): bool
    {
        return $this->roundStatus()->isOpen();
    }

    /**
     * Sebutan putaran untuk teks catatan, notifikasi, dan judul di layar.
     */
    public function roundLabel(): string
    {
        return "{$this->track->label()} — Pengembalian ke-{$this->round_number}";
    }

    /**
     * Task perbaikan yang masih menahan pengajuan ulang.
     *
     * Memakai relasi yang sudah dimuat bila tersedia agar penilaian gerbang pada
     * daftar proyek tidak memicu satu query per putaran.
     *
     * @return Collection<int, ProjectTask>
     */
    public function blockingTasks(): Collection
    {
        $tasks = $this->relationLoaded('tasks')
            ? $this->tasks
            : $this->tasks()->get();

        return $tasks
            ->reject(function (ProjectTask $task): bool {
                $status = $task->status instanceof \BackedEnum
                    ? $task->status->value
                    : (string) $task->status;

                return in_array($status, self::NON_BLOCKING_TASK_STATUSES, true);
            })
            ->values();
    }

    /**
     * Batasi query pada satu jalur pengujian.
     *
     * @param  Builder<ProjectReturnRound>  $query
     * @return Builder<ProjectReturnRound>
     */
    public function scopeForTrack(Builder $query, TestingTrack $track): Builder
    {
        return $query->where('track', $track->value);
    }

    /**
     * Batasi query pada putaran yang belum diajukan ulang.
     *
     * @param  Builder<ProjectReturnRound>  $query
     * @return Builder<ProjectReturnRound>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', ReturnRoundStatus::OPEN->value);
    }
}
