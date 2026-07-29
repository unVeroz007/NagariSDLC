<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::with(['role', 'division'])->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => UserResource::collection($users),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role_id' => ['required', 'exists:roles,id'],
            'division_id' => ['nullable', 'exists:divisions,id'],
            'phone_number' => ['nullable', 'string'],
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role_id' => $request->role_id,
            'division_id' => $request->division_id,
            'phone_number' => $request->phone_number,
            'is_active' => true,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Pengguna berhasil dibuat.',
            'data' => new UserResource($user->load(['role', 'division'])),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', "unique:users,email,{$id}"],
            'password' => ['nullable', 'string', 'min:8'],
            'role_id' => ['sometimes', 'exists:roles,id'],
            'division_id' => ['nullable', 'exists:divisions,id'],
            'phone_number' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $data = $request->except('password');
        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        return response()->json([
            'status' => 'success',
            'message' => 'Data pengguna berhasil diperbarui.',
            'data' => new UserResource($user->fresh(['role', 'division'])),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $user->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Pengguna berhasil dihapus.',
        ]);
    }
}
