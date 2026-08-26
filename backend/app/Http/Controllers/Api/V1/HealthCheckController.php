<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Probe kesehatan aplikasi untuk load balancer dan monitoring.
 *
 * Endpoint ini publik (tanpa autentikasi), jadi isinya harus seminimal mungkin.
 * Sebelumnya `config('app.env')` ikut dikirim; nilai itu memberi tahu penyerang
 * apakah instans sedang berjalan sebagai `local` — yang berarti `APP_DEBUG` mungkin
 * aktif dan pesan galat penuh stack trace dapat dipanen. Nama lingkungan tidak
 * dibutuhkan pihak luar untuk mengetahui aplikasi sehat, sehingga dihapus.
 */
class HealthCheckController extends Controller
{
    public function check(): JsonResponse
    {
        $databaseConnected = true;

        try {
            DB::connection()->getPdo();
        } catch (\Throwable $e) {
            Log::error('Health check DB error: '.$e->getMessage());
            $databaseConnected = false;
        }

        // Aplikasi yang hidup tetapi kehilangan database tidak layak menerima
        // trafik. Mengembalikan 200 pada kondisi itu membuat load balancer terus
        // mengirim request ke instans yang pasti gagal, jadi statusnya 503.
        return response()->json([
            'status' => $databaseConnected ? 'success' : 'error',
            'message' => $databaseConnected
                ? 'Layanan berjalan normal.'
                : 'Layanan tidak dapat menghubungi database.',
            'data' => [
                'database' => $databaseConnected ? 'connected' : 'disconnected',
                'timestamp' => now()->toIso8601String(),
            ],
        ], $databaseConnected ? 200 : 503);
    }
}
