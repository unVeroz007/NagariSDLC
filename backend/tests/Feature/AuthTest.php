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

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected Division $division;
    protected Role $adminRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create(['code' => 'IT', 'name' => 'Divisi TI']);
        $this->adminRole = Role::create(['name' => UserRole::SUPER_ADMIN->value, 'display_name' => 'Super Admin']);
    }

    public function test_login_success()
    {
        User::create([
            'name' => 'Admin',
            'email' => 'admin@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $this->adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@nagari.co.id',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure(['data' => ['user', 'token']]);
    }

    public function test_login_wrong_password()
    {
        User::create([
            'name' => 'Admin',
            'email' => 'admin@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $this->adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@nagari.co.id',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401)
            ->assertJsonPath('status', 'error');
    }

    public function test_login_inactive_user()
    {
        User::create([
            'name' => 'Inactive User',
            'email' => 'inactive@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $this->adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'inactive@nagari.co.id',
            'password' => 'password123',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('status', 'error');
    }

    public function test_me_endpoint()
    {
        $user = User::create([
            'name' => 'Admin',
            'email' => 'admin@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $this->adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/auth/me');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.email', 'admin@nagari.co.id');
    }

    public function test_refresh_token()
    {
        $user = User::create([
            'name' => 'Admin',
            'email' => 'admin@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $this->adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/auth/refresh');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure(['data' => ['user', 'token']]);
    }

    public function test_logout()
    {
        $user = User::create([
            'name' => 'Admin',
            'email' => 'admin@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $this->adminRole->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/auth/logout');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }
}
