<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Division;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DivisionController extends Controller
{
    use LogsActivity;

    public function index(): JsonResponse
    {
        $divisions = Division::withCount('users')->orderBy('name')->get();

        return response()->json([
            'status' => 'success',
            'data'   => $divisions,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:divisions,code'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $division = Division::create([
            'code' => $request->code,
            'name' => $request->name,
            'description' => $request->description,
        ]);

        $this->logActivity(
            'create_division',
            'Membuat Divisi Baru',
            "Divisi \"{$division->name}\" ({$division->code}) berhasil dibuat.",
            $division
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Divisi berhasil dibuat.',
            'data'    => $division->loadCount('users'),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $division = Division::findOrFail($id);

        $request->validate([
            'code' => ['sometimes', 'string', 'max:20', "unique:divisions,code,{$id}"],
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $oldName = $division->name;
        $division->update($request->only(['code', 'name', 'description']));

        $this->logActivity(
            'update_division',
            'Memperbarui Divisi',
            "Divisi \"{$oldName}\" berhasil diperbarui menjadi \"{$division->name}\".",
            $division
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Divisi berhasil diperbarui.',
            'data'    => $division->fresh()->loadCount('users'),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $division = Division::findOrFail($id);

        // Cegah hapus jika masih ada user terkait
        if ($division->users()->count() > 0) {
            return response()->json([
                'status'  => 'error',
                'message' => "Divisi \"{$division->name}\" tidak dapat dihapus karena masih memiliki {$division->users()->count()} pengguna terkait.",
            ], 422);
        }

        $name = $division->name;
        $division->delete();

        $this->logActivity(
            'delete_division',
            'Menghapus Divisi',
            "Divisi \"{$name}\" berhasil dihapus dari sistem."
        );

        return response()->json([
            'status'  => 'success',
            'message' => "Divisi \"{$name}\" berhasil dihapus.",
        ]);
    }
}
