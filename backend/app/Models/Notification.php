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
     * Menyamakan bentuk respons `index()` dan `markRead()`, termasuk tanggal ISO 8601.
     * `relatedUrl` hanya dimiliki notifikasi lokal; menambahkannya ke respons server
     * memerlukan kolom database dan penulisan dari service notifikasi.
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
