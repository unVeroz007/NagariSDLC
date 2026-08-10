<?php

namespace App\Events;

use App\Models\Project;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ProjectUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Project $project,
        public ?string $oldStatus = null,
        public ?string $newStatus = null,
        public ?string $actorName = null,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('projects'),
            new PrivateChannel('project.' . $this->project->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'project.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->project->id,
            'title' => $this->project->title ?? $this->project->name,
            'status' => $this->project->status,
            'old_status' => $this->oldStatus,
            'new_status' => $this->newStatus,
            'actor' => $this->actorName,
            'updated_at' => now()->toIso8601String(),
        ];
    }
}
