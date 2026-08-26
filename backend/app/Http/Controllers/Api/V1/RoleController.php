<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Role\StoreRoleRequest;
use App\Http\Requests\Role\UpdateRoleRequest;
use App\Models\Role;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;

/**
 * Pengelolaan role oleh Super Admin.
 *
 * Dua field selain identitas role ikut diatur di sini:
 *
 *   - `group_id` — grup kerja yang menaungi role. Mengubahnya mengubah pengelompokan
 *     dan tampilan, BUKAN hak transisi status: otorisasi fase tetap milik
 *     `ProjectWorkflowService::$rolePermissions`, `ProjectAccessService`, dan
 *     `TestingTrack::testerRoles()`, yang semuanya bekerja pada nama role.
 *   - `menu_access` — daftar path menu yang boleh dilihat role. Hanya membatasi
 *     tampilan sidebar; gerbang keamanan tetap `ProtectedRoute` di frontend serta
 *     middleware `role:` dan service otorisasi di backend.
 */
class RoleController extends Controller
{
    use LogsActivity;

    public function index(): JsonResponse
    {
        $roles = Role::with('group')->withCount('users')->orderBy('name')->get();

        return response()->json([
            'status' => 'success',
            'data'   => $roles,
        ]);
    }

    public function store(StoreRoleRequest $request): JsonResponse
    {
        $data = $request->validated();

        $role = Role::create([
            'name'         => $data['name'],
            'display_name' => $data['display_name'],
            'description'  => $data['description'] ?? null,
            'group_id'     => $data['group_id'] ?? null,
            'menu_access'  => $this->normalizeMenuAccess($data['menu_access'] ?? null),
        ]);

        $this->logActivity(
            'create_role',
            'Membuat Role Baru',
            "Role \"{$role->display_name}\" ({$role->name}) berhasil dibuat.",
            $role
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Role berhasil dibuat.',
            'data'    => $role->load('group')->loadCount('users'),
        ], 201);
    }

    public function update(UpdateRoleRequest $request, int $id): JsonResponse
    {
        $role = Role::findOrFail($id);
        $data = $request->validated();

        if (array_key_exists('menu_access', $data)) {
            $data['menu_access'] = $this->normalizeMenuAccess($data['menu_access']);
        }

        $oldName = $role->display_name;
        $role->update($data);

        $this->logActivity(
            'update_role',
            'Memperbarui Role',
            "Role \"{$oldName}\" berhasil diperbarui menjadi \"{$role->display_name}\".",
            $role
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Role berhasil diperbarui.',
            'data'    => $role->fresh()->load('group')->loadCount('users'),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $role = Role::findOrFail($id);

        // Proteksi: super_admin tidak bisa dihapus
        if ($role->name === 'super_admin') {
            return response()->json([
                'status'  => 'error',
                'message' => 'Role "Super Admin" adalah role sistem utama dan TIDAK BISA dihapus.',
            ], 403);
        }

        // Cegah hapus jika masih ada user terkait
        if ($role->users()->count() > 0) {
            return response()->json([
                'status'  => 'error',
                'message' => "Role \"{$role->display_name}\" tidak dapat dihapus karena masih memiliki {$role->users()->count()} pengguna terkait.",
            ], 422);
        }

        $name = $role->display_name;
        $role->delete();

        $this->logActivity(
            'delete_role',
            'Menghapus Role',
            "Role \"{$name}\" berhasil dihapus dari sistem."
        );

        return response()->json([
            'status'  => 'success',
            'message' => "Role \"{$name}\" berhasil dihapus.",
        ]);
    }

    /**
     * Rapikan daftar path menu, dan simpan `null` untuk daftar kosong.
     *
     * Daftar kosong dan `null` sengaja diperlakukan sama, yaitu "tanpa pembatasan".
     * Menyimpan daftar kosong sebagai pembatasan nyata berarti role tersebut kehilangan
     * seluruh menunya hanya karena Super Admin lupa mencentang apa pun — dan bagi role
     * yang tidak punya akses Administrasi, keadaan itu tidak bisa dibatalkan sendiri.
     *
     * @param  mixed  $menuAccess
     * @return list<string>|null
     */
    private function normalizeMenuAccess($menuAccess): ?array
    {
        if (! is_array($menuAccess)) {
            return null;
        }

        $paths = collect($menuAccess)
            ->filter(fn ($path): bool => is_string($path) && trim($path) !== '')
            ->map(fn (string $path): string => trim($path))
            ->unique()
            ->values()
            ->all();

        return $paths === [] ? null : $paths;
    }
}
