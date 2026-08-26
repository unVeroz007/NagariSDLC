<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Satu laporan pengujian, memuat penilaian pelaksana dan keputusan Lead.
 *
 * Berkas bukti dipaparkan sebagai daftar ID, bukan objek dokumen lengkap. Menghidrasi
 * dokumen di sini akan menambah satu query per laporan pada daftar; layar yang butuh
 * nama berkas membacanya dari `qa_report` / `cyber_report` pada `ProjectResource`,
 * yang menghidrasinya dari relasi dokumen proyek yang sudah dimuat.
 */
class TestReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $result = $this->result;
        $reviewedResult = $this->reviewed_result;
        $checklist = (array) ($this->checklist ?? []);
        $checkedCount = count(array_filter($checklist, static fn ($value): bool => $value === true));

        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'project_title' => $this->whenLoaded('project', fn () => $this->project?->title),
            'test_type' => $this->test_type,

            // Penilaian pelaksana pengujian.
            'tester' => new UserResource($this->whenLoaded('tester')),
            'tester_id' => $this->tester_id,
            'result' => $result?->value,
            'result_label' => $result?->label(),
            'severity' => $this->severity,
            'notes' => $this->notes,

            // Cakupan pengujian versi baru: tulisan penguji sendiri.
            'tested_scenarios' => $this->tested_scenarios,

            // Bentuk warisan, hanya terisi pada laporan sebelum cakupan pengujian
            // diubah menjadi catatan bebas.
            'checklist' => $checklist,
            'checklist_summary' => $checklist === []
                ? null
                : "{$checkedCount}/" . count($checklist) . ' skenario dicentang',
            'attachment_url' => $this->attachment_url,
            'evidence_document_ids' => $this->evidenceDocumentIdList(),

            // Keputusan Lead — kosong selama laporan belum di-sign-off.
            'reviewer' => new UserResource($this->whenLoaded('reviewer')),
            'reviewed_result' => $reviewedResult?->value,
            'reviewed_result_label' => $reviewedResult?->label(),
            'review_notes' => $this->review_notes,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'is_reviewed' => $this->isReviewed(),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
