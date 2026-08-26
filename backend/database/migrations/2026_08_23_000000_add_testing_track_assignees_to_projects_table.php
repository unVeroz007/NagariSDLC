<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kolom penugasan personal untuk dua jalur pengujian paralel.
 *
 * Sebelum ini, disposisi QA Lead / Cyber Lead kepada seorang tester hanya tercatat
 * sebagai teks di dalam catatan transisi status. Akibatnya daftar tugas milik QA
 * Tester dan Pentester selalu kosong: frontend menyaring proyek berdasarkan
 * `qa_assignee` / `cyber_assignee` yang tidak pernah ada di respons API.
 *
 * Relasi memakai `nullOnDelete()` — bukan cascade. Penghapusan akun pengguna tidak
 * boleh menghapus proyek atau memutus jejak pengujiannya; penugasan cukup dikosongkan
 * agar Lead dapat mendisposisikan ulang.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->foreignId('qa_assignee_id')
                ->nullable()
                ->after('cyber_status')
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('cyber_assignee_id')
                ->nullable()
                ->after('qa_assignee_id')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('qa_assignee_id');
            $table->dropConstrainedForeignId('cyber_assignee_id');
        });
    }
};
