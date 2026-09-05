<?php

namespace App\Services;

use App\Enums\ReturnRoundStatus;
use App\Enums\TestingTrack;
use App\Models\Project;
use App\Models\ProjectReturnRound;
use App\Models\ProjectTask;
use App\Models\TestReport;
use App\Models\User;
use Exception;

/**
 * Satu sumber kebenaran untuk putaran pengembalian proyek dari pengujian ke pengembangan.
 *
 * Memiliki operasi `open`, gerbang `assertResubmitAllowed`, dan `close`. Seluruhnya
 * dipanggil `TestingTrackService` dalam transaksi perubahan jalur. Service ini tidak
 * mengubah status proyek dan tidak menggandakan activity log.
 *
 * @see \App\Services\TestingTrackService
 */
class ProjectReturnRoundService
{
    /**
     * Buka satu putaran pengembalian untuk jalur yang baru dinyatakan TIDAK LULUS.
     *
     * Wajib dipanggil di dalam transaksi milik sign-off. Nomor putaran dihitung dari
     * baris terakhir jalur ini dengan `lockForUpdate()` supaya dua sign-off gagal yang
     * tiba hampir bersamaan tidak menghasilkan dua putaran bernomor sama — indeks unik
     * `return_rounds_project_track_number_unique` menjadi jaring terakhirnya.
     *
     * Pesan Lead dan tingkat keparahan disalin ke barisnya, bukan dibaca ulang lewat
     * `test_report_id`. Alasannya ada pada docblock `ProjectReturnRound`. Bila Lead
     * menetapkan `$severity` sendiri saat sign-off, nilai itulah yang dipakai; jika
     * tidak, severity laporan uji terakhir menjadi cadangannya.
     */
    public function open(
        Project $project,
        TestingTrack $track,
        User $lead,
        ?TestReport $report = null,
        ?string $leadNotes = null,
        ?string $severity = null
    ): ProjectReturnRound {
        $lastRoundNumber = (int) ProjectReturnRound::query()
            ->where('project_id', $project->id)
            ->forTrack($track)
            ->lockForUpdate()
            ->max('round_number');

        return ProjectReturnRound::create([
            'project_id' => $project->id,
            'track' => $track->value,
            'round_number' => $lastRoundNumber + 1,
            'test_report_id' => $report?->id,
            'returned_by' => $lead->id,
            'returned_at' => now(),
            // Catatan sign-off adalah inti "apa yang salah". Bila Lead tidak menuliskannya,
            // catatan pelaksana pengujian dipakai sebagai gantinya supaya putaran tidak
            // pernah lahir tanpa satu pun keterangan yang dapat dibaca pengembang.
            'lead_notes' => filled($leadNotes) ? $leadNotes : $report?->notes,
            'severity' => filled($severity) ? $severity : $report?->severity,
            'status' => ReturnRoundStatus::OPEN->value,
        ]);
    }

    /**
     * Gerbang keras pengajuan ulang satu jalur pengujian.
     *
     * Putaran terbuka wajib memiliki task perbaikan yang sudah ditugaskan dan selesai;
     * task `take_down` diabaikan. Tanpa putaran terbuka, pengajuan pertama langsung lolos.
     *
     * @throws Exception Bila masih ada perbaikan yang menahan pengajuan ulang.
     */
    public function assertResubmitAllowed(Project $project, TestingTrack $track): void
    {
        $round = $project->openReturnRound($track);

        if (! $round) {
            return;
        }

        $tasks = $round->relationLoaded('tasks')
            ? $round->tasks
            : $round->tasks()->get();

        if ($tasks->isEmpty()) {
            throw new Exception(
                "{$round->roundLabel()} belum memiliki satu pun task perbaikan. "
                . 'Buat task perbaikan atas temuan yang dikembalikan lebih dulu, '
                . 'kerjakan sampai selesai, baru pengujiannya dapat diajukan ulang.'
            );
        }

        $unassignedTasks = $tasks->filter(
            fn (ProjectTask $task): bool => $task->assignee_id === null
        );

        if ($unassignedTasks->isNotEmpty()) {
            throw new Exception(
                "Setiap task perbaikan pada {$round->roundLabel()} wajib memiliki penerima "
                . 'sebelum pengujiannya diajukan ulang. Task tanpa penerima: '
                . $this->describeTasks($unassignedTasks) . '.'
            );
        }

        $blockingTasks = $round->blockingTasks();

        if ($blockingTasks->isNotEmpty()) {
            throw new Exception(
                "Seluruh task perbaikan pada {$round->roundLabel()} harus selesai sebelum "
                . 'pengujiannya diajukan ulang. Task yang belum selesai: '
                . $this->describeTasks($blockingTasks) . '.'
            );
        }
    }

    /**
     * Tutup putaran terbuka jalur ini karena pengujiannya sudah diajukan ulang.
     *
     * Wajib dipanggil di dalam transaksi milik pengajuan. Aman dipanggil ketika jalurnya
     * tidak punya putaran terbuka — pengajuan pertama kali mengembalikan `null` tanpa
     * efek samping, sehingga pemanggil tidak perlu bercabang lebih dulu.
     *
     * Penutupan tidak pernah menghapus atau menimpa sisi pengujian barisnya. Putaran yang
     * sudah tertutup tetap menjadi riwayat lengkap: siapa mengembalikan, apa pesannya,
     * task apa yang lahir, siapa mengajukan ulang, dan kapan.
     */
    public function close(Project $project, TestingTrack $track, User $actor, ?string $notes = null): ?ProjectReturnRound
    {
        $round = $project->openReturnRound($track);

        if (! $round) {
            return null;
        }

        $round->fill([
            'status' => ReturnRoundStatus::RESUBMITTED->value,
            'resubmitted_by' => $actor->id,
            'resubmitted_at' => now(),
            'resubmit_notes' => $notes,
        ])->save();

        return $round;
    }

    /**
     * Sebutan ringkas beberapa task untuk pesan penolakan gerbang.
     *
     * Menyertakan ID di samping judulnya supaya pengguna dapat menemukan task yang
     * dimaksud meskipun ada dua task berjudul mirip pada putaran yang sama.
     *
     * @param  \Illuminate\Support\Enumerable<int, ProjectTask>  $tasks
     */
    private function describeTasks(\Illuminate\Support\Enumerable $tasks): string
    {
        return $tasks
            ->map(fn (ProjectTask $task): string => "#{$task->id} {$task->title}")
            ->implode(', ');
    }
}
