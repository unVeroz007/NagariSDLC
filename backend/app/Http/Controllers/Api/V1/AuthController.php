<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
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

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Logout berhasil.',
        ]);
    }
}
