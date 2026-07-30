<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Division;
use Illuminate\Http\JsonResponse;

class DivisionController extends Controller
{
    public function index(): JsonResponse
    {
        $divisions = Division::orderBy('name')->get(['id', 'code', 'name']);

        return response()->json([
            'status' => 'success',
            'data'   => $divisions,
        ]);
    }
}
