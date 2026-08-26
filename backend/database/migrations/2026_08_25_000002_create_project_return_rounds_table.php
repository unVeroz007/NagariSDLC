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
 * Sebelum ini, sign-off TIDAK LULUS hanya meninggalkan tiga jejak yang tersebar:
 * satu baris `project_status_histories` (`to_status = RETURN_TO_DEV`), satu baris
 * `activity_logs`, dan kolom `test_reports.review_notes`. Akibatnya sisi pengembangan
 * tidak punya satu pun tempat untuk menjawab pertanyaan paling dasar setelah proyeknya
 * dikembalikan: jalur mana yang menolak, apa pesan Lead-nya, task perbaikan apa yang
 * lahir dari pengembalian itu, dan apakah perbaikannya sudah cukup untuk diajukan ulang.
 * Pertanyaan terakhir bahkan tidak dapat dijawab sama sekali, karena pengajuan ulang
 * jalur pengujian tidak memiliki prasyarat bisnis apa pun.
 *
 * Dua perubahan:
 *
 *   1. Tabel `project_return_rounds` — satu baris per peristiwa pengembalian. Berisi
 *      jalur asal, nomor putaran, laporan uji yang menjadi dasarnya, pesan Lead, dan
 *      catatan Project Manager saat mengajukan ulang.
 *   2. `project_tasks.return_round_id` — penanda asal task perbaikan. Sebuah task yang
 *      terisi kolom ini adalah task yang lahir dari pengembalian, dan putarannya
 *      sekaligus memberi tahu jalur mana yang memintanya. Menyimpan penandanya sebagai
 *      relasi, bukan sebagai salinan teks jalur, membuat "task ini milik putaran mana"
 *      hanya punya satu sumber kebenaran.
 *
 * Nomor putaran dihitung per (proyek, jalur), bukan per proyek. Jalur QA dan Keamanan
 * Siber berjalan paralel dan dapat mengembalikan proyek secara terpisah, jadi
 * "Pengembalian QA ke-2" harus tetap terbaca sebagai putaran kedua jalur QA meskipun
 * jalur Siber juga pernah mengembalikan proyek yang sama di antaranya.
 *
 * `lead_notes` dan `severity` disalin dari laporan uji, bukan sekadar dirujuk lewat
 * `test_report_id`. Pesan yang menjadi dasar pengembalian adalah bukti tata kelola:
 * ia harus tetap terbaca apa adanya pada putaran itu meskipun laporan uji berikutnya
 * untuk jalur yang sama sudah menumpuk di atasnya.
 *
 * Backfill menurunkan putaran dari `test_reports` yang `reviewed_result = fail`, karena
 * itulah satu-satunya sumber yang menyebut jalur dan pesan Lead sekaligus.
 * `project_status_histories` tidak dipakai: barisnya tahu proyek berpindah ke
 * `RETURN_TO_DEV` tetapi tidak tahu jalur mana penyebabnya. Putaran hasil backfill
 * ditandai OPEN hanya bila ia laporan terakhir jalurnya DAN kolom jalur proyek masih
 * `FAILED`; sisanya sudah pasti terlewati dan ditandai RESUBMITTED. Tidak ada task
 * perbaikan yang ditautkan mundur — sebelum kolom ini ada, tidak ada data yang
 * menyatakan task mana yang lahir dari pengembalian, dan menebaknya akan memalsukan
 * jejak audit sekaligus mengunci gerbang pengajuan ulang pada putaran lama.
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
