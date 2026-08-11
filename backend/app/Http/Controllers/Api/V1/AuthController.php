<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\Division;
use App\Models\Role;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    use LogsActivity;

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'email'      => ['required', 'string', 'email', 'unique:users,email'],
            'password'   => ['required', 'string', 'min:8'],
            'department' => ['required', 'string'],
            'role'       => ['sometimes', 'string', 'max:50'],
        ]);

        // Resolve atau buat division dari nama department
        $divisionName = $request->input('department');
        $division = \App\Models\Division::where('name', $divisionName)->first();
        if (! $division) {
            $division = \App\Models\Division::create([
                'code' => \Illuminate\Support\Str::upper(\Illuminate\Support\Str::slug($divisionName, '_')),
                'name' => $divisionName,
            ]);
        }

        // Default role: business_user
        $roleName = $request->input('role') ?: 'business_user';
        $role = \App\Models\Role::where('name', $roleName)->first();
        if (! $role) {
            $role = \App\Models\Role::where('name', 'business_user')->first();
        }

        $user = User::create([
            'name'          => $request->name,
            'email'         => $request->email,
            'password'      => Hash::make($request->password),
            'role_id'       => $role?->id,
            'division_id'   => $division?->id,
            'is_active'     => true,
            'phone_number'  => $request->input('phone_number'),
        ]);

        $user->load(['role', 'division']);

        return response()->json([
            'status'  => 'success',
            'message' => 'Registrasi berhasil. Silakan login.',
            'data'    => new UserResource($user),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::with(['role', 'division'])
            ->where('email', $request->email)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email atau password salah.',
            ], 401);
        }

        if (! $user->is_active) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akun Anda dinonaktifkan. Hubungi administrator.',
            ], 403);
        }

        // Generate Sanctum token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'Login berhasil.',
            'data' => [
                'user' => new UserResource($user),
                'token' => $token,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['role', 'division']);

        return response()->json([
            'status' => 'success',
            'data' => new UserResource($user),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:20'],
        ]);

        $user->update([
            'name' => $request->name,
            'phone_number' => $request->phone_number,
        ]);

        $user->load(['role', 'division']);

        $this->logActivity(
            'update_profile',
            'Memperbarui Profil Saya',
            "Pengguna \"{$user->name}\" memperbarui data profilnya."
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Profil berhasil diperbarui.',
            'data' => new UserResource($user),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => [
                'required',
                'string',
                'min:8',
                'regex:/[a-z]/',
                'regex:/[A-Z]/',
                'regex:/[0-9]/',
                'regex:/[@$!%*#?&._-]/',
            ],
        ], [
            'new_password.regex' => 'Password baru harus mengandung huruf kecil, huruf besar, angka, dan karakter spesial (@$!%*#?&._-).',
        ]);

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Password saat ini tidak sesuai.',
            ], 422);
        }

        $user->update([
            'password' => Hash::make($request->new_password),
        ]);

        $this->logActivity(
            'change_password',
            'Mengubah Password',
            "Pengguna \"{$user->name}\" berhasil memperbarui password akunnya."
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Password berhasil diperbarui.',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Logout berhasil.',
        ]);
    }

    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['role', 'division']);

        // Revoke old token and issue new one
        $request->user()->currentAccessToken()->delete();
        $newToken = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'Token berhasil diperbarui.',
            'data' => [
                'user' => new UserResource($user),
                'token' => $newToken,
            ],
        ]);
    }
}
