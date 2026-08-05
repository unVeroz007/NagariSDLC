<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'qa_status')) {
                $table->string('qa_status')->default('NOT_SUBMITTED')->nullable()->after('status');
            }
            if (!Schema::hasColumn('projects', 'cyber_status')) {
                $table->string('cyber_status')->default('NOT_SUBMITTED')->nullable()->after('qa_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'qa_status')) {
                $table->dropColumn('qa_status');
            }
            if (Schema::hasColumn('projects', 'cyber_status')) {
                $table->dropColumn('cyber_status');
            }
        });
    }
};
