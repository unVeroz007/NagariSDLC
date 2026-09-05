<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tambahkan `projects.contact_phone`.
 *
 * Kolom sengaja nullable untuk data lama. Jangan menghidupkan kembali backfill nomor
 * acak; data buatannya dibersihkan oleh migration `2026_08_24_000001_*`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('contact_phone', 30)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('contact_phone');
        });
    }
};
