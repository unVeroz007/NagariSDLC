<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Division extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['code', 'name', 'description'];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Proyek yang diajukan divisi ini.
     *
     * Dipakai pemeriksaan penghapusan divisi: `projects.division_id` bersifat
     * `NOT NULL` dan kini `RESTRICT`, sehingga divisi yang masih memiliki proyek
     * tidak boleh dihapus.
     */
    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}
