<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('uat_approval_rounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->unsignedInteger('round_number');
            $table->string('status', 30)->default('active');
            $table->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('opened_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->string('superseded_reason')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'round_number']);
            $table->index(['project_id', 'status']);
        });

        Schema::create('uat_approvers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('uat_approval_round_id')->constrained('uat_approval_rounds')->cascadeOnDelete();
            $table->uuid('participant_key');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('side', 20);
            $table->string('approval_role', 60);
            $table->string('approval_mode', 30);
            $table->string('name');
            $table->string('position')->nullable();
            $table->string('unit')->nullable();
            $table->string('phone_hash', 64)->nullable();
            $table->string('phone_masked', 30)->nullable();
            $table->string('link_token_hash', 64)->nullable()->unique();
            $table->timestamp('link_expires_at')->nullable();
            $table->timestamp('link_opened_at')->nullable();
            $table->string('access_token_hash', 64)->nullable()->unique();
            $table->timestamp('access_expires_at')->nullable();
            $table->unsignedTinyInteger('verification_attempts')->default(0);
            $table->timestamp('verification_locked_until')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->string('status', 30)->default('pending');
            $table->text('decision_note')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_ip', 45)->nullable();
            $table->text('decision_user_agent')->nullable();
            $table->timestamps();

            $table->unique(['uat_approval_round_id', 'participant_key']);
            $table->index(['uat_approval_round_id', 'status']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('uat_approvers');
        Schema::dropIfExists('uat_approval_rounds');
    }
};
