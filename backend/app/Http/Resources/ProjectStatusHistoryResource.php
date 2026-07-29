<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectStatusHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $fromStatus = $this->from_status;
        $toStatus = $this->to_status;

        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'from_status' => $fromStatus ? ($fromStatus->value ?? $fromStatus) : null,
            'to_status' => $toStatus->value ?? $toStatus,
            'changed_by' => new UserResource($this->whenLoaded('changedBy')),
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
