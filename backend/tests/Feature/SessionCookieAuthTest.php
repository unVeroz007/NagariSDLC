<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Role;
use App\Models\User;
use App\Support\SessionTokenCookie;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

/**
 * Sesi API berbasis cookie `HttpOnly`.
 *
 * Yang diuji di sini bukan sekadar "cookienya terpasang", melainkan bahwa token
 * benar-benar dapat dipakai tanpa pernah melewati JavaScript, bahwa jalur header
 * `Authorization` lama tetap hidup, dan bahwa cookie yang tertinggal setelah
 * logout tidak lagi bisa dipakai.
 */
class SessionCookieAuthTest extends TestCase
{
    use RefreshDatabase;

    protected Division $division;
    protected Role $role;
    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->division = Division::create(['code' => 'IT', 'name' => 'Divisi TI']);
        $this->role = Role::create([
            'name' => UserRole::SUPER_ADMIN->value,
            'display_name' => 'Super Admin',
        ]);

        $this->user = User::create([
            'name' => 'Admin Sesi',
            'email' => 'sesi@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $this->role->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }

    /**
     * Klien uji yang membawa cookie sesi, seperti peramban sungguhan.
     *
     * `withCredentials()` bukan hiasan: `MakesHttpRequests::prepareCookiesForJsonRequest()`
     * mengembalikan array kosong tanpanya, sehingga permintaan JSON di pengujian
     * berjalan tanpa satu pun cookie. Kebutuhan itu justru mencerminkan perilaku
     * peramban — `fetch()` juga hanya menyertakan cookie bila dipanggil dengan
     * `credentials: 'include'`.
     */
    protected function withSessionCookie(string $token): static
    {
        return $this
            ->withCredentials()
            ->withUnencryptedCookie(SessionTokenCookie::name(), $token);
    }

    /**
     * Lupakan guard yang sudah menyimpan hasil autentikasi sebelumnya.
     *
     * Artefak harness, bukan cacat produksi. Seluruh permintaan dalam satu
     * pengujian berbagi satu instance aplikasi, sehingga guard `sanctum` masih
     * memegang pengguna yang tadi berhasil diautentikasi dan permintaan
     * berikutnya lolos tanpa memeriksa ulang tokennya. Di produksi setiap
     * permintaan dilayani instance aplikasi baru, jadi token yang dicabut
     * langsung tertolak. Tanpa pemanggilan ini, pengujian pencabutan token
     * selalu menerima 200 dan justru menyembunyikan regresi yang dicari.
     */
    protected function forgetResolvedGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }

    /**
     * Login sekali, kembalikan token mentah beserta responsnya.
     *
     * @return array{0: \Illuminate\Testing\TestResponse, 1: string}
     */
    protected function login(): array
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'sesi@nagari.co.id',
            'password' => 'password123',
        ]);

        $response->assertOk();

        // Cookie ini tidak dienkripsi karena grup middleware `api` tidak memuat
        // `EncryptCookies` — parameter kedua `false` mencerminkan fakta itu, bukan
        // sekadar kemudahan pengujian.
        $cookie = $response->getCookie(SessionTokenCookie::name(), false);
        $this->assertNotNull($cookie, 'Respons login tidak melekatkan cookie sesi.');

        return [$response, $cookie->getValue()];
    }

    public function test_login_attaches_the_token_as_an_http_only_cookie(): void
    {
        [$response, $token] = $this->login();

        $cookie = $response->getCookie(SessionTokenCookie::name(), false);

        $this->assertTrue($cookie->isHttpOnly(), 'Cookie sesi wajib HttpOnly agar tidak terbaca JavaScript.');
        $this->assertSame(SessionTokenCookie::path(), $cookie->getPath());
        $this->assertSame(SessionTokenCookie::sameSite(), $cookie->getSameSite());
        $this->assertNotSame('', $token);

        // Nilai cookienya adalah token Sanctum yang sama, bukan turunan lain.
        $this->assertSame($response->json('data.token'), $token);

        // Frontend menjadwalkan penyegaran dari angka ini, jadi ia bagian dari kontrak.
        $this->assertSame(
            SessionTokenCookie::lifetimeMinutes(),
            $response->json('data.token_expires_in_minutes')
        );
    }

    public function test_cookie_alone_authenticates_a_request(): void
    {
        [, $token] = $this->login();

        $response = $this
            ->withSessionCookie($token)
            ->withHeader(SessionTokenCookie::requiredHeader(), 'XMLHttpRequest')
            ->getJson('/api/v1/auth/me');

        $response->assertOk()->assertJsonPath('data.email', 'sesi@nagari.co.id');
    }

    public function test_cookie_without_the_required_header_is_refused_without_ending_the_session(): void
    {
        [, $token] = $this->login();

        $response = $this
            ->withSessionCookie($token)
            ->getJson('/api/v1/auth/me');

        // 400, bukan 401. Frontend memicu logout otomatis pada 401, sehingga satu
        // pemanggilan yang lupa menyertakan header tidak boleh mengeluarkan pengguna.
        $response->assertStatus(400)
            ->assertJsonPath('status', 'error');
        $this->assertStringContainsString(
            SessionTokenCookie::requiredHeader(),
            (string) $response->json('message')
        );

        // Tokennya sendiri masih sah — yang ditolak hanya bentuk permintaannya.
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/auth/me')
            ->assertOk();
    }

    public function test_an_explicit_authorization_header_always_wins_over_the_cookie(): void
    {
        [, $token] = $this->login();

        // Cookie sampah dibiarkan terpasang. Bila middleware menimpa header yang
        // dikirim klien, permintaan ini akan gagal — dan setiap klien lama yang
        // masih memakai Bearer akan ikut rusak begitu cookienya kedaluwarsa.
        $this->withSessionCookie('token-tidak-berlaku')
            ->withHeader('Authorization', 'Bearer ' . $token)
            ->withHeader(SessionTokenCookie::requiredHeader(), 'XMLHttpRequest')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', 'sesi@nagari.co.id');
    }

    public function test_an_invalid_cookie_is_rejected(): void
    {
        $this->withSessionCookie('token-tidak-berlaku')
            ->withHeader(SessionTokenCookie::requiredHeader(), 'XMLHttpRequest')
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_logout_expires_the_cookie_and_revokes_the_token(): void
    {
        [, $token] = $this->login();

        $logout = $this
            ->withSessionCookie($token)
            ->withHeader(SessionTokenCookie::requiredHeader(), 'XMLHttpRequest')
            ->postJson('/api/v1/auth/logout');

        $logout->assertOk()->assertCookieExpired(SessionTokenCookie::name());

        // Cookie yang tertinggal di peramban lama tidak boleh tetap berfungsi.
        $this->forgetResolvedGuards();
        $this->withSessionCookie($token)
            ->withHeader(SessionTokenCookie::requiredHeader(), 'XMLHttpRequest')
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_refresh_rotates_the_token_and_reissues_the_cookie(): void
    {
        [, $token] = $this->login();

        $refresh = $this
            ->withSessionCookie($token)
            ->withHeader(SessionTokenCookie::requiredHeader(), 'XMLHttpRequest')
            ->postJson('/api/v1/auth/refresh');

        $refresh->assertOk();

        $newToken = $refresh->getCookie(SessionTokenCookie::name(), false)?->getValue();
        $this->assertNotNull($newToken);
        $this->assertNotSame($token, $newToken, 'Refresh harus menerbitkan token baru.');

        // Token lama dicabut, token barunya berlaku.
        $this->forgetResolvedGuards();
        $this->withSessionCookie($token)
            ->withHeader(SessionTokenCookie::requiredHeader(), 'XMLHttpRequest')
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        $this->forgetResolvedGuards();
        $this->withSessionCookie($newToken)
            ->withHeader(SessionTokenCookie::requiredHeader(), 'XMLHttpRequest')
            ->getJson('/api/v1/auth/me')
            ->assertOk();
    }

    public function test_the_token_can_be_withheld_from_the_response_body(): void
    {
        config(['auth_cookie.expose_token_in_body' => false]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'sesi@nagari.co.id',
            'password' => 'password123',
        ]);

        $response->assertOk();

        // `??` ikut menelan null, jadi keberadaan kuncinya diperiksa langsung.
        $this->assertArrayNotHasKey('token', (array) $response->json('data'));

        // Sesi tetap dapat dipakai: tokennya ada, hanya tidak pernah melewati JavaScript.
        $token = $response->getCookie(SessionTokenCookie::name(), false)?->getValue();
        $this->assertNotNull($token);

        $this->withSessionCookie($token)
            ->withHeader(SessionTokenCookie::requiredHeader(), 'XMLHttpRequest')
            ->getJson('/api/v1/auth/me')
            ->assertOk();
    }

    public function test_password_reset_expires_the_session_cookie(): void
    {
        $token = app('auth.password.broker')->createToken($this->user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'sesi@nagari.co.id',
            'password' => 'PasswordBaru123!',
            'password_confirmation' => 'PasswordBaru123!',
        ])
            ->assertOk()
            ->assertCookieExpired(SessionTokenCookie::name());
    }

    public function test_same_site_none_without_secure_is_refused_instead_of_silently_dropped(): void
    {
        config([
            'auth_cookie.same_site' => 'none',
            'auth_cookie.secure' => false,
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('AUTH_COOKIE_SAME_SITE=none');

        SessionTokenCookie::issue('token-apa-saja');
    }
}
