<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lindungi jejak audit dari penghapusan permanen.
 *
 * Menambahkan soft delete pada user, proyek, dan divisi serta mengubah FK audit
 * wajib menjadi RESTRICT. Notifikasi tetap CASCADE, relasi nullable tetap SET NULL,
 * dan anak proyek tetap CASCADE untuk force-delete yang disengaja.
 */
return new class extends Migration
{
    /**
     * Kunci asing menuju `users` yang kolomnya `NOT NULL`, sehingga satu-satunya
     * aturan aman adalah `RESTRICT`.
     *
     * @var array<string, string>  nama tabel => nama kolom
     */
    private const USER_AUDIT_FOREIGN_KEYS = [
        'projects' => 'created_by',
        'project_status_histories' => 'changed_by',
        'project_team_members' => 'user_id',
        'test_reports' => 'tester_id',
        'document_vaults' => 'uploaded_by',
        'release_requests' => 'requested_by',
    ];

    public function up(): void
    {
        foreach (['users', 'projects', 'divisions'] as $tableName) {
            if (Schema::hasColumn($tableName, 'deleted_at')) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table): void {
                $table->softDeletes();
            });
        }

        foreach (self::USER_AUDIT_FOREIGN_KEYS as $tableName => $columnName) {
            Schema::table($tableName, function (Blueprint $table) use ($columnName): void {
                $table->dropForeign([$columnName]);
                $table->foreign($columnName)->references('id')->on('users')->restrictOnDelete();
            });
        }

        Schema::table('projects', function (Blueprint $table): void {
            $table->dropForeign(['division_id']);
            $table->foreign('division_id')->references('id')->on('divisions')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropForeign(['division_id']);
            $table->foreign('division_id')->references('id')->on('divisions')->cascadeOnDelete();
        });

        foreach (self::USER_AUDIT_FOREIGN_KEYS as $tableName => $columnName) {
            Schema::table($tableName, function (Blueprint $table) use ($columnName): void {
                $table->dropForeign([$columnName]);
                $table->foreign($columnName)->references('id')->on('users')->cascadeOnDelete();
            });
        }

        foreach (['divisions', 'projects', 'users'] as $tableName) {
            if (! Schema::hasColumn($tableName, 'deleted_at')) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropSoftDeletes();
            });
        }
    }
};
