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
            'notes' => $this->notes,
            'head_of_it_approval' => $this->head_of_it_approval,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
