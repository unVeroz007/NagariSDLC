<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('project_tasks', 'priority')) {
            Schema::table('project_tasks', function (Blueprint $table) {
                $table->string('priority')->default('Medium')->after('status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('project_tasks', 'priority')) {
            Schema::table('project_tasks', function (Blueprint $table) {
                $table->dropColumn('priority');
            });
        }
    }
};
