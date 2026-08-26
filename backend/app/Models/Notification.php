<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'message',
        'type',
        'is_read',
    ];

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Bentuk satu notifikasi untuk balasan API.
     *
     * Tidak memakai `JsonResource` karena tabel ini hanya punya lima kolom dan
     * tidak memuat relasi apa pun pada balasannya; sebaliknya, satu tempat ini
     * memastikan `index()` dan `markRead()` mengirim bentuk yang identik.
     * Sebelumnya `markRead()` mengirim model mentah, sehingga `created_at`-nya
     * berupa string database sementara endpoint lain memakai ISO 8601 seperti
     * `UserResource`.
     *
     * Catatan untuk yang menambah fitur: tabel `notifications` TIDAK memiliki
     * kolom tautan/rute tujuan (lihat migrasi
     * `2026_07_28_070536_create_notifications_table.php`). Notifikasi yang dibuat
     * di frontend lewat `NotificationContext` memang punya `relatedUrl`, tetapi itu
     * data lokal peramban dan tidak pernah sampai ke tabel ini. Jangan menambahkan
     * `related_url` di sini tanpa migrasi dan tanpa mengisinya di
     * `ProjectWorkflowService::notify*` serta `TestingTrackService::notifyUsers()`.
     *
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id'         => $this->id,
            'title'      => $this->title,
            'message'    => $this->message,
            'type'       => $this->type,
            'is_read'    => (bool) $this->is_read,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
