<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SitApprovalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Inbox personal persetujuan SIT.
 *
 * Keputusan persetujuan SIT tetap diterima `ProjectController@sitApproval`; controller
 * ini hanya menyediakan daftar bacaan agar halaman "Persetujuan Saya" tidak perlu
 * menyaring seluruh daftar proyek di sisi klien.
 */
class SitApprovalController extends Controller
{
    public function __construct(private readonly SitApprovalService $service) {}

    public function myAssignments(Request $request): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $this->service->myAssignments($request->user()),
        ]);
    }
}
