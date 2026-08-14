<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('projects', 'team_allocated_by_pm')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->boolean('team_allocated_by_pm')->default(false)->after('cyber_status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('projects', 'team_allocated_by_pm')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->dropColumn('team_allocated_by_pm');
            });
        }
    }
};
