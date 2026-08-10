<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('projects', function ($user) {
    return true; // All authenticated users can listen to project updates
});

Broadcast::channel('project.{projectId}', function ($user, $projectId) {
    return true; // All authenticated users can listen to specific project updates
});

Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
