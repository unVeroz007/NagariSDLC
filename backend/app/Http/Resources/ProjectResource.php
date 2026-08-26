<?php

namespace App\Http\Resources;

use App\Enums\TestingTrack;
use App\Models\DocumentVault;
use App\Models\ProjectReturnRound;
use App\Models\ProjectTask;
use App\Models\TestReport;
use App\Services\ReleaseReadinessService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    /**
     * Ambil catatan dari transisi status yang membawa proyek ke status saat ini.
     * Fallback: catatan transisi terbaru.
     */
    protected function latestNote(): ?string
    {
        if (! $this->relationLoaded('statusHistories') || $this->statusHistories->isEmpty()) {
            return null;
        }

        $currentStatus = $this->status instanceof \BackedEnum ? $this->status->value : $this->status;

        foreach ($this->statusHistories as $history) {
            $toStatus = $history->to_status instanceof \BackedEnum ? $history->to_status->value : $history->to_status;
            if ((string) $toStatus === (string) $currentStatus && $history->notes) {
                return $history->notes;
            }
        }

        return $this->statusHistories->first()?->notes;
    }

    /**
     * Laporan pengujian terakhir satu jalur, siap dibaca layar Lead.
     *
     * Sengaja hanya dibangun dari relasi yang sudah dimuat. Membiarkan Eloquent
     * memuatnya sendiri akan menghasilkan satu query tambahan per proyek pada daftar
     * proyek — persis pola N+1 yang paling mudah lolos dari pengujian manual karena
     * tetap menghasilkan data yang benar.
     */
    protected function trackReport(TestingTrack $track, Request $request): ?array
    {
        if (! $this->relationLoaded('testReports')) {
            return null;
        }

        /** @var TestReport|null $report */
        $report = $this->testReports
            ->where('test_type', $track->value)
            ->sortByDesc('id')
            ->first();

        if (! $report) {
            return null;
        }

        $checklist = (array) ($report->checklist ?? []);
        $checkedCount = count(array_filter($checklist, static fn ($value): bool => $value === true));
        $result = $report->result;
        $reviewedResult = $report->reviewed_result;

        return [
            'id' => $report->id,
            'test_type' => $report->test_type,

            // Penilaian pelaksana pengujian.
            'result' => $result?->value,
            'result_label' => $result?->label(),
            'is_pass' => $result?->isPass() ?? false,
            'severity' => $report->severity,
            'notes' => $report->notes,

            // Cakupan pengujian versi baru: tulisan penguji sendiri.
            'tested_scenarios' => $report->tested_scenarios,

            // Bentuk warisan, hanya terisi pada laporan sebelum cakupan pengujian
            // diubah menjadi catatan bebas.
            'checklist' => $checklist,
            'checklist_summary' => $checklist === []
                ? null
                : "{$checkedCount}/" . count($checklist) . ' skenario dicentang',
            'tester_id' => $report->tester_id,
            'tester_name' => $report->tester?->name,
            'submitted_at' => $report->created_at?->toIso8601String(),

            // Keputusan Lead — kosong selama jalur masih menunggu sign-off.
            'is_reviewed' => $report->isReviewed(),
            'reviewed_result' => $reviewedResult?->value,
            'reviewed_result_label' => $reviewedResult?->label(),
            'review_notes' => $report->review_notes,
            'reviewer_name' => $report->reviewer?->name,
            'reviewed_at' => $report->reviewed_at?->toIso8601String(),

            'attachment_url' => $report->attachment_url,
            'evidence' => $this->trackReportEvidence($report, $request),
        ];
    }

    /**
     * Berkas bukti laporan, dihidrasi dari dokumen proyek yang sudah dimuat.
     *
     * Ikut disaring `DocumentVault::isVisibleTo()` dengan alasan yang sama seperti
     * daftar dokumen proyek: bukti pengujian QA dan audit keamanan siber bukan
     * bacaan pemohon. Tanpa penyaring ini nama berkas temuannya tetap tampil di
     * kartu laporan meskipun daftar dokumen utamanya sudah dibatasi.
     *
     * @return list<array<string, mixed>>
     */
    protected function trackReportEvidence(TestReport $report, Request $request): array
    {
        $documentIds = $report->evidenceDocumentIdList();

        if ($documentIds === [] || ! $this->relationLoaded('documents')) {
            return [];
        }

        $viewer = $request->user();

        return $this->documents
            ->whereIn('id', $documentIds)
            ->filter(fn (DocumentVault $document): bool => $document->isVisibleTo($viewer))
            ->map(fn (DocumentVault $document): array => [
                'id' => $document->id,
                'file_name' => $document->file_name,
                'original_filename' => $document->original_filename,
                'document_type' => $document->document_type,
                'file_size' => $document->file_size,
                'mime_type' => $document->mime_type,
                'created_at' => $document->created_at?->toIso8601String(),
                'author' => $document->uploader?->name,
            ])
            ->values()
            ->all();
    }

    /**
     * Riwayat putaran pengembalian proyek dari jalur pengujian ke pengembangan.
     *
     * Bentuknya lengkap dengan sendirinya: tiap putaran membawa sisi pengujian (siapa
     * mengembalikan, pesannya, tingkat keparahannya), daftar task perbaikannya, dan
     * VERDIKT GERBANG pengajuan ulang beserta alasannya.
     *
     * Verdikt itu sengaja dihitung di server. Aturannya milik
     * `ProjectReturnRoundService::assertResubmitAllowed()`; bila layar menghitungnya
     * sendiri, tombol "Ajukan Ulang" dan penolakan server akan berbeda pendapat setiap
     * kali aturannya diubah di salah satu sisi saja.
     *
     * Task perbaikan disaring dari relasi `tasks` yang sudah dimuat, bukan dari
     * `returnRounds.tasks`. Keduanya menghasilkan daftar yang sama, tetapi memuat lewat
     * relasi putaran berarti satu proyek memuat task-nya dua kali pada tiap permintaan
     * daftar proyek.
     *
     * @return list<array<string, mixed>>
     */
    protected function returnRoundHistory(): array
    {
        if (! $this->relationLoaded('returnRounds')) {
            return [];
        }

        $tasksLoaded = $this->relationLoaded('tasks');

        return $this->returnRounds
            ->map(function (ProjectReturnRound $round) use ($tasksLoaded): array {
                $status = $round->roundStatus();
                $fixTasks = $tasksLoaded
                    ? $this->tasks->where('return_round_id', $round->id)->values()
                    : collect();

                $blockingTasks = $fixTasks->reject(function (ProjectTask $task): bool {
                    $taskStatus = $task->status instanceof \BackedEnum
                        ? $task->status->value
                        : (string) $task->status;

                    return in_array($taskStatus, ProjectReturnRound::NON_BLOCKING_TASK_STATUSES, true);
                });
                $unassignedTasks = $fixTasks->whereNull('assignee_id');

                return [
                    'id' => $round->id,
                    'track' => $round->track->value,
                    'track_label' => $round->track->label(),
                    'round_number' => $round->round_number,
                    'round_label' => $round->roundLabel(),

                    'status' => $status->value,
                    'status_label' => $status->label(),
                    'is_open' => $status->isOpen(),

                    // Sisi pengujian — ditulis sekali saat pengembalian, tidak berubah.
                    'test_report_id' => $round->test_report_id,
                    'returned_by' => $round->returned_by,
                    'returned_by_name' => $round->returnedBy?->name,
                    'returned_at' => $round->returned_at?->toIso8601String(),
                    'lead_notes' => $round->lead_notes,
                    'severity' => $round->severity,

                    // Sisi pengembangan — terisi saat PM mengajukan jalurnya kembali.
                    'resubmitted_by' => $round->resubmitted_by,
                    'resubmitted_by_name' => $round->resubmittedBy?->name,
                    'resubmitted_at' => $round->resubmitted_at?->toIso8601String(),
                    'resubmit_notes' => $round->resubmit_notes,

                    'fix_tasks' => $fixTasks
                        ->map(fn (ProjectTask $task): array => [
                            'id' => $task->id,
                            'title' => $task->title,
                            'status' => $task->status instanceof \BackedEnum
                                ? $task->status->value
                                : $task->status,
                            'priority' => $task->priority ?? 'Medium',
                            'assignee_id' => $task->assignee_id,
                            'assignee' => $task->assignee?->name,
                            'due_date' => $task->due_date?->format('Y-m-d'),
                        ])
                        ->all(),
                    'fix_task_summary' => [
                        'total' => $fixTasks->count(),
                        'blocking' => $blockingTasks->count(),
                        'unassigned' => $unassignedTasks->count(),
                    ],

                    // Cermin `ProjectReturnRoundService::assertResubmitAllowed()`.
                    'can_resubmit' => $status->isOpen()
                        && $fixTasks->isNotEmpty()
                        && $unassignedTasks->isEmpty()
                        && $blockingTasks->isEmpty(),
                    'resubmit_blocker' => match (true) {
                        ! $status->isOpen() => null,
                        ! $tasksLoaded => 'Daftar task perbaikan belum dimuat.',
                        $fixTasks->isEmpty() => 'Belum ada task perbaikan atas temuan yang dikembalikan.',
                        $unassignedTasks->isNotEmpty() => $unassignedTasks->count() . ' task perbaikan belum memiliki penerima.',
                        $blockingTasks->isNotEmpty() => $blockingTasks->count() . ' task perbaikan belum selesai.',
                        default => null,
                    },
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Pengajuan rilis terakhir proyek ini, bila relasinya sudah dimuat.
     *
     * Diambil yang terbaru karena satu proyek dapat memiliki lebih dari satu
     * pengajuan: rilis yang ditolak Head of IT meninggalkan barisnya sebagai
     * riwayat, lalu PM mengajukan ulang dengan rencana yang diperbaiki.
     *
     * @return array<string, mixed>|null
     */
    protected function latestReleaseRequest(Request $request): ?array
    {
        if (! $this->relationLoaded('releaseRequests')) {
            return null;
        }

        $release = $this->releaseRequests->sortByDesc('id')->first();

        return $release === null
            ? null
            : (new ReleaseRequestResource($release))->toArray($request);
    }

    /**
     * Penilaian kelayakan go-live empat pilar dari data tersimpan.
     *
     * Hanya dihitung ketika ketiga sumbernya sudah dimuat. Menghitungnya dengan
     * relasi setengah dimuat akan menghasilkan kesimpulan "belum ada dokumen" atau
     * "belum ada laporan" yang keliru — kesalahan yang lebih berbahaya daripada
     * tidak menampilkan penilaian sama sekali, karena tampak seperti fakta.
     *
     * @return array<string, mixed>|null
     */
    protected function releaseReadiness(): ?array
    {
        $requiredRelations = ['documents', 'testReports', 'releaseRequests'];

        foreach ($requiredRelations as $relation) {
            if (! $this->relationLoaded($relation)) {
                return null;
            }
        }

        return app(ReleaseReadinessService::class)->evaluate($this->resource);
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'req_id' => $this->req_id,
            'title' => $this->title,
            'description' => $this->description,
            'contact_phone' => $this->contact_phone,
            'type' => $this->type ?? 'RBB',
            'project_type' => $this->project_type ?? 'baru',
            // Prioritas pilihan pengaju. Diteruskan apa adanya, tanpa fallback: kolomnya
            // sudah punya default `Medium` di database, jadi satu-satunya cara nilai ini
            // kosong adalah bila seseorang menuliskannya kosong. Menambahkan `?? 'Medium'`
            // di sini hanya akan menyembunyikan kejadian itu.
            'priority' => $this->priority,
            'status' => $this->status instanceof \BackedEnum ? $this->status->value : $this->status,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'creator_id' => $this->created_by,
            'pm' => new UserResource($this->whenLoaded('pm')),
            'pm_id' => $this->pm_id,
            'analyst' => new UserResource($this->whenLoaded('analyst')),
            'analyst_id' => $this->analyst_id,
            'division' => $this->division?->name ?? null,
            'division_detail' => $this->division ? [
                'id'   => $this->division->id,
                'code' => $this->division->code,
                'name' => $this->division->name,
            ] : null,
            'target_date' => $this->target_date?->format('Y-m-d'),
            // Tenggat RBB dipaparkan dalam dua gaya penamaan, sama seperti
            // `analyst_result`/`analystResult` di bawah. `rbbDeadline` adalah yang
            // dibaca frontend (17 tempat, mis. panel "Proyek RBB mendekati deadline" di
            // `Dashboard.jsx`), dan formatnya wajib `Y-m-d` persis seperti
            // `target_date`: pembacanya memanggil `new Date(...)` langsung atas nilai
            // ini, jadi format lain akan menghasilkan `Invalid Date`.
            'rbbDeadline' => $this->rbb_deadline?->format('Y-m-d'),
            'rbb_deadline' => $this->rbb_deadline?->format('Y-m-d'),
            'current_stage_deadline' => $this->current_stage_deadline?->format('Y-m-d'),
            'deadline' => $this->current_stage_deadline?->format('Y-m-d'),
            'rejection_reason' => $this->rejection_reason,
            'uat_notes' => $this->uat_notes,
            'analystResult' => $this->analyst_result,
            'analyst_result' => $this->analyst_result,
            'analyst_docs' => $this->analyst_result['uploadedDocs'] ?? [],
            'devAnalystResult' => $this->dev_analyst_result,
            'dev_analyst_result' => $this->dev_analyst_result,
            'staging_url' => $this->staging_url,
            'sit_uat_data' => self::normalizeSitUatData($this->sit_uat_data),
            'qa_status' => $this->qa_status ?? 'NOT_SUBMITTED',
            'cyber_status' => $this->cyber_status ?? 'NOT_SUBMITTED',

            // Penugasan pelaksana dua jalur pengujian.
            //
            // Nama dipaparkan sebagai string datar karena itulah yang dipakai daftar
            // dan penyaring di layar Lead; `*_detail` menyertakan identitasnya untuk
            // pembanding yang butuh ID, mis. daftar tugas milik tester sendiri.
            'qa_assignee_id' => $this->qa_assignee_id,
            'qa_assignee' => $this->relationLoaded('qaAssignee') ? $this->qaAssignee?->name : null,
            'qa_assignee_detail' => $this->relationLoaded('qaAssignee') && $this->qaAssignee ? [
                'id' => $this->qaAssignee->id,
                'name' => $this->qaAssignee->name,
                'email' => $this->qaAssignee->email,
            ] : null,
            'cyber_assignee_id' => $this->cyber_assignee_id,
            'cyber_assignee' => $this->relationLoaded('cyberAssignee') ? $this->cyberAssignee?->name : null,
            'cyber_assignee_detail' => $this->relationLoaded('cyberAssignee') && $this->cyberAssignee ? [
                'id' => $this->cyberAssignee->id,
                'name' => $this->cyberAssignee->name,
                'email' => $this->cyberAssignee->email,
            ] : null,

            // Jenis pemeriksaan Audit Keamanan Siber pilihan PM beserta masukannya.
            'cyber_check_type' => $this->cyberCheckTypeValue()?->value,
            'cyber_check_type_label' => $this->cyberCheckTypeValue()?->label(),
            'cyber_target_url' => $this->cyber_target_url,
            'cyber_source_code_ref' => $this->cyber_source_code_ref,

            // Laporan pengujian terakhir per jalur. Kunci lama `testerResult` dan
            // `auditorResult` dipertahankan sebagai alias supaya layar yang masih
            // membacanya tidak putus, tetapi keduanya sekarang bersumber dari baris
            // `test_reports` yang tersimpan — bukan lagi dari payload titipan klien
            // yang selalu dibuang controller.
            'qa_report' => $this->trackReport(TestingTrack::QA, $request),
            'cyber_report' => $this->trackReport(TestingTrack::CYBER, $request),
            'testerResult' => $this->trackReport(TestingTrack::QA, $request),
            'auditorResult' => $this->trackReport(TestingTrack::CYBER, $request),

            'team_allocated_by_pm' => $this->team_allocated_by_pm ?? false,
            'latest_note' => $this->latestNote(),

            // Pengajuan rilis terakhir beserta rencana downtime dan rollback-nya.
            'release_request' => $this->latestReleaseRequest($request),

            // Penilaian empat pilar kelayakan go-live. Bernilai null bila relasi
            // pendukungnya tidak dimuat, supaya layar tidak pernah menyimpulkan
            // "belum ada" dari data yang sekadar belum diambil.
            'release_readiness' => $this->releaseReadiness(),


            'team' => $this->relationLoaded('teamMembers') && $this->teamMembers ? $this->teamMembers->map(function($m) {
                return [
                    'id' => $m->id,
                    'user_id' => $m->user_id,
                    'name' => $m->user?->name ?? 'Developer',
                    'email' => $m->user?->email,
                    'role' => $m->role_in_project,
                    // Role global penggunanya, di samping `role` yang merupakan teks
                    // bebas jabatan dalam proyek ("Backend", "Frontend", …). Layar yang
                    // perlu tahu siapa developer — mis. daftar penyetuju SIT — wajib
                    // memakai nilai ini, bukan menebak dari teks bebas di atasnya.
                    'user_role' => $m->user?->role?->name,
                    'assigned_by' => $m->assigned_by ?? 'lead',
                ];
            }) : [],
            'tasks' => $this->whenLoaded('tasks', function () {
                return $this->tasks->map(function ($t) {
                    return [
                        'id' => $t->id,
                        'name' => $t->title,
                        'title' => $t->title,
                        'description' => $t->description,
                        'assignee_id' => $t->assignee_id,
                        'assignee' => $t->assignee?->name,
                        'assignee_detail' => $t->assignee ? [
                            'id' => $t->assignee->id,
                            'name' => $t->assignee->name,
                            'email' => $t->assignee->email,
                        ] : null,
                        'status' => $t->status instanceof \BackedEnum ? $t->status->value : $t->status,
                        'deadline' => $t->due_date?->format('Y-m-d'),
                        'due_date' => $t->due_date?->format('Y-m-d'),
                        'priority' => $t->priority ?? 'Medium',
                        'revision_note' => $t->revision_note,
                        'revision_requested_at' => $t->revision_requested_at?->toIso8601String(),
                        'revision_requested_by' => $t->revisionRequester?->name,
                        // Penanda asal task perbaikan. Layar Manajemen Task memakainya
                        // untuk menandai task yang lahir dari pengembalian QA / Siber,
                        // supaya task itu tidak terbaca sebagai pekerjaan biasa.
                        'return_round_id' => $t->return_round_id,
                        'created_at' => $t->created_at?->toIso8601String(),
                    ];
                });
            }) ?? [],
            /*
             * Daftar dokumen proyek, disaring menurut hak baca pengguna.
             *
             * Sebelumnya seluruh baris Document Vault yang termuat dikirim apa adanya,
             * sehingga pemohon (`business_user`) menerima FSD, arsitektur, rencana dan
             * bukti SIT, laporan QA, laporan audit keamanan siber, hingga rencana rilis
             * — lengkap dengan `file_path`-nya. Penyaringnya sekarang `DocumentVault`
             * sendiri (lihat `REQUESTER_VISIBLE_TYPES`), sumber kebenaran yang sama
             * dengan `DocumentController::index()` dan `::download()`.
             */
            'documents' => $this->whenLoaded('documents', function () use ($request) {
                $viewer = $request->user();

                return $this->documents
                    ->filter(fn (DocumentVault $d): bool => $d->isVisibleTo($viewer))
                    ->map(function (DocumentVault $d) {
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
                    })
                    // Kunci hasil `filter()` tetap indeks aslinya, dan array PHP dengan
                    // kunci berlubang di-encode menjadi object, bukan array JSON.
                    ->values();
            }) ?? [],
            'status_histories' => ProjectStatusHistoryResource::collection($this->whenLoaded('statusHistories')),
            // Riwayat pengembalian QA / Keamanan Siber. Selalu berupa array (kosong bila
            // relasinya belum dimuat) agar layar tidak perlu membedakan "belum dimuat"
            // dari "tidak pernah dikembalikan".
            'return_rounds' => $this->returnRoundHistory(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Normalisasi sit_uat_data agar integer keys (mis. task id pada sit2_task_approvals)
     * tetap menjadi OBJECT saat di-encode ke JSON (bukan berubah menjadi array).
     */
    public static function normalizeSitUatData(?array $sitUat): ?array
    {
        if (! $sitUat) return $sitUat;

        // sit2_task_approvals: pastikan key task id menjadi STRING non-numeric
        // dengan prefix "task_" agar PHP json_encode selalu menghasilkan OBJECT,
        // bukan array (PHP me-cast numeric string key ke integer).
        if (isset($sitUat['sit2_task_approvals']) && is_array($sitUat['sit2_task_approvals'])) {
            $normalized = [];
            foreach ($sitUat['sit2_task_approvals'] as $k => $v) {
                $normalized['task_' . $k] = $v;
            }
            $sitUat['sit2_task_approvals'] = $normalized;
        }

        // Catatan: sit3_approvals & uat3_approvals memakai key string (developer/pm/...)
        // sehingga tidak perlu prefix — PHP json_encode sudah menghasilkan object.

        return $sitUat;
    }
}
