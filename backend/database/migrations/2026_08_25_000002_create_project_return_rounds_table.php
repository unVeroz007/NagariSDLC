<?php

use App\Enums\ReturnRoundStatus;
use App\Enums\TestResult;
use App\Enums\TrackStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jadikan pengembalian proyek dari QA / Keamanan Siber sebagai data yang dapat dibaca.
 *
 * Menambah satu putaran per peristiwa serta relasi task perbaikan. Nomor putaran
 * dihitung per proyek dan jalur; catatan Lead disalin sebagai snapshot audit.
 * Backfill berasal dari laporan gagal: hanya kegagalan terakhir pada jalur yang masih
 * FAILED menjadi OPEN. Task lama tidak ditautkan karena asalnya tidak dapat dibuktikan.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('project_return_rounds')) {
            Schema::create('project_return_rounds', function (Blueprint $table): void {
                $table->id();

                $table->foreignId('project_id')
                    ->constrained('projects')
                    ->cascadeOnDelete();

                // Nilainya sama dengan `test_reports.test_type` dan dengan enum
                // `TestingTrack` (`qa` / `cyber`). Disimpan sebagai string, bukan enum
                // kolom database, mengikuti keputusan yang sama pada `cyber_check_type`:
                // menambah jalur pengujian baru nanti cukup mengubah enum PHP.
                $table->string('track');

                // Putaran ke berapa untuk jalur ini pada proyek ini. Dimulai dari 1.
                $table->unsignedInteger('round_number');

                // Laporan uji yang menjadi dasar pengembalian. Boleh kosong agar baris
                // putaran tidak ikut hilang bila laporannya suatu saat dibersihkan;
                // pesan dan tingkat keparahannya sudah disalin ke kolom di bawah.
                $table->foreignId('test_report_id')
                    ->nullable()
                    ->constrained('test_reports')
                    ->nullOnDelete();

                // Lead yang mengembalikan proyek. Tidak boleh kosong dan tidak boleh
                // ikut terhapus: sebuah pengembalian tanpa penanggung jawab bukan bukti
                // tata kelola. Mengikuti `test_reports.tester_id` yang juga RESTRICT.
                $table->foreignId('returned_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->timestamp('returned_at');

                // Pesan Lead saat sign-off TIDAK LULUS — inti dari "apa yang salah".
                $table->text('lead_notes')->nullable();

                // Tingkat keparahan temuan, disalin dari laporan uji. Dipakai sisi
                // pengembangan untuk menentukan prioritas task perbaikan.
                $table->string('severity')->nullable();

                $table->string('status')->default(ReturnRoundStatus::OPEN->value);

                // Terisi saat Project Manager berhasil mengajukan ulang jalurnya.
                $table->foreignId('resubmitted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();
                $table->timestamp('resubmitted_at')->nullable();
                $table->text('resubmit_notes')->nullable();

                $table->timestamps();

                // Satu jalur tidak boleh punya dua putaran bernomor sama pada proyek
                // yang sama. Ini yang menjaga penomoran tetap benar bila dua sign-off
                // gagal tiba hampir bersamaan.
                $table->unique(['project_id', 'track', 'round_number'], 'return_rounds_project_track_number_unique');

                // Kueri utama halaman: putaran terbuka milik satu proyek/jalur.
                $table->index(['project_id', 'track', 'status'], 'return_rounds_project_track_status_index');
            });
        }

        if (! Schema::hasColumn('project_tasks', 'return_round_id')) {
            Schema::table('project_tasks', function (Blueprint $table): void {
                $table->foreignId('return_round_id')
                    ->nullable()
                    ->after('revision_requested_by')
                    ->constrained('project_return_rounds')
                    ->nullOnDelete();
            });
        }

        $this->backfillReturnRounds();
    }

    public function down(): void
    {
        if (Schema::hasColumn('project_tasks', 'return_round_id')) {
            Schema::table('project_tasks', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('return_round_id');
            });
        }

        Schema::dropIfExists('project_return_rounds');
    }

    /**
     * Turunkan putaran pengembalian dari laporan uji yang di-sign-off TIDAK LULUS.
     *
     * Dijalankan setelah tabelnya ada dan bersifat idempoten: baris yang sudah punya
     * `test_report_id` yang sama dilewati, sehingga migrasi ini aman dijalankan ulang
     * pada basis data yang sudah pernah diisi.
     */
    private function backfillReturnRounds(): void
    {
        $failedReports = DB::table('test_reports')
            ->where('reviewed_result', TestResult::FAIL->value)
            ->whereNotNull('reviewed_by')
            ->orderBy('project_id')
            ->orderBy('test_type')
            ->orderBy('id')
            ->get();

        if ($failedReports->isEmpty()) {
            return;
        }

        $existingReportIds = DB::table('project_return_rounds')
            ->whereNotNull('test_report_id')
            ->pluck('test_report_id')
            ->all();

        $existingReportIds = array_flip(array_map('intval', $existingReportIds));

        // Status jalur proyek saat ini, untuk memutuskan putaran mana yang masih OPEN.
        $projectTrackStatuses = DB::table('projects')
            ->select('id', 'qa_status', 'cyber_status')
            ->get()
            ->keyBy('id');

        // Laporan gagal terakhir per (proyek, jalur) — hanya ia yang boleh OPEN.
        $latestFailedReportId = [];

        foreach ($failedReports as $report) {
            $latestFailedReportId[$report->project_id . '|' . $report->test_type] = (int) $report->id;
        }

        $roundNumbers = [];
        $rows = [];
        $now = now();

        foreach ($failedReports as $report) {
            $key = $report->project_id . '|' . $report->test_type;
            $roundNumbers[$key] = ($roundNumbers[$key] ?? 0) + 1;

            if (isset($existingReportIds[(int) $report->id])) {
                continue;
            }

            $trackColumn = $report->test_type === 'cyber' ? 'cyber_status' : 'qa_status';
            $currentTrackStatus = TrackStatus::normalize(
                $projectTrackStatuses[$report->project_id]->{$trackColumn} ?? null
            );

            $isStillOpen = $latestFailedReportId[$key] === (int) $report->id
                && $currentTrackStatus === TrackStatus::FAILED;

            $returnedAt = $report->reviewed_at ?? $report->updated_at ?? $report->created_at ?? $now;

            $rows[] = [
                'project_id' => $report->project_id,
                'track' => $report->test_type,
                'round_number' => $roundNumbers[$key],
                'test_report_id' => $report->id,
                'returned_by' => $report->reviewed_by,
                'returned_at' => $returnedAt,
                'lead_notes' => $report->review_notes,
                'severity' => $report->severity,
                'status' => $isStillOpen
                    ? ReturnRoundStatus::OPEN->value
                    : ReturnRoundStatus::RESUBMITTED->value,
                // Putaran lama tidak punya jejak siapa yang mengajukan ulang. Kolomnya
                // dibiarkan kosong daripada diisi tebakan.
                'resubmitted_by' => null,
                'resubmitted_at' => $isStillOpen ? null : $returnedAt,
                'resubmit_notes' => $isStillOpen
                    ? null
                    : 'Putaran ini direkonstruksi dari laporan uji lama saat kolom putaran pengembalian ditambahkan. Jejak pengajuan ulangnya tidak tersimpan.',
                'created_at' => $returnedAt,
                'updated_at' => $now,
            ];
        }

        if ($rows !== []) {
            DB::table('project_return_rounds')->insert($rows);
        }
    }
};
