<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReleaseRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'requester' => new UserResource($this->whenLoaded('requester')),
            'target_release_date' => $this->target_release_date?->format('Y-m-d'),

            // Rencana rilis. Ketiganya kolom tersendiri sejak migrasi
            // 2026_08_23_000004 supaya layar Quality Gate dapat menampilkan
            // masing-masing bagian apa adanya, tanpa mengarang isi yang kosong.
            'downtime_estimate' => $this->downtime_estimate,
            'rollback_plan' => $this->rollback_plan,
            'notes' => $this->notes,

            // Keputusan Head of IT beserta pelakunya.
            'head_of_it_approval' => (bool) $this->head_of_it_approval,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'approved_by' => $this->approved_by,
            'approver_name' => $this->whenLoaded('approver', fn () => $this->approver?->name),
            'rejected_at' => $this->rejected_at?->toIso8601String(),
            'rejected_by' => $this->rejected_by,
            'rejecter_name' => $this->whenLoaded('rejecter', fn () => $this->rejecter?->name),
            'rejection_notes' => $this->rejection_notes,
            'is_pending' => $this->isPending(),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
