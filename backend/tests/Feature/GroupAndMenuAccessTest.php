<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Group;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Grup kerja sebagai data (`/api/v1/groups`) dan pembatasan menu per role.
 *
 * Menjaga izin administrasi, larangan menghapus grup berisi role, akses Super Admin,
 * serta normalisasi daftar menu kosong menjadi null. Hak transisi berada di luar scope.
 */
class GroupAndMenuAccessTest extends TestCase
{
    use RefreshDatabase;

    private Division $division;

    private User $admin;

    private User $developer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create(['code' => 'IT-DEV', 'name' => 'Divisi Pengembangan TI']);
        $this->admin = $this->makeUser(UserRole::SUPER_ADMIN->value, 'Super Admin', 'admin-group@nagari.co.id');
        $this->developer = $this->makeUser(UserRole::DEVELOPER->value, 'Developer', 'developer-group@nagari.co.id');
    }

    public function test_migration_seeds_the_five_standard_groups(): void
    {
        // Backfill migration berjalan sebagai bagian dari `RefreshDatabase`, jadi grup
        // bawaan sudah ada tanpa seeder terpisah. Pengujian lain di kelas ini
        // mengandalkan grup itu, bukan membuat ulang kodenya.
        $codes = Group::orderBy('code')->pluck('code')->all();

        $this->assertSame(
            ['KEAMANAN-SIBER', 'MANAJEMEN-TI', 'PEMOHON', 'PENGEMBANGAN', 'PERENCANAAN-QA'],
            $codes
        );
    }

    public function test_super_admin_can_create_update_and_delete_group(): void
    {
        $created = $this->actingAs($this->admin)
            ->postJson('/api/v1/groups', [
                'code' => 'uji-coba',
                'name' => 'Grup Uji Coba',
                'description' => 'Grup sementara untuk pengujian.',
            ])
            ->assertCreated()
            // Kode dinormalkan menjadi huruf besar oleh Form Request, bukan oleh pemanggil.
            ->assertJsonPath('data.code', 'UJI-COBA')
            ->json('data');

        $this->assertDatabaseHas('groups', ['code' => 'UJI-COBA']);

        $this->actingAs($this->admin)
            ->patchJson("/api/v1/groups/{$created['id']}", ['name' => 'Grup Uji Coba Lanjutan'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Grup Uji Coba Lanjutan');

        $this->actingAs($this->admin)
            ->deleteJson("/api/v1/groups/{$created['id']}")
            ->assertOk();

        $this->assertDatabaseMissing('groups', ['id' => $created['id']]);
    }

    public function test_group_code_must_be_unique(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/v1/groups', ['code' => 'PENGEMBANGAN', 'name' => 'Grup Pengembangan Lain'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    public function test_non_admin_cannot_manage_groups_but_can_read_them(): void
    {
        $group = $this->developmentGroup();

        $this->actingAs($this->developer)
            ->postJson('/api/v1/groups', ['code' => 'BARU', 'name' => 'Grup Baru'])
            ->assertForbidden();

        $this->actingAs($this->developer)
            ->patchJson("/api/v1/groups/{$group->id}", ['name' => 'Diubah Diam-diam'])
            ->assertForbidden();

        $this->actingAs($this->developer)
            ->deleteJson("/api/v1/groups/{$group->id}")
            ->assertForbidden();

        $codes = $this->actingAs($this->developer)
            ->getJson('/api/v1/groups')
            ->assertOk()
            ->json('data.*.code');

        $this->assertContains('PENGEMBANGAN', $codes);
    }

    public function test_group_with_roles_cannot_be_deleted(): void
    {
        $group = $this->developmentGroup();
        Role::where('name', UserRole::DEVELOPER->value)->update(['group_id' => $group->id]);

        $this->actingAs($this->admin)
            ->deleteJson("/api/v1/groups/{$group->id}")
            ->assertStatus(422);

        $this->assertDatabaseHas('groups', ['id' => $group->id]);
    }

    public function test_group_listing_counts_roles_and_users(): void
    {
        $group = $this->developmentGroup();
        Role::where('name', UserRole::DEVELOPER->value)->update(['group_id' => $group->id]);
        $this->makeUser(UserRole::DEVELOPER->value, 'Developer Kedua', 'developer2-group@nagari.co.id');

        $payload = collect(
            $this->actingAs($this->admin)
                ->getJson('/api/v1/groups')
                ->assertOk()
                ->json('data')
        )->firstWhere('code', 'PENGEMBANGAN');

        $this->assertSame(1, $payload['roles_count']);
        // Dua developer memakai role yang sama, jadi jumlah pengguna grup adalah dua.
        $this->assertSame(2, $payload['users_count']);
        $this->assertSame(UserRole::DEVELOPER->value, $payload['roles'][0]['name']);
    }

    public function test_role_can_be_assigned_to_group_and_given_menu_access(): void
    {
        $group = $this->developmentGroup();
        $role = Role::where('name', UserRole::DEVELOPER->value)->firstOrFail();

        $this->actingAs($this->admin)
            ->patchJson("/api/v1/roles/{$role->id}", [
                'group_id' => $group->id,
                'menu_access' => ['/dashboard', '/my-tasks', '/dashboard'],
            ])
            ->assertOk()
            ->assertJsonPath('data.group.code', 'PENGEMBANGAN');

        // Path ganda dibuang saat penyimpanan agar daftar tersimpan sama dengan yang
        // ditampilkan kembali.
        $this->assertSame(['/dashboard', '/my-tasks'], $role->fresh()->menuAccessPaths());
    }

    public function test_empty_menu_access_is_stored_as_no_restriction(): void
    {
        $role = Role::where('name', UserRole::DEVELOPER->value)->firstOrFail();
        $role->update(['menu_access' => ['/dashboard']]);

        $this->actingAs($this->admin)
            ->patchJson("/api/v1/roles/{$role->id}", ['menu_access' => []])
            ->assertOk();

        $this->assertNull($role->fresh()->menu_access);
        $this->assertNull($role->fresh()->menuAccessPaths());
    }

    public function test_super_admin_menu_access_cannot_be_restricted(): void
    {
        $role = Role::where('name', UserRole::SUPER_ADMIN->value)->firstOrFail();

        $this->actingAs($this->admin)
            ->patchJson("/api/v1/roles/{$role->id}", ['menu_access' => ['/dashboard']])
            ->assertStatus(422)
            ->assertJsonValidationErrors('menu_access');

        $this->assertNull($role->fresh()->menu_access);
    }

    public function test_role_menu_access_is_exposed_on_authenticated_profile(): void
    {
        $role = Role::where('name', UserRole::DEVELOPER->value)->firstOrFail();
        $role->update(['menu_access' => ['/dashboard', '/my-tasks']]);

        $this->actingAs($this->developer)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.role_detail.menu_access', ['/dashboard', '/my-tasks']);
    }

    public function test_deleting_group_does_not_delete_its_roles(): void
    {
        $group = $this->developmentGroup();
        $role = Role::where('name', UserRole::DEVELOPER->value)->firstOrFail();
        $role->update(['group_id' => $group->id]);

        // Grup dikosongkan lebih dulu karena penghalang di controller, lalu dihapus.
        $role->update(['group_id' => null]);
        $group->delete();

        $this->assertDatabaseHas('roles', ['id' => $role->id, 'group_id' => null]);
        $this->assertDatabaseHas('users', ['id' => $this->developer->id, 'role_id' => $role->id]);
    }

    private function developmentGroup(): Group
    {
        return Group::where('code', 'PENGEMBANGAN')->firstOrFail();
    }

    private function makeUser(string $roleName, string $name, string $email): User
    {
        $role = Role::firstOrCreate(['name' => $roleName], ['display_name' => $name]);

        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $role->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }
}
