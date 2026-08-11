<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class HealthCheckController extends Controller
{
    public function check(): JsonResponse
    {
        $dbStatus = false;
        try {
            DB::connection()->getPdo();
            $dbStatus = true;
        } catch (\Exception $e) {
            Log::error('Health check DB error: ' . $e->getMessage());
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
