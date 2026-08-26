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
                    'kind' => 'uat',
                    'status' => $approver->status->value,
                    'approval_role' => $approver->approval_role->value,
                    'approval_role_label' => $approver->approval_role->label(),
                    'can_reject' => $approver->approval_role->canReject(),
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
                || $project->isUatRestartPending()) {
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

    /**
     * Verifikasi nomor HP pemilik link approval eksternal.
     *
     * Link eksternal hanya dijaga oleh nomor HP, jadi rate limit-nya adalah satu-satunya
     * penghalang percobaan tebak. Sebelumnya percobaan ke-5 menyetel
     * `verification_attempts` kembali ke 0 sambil memasang masa kunci: begitu kuncinya
     * habis, penghitungnya sudah bersih sehingga kuota penuh kembali tersedia dan siklus
     * itu dapat diulang tanpa batas — jumlah percobaan seumur link tidak pernah benar-benar
     * dibatasi. Selain itu, selama terkunci baris tersebut melaporkan `attempts = 0`,
     * sehingga tidak ada jejak bahwa kunci sedang berlaku.
     *
     * Sekarang penghitungnya monoton: hanya verifikasi yang **berhasil** (atau pembuatan
     * ulang link oleh PM) yang mengembalikannya ke 0. Setiap kelipatan `max_attempts`
     * kegagalan memasang masa kunci baru yang durasinya bertambah (15, 30, 45 menit, …),
     * dibatasi 24 jam, sehingga penebak berulang melambat sendiri sementara approver yang
     * hanya salah ketik tetap bisa mencoba lagi setelah menunggu.
     *
     * Catatan penting tentang transaksinya: `ValidationException` tidak boleh lagi
     * dilempar dari dalam closure `DB::transaction()`. Dulu justru begitu, dan akibatnya
     * seluruh rate limit ini tidak pernah bekerja sama sekali — `DB::transaction()`
     * me-rollback saat closure-nya melempar exception, jadi kenaikan
     * `verification_attempts` selalu ikut dibatalkan bersama pesan errornya dan setiap
     * percobaan gagal selalu dimulai dari nol. Karena itu closure hanya mengembalikan
     * hasil, dan exception dilempar setelah transaksinya commit.
     */
    public function verifyPhone(string $token, string $phone): array
    {
        $outcome = DB::transaction(function () use ($token, $phone): array {
            $approver = $this->approverFromLink($token, true);
            $maxAttempts = max(1, (int) config('uat.verification.max_attempts', 5));
            $lockoutMinutes = max(1, (int) config('uat.verification.lockout_minutes', 15));

            // Selama terkunci, baris tidak disentuh sama sekali. Menulis apa pun di sini
            // membuka jalan untuk mereset — atau justru memperpanjang tanpa batas — masa
            // kunci hanya dengan mengirim permintaan berulang.
            if ($approver->verification_locked_until?->isFuture()) {
                return ['error' => 'Terlalu banyak percobaan. '.$this->retryHint($approver->verification_locked_until)];
            }

            $matches = hash_equals((string) $approver->phone_hash, $this->phoneHash($this->normalizePhone($phone)));
            if (! $matches) {
                // `verification_attempts` adalah TINYINT unsigned (maks 255). Penghitung
                // dibatasi pada kelipatan `max_attempts` terbesar yang masih muat: MySQL
                // strict mode akan menolak nilai di atas 255, dan berhenti tepat di
                // kelipatan menjaga agar setiap kegagalan selanjutnya tetap memasang kunci
                // (durasi maksimum) alih-alih lolos karena sisa modulo yang tidak nol.
                $attempts = min((int) $approver->verification_attempts + 1, intdiv(255, $maxAttempts) * $maxAttempts);
                $lockNow = $attempts % $maxAttempts === 0;
                // Masa kunci bertambah panjang setiap blok kegagalan berikutnya. Pembagian
                // memakai penghitung monoton, jadi blok ke-2 mengunci dua kali lebih lama.
                $lockedUntil = $lockNow
                    ? now()->addMinutes(min($lockoutMinutes * intdiv($attempts, $maxAttempts), 24 * 60))
                    : $approver->verification_locked_until;
                $approver->update([
                    'verification_attempts' => $attempts,
                    // Timestamp kunci yang sudah kedaluwarsa dibiarkan apa adanya sebagai
                    // jejak kapan kunci terakhir berlaku; gerbang di atas hanya melihat
                    // yang masih `isFuture()`.
                    'verification_locked_until' => $lockedUntil,
                ]);

                return [
                    'error' => $lockNow
                        ? 'Data verifikasi tidak sesuai. Batas percobaan tercapai. '.$this->retryHint($lockedUntil)
                        : 'Data verifikasi tidak sesuai. Sisa percobaan sebelum akses dikunci: '
                            .($maxAttempts - ($attempts % $maxAttempts)).'.',
                ];
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

        if (isset($outcome['error'])) {
            throw ValidationException::withMessages(['phone' => $outcome['error']]);
        }

        return $outcome;
    }

    /**
     * Petunjuk kapan approver boleh mencoba lagi.
     *
     * Disampaikan relatif (menit) karena `app.timezone` adalah UTC: menampilkan jam
     * dinding di sini justru menyesatkan approver yang membaca waktu WIB.
     */
    private function retryHint(?\Carbon\CarbonInterface $lockedUntil): string
    {
        // Selisih dihitung dari timestamp mentah, bukan `diffInMinutes()`, agar tidak
        // bergantung pada konvensi tanda argumen `absolute` milik Carbon.
        $seconds = $lockedUntil ? $lockedUntil->getTimestamp() - now()->getTimestamp() : 0;
        $minutes = (int) ceil(max(0, $seconds) / 60);
        if ($minutes < 1) {
            return 'Silakan coba kembali sekarang.';
        }
        if ($minutes < 60) {
            return "Silakan coba kembali dalam {$minutes} menit.";
        }

        return 'Silakan coba kembali dalam '.(int) ceil($minutes / 60).' jam.';
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

    /**
     * Keputusan approver internal (in-app).
     *
     * Jejak auditnya sepenuhnya ditulis oleh `recordDecision()`. Dahulu method ini
     * menambah satu baris `ActivityLog` lagi (`uat_internal_decision`) sehingga satu
     * keputusan menghasilkan dua baris audit dengan isi yang hampir sama. Baris kedua
     * itu dibuang, bukan yang di `recordDecision()`, karena: baris `recordDecision()`
     * lebih lengkap (menyimpan `ip_address` dan `metadata.mode`), berlaku untuk jalur
     * internal maupun eksternal sehingga pembacanya tidak perlu menggabungkan dua nama
     * action, dan ditulis di dalam transaksi yang sama dengan perubahan statusnya —
     * sedangkan `log()` di sini berjalan setelah transaksi tersebut selesai, jadi
     * kegagalannya menghasilkan keputusan tanpa jejak.
     *
     * Satu-satunya field yang hanya dimiliki baris lama, `metadata.project_id`,
     * dipindahkan ke baris yang tetap ada karena `ActivityLogController::index()`
     * memakainya untuk filter `?project_id=`.
     */
    public function decideInternal(Project $project, UatApprover $approver, User $actor, string $decision, ?string $note, Request $request): array
    {
        $this->assertActiveApprover($project, $approver);
        if ($approver->approval_mode !== UatApproverMode::INTERNAL_ACCOUNT || (int) $approver->user_id !== (int) $actor->id) {
            throw ValidationException::withMessages(['approver' => 'Approval ini tidak ditugaskan kepada akun Anda.']);
        }
        $this->recordDecision($approver, $decision, $note, $request);

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

    /**
     * ID user penanda tangan internal pada putaran persetujuan yang sedang berjalan.
     *
     * Dipakai untuk memberi tahu penanda tangan bahwa penahanan persetujuan sudah
     * lepas. Penanda tangan eksternal tidak memiliki akun, jadi tidak dapat menerima
     * notifikasi dalam aplikasi — jalur pemberitahuannya adalah tautan publik.
     * Baris `REVOKED` dilewati karena orangnya sudah tidak lagi diminta menyetujui.
     *
     * @return list<int>
     */
    public function activeInternalApproverUserIds(Project $project): array
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

        return $round?->approvers
            ->reject(fn (UatApprover $approver): bool => $approver->status === UatApprovalStatus::REVOKED)
            ->pluck('user_id')
            ->filter()
            ->map(fn ($userId): int => (int) $userId)
            ->unique()
            ->values()
            ->all() ?? [];
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

    /**
     * Validasi roster approver sebelum sebuah putaran dibuat atau disinkronkan.
     *
     * Prasyarat: `$participants` sudah disaring `isApprover === true` dan di-reindex
     * (`values()`), sebagaimana dilakukan `startNewRound()` dan `syncActiveRound()`.
     * Peserta non-approver (observer) tidak pernah sampai ke sini, sehingga orang yang
     * sama boleh muncul sebagai observer di samping satu entri approver.
     *
     * Semua aturan di sini disengaja berada di satu tempat: kedua pintu masuk putaran
     * memanggil method ini, jadi aturan baru otomatis berlaku untuk pembuatan putaran
     * maupun sinkronisasi peserta.
     */
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
        $seenKeys = [];
        $seenItUsers = [];
        foreach ($participants as $index => $participant) {
            $prefix = "participants.{$index}";
            // Pesan validasi selalu menyebut nama peserta: PM-lah yang menyunting roster
            // di UAT Tahap 1, jadi ia harus tahu baris mana yang harus diperbaiki, bukan
            // sekadar bahwa "roster tidak valid".
            $label = trim((string) ($participant['name'] ?? '')) ?: 'peserta ke-'.($index + 1);
            if (blank($participant['name'] ?? null)) $errors[$prefix.'.name'][] = 'Nama approver wajib diisi.';

            // `participant_key` sebelumnya hanya dijaga oleh unique komposit
            // `(uat_approval_round_id, participant_key)`. Roster dengan dua `id` kembar
            // baru meledak saat `INSERT` approver kedua — sebagai integrity error driver,
            // setelah baris putaran dibuat di dalam transaksi — sehingga PM hanya melihat
            // kegagalan mentah tanpa petunjuk peserta mana yang bermasalah.
            //
            // `id` kosong sama berbahayanya walaupun tidak melanggar constraint:
            // `approverAttributes()` akan membuat UUID baru setiap kali, jadi kuncinya
            // tidak stabil antar putaran, `syncActiveRound()` tidak pernah dapat
            // mencocokkannya, dan `activeMatrix()` menandai putaran itu selamanya
            // `is_out_of_sync`.
            $participantKey = trim((string) ($participant['id'] ?? ''));
            if ($participantKey === '') {
                $errors[$prefix.'.id'][] = "Peserta \"{$label}\" belum memiliki penanda unik (id). Buka UAT Tahap 1, hapus lalu tambahkan kembali baris peserta ini, kemudian simpan.";
            } elseif (isset($seenKeys[$participantKey])) {
                $errors[$prefix.'.id'][] = "Peserta \"{$label}\" memakai id yang sama dengan \"{$seenKeys[$participantKey]}\". Setiap peserta UAT wajib memiliki id unik — hapus salah satu baris kembar di UAT Tahap 1 lalu tambahkan kembali sebagai peserta baru.";
            } else {
                $seenKeys[$participantKey] = $label;
            }

            try {
                $role = UatApprovalRole::from((string) ($participant['approvalRole'] ?? ''));
                $mode = UatApproverMode::from((string) ($participant['approvalMode'] ?? ''));
            } catch (\ValueError) {
                $errors[$prefix][] = 'Jenis atau metode approval tidak valid.';
                continue;
            }
            if ($mode !== $role->requiredMode()) {
                $errors[$prefix.'.approvalMode'][] = $role->requiredMode() === UatApproverMode::EXTERNAL_LINK
                    ? 'Pimpinan grup dan pimpinan divisi pemohon menggunakan link approval eksternal.'
                    : 'Posisi ini wajib menggunakan akun internal aplikasi.';
            }
            if ($mode === UatApproverMode::EXTERNAL_LINK) {
                try { $this->normalizePhone((string) ($participant['phone'] ?? '')); }
                catch (ValidationException) {
                    $errors[$prefix.'.phone'][] = "Nomor HP {$label} tidak valid. Gunakan format 08... atau +62...";
                }
            } else {
                $userId = (int) ($participant['userId'] ?? 0);
                if (! $userId || ! User::query()->whereKey($userId)->where('is_active', true)->exists()) {
                    $errors[$prefix.'.userId'][] = 'Approver internal wajib terhubung ke akun aktif.';
                } elseif (isset($seenUsers[$role->value.':'.$userId])) {
                    $errors[$prefix.'.userId'][] = 'Akun yang sama tidak boleh diduplikasi pada posisi approval yang sama.';
                } elseif ($role->side() === 'it' && isset($seenItUsers[$userId])) {
                    // Prinsip empat mata. Bila satu akun menempati dua slot approval sisi IT
                    // — misalnya Pimpinan Grup Pengembangan sekaligus Pimpinan Divisi
                    // Teknologi — maka satu klik orang yang sama memenuhi dua persetujuan
                    // wajib, dan `required_count` hanya tampak terpenuhi tanpa kontrol nyata.
                    //
                    // Yang sengaja TIDAK ditolak:
                    // - slot pemohon (`side() === 'requester'`), lihat catatan di bawah;
                    // - approver eksternal, yang memang tidak punya `userId`;
                    // - orang yang sama sebagai peserta non-approver (observer) — roster
                    //   sudah disaring `isApprover === true` sebelum masuk method ini.
                    $errors[$prefix.'.userId'][] = "{$label} sudah ditetapkan sebagai {$seenItUsers[$userId]} pada putaran ini. Satu akun tidak boleh mengisi dua posisi approval sisi IT; tetapkan akun lain untuk {$role->label()}.";
                }
                if ($role === UatApprovalRole::DEVELOPER && ! $projectDeveloperIds->contains($userId)) {
                    $errors[$prefix.'.userId'][] = 'Developer approver harus merupakan developer yang mengerjakan task pada proyek ini.';
                }
                // Slot pemohon harus akun yang benar-benar mengajukan proyek. Tanpa
                // ikatan ini, persetujuan pemohon dapat dilimpahkan ke akun lain,
                // sementara gerbang baca matriks (`created_by`) dan gerbang keputusan
                // in-app (`user_id`) mengacu pada dua orang yang berbeda.
                //
                // Ikatan itu juga alasan slot pemohon dikecualikan dari aturan empat mata
                // di atas: `created_by` tidak dapat diubah oleh PM, jadi bila pemohon
                // proyek kebetulan orang IT yang juga wajib mengisi slot Analyst/PM,
                // aturan tanpa pengecualian akan membuat putaran approval mustahil dibuka
                // dan PM tidak punya cara apa pun untuk memperbaikinya. Pemohon pun bukan
                // kontrol IT: ia sisi peminta, dan tumpang tindihnya terlihat jelas pada
                // matriks karena kolom `side` berbeda.
                if ($role === UatApprovalRole::REQUESTER && $userId !== (int) $project->created_by) {
                    $errors[$prefix.'.userId'][] = 'Approver pemohon harus akun yang mengajukan proyek ini.';
                }
                $seenUsers[$role->value.':'.$userId] = true;
                if ($userId && $role->side() === 'it') {
                    $seenItUsers[$userId] ??= $role->label();
                }
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

    /**
     * Catat keputusan seorang approver beserta jejak auditnya.
     *
     * Seluruh tulisan berada dalam satu transaksi. Sebelumnya pembaruan status
     * approver, penyegaran status putaran, dan pembuatan `ActivityLog` berjalan
     * terpisah: bila pembuatan log gagal, keputusan tetap tersimpan — bahkan putaran
     * dapat berpindah ke COMPLETED — tanpa satu pun baris audit. Untuk aplikasi tata
     * kelola SDLC, keputusan approval tanpa jejak audit sama buruknya dengan
     * keputusan yang hilang.
     */
    private function recordDecision(UatApprover $approver, string $decision, ?string $note, Request $request): void
    {
        $this->assertActiveApprover($approver->round->project, $approver);
        if ($approver->status !== UatApprovalStatus::PENDING) {
            throw ValidationException::withMessages(['decision' => 'Keputusan untuk approval ini sudah diberikan.']);
        }
        if ($decision === 'rejected' && ! $approver->approval_role->canReject()) {
            throw ValidationException::withMessages([
                'decision' => 'Posisi approval ini hanya dapat menyetujui. Penolakan dan permintaan revisi dilakukan pada saat eksekusi UAT.',
            ]);
        }
        if ($decision === 'rejected' && blank($note)) {
            throw ValidationException::withMessages(['note' => 'Alasan penolakan wajib diisi.']);
        }

        DB::transaction(function () use ($approver, $decision, $note, $request): void {
            // Baris approval dikunci lalu statusnya diperiksa ulang di dalam transaksi.
            // Pemeriksaan di luar transaksi saja tidak cukup: dua permintaan yang tiba
            // bersamaan — tombol diklik dua kali, atau satu link dibuka pada dua
            // perangkat — sama-sama membaca status PENDING, sehingga keputusannya
            // tercatat dua kali beserta dua baris audit.
            $locked = UatApprover::query()->lockForUpdate()->findOrFail($approver->getKey());
            if ($locked->status !== UatApprovalStatus::PENDING) {
                throw ValidationException::withMessages(['decision' => 'Keputusan untuk approval ini sudah diberikan.']);
            }

            $locked->update([
                'status' => UatApprovalStatus::from($decision),
                'decision_note' => filled($note) ? trim($note) : null,
                'decided_at' => now(),
                'decision_ip' => $request->ip(),
                'decision_user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
            ]);

            $round = $locked->round()->with(['approvers', 'project'])->firstOrFail();
            $this->refreshRoundCompletion($round);

            ActivityLog::create([
                'user_id' => $locked->user_id,
                'action' => 'uat_approval_decision',
                'action_label' => 'Keputusan Persetujuan UAT',
                'description' => "{$locked->name} memberikan keputusan {$decision} pada UAT proyek \"{$round->project->title}\".",
                'subject_type' => Project::class,
                'subject_id' => $round->project_id,
                // `project_id` diwarisi dari baris `uat_internal_decision` yang dulu ditulis
                // ganda: `ActivityLogController::index()` menyaring `?project_id=` lewat
                // metadata, bukan lewat `subject_id`, jadi tanpa key ini keputusan UAT
                // hilang dari linimasa proyek.
                'metadata' => [
                    'project_id' => $round->project_id,
                    'round' => $round->round_number,
                    'approver_id' => $locked->id,
                    'decision' => $decision,
                    'mode' => $locked->approval_mode->value,
                ],
                'ip_address' => $request->ip(),
            ]);
        });
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
            || $project->isUatRestartPending()) {
            throw ValidationException::withMessages(['project' => 'Persetujuan UAT belum tersedia atau sedang di-hold.']);
        }

        // Revisi Minor membiarkan putaran persetujuan terbuka — roster dan berita
        // acaranya tetap sama — tetapi keputusannya ditahan sampai perbaikan selesai.
        // Tanpa penahanan ini, tanda tangan jatuh pada versi aplikasi yang perbaikannya
        // belum dikerjakan. Pesannya dibedakan agar penanda tangan tahu ia hanya perlu
        // menunggu, bukan mencari tahap yang belum diselesaikan.
        if ($project->isUatMinorRevisionPending()) {
            throw ValidationException::withMessages([
                'project' => 'Persetujuan UAT ditahan sampai perbaikan revisi Minor diselesaikan tim pengembangan.',
            ]);
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

    /**
     * Keyed hash nomor HP approver eksternal.
     *
     * Kuncinya dipisahkan dari `APP_KEY` lewat `config('uat.phone_hash_key')`.
     * Rotasi `APP_KEY` adalah operasi keamanan rutin, tetapi dulu efek sampingnya
     * membatalkan seluruh `phone_hash` yang tersimpan sekaligus — setiap approver
     * eksternal terkunci dari link-nya tanpa error yang menunjuk penyebabnya.
     *
     * Fallback ke `APP_KEY` disengaja dan wajib dipertahankan: hash yang sudah ada
     * di basis data produksi dihitung dengan `APP_KEY`, jadi deployment yang belum
     * menyetel `UAT_PHONE_HASH_KEY` harus tetap dapat memverifikasinya.
     */
    private function phoneHash(string $phone): string
    {
        $key = (string) config('uat.phone_hash_key');

        return hash_hmac('sha256', $phone, $key !== '' ? $key : (string) config('app.key'));
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

        // Approver eksternal — pimpinan grup dan pimpinan divisi pemohon — hanya boleh
        // melihat berkas yang juga terlihat oleh pemohon proyek. Daftar tipe diambil
        // dari `DocumentVault` agar tampilan pemohon dan halaman link memakai satu
        // sumber kebenaran; berkas internal seperti laporan cyber atau lampiran kerja
        // tidak pernah bocor melalui link yang dibagikan ke luar tim IT.
        return $project->documents()
            ->whereKey($ids->all())
            ->whereIn('document_type', DocumentVault::REQUESTER_VISIBLE_TYPES)
            ->get()
            ->map(fn (DocumentVault $document): array => [
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
            // Dipakai frontend untuk menyembunyikan tombol tolak. Aturannya tetap
            // ditegakkan di `recordDecision`; nilai ini hanya menyelaraskan tampilan.
            'can_reject' => $approver->approval_role->canReject(),
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
