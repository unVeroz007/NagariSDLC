<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Bebaskan proyek yang tertahan di "mode verifikasi" UAT yang kini dipensiunkan.
 *
 * Mode lama melanjutkan UAT Tahap 2 setelah SIT tertarget; aturan baru mengulang SIT
 * penuh dan UAT dari Tahap 1. Migration hanya memindahkan baris yang masih memakai
 * mode tersebut. Approval, peserta, dokumen, dan fallback legacy tidak disentuh.
 * `down()` sengaja tidak memulihkan data.
 */
return new class extends Migration
{
    /**
     * Penanda pelaku arsip. Dipakai sekaligus sebagai kunci idempotensi: entri
     * `uat_cycles` bertanda ini berarti baris tersebut sudah pernah diperbaiki.
     */
    private const ARCHIVED_BY = 'system:migration';

    private const MIGRATION_NAME = '2026_08_24_000000_restart_uat_for_retired_verification_mode_projects';

    /**
     * Nilai kosong hasil eksekusi UAT. Sengaja dicocokkan persis dengan yang
     * ditulis `UatExecutionService` saat mengulang UAT, supaya baris hasil
     * perbaikan ini tidak dapat dibedakan dari baris yang mengulang lewat aplikasi.
     *
     * @var array<string, mixed>
     */
    private const CLEARED_EXECUTION_VALUES = [
        'uat2_summary' => [],
        'uat2_scenarios' => [],
        'uat2_additional_requests' => [],
        'uat2_executedCount' => 0,
        'uat2_passedCount' => 0,
        'uat2_findings' => 0,
        'uat2_execNotes' => null,
    ];

    /**
     * Kunci yang isinya milik putaran yang baru diarsipkan. Dibiarkan hidup, ia
     * akan dibaca putaran baru sebagai miliknya sendiri dan menyesatkan — mis.
     * `uat2_summary.submittedAt` yang menahan penyimpanan berikutnya.
     *
     * @var list<string>
     */
    private const RETIRED_EXECUTION_KEYS = [
        'uat2_draft_saved_at',
        'uat2_draft_saved_by',
        'uat2_verification_history',
        'uat2_major_revision_verified_at',
        'uat2_sit_retest_passed_at',
        'uat2_verification_mode',
        'uat2_resume_after_sit',
    ];

    public function up(): void
    {
        $runAt = now()->toIso8601String();
        $repairedCount = 0;

        // Satu transaksi untuk seluruh perbaikan: separuh baris yang berpindah
        // keadaan lebih buruk daripada tidak ada yang berpindah sama sekali.
        // Chunking tetap dipakai agar tabel besar tidak dimuat sekaligus ke memori.
        DB::transaction(function () use ($runAt, &$repairedCount): void {
            DB::table('projects')
                ->select('id', 'req_id', 'status', 'sit_uat_data')
                ->whereNotNull('sit_uat_data')
                // Saringan awal yang murah dan tidak bergantung driver — target
                // produksi belum diputuskan, jadi fungsi JSON bawaan MySQL/MariaDB
                // dihindari. Predikat yang mengikat tetap dievaluasi di PHP.
                ->where(function ($query): void {
                    $query->where('sit_uat_data', 'like', '%uat2_verification_mode%')
                        ->orWhere('sit_uat_data', 'like', '%uat2_resume_after_sit%');
                })
                ->orderBy('id')
                ->chunkById(200, function ($rows) use ($runAt, &$repairedCount): void {
                    foreach ($rows as $row) {
                        $repairedCount += $this->repairRow($row, $runAt) ? 1 : 0;
                    }
                });
        });

        Log::info('Perbaikan data mode verifikasi UAT selesai.', [
            'migration' => self::MIGRATION_NAME,
            'repaired_projects' => $repairedCount,
            'run_at' => $runAt,
        ]);
    }

    /**
     * Perbaikan data tidak punya kebalikan yang jujur.
     *
     * Keadaan sebelumnya bukan sekadar beberapa nilai kolom, melainkan kombinasi
     * `uat2_verification_mode = true` dengan hasil eksekusi UAT yang mengendap di
     * Tahap 2 — dan justru kombinasi itulah yang sudah tidak dapat dijalankan kode
     * mana pun setelah mode verifikasi dihapus. Memulihkannya berarti mengembalikan
     * proyek ke keadaan mati langkah yang sama.
     *
     * Pemulihan separuh lebih buruk lagi: menghapus `uat_cycles` sambil
     * mengembalikan `activeUatStep = 2` akan menghasilkan keadaan ketiga yang tidak
     * pernah sah — arsip hilang, hasil eksekusi tidak kembali. Karena itu `down()`
     * dibiarkan kosong dan disengaja. Bila rollback benar-benar dibutuhkan,
     * jalurnya adalah restore dari backup database, bukan migration ini.
     */
    public function down(): void
    {
        Log::warning('Migration perbaikan mode verifikasi UAT tidak dapat dibatalkan; down() sengaja tidak melakukan apa pun.', [
            'migration' => self::MIGRATION_NAME,
        ]);
    }

    /**
     * @param  object{id: int, req_id: string, status: string, sit_uat_data: ?string}  $row
     * @return bool  true bila baris benar-benar ditulis ulang
     */
    private function repairRow(object $row, string $runAt): bool
    {
        $original = json_decode((string) $row->sit_uat_data, true);

        if (! is_array($original)) {
            // Kolomnya teks bebas, jadi isi yang tidak dapat didekode mungkin saja
            // ada. Baris seperti itu dilewati dengan catatan, bukan menggagalkan
            // seluruh perbaikan — tetapi operator tetap perlu tahu.
            Log::warning('sit_uat_data tidak dapat didekode; baris dilewati.', [
                'migration' => self::MIGRATION_NAME,
                'project_id' => $row->id,
                'req_id' => $row->req_id,
            ]);

            return false;
        }

        if (! $this->isStrandedInVerificationMode($original)) {
            return false;
        }

        $cycle = $this->cycleNumber($original);

        // Idempotensi lapis kedua. Lapis pertama sudah melekat pada predikatnya
        // sendiri: perbaikan membuang `uat2_verification_mode` dan
        // `uat2_resume_after_sit` serta mengubah `sit_retest_scope.mode` menjadi
        // `full`, sehingga tidak satu pun cabang predikat dapat cocok dua kali.
        if ($this->hasMigrationArchivedCycle($original, $cycle)) {
            return false;
        }

        $sitRetestPassed = $this->sitRetestHasPassed($original);
        $repaired = $this->restartUat($original, $cycle, $sitRetestPassed, $runAt);

        $this->assertUntouchedKeysAreIdentical($original, $repaired, (int) $row->id);

        DB::table('projects')
            ->where('id', $row->id)
            ->update(['sit_uat_data' => json_encode($repaired, JSON_THROW_ON_ERROR)]);

        Log::info('UAT dikembalikan ke Tahap 1 dan putaran lamanya diarsipkan.', [
            'migration' => self::MIGRATION_NAME,
            'project_id' => $row->id,
            'req_id' => $row->req_id,
            'project_status' => $row->status,
            'active_sit_step' => $original['activeSitStep'] ?? null,
            'active_uat_step_before' => $original['activeUatStep'] ?? null,
            'uat_hold_status_before' => $original['uat_hold']['status'] ?? null,
            'uat_hold_status_after' => $repaired['uat_hold']['status'] ?? null,
            'sit_retest_mode_before' => $original['sit_retest_scope']['mode'] ?? null,
            'sit_retest_status' => $original['sit_retest_scope']['status'] ?? null,
            'sit_retest_passed' => $sitRetestPassed,
            'uat_restart_after_sit' => $repaired['uat_restart_after_sit'],
            'archived_cycle' => $cycle,
            'archived_at' => $runAt,
        ]);

        return true;
    }

    /**
     * Predikat yang menentukan sebuah baris memang tertahan di keadaan pensiun.
     *
     * Dua cabang, karena mode verifikasi punya dua titik henti:
     *
     *   1. `uat2_verification_mode === true` — SIT ulang sudah lulus dan UAT sudah
     *      dilanjutkan ke Tahap 2 baca-saja. Ini keadaan yang benar-benar mati
     *      langkah dan satu-satunya yang ditemukan pada data nyata.
     *   2. `activeUatStep >= 2` dengan penanda lama `uat2_resume_after_sit` aktif,
     *      `uat_hold.cycle > 0`, dan `sit_retest_scope.mode === 'targeted'` — belum
     *      masuk mode verifikasi, tetapi seluruh rencananya masih rencana lama:
     *      scope SIT ulang dipersempit dan UAT diarahkan kembali ke Tahap 2.
     *      Dibiarkan, baris ini akan sampai ke mode verifikasi yang sudah tidak ada.
     *
     * `mode === 'targeted'` menjadi pembeda penting pada cabang kedua: baris yang
     * di-hold oleh kode baru selalu ber-`mode = 'full'`, jadi ia tidak akan tersapu.
     */
    private function isStrandedInVerificationMode(array $data): bool
    {
        if (($data['uat2_verification_mode'] ?? false) === true) {
            return true;
        }

        return (int) ($data['activeUatStep'] ?? 1) >= 2
            && ($data['uat2_resume_after_sit'] ?? false) === true
            && (int) ($data['uat_hold']['cycle'] ?? 0) > 0
            && ($data['sit_retest_scope']['mode'] ?? null) === 'targeted';
    }

    /**
     * Apakah SIT ulang siklus ini sudah lulus.
     *
     * Menentukan nilai `uat_restart_after_sit`, jadi tidak boleh salah: penanda itu
     * berarti "pengulangan UAT masih menunggu SIT ulang". Empat penanda dipakai
     * bersama karena masing-masing ditulis di titik berbeda dan satu pun cukup
     * membuktikan SIT ulang sudah tuntas — termasuk mode verifikasi itu sendiri,
     * yang secara definisi baru dapat aktif sesudah SIT ulang lulus.
     */
    private function sitRetestHasPassed(array $data): bool
    {
        return ($data['sit_retest_scope']['status'] ?? null) === 'passed'
            || filled($data['uat_hold']['sitPassedAt'] ?? null)
            || filled($data['uat2_sit_retest_passed_at'] ?? null)
            || ($data['uat2_verification_mode'] ?? false) === true;
    }

    /**
     * Nomor siklus revisi yang putaran UAT-nya sedang diarsipkan.
     *
     * `uat_hold.cycle` adalah sumber utamanya karena di situlah nomor yang dipakai
     * `UatExecutionService` saat menahan UAT tersimpan; jumlah
     * `uat_revision_cycles` hanya cadangan untuk baris yang `uat_hold`-nya cacat.
     */
    private function cycleNumber(array $data): int
    {
        $cycle = (int) ($data['uat_hold']['cycle'] ?? 0);

        return $cycle > 0 ? $cycle : count((array) ($data['uat_revision_cycles'] ?? []));
    }

    private function hasMigrationArchivedCycle(array $data, int $cycle): bool
    {
        foreach ((array) ($data['uat_cycles'] ?? []) as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            if ((int) ($entry['cycle'] ?? 0) === $cycle
                && ($entry['reason'] ?? null) === 'major_revision'
                && ($entry['archivedBy'] ?? null) === self::ARCHIVED_BY) {
                return true;
            }
        }

        return false;
    }

    /**
     * Pindahkan baris ke keadaan yang sah menurut aturan pengulangan penuh.
     *
     * Arsip ditulis lebih dulu, sebelum satu kunci pun dikosongkan. `AGENTS.md`
     * melarang hard-delete atas approval dan bukti, dan pengulangan penuh memang
     * membuang hasil eksekusi beserta persetujuannya — `uat_cycles` inilah
     * satu-satunya bukti bahwa putaran itu pernah dijalankan, siapa yang
     * menyimpulkannya, dan apa kesimpulannya.
     *
     * `uat1_participants` dan `uat1_docs` tidak pernah disebut, ditugaskan, atau
     * diiterasi di sini. Daftar penanda tangan UAT adalah hasil kesepakatan orang,
     * bukan hasil eksekusi: ia harus bertahan melewati setiap siklus revisi.
     * Mengosongkannya memaksa PM menyusun ulang roster yang sama, dan lebih buruk,
     * membuat urutan penanda tangan berubah tanpa ada yang memutuskannya.
     * `assertUntouchedKeysAreIdentical()` membuktikan hal itu byte demi byte, bukan
     * sekadar menjanjikannya.
     */
    private function restartUat(array $data, int $cycle, bool $sitRetestPassed, string $runAt): array
    {
        $uatCycles = (array) ($data['uat_cycles'] ?? []);
        $uatCycles[] = [
            'cycle' => $cycle,
            'summary' => (array) ($data['uat2_summary'] ?? []),
            'scenarios' => (array) ($data['uat2_scenarios'] ?? []),
            'additionalRequests' => (array) ($data['uat2_additional_requests'] ?? []),
            'executedCount' => (int) ($data['uat2_executedCount'] ?? 0),
            'passedCount' => (int) ($data['uat2_passedCount'] ?? 0),
            'findings' => (int) ($data['uat2_findings'] ?? 0),
            'execNotes' => filled($data['uat2_execNotes'] ?? null)
                ? (string) $data['uat2_execNotes']
                : null,
            'approvals' => (array) ($data['uat3_approvals'] ?? []),
            'verificationHistory' => (array) ($data['uat2_verification_history'] ?? []),
            'archivedAt' => $runAt,
            'archivedBy' => self::ARCHIVED_BY,
            'reason' => 'major_revision',
        ];
        $data['uat_cycles'] = $uatCycles;

        // Scope SIT ulang menjadi menyeluruh. `affectedItems` justru dipertahankan:
        // setelah `mode` tidak lagi mempersempit apa pun, daftar itulah satu-satunya
        // penjelasan mengapa siklus ini ada — sekaligus tempat `taskIds` lama masih
        // dapat ditelusuri. `status`, `cycle`, dan seluruh cap waktunya juga tetap,
        // karena SIT ulang yang sudah berjalan adalah bukti pengujian.
        $data['sit_retest_scope'] = [
            ...(array) ($data['sit_retest_scope'] ?? []),
            'mode' => 'full',
            'taskIds' => [],
        ];

        // `resumeStep` selalu 1 — tidak ada lagi titik lanjut selain awal siklus.
        // `cycle`, `reason`, `heldAt`, dan `heldBy` adalah catatan kapan dan oleh
        // siapa UAT ditahan, jadi tidak disentuh.
        $data['uat_hold'] = [
            ...(array) ($data['uat_hold'] ?? []),
            'resumeStep' => 1,
        ];

        if ($sitRetestPassed) {
            // `uat_verification` adalah kosakata status yang ikut pensiun. Baris yang
            // SIT ulangnya sudah lulus memakai istilah baru untuk keadaan yang sama:
            // menunggu UAT dijalankan ulang dari awal.
            $data['uat_hold']['status'] = 'uat_restart';

            if (filled($data['uat2_sit_retest_passed_at'] ?? null)) {
                // Cap waktu yang sama, di bawah nama yang dipakai kode baru. Nilainya
                // dipindahkan lebih dulu, karena kunci lamanya dibuang di bawah.
                $data['uat_sit_retest_passed_at'] = (string) $data['uat2_sit_retest_passed_at'];
            }
        }

        // Penanda baru menyatakan apa yang masih ditunggu, bukan apa yang sudah
        // terjadi: SIT ulang yang sudah lulus berarti tidak ada lagi yang ditunggu,
        // dan UAT dapat langsung dijalankan ulang dari Tahap 1.
        $data['uat_restart_after_sit'] = ! $sitRetestPassed;
        $data['activeUatStep'] = 1;

        foreach (self::CLEARED_EXECUTION_VALUES as $key => $emptyValue) {
            $data[$key] = $emptyValue;
        }

        foreach (self::RETIRED_EXECUTION_KEYS as $key) {
            unset($data[$key]);
        }

        return $data;
    }

    /**
     * Buktikan bahwa selain kunci yang memang menjadi tugas migration ini, tidak
     * ada satu pun kunci `sit_uat_data` yang berubah isi maupun urutannya.
     *
     * Kolomnya satu blob JSON untuk seluruh siklus SIT dan UAT, ditulis ulang utuh
     * setiap kali. Artinya satu kekeliruan sunting dapat merusak data yang sama
     * sekali tidak dimaksud disentuh — daftar penanda tangan, dokumen persiapan,
     * arsip siklus SIT — tanpa jejak. Pemeriksaan ini menahan hal itu di dalam
     * transaksi: bila ada selisih, seluruh perbaikan dibatalkan.
     */
    private function assertUntouchedKeysAreIdentical(array $original, array $repaired, int $projectId): void
    {
        $writableKeys = array_flip([
            'activeUatStep',
            'uat_cycles',
            'uat_hold',
            'sit_retest_scope',
            'uat_restart_after_sit',
            'uat_sit_retest_passed_at',
            ...array_keys(self::CLEARED_EXECUTION_VALUES),
            ...self::RETIRED_EXECUTION_KEYS,
        ]);

        $untouched = static fn (array $data): string => json_encode(
            array_diff_key($data, $writableKeys),
            JSON_THROW_ON_ERROR
        );

        if ($untouched($original) !== $untouched($repaired)) {
            throw new RuntimeException(
                "Perbaikan sit_uat_data proyek {$projectId} mengubah kunci di luar cakupannya; seluruh migration dibatalkan."
            );
        }
    }
};
