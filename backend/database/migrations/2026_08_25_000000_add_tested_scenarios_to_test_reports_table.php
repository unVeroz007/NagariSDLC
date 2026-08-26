<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ganti daftar centang skenario Pengujian QA dengan catatan bebas.
 *
 * Kolom `checklist` menyimpan enam skenario tetap sebagai peta boleh/tidak
 * (`{"scenario_positive": true, ...}`). Bentuk itu keliru: cakupan pengujian tiap
 * proyek berbeda, sehingga penguji dipaksa mencentang skenario yang tidak relevan
 * atau membiarkan skenario yang benar-benar dijalankan tidak tercatat sama sekali.
 *
 * Kolom baru `tested_scenarios` menampung tulisan penguji sendiri tentang skenario
 * apa yang dijalankan. Kolom `checklist` TIDAK dihapus: laporan lama sudah memakainya
 * dan laporan pengujian adalah bagian jejak audit rilis, jadi isinya tetap dibaca
 * `TestReportResource` untuk laporan yang dibuat sebelum perubahan ini.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_reports', function (Blueprint $table) {
            if (! Schema::hasColumn('test_reports', 'tested_scenarios')) {
                $table->text('tested_scenarios')->nullable()->after('checklist');
            }
        });
    }

    public function down(): void
    {
        Schema::table('test_reports', function (Blueprint $table) {
            if (Schema::hasColumn('test_reports', 'tested_scenarios')) {
                $table->dropColumn('tested_scenarios');
            }
        });
    }
};
