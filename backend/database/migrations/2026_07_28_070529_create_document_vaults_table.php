<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_vaults', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->onDelete('cascade');
            $table->foreignId('uploaded_by')->constrained('users')->onDelete('cascade');
            $table->string('document_type');
            $table->string('file_path');
            $table->string('file_name');
            $table->unsignedBigInteger('file_size'); // simpan dalam byte
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_vaults');
    }
};
