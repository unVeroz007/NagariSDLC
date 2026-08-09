<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Menambahkan kolom project_type (baru | perbaikan | update)
     * pada tabel projects — tipe proyek ditentukan saat inisiasi.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('projects', 'project_type')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->string('project_type', 50)
                    ->default('baru')
                    ->after('description');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('projects', 'project_type')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->dropColumn('project_type');
            });
        }
    }
};
