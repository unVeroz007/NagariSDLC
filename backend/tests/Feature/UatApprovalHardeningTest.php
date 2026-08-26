<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Enums\UatApprovalRoundStatus;
use App\Enums\UatApprovalStatus;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Division;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Models\Role;
use App\Models\UatApprovalRound;
use App\Models\UatApprover;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

/**
 * Pengerasan approval UAT: keunikan `participant_key`, prinsip empat mata pada slot
 * approval sisi IT, satu baris audit per keputusan, kunci hash nomor HP yang terpisah
 * dari `APP_KEY`, serta rate limit verifikasi yang benar-benar membatasi.
 */
class UatApprovalHardeningTest extends TestCase
{
    use RefreshDatabase;

    private Division $division;

    private User $admin;

    private User $developer;

    private User $devLead;

    private User $techLead;

    private User $requester;

    // ---------------------------------------------------------------------
    // Tugas 1 — keunikan `participant_key` divalidasi di lapisan aplikasi
    // ---------------------------------------------------------------------

    /**
     * Dua peserta dengan `id` kembar dulu hanya tertahan oleh unique komposit
     * `(uat_approval_round_id, participant_key)`, jadi kegagalannya muncul sebagai
     * integrity error driver setelah baris putaran dibuat di dalam transaksi.
     */
    public function test_duplicated_participant_key_is_refused_and_nothing_is_created(): void
    {
        $project = $this->makeFinalizedProject();
        $participants = $this->cleanRoster();
        // Baris kembar meniru PM yang menduplikasi entri di UAT Tahap 1 sehingga `id`
        // UUID-nya terbawa apa adanya.
        $participants[6]['id'] = $participants[5]['id'];
        $this->setRoster($project, $participants);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('participants.6.id');

        // Pesannya harus menyebut kedua peserta supaya PM tahu baris mana yang disunting.
        $message = $this->firstError($response, 'participants.6.id');
        $this->assertStringContainsString('Pimpinan Divisi TI', $message);
        $this->assertStringContainsString('Pimpinan Pengembangan', $message);

        // Inti pengujiannya: transaksi benar-benar batal, bukan menyisakan putaran kosong.
        $this->assertSame(0, UatApprovalRound::count());
        $this->assertSame(0, UatApprover::count());
    }

    /**
     * `id` kosong tidak melanggar constraint apa pun — `approverAttributes()` justru
     * membuat UUID baru setiap kali dipanggil. Akibatnya kunci peserta tidak stabil
     * antar putaran, `syncActiveRound()` tidak pernah dapat mencocokkannya, dan
     * `activeMatrix()` menandai putaran itu selamanya `is_out_of_sync`.
     */
    public function test_blank_participant_key_is_refused(): void
    {
        $project = $this->makeFinalizedProject();
        $participants = $this->cleanRoster();
        $participants[3]['id'] = '   ';
        $this->setRoster($project, $participants);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('participants.3.id');

        $this->assertStringContainsString('Developer UAT', $this->firstError($response, 'participants.3.id'));
        $this->assertSame(0, UatApprovalRound::count());
        $this->assertSame(0, UatApprover::count());
    }

    // ---------------------------------------------------------------------
    // Tugas 2 — satu akun tidak boleh mengisi dua slot approval sisi IT
    // ---------------------------------------------------------------------

    public function test_one_account_cannot_hold_two_it_approval_slots(): void
    {
        $project = $this->makeFinalizedProject();
        $participants = $this->cleanRoster();
        // Satu orang menjadi Pimpinan Grup Pengembangan sekaligus Pimpinan Divisi
        // Teknologi: satu klik akan memenuhi dua persetujuan wajib.
        $participants[6]['userId'] = $this->devLead->id;
        $this->setRoster($project, $participants);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('participants.6.userId');

        $this->assertStringContainsString(
            'Pimpinan Grup Pengembangan',
            $this->firstError($response, 'participants.6.userId')
        );
        $this->assertSame(0, UatApprovalRound::count());
    }

    /**
     * Yang sah harus tetap sah: approver eksternal tidak punya `userId` sama sekali, dan
     * orang yang sama boleh muncul sebagai peserta non-approver (observer) di samping
     * satu entri approver miliknya.
     */
    public function test_external_approvers_and_observer_duplicates_are_still_accepted(): void
    {
        $project = $this->makeFinalizedProject();
        $participants = $this->cleanRoster();
        // Observer memakai akun yang sama dengan approver Pimpinan Divisi Teknologi.
        $participants[] = [
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Pimpinan Divisi TI', 'role' => 'Peninjau', 'unit' => 'Divisi TI',
            'phone' => '', 'isApprover' => false, 'approvalRole' => 'technology_division_lead',
            'approvalMode' => 'internal_account', 'userId' => $this->techLead->id,
        ];
        $this->setRoster($project, $participants);

        $round = $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated()
            ->json('data');

        // Hanya tujuh approver yang tercatat; observer tidak menjadi baris approval.
        $this->assertCount(7, $round['approvers']);
        $externals = collect($round['approvers'])->where('approval_mode', 'external_link');
        $this->assertCount(2, $externals);
        // Dua approver eksternal sama-sama tanpa `userId`; itu tidak boleh dianggap kembar.
        $this->assertSame([null, null], $externals->pluck('user_id')->all());
    }

    /**
     * Kedua pintu masuk putaran memakai `validateParticipants()` yang sama, jadi aturan
     * baru harus tertutup di pembuatan putaran maupun sinkronisasi peserta.
     */
    public function test_sync_active_round_enforces_both_new_rules(): void
    {
        $project = $this->makeFinalizedProject();
        $this->setRoster($project, $this->cleanRoster());
        $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated();
        $approverCountBefore = UatApprover::count();

        $duplicateKeyRoster = $this->cleanRoster();
        $duplicateKeyRoster[6]['id'] = $duplicateKeyRoster[5]['id'];
        $this->setRoster($project, $duplicateKeyRoster);
        $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds/sync")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('participants.6.id');

        $duplicateItRoster = $this->cleanRoster();
        $duplicateItRoster[4]['userId'] = $this->techLead->id;
        $this->setRoster($project, $duplicateItRoster);
        $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds/sync")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('participants.6.userId');

        // Sinkronisasi yang ditolak tidak boleh menyisakan perubahan separuh jalan.
        $this->assertSame(1, UatApprovalRound::count());
        $this->assertSame($approverCountBefore, UatApprover::count());
    }

    /**
     * Kursi yang sudah dicabut, atau yang tertinggal di putaran `superseded`, tidak dapat
     * dipakai menandatangani lagi — jadi aturan empat mata tidak bisa diakali dengan
     * memanfaatkan sisa kursi dari putaran lama.
     */
    public function test_revoked_and_superseded_seats_cannot_be_used_to_sign(): void
    {
        $project = $this->makeFinalizedProject();
        $this->setRoster($project, $this->cleanRoster());
        $round = $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated()
            ->json('data');
        $seat = collect($round['approvers'])->firstWhere('approval_role', 'developer');
        $url = "/api/v1/projects/{$project->id}/uat-approvers/{$seat['id']}/decision";
        $approver = UatApprover::findOrFail($seat['id']);

        // Kursi dicabut: `recordDecision()` menolak status apa pun selain `pending`.
        $approver->update(['status' => UatApprovalStatus::REVOKED->value]);
        $this->actingAs($this->developer)
            ->postJson($url, ['decision' => 'approved'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('decision');

        // Putaran di-superseded: `assertActiveApprover()` menolak lebih dulu.
        $approver->update(['status' => UatApprovalStatus::PENDING->value]);
        UatApprovalRound::whereKey($round['id'])
            ->update(['status' => UatApprovalRoundStatus::SUPERSEDED->value]);
        $this->actingAs($this->developer)
            ->postJson($url, ['decision' => 'approved'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('approver');

        $this->assertSame(0, ActivityLog::where('action', 'uat_approval_decision')->count());
    }

    // ---------------------------------------------------------------------
    // Tugas 3 — satu keputusan internal menulis tepat satu baris audit
    // ---------------------------------------------------------------------

    public function test_internal_decision_writes_exactly_one_audit_row(): void
    {
        $project = $this->makeFinalizedProject();
        $this->setRoster($project, $this->cleanRoster());
        $round = $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated()
            ->json('data');
        $seat = collect($round['approvers'])->firstWhere('approval_role', 'developer');

        $this->actingAs($this->developer)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$seat['id']}/decision", [
                'decision' => 'approved',
                'note' => 'Hasil UAT sesuai kebutuhan.',
            ])
            ->assertOk();

        $this->assertSame(0, ActivityLog::where('action', 'uat_internal_decision')->count());
        $this->assertSame(1, ActivityLog::where('action', 'uat_approval_decision')->count());

        // Baris yang bertahan wajib membawa seluruh field yang dulu terbagi ke dua baris.
        $log = ActivityLog::where('action', 'uat_approval_decision')->firstOrFail();
        $this->assertSame($this->developer->id, $log->user_id);
        $this->assertSame('Keputusan Persetujuan UAT', $log->action_label);
        $this->assertSame(Project::class, $log->subject_type);
        $this->assertSame($project->id, (int) $log->subject_id);
        $this->assertSame('127.0.0.1', $log->ip_address);
        $this->assertStringContainsString($project->title, $log->description);
        $this->assertStringContainsString('Developer UAT', $log->description);
        // `metadata.project_id` diwarisi dari baris lama; `ActivityLogController::index()`
        // memakainya untuk filter `?project_id=`, bukan `subject_id`.
        $this->assertSame([
            'project_id' => $project->id,
            'round' => 1,
            'approver_id' => (int) $seat['id'],
            'decision' => 'approved',
            'mode' => 'internal_account',
        ], $log->metadata);

        // Filter linimasa proyek harus menemukan keputusan itu.
        $this->actingAs($this->admin)
            ->getJson("/api/v1/activity-logs?project_id={$project->id}&action=uat_approval_decision")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    // ---------------------------------------------------------------------
    // Tugas 4 — `phone_hash` memakai kunci sendiri, tetap kompatibel ke belakang
    // ---------------------------------------------------------------------

    /**
     * Hash yang sudah tersimpan di produksi dihitung dengan `APP_KEY`. Selama
     * `UAT_PHONE_HASH_KEY` belum disetel, hash itu wajib tetap terverifikasi.
     */
    public function test_phone_hash_stored_with_app_key_still_verifies_when_new_key_is_unset(): void
    {
        config(['uat.phone_hash_key' => null]);
        [$link, $approver] = $this->makeExternalLink();
        $approver->update([
            'phone_hash' => hash_hmac('sha256', '6281211111111', (string) config('app.key')),
        ]);

        $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081211111111'])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure(['status', 'message', 'data' => ['access_token', 'expires_at']]);
    }

    public function test_phone_hash_uses_dedicated_key_when_it_is_set(): void
    {
        config(['uat.phone_hash_key' => 'kunci-hash-uat-khusus']);
        [$link, $approver] = $this->makeExternalLink();
        $approver->update([
            'phone_hash' => hash_hmac('sha256', '6281211111111', 'kunci-hash-uat-khusus'),
        ]);

        $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081211111111'])
            ->assertOk();
    }

    /**
     * Bukti bahwa kuncinya benar-benar dipakai: dengan `UAT_PHONE_HASH_KEY` terisi, hash
     * lama berbasis `APP_KEY` tidak lagi cocok. Inilah alasan `.env.example`
     * memperingatkan bahwa mengubah variabel itu membatalkan hash yang sudah ada.
     */
    public function test_app_key_hash_stops_matching_once_dedicated_key_is_set(): void
    {
        config(['uat.phone_hash_key' => 'kunci-hash-uat-khusus']);
        [$link, $approver] = $this->makeExternalLink();
        $approver->update([
            'phone_hash' => hash_hmac('sha256', '6281211111111', (string) config('app.key')),
        ]);

        $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081211111111'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');
    }

    // ---------------------------------------------------------------------
    // Tugas 5 — penghitung percobaan verifikasi bersifat monoton
    // ---------------------------------------------------------------------

    /**
     * Dulu percobaan ke-5 menyetel `verification_attempts` kembali ke 0 sambil memasang
     * masa kunci, sehingga setelah kunci habis kuota penuh tersedia lagi dan siklusnya
     * bisa diulang tanpa batas.
     */
    public function test_verification_lockout_cannot_be_reset_by_further_attempts(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        [$link, $approver] = $this->makeExternalLink();

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081299999999'])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('phone');
        }

        $approver->refresh();
        $this->assertSame(5, (int) $approver->verification_attempts);
        $this->assertNotNull($approver->verification_locked_until);
        $this->assertTrue($approver->verification_locked_until->isFuture());
        $lockedUntil = $approver->verification_locked_until->getTimestamp();

        // Percobaan selama terkunci tidak boleh menyentuh baris: tidak mereset penghitung,
        // dan juga tidak memperpanjang masa kunci.
        foreach (['081299999999', '081211111111'] as $phone) {
            $response = $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => $phone])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('phone');
            // Approver harus diberi tahu kapan boleh mencoba lagi, bukan pesan generik.
            $this->assertStringContainsString('coba kembali dalam', $this->firstError($response, 'phone'));
        }

        $approver->refresh();
        $this->assertSame(5, (int) $approver->verification_attempts);
        $this->assertSame($lockedUntil, $approver->verification_locked_until->getTimestamp());
    }

    public function test_correct_phone_after_cooldown_works_and_resets_the_counter(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        [$link, $approver] = $this->makeExternalLink();

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081299999999'])
                ->assertUnprocessable();
        }

        $this->travel(16)->minutes();
        $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081211111111'])
            ->assertOk()
            ->assertJsonStructure(['status', 'message', 'data' => ['access_token', 'expires_at']]);

        $approver->refresh();
        $this->assertSame(0, (int) $approver->verification_attempts);
        $this->assertNull($approver->verification_locked_until);
        $this->assertNotNull($approver->verified_at);
    }

    /**
     * Kunci berikutnya harus lebih panjang. Tanpa eskalasi, "5 percobaan per 15 menit"
     * berlaku selamanya dan batasnya hanya memperlambat, bukan membatasi.
     */
    public function test_second_lockout_window_is_longer_than_the_first(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        [$link, $approver] = $this->makeExternalLink();

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081299999999'])
                ->assertUnprocessable();
        }
        $this->travel(16)->minutes();
        for ($attempt = 6; $attempt <= 10; $attempt++) {
            $this->postJson("/api/v1/uat-approvals/{$link}/verify", ['phone' => '081299999999'])
                ->assertUnprocessable();
        }

        $approver->refresh();
        // Penghitung tidak pernah kembali ke 0 karena kegagalan.
        $this->assertSame(10, (int) $approver->verification_attempts);
        $minutes = (int) round(($approver->verification_locked_until->getTimestamp() - now()->getTimestamp()) / 60);
        $this->assertSame(30, $minutes);
    }

    // ---------------------------------------------------------------------
    // Helper
    // ---------------------------------------------------------------------

    /**
     * Pesan validasi pertama untuk sebuah key.
     *
     * Kunci error di sini mengandung titik (`participants.6.id`) yang oleh
     * `TestResponse::json()` dibaca sebagai jalur bertingkat, sehingga pengambilan
     * langsung selalu menghasilkan `null`. Payload errornya diambil utuh lalu diindeks
     * dengan kunci literal.
     */
    private function firstError(\Illuminate\Testing\TestResponse $response, string $key): string
    {
        $errors = $response->json('errors');
        $this->assertArrayHasKey($key, $errors);

        return (string) $errors[$key][0];
    }

    /**
     * Link eksternal siap pakai untuk Pimpinan Grup Pemohon, beserta baris approver-nya.
     *
     * @return array{0: string, 1: UatApprover}
     */
    private function makeExternalLink(): array
    {
        $project = $this->makeFinalizedProject();
        $this->setRoster($project, $this->cleanRoster());
        $round = $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approval-rounds")
            ->assertCreated()
            ->json('data');
        $seat = collect($round['approvers'])->firstWhere('approval_role', 'requester_group_lead');
        $link = $this->actingAs($this->admin)
            ->postJson("/api/v1/projects/{$project->id}/uat-approvers/{$seat['id']}/link")
            ->assertOk()
            ->json('data.token');

        return [$link, UatApprover::findOrFail($seat['id'])];
    }

    /**
     * Roster yang lolos seluruh aturan: satu orang per slot approval sisi IT, `id` unik,
     * dan pemohon memakai akun `created_by`.
     */
    private function cleanRoster(): array
    {
        return [
            $this->internal('Pemohon UAT', 'requester', $this->requester->id),
            $this->external('Pimpinan Grup', 'requester_group_lead', '081211111111'),
            $this->external('Pimpinan Divisi', 'requester_division_lead', '081233333333'),
            $this->internal('Developer UAT', 'developer', $this->developer->id),
            $this->internal('Analyst PM', 'analyst_pm', $this->admin->id),
            $this->internal('Pimpinan Pengembangan', 'development_group_lead', $this->devLead->id),
            $this->internal('Pimpinan Divisi TI', 'technology_division_lead', $this->techLead->id),
        ];
    }

    private function setRoster(Project $project, array $participants): void
    {
        // `sit_uat_data` ditulis utuh: `update()` hanya menyimpan atribut yang kotor, dan
        // model di sini dapat basi setelah request sebelumnya.
        $project->refresh();
        $project->update([
            'sit_uat_data' => [...(array) $project->sit_uat_data, 'uat1_participants' => $participants],
        ]);
    }

    private function makeFinalizedProject(): Project
    {
        $project = Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Pengerasan Approval UAT',
            'description' => 'Pengujian keunikan approver dan rate limit verifikasi.',
            'created_by' => $this->requester->id,
            'pm_id' => $this->admin->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::UAT_IN_PROGRESS,
            'sit_uat_data' => [
                'activeUatStep' => 3,
                'uat1_participants' => [],
                'uat2_summary' => ['conclusion' => 'accepted', 'submittedAt' => now()->toIso8601String()],
                'uat2_scenarios' => [],
            ],
        ]);

        // Approver dengan posisi Developer hanya sah bila ia mengerjakan task proyek ini.
        ProjectTask::create([
            'project_id' => $project->id,
            'title' => 'Perbaikan alur transaksi',
            'status' => TaskStatus::DONE->value,
            'assignee_id' => $this->developer->id,
        ]);

        return $project;
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create(['code' => 'IT', 'name' => 'Divisi TI']);
        $adminRole = Role::create(['name' => UserRole::SUPER_ADMIN->value, 'display_name' => 'Super Admin']);
        $developerRole = Role::create(['name' => UserRole::DEVELOPER->value, 'display_name' => 'Developer']);
        $leadRole = Role::create(['name' => UserRole::DEVELOPMENT_LEAD->value, 'display_name' => 'Development Lead']);
        $requesterRole = Role::create(['name' => UserRole::BUSINESS_USER->value, 'display_name' => 'Business User']);

        $this->admin = $this->makeUser($adminRole, 'Admin', 'admin-hardening@nagari.co.id');
        $this->developer = $this->makeUser($developerRole, 'Developer UAT', 'dev-hardening@nagari.co.id');
        // Slot Pimpinan Grup Pengembangan dan Pimpinan Divisi Teknologi wajib dipegang dua
        // akun berbeda, jadi fixture-nya pun harus mencerminkan itu.
        $this->devLead = $this->makeUser($leadRole, 'Pimpinan Pengembangan', 'devlead-hardening@nagari.co.id');
        $this->techLead = $this->makeUser($leadRole, 'Pimpinan Divisi TI', 'techlead-hardening@nagari.co.id');
        $this->requester = $this->makeUser($requesterRole, 'Pemohon UAT', 'pemohon-hardening@nagari.co.id');
    }

    private function makeUser(Role $role, string $name, string $email): User
    {
        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $role->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }

    private function external(string $name, string $role, string $phone): array
    {
        return [
            'id' => (string) \Illuminate\Support\Str::uuid(), 'name' => $name, 'role' => $name,
            'unit' => 'Divisi Peminta', 'phone' => $phone, 'isApprover' => true,
            'approvalRole' => $role, 'approvalMode' => 'external_link', 'userId' => null,
        ];
    }

    private function internal(string $name, string $role, int $userId): array
    {
        return [
            'id' => (string) \Illuminate\Support\Str::uuid(), 'name' => $name, 'role' => $name,
            'unit' => 'Divisi TI', 'phone' => '', 'isApprover' => true,
            'approvalRole' => $role, 'approvalMode' => 'internal_account', 'userId' => $userId,
        ];
    }
}
