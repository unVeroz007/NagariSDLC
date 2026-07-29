<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $status = $this->status;

        return [
            'id' => $this->id,
            'req_id' => $this->req_id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $status ? ($status->value ?? $status) : null,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'pm' => new UserResource($this->whenLoaded('pm')),
            'analyst' => new UserResource($this->whenLoaded('analyst')),
            'division' => $this->division ? [
                'id' => $this->division->id,
                'code' => $this->division->code,
                'name' => $this->division->name,
            ] : null,
            'target_date' => $this->target_date?->format('Y-m-d'),
            'current_stage_deadline' => $this->current_stage_deadline?->format('Y-m-d'),
            'rejection_reason' => $this->rejection_reason,
            'uat_notes' => $this->uat_notes,
            'staging_url' => $this->staging_url,
            'status_histories' => ProjectStatusHistoryResource::collection($this->whenLoaded('statusHistories')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
