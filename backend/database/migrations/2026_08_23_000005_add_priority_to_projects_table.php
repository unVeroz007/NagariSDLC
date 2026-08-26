<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Menyimpan prioritas yang dipilih pengaju pada baris proyek.
 *
 * Prioritas sudah lebih dulu ada di PRD, di contoh `POST /projects` pada
 * `docs/API_REFERENCE.md`, dan di form inisiasi proyek — tetapi tidak pernah ada
 * kolomnya. Akibatnya pilihan pengaju hilang tanpa pesan kesalahan dan setiap layar
 * yang membacanya menampilkan prioritas terendah untuk semua proyek.
 *
 * Tipe dan nilai bawaannya mengikuti `project_tasks.priority` supaya kedua kolom
 * prioritas di aplikasi ini memakai satu kosakata yang sama (`High|Medium|Low`).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('projects', 'priority')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->string('priority')->default('Medium')->after('project_type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('projects', 'priority')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->dropColumn('priority');
            });
        }
    }
};
