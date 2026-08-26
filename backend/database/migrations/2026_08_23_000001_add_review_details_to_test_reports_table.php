<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Melengkapi `test_reports` agar dapat menampung laporan pengujian yang utuh.
 *
 * Tabel awal hanya menyimpan hasil, catatan, dan satu `attachment_url`. Formulir
 * tester QA dan Pentester sudah lama mengumpulkan lebih dari itu — tingkat severity,
 * checklist skenario, dan beberapa berkas bukti — tetapi semuanya hanya hidup di
 * memori browser dan hilang saat halaman dimuat ulang.
 *
 * Empat kolom baru memisahkan dua peran yang sebelumnya tercampur dalam satu baris:
 * - `severity` & `checklist` & `evidence_document_ids`: milik tester saat submit.
 * - `review_notes` & `reviewed_result`: milik Lead saat sign-off.
 *
 * Keputusan Lead disimpan terpisah dari hasil tester supaya jejak audit tetap jujur
 * ketika Lead mengembalikan proyek meskipun tester menyatakan lulus, atau sebaliknya.
 *
 * `evidence_document_ids` menyimpan ID baris `document_vaults`, bukan salinan berkas.
 * Berkas tetap satu-satunya di vault sehingga penamaan, otorisasi unduh, dan
 * pencatatan pengunggah tidak terduplikasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_reports', function (Blueprint $table): void {
            $table->string('severity')->nullable()->after('result');
            $table->json('checklist')->nullable()->after('notes');
            $table->json('evidence_document_ids')->nullable()->after('attachment_url');
            $table->string('reviewed_result')->nullable()->after('reviewed_by');
            $table->text('review_notes')->nullable()->after('reviewed_result');

            // Laporan selalu dibaca per proyek per jalur, dan yang dipakai adalah
            // baris terbaru. Indeks ini melayani pola itu secara langsung.
            $table->index(['project_id', 'test_type'], 'test_reports_project_track_index');
        });
    }

    public function down(): void
    {
        Schema::table('test_reports', function (Blueprint $table): void {
            $table->dropIndex('test_reports_project_track_index');
            $table->dropColumn([
                'severity',
                'checklist',
                'evidence_document_ids',
                'reviewed_result',
                'review_notes',
            ]);
        });
    }
};
