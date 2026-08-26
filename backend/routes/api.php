<?php

use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ChatController;
use App\Http\Controllers\Api\V1\CyberRequestController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DivisionController;
use App\Http\Controllers\Api\V1\DocumentController;
use App\Http\Controllers\Api\V1\GroupController;
use App\Http\Controllers\Api\V1\HealthCheckController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ProjectController;
use App\Http\Controllers\Api\V1\QARequestController;
use App\Http\Controllers\Api\V1\QualityGateController;
use App\Http\Controllers\Api\V1\ReleaseRequestController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SitApprovalController;
use App\Http\Controllers\Api\V1\TaskController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\UatApprovalController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Health Check Route
    Route::get('/health', [HealthCheckController::class, 'check']);

    // Guest Auth Routes (public, rate-limited)
    Route::post('/auth/register', [AuthController::class, 'register'])
        ->middleware('throttle:5,1');
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:5,1'); // 5 login attempts per minute

    // Daftar divisi resmi untuk dropdown formulir pendaftaran. Publik karena
    // formulirnya berada di luar sesi, hanya mengembalikan id dan nama, dan
    // dibatasi laju permintaannya. Tanpa endpoint ini formulir harus menghafal
    // nama divisi sendiri, dan pilihan yang tidak cocok dengan master data itulah
    // yang dahulu memaksa registrasi membuat baris `divisions` baru.
    Route::get('/auth/divisions', [AuthController::class, 'divisions'])
        ->middleware('throttle:30,1');

    // Pemulihan akses akun. Dibatasi ketat karena keduanya publik: pengiriman tautan
    // dibatasi juga oleh throttle broker password (`auth.passwords.users.throttle`),
    // dan penyetelan password baru dibatasi agar token tidak bisa dicoba berulang.
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])
        ->middleware('throttle:5,1');
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])
        ->middleware('throttle:5,1');

    // Link persetujuan UAT non-IT. Token pribadi + pencocokan nomor HP.
    Route::get('/uat-approvals/{token}', [UatApprovalController::class, 'preview'])
        ->middleware('throttle:30,1');
    Route::post('/uat-approvals/{token}/verify', [UatApprovalController::class, 'verify'])
        ->middleware('throttle:10,1');
    Route::get('/uat-approvals/{token}/detail', [UatApprovalController::class, 'detail'])
        ->middleware('throttle:60,1');
    Route::post('/uat-approvals/{token}/decision', [UatApprovalController::class, 'externalDecision'])
        ->middleware('throttle:10,1');
    Route::get('/uat-approvals/{token}/documents/{document}/download', [UatApprovalController::class, 'download'])
        ->middleware('throttle:30,1');

    // Authenticated Routes
    Route::middleware('auth:sanctum')->group(function () {
        // ----- AUTH -----
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::patch('/auth/password', [AuthController::class, 'updatePassword']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/refresh', [AuthController::class, 'refresh']);

        // ----- DASHBOARD -----
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

        // Analitik SDLC adalah agregat lintas seluruh portofolio: distribusi status
        // semua proyek, beban tiap developer, dan komposisi role seluruh akun. Tidak
        // ada penyaringan per pengguna yang masuk akal untuk angka seperti itu, jadi
        // gerbangnya route. Dibuka untuk super_admin dan head_of_it (keputusan tata
        // kelola 26 Agustus 2026: Head of IT memegang pengawasan rilis lintas
        // portofolio). Guard route frontend `/analytics` harus memuat daftar role yang
        // sama agar server dan klien tidak berbeda.
        Route::get('/dashboard/analytics', [DashboardController::class, 'analytics'])
            ->middleware('role:super_admin,head_of_it');

        // ----- REFERENCE DATA (Groups, Roles & Divisions) — Admin Only (write) -----
        Route::middleware('role:super_admin')->group(function () {
            Route::post('/groups', [GroupController::class, 'store']);
            Route::patch('/groups/{id}', [GroupController::class, 'update']);
            Route::delete('/groups/{id}', [GroupController::class, 'destroy']);

            Route::post('/roles', [RoleController::class, 'store']);
            Route::patch('/roles/{id}', [RoleController::class, 'update']);
            Route::delete('/roles/{id}', [RoleController::class, 'destroy']);

            Route::post('/divisions', [DivisionController::class, 'store']);
            Route::patch('/divisions/{id}', [DivisionController::class, 'update']);
            Route::delete('/divisions/{id}', [DivisionController::class, 'destroy']);

            // ----- USER MANAGEMENT (Admin CRUD — write) -----
            Route::post('/users', [UserController::class, 'store']);
            Route::patch('/users/{id}', [UserController::class, 'update']);
            Route::delete('/users/{id}', [UserController::class, 'destroy']);

            // ----- ACTIVITY LOG (Admin Only — summary) -----
            Route::get('/activity-logs/summary', [ActivityLogController::class, 'summary']);
        });

        // Master data — read access available to all authenticated users
        Route::get('/groups', [GroupController::class, 'index']);
        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/divisions', [DivisionController::class, 'index']);
        // Beban aktif lintas-fase per pengguna (dropdown disposisi QA & Siber). Harus
        // sebelum rute /users apa pun yang berpola parameter agar tidak tertangkap.
        Route::get('/users/workload', [UserController::class, 'workload']);
        Route::get('/users', [UserController::class, 'index']);

        // Activity log — read untuk semua user terautentikasi (dipakai juga utk log proyek per PM)
        Route::get('/activity-logs', [ActivityLogController::class, 'index']);

        // Inbox personal approval UAT untuk Developer, Analyst/PM, Lead, dan Head of IT.
        Route::get('/me/uat-approvals', [UatApprovalController::class, 'myAssignments']);

        // Inbox personal approval SIT untuk Developer, Analyst/PM, dan Development Lead.
        // Keputusannya tetap dikirim ke POST /projects/{id}/sit-approval.
        Route::get('/me/sit-approvals', [SitApprovalController::class, 'myAssignments']);

        // ----- PROJECT ROUTES -----
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::get('/projects/next-req-id', [ProjectController::class, 'nextReqId']);
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::get('/projects/{id}', [ProjectController::class, 'show']);
        Route::patch('/projects/{id}', [ProjectController::class, 'update']);
        Route::delete('/projects/{id}', [ProjectController::class, 'destroy'])
            ->middleware('role:super_admin,head_of_it,project_manager');
        Route::patch('/projects/{id}/status', [ProjectController::class, 'updateStatus']);
        Route::get('/projects/{id}/timeline', [ProjectController::class, 'timeline']);
        Route::get('/projects/{id}/sit-gate', [ProjectController::class, 'sitGate']);
        Route::post('/projects/{id}/sit-approval', [ProjectController::class, 'sitApproval']);
        Route::post('/projects/{id}/uat-execution', [ProjectController::class, 'submitUatExecution']);
        Route::put('/projects/{id}/uat-execution/draft', [ProjectController::class, 'saveUatExecutionDraft']);
        // Kompatibilitas client lama; UI baru memakai approver individual di bawah.
        Route::post('/projects/{id}/uat-approval', [ProjectController::class, 'uatApproval']);
        Route::get('/projects/{id}/uat-approval-matrix', [UatApprovalController::class, 'matrix']);
        Route::post('/projects/{id}/uat-approval-rounds/sync', [UatApprovalController::class, 'sync']);
        Route::post('/projects/{id}/uat-approval-rounds', [UatApprovalController::class, 'restart']);
        Route::post('/projects/{id}/uat-approvers/{approver}/link', [UatApprovalController::class, 'generateLink']);
        Route::post('/projects/{id}/uat-approvers/{approver}/decision', [UatApprovalController::class, 'internalDecision']);
        // Change Request UAT sekarang HANYA lahir dari eksekusi UAT Tahap 2
        // (`POST /projects/{id}/uat-execution` → `UatExecutionService::holdForMajorRevision()`),
        // yang menuliskan `cycle`, `source`, dan `origin` pada tiap CR. Endpoint pengajuan
        // manual lama sudah dihapus: UI-nya tidak ada lagi dan CR yang dihasilkannya tanpa
        // `cycle` tidak pernah terlihat oleh gerbang `UAT_REVISION_DEV → SIT_IN_PROGRESS`.
        // Endpoint keputusan tetap dipakai untuk memutuskan CR hasil eksekusi.
        Route::post('/projects/{id}/uat-change-request/decision', [ProjectController::class, 'uatChangeRequestDecision']);
        Route::post('/projects/{id}/team', [ProjectController::class, 'allocateTeam']);

        // ----- TASK ROUTES -----
        Route::get('/projects/{projectId}/tasks', [TaskController::class, 'getByProject']);
        Route::post('/projects/{projectId}/tasks', [TaskController::class, 'store']);
        Route::patch('/tasks/{taskId}', [TaskController::class, 'update']);
        Route::delete('/tasks/{taskId}', [TaskController::class, 'destroy']);
        Route::post('/tasks/{taskId}/request-revision', [TaskController::class, 'requestRevision']);

        // ----- QA & CYBER TESTING ROUTES -----
        //
        // Empat langkah satu jalur pengujian, satu endpoint per langkah, dan urutannya
        // dijaga `TestingTrackService`:
        //
        //   submit    PM mengajukan pengujian
        //   assign    Lead mendisposisikan ke pelaksana
        //   report    pelaksana mengirim laporan (berhenti di REVIEW)
        //   sign-off  Lead memutuskan lulus atau kembalikan ke pengembangan
        //
        // Laporan dan sign-off sengaja terpisah. Endpoint `POST /qa-requests` yang lama
        // menggabungkan keduanya: laporan pelaksana langsung memindahkan status utama
        // proyek, sehingga sign-off Lead tidak pernah menjadi keputusan tersendiri.
        Route::get('/qa-requests', [QARequestController::class, 'index']);
        Route::post('/qa-requests/submit', [QARequestController::class, 'submitRequest']);
        Route::post('/qa-requests/assign', [QARequestController::class, 'assign']);
        Route::post('/qa-requests/report', [QARequestController::class, 'storeReport']);
        Route::post('/qa-requests/sign-off', [QARequestController::class, 'signOff']);

        Route::get('/cyber-requests', [CyberRequestController::class, 'index']);
        Route::post('/cyber-requests/submit', [CyberRequestController::class, 'submitRequest']);
        Route::post('/cyber-requests/assign', [CyberRequestController::class, 'assign']);
        Route::post('/cyber-requests/report', [CyberRequestController::class, 'storeReport']);
        Route::post('/cyber-requests/sign-off', [CyberRequestController::class, 'signOff']);

        // ----- RELEASE REQUEST & QUALITY GATE -----
        Route::get('/release-requests', [ReleaseRequestController::class, 'index']);
        Route::post('/release-requests', [ReleaseRequestController::class, 'store']);

        // Quality Gate — Head of IT only
        Route::middleware('role:super_admin,head_of_it')->group(function () {
            Route::get('/quality-gate/queue', [QualityGateController::class, 'queue']);
            Route::post('/quality-gate/approve', [QualityGateController::class, 'approve']);
            Route::post('/quality-gate/reject', [QualityGateController::class, 'reject']);
        });

        // ----- DOCUMENT VAULT -----
        Route::get('/documents', [DocumentController::class, 'index']);
        Route::post('/documents', [DocumentController::class, 'upload']);
        Route::get('/documents/{id}/download', [DocumentController::class, 'download']);
        Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);

        // ----- NOTIFICATION -----
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
        Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);

        // ----- CHAT (per proyek) -----
        Route::get('/projects/{projectId}/chat', [ChatController::class, 'index']);
        Route::post('/projects/{projectId}/chat', [ChatController::class, 'store']);
    });
});
