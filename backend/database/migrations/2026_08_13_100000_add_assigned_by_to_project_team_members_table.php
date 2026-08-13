<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('project_team_members', 'assigned_by')) {
            Schema::table('project_team_members', function (Blueprint $table) {
                $table->string('assigned_by')->default('lead')->after('role_in_project');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('project_team_members', 'assigned_by')) {
            Schema::table('project_team_members', function (Blueprint $table) {
                $table->dropColumn('assigned_by');
            });
        }
    }
};
