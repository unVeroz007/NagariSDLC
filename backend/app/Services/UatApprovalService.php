<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\UatApprovalRole;
use App\Enums\UatApprovalRoundStatus;
use App\Enums\UatApprovalStatus;
use App\Enums\UatApproverMode;
use App\Models\ActivityLog;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\UatApprovalRound;
use App\Models\UatApprover;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UatApprovalService
{
    private const REQUIRED_SINGLE_ROLES = [
        UatApprovalRole::REQUESTER,
        UatApprovalRole::REQUESTER_GROUP_LEAD,
        UatApprovalRole::REQUESTER_DIVISION_LEAD,
        UatApprovalRole::ANALYST_PM,
        UatApprovalRole::DEVELOPMENT_GROUP_LEAD,
        UatApprovalRole::TECHNOLOGY_DIVISION_LEAD,
    ];

    /**
     * Satu inbox lintas proyek untuk seluruh approval UAT internal milik user.
     * Hanya putaran aktif yang ditampilkan supaya assignment lama tidak kembali
     * muncul sebagai pekerjaan yang harus dilakukan.
     */
    public function myInternalAssignments(User $user): array
    {
        $assignments = UatApprover::query()
            ->with(['round.project.division'])
            ->where('user_id', $user->id)
            ->where('approval_mode', UatApproverMode::INTERNAL_ACCOUNT->value)
            ->where('status', '!=', UatApprovalStatus::REVOKED->value)
            ->whereHas('round', fn ($query) => $query->where('status', UatApprovalRoundStatus::ACTIVE->value))
            ->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', [UatApprovalStatus::PENDING->value])
            ->orderByDesc('id')
            ->get();

        return [
            'pending_count' => $assignments->filter(
                fn (UatApprover $approver): bool => $approver->status === UatApprovalStatus::PENDING
            )->count(),
            'items' => $assignments->map(function (UatApprover $approver): array {
                $project = $approver->round->project;
                $data = (array) $project->sit_uat_data;

                return [
                    'id' => $approver->id,
                    'status' => $approver->status->value,
                    'approval_role' => $approver->approval_role->value,
                    'approval_role_label' => $approver->approval_role->label(),
                    'position' => $approver->position,
                    'decision_note' => $approver->decision_note,
                    'decided_at' => $approver->decided_at?->toIso8601String(),
                    'round' => [
                        'number' => $approver->round->round_number,
                        'opened_at' => $approver->round->opened_at?->toIso8601String(),
                    ],
                    'project' => [
                        'id' => $project->id,
                        'req_id' => $project->req_id,
                        'title' => $project->title,
                        'description' => $project->description,
                        'status' => $project->status instanceof ProjectStatus ? $project->status->value : (string) $project->status,
                        'division' => $project->division?->name,
                        'uat_date' => $data['uat1_startDate'] ?? null,
                    ],
                    'summary' => $data['uat2_summary'] ?? null,
                ];
            })->values()->all(),
        ];
    }

    public function startNewRound(Project $project, User $actor, string $reason = 'Hasil UAT siap disetujui'): UatApprovalRound
    {
        return DB::transaction(function () use ($project, $actor, $reason): UatApprovalRound {
            $project->refresh();
            $status = $project->status instanceof ProjectStatus ? $project->status->value : (string) $project->status;
            $uatData = (array) $project->sit_uat_data;
            if ($status !== ProjectStatus::UAT_IN_PROGRESS->value
                || (int) ($uatData['activeUatStep'] ?? 1) < 3
                || empty($uatData['uat2_summary']['conclusion'] ?? null)
                || ($uatData['uat2_resume_after_sit'] ?? false) === true
                || ($uatData['uat2_verification_mode'] ?? false) === true) {
                throw ValidationException::withMessages([
                    'project' => 'Putaran approval hanya dapat dibuat setelah hasil UAT final dan seluruh revisi Mayor selesai.',
                ]);
            }
            $participants = collect((array) data_get($project->sit_uat_data, 'uat1_participants', []))
                ->filter(fn ($participant): bool => is_array($participant) && ($participant['isApprover'] ?? false) === true)
                ->values();

            $this->validateParticipants($project, $participants->all());

            UatApprovalRound::query()
                ->where('project_id', $project->id)
                ->whereIn('status', [
                    UatApprovalRoundStatus::ACTIVE->value,
                    UatApprovalRoundStatus::COMPLETED->value,
                ])
                ->lockForUpdate()
                ->get()
                ->each(function (UatApprovalRound $round) use ($reason): void {
                    $this->supersedeRound($round, $reason);
                });

            $roundNumber = ((int) UatApprovalRound::query()
                ->where('project_id', $project->id)
                ->lockForUpdate()
                ->max('round_number')) + 1;
            $round = UatApprovalRound::create([
                'project_id' => $project->id,
                'round_number' => $roundNumber,
                'status' => UatApprovalRoundStatus::ACTIVE,
                'opened_by' => $actor->id,
                'opened_at' => now(),
            ]);

            foreach ($participants as $participant) {
                $round->approvers()->create($this->approverAttributes($participant));
            }

            $this->log($actor, $project, 'uat_approval_round_opened', 'Membuka Putaran Persetujuan UAT',
                "{$actor->name} membuka putaran persetujuan UAT ke-{$roundNumber}.",
                ['round' => $roundNumber, 'approver_count' => $participants->count()]);

            return $round->load('approvers.user');
        });
    }

    public function activeMatrix(Project $project): ?array
    {
        $round = UatApprovalRound::query()
            ->with('approvers.user')
            ->where('project_id', $project->id)
            ->whereIn('status', [
                UatApprovalRoundStatus::ACTIVE->value,
                UatApprovalRoundStatus::COMPLETED->value,
            ])
            ->latest('round_number')
            ->first();

        if (! $round) {
            return null;
        }

        $matrix = $this->serializeRound($round);
        $currentParticipantKeys = collect((array) data_get($project->sit_uat_data, 'uat1_participants', []))
            ->filter(fn ($participant): bool => is_array($participant) && ($participant['isApprover'] ?? false) === true)
            ->pluck('id')
            ->filter()
            ->map(fn ($key): string => (string) $key)
            ->sort()
            ->values();
        $roundParticipantKeys = $round->approvers
            ->reject(fn (UatApprover $approver): bool => $approver->status === UatApprovalStatus::REVOKED)
            ->pluck('participant_key')
            ->map(fn ($key): string => (string) $key)
            ->sort()
            ->values();
        $matrix['is_out_of_sync'] = $currentParticipantKeys->all() !== $roundParticipantKeys->all();

        return $matrix;
    }

    public function syncActiveRound(Project $project, User $actor): array
    {
        $this->assertManageable($project, $actor);

        return DB::transaction(function () use ($project, $actor): array {
            $project->refresh();
            $participants = collect((array) data_get($project->sit_uat_data, 'uat1_participants', []))
                ->filter(fn ($participant): bool => is_array($participant) && ($participant['isApprover'] ?? false) === true)
                ->values();
            $this->validateParticipants($project, $participants->all());

            $round = UatApprovalRound::query()
                ->with('approvers.user')
                ->where('project_id', $project->id)
                ->where('status', UatApprovalRoundStatus::ACTIVE->value)
                ->lockForUpdate()
                ->latest('round_number')
                ->firstOrFail();
            $targetByKey = $participants->keyBy(fn ($participant) => (string) ($participant['id'] ?? ''));

            foreach ($round->approvers->where('status', '!=', UatApprovalStatus::REVOKED) as $existing) {
                $participant = $targetByKey->get($existing->participant_key);
                if (! $participant) {
                    if ($existing->status !== UatApprovalStatus::PENDING) {
                        throw ValidationException::withMessages([
                            'participants' => "{$existing->name} sudah memberikan keputusan. Buat putaran baru untuk mengubah approver ini.",
                        ]);
                    }
                    $this->revokeApprover($existing);
                    continue;
                }

                $attributes = $this->approverAttributes($participant, $existing->participant_key);
                $identityChanged = (int) ($attributes['user_id'] ?? 0) !== (int) ($existing->user_id ?? 0)
                    || $attributes['approval_role'] !== $existing->approval_role
                    || $attributes['approval_mode'] !== $existing->approval_mode;
                if ($identityChanged && $existing->status !== UatApprovalStatus::PENDING) {
                    throw ValidationException::withMessages([
                        'participants' => "Identitas {$existing->name} sudah memiliki keputusan. Buat putaran baru untuk menggantinya.",
                    ]);
                }
                if ($existing->status === UatApprovalStatus::PENDING) {
                    unset($attributes['status']);
                    $existing->update($attributes);
                }
            }

            $existingByKey = $round->approvers->keyBy('participant_key');
            foreach ($participants as $participant) {
                $participantKey = (string) ($participant['id'] ?? '');
                $existing = $existingByKey->get($participantKey);
                if (! $existing) {
                    $round->approvers()->create($this->approverAttributes($participant, $participantKey));
                } elseif ($existing->status === UatApprovalStatus::REVOKED) {
                    $existing->update($this->approverAttributes($participant, $participantKey));
                }
            }

            $this->refreshRoundCompletion($round);
            $this->log($actor, $project, 'uat_approval_round_synced', 'Sinkronisasi Approver UAT',
                "{$actor->name} menyinkronkan putaran approval UAT dengan peserta terbaru.",
                ['round' => $round->round_number]);

            return $this->serializeRound($round->fresh('approvers.user'));
        });
    }

    public function generateExternalLink(Project $project, UatApprover $approver, User $actor): array
    {
        $round = $approver->round;
        $this->assertManageable($project, $actor);
        $this->assertActiveApprover($project, $approver);
        if ($approver->approval_mode !== UatApproverMode::EXTERNAL_LINK) {
            throw ValidationException::withMessages(['approver' => 'Link hanya tersedia untuk approver eksternal.']);
        }
        if ($approver->status !== UatApprovalStatus::PENDING) {
            throw ValidationException::withMessages(['approver' => 'Link tidak dapat dibuat setelah keputusan diberikan.']);
        }

        $token = Str::random(80);
        $approver->update([
            'link_token_hash' => hash('sha256', $token),
            'link_expires_at' => now()->addDays(7),
            'link_opened_at' => null,
            'access_token_hash' => null,
            'access_expires_at' => null,
            'verification_attempts' => 0,
            'verification_locked_until' => null,
            'verified_at' => null,
        ]);

        $this->log($actor, $project, 'uat_external_link_generated', 'Membuat Link Persetujuan UAT',
            "{$actor->name} membuat link pribadi untuk {$approver->name}.",
            ['round' => $round->round_number, 'approver_id' => $approver->id]);

        return [
            'token' => $token,
            'expires_at' => $approver->link_expires_at?->toIso8601String(),
        ];
    }

    public function publicPreview(string $token): array
    {
        $approver = $this->approverFromLink($token);
        if (! $approver->link_opened_at) {
            $approver->update(['link_opened_at' => now()]);
        }

        return [
            'approver_name' => $approver->name,
            'position' => $approver->position,
            'unit' => $approver->unit,
            'phone_masked' => $approver->phone_masked,
            'project_title' => $approver->round->project->title,
            'project_req_id' => $approver->round->project->req_id,
            'round_number' => $approver->round->round_number,
            'status' => $approver->status->value,
            'expires_at' => $approver->link_expires_at?->toIso8601String(),
        ];
    }

    public function verifyPhone(string $token, string $phone): array
    {
        return DB::transaction(function () use ($token, $phone): array {
            $approver = $this->approverFromLink($token, true);
            if ($approver->verification_locked_until?->isFuture()) {
                throw ValidationException::withMessages([
                    'phone' => 'Terlalu banyak percobaan. Silakan coba kembali beberapa menit lagi.',
                ]);
            }

            $matches = hash_equals((string) $approver->phone_hash, $this->phoneHash($this->normalizePhone($phone)));
            if (! $matches) {
                $attempts = $approver->verification_attempts + 1;
                $approver->update([
                    'verification_attempts' => $attempts >= 5 ? 0 : $attempts,
                    'verification_locked_until' => $attempts >= 5 ? now()->addMinutes(15) : null,
                ]);
                throw ValidationException::withMessages(['phone' => 'Data verifikasi tidak sesuai.']);
            }

            $accessToken = Str::random(80);
            $approver->update([
                'access_token_hash' => hash('sha256', $accessToken),
                'access_expires_at' => now()->addMinutes(30),
                'verification_attempts' => 0,
                'verification_locked_until' => null,
                'verified_at' => now(),
            ]);

            return [
                'access_token' => $accessToken,
                'expires_at' => $approver->access_expires_at?->toIso8601String(),
            ];
        });
    }

    public function publicDetail(string $token, string $accessToken): array
    {
        $approver = $this->authenticatedExternalApprover($token, $accessToken);
        $project = $approver->round->project;
        $data = (array) $project->sit_uat_data;

        return [
            'approver' => $this->serializeApprover($approver),
            'project' => [
                'req_id' => $project->req_id,
                'title' => $project->title,
                'description' => $project->description,
                'division' => $project->division?->name,
                'uat_date' => $data['uat1_startDate'] ?? null,
                'unit' => $data['uat1_unit'] ?? null,
            ],
            'summary' => $data['uat2_summary'] ?? null,
            'scenarios' => $data['uat2_scenarios'] ?? [],
            'additional_requests' => $data['uat2_additional_requests'] ?? [],
            'documents' => $this->publicDocuments($project, $data),
            'round' => [
                'round_number' => $approver->round->round_number,
                'approved_count' => $approver->round->approvers->where('status', UatApprovalStatus::APPROVED)->count(),
                'required_count' => $approver->round->approvers->where('status', '!=', UatApprovalStatus::REVOKED)->count(),
            ],
        ];
    }

    public function decideExternal(string $token, string $accessToken, string $decision, ?string $note, Request $request): array
    {
        $approver = $this->authenticatedExternalApprover($token, $accessToken);
        $this->recordDecision($approver, $decision, $note, $request);

        return $this->serializeApprover($approver->fresh());
    }

    public function decideInternal(Project $project, UatApprover $approver, User $actor, string $decision, ?string $note, Request $request): array
    {
        $this->assertActiveApprover($project, $approver);
        if ($approver->approval_mode !== UatApproverMode::INTERNAL_ACCOUNT || (int) $approver->user_id !== (int) $actor->id) {
            throw ValidationException::withMessages(['approver' => 'Approval ini tidak ditugaskan kepada akun Anda.']);
        }
        $this->recordDecision($approver, $decision, $note, $request);
        $this->log($actor, $project, 'uat_internal_decision', 'Keputusan Persetujuan UAT',
            "{$actor->name} memberikan keputusan {$decision} untuk UAT.",
            ['round' => $approver->round->round_number, 'approver_id' => $approver->id, 'decision' => $decision]);

        return $this->serializeApprover($approver->fresh());
    }

    public function downloadExternalDocument(string $token, string $accessToken, DocumentVault $document): DocumentVault
    {
        $approver = $this->authenticatedExternalApprover($token, $accessToken);
        $project = $approver->round->project;
        if ((int) $document->project_id !== (int) $project->id) {
            abort(404);
        }
        $allowedIds = collect($this->publicDocuments($project, (array) $project->sit_uat_data))->pluck('id');
        if (! $allowedIds->contains((int) $document->id)) {
            abort(403, 'Dokumen tidak tersedia untuk approver ini.');
        }

        return $document;
    }

    public function allRequiredApproved(Project $project): bool
    {
        $round = UatApprovalRound::query()
            ->with('approvers')
            ->where('project_id', $project->id)
            ->whereIn('status', [
                UatApprovalRoundStatus::ACTIVE->value,
                UatApprovalRoundStatus::COMPLETED->value,
            ])
            ->latest('round_number')
            ->first();

        $requiredApprovers = $round?->approvers
            ->reject(fn (UatApprover $approver): bool => $approver->status === UatApprovalStatus::REVOKED);

        return $requiredApprovers?->isNotEmpty() === true
            && $requiredApprovers->every(fn (UatApprover $approver): bool => $approver->status === UatApprovalStatus::APPROVED);
    }

    public function supersedeActiveRounds(Project $project, string $reason): void
    {
        UatApprovalRound::query()
            ->where('project_id', $project->id)
            ->whereIn('status', [
                UatApprovalRoundStatus::ACTIVE->value,
                UatApprovalRoundStatus::COMPLETED->value,
            ])
            ->get()
            ->each(fn (UatApprovalRound $round) => $this->supersedeRound($round, $reason));
    }

    private function validateParticipants(Project $project, array $participants): void
    {
        $errors = [];
        $roles = collect($participants)->pluck('approvalRole');
        $projectDeveloperIds = $project->tasks()
            ->whereNotNull('assignee_id')
            ->pluck('assignee_id')
            ->map(fn ($id) => (int) $id)
            ->unique();
        foreach (self::REQUIRED_SINGLE_ROLES as $role) {
            $count = $roles->filter(fn ($value) => $value === $role->value)->count();
            if ($count !== 1) {
                $errors['participants'][] = "{$role->label()} wajib ditetapkan tepat satu orang.";
            }
        }
        if ($roles->filter(fn ($value) => $value === UatApprovalRole::DEVELOPER->value)->isEmpty()) {
            $errors['participants'][] = 'Minimal satu Developer wajib ditetapkan sebagai approver.';
        }

        $seenUsers = [];
        foreach ($participants as $index => $participant) {
            $prefix = "participants.{$index}";
            if (blank($participant['name'] ?? null)) $errors[$prefix.'.name'][] = 'Nama approver wajib diisi.';
            try {
                $role = UatApprovalRole::from((string) ($participant['approvalRole'] ?? ''));
                $mode = UatApproverMode::from((string) ($participant['approvalMode'] ?? ''));
            } catch (\ValueError) {
                $errors[$prefix][] = 'Jenis atau metode approval tidak valid.';
                continue;
            }
            if ($role->side() === 'requester' && $mode !== UatApproverMode::EXTERNAL_LINK) {
                $errors[$prefix.'.approvalMode'][] = 'Pihak peminta menggunakan link approval eksternal.';
            }
            if ($role->side() === 'it' && $mode !== UatApproverMode::INTERNAL_ACCOUNT) {
                $errors[$prefix.'.approvalMode'][] = 'Pihak IT wajib menggunakan akun internal.';
            }
            if ($mode === UatApproverMode::EXTERNAL_LINK) {
                try { $this->normalizePhone((string) ($participant['phone'] ?? '')); }
                catch (ValidationException) {
                    $participantName = trim((string) ($participant['name'] ?? '')) ?: 'peserta ke-'.($index + 1);
                    $errors[$prefix.'.phone'][] = "Nomor HP {$participantName} tidak valid. Gunakan format 08... atau +62...";
                }
            } else {
                $userId = (int) ($participant['userId'] ?? 0);
                if (! $userId || ! User::query()->whereKey($userId)->where('is_active', true)->exists()) {
                    $errors[$prefix.'.userId'][] = 'Approver internal wajib terhubung ke akun aktif.';
                } elseif (isset($seenUsers[$role->value.':'.$userId])) {
                    $errors[$prefix.'.userId'][] = 'Akun yang sama tidak boleh diduplikasi pada posisi approval yang sama.';
                }
                if ($role === UatApprovalRole::DEVELOPER && ! $projectDeveloperIds->contains($userId)) {
                    $errors[$prefix.'.userId'][] = 'Developer approver harus merupakan developer yang mengerjakan task pada proyek ini.';
                }
                $seenUsers[$role->value.':'.$userId] = true;
            }
        }
        if ($errors) throw ValidationException::withMessages($errors);
    }

    private function approverAttributes(array $participant, ?string $participantKey = null): array
    {
        $role = UatApprovalRole::from($participant['approvalRole']);
        $mode = UatApproverMode::from($participant['approvalMode']);
        $phone = $mode === UatApproverMode::EXTERNAL_LINK
            ? $this->normalizePhone((string) ($participant['phone'] ?? ''))
            : null;

        return [
            'participant_key' => $participantKey ?: (Str::isUuid((string) ($participant['id'] ?? ''))
                ? $participant['id']
                : (string) Str::uuid()),
            'user_id' => $mode === UatApproverMode::INTERNAL_ACCOUNT ? (int) $participant['userId'] : null,
            'side' => $role->side(),
            'approval_role' => $role,
            'approval_mode' => $mode,
            'name' => trim((string) $participant['name']),
            'position' => filled($participant['role'] ?? null) ? trim($participant['role']) : $role->label(),
            'unit' => filled($participant['unit'] ?? null) ? trim($participant['unit']) : null,
            'phone_hash' => $phone ? $this->phoneHash($phone) : null,
            'phone_masked' => $phone ? $this->maskPhone($phone) : null,
            'status' => UatApprovalStatus::PENDING,
        ];
    }

    private function revokeApprover(UatApprover $approver): void
    {
        $approver->update([
            'status' => UatApprovalStatus::REVOKED,
            'link_token_hash' => null,
            'link_expires_at' => null,
            'access_token_hash' => null,
            'access_expires_at' => null,
        ]);
    }

    private function refreshRoundCompletion(UatApprovalRound $round): void
    {
        $activeApprovers = $round->fresh('approvers')->approvers
            ->reject(fn (UatApprover $approver): bool => $approver->status === UatApprovalStatus::REVOKED);
        $completed = $activeApprovers->isNotEmpty()
            && $activeApprovers->every(fn (UatApprover $approver): bool => $approver->status === UatApprovalStatus::APPROVED);
        $round->update([
            'status' => $completed ? UatApprovalRoundStatus::COMPLETED : UatApprovalRoundStatus::ACTIVE,
            'completed_at' => $completed ? now() : null,
        ]);
    }

    private function recordDecision(UatApprover $approver, string $decision, ?string $note, Request $request): void
    {
        $this->assertActiveApprover($approver->round->project, $approver);
        if ($approver->status !== UatApprovalStatus::PENDING) {
            throw ValidationException::withMessages(['decision' => 'Keputusan untuk approval ini sudah diberikan.']);
        }
        if ($decision === 'rejected' && blank($note)) {
            throw ValidationException::withMessages(['note' => 'Alasan penolakan wajib diisi.']);
        }

        $approver->update([
            'status' => UatApprovalStatus::from($decision),
            'decision_note' => filled($note) ? trim($note) : null,
            'decided_at' => now(),
            'decision_ip' => $request->ip(),
            'decision_user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
        ]);

        $round = $approver->round()->with('approvers')->firstOrFail();
        $this->refreshRoundCompletion($round);

        ActivityLog::create([
            'user_id' => $approver->user_id,
            'action' => 'uat_approval_decision',
            'action_label' => 'Keputusan Persetujuan UAT',
            'description' => "{$approver->name} memberikan keputusan {$decision} pada UAT proyek \"{$round->project->title}\".",
            'subject_type' => Project::class,
            'subject_id' => $round->project_id,
            'metadata' => ['round' => $round->round_number, 'approver_id' => $approver->id, 'decision' => $decision, 'mode' => $approver->approval_mode->value],
            'ip_address' => $request->ip(),
        ]);
    }

    private function approverFromLink(string $token, bool $lock = false): UatApprover
    {
        $query = UatApprover::query()->with(['round.project.division', 'round.approvers']);
        if ($lock) $query->lockForUpdate();
        $approver = $query->where('link_token_hash', hash('sha256', $token))->first();
        if (! $approver || $approver->approval_mode !== UatApproverMode::EXTERNAL_LINK) abort(404);
        $this->assertLinkUsable($approver);
        return $approver;
    }

    private function authenticatedExternalApprover(string $token, string $accessToken): UatApprover
    {
        $approver = $this->approverFromLink($token);
        if (blank($accessToken) || blank($approver->access_token_hash)
            || ! hash_equals($approver->access_token_hash, hash('sha256', $accessToken))
            || ! $approver->access_expires_at?->isFuture()) {
            abort(401, 'Sesi verifikasi tidak valid atau sudah berakhir.');
        }
        return $approver;
    }

    private function assertLinkUsable(UatApprover $approver): void
    {
        $roundStatus = $approver->round->status;
        if ($approver->status === UatApprovalStatus::REVOKED) {
            abort(410, 'Assignment persetujuan ini sudah dicabut.');
        }
        $decisionMade = in_array($approver->status, [UatApprovalStatus::APPROVED, UatApprovalStatus::REJECTED], true);
        if (! $approver->link_expires_at?->isFuture()
            || (! $decisionMade && $roundStatus !== UatApprovalRoundStatus::ACTIVE)) {
            abort(410, 'Link persetujuan sudah tidak berlaku.');
        }
    }

    private function assertActiveApprover(Project $project, UatApprover $approver): void
    {
        $approver->loadMissing('round.project');
        if ((int) $approver->round->project_id !== (int) $project->id
            || $approver->round->status !== UatApprovalRoundStatus::ACTIVE) {
            throw ValidationException::withMessages(['approver' => 'Approval bukan bagian dari putaran aktif proyek ini.']);
        }
        $status = $project->status instanceof ProjectStatus ? $project->status->value : (string) $project->status;
        $data = (array) $project->sit_uat_data;
        if ($status !== ProjectStatus::UAT_IN_PROGRESS->value || (int) ($data['activeUatStep'] ?? 1) < 3
            || ($data['uat2_resume_after_sit'] ?? false) === true || ($data['uat2_verification_mode'] ?? false) === true) {
            throw ValidationException::withMessages(['project' => 'Persetujuan UAT belum tersedia atau sedang di-hold.']);
        }
    }

    private function assertManageable(Project $project, User $actor): void
    {
        $role = $actor->role?->name;
        if (! in_array($role, ['super_admin', 'head_of_it'], true)
            && ! (in_array($role, ['project_manager', 'dev_analyst'], true) && (int) $project->pm_id === (int) $actor->id)) {
            abort(403, 'Anda tidak berhak mengelola approval UAT proyek ini.');
        }
    }

    private function supersedeRound(UatApprovalRound $round, string $reason): void
    {
        $round->approvers()->update([
            'link_token_hash' => null,
            'access_token_hash' => null,
            'access_expires_at' => null,
        ]);
        $round->approvers()->where('status', UatApprovalStatus::PENDING->value)->update([
            'status' => UatApprovalStatus::REVOKED->value,
        ]);
        $round->update([
            'status' => UatApprovalRoundStatus::SUPERSEDED,
            'superseded_at' => now(),
            'superseded_reason' => $reason,
        ]);
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '620')) $digits = '62'.substr($digits, 3);
        if (str_starts_with($digits, '0')) $digits = '62'.substr($digits, 1);
        if (str_starts_with($digits, '8')) $digits = '62'.$digits;
        if (! preg_match('/^62[0-9]{8,13}$/', $digits)) {
            throw ValidationException::withMessages(['phone' => 'Nomor HP harus menggunakan format Indonesia yang valid.']);
        }
        return $digits;
    }

    private function phoneHash(string $phone): string
    {
        return hash_hmac('sha256', $phone, (string) config('app.key'));
    }

    private function maskPhone(string $phone): string
    {
        return substr($phone, 0, 4).str_repeat('•', max(strlen($phone) - 8, 4)).substr($phone, -4);
    }

    private function publicDocuments(Project $project, array $data): array
    {
        $finalApprovalIds = collect($data['uat3_docs'] ?? [])
            ->pluck('docId')
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique();
        $ids = $finalApprovalIds
            ->merge(collect($data['uat1_docs'] ?? [])->pluck('docId'))
            ->merge(collect($data['uat2_scenarios'] ?? [])->flatMap(fn ($item) => collect($item['attachments'] ?? [])->pluck('docId')))
            ->merge(collect($data['uat2_scenarios'] ?? [])->flatMap(fn ($item) => collect($item['verificationAttachments'] ?? [])->pluck('docId')))
            ->merge(collect($data['uat2_additional_requests'] ?? [])->flatMap(fn ($item) => collect($item['attachments'] ?? [])->pluck('docId')))
            ->merge(collect($data['uat2_additional_requests'] ?? [])->flatMap(fn ($item) => collect($item['verificationAttachments'] ?? [])->pluck('docId')))
            ->filter(fn ($id) => is_numeric($id))->map(fn ($id) => (int) $id)->unique();

        return $project->documents()->whereKey($ids->all())->get()->map(fn (DocumentVault $document): array => [
            'id' => $document->id,
            'name' => $document->file_name,
            'type' => $document->document_type,
            'size' => $document->file_size,
            'category' => $finalApprovalIds->contains((int) $document->id) ? 'final_approval' : 'supporting',
        ])->values()->all();
    }

    private function serializeRound(UatApprovalRound $round): array
    {
        $round->loadMissing('approvers.user');
        $requiredApprovers = $round->approvers
            ->reject(fn (UatApprover $approver): bool => $approver->status === UatApprovalStatus::REVOKED)
            ->values();
        return [
            'id' => $round->id,
            'round_number' => $round->round_number,
            'status' => $round->status->value,
            'opened_at' => $round->opened_at?->toIso8601String(),
            'completed_at' => $round->completed_at?->toIso8601String(),
            'approvers' => $requiredApprovers->map(fn (UatApprover $approver) => $this->serializeApprover($approver))->all(),
            'approved_count' => $requiredApprovers->where('status', UatApprovalStatus::APPROVED)->count(),
            'required_count' => $requiredApprovers->count(),
            'all_approved' => $requiredApprovers->isNotEmpty() && $requiredApprovers->every(fn ($item) => $item->status === UatApprovalStatus::APPROVED),
        ];
    }

    private function serializeApprover(UatApprover $approver): array
    {
        return [
            'id' => $approver->id,
            'participant_key' => $approver->participant_key,
            'user_id' => $approver->user_id,
            'side' => $approver->side,
            'approval_role' => $approver->approval_role->value,
            'approval_role_label' => $approver->approval_role->label(),
            'approval_mode' => $approver->approval_mode->value,
            'name' => $approver->name,
            'position' => $approver->position,
            'unit' => $approver->unit,
            'phone_masked' => $approver->phone_masked,
            'status' => $approver->status->value,
            'decision_note' => $approver->decision_note,
            'decided_at' => $approver->decided_at?->toIso8601String(),
            'link_ready' => filled($approver->link_token_hash) && $approver->link_expires_at?->isFuture(),
            'link_expires_at' => $approver->link_expires_at?->toIso8601String(),
        ];
    }

    private function log(User $actor, Project $project, string $action, string $label, string $description, array $metadata): void
    {
        ActivityLog::create([
            'user_id' => $actor->id,
            'action' => $action,
            'action_label' => $label,
            'description' => $description,
            'subject_type' => Project::class,
            'subject_id' => $project->id,
            'metadata' => ['project_id' => $project->id, ...$metadata],
        ]);
    }
}
