<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CyberRequestController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DivisionController;
use App\Http\Controllers\Api\V1\DocumentController;
use App\Http\Controllers\Api\V1\HealthCheckController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ProjectController;
use App\Http\Controllers\Api\V1\QARequestController;
use App\Http\Controllers\Api\V1\QualityGateController;
use App\Http\Controllers\Api\V1\ReleaseRequestController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\TaskController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Health Check Route
    Route::get('/health', [HealthCheckController::class, 'check']);

    // Guest Auth Routes (public, tidak butuh token)
    Route::post('/auth/login', [AuthController::class, 'login']);

    // Authenticated Routes
    Route::middleware('auth:sanctum')->group(function () {
        // ----- AUTH -----
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // ----- DASHBOARD -----
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

        // ----- REFERENCE DATA (Roles & Divisions) -----
        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/divisions', [DivisionController::class, 'index']);

        // ----- USER MANAGEMENT (Admin CRUD) -----
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::patch('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);

        // ----- PROJECT ROUTES -----
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::get('/projects/{id}', [ProjectController::class, 'show']);
        Route::patch('/projects/{id}', [ProjectController::class, 'update']);           // general fields update
        Route::delete('/projects/{id}', [ProjectController::class, 'destroy']);         // hapus proyek
        Route::patch('/projects/{id}/status', [ProjectController::class, 'updateStatus']); // transisi status
        Route::get('/projects/{id}/timeline', [ProjectController::class, 'timeline']);  // audit trail

        // ----- TASK ROUTES -----
        Route::get('/projects/{projectId}/tasks', [TaskController::class, 'getByProject']);
        Route::post('/projects/{projectId}/tasks', [TaskController::class, 'store']);
        Route::patch('/tasks/{taskId}', [TaskController::class, 'update']);
        Route::delete('/tasks/{taskId}', [TaskController::class, 'destroy']);

        // ----- WORKSPACE ROUTES -----
        Route::get('/workspace/{role}', [WorkspaceController::class, 'show']);

        // ----- QA & CYBER TESTING ROUTES -----
        Route::get('/qa-requests', [QARequestController::class, 'index']);
        Route::post('/qa-requests', [QARequestController::class, 'store']);
        Route::patch('/qa-requests/{id}/status', [QARequestController::class, 'updateStatus']);

        Route::get('/cyber-requests', [CyberRequestController::class, 'index']);
        Route::post('/cyber-requests', [CyberRequestController::class, 'store']);
        Route::patch('/cyber-requests/{id}/status', [CyberRequestController::class, 'updateStatus']);

        // ----- RELEASE REQUEST & QUALITY GATE -----
        Route::get('/release-requests', [ReleaseRequestController::class, 'index']);
        Route::post('/release-requests', [ReleaseRequestController::class, 'store']);

        // Quality Gate — PENTING: route 'queue' harus di-register SEBELUM '{id}' agar tidak bentrok
        Route::get('/quality-gate/queue', [QualityGateController::class, 'queue']);
        Route::post('/quality-gate/approve', [QualityGateController::class, 'approve']);

        // ----- DOCUMENT VAULT -----
        Route::get('/documents', [DocumentController::class, 'index']);
        Route::post('/documents', [DocumentController::class, 'upload']);
        Route::get('/documents/{id}/download', [DocumentController::class, 'download']);
        Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);

        // ----- NOTIFICATION -----
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
        Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);

        // ----- ACTIVITY LOG (placeholder) -----
        Route::get('/activity-logs', function () {
            return response()->json(['status' => 'success', 'data' => []]);
        });
    });
});
