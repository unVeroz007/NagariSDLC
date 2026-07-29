<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthCheckController extends Controller
{
    public function check(): JsonResponse
    {
        $dbStatus = false;
        try {
            DB::connection()->getPdo();
            $dbStatus = true;
        } catch (\Exception $e) {
            $dbStatus = false;
        }

        return response()->json([
            'status' => 'success',
            'app' => config('app.name'),
            'environment' => config('app.env'),
            'database' => $dbStatus ? 'connected' : 'disconnected',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
