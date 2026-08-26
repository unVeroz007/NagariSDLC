<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /**
     * `SoftDeletes` membuat penghapusan akun dapat dipulihkan dan menjaga jejak
     * audit tetap terbaca. Baris yang sudah dihapus otomatis hilang dari seluruh
     * query biasa, termasuk pencarian saat login dan penyelesaian token Sanctum,
     * sehingga akun yang dihapus langsung kehilangan akses.
     */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'division_id',
        'phone_number',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }

    /**
     * Helper untuk cek role user via enum.
     */
    public function hasRole(UserRole $role): bool
    {
        return $this->role?->name === $role->value;
    }

    /**
     * Kirim email reset password memakai notifikasi milik aplikasi ini.
     *
     * Trait `CanResetPassword` bawaan Laravel mengirim notifikasi yang menyusun
     * tautan ke route backend bernama `password.reset`. Route itu tidak ada di sini
     * — backend berperan sebagai API dan halaman penyetelan password baru berada di
     * frontend. Tanpa penggantian ini, pembuatan tautan gagal dan emailnya tidak
     * pernah terkirim.
     */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
