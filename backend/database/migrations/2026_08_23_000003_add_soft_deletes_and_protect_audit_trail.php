<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lindungi jejak audit dari penghapusan permanen.
 *
 * Dua masalah diselesaikan bersamaan karena keduanya berbagi satu akar: tidak ada
 * satu pun model yang memakai penghapusan lunak, sedangkan tujuh kunci asing
 * menunjuk `users` dengan aturan `ON DELETE CASCADE`.
 *
 * Akibatnya, satu `DELETE /users/{id}` menghapus permanen — dalam satu perintah,
 * tanpa peringatan, dan tanpa jalan pulih — seluruh proyek yang pernah diajukan
 * pengguna itu (`projects.created_by`), berikut semua anak proyeknya yang juga
 * ber-CASCADE: riwayat status, task, alokasi tim, laporan pengujian, dokumen,
 * pengajuan rilis, putaran approval UAT, dan percakapan proyek. Hal yang sama
 * berlaku untuk `DELETE /divisions/{id}`, karena `projects.division_id` pun
 * ber-CASCADE. Padahal seluruh data itu adalah bukti tata kelola SDLC yang wajib
 * dapat ditelusuri.
 *
 * Perubahannya:
 *
 *   1. `users`, `projects`, dan `divisions` mendapat `deleted_at`. Penghapusan dari
 *      aplikasi menjadi penghapusan lunak — barisnya hilang dari seluruh query
 *      biasa, tetapi jejaknya tetap ada dan dapat dipulihkan.
 *   2. Kunci asing yang mengarah ke `users` diubah dari `CASCADE` menjadi
 *      `RESTRICT` bila kolomnya `NOT NULL`. Sesudah ini, penghapusan permanen satu
 *      pengguna yang punya jejak akan ditolak database, bukan diam-diam menyeret
 *      data lain. Ini lapis terakhir: pemeriksaan di controller yang memberi pesan
 *      manusiawi tetap menjadi lapis pertama.
 *   3. `projects.division_id` diubah dari `CASCADE` menjadi `RESTRICT` dengan alasan
 *      yang sama — satu divisi tidak boleh membawa serta seluruh proyeknya.
 *
 * Yang sengaja TIDAK diubah:
 *
 *   - `notifications.user_id` tetap `CASCADE`. Notifikasi adalah kotak masuk pribadi,
 *     bukan bukti audit, sehingga tidak perlu menahan penghapusan pengguna.
 *   - Kunci asing anak-ke-`projects` tetap `CASCADE`. Bila sebuah proyek memang
 *     dihapus permanen (mis. `forceDelete` yang disengaja), anak-anaknya harus ikut
 *     terhapus agar tidak menjadi baris yatim. Penghapusan lunak pada `Project`
 *     membuat aturan ini tidak lagi tersentuh oleh alur aplikasi normal.
 *   - Kunci asing yang sudah `SET NULL` tidak disentuh; atribusinya memang boleh
 *     hilang sementara barisnya tetap utuh.
 */
return new class extends Migration
{
    /**
     * Kunci asing menuju `users` yang kolomnya `NOT NULL`, sehingga satu-satunya
     * aturan aman adalah `RESTRICT`.
     *
     * @var array<string, string>  nama tabel => nama kolom
     */
    private const USER_AUDIT_FOREIGN_KEYS = [
        'projects' => 'created_by',
        'project_status_histories' => 'changed_by',
        'project_team_members' => 'user_id',
        'test_reports' => 'tester_id',
        'document_vaults' => 'uploaded_by',
        'release_requests' => 'requested_by',
    ];

    public function up(): void
    {
        foreach (['users', 'projects', 'divisions'] as $tableName) {
            if (Schema::hasColumn($tableName, 'deleted_at')) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table): void {
                $table->softDeletes();
            });
        }

        foreach (self::USER_AUDIT_FOREIGN_KEYS as $tableName => $columnName) {
            Schema::table($tableName, function (Blueprint $table) use ($columnName): void {
                $table->dropForeign([$columnName]);
                $table->foreign($columnName)->references('id')->on('users')->restrictOnDelete();
            });
        }

        Schema::table('projects', function (Blueprint $table): void {
            $table->dropForeign(['division_id']);
            $table->foreign('division_id')->references('id')->on('divisions')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropForeign(['division_id']);
            $table->foreign('division_id')->references('id')->on('divisions')->cascadeOnDelete();
        });

        foreach (self::USER_AUDIT_FOREIGN_KEYS as $tableName => $columnName) {
            Schema::table($tableName, function (Blueprint $table) use ($columnName): void {
                $table->dropForeign([$columnName]);
                $table->foreign($columnName)->references('id')->on('users')->cascadeOnDelete();
            });
        }

        foreach (['divisions', 'projects', 'users'] as $tableName) {
            if (! Schema::hasColumn($tableName, 'deleted_at')) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropSoftDeletes();
            });
        }
    }
};
