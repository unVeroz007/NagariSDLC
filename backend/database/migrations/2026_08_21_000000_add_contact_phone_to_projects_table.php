<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('contact_phone', 30)->nullable()->after('description');
        });

        // Isi nomor telpon dummy (berbeda tiap baris) untuk proyek lama yang belum punya
        $projects = \Illuminate\Support\Facades\DB::table('projects')->whereNull('contact_phone')->pluck('id');
        foreach ($projects as $id) {
            \Illuminate\Support\Facades\DB::table('projects')
                ->where('id', $id)
                ->update(['contact_phone' => '08' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT)]);
        }
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('contact_phone');
        });
    }
};
