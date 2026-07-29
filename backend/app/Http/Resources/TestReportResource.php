<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TestReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $result = $this->result;

        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'test_type' => $this->test_type,
            'tester' => new UserResource($this->whenLoaded('tester')),
            'result' => $result ? ($result->value ?? $result) : null,
            'notes' => $this->notes,
            'attachment_url' => $this->attachment_url,
            'reviewer' => new UserResource($this->whenLoaded('reviewer')),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
