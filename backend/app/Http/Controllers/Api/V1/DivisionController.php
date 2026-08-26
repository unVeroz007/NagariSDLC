<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Division\StoreDivisionRequest;
use App\Http\Requests\Division\UpdateDivisionRequest;
use App\Models\Division;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;

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

    public function store(StoreDivisionRequest $request): JsonResponse
    {
        $data = $request->validated();

        $division = Division::create([
            'code' => $data['code'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
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

    public function update(UpdateDivisionRequest $request, int $id): JsonResponse
    {
        $division = Division::findOrFail($id);

        $oldName = $division->name;
        $division->update($request->validated());

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

    /**
     * Hapus divisi (penghapusan lunak), setelah dipastikan tidak ada yang bergantung.
     *
     * Dua penghalang diperiksa:
     *
     *   1. pengguna terkait — `users.division_id` bersifat `SET NULL`, jadi penghapusan
     *      tidak gagal tetapi seluruh anggotanya diam-diam kehilangan divisi;
     *   2. proyek terkait — `projects.division_id` bersifat `NOT NULL` dan kini
     *      `RESTRICT`. Sebelumnya kolom ini ber-CASCADE, sehingga menghapus satu divisi
     *      yang tidak punya pengguna namun masih punya proyek memusnahkan seluruh proyek
     *      itu berikut riwayat status, dokumen, dan approval-nya.
     *
     * Proyek dihitung dengan `withTrashed()` karena `Project` memakai penghapusan lunak:
     * barisnya masih menempati tabel, jadi kunci asing `RESTRICT` tetap berlaku atasnya.
     */
    public function destroy(int $id): JsonResponse
    {
        $division = Division::findOrFail($id);

        // Cegah hapus jika masih ada user terkait
        $userCount = $division->users()->count();
        if ($userCount > 0) {
            return response()->json([
                'status'  => 'error',
                'message' => "Divisi \"{$division->name}\" tidak dapat dihapus karena masih memiliki {$userCount} pengguna terkait.",
            ], 422);
        }

        // Cegah hapus jika masih ada proyek terkait, termasuk yang sudah dihapus lunak
        $projectCount = $division->projects()->withTrashed()->count();
        if ($projectCount > 0) {
            return response()->json([
                'status'  => 'error',
                'message' => "Divisi \"{$division->name}\" tidak dapat dihapus karena masih memiliki {$projectCount} proyek terkait. "
                    . 'Riwayat proyek merupakan bagian dari jejak audit dan tidak boleh ikut terhapus.',
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
