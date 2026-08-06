<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Trait LogsActivity
 *
 * Menyediakan helper method untuk mencatat log aktivitas ke tabel activity_logs.
 * Gunakan di controller mana saja yang perlu mencatat jejak audit.
 */
trait LogsActivity
{
    /**
     * Catat aktivitas ke database.
     *
     * @param string      $action      Kode aksi (e.g. create_user, update_project)
     * @param string      $actionLabel Label aksi (e.g. "Membuat Pengguna Baru")
     * @param string|null $description Deskripsi lengkap
     * @param mixed|null  $subject     Model Eloquent terkait (opsional)
     * @param array       $metadata    Data tambahan (opsional)
     * @param string      $status      Status: success / warning / error
     */
    protected function logActivity(
        string $action,
        string $actionLabel,
        ?string $description = null,
        $subject = null,
        array $metadata = [],
        string $status = 'success'
    ): ActivityLog {
        $user = Auth::user();

        return ActivityLog::create([
            'user_id'      => $user?->id,
            'action'       => $action,
            'action_label' => $actionLabel,
            'description'  => $description,
            'subject_type' => $subject ? get_class($subject) : null,
            'subject_id'   => $subject?->id ?? null,
            'metadata'     => array_merge($metadata, [
                'user_name' => $user?->name,
                'user_role' => $user?->role?->display_name ?? $user?->role?->name,
            ]),
            'ip_address'   => Request::ip(),
            'status'       => $status,
            'created_at'   => now(),
        ]);
    }
}
