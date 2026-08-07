<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_vaults', function (Blueprint $table) {
            $table->string('mime_type')->nullable()->after('file_name');
        });
    }

    public function down(): void
    {
        Schema::table('document_vaults', function (Blueprint $table) {
            $table->dropColumn('mime_type');
        });
    }
};
