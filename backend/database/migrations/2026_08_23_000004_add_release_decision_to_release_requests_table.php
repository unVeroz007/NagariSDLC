<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Simpan rencana rilis dan keputusan Quality Gate sebagai kolom tersendiri.
 *
 * Dua kekurangan pada `release_requests` diselesaikan bersamaan:
 *
 *   1. Estimasi downtime dan prosedur rollback yang diisi PM digabung menjadi satu
 *      teks `notes` berlabel. Akibatnya layar Quality Gate tidak dapat menampilkan
 *      keduanya secara terpisah, dan sebelumnya kekosongan itu ditutup teks karangan
 *      di frontend ("Restore database snapshot & revert versi deployment.") — Head of
 *      IT menyetujui go-live sambil membaca rencana rollback yang tidak pernah
 *      ditulis siapa pun.
 *   2. Persetujuan hanya menyimpan `approved_at`, tanpa identitas penyetuju, dan
 *      penolakan tidak punya tempat sama sekali. Keduanya adalah bukti tata kelola:
 *      keputusan go-live harus dapat ditelusuri ke orangnya.
 *
 * Isi `notes` lama dipindahkan ke kolom baru dengan membaca label yang memang
 * ditulis `ReleaseRequestController::composeNotes()`, sehingga pengajuan yang sudah
 * ada tidak kehilangan informasi. Kolom `notes` dipertahankan untuk catatan rilis
 * bebas.
 *
 * `approved_by` dan `rejected_by` memakai RESTRICT, bukan SET NULL: identitas
 * pemberi keputusan go-live adalah bukti audit, jadi tidak boleh hilang diam-diam
 * karena penghapusan akun.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('release_requests', function (Blueprint $table): void {
            if (! Schema::hasColumn('release_requests', 'downtime_estimate')) {
                $table->string('downtime_estimate', 255)->nullable()->after('target_release_date');
            }

            if (! Schema::hasColumn('release_requests', 'rollback_plan')) {
                $table->text('rollback_plan')->nullable()->after('downtime_estimate');
            }

            if (! Schema::hasColumn('release_requests', 'approved_by')) {
                $table->foreignId('approved_by')->nullable()->after('approved_at')
                    ->constrained('users')->restrictOnDelete();
            }

            if (! Schema::hasColumn('release_requests', 'rejected_at')) {
                $table->timestamp('rejected_at')->nullable()->after('approved_by');
            }

            if (! Schema::hasColumn('release_requests', 'rejected_by')) {
                $table->foreignId('rejected_by')->nullable()->after('rejected_at')
                    ->constrained('users')->restrictOnDelete();
            }

            if (! Schema::hasColumn('release_requests', 'rejection_notes')) {
                $table->text('rejection_notes')->nullable()->after('rejected_by');
            }
        });

        $this->backfillStructuredPlanColumns();
    }

    public function down(): void
    {
        Schema::table('release_requests', function (Blueprint $table): void {
            foreach (['approved_by', 'rejected_by'] as $foreignKeyColumn) {
                if (Schema::hasColumn('release_requests', $foreignKeyColumn)) {
                    $table->dropForeign([$foreignKeyColumn]);
                }
            }

            $columns = array_values(array_filter(
                ['downtime_estimate', 'rollback_plan', 'approved_by', 'rejected_at', 'rejected_by', 'rejection_notes'],
                fn (string $column): bool => Schema::hasColumn('release_requests', $column)
            ));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }

    /**
     * Pindahkan bagian berlabel dari `notes` ke kolom terstruktur yang baru.
     *
     * Format sumbernya pasti karena ditulis satu tempat: label, titik dua, spasi,
     * lalu isi, dan antarbagian dipisah baris kosong. Baris yang tidak mengandung
     * label apa pun dibiarkan utuh di `notes`.
     */
    private function backfillStructuredPlanColumns(): void
    {
        $rows = DB::table('release_requests')
            ->select('id', 'notes')
            ->whereNotNull('notes')
            ->whereNull('downtime_estimate')
            ->whereNull('rollback_plan')
            ->get();

        foreach ($rows as $row) {
            $downtime = $this->extractLabelledSection($row->notes, 'Estimasi Downtime');
            $rollback = $this->extractLabelledSection($row->notes, 'Prosedur Rollback');

            if ($downtime === null && $rollback === null) {
                continue;
            }

            $releaseNotes = $this->extractLabelledSection($row->notes, 'Catatan Rilis');

            DB::table('release_requests')->where('id', $row->id)->update([
                'downtime_estimate' => $downtime,
                'rollback_plan' => $rollback,
                // Bila teks lama seluruhnya terdiri dari bagian berlabel, `notes`
                // menyisakan catatan rilisnya saja supaya tidak terduplikasi.
                'notes' => $releaseNotes,
            ]);
        }
    }

    private function extractLabelledSection(string $notes, string $label): ?string
    {
        $pattern = '/^'.preg_quote($label, '/').':\s*(.*?)(?=\n\n[A-Z][^\n:]*:|\z)/ms';

        if (preg_match($pattern, $notes, $matches) !== 1) {
            return null;
        }

        $value = trim($matches[1]);

        return $value === '' ? null : $value;
    }
};
