<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jenis pemeriksaan yang dipilih PM saat mengajukan Audit Keamanan Siber.
 *
 * Audit Keamanan Siber punya dua bentuk yang menuntut masukan berbeda:
 * - Penetration Test menguji aplikasi yang sudah berjalan, sehingga membutuhkan
 *   alamat web target.
 * - Secure Code Review membaca kode sumber, sehingga membutuhkan rujukan repositori
 *   atau lokasi berkas kode.
 *
 * Tanpa kolom ini, pilihan PM tidak pernah tersimpan dan Pentester harus menebak
 * ruang lingkup pekerjaannya dari catatan bebas.
 *
 * `cyber_check_type` disimpan sebagai string, bukan enum kolom database, mengikuti
 * pola `status` / `qa_status` / `cyber_status` yang sudah ada: penambahan jenis
 * pemeriksaan baru nanti cukup mengubah enum PHP tanpa migrasi struktur.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->string('cyber_check_type')->nullable()->after('cyber_assignee_id');
            $table->string('cyber_target_url', 2048)->nullable()->after('cyber_check_type');
            $table->text('cyber_source_code_ref')->nullable()->after('cyber_target_url');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn([
                'cyber_check_type',
                'cyber_target_url',
                'cyber_source_code_ref',
            ]);
        });
    }
};
