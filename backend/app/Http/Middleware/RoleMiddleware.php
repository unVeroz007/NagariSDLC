<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->role || ! in_array($user->role->name, $roles)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk aksi ini.',
            ], 403);
        }

        return $next($request);
    }
}
