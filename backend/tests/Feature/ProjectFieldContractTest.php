<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak field proyek yang dibaca frontend: `rbbDeadline`, `priority`, dan wewenang
 * pengajuan proyek baru.
 *
 * Tiga cacat yang diuji di sini:
 *
 *   1. `rbbDeadline` dibaca di 17 tempat pada frontend dan didokumentasikan di
 *      `docs/API_CONTRACT.md`, tetapi kolomnya tidak pernah ada. Panel "Proyek RBB
 *      mendekati deadline" pada `Dashboard.jsx` karena itu selalu kosong.
 *
 *   2. `PATCH /projects/{id}` menerima `priority` dengan status 200 lalu membuangnya
 *      diam-diam: kuncinya tidak ada di `UpdateProjectRequest::rules()`, sehingga tidak
 *      pernah masuk ke `validated()` maupun ke payload update. Pengguna melihat
 *      konfirmasi berhasil untuk perubahan yang tidak tersimpan.
 *
 *   3. `StoreProjectRequest::authorize()` mengembalikan true tanpa syarat, dan route
 *      `POST /projects` tidak memasang middleware `role:`. Satu-satunya penjaga
 *      pembuatan proyek adalah router frontend, yang dilewati begitu permintaan dikirim
 *      langsung ke API.
 */
class ProjectFieldContractTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $requester;

    private User $developer;

    private Division $division;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create(['name' => UserRole::SUPER_ADMIN->value, 'display_name' => 'Super Admin']);
        $businessRole = Role::create(['name' => UserRole::BUSINESS_USER->value, 'display_name' => 'Pemohon']);
        $developerRole = Role::create(['name' => UserRole::DEVELOPER->value, 'display_name' => 'Developer']);

        $this->division = Division::create(['code' => 'DSI', 'name' => 'Divisi Sistem Informasi']);

        $this->admin = $this->makeUser($adminRole, 'Super Admin', 'admin-field@nagari.co.id');
        $this->requester = $this->makeUser($businessRole, 'Pemohon Proyek', 'pemohon-field@nagari.co.id');
        $this->developer = $this->makeUser($developerRole, 'Developer Biasa', 'dev-field@nagari.co.id');
    }

    // ---------------------------------------------------------------------
    // rbbDeadline
    // ---------------------------------------------------------------------

    /**
     * Tenggat RBB bertahan dari pengajuan sampai kembali sebagai `rbbDeadline`.
     *
     * Bentuknya wajib sama persis dengan `target_date` (`Y-m-d`) karena pembacanya di
     * frontend memanggil `new Date(...)` langsung atas nilai ini.
     */
    public function test_rbb_deadline_survives_creation_and_returns_in_the_shape_frontend_reads(): void
    {
        $response = $this->actingAs($this->requester)->postJson('/api/v1/projects', [
            'title' => 'Pengembangan Mobile Banking',
            'description' => 'Kanal baru untuk nasabah ritel.',
            'division_id' => $this->division->id,
            'type' => 'RBB',
            'target_date' => '2026-11-30',
            'rbbDeadline' => '2026-12-31',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.rbbDeadline', '2026-12-31')
            // Gaya snake_case ikut dipaparkan seperti `analyst_result`/`analystResult`.
            ->assertJsonPath('data.rbb_deadline', '2026-12-31')
            ->assertJsonPath('data.target_date', '2026-11-30');

        // Dibandingkan lewat cast model, bukan string mentah: kolom `date` disimpan
        // sebagai `Y-m-d H:i:s` di sqlite pengujian namun terpotong menjadi tanggal saja
        // di MySQL produksi, jadi hanya bentuk terkanonkannya yang stabil lintas mesin.
        $stored = Project::where('title', 'Pengembangan Mobile Banking')->firstOrFail();
        $this->assertSame('2026-12-31', $stored->rbb_deadline?->format('Y-m-d'));
    }

    /**
     * Tenggat RBB boleh mendahului target internal, bahkan boleh sudah terlewat.
     *
     * Tidak ada aturan urutan terhadap `target_date`: panel dasbor justru menampilkan
     * "Terlewat" untuk tenggat yang sudah lampau, jadi menolaknya akan membuat kenyataan
     * proyek yang meleset tidak dapat dicatat.
     */
    public function test_rbb_deadline_may_precede_the_internal_target_date(): void
    {
        $this->actingAs($this->requester)->postJson('/api/v1/projects', [
            'title' => 'Proyek Tenggat Mendahului',
            'division_id' => $this->division->id,
            'target_date' => '2026-12-31',
            'rbbDeadline' => '2026-01-31',
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.rbbDeadline', '2026-01-31');
    }

    public function test_rbb_deadline_is_optional_on_creation(): void
    {
        $this->actingAs($this->requester)->postJson('/api/v1/projects', [
            'title' => 'Proyek Tanpa Tenggat RBB',
            'division_id' => $this->division->id,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.rbbDeadline', null);
    }

    public function test_invalid_rbb_deadline_is_refused_on_creation(): void
    {
        $this->actingAs($this->requester)->postJson('/api/v1/projects', [
            'title' => 'Proyek Tenggat Salah',
            'division_id' => $this->division->id,
            'rbbDeadline' => '31-31-2026',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.rbb_deadline.0', 'Tenggat RBB harus berupa tanggal yang sah.');

        $this->assertDatabaseMissing('projects', ['title' => 'Proyek Tenggat Salah']);
    }

    public function test_rbb_deadline_can_be_changed_and_cleared_through_patch(): void
    {
        $project = $this->makeProject(['rbb_deadline' => '2026-06-30']);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'rbbDeadline' => '2027-03-31',
        ])
            ->assertOk()
            ->assertJsonPath('data.rbbDeadline', '2027-03-31');

        $this->assertSame('2027-03-31', $project->fresh()->rbb_deadline?->format('Y-m-d'));

        // 'TBD' adalah sentinel tanggal kosong milik frontend. Nilainya harus benar-benar
        // mengosongkan kolom, bukan tersimpan sebagai teks maupun diabaikan.
        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'rbbDeadline' => 'TBD',
        ])
            ->assertOk()
            ->assertJsonPath('data.rbbDeadline', null);

        // Model dalam memori sudah usang setelah dua perubahan lewat HTTP; tanpa
        // `refresh()` pembacaan atributnya masih menampilkan nilai fixture semula.
        $project->refresh();
        $this->assertNull($project->rbb_deadline);
    }

    public function test_invalid_rbb_deadline_is_refused_on_patch(): void
    {
        $project = $this->makeProject(['rbb_deadline' => '2026-06-30']);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'rbbDeadline' => 'kapan-kapan',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.rbb_deadline.0', 'Tenggat RBB harus berupa tanggal yang sah.');

        $this->assertSame('2026-06-30', $project->fresh()->rbb_deadline?->format('Y-m-d'));
    }

    // ---------------------------------------------------------------------
    // priority
    // ---------------------------------------------------------------------

    public function test_priority_round_trips_through_patch(): void
    {
        $project = $this->makeProject(['priority' => 'Low']);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'priority' => 'High',
        ])
            ->assertOk()
            ->assertJsonPath('data.priority', 'High');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'priority' => 'High',
        ]);
    }

    /**
     * Padanan label lama tetap diterima di kedua pintu.
     *
     * Formulir versi lama mengirim `Urgent`/`Rendah`, sementara seluruh layar pembaca
     * membandingkan dengan `High|Medium|Low`. Pemetaannya dipakai bersama oleh jalur
     * pembuatan dan jalur pembaruan supaya klien lama tidak diterima di satu endpoint
     * lalu ditolak di endpoint lainnya.
     */
    public function test_legacy_priority_labels_are_canonicalised_on_both_doors(): void
    {
        $this->actingAs($this->requester)->postJson('/api/v1/projects', [
            'title' => 'Proyek Prioritas Lama',
            'division_id' => $this->division->id,
            'priority' => 'Urgent',
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.priority', 'High');

        $project = $this->makeProject(['priority' => 'High']);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'priority' => 'Rendah',
        ])
            ->assertOk()
            ->assertJsonPath('data.priority', 'Low');
    }

    public function test_priority_outside_the_vocabulary_is_refused(): void
    {
        $project = $this->makeProject(['priority' => 'Medium']);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'priority' => 'Sangat Penting',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.priority.0', 'Prioritas proyek harus salah satu dari: High, Medium, Low.');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'priority' => 'Medium',
        ]);
    }

    /**
     * Prioritas tidak dapat dikosongkan.
     *
     * Kolomnya NOT NULL dengan default `Medium` di database, jadi mengizinkan null hanya
     * akan menukar galat validasi dengan galat penulisan basis data.
     */
    public function test_priority_cannot_be_emptied_through_patch(): void
    {
        $project = $this->makeProject(['priority' => 'Medium']);

        $this->actingAs($this->admin)->patchJson("/api/v1/projects/{$project->id}", [
            'priority' => null,
        ])->assertStatus(422);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'priority' => 'Medium',
        ]);
    }

    // ---------------------------------------------------------------------
    // Wewenang pengajuan proyek baru
    // ---------------------------------------------------------------------

    public function test_developer_cannot_submit_a_new_project(): void
    {
        $this->actingAs($this->developer)->postJson('/api/v1/projects', [
            'title' => 'Proyek Dari Developer',
            'division_id' => $this->division->id,
        ])
            ->assertStatus(403)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath(
                'message',
                'Pengajuan proyek baru hanya dapat dilakukan oleh Pemohon (Business User), Head of IT, atau Super Admin.'
            );

        $this->assertDatabaseMissing('projects', ['title' => 'Proyek Dari Developer']);
        // Wewenang ditolak sebelum apa pun tercatat; log aktivitas tidak boleh menyatakan
        // pengajuan itu pernah terjadi.
        $this->assertDatabaseMissing('activity_logs', ['action' => 'create_project']);
    }

    public function test_requester_can_submit_a_new_project(): void
    {
        $this->actingAs($this->requester)->postJson('/api/v1/projects', [
            'title' => 'Proyek Dari Pemohon',
            'division_id' => $this->division->id,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.status', ProjectStatus::PENDING->value);

        $this->assertDatabaseHas('projects', [
            'title' => 'Proyek Dari Pemohon',
            'created_by' => $this->requester->id,
        ]);
    }

    public function test_super_admin_can_submit_a_new_project(): void
    {
        $this->actingAs($this->admin)->postJson('/api/v1/projects', [
            'title' => 'Proyek Dari Admin',
            'division_id' => $this->division->id,
        ])->assertStatus(201);
    }

    // ---------------------------------------------------------------------
    // Fixture
    // ---------------------------------------------------------------------

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

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function makeProject(array $attributes = []): Project
    {
        return Project::create([
            'req_id' => Project::generateReqId(),
            'title' => 'Proyek Kontrak Field',
            'created_by' => $this->requester->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
            ...$attributes,
        ]);
    }
}
