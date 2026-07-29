<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('release_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->onDelete('cascade');
            $table->foreignId('requested_by')->constrained('users')->onDelete('cascade');
            $table->date('target_release_date');
            $table->text('notes')->nullable();
            $table->boolean('head_of_it_approval')->default(false);
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('release_requests');
    }
};
