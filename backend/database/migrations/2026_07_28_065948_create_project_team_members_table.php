<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_team_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('role_in_project');
            $table->timestamps();

            $table->unique(['project_id', 'user_id', 'role_in_project']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_team_members');
    }
};
