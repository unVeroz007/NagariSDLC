<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Group\StoreGroupRequest;
use App\Http\Requests\Group\UpdateGroupRequest;
use App\Models\Group;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;

/**
 * Pengelolaan grup kerja oleh Super Admin.
 *
 * Grup adalah pengelompokan role, bukan gerbang otorisasi — lihat docblock
 * `App\Models\Group`. Karena itu tidak ada endpoint apa pun di sini yang menyentuh
 * status proyek atau hak transisi; yang berubah hanya penempatan role.
 */
class GroupController extends Controller
{
    use LogsActivity;

    /**
     * Daftar grup beserta role anggotanya.
     *
     * Role disertakan karena setiap layar yang memakai grup — halaman Administrasi dan
     * pemilih personel — selalu membutuhkan anggotanya sekaligus. Memuatnya di sini
     * menghindari satu permintaan tambahan per grup.
     *
     * Jumlah pengguna dihitung lewat `withCount` pada relasi role, bukan di dalam
     * perulangan: menghitungnya per role akan menghasilkan satu query tambahan untuk
     * setiap role pada setiap grup.
     */
    public function index(): JsonResponse
    {
        $groups = Group::with([
            'roles' => fn ($query) => $query->withCount('users')->orderBy('display_name'),
        ])
            ->orderBy('name')
            ->get()
            ->map(fn (Group $group): array => [
                'id' => $group->id,
                'code' => $group->code,
                'name' => $group->name,
                'description' => $group->description,
                'roles_count' => $group->roles->count(),
                'users_count' => (int) $group->roles->sum('users_count'),
                'roles' => $group->roles->map(fn ($role): array => [
                    'id' => $role->id,
                    'name' => $role->name,
                    'display_name' => $role->display_name,
                    'users_count' => (int) $role->users_count,
                ])->values(),
            ]);

        return response()->json([
            'status' => 'success',
            'data' => $groups,
        ]);
    }

    public function store(StoreGroupRequest $request): JsonResponse
    {
        $data = $request->validated();

        $group = Group::create([
            'code' => $data['code'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
        ]);

        $this->logActivity(
            'create_group',
            'Membuat Grup Kerja Baru',
            "Grup \"{$group->name}\" ({$group->code}) berhasil dibuat.",
            $group
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Grup kerja berhasil dibuat.',
            'data' => $group,
        ], 201);
    }

    public function update(UpdateGroupRequest $request, int $id): JsonResponse
    {
        $group = Group::findOrFail($id);

        $oldName = $group->name;
        $group->update($request->validated());

        $this->logActivity(
            'update_group',
            'Memperbarui Grup Kerja',
            "Grup \"{$oldName}\" berhasil diperbarui menjadi \"{$group->name}\".",
            $group
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Grup kerja berhasil diperbarui.',
            'data' => $group->fresh(),
        ]);
    }

    /**
     * Hapus grup, setelah dipastikan tidak ada role yang masih tergabung.
     *
     * `roles.group_id` bersifat `SET NULL`, jadi penghapusan tidak akan gagal — role
     * hanya kehilangan grupnya tanpa pemberitahuan. Penghalang ini memaksa Super Admin
     * memindahkan anggotanya lebih dulu, sehingga tidak ada role yang menggantung tanpa
     * grup akibat satu klik.
     */
    public function destroy(int $id): JsonResponse
    {
        $group = Group::findOrFail($id);

        $roleCount = $group->roles()->count();
        if ($roleCount > 0) {
            return response()->json([
                'status' => 'error',
                'message' => "Grup \"{$group->name}\" tidak dapat dihapus karena masih memiliki {$roleCount} role di dalamnya. "
                    . 'Pindahkan role tersebut ke grup lain lebih dulu.',
            ], 422);
        }

        $name = $group->name;
        $group->delete();

        $this->logActivity(
            'delete_group',
            'Menghapus Grup Kerja',
            "Grup \"{$name}\" berhasil dihapus dari sistem."
        );

        return response()->json([
            'status' => 'success',
            'message' => "Grup \"{$name}\" berhasil dihapus.",
        ]);
    }
}
