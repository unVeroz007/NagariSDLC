<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tambah description ke tabel divisions
        Schema::table('divisions', function (Blueprint $table) {
            if (!Schema::hasColumn('divisions', 'description')) {
                $table->text('description')->nullable()->after('name');
            }
        });

        // Buat tabel activity_logs
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');              // e.g. create_user, update_project, delete_role
            $table->string('action_label');         // e.g. "Membuat Pengguna Baru"
            $table->text('description')->nullable();
            $table->string('subject_type')->nullable(); // e.g. App\Models\User
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('metadata')->nullable();   // data tambahan (old/new values, dll)
            $table->string('ip_address')->nullable();
            $table->string('status')->default('success'); // success / warning / error
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::table('divisions', function (Blueprint $table) {
            if (Schema::hasColumn('divisions', 'description')) {
                $table->dropColumn('description');
            }
        });

        Schema::dropIfExists('activity_logs');
    }
};
