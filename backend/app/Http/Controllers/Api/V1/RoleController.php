<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::orderBy('name')->get(['id', 'name', 'display_name', 'description']);

        return response()->json([
            'status' => 'success',
            'data'   => $roles,
        ]);
    }
}
