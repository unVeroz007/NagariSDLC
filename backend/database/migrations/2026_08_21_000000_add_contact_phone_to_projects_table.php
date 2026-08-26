<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tambahkan `projects.contact_phone`.
 *
 * Versi pertama migration ini tidak berhenti di penambahan kolom: ia juga mengisi
 * setiap baris lama dengan nomor telepon acak, `'08'` disambung sembilan digit dari
 * `random_int()`. Backfill itu sudah dibuang, dan alasannya perlu dicatat supaya
 * tidak dihidupkan lagi oleh orang berikutnya yang merasa kolom kosong itu jelek.
 *
 * Nomor kontak karangan lebih berbahaya daripada kolom kosong. Kolom kosong jujur:
 * ia memberi tahu bahwa nomornya belum diketahui, dan setiap pemeriksaan "kontak ini
 * dapat dihubungi?" akan menjawab tidak. Nomor karangan justru terlihat sah — ia
 * berformat benar, tampil di daftar proyek dan halaman Track sama persis seperti
 * nomor sungguhan, dan pada akhirnya akan benar-benar ditelepon oleh orang yang
 * sedang memburu rilis. Yang tersambung adalah orang asing, bukan PIC proyek. Di
 * sistem tata kelola sebuah bank, data yang berpura-pura sahih adalah cacat yang
 * lebih mahal daripada data yang tidak ada.
 *
 * Kolom dibiarkan `nullable` dengan sengaja. Baris lama memang tidak punya nomor;
 * satu-satunya cara jujur menyatakan hal itu adalah `NULL`. Kewajiban mengisi nomor
 * adalah urusan lapisan validasi untuk data baru, bukan urusan skema yang harus
 * mengakomodasi masa lalu.
 *
 * Mengubah migration ini TIDAK memperbaiki baris yang sudah terisi nomor karangan,
 * karena migration yang sudah tercatat di tabel `migrations` tidak dijalankan ulang.
 * File ini hanya menjaga agar instalasi baru dan `migrate:fresh` tidak lagi
 * mengarang data. Pembersihan baris yang sudah ada dikerjakan
 * `2026_08_24_000001_null_fabricated_contact_phone_on_projects_table`, dan keduanya
 * harus dijalankan sebagai satu pasang.
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
