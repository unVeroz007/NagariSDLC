<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Kosongkan nomor telepon kontak yang dikarang oleh backfill lama.
 *
 * `2026_08_21_000000_add_contact_phone_to_projects_table` dulu tidak berhenti pada
 * penambahan kolom. Sesudah kolomnya ada, ia menyapu seluruh baris yang masih `NULL`
 * dan menuliskan nomor acak:
 *
 *     '08' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT)
 *
 * Backfill itu sudah dibuang dari file tersebut, tetapi membuangnya tidak menyembuhkan
 * apa pun: migration yang sudah tercatat di tabel `migrations` tidak akan dijalankan
 * ulang. File aslinya kini hanya menjaga instalasi baru; baris yang sudah menerima
 * nomor karangan adalah tugas migration ini.
 *
 * Mengapa ini dianggap cacat dan bukan sekadar kosmetik: nomor karangan berformat
 * sah. Ia lewat validasi, ia tampil di kolom "Nomor Telepon Kontak" pada daftar
 * proyek dan halaman Track dengan ikon telepon hijau yang sama seperti nomor asli,
 * dan cepat atau lambat ia akan ditelepon oleh orang yang mengejar sebuah rilis.
 * Kolom kosong menjawab "belum diketahui"; nomor karangan menjawab "ini nomornya"
 * dan salah. Yang kedua jauh lebih mahal.
 *
 * ─── Predikat pengenal ───────────────────────────────────────────────────────────
 *
 * Keluaran generator itu terkarakterisasi penuh, bukan diperkirakan:
 * `random_int(0, 999999999)` paling panjang sembilan digit dan `str_pad(..., 9)`
 * memaksanya tepat sembilan digit, sehingga setiap nilai yang pernah ditulisnya
 * PASTI `'08'` + 9 digit = tepat 11 karakter, seluruhnya angka. Karena itu:
 *
 *   - Setiap nilai yang TIDAK cocok `^08[0-9]{9}$` terbukti bukan tulisan migration
 *     itu. Arah ini mutlak, tanpa celah. Pada basis data live, 18 dari 20 baris masuk
 *     kategori ini dan karena itu tidak akan disentuh.
 *   - `ProjectSeeder` tidak pernah menyentuh `contact_phone` sama sekali, jadi tidak
 *     ada penulis otomatis lain atas kolom ini. Satu-satunya mesin yang pernah
 *     mengisinya adalah backfill tersebut.
 *
 * Yang TIDAK boleh dilebih-lebihkan: tidak ada validasi format nomor di mana pun —
 * frontend hanya mewajibkan kolom tidak kosong, backend hanya `nullable|string|max:30`
 * — sehingga secara prinsip seseorang bisa mengetik nomor 11 digit berawalan `08` dan
 * nilainya akan cocok dengan sidik generator. Pada data live hal itu tidak terjadi:
 * seluruh 18 nilai yang jelas berasal dari manusia berpanjang 10, 12, atau 13
 * karakter, tidak satu pun 11. Uji "prefiks operator sah" sengaja TIDAK dipakai
 * sebagai pembeda, karena justru terbukti menyesatkan: empat baris buatan manusia di
 * data live berprefiks mustahil (`0809`, `0844`, `0865`, `0874`), sedangkan dua baris
 * yang cocok sidik generator berprefiks yang kebetulan sah. Bentuk nomor di basis data
 * ini tidak berkorelasi dengan keasliannya.
 *
 * Karena sisa risiko itu nyata meski kecil, nilai lama TIDAK dibuang begitu saja: ia
 * diarsipkan ke `activity_logs` sebelum kolomnya dikosongkan. `AGENTS.md` melarang
 * hard-delete data dan histori, dan di sini larangan itu sekaligus menjadi jaring
 * pengaman — bila ternyata ada satu nomor asli yang tersapu, nomor itu masih utuh di
 * jejak audit dan dapat dipulihkan, bukan hilang selamanya.
 *
 * `down()` sengaja tidak memulihkan apa pun; alasannya ada di method-nya.
 */
return new class extends Migration
{
    private const MIGRATION_NAME = '2026_08_24_000001_null_fabricated_contact_phone_on_projects_table';

    /**
     * Penanda entri arsip. Dipakai sekaligus sebagai kunci idempotensi lapis kedua:
     * adanya entri bertanda ini untuk sebuah proyek berarti nomor karangannya sudah
     * pernah diarsipkan dan dikosongkan.
     */
    private const ARCHIVE_ACTION = 'revert_fabricated_contact_phone';

    /**
     * Sidik keluaran generator lama, persis dan lengkap: `'08'` lalu sembilan digit,
     * tepat 11 karakter. Tidak dilonggarkan menjadi `{9,}` atau tanpa jangkar —
     * pelonggaran sekecil itu langsung menyeret nomor 12 dan 13 digit buatan manusia,
     * yang justru merupakan mayoritas data.
     */
    private const FABRICATED_PATTERN = '/^08[0-9]{9}$/';

    public function up(): void
    {
        $runAt = now();
        $neutralisedCount = 0;
        $inspectedCount = 0;

        // Satu transaksi untuk seluruh perbaikan: separuh baris yang dikosongkan tanpa
        // separuh arsipnya tertulis adalah keadaan yang lebih buruk daripada tidak ada
        // yang berubah. Chunking tetap dipakai agar tabel besar tidak dimuat sekaligus.
        DB::transaction(function () use ($runAt, &$neutralisedCount, &$inspectedCount): void {
            DB::table('projects')
                ->select('id', 'req_id', 'title', 'contact_phone')
                ->whereNotNull('contact_phone')
                // Saringan awal yang murah dan tidak bergantung driver. `LIKE '08%'`
                // berperilaku sama di MySQL/MariaDB maupun SQLite, sedangkan `REGEXP`
                // tidak ada di SQLite — dan test suite berjalan di SQLite. Predikat
                // yang mengikat tetap dievaluasi di PHP, bukan di SQL.
                ->where('contact_phone', 'like', '08%')
                ->orderBy('id')
                ->chunkById(200, function ($rows) use ($runAt, &$neutralisedCount, &$inspectedCount): void {
                    foreach ($rows as $row) {
                        $inspectedCount++;
                        $neutralisedCount += $this->neutraliseRow($row, $runAt) ? 1 : 0;
                    }
                });
        });

        Log::info('Pembersihan nomor telepon kontak karangan selesai.', [
            'migration' => self::MIGRATION_NAME,
            'inspected_rows' => $inspectedCount,
            'neutralised_rows' => $neutralisedCount,
            'run_at' => $runAt->toIso8601String(),
        ]);
    }

    /**
     * Perbaikan data ini tidak punya kebalikan yang jujur.
     *
     * Mengembalikan kolomnya berarti menuliskan ulang nomor karangan — tepat keadaan
     * yang migration ini ada untuk menghapus. Dan nomor yang dulu tertulis pun tidak
     * dapat direproduksi: `random_int()` tidak punya benih yang tersimpan, sehingga
     * `down()` paling banter hanya mampu mengarang nomor baru yang berbeda. Itu bukan
     * rollback, itu pengarangan kedua.
     *
     * Yang perlu diketahui operator: nilai lama tidak hilang. Setiap nomor yang
     * dikosongkan sudah diarsipkan ke `activity_logs` dengan action
     * `revert_fabricated_contact_phone`, lengkap dengan `project_id` dan `req_id`-nya.
     * Bila satu nomor ternyata perlu dipulihkan — misalnya karena benar-benar asli dan
     * hanya kebetulan berbentuk 11 digit — pemulihannya dilakukan dari entri arsip itu,
     * satu baris secara sadar, bukan lewat `migrate:rollback` yang menyapu semuanya.
     */
    public function down(): void
    {
        Log::warning('Migration pembersihan nomor telepon karangan tidak dapat dibatalkan; down() sengaja tidak melakukan apa pun.', [
            'migration' => self::MIGRATION_NAME,
            'pemulihan' => "Nilai lama tersimpan di activity_logs dengan action '" . self::ARCHIVE_ACTION . "'.",
        ]);
    }

    /**
     * @param  object{id: int, req_id: ?string, title: ?string, contact_phone: ?string}  $row
     * @return bool  true bila baris benar-benar dikosongkan
     */
    private function neutraliseRow(object $row, \DateTimeInterface $runAt): bool
    {
        $phone = (string) $row->contact_phone;

        if (preg_match(self::FABRICATED_PATTERN, $phone) !== 1) {
            return false;
        }

        // Idempotensi lapis kedua. Lapis pertama sudah melekat pada predikatnya
        // sendiri: sesudah dikosongkan nilainya `NULL`, dan `NULL` tidak lolos
        // `whereNotNull()` maupun `LIKE '08%'`, sehingga baris yang sama tidak
        // mungkin terpungut dua kali. Lapis ini menjaga kasus yang lebih licin —
        // baris yang nomor karangannya sempat ditulis ulang lalu migration dijalankan
        // ulang — agar tidak menghasilkan entri arsip ganda untuk proyek yang sama.
        if ($this->hasArchivedEntry((int) $row->id)) {
            return false;
        }

        $this->archivePreviousValue($row, $phone, $runAt);

        // `updated_at` sengaja TIDAK ikut disentuh, sejalan dengan backfill lama yang
        // juga menulis lewat query builder tanpa timestamp. Membumikan `updated_at` ke
        // waktu sekarang akan membuat proyek ini seolah baru saja disunting seseorang,
        // padahal tidak ada manusia yang mengubah apa pun — dan sinyal "terakhir
        // diubah" itu dibaca dashboard untuk mengukur cycle time.
        DB::table('projects')
            ->where('id', $row->id)
            ->update(['contact_phone' => null]);

        Log::info('Nomor telepon kontak karangan dikosongkan.', [
            'migration' => self::MIGRATION_NAME,
            'project_id' => $row->id,
            'req_id' => $row->req_id,
            'previous_length' => strlen($phone),
            'archived_to' => 'activity_logs',
            'archive_action' => self::ARCHIVE_ACTION,
        ]);

        return true;
    }

    private function hasArchivedEntry(int $projectId): bool
    {
        return DB::table('activity_logs')
            ->where('action', self::ARCHIVE_ACTION)
            ->where('subject_type', 'App\Models\Project')
            ->where('subject_id', $projectId)
            ->exists();
    }

    /**
     * Simpan nomor lama ke jejak audit sebelum kolomnya dikosongkan.
     *
     * Urutannya penting dan bukan kebetulan: arsip ditulis lebih dulu, di dalam
     * transaksi yang sama. Bila penulisan arsip gagal, pengosongan kolom ikut
     * dibatalkan, sehingga tidak pernah ada keadaan "nomor sudah hilang, buktinya
     * belum tertulis".
     *
     * `user_id` dibiarkan `NULL` karena tidak ada manusia yang melakukan ini;
     * pelakunya dinyatakan lewat `metadata.performed_by` agar tidak ada yang salah
     * mengira seorang pengguna yang menghapus nomor tersebut.
     */
    private function archivePreviousValue(object $row, string $phone, \DateTimeInterface $runAt): void
    {
        DB::table('activity_logs')->insert([
            'user_id' => null,
            'action' => self::ARCHIVE_ACTION,
            'action_label' => 'Mengosongkan Nomor Telepon Karangan',
            'description' => sprintf(
                'Nomor telepon kontak proyek "%s" (%s) dikosongkan karena diisi otomatis oleh backfill migration, bukan oleh pengaju.',
                (string) $row->title,
                (string) $row->req_id
            ),
            'subject_type' => 'App\Models\Project',
            'subject_id' => $row->id,
            // Di-encode manual: penulisan lewat query builder tidak melewati cast
            // `metadata => array` milik model ActivityLog, jadi array mentah akan
            // ditolak driver. Bentuk akhirnya tetap JSON, sehingga entri ini terbaca
            // sama seperti entri lain saat diambil lewat model.
            'metadata' => json_encode([
                'migration' => self::MIGRATION_NAME,
                'project_id' => (int) $row->id,
                'req_id' => $row->req_id,
                'previous_contact_phone' => $phone,
                'reason' => 'Nilai cocok dengan sidik keluaran backfill lama: 08 + 9 digit, tepat 11 karakter.',
                'performed_by' => 'system:migration',
            ], JSON_THROW_ON_ERROR),
            'ip_address' => null,
            'status' => 'success',
            // Diisi eksplisit, tidak menumpang default kolom: `activity_logs` tidak
            // punya `updated_at` dan default `CURRENT_TIMESTAMP`-nya hanya ada di
            // MySQL/MariaDB, sedangkan test berjalan di SQLite.
            'created_at' => $runAt->format('Y-m-d H:i:s'),
        ]);
    }
};
