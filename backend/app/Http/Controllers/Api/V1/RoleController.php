<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    use LogsActivity;

    public function index(): JsonResponse
    {
        $roles = Role::withCount('users')->orderBy('name')->get();

        return response()->json([
            'status' => 'success',
            'data'   => $roles,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'         => ['required', 'string', 'max:100', 'unique:roles,name'],
            'display_name' => ['required', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
        ]);

        $role = Role::create([
            'name'         => $request->name,
            'display_name' => $request->display_name,
            'description'  => $request->description,
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
            'data'    => $role->loadCount('users'),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $role = Role::findOrFail($id);

        $request->validate([
            'name'         => ['sometimes', 'string', 'max:100', "unique:roles,name,{$id}"],
            'display_name' => ['sometimes', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
        ]);

        $oldName = $role->display_name;
        $role->update($request->only(['name', 'display_name', 'description']));

        $this->logActivity(
            'update_role',
            'Memperbarui Role',
            "Role \"{$oldName}\" berhasil diperbarui menjadi \"{$role->display_name}\".",
            $role
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Role berhasil diperbarui.',
            'data'    => $role->fresh()->loadCount('users'),
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
}
