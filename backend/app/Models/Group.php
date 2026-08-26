<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Grup kerja yang menaungi beberapa role.
 *
 * Grup adalah pengelompokan ORGANISASI, bukan gerbang otorisasi. Contohnya "Grup
 * Perencanaan dan Quality Assurance" menaungi `lead_group`, `analyst`, `qa_lead`, dan
 * `qa_tester` karena keempatnya dijalankan orang yang sama pada dua fase berbeda.
 *
 * Bedakan dari `Division`: divisi adalah unit organisasi tempat PENGGUNA berada
 * (`users.division_id`) dan dipakai sebagai pengaju proyek; grup adalah kumpulan ROLE
 * (`roles.group_id`) dan dipakai untuk menjelaskan pembagian pekerjaan antar fase.
 *
 * Hak transisi status proyek TIDAK ditentukan grup. Otorisasi fase tetap dipegang
 * `ProjectWorkflowService::$rolePermissions`, `ProjectAccessService`, dan
 * `TestingTrack::testerRoles()`, yang semuanya bekerja pada nama role. Memindahkan role
 * antar grup mengubah pengelompokan dan tampilan, bukan wewenangnya.
 */
class Group extends Model
{
    use HasFactory;

    protected $fillable = ['code', 'name', 'description'];

    /**
     * Role yang tergabung pada grup ini.
     *
     * @return HasMany<Role, $this>
     */
    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }
}
