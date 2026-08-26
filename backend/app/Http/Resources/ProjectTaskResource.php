<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectTaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $status = $this->status;

        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'title' => $this->title,
            'description' => $this->description,
            'assignee' => new UserResource($this->whenLoaded('assignee')),
            'status' => $status instanceof \BackedEnum ? $status->value : $status,
            'priority' => $this->priority ?? 'Medium',
            'revision_note' => $this->revision_note,
            'revision_requested_at' => $this->revision_requested_at?->toIso8601String(),
            'revision_requested_by' => $this->revisionRequester?->name,
            // Penanda asal task perbaikan. `return_round_id` selalu dipaparkan karena
            // layar memakainya untuk mengelompokkan task per putaran; label jalurnya
            // hanya ikut bila relasinya sudah dimuat, agar resource ini tidak pernah
            // memicu satu query per task.
            'return_round_id' => $this->return_round_id,
            'return_round_track' => $this->whenLoaded(
                'returnRound',
                fn () => $this->returnRound?->track?->value
            ),
            'return_round_number' => $this->whenLoaded(
                'returnRound',
                fn () => $this->returnRound?->round_number
            ),
            'due_date' => $this->due_date?->format('Y-m-d'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
