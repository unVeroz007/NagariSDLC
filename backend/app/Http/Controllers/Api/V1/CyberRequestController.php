<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TestingTrack;
use App\Http\Requests\TestingTrack\SubmitCyberAuditRequest;
use Illuminate\Http\JsonResponse;
use Throwable;

/**
 * Endpoint jalur Audit Keamanan Siber.
 *
 * Sama seperti jalur QA, tiga langkah lanjutannya diwarisi dari
 * `TestingTrackController`. Pengajuannya berdiri sendiri karena PM wajib memilih jenis
 * pemeriksaan — Penetration Test atau Secure Code Review — beserta masukan yang
 * dibutuhkan jenis itu.
 */
class CyberRequestController extends TestingTrackController
{
    protected function track(): TestingTrack
    {
        return TestingTrack::CYBER;
    }

    /**
     * Langkah 1 — PM mengajukan proyek ke Audit Keamanan Siber.
     */
    public function submitRequest(SubmitCyberAuditRequest $request): JsonResponse
    {
        $project = $this->findProject($request->integer('project_id'));

        try {
            $project = $this->trackService->submitRequest(
                $project,
                $this->track(),
                $request->user(),
                $request->validated()
            );
        } catch (Throwable $e) {
            return $this->failed($e);
        }

        return $this->projectResponse(
            $project,
            'Pengajuan Audit Keamanan Siber berhasil dikirim dan menunggu disposisi Cyber Lead.'
        );
    }
}
