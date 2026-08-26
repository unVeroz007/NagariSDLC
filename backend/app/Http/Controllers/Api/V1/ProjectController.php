<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Enums\TrackStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Project\AllocateTeamRequest;
use App\Http\Requests\Project\DecideUatChangeRequest;
use App\Http\Requests\Project\StoreProjectRequest;
use App\Http\Requests\Project\SaveUatExecutionDraftRequest;
use App\Http\Requests\Project\SubmitApprovalNoteRequest;
use App\Http\Requests\Project\SubmitUatExecutionRequest;
use App\Http\Requests\Project\UpdateProjectRequest;
use App\Http\Requests\Project\UpdateProjectStatusRequest;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\ProjectStatusHistoryResource;
use App\Models\ActivityLog;
use App\Models\Division;
use App\Models\Project;
use App\Services\ProjectAccessService;
use App\Services\ProjectWorkflowService;
use App\Services\SitApprovalService;
use App\Services\UatExecutionService;
use App\Services\UatApprovalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class ProjectController extends Controller
{
    /** Keys yang hanya boleh ditulis oleh endpoint workflow khusus. */
    private const SERVER_MANAGED_SIT_UAT_KEYS = [
        'uat2_scenarios',
        'uat2_additional_requests',
        'uat2_summary',
        'uat2_executedCount',
        'uat2_passedCount',
        'uat2_findings',
        'uat2_execNotes',
        // `uat2_resume_after_sit` dipertahankan selama baris lama di produksi masih
        // memakai nama itu; penulisan baru memakai `uat_restart_after_sit`.
        'uat2_resume_after_sit',
        'uat_restart_after_sit',
        'uat2_verification_history',
        'uat2_major_revision_verified_at',
        // Cap waktu lulusnya SIT ulang adalah bukti tata kelola yang hanya boleh
        // ditulis `ProjectWorkflowService`. Nama lama ikut dilindungi karena baris
        // produksi lama masih menyimpannya.
        'uat_sit_retest_passed_at',
        'uat2_sit_retest_passed_at',
        'uat_hold',
        'uat_revision_cycles',
        'uat_cycles',
        'sit_retest_scope',
        'uat3_approvals',
        'uat_change_requests',
        'sit_cycles',
    ];

    /**
     * Status tempat pelaksanaan SIT sudah selesai, sehingga bukti dan persetujuan
     * task SIT (`sit2_task_approvals`) menjadi berita acara yang dibekukan.
     *
     * Cermin `SIT_COMPLETED_STATUSES` di `frontend/src/components/SITUATWizard.jsx`:
     * begitu SIT lulus, tab Eksekusi SIT tampil read-only di layar, dan penulisan
     * `sit2_task_approvals` lewat `PATCH /projects/{id}` dikembalikan ke nilai
     * tersimpan di sini. Status sebelum SIT lulus sengaja tidak disertakan — belum ada
     * berita acara yang perlu dilindungi, dan `SIT_IN_PROGRESS` justru saat sah
     * menulisnya (finalisasi SIT mengirim approvals sebelum transisi status, jadi pada
     * titik merge statusnya masih `SIT_IN_PROGRESS`). Revisi mayor mengosongkan
     * approvals lewat `UatExecutionService::holdForMajorRevision()`, bukan lewat
     * endpoint ini, lalu siklus SIT dibuka kembali pada `SIT_IN_PROGRESS`.
     */
    private const SIT_FROZEN_STATUSES = [
        ProjectStatus::SIT_PASSED->value,
        ProjectStatus::UAT_IN_PROGRESS->value,
        ProjectStatus::UAT_REVISION_SIT->value,
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::DEV_COMPLETED->value,
        ProjectStatus::RETURN_TO_DEV->value,
        ProjectStatus::READY_FOR_QA->value,
        ProjectStatus::QA_IN_PROGRESS->value,
        ProjectStatus::QA_PASSED->value,
        ProjectStatus::CYBER_IN_PROGRESS->value,
        ProjectStatus::CYBER_PASSED->value,
        ProjectStatus::READY_FOR_UAT->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
    ];

    /**
     * Status yang menandai proyek sudah melewati gerbang rilis resmi.
     *
     * `PENDING_GOLIVE` berarti pengajuan rilis sudah berada di tangan Grup
     * Infrastruktur, dan `LIVE_PRODUCTION` berarti sistemnya sudah dipakai. Menghapus
     * proyek pada dua keadaan itu memutus rantai bukti dari permintaan bisnis sampai
     * rilis produksi, sehingga ditolak tanpa kecuali — termasuk untuk Super Admin.
     * Penghentian proyek yang sah dilakukan lewat transisi status `CANCELLED`, bukan
     * lewat penghapusan.
     *
     * @var list<string>
     */
    private const UNDELETABLE_STATUSES = [
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
    ];

    public function __construct(
        protected ProjectWorkflowService $workflowService,
        protected UatExecutionService $uatExecutionService,
        protected UatApprovalService $uatApprovalService,
        protected ProjectAccessService $accessService,
        protected SitApprovalService $sitApprovalService
    ) {}

    public function nextReqId(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data'   => ['req_id' => Project::generateReqId()],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing('role');

        $query = Project::with(Project::RESOURCE_RELATIONS);

        // ─── ROLE-BASED DATA ISOLATION ───
        // Aturan visibilitas dipusatkan di ProjectAccessService agar daftar ini dan
        // pemeriksaan akses di show()/update() tidak pernah menyimpang satu sama lain.
        $this->accessService->applyVisibilityScope($query, $user);

        // ─── EXISTING FILTERS ───
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('req_id', 'like', "%{$search}%");
            });
        }

        if ($request->filled('pm_id')) {
            $query->where('pm_id', $request->pm_id);
        }

        // Batasi ukuran halaman supaya satu permintaan tidak bisa memaksa server
        // memuat seluruh tabel beserta relasinya. Frontend menarik seluruh daftar
        // dengan menelusuri halaman memakai `per_page` maksimum ini.
        $perPage = max(1, min((int) $request->get('per_page', 50), 200));

        $projects = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => ProjectResource::collection($projects)->response()->getData(true)['data'],
            'meta' => [
                'current_page' => $projects->currentPage(),
                'last_page'    => $projects->lastPage(),
                'per_page'     => $projects->perPage(),
                'total'        => $projects->total(),
            ],
        ]);
    }

    /**
     * Buat pengajuan proyek baru — titik awal seluruh rantai jejak audit.
     *
     * Statusnya ditulis langsung sebagai `PENDING` tanpa melalui
     * `ProjectWorkflowService` karena ini bukan transisi: `PENDING` adalah keadaan
     * asal, dan belum ada status sebelumnya yang bisa divalidasi bentuk transisinya.
     * Seluruh perpindahan sesudahnya tetap wajib lewat service tersebut.
     */
    public function store(StoreProjectRequest $request): JsonResponse
    {
        // Support both 'title' and 'name' from FE
        $title = $request->title ?? $request->name;
        $user = $request->user();
        $user->loadMissing('role');

        // Resolve division_id — FE might send division_id directly or division name
        $divisionId = $request->division_id;
        if (! $divisionId && $request->filled('division')) {
            $division = Division::where('name', $request->division)
                ->orWhere('code', $request->division)
                ->first();
            $divisionId = $division?->id;
        }
        if (! $divisionId) {
            $divisionId = $user->division_id;
        }

        $project = Project::create([
            'req_id'       => Project::generateReqId(),
            'title'        => $title,
            'description'  => $request->description,
            'contact_phone'=> $request->contact_phone,
            'type'         => $request->type === 'Non-RBB' ? 'NON_RBB' : ($request->type ?? 'RBB'),
            'project_type' => $request->project_type ?? 'baru',
            'priority'     => $request->priority ?? 'Medium',
            'division_id'  => $divisionId,
            'target_date'  => $request->target_date,
            // Tenggat RBB sudah diseragamkan dari `rbbDeadline` ke `rbb_deadline` oleh
            // `StoreProjectRequest::prepareForValidation()`.
            'rbb_deadline' => $request->input('rbb_deadline'),
            'created_by'   => $user->id,
            'status'       => ProjectStatus::PENDING->value,
        ]);

        // Pengajuan adalah mata rantai pertama jejak audit proyek, tetapi sebelumnya
        // satu-satunya peristiwa yang tidak dicatat. Riwayat sebuah proyek karena itu
        // dimulai dari disposisi Kadiv, tanpa bukti siapa yang mengajukannya dan kapan.
        ActivityLog::create([
            'user_id'      => $user->id,
            'action'       => 'create_project',
            'action_label' => 'Mengajukan Proyek',
            'description'  => "{$user->name} mengajukan proyek \"{$project->title}\" ({$project->req_id}).",
            'subject_type' => Project::class,
            'subject_id'   => $project->id,
            'metadata'     => [
                'project_id'   => $project->id,
                'project_name' => $project->title,
                'req_id'       => $project->req_id,
                'type'         => $project->type,
                'project_type' => $project->project_type,
                'priority'     => $project->priority,
                'division_id'  => $project->division_id,
                'user_role'    => $user->role?->display_name ?? $user->role?->name,
            ],
            'status'       => 'success',
            'ip_address'   => $request->ip(),
        ]);

        return response()->json([
            'status'  => 'success',
            'message' => 'Pengajuan proyek berhasil dibuat.',
            'data'    => new ProjectResource($project->load(['creator', 'division'])),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $project = Project::with(Project::RESOURCE_RELATIONS)->findOrFail($id);

        $user = $request->user();
        $user->loadMissing('role');

        // Penyaringan di index() saja tidak cukup: tanpa pemeriksaan di sini, ID proyek
        // milik orang lain masih dapat dibuka langsung lewat endpoint ini.
        if (! $this->accessService->canView($user, $project)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki akses ke proyek ini.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'data'   => new ProjectResource($project),
        ]);
    }

    /**
     * General project update (non-status fields: pm_id, analyst_id, staging_url, uat_notes, etc.)
     * If 'status' is provided, routes through ProjectWorkflowService.
     */
    /**
     * Catat perubahan status jalur pengujian ke activity_logs.
     *
     * Dibandingkan atas keadaan DB sebelum/sesudah `update`, bukan atas payload. Sejak
     * `qa_status`/`cyber_status` dilarang di UpdateProjectRequest, endpoint ini tak lagi
     * dapat mengubahnya lewat klien; pencatatan ini bertahan sebagai penjaga: bila suatu
     * jalur kode internal sampai mengubah kolom jalur di sini, perubahannya tetap
     * ber-jejak audit. Seluruh isi log ditulis server, bukan diambil dari payload klien.
     */
    private function recordTrackStatusAudit(Project $project, Request $request, array $statusBeforeUpdate): void
    {
        $trackLabels = [
            'qa_status'    => 'Pengujian QA',
            'cyber_status' => 'Audit Keamanan Siber',
        ];

        $user = $request->user();
        $user?->loadMissing('role');

        foreach ($trackLabels as $column => $trackLabel) {
            $previousStatus = TrackStatus::normalize($statusBeforeUpdate[$column] ?? null);
            $currentStatus = TrackStatus::normalize($project->{$column});

            if ($previousStatus === $currentStatus) {
                continue;
            }

            ActivityLog::create([
                'user_id'      => $user?->id,
                'action'       => 'update_project_track_status',
                'action_label' => 'Mengubah Status Jalur Pengujian',
                'description'  => "Status {$trackLabel} proyek \"{$project->title}\" diubah dari {$previousStatus->label()} menjadi {$currentStatus->label()}.",
                'subject_type' => Project::class,
                'subject_id'   => $project->id,
                'metadata'     => [
                    'project_id'   => $project->id,
                    'project_name' => $project->title,
                    'track'        => $column,
                    'from_status'  => $previousStatus->value,
                    'to_status'    => $currentStatus->value,
                    'user_name'    => $user?->name,
                    'user_role'    => $user?->role?->display_name ?? $user?->role?->name,
                    // Catatan pengaju disimpan apa adanya sebagai lampiran konteks.
                    // Deskripsi log di atas tetap ditulis server, jadi isi kiriman
                    // klien tidak bisa menyamarkan apa yang sebenarnya terjadi.
                    'notes'        => $request->input('notes'),
                ],
                'ip_address'   => $request->ip(),
                'status'       => 'success',
                'created_at'   => now(),
            ]);
        }
    }

    /**
     * Susun payload update proyek dari kunci yang benar-benar dikirim klien.
     *
     * Sebelumnya seluruh kandidat dilewatkan `array_filter(fn ($v) => ! is_null($v))`,
     * sehingga kolom nullable tidak pernah bisa dikosongkan lagi: menghapus isi
     * `description`, `target_date`, atau `staging_url` terkirim sebagai null lalu
     * dibuang tanpa pesan apa pun, dan pengirim menyangka perubahannya tersimpan.
     * Sekarang keberadaan kunci — bukan nilainya — yang menentukan kolom ikut ditulis.
     *
     * Kolom yang di database NOT NULL tetap menolak null. `division_id`, `title`,
     * `type`, dan `project_type` termasuk di dalamnya, jadi kiriman null pada kolom
     * itu diabaikan agar tidak menjatuhkan query dengan galat integritas. Kolom
     * penunjuk jalur pengujian juga tidak dapat dikosongkan karena nilainya dikelola
     * endpoint jalur QA/Siber, bukan formulir proyek.
     *
     * @param  array<string, mixed>|null  $mergedSitUatData
     * @return array<string, mixed>
     */
    private function buildProjectUpdatePayload(
        Request $request,
        ?string $typeValue,
        int|string|null $resolvedAnalystId,
        ?array $mergedSitUatData
    ): array {
        $payload = [];

        // kolom => boleh dikosongkan (null diterima)
        $simpleColumns = [
            'title' => false,
            'description' => true,
            'contact_phone' => true,
            'project_type' => false,
            'division_id' => false,
            'target_date' => true,
            // Tenggat RBB boleh dikosongkan: kolomnya nullable, dan proyek yang
            // dipindahkan dari RBB ke Non-RBB memang tidak lagi memiliki tenggat itu.
            'rbb_deadline' => true,
            // Prioritas TIDAK boleh dikosongkan. Kolomnya NOT NULL dengan default
            // `Medium`; kiriman null hanya akan menjatuhkan query dengan galat
            // integritas, sama seperti `title` dan `division_id` di atas.
            'priority' => false,
            'staging_url' => true,
            'uat_notes' => true,
            'pm_id' => true,
        ];

        foreach ($simpleColumns as $column => $isClearable) {
            if (! $request->has($column)) {
                continue;
            }

            $value = $request->input($column);

            if ($value === null && ! $isClearable) {
                continue;
            }

            $payload[$column] = $value;
        }

        if ($request->has('type') && $typeValue !== null) {
            $payload['type'] = $typeValue;
        }

        // Analis dapat dikirim sebagai id maupun nama (layar Kadiv memakai nama).
        // Bila hanya nama yang dikirim dan namanya tidak ditemukan, penugasan yang
        // sudah ada tidak boleh terhapus — itu akan menghilangkan disposisi karena
        // salah tulis nama.
        if ($request->has('analyst_id') || $resolvedAnalystId !== null) {
            $payload['analyst_id'] = $resolvedAnalystId;
        }

        // Tenggat tahap berjalan punya alias `deadline` pada beberapa layar lama.
        if ($request->has('current_stage_deadline')) {
            $payload['current_stage_deadline'] = $request->input('current_stage_deadline');
        } elseif ($request->has('deadline')) {
            $payload['current_stage_deadline'] = $request->input('deadline');
        }

        $aliasedJsonColumns = [
            'analyst_result' => ['analyst_result', 'analystResult'],
            'dev_analyst_result' => ['dev_analyst_result', 'devAnalystResult'],
        ];

        foreach ($aliasedJsonColumns as $column => $requestKeys) {
            foreach ($requestKeys as $requestKey) {
                if ($request->has($requestKey)) {
                    $payload[$column] = $request->input($requestKey);
                    break;
                }
            }
        }

        if ($mergedSitUatData !== null) {
            $payload['sit_uat_data'] = $mergedSitUatData;
        }

        // Kolom jalur pengujian (`qa_status`, `cyber_status`) sengaja tidak disusun di
        // sini: keduanya `prohibited` di UpdateProjectRequest, jadi mustahil sampai ke
        // payload. Pemiliknya adalah endpoint jalur pengujian, bukan formulir proyek.

        if ($request->has('team_allocated_by_pm')) {
            $payload['team_allocated_by_pm'] = (bool) $request->input('team_allocated_by_pm');
        }

        return $payload;
    }

    public function update(UpdateProjectRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);

        $user = $request->user();
        $user->loadMissing('role');

        // Gerbang tulis. Lebih ketat daripada gerbang baca: mengubah field proyek
        // menuntut keterlibatan langsung, bukan sekadar berada di fase yang sama.
        // Tanpa ini, analis lain dapat menimpa `analyst_result` proyek yang bukan
        // tanggung jawabnya. Pemeriksaan wewenang transisi status tetap dijalankan
        // ProjectWorkflowService di bawah.
        if (! $this->accessService->canUpdate($user, $project)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki akses untuk mengubah proyek ini.',
            ], 403);
        }

        // Resolve analyst_id from analyst name if needed (workspace sends analyst name).
        //
        // Penyaring role memakai `UserRole::PLANNING_QA_ANALYST_ROLES`, bukan hanya
        // 'analyst': Perencanaan dan QA satu grup dengan kumpulan analis yang sama, jadi
        // anggota bernama role `qa_tester` pun sah menjadi analis Fase 1.
        $analystId = $request->analyst_id;
        if (! $analystId && $request->filled('analyst')) {
            $analystName = $request->analyst;
            $analystUser = \App\Models\User::where(fn ($q) => $q->where('name', $analystName)
                    ->orWhere('name', 'like', "%{$analystName}%"))
                ->whereHas('role', fn ($q) => $q->whereIn('name', UserRole::PLANNING_QA_ANALYST_ROLES))
                ->first();
            $analystId = $analystUser?->id;
        }

        $typeValue = $request->type;
        if ($typeValue === 'Non-RBB') {
            $typeValue = 'NON_RBB';
        }

        $resolvedAnalystId = $analystId ?? $request->input('analyst_id');

        // Gerbang disposisi. Dibandingkan dengan nilai tersimpan lebih dulu supaya
        // payload yang sekadar mengirim ulang penanggung jawab yang sama — hal biasa
        // pada formulir yang mengirim seluruh objek proyek — tidak ikut tertolak.
        $personnelChangeAttempted =
            ($request->has('pm_id') && (int) $request->input('pm_id') !== (int) $project->pm_id)
            || (($request->has('analyst_id') || $request->filled('analyst'))
                && (int) $resolvedAnalystId !== (int) $project->analyst_id);

        if ($personnelChangeAttempted && ! $this->accessService->canAssignPersonnel($user)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Penetapan PM atau analis penanggung jawab hanya dapat dilakukan Development Lead, Kadiv, Head of IT, atau Super Admin.',
            ], 403);
        }

        $incomingSitUatData = $request->input('sit_uat_data', $request->input('sitUatData'));
        $mergedSitUatData = null;
        if (is_array($incomingSitUatData)) {
            $currentSitUatData = (array) $project->sit_uat_data;
            foreach (self::SERVER_MANAGED_SIT_UAT_KEYS as $key) {
                if (array_key_exists($key, $currentSitUatData)) {
                    $incomingSitUatData[$key] = $currentSitUatData[$key];
                } else {
                    unset($incomingSitUatData[$key]);
                }
            }

            // Daftar penanda tangan UAT tidak boleh dikosongkan oleh satu kiriman.
            // Orangnya melewati setiap siklus revisi — PM hanya menambah atau
            // memperbaiki entri — sehingga tidak ada satu pun kondisi bisnis yang
            // membenarkan daftar ini kembali kosong.
            //
            // Kiriman yang sama sekali tidak menyertakan kunci ini sudah aman karena
            // `array_replace` di bawah mempertahankan nilai tersimpan. Yang belum
            // tertutup adalah kiriman yang menyertakan kuncinya dengan array kosong,
            // dan itulah bentuk yang benar-benar berisiko: wizard SIT/UAT selalu
            // mengirim `uat1_participants` melalui `buildSitUatData`, sehingga satu
            // render dengan state peserta yang belum terisi cukup untuk menghapus
            // roster dan memaksa PM mengetik ulang belasan nama beserta nomor HP-nya.
            // Menyunting dan menambah peserta tetap berjalan seperti biasa; yang
            // ditolak hanya pengosongan.
            $storedParticipants = $currentSitUatData['uat1_participants'] ?? null;
            $incomingParticipants = $incomingSitUatData['uat1_participants'] ?? null;
            if (
                is_array($storedParticipants) && $storedParticipants !== []
                && (! is_array($incomingParticipants) || $incomingParticipants === [])
            ) {
                $incomingSitUatData['uat1_participants'] = $storedParticipants;
            }

            // Bukti dan persetujuan task SIT dibekukan setelah SIT lulus. Lihat
            // SIT_FROZEN_STATUSES: bila proyek sudah melewati SIT, kiriman yang
            // menyertakan `sit2_task_approvals` dikembalikan ke nilai tersimpan alih-alih
            // ditolak, supaya PATCH yang membawa seluruh objek proyek (mis. tab SIT
            // dibuka hanya untuk dibaca) tetap lolos tanpa mengubah berita acara yang
            // sudah final. Ini pasangan server dari prop `readOnly` pada `SITTaskExecution`.
            if (
                array_key_exists('sit2_task_approvals', $incomingSitUatData)
                && in_array($project->status->value, self::SIT_FROZEN_STATUSES, true)
            ) {
                if (array_key_exists('sit2_task_approvals', $currentSitUatData)) {
                    $incomingSitUatData['sit2_task_approvals'] = $currentSitUatData['sit2_task_approvals'];
                } else {
                    unset($incomingSitUatData['sit2_task_approvals']);
                }
            }

            $mergedSitUatData = array_replace($currentSitUatData, $incomingSitUatData);
        }

        $updateData = $this->buildProjectUpdatePayload(
            $request,
            $typeValue,
            $resolvedAnalystId,
            $mergedSitUatData
        );

        $trackStatusBeforeUpdate = [
            'qa_status'    => $project->qa_status,
            'cyber_status' => $project->cyber_status,
        ];

        $project->update($updateData);

        $this->recordTrackStatusAudit($project, $request, $trackStatusBeforeUpdate);

        // Handle status transition through the state machine
        if ($request->filled('status')) {
            $targetStatus = ProjectStatus::tryFrom($request->status);

            if (! $targetStatus) {
                return response()->json([
                    'status'  => 'error',
                    'message' => "Data proyek diperbarui, namun status tujuan \"{$request->status}\" tidak dikenali sistem.",
                ], 422);
            }

            try {
                $notes = $request->input('notes') ?? $request->input('leadNote') ?? $request->input('lead_note');
                $this->workflowService->transition(
                    $project,
                    $targetStatus,
                    $request->user(),
                    $notes
                );
            } catch (Throwable $e) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Data proyek diperbarui, namun transisi status gagal: ' . $e->getMessage(),
                ], 422);
            }
        }


        if ($request->has('team') || $request->has('team_ids') || $request->has('developers')) {
            $teamData = $request->input('team') ?? $request->input('team_ids') ?? $request->input('developers');
            if (is_array($teamData)) {
                \App\Models\ProjectTeamMember::where('project_id', $project->id)->delete();
                foreach ($teamData as $member) {
                    $userId = null;
                    $roleInProject = 'Developer';

                    if (is_array($member) || is_object($member)) {
                        $member = (array) $member;
                        $userId = $member['user_id'] ?? $member['id'] ?? null;
                        $roleInProject = $member['skill'] ?? $member['role'] ?? 'Developer';
                        if (!$userId && !empty($member['email'])) {
                            $u = \App\Models\User::where('email', $member['email'])->first();
                            $userId = $u?->id;
                        }
                        if (!$userId && !empty($member['name'])) {
                            $u = \App\Models\User::where('name', 'like', "%{$member['name']}%")->first();
                            $userId = $u?->id;
                        }
                    } elseif (is_numeric($member)) {
                        $userId = (int) $member;
                    }

                    if ($userId) {
                        \App\Models\ProjectTeamMember::create([
                            'project_id'      => $project->id,
                            'user_id'         => $userId,
                            'role_in_project' => $roleInProject,
                            'assigned_by'     => $member['assigned_by'] ?? 'lead',
                        ]);
                    }
                }
            }
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'Data proyek dan alokasi tim berhasil diperbarui.',
            'data'    => new ProjectResource($project->fresh(['creator', 'pm', 'analyst', 'division', 'teamMembers.user'])),
        ]);
    }

    /**
     * Tetapkan anggota tim proyek — menulis langsung ke tabel `project_team_members`.
     * POST/PUT /projects/{id}/team
     *
     * Endpoint ini menghapus seluruh baris tim lalu membuatnya ulang, jadi wewenangnya
     * diperiksa di sini lewat `ProjectAccessService::canAllocateTeam()`. Rutenya tidak
     * memakai middleware `role:` karena PM hanya boleh mengalokasikan tim pada proyek
     * yang dipegangnya sendiri, dan itu bergantung pada baris proyek yang dituju.
     *
     * Penulisan ulang tim adalah perubahan penanggung jawab pekerjaan, sehingga
     * susunan sebelum dan sesudah dicatat ke jejak audit.
     */
    public function allocateTeam(AllocateTeamRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $user = $request->user();
        $user->loadMissing('role');

        abort_unless(
            $this->accessService->canAllocateTeam($user, $project),
            403,
            'Anda tidak memiliki wewenang untuk mengalokasikan tim pada proyek ini.'
        );

        $teamData = $request->input('team', []);

        // Use DB transaction to prevent race conditions
        $result = DB::transaction(function () use ($project, $teamData): array {
            $previousUserIds = \App\Models\ProjectTeamMember::where('project_id', $project->id)
                ->pluck('user_id')
                ->map(fn ($value): int => (int) $value)
                ->values()
                ->all();

            \App\Models\ProjectTeamMember::where('project_id', $project->id)->delete();

            $savedUserIds = [];
            $skipped = 0;

            foreach ($teamData as $member) {
                $member = (array) $member;
                $userId = null;
                $roleInProject = $member['skill'] ?? $member['role'] ?? 'Developer';

                // Resolve by user_id (explicit) first, then id, then email
                if (!empty($member['user_id']) && is_numeric($member['user_id'])) {
                    $userId = (int) $member['user_id'];
                } elseif (!empty($member['id']) && is_numeric($member['id'])) {
                    $userId = (int) $member['id'];
                }

                if (!$userId && !empty($member['email'])) {
                    $u = \App\Models\User::where('email', $member['email'])->first();
                    if ($u) $userId = $u->id;
                }

                // Anggota yang tidak dapat dipetakan ke akun, dan anggota yang muncul dua
                // kali pada satu payload, tidak boleh menghasilkan baris. Tanpa penjaga
                // ini satu orang bisa terhitung dua kali sebagai anggota tim proyek.
                if (!$userId || in_array($userId, $savedUserIds, true)) {
                    $skipped++;
                    continue;
                }

                \App\Models\ProjectTeamMember::create([
                    'project_id'      => $project->id,
                    'user_id'         => $userId,
                    'role_in_project' => $roleInProject,
                    'assigned_by'     => $member['assigned_by'] ?? 'lead',
                ]);
                $savedUserIds[] = $userId;
            }

            return [
                'previous_user_ids' => $previousUserIds,
                'saved_user_ids'    => $savedUserIds,
                'skipped'           => $skipped,
            ];
        });

        $saved = count($result['saved_user_ids']);

        ActivityLog::create([
            'user_id'      => $user?->id,
            'action'       => 'allocate_project_team',
            'action_label' => 'Mengalokasikan Tim Proyek',
            'description'  => "{$user?->name} menetapkan {$saved} anggota tim pada proyek \"{$project->title}\" ({$project->req_id}).",
            'subject_type' => Project::class,
            'subject_id'   => $project->id,
            'metadata'     => [
                'project_id'        => $project->id,
                'req_id'           => $project->req_id,
                'previous_user_ids' => $result['previous_user_ids'],
                'user_ids'          => $result['saved_user_ids'],
                'skipped_entries'   => $result['skipped'],
                'user_role'         => $user?->role?->display_name ?? $user?->role?->name,
            ],
            'status'       => 'success',
            'ip_address'   => $request->ip(),
        ]);

        // Jumlah yang dilaporkan adalah baris yang benar-benar tersimpan, bukan panjang
        // payload: anggota tanpa akun yang dapat dipetakan memang tidak menghasilkan baris.
        $message = "{$saved} anggota tim berhasil dialokasikan ke proyek.";
        if ($result['skipped'] > 0) {
            $message .= " {$result['skipped']} entri dilewati karena tidak dapat dipetakan ke akun pengguna atau terduplikasi.";
        }

        return response()->json([
            'status'  => 'success',
            'message' => $message,
            'data'    => new ProjectResource($project->fresh(['creator', 'pm', 'analyst', 'division', 'teamMembers.user'])),
        ]);
    }

    /**
     * Hapus proyek (penghapusan lunak) beserta catatan auditnya.
     *
     * `Project` memakai `SoftDeletes`, jadi baris proyek hanya ditandai terhapus dan
     * seluruh anaknya — riwayat status, task, alokasi tim, laporan pengujian, dokumen,
     * pengajuan rilis, approval UAT, percakapan — tetap utuh. Sebelum penghapusan lunak
     * dipasang, satu pemanggilan endpoint ini memusnahkan semuanya lewat rantai kunci
     * asing ber-CASCADE, tanpa satu pun catatan aktivitas yang tersimpan.
     *
     * Dua lapis pembatas dipertahankan di sini:
     *
     *   1. wewenang — hanya Super Admin / Head of IT, atau PM proyek itu sendiri;
     *   2. tahap proyek — proyek yang sudah melewati gerbang rilis tidak boleh dihapus
     *      oleh siapa pun, karena bukti keterlacakannya sudah menjadi bagian dari
     *      catatan rilis produksi.
     */
    public function destroy(int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $user = request()->user();

        // Hanya super_admin/head_of_it yang bisa hapus proyek manapun
        // PM hanya bisa hapus proyek yang dikelola sendiri
        if (
            !in_array($user->role?->name, ['super_admin', 'head_of_it'])
            && $project->pm_id !== $user->id
        ) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Anda tidak memiliki wewenang untuk menghapus proyek ini.',
            ], 403);
        }

        $status = $project->status instanceof ProjectStatus
            ? $project->status->value
            : (string) $project->status;

        if (in_array($status, self::UNDELETABLE_STATUSES, true)) {
            return response()->json([
                'status'  => 'error',
                'message' => "Proyek \"{$project->title}\" sudah berada pada tahap {$status} dan tidak dapat dihapus. "
                    . 'Gunakan pembatalan proyek (status CANCELLED) bila proyek memang dihentikan.',
            ], 422);
        }

        $project->delete();

        ActivityLog::create([
            'user_id'      => $user?->id,
            'action'       => 'delete_project',
            'action_label' => 'Menghapus Proyek',
            'description'  => "Proyek \"{$project->title}\" ({$project->req_id}) dihapus pada status {$status}.",
            'subject_type' => Project::class,
            'subject_id'   => $project->id,
            'metadata'     => [
                'project_id'   => $project->id,
                'project_name' => $project->title,
                'req_id'       => $project->req_id,
                'status'       => $status,
                'user_name'    => $user?->name,
                'user_role'    => $user?->role?->display_name ?? $user?->role?->name,
            ],
            'status'       => 'success',
            'ip_address'   => request()->ip(),
        ]);

        return response()->json([
            'status'  => 'success',
            'message' => 'Proyek berhasil dihapus.',
        ]);
    }

    public function updateStatus(UpdateProjectStatusRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);

        try {
            $targetStatus = ProjectStatus::from($request->status);
            $updatedProject = $this->workflowService->transition(
                $project,
                $targetStatus,
                $request->user(),
                $request->notes
            );

            return response()->json([
                'status'  => 'success',
                'message' => "Status proyek berhasil diperbarui ke {$targetStatus->value}.",
                'data'    => new ProjectResource($updatedProject),
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Riwayat perubahan status satu proyek.
     *
     * Isinya adalah jejak audit: setiap transisi, siapa yang melakukannya beserta
     * role-nya, dan catatan yang ditulis. Karena itu gerbangnya sama dengan `show()` —
     * `canView()`. Tanpa pemeriksaan ini setiap akun yang login dapat membaca riwayat
     * keputusan proyek divisi lain hanya dengan menebak ID.
     */
    public function timeline(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $user = $request->user();
        $user->loadMissing('role');

        abort_unless(
            $this->accessService->canView($user, $project),
            403,
            'Anda tidak memiliki akses ke proyek ini.'
        );

        $histories = $project->statusHistories()->with('changedBy.role')->get();

        return response()->json([
            'status' => 'success',
            'data'   => ProjectStatusHistoryResource::collection($histories),
        ]);
    }

    /**
     * Gatekeeper SIT. Cakupannya selalu seluruh task aktif proyek — termasuk SIT ulang
     * akibat UAT Mayor, karena revisi Mayor kini mengulang SIT dan UAT sepenuhnya.
     * Yang membedakan SIT ulang hanyalah syarat tambahan: setiap task wajib punya
     * assignee, supaya tidak ada task CR yang lolos ke pengujian tanpa penanggung jawab.
     *
     * Balasannya memuat judul task dan nama assignee, jadi wewenangnya mengikuti
     * `canView()` seperti daftar task pada `TaskController@getByProject`.
     */
    public function sitGate(Request $request, int $id): JsonResponse
    {
        $project = Project::with('tasks.assignee')->findOrFail($id);
        $user = $request->user();
        $user->loadMissing('role');

        abort_unless(
            $this->accessService->canView($user, $project),
            403,
            'Anda tidak memiliki akses ke proyek ini.'
        );

        $tasks = $project->sitScopeTasks();
        $isRetestCycle = $project->isSitRetestCycle();

        // Semua task yang TIDAK berstatus done / take_down = blocker
        $incomplete = $tasks->filter(function ($t) use ($isRetestCycle) {
            $status = $t->status instanceof \BackedEnum ? $t->status->value : $t->status;
            return ! in_array($status, ['done', 'take_down'])
                || ($isRetestCycle && ! $t->assignee_id);
        })->values();

        $totalCount = $tasks->filter(function ($t) {
            $status = $t->status instanceof \BackedEnum ? $t->status->value : $t->status;
            return $status !== 'take_down';
        })->count();

        $doneCount = $tasks->filter(function ($t) use ($isRetestCycle) {
            $status = $t->status instanceof \BackedEnum ? $t->status->value : $t->status;
            return $status === 'done'
                && (! $isRetestCycle || (bool) $t->assignee_id);
        })->count();

        return response()->json([
            'status' => 'success',
            'data'   => [
                'can_start_sit' => $incomplete->isEmpty(),
                'blockers'      => $incomplete->map(fn($t) => [
                    'id'    => $t->id,
                    'title' => $t->title,
                    'status' => $t->status instanceof \BackedEnum ? $t->status->value : $t->status,
                    'assignee' => $t->assignee?->name,
                ]),
                'total_task'    => $totalCount,
                'done_task'     => $doneCount,
                'take_down_task'=> $project->tasks->filter(fn($t) => ($t->status instanceof \BackedEnum ? $t->status->value : $t->status) === 'take_down')->count(),
                'scope' => [
                    // `mode` dibaca dari scope tersimpan, bukan disimpulkan ulang di
                    // sini: siklus baru selalu `full`, sedangkan baris produksi lama
                    // yang masih bertanda `targeted` tetap melaporkan dirinya apa adanya.
                    // Penanda "ini SIT ulang" bagi frontend adalah `cycle`, bukan `mode`.
                    'mode' => $isRetestCycle
                        ? (string) (($project->sit_uat_data['sit_retest_scope']['mode'] ?? null) ?: 'full')
                        : 'full',
                    'cycle' => $isRetestCycle
                        ? (int) ($project->sit_uat_data['uat_hold']['cycle'] ?? 0)
                        : null,
                    'task_ids' => $tasks->pluck('id')->map(fn ($id) => (int) $id)->values(),
                ],
            ],
        ]);
    }

    /**
     * Persetujuan SIT (Tahap 3) oleh role: developer (seluruh developer tim proyek),
     * PM / Analyst Pengembangan (dev_analyst / project_manager), dan development_lead.
     * Approval developer disimpan per-user di sit_uat_data.sit3_approvals.developer.developers[].
     * PM & development_lead masing-masing 1 slot.
     */
    public function sitApproval(SubmitApprovalNoteRequest $request, int $id): JsonResponse
    {
        $project = Project::with(['teamMembers.user.role', 'tasks.assignee'])->findOrFail($id);
        $user = $request->user();
        $roleName = $user->role?->name;

        // Role approval yang diizinkan.
        // PM (dev_analyst / project_manager) = Analyst Pengembangan.
        // Pemetaannya berada di `SitApprovalService` agar inbox `GET /me/sit-approvals`
        // dan gerbang penerimaan keputusan di sini tidak pernah berbeda.
        $roleKey = $this->sitApprovalService->roleKeyFor($roleName);

        if (! $roleKey) {
            return response()->json([
                'status' => 'error',
                'message' => 'Role Anda tidak diizinkan memberikan persetujuan SIT.',
            ], 403);
        }

        // Validasi status proyek harus SIT_IN_PROGRESS
        $status = $project->status instanceof \BackedEnum ? $project->status->value : $project->status;
        if (! in_array($status, SitApprovalService::APPROVABLE_STATUSES, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Persetujuan SIT hanya dapat dilakukan saat proyek berstatus SIT.',
            ], 422);
        }

        // Seluruh developer tim proyek wajib menyetujui, bukan hanya penerima task
        // pada scope SIT. Definisinya berada di `Project::sitApprovalDeveloperIds()`
        // dan dipakai bersama gerbang kelengkapan di `ProjectWorkflowService`.
        $requiredDeveloperIds = $project->sitApprovalDeveloperIds();

        // Formulir persetujuan baru terbuka pada Tahap 3. Tanpa pemeriksaan ini gerbang
        // menerima tanda tangan untuk proyek yang eksekusi pengujiannya belum difinalkan
        // — proyek yang bahkan tidak muncul di inbox `GET /me/sit-approvals` milik
        // penandatangannya sendiri. Inbox dan gerbang sekarang memakai satu predikat.
        if (! $this->sitApprovalService->isDecisionStageOpen($project)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Persetujuan SIT baru dapat diberikan setelah eksekusi pengujian difinalkan dan proyek berada pada Tahap 3 Review & Sign-off.',
            ], 422);
        }

        // Validasi keanggotaan. Dua penolakan di bawah hanya memberi pesan yang lebih
        // spesifik untuk dua slot yang paling sering salah orang; keputusan cakupan yang
        // sebenarnya diambil `SitApprovalService::isInScope()` sesudahnya, satu predikat
        // yang sama dengan yang dipakai inbox `GET /me/sit-approvals`:
        // - developer harus berada pada tim proyek atau memegang task scope SIT
        // - PM (Analyst Pengembangan) harus pm_id proyek
        // - development_lead ditautkan lewat jejak disposisinya pada
        //   `project_status_histories`; alasan skema tidak punya `dev_lead_id` dan alasan
        //   penyaringan divisi ditolak ada di `SitApprovalService::isInScope()`.
        if ($roleKey === 'developer') {
            $isTeamDeveloper = in_array((int) $user->id, $requiredDeveloperIds, true);
            if (! $isTeamDeveloper) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda bukan developer pada tim proyek ini.',
                ], 403);
            }
        }
        if ($roleKey === 'pm') {
            if ((int) $project->pm_id !== (int) $user->id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda bukan Project Manager / Analyst Pengembangan pada proyek ini.',
                ], 403);
            }
        }
        if (! $this->sitApprovalService->isInScope($project, $user, $roleKey, $requiredDeveloperIds)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Proyek ini berada di luar cakupan persetujuan SIT Anda.',
            ], 403);
        }

        $approvals = (array) ($project->sit_uat_data['sit3_approvals'] ?? []);

        if ($roleKey === 'developer') {
            // Inisialisasi slot developer
            $devApproval = (array) ($approvals['developer'] ?? []);

            // Baris persetujuan yang sudah tercatat tidak pernah dibuang, termasuk
            // milik developer yang kemudian keluar dari tim atau task-nya dialihkan.
            // Sebelumnya daftar ini disaring ulang terhadap daftar wajib setiap kali
            // ada yang menyetujui, sehingga satu pengalihan task menghapus jejak
            // persetujuan yang benar-benar pernah diberikan seseorang.
            $devList = array_values((array) ($devApproval['developers'] ?? []));
            $userId = (int) $user->id;
            $alreadyApproved = collect($devList)->contains(fn($d) => (int) ($d['userId'] ?? $d['approvedById'] ?? 0) === $userId);
            if (! $alreadyApproved) {
                $devList[] = [
                    'userId' => $userId,
                    'name'   => $user->name,
                    'at'     => now()->toIso8601String(),
                    'note'   => $request->note ?? null,
                ];
            }

            // Kelengkapan tetap dinilai hanya dari penyetuju yang masih wajib, supaya
            // persetujuan lama tidak pernah menutup gerbang atas nama orang yang
            // sudah tidak berada di tim.
            $approvedRequiredCount = collect($devList)
                ->map(fn (array $approval): int => (int) ($approval['userId'] ?? $approval['approvedById'] ?? 0))
                ->filter(fn (int $developerId): bool => in_array($developerId, $requiredDeveloperIds, true))
                ->unique()
                ->count();

            $approvals['developer'] = [
                'required'       => count($requiredDeveloperIds),
                'approvedCount'  => $approvedRequiredCount,
                'developers'     => $devList,
                // Disimpan agar tercatat siapa saja yang wajib menyetujui pada saat
                // persetujuan diberikan — daftar tim dapat berubah setelahnya.
                'requiredDeveloperIds' => $requiredDeveloperIds,
            ];
        } else {
            $approvals[$roleKey] = [
                'approved'  => true,
                'approvedBy'=> $user->name,
                'approvedById' => $user->id,
                'at'        => now()->toIso8601String(),
                'note'      => $request->note ?? null,
            ];
        }

        $sitData = (array) $project->sit_uat_data;
        $sitData['sit3_approvals'] = $approvals;
        $project->update(['sit_uat_data' => $sitData]);

        // Catat aktivitas
        \App\Models\ActivityLog::create([
            'user_id' => $user->id,
            'action'  => 'sit_approval',
            'action_label' => 'Persetujuan SIT',
            'description' => "{$user->name} ({$roleName}) menyetujui SIT pada proyek \"{$project->title}\".",
            'subject_type' => Project::class,
            'subject_id' => $project->id,
            'metadata' => [
                'project_id' => $project->id,
                'project_name' => $project->title,
                'user_role' => $roleName,
                'approval_role' => $roleKey,
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Persetujuan SIT dari {$roleName} berhasil disimpan.",
            'data' => new ProjectResource($project->fresh(['tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user'])),
        ]);
    }

    /**
     * Hitung status kelengkapan approval SIT (dipakai frontend & dokumen).
     * developer: seluruh developer tim proyek; analyst & development_lead: 1 slot.
     */
    public static function sitApprovalStatus(array $approvals, $project): array
    {
        $requiredDeveloperIds = collect($project->sitApprovalDeveloperIds());
        $requiredDevCount = $requiredDeveloperIds->count();

        $devApproval = (array) ($approvals['developer'] ?? []);
        $approvedDeveloperIds = collect($devApproval['developers'] ?? [])
            ->map(fn (array $approval): int => (int) ($approval['userId'] ?? $approval['approvedById'] ?? 0))
            ->filter()
            ->unique();
        $devApproved = $requiredDeveloperIds->intersect($approvedDeveloperIds)->count();

        return [
            'developer' => [
                'required'       => $requiredDevCount,
                'approved'       => $requiredDevCount > 0 && $devApproved >= $requiredDevCount,
                'approvedCount'  => $devApproved,
            ],
            'pm' => [
                'required' => 1,
                'approved' => ($approvals['pm']['approved'] ?? false) === true,
            ],
            'development_lead' => [
                'required' => 1,
                'approved' => ($approvals['development_lead']['approved'] ?? false) === true,
            ],
        ];
    }

    /**
     * Persetujuan UAT (Tahap 3) oleh role: business_user (pemohon), pm, development_lead.
     * Disimpan di sit_uat_data.uat3_approvals.
     */
    public function uatApproval(SubmitApprovalNoteRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $user = $request->user();
        $roleName = $user->role?->name;

        $roleKey = match ($roleName) {
            'business_user' => 'business_user',
            'dev_analyst', 'project_manager' => 'pm',
            'development_lead' => 'development_lead',
            'super_admin', 'head_of_it' => 'pm', // Admin dianggap mewakili PM
            default => null,
        };

        if (! $roleKey) {
            return response()->json([
                'status' => 'error',
                'message' => 'Role Anda tidak diizinkan memberikan persetujuan UAT.',
            ], 403);
        }

        $status = $project->status instanceof \BackedEnum ? $project->status->value : $project->status;
        if ($status !== ProjectStatus::UAT_IN_PROGRESS->value) {
            return response()->json([
                'status' => 'error',
                'message' => 'Persetujuan UAT hanya dapat dilakukan saat proyek berstatus UAT.',
            ], 422);
        }

        $sitData = (array) $project->sit_uat_data;
        if (
            (int) ($sitData['activeUatStep'] ?? 1) < 3
            || $project->isUatRestartPending()
        ) {
            return response()->json([
                'status' => 'error',
                'message' => 'Persetujuan final belum tersedia. Selesaikan eksekusi UAT dan seluruh revisi mayor terlebih dahulu.',
            ], 422);
        }

        if ($roleKey === 'business_user') {
            if ((int) $project->created_by !== (int) $user->id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda bukan pemohon proyek ini.',
                ], 403);
            }
        }
        if ($roleKey === 'pm') {
            $isAdminProxy = in_array($roleName, ['super_admin', 'head_of_it']);
            if (! $isAdminProxy && (int) $project->pm_id !== (int) $user->id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda bukan Project Manager proyek ini.',
                ], 403);
            }
        }

        $approvals = (array) ($sitData['uat3_approvals'] ?? []);
        $approvals[$roleKey] = [
            'approved'     => true,
            'approvedBy'   => $user->name,
            'approvedById' => $user->id,
            'at'           => now()->toIso8601String(),
            'note'         => $request->note ?? null,
        ];
        $sitData['uat3_approvals'] = $approvals;
        $project->update(['sit_uat_data' => $sitData]);

        \App\Models\ActivityLog::create([
            'user_id' => $user->id,
            'action'  => 'uat_approval',
            'action_label' => 'Persetujuan UAT',
            'description' => "{$user->name} ({$roleName}) menyetujui UAT pada proyek \"{$project->title}\".",
            'subject_type' => Project::class,
            'subject_id' => $project->id,
            'metadata' => [
                'project_id' => $project->id,
                'project_name' => $project->title,
                'user_role' => $roleName,
                'approval_role' => $roleKey,
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Persetujuan UAT dari {$roleName} berhasil disimpan.",
            'data' => new ProjectResource($project->fresh(['tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user'])),
        ]);
    }

    /**
     * Simpan hasil UAT Tahap 2 per skenario. Ringkasan dan keputusan alur
     * dihitung oleh server; revisi mayor otomatis menjadi Change Request.
     */
    public function submitUatExecution(SubmitUatExecutionRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $savedProject = $this->uatExecutionService->submit(
            $project,
            $request->user(),
            $request->validated()
        );
        $summary = (array) ($savedProject->sit_uat_data['uat2_summary'] ?? []);
        // Revisi Mayor mengosongkan `uat2_summary` karena UAT diulang dari Tahap 1,
        // jadi kesimpulannya dibaca dari penanda hold — bukan dari ringkasan yang
        // memang sudah tidak ada lagi setelah putarannya diarsipkan.
        $isMajorRevision = $savedProject->isUatRestartPending();

        return response()->json([
            'status' => 'success',
            'message' => $isMajorRevision
                ? 'Hasil UAT tersimpan. Revisi mayor dicatat sebagai Change Request, proyek dikembalikan ke developer, dan UAT akan dijalankan ulang dari Tahap 1 setelah SIT ulang lulus.'
                : 'Hasil UAT tersimpan. Proyek dapat melanjutkan ke persetujuan final UAT.',
            'data' => new ProjectResource($savedProject),
            'meta' => [
                'conclusion' => $isMajorRevision ? 'major_revision' : ($summary['conclusion'] ?? null),
                'requires_development_revision' => $isMajorRevision,
                'next_uat_step' => $isMajorRevision ? 1 : 3,
            ],
        ]);
    }

    public function saveUatExecutionDraft(SaveUatExecutionDraftRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $savedProject = $this->uatExecutionService->saveDraft(
            $project,
            $request->user(),
            $request->validated()
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Draft Eksekusi UAT berhasil disimpan.',
            'data' => new ProjectResource($savedProject),
        ]);
    }

    /**
     * Putuskan (approve/reject) change request UAT — oleh PM / development_lead / super_admin / head_of_it.
     * Jika disetujui & type mayor, proyek kembali ke development dan SIT ulang.
     * Jika disetujui & type minor, status proyek tidak berubah.
     *
     * Change Request tidak lagi dapat diajukan lewat endpoint tersendiri. Pengajuan manual
     * `POST /projects/{id}/uat-change-request` sudah dihapus bersama route-nya; seluruh CR
     * sekarang lahir dari eksekusi UAT Tahap 2 lewat
     * `UatExecutionService::holdForMajorRevision()`, yang mengisi `cycle`, `source`,
     * `sourceItemId`, dan `origin` — kunci yang dibutuhkan gerbang
     * `UAT_REVISION_DEV -> SIT_IN_PROGRESS` di `ProjectWorkflowService`. Endpoint lama
     * menulis CR tanpa `cycle` sehingga gerbang itu tidak pernah melihatnya, dan
     * menyetujuinya justru memanggil `holdForMajorRevision()` yang menambahkan baris CR
     * KEDUA untuk pekerjaan yang sama.
     */
    public function uatChangeRequestDecision(DecideUatChangeRequest $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $user = $request->user();
        $roleName = $user->role?->name;

        if (! in_array($roleName, ['super_admin', 'head_of_it', 'dev_analyst', 'project_manager', 'development_lead'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak berwenang memutuskan change request UAT.',
            ], 403);
        }

        $sitData = (array) $project->sit_uat_data;
        $requests = (array) ($sitData['uat_change_requests'] ?? []);
        $found = false;
        foreach ($requests as $i => &$cr) {
            if (($cr['id'] ?? null) === $request->cr_id) {
                $cr['status'] = $request->decision;
                $cr['decisionBy'] = $user->name;
                $cr['decisionAt'] = now()->toIso8601String();
                $cr['decisionNote'] = $request->note ?? null;
                $found = true;
                $crType = $cr['type'] ?? 'minor';
                // Salinan setelah keputusan ditempelkan. `$cr` adalah variabel referensi
                // yang dibuang `unset()` di bawah, sehingga pembacaan `$cr['title']`
                // sesudah loop selama ini selalu menghasilkan string kosong tanpa galat.
                $decidedRequest = $cr;
                break;
            }
        }
        unset($cr);

        if (! $found) {
            return response()->json([
                'status' => 'error',
                'message' => 'Change request tidak ditemukan.',
            ], 404);
        }

        $sitData['uat_change_requests'] = $requests;

        // Jika disetujui → alihkan status proyek sesuai tipe change request
        $newStatus = null;
        if ($request->decision === 'approved') {
            // Revisi minor dikerjakan di UAT tanpa rollback. Hanya mayor yang kembali ke development.
            if ($crType === 'mayor') {
                $newStatus = ProjectStatus::UAT_REVISION_DEV;

                // Penahanan UAT didelegasikan ke `UatExecutionService` agar keputusan
                // Change Request Mayor dan kesimpulan Eksekusi UAT meninggalkan bentuk
                // `sit_uat_data` yang sama. Sebelumnya jalur ini menulis sendiri
                // sebagian kecil kunci dan tidak pernah mengisi `uat_hold`,
                // `sit_retest_scope`, `uat_revision_cycles`, maupun `sit_cycles`,
                // sehingga "UAT di-hold" berarti dua keadaan berbeda tergantung dari
                // pintu mana revisinya masuk — dan gerbang siklus di
                // `ProjectWorkflowService` menilai siklus yang salah.
                //
                // Keberadaan `taskId` pada CR adalah satu-satunya penanda apakah sudah
                // ada task yang bisa dibuka kembali. CR pemohon tidak membawanya, jadi
                // pekerjaannya diperlakukan seperti permintaan tambahan pada Eksekusi
                // UAT: belum ada task, sehingga CR siklusnya dibuka berstatus `open`.
                $existingTaskId = is_numeric($decidedRequest['taskId'] ?? null)
                    ? (int) $decidedRequest['taskId']
                    : null;
                $sitData = $this->uatExecutionService->holdForMajorRevision(
                    $project,
                    $user,
                    $sitData,
                    [[
                        'id' => (string) ($decidedRequest['id'] ?? $request->cr_id),
                        'source' => $existingTaskId === null ? 'additional_request' : 'scenario',
                        'title' => $decidedRequest['title'] ?? null,
                        'detail' => $decidedRequest['detail'] ?? null,
                        'taskId' => $existingTaskId,
                        'attachments' => (array) ($decidedRequest['attachments'] ?? []),
                        'newTask' => $existingTaskId === null,
                    ]],
                    now()->toIso8601String()
                );
            }

            // Riwayat revisi CR minor ditulis di sini. CR Mayor sudah dicatat
            // `holdForMajorRevision()` sebagai bagian dari satu siklus revisi, jadi
            // menambahkannya lagi hanya menggandakan barisnya.
            if ($crType !== 'mayor') {
                $revisions = (array) ($sitData['revisions'] ?? []);
                $revisions[] = [
                    'type'  => 'UAT_CHANGE_MINOR',
                    'notes' => $request->note ?? ($decidedRequest['title'] ?? 'Change Request'),
                    'at'    => now()->toIso8601String(),
                    'by'    => $user->name,
                ];
                $sitData['revisions'] = $revisions;
            }
        }

        $project->update(['sit_uat_data' => $sitData]);

        if ($newStatus) {
            $this->uatApprovalService->supersedeActiveRounds($project, 'Change Request Mayor UAT disetujui');
            try {
                $this->workflowService->transition($project, $newStatus, $user, "Change Request UAT {$request->decision}: " . ($decidedRequest['title'] ?? ''));
            } catch (\Throwable $e) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Change request disimpan, tetapi transisi status gagal: ' . $e->getMessage(),
                ], 422);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Change request UAT {$request->decision}.",
            'data' => new ProjectResource($project->fresh(['tasks.assignee', 'tasks.revisionRequester', 'teamMembers.user'])),
        ]);
    }
}
