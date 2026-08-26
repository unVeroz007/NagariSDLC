<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Menyimpan tenggat RBB (Rencana Bisnis Bank) pada baris proyek.
 *
 * `rbbDeadline` sudah dibaca 17 tempat di frontend dan didokumentasikan di
 * `docs/API_CONTRACT.md` (baris 67 dan 85), tetapi kolomnya tidak pernah ada. Panel
 * "Proyek RBB mendekati deadline" di `Dashboard.jsx` karena itu selalu kosong: filternya
 * menuntut `p.rbbDeadline` yang selamanya `undefined`.
 *
 * Kolomnya nullable dan berdiri sendiri dari `target_date`. Keduanya bukan duplikat:
 * `target_date` adalah target internal pengerjaan, sedangkan tenggat RBB adalah komitmen
 * tahunan bank yang hanya bermakna untuk proyek `type = 'RBB'`. Tidak ada batasan urutan
 * antara keduanya di tingkat basis data maupun validasi — tenggat RBB boleh sudah
 * terlewat, dan justru keadaan itulah yang ditampilkan dasbor sebagai "Terlewat Nh".
 *
 * Baris yang sudah ada tidak diisi nilai apa pun: tidak ada sumber data historis untuk
 * tenggat RBB, dan menebaknya dari `target_date` akan melahirkan komitmen bank yang tidak
 * pernah disepakati siapa pun.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('projects', 'rbb_deadline')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->date('rbb_deadline')->nullable()->after('target_date');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('projects', 'rbb_deadline')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->dropColumn('rbb_deadline');
            });
        }
    }
};
