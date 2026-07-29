<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('test_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->onDelete('cascade');
            $table->string('test_type'); // 'qa' atau 'cyber'
            $table->foreignId('tester_id')->constrained('users')->onDelete('cascade');
            $table->string('result'); // 'pass', 'fail', 'conditional_pass'
            $table->text('notes')->nullable();
            $table->string('attachment_url')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('test_reports');
    }
};
