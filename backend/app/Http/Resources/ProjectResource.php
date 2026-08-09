<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'req_id' => $this->req_id,
            'title' => $this->title,
            'description' => $this->description,
            'project_type' => $this->project_type ?? 'baru',
            'status' => $this->status instanceof \BackedEnum ? $this->status->value : $this->status,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'pm' => new UserResource($this->whenLoaded('pm')),
            'analyst' => new UserResource($this->whenLoaded('analyst')),
            'division' => $this->division?->name ?? 'Divisi TI',
            'division_detail' => $this->division ? [
                'id'   => $this->division->id,
                'code' => $this->division->code,
                'name' => $this->division->name,
            ] : null,
            'target_date' => $this->target_date?->format('Y-m-d'),
            'current_stage_deadline' => $this->current_stage_deadline?->format('Y-m-d'),
            'rejection_reason' => $this->rejection_reason,
            'uat_notes' => $this->uat_notes,
            'staging_url' => $this->staging_url,
            'sit_uat_data' => $this->sit_uat_data,
            'qa_status' => $this->qa_status ?? 'NOT_SUBMITTED',
            'cyber_status' => $this->cyber_status ?? 'NOT_SUBMITTED',


            'team' => $this->relationLoaded('teamMembers') && $this->teamMembers ? $this->teamMembers->map(function($m) {
                return [
                    'id' => $m->user_id,
                    'name' => $m->user?->name ?? 'Developer',
                    'email' => $m->user?->email,
                    'role' => $m->role_in_project,
                ];
            }) : [],
            'documents' => $this->whenLoaded('documents', function () {
                return $this->documents->map(function ($d) {
                    return [
                        'id' => $d->id,
                        'file_name' => $d->file_name,
                        'original_filename' => $d->original_filename,
                        'document_type' => $d->document_type,
                        'file_path' => $d->file_path,
                        'file_size' => $d->file_size,
                        'mime_type' => $d->mime_type,
                        'created_at' => $d->created_at?->toIso8601String(),
                        'uploaded_by' => $d->uploaded_by,
                        'author' => $d->uploader?->name,
                    ];
                });
            }) ?? [],
            'status_histories' => ProjectStatusHistoryResource::collection($this->whenLoaded('statusHistories')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
