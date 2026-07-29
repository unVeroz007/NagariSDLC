<?php

use App\Enums\ProjectStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('req_id')->unique(); // Format: REQ-2026-001
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status')->default(ProjectStatus::PENDING->value);
            
            // Foreign Keys
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('pm_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('analyst_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('division_id')->constrained('divisions')->onDelete('cascade');
            
            // Dates & Notes
            $table->date('target_date')->nullable();
            $table->date('current_stage_deadline')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('uat_notes')->nullable();
            $table->string('staging_url')->nullable();
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
