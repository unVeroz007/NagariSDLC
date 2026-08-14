<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('project_tasks', 'revision_note')) {
            Schema::table('project_tasks', function (Blueprint $table) {
                $table->text('revision_note')->nullable()->after('priority');
                $table->timestamp('revision_requested_at')->nullable()->after('revision_note');
                $table->foreignId('revision_requested_by')->nullable()->after('revision_requested_at')
                    ->constrained('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('project_tasks', 'revision_requested_by')) {
            Schema::table('project_tasks', function (Blueprint $table) {
                $table->dropConstrainedForeignId('revision_requested_by');
            });
        }
        if (Schema::hasColumn('project_tasks', 'revision_requested_at')) {
            Schema::table('project_tasks', function (Blueprint $table) {
                $table->dropColumn('revision_requested_at');
            });
        }
        if (Schema::hasColumn('project_tasks', 'revision_note')) {
            Schema::table('project_tasks', function (Blueprint $table) {
                $table->dropColumn('revision_note');
            });
        }
    }
};
