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
 * Service ini memiliki tiga tanggung jawab yang seluruhnya berkisar pada satu tabel,
 * `project_return_rounds`:
 *
 *   1. `open()`                — membuka putaran saat Lead menyatakan TIDAK LULUS.
 *   2. `assertResubmitAllowed()` — gerbang keras pengajuan ulang.
 *   3. `close()`               — menutup putaran saat jalurnya berhasil diajukan ulang.
 *
 * Ketiganya dipanggil `TestingTrackService`, bukan controller. Alasannya: membuka dan
 * menutup putaran harus terjadi pada transaksi yang sama dengan perubahan status jalur
 * yang menyebabkannya. Bila keduanya dipisah ke dua panggilan controller, satu kegagalan
 * di tengah akan meninggalkan proyek berstatus dikembalikan tanpa putaran yang dapat
 * dibaca — atau sebaliknya, putaran terbuka pada jalur yang sudah berjalan lagi.
 *
 * Arah ketergantungannya sengaja satu arah: service ini TIDAK mengenal
 * `TestingTrackService`. Orkestrasi "ajukan ulang jalurnya lalu tutup putarannya" berada
 * di sana, karena pengajuan jalur pengujian memang miliknya. Menaruh orkestrasi itu di
 * sini akan membuat dua service saling menyuntik dan container tidak dapat membangunnya.
 *
 * Yang TIDAK dilakukan service ini:
 *
 * - Tidak memindahkan status jalur maupun status utama proyek. Itu milik
 *   `TestingTrackService` dan `ProjectWorkflowService`.
 * - Tidak menulis activity log sendiri. Peristiwa pembukaan dan penutupan putaran sudah
 *   tercatat pada aliran audit `update_project_track_status` milik
 *   `TestingTrackService::recordTrackAudit()`; menulis baris kedua hanya menggandakan
 *   satu peristiwa menjadi dua di layar riwayat.
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
     * Dipasang di `TestingTrackService::submitRequest()` sehingga berlaku untuk SEMUA
     * jalan masuk pengajuan — tombol "Ajukan Ulang" pada halaman Pengembalian maupun
     * form pengajuan pengujian biasa. Memasangnya hanya pada endpoint pengajuan ulang
     * akan menyisakan pintu belakang yang justru lebih mudah ditemukan.
     *
     * Tiga hal yang ditolak, masing-masing dengan alasannya:
     *
     *   1. Putaran terbuka tanpa satu pun task perbaikan. Pengembalian yang tidak
     *      melahirkan task berarti tidak ada satu pun perbaikan yang tercatat, jadi
     *      tidak ada yang dapat dinyatakan selesai. Aturan yang sama dipakai gerbang
     *      SIT ulang terhadap scope yang kosong.
     *   2. Task perbaikan yang belum selesai. `take_down` dikecualikan: permintaan yang
     *      dibatalkan secara sadar tidak boleh mengunci proyek selamanya.
     *   3. Task perbaikan tanpa penerima. Task tanpa penerima tidak punya penanggung
     *      jawab, sehingga "sudah dikerjakan" tidak dapat dipertanggungjawabkan
     *      siapa pun — cerminan gerbang `UAT_REVISION_DEV → SIT_IN_PROGRESS`.
     *
     * Tidak melakukan apa-apa bila jalur ini tidak punya putaran terbuka: pengajuan
     * pengujian pertama kali memang bukan pengajuan ulang.
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
