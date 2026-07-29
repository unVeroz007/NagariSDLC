<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('password')->constrained('roles')->onDelete('set null');
            $table->foreignId('division_id')->nullable()->after('role_id')->constrained('divisions')->onDelete('set null');
            $table->string('phone_number')->nullable()->after('division_id');
            $table->boolean('is_active')->default(true)->after('phone_number');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropForeign(['division_id']);
            $table->dropColumn(['role_id', 'division_id', 'phone_number', 'is_active']);
        });
    }
};
