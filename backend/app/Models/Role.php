<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Role pengguna.
 *
 * `name` adalah kunci teknis yang dipakai middleware `role:...`, pengecekan
 * `$user->role->name` di service, dan pemetaan peran di frontend. Nilainya mengikuti
 * `App\Enums\UserRole`.
 */
class Role extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'display_name', 'description', 'group_id', 'menu_access'];

    protected function casts(): array
    {
        return [
            'menu_access' => 'array',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Grup kerja yang menaungi role ini. Kosong untuk role sistem seperti `super_admin`.
     *
     * @return BelongsTo<Group, $this>
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    /**
     * Daftar path menu yang boleh dilihat role ini, atau `null` bila tanpa pembatasan.
     *
     * `null` dan daftar kosong diperlakukan sama — keduanya berarti sidebar memakai
     * seluruh menu bawaan role tersebut. Ini disengaja: daftar kosong yang berarti
     * "tidak ada menu sama sekali" akan mengunci pengguna dari aplikasi hanya karena
     * Super Admin lupa mencentang apa pun.
     *
     * Kolom ini hanya membatasi TAMPILAN. Gerbang keamanan tetap `ProtectedRoute` di
     * frontend serta middleware `role:` dan service otorisasi di backend.
     *
     * @return list<string>|null
     */
    public function menuAccessPaths(): ?array
    {
        $paths = collect($this->menu_access ?? [])
            ->filter(fn ($path): bool => is_string($path) && trim($path) !== '')
            ->map(fn (string $path): string => trim($path))
            ->unique()
            ->values()
            ->all();

        return $paths === [] ? null : $paths;
    }
}
