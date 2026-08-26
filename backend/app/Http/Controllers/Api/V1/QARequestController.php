<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TestingTrack;
use App\Http\Requests\TestingTrack\SubmitQaTestingRequest;
use Illuminate\Http\JsonResponse;
use Throwable;

/**
 * Endpoint jalur Pengujian QA.
 *
 * Tiga langkah lanjutannya — disposisi, laporan, sign-off — diwarisi apa adanya dari
 * `TestingTrackController`. Yang khusus di sini hanya pengajuan PM, karena masukannya
 * berbeda dari pengajuan Audit Keamanan Siber.
 */
class QARequestController extends TestingTrackController
{
    protected function track(): TestingTrack
    {
        return TestingTrack::QA;
    }

    /**
     * Langkah 1 — PM mengajukan proyek ke Pengujian QA.
     */
    public function submitRequest(SubmitQaTestingRequest $request): JsonResponse
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
            'Pengajuan Pengujian QA berhasil dikirim dan menunggu disposisi QA Lead.'
        );
    }
}
