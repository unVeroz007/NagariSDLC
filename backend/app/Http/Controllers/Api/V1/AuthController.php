<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\Division;
use App\Models\Role;
use App\Models\User;
use App\Support\SessionTokenCookie;
use App\Traits\LogsActivity;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    use LogsActivity;

    /**
     * Peran tetap untuk setiap akun hasil pendaftaran mandiri.
     *
     * Dipatok di server dan tidak dapat dipengaruhi klien. `business_user` adalah
     * peran dengan hak paling sempit: visibilitasnya dibatasi pada proyek yang ia
     * ajukan sendiri (`projects.created_by`) oleh `ProjectAccessService`. Akun
     * berperan lain hanya boleh dibuat Super Admin lewat `POST /users`.
     */
    private const SELF_REGISTRATION_ROLE = 'business_user';

    /**
     * Daftar divisi resmi untuk formulir pendaftaran (publik, hanya baca).
     *
     * Formulir pendaftaran berada di luar sesi, jadi tidak dapat memakai
     * `GET /divisions` yang berada di balik `auth:sanctum`. Tanpa daftar ini
     * formulir harus menuliskan sendiri nama-nama divisi, dan pilihan yang tidak
     * cocok dengan master data itulah yang dahulu memaksa endpoint registrasi
     * membuat baris `divisions` baru dari masukan bebas.
     *
     * Hanya `id` dan `name` yang dikembalikan — cukup untuk mengisi dropdown,
     * tanpa membocorkan kode internal, deskripsi, maupun jumlah pegawai.
     */
    public function divisions(): JsonResponse
    {
        $divisions = Division::orderBy('name')->get(['id', 'name']);

        return response()->json([
            'status' => 'success',
            'data'   => $divisions,
        ]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $role = Role::where('name', self::SELF_REGISTRATION_ROLE)->first();

        // Tanpa baris peran ini, akun terbentuk dengan `role_id` kosong dan
        // `ProjectAccessService` akan menutup seluruh datanya. Lebih baik gagal
        // terang-terangan daripada membuat akun yang tidak bisa dipakai.
        if (! $role) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Peran "Business User" belum tersedia di sistem. Hubungi administrator.',
            ], 503);
        }

        // Divisi diambil dari baris yang sudah ada — RegisterRequest sudah
        // memastikan salah satu dari `division_id`/`department` menunjuk baris
        // yang terdaftar, jadi tidak ada lagi pembuatan divisi dari masukan bebas.
        $division = $request->filled('division_id')
            ? Division::find($request->integer('division_id'))
            : Division::where('name', $request->input('department'))->first();

        $user = User::create([
            'name'          => $request->validated('name'),
            'email'         => $request->validated('email'),
            'password'      => Hash::make($request->validated('password')),
            'role_id'       => $role->id,
            'division_id'   => $division?->id,
            'is_active'     => true,
            'phone_number'  => $request->validated('phone_number'),
        ]);

        $user->load(['role', 'division']);

        // Pendaftaran akun adalah peristiwa yang harus dapat diaudit, termasuk
        // ketika pelakunya belum punya sesi. `LogsActivity` menyimpan `user_id`
        // null untuk permintaan tanpa autentikasi, sehingga akun yang baru dibuat
        // dicantumkan sebagai subject agar jejaknya tetap dapat ditelusuri.
        $this->logActivity(
            'register_user',
            'Pendaftaran Akun Mandiri',
            "Akun \"{$user->name}\" ({$user->email}) mendaftar mandiri pada divisi "
                . ($division?->name ?? 'tidak diketahui')
                . ' dengan peran Business User.',
            $user
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Registrasi berhasil. Silakan login.',
            'data'    => new UserResource($user),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::with(['role', 'division'])
            ->where('email', $request->email)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email atau password salah.',
            ], 401);
        }

        if (! $user->is_active) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akun Anda dinonaktifkan. Hubungi administrator.',
            ], 403);
        }

        // Generate Sanctum token
        $token = $user->createToken('auth_token')->plainTextToken;

        return $this->respondWithSessionToken(
            $token,
            [
                'status' => 'success',
                'message' => 'Login berhasil.',
                'data' => [
                    'user' => new UserResource($user),
                ],
            ]
        );
    }

    /**
     * Bungkus respons login/refresh beserta cookie sesi `HttpOnly`.
     *
     * Token dilekatkan sebagai cookie yang tidak dapat dibaca JavaScript, dan
     * hanya ikut disertakan pada body ketika `auth_cookie.expose_token_in_body`
     * masih aktif — lihat berkas konfigurasinya untuk alasan mengapa nilai itu
     * sebaiknya dimatikan di produksi.
     *
     * @param  array<string, mixed>  $payload
     */
    private function respondWithSessionToken(string $token, array $payload): JsonResponse
    {
        if (SessionTokenCookie::exposesTokenInBody()) {
            $payload['data']['token'] = $token;
        }

        // Masa berlaku diberitahukan supaya frontend dapat menjadwalkan penyegaran
        // tanpa perlu memegang tokennya. Sebelumnya jadwal itu dihitung dari nilai
        // `VITE_TOKEN_EXPIRY_MINUTES` yang harus disamakan manual dengan
        // `SANCTUM_TOKEN_EXPIRATION` — dua sumber kebenaran untuk satu angka, dan
        // begitu keduanya berbeda penyegaran berjalan terlalu sering atau terlambat.
        $payload['data']['token_expires_in_minutes'] = SessionTokenCookie::lifetimeMinutes();

        return response()
            ->json($payload)
            ->withCookie(SessionTokenCookie::issue($token));
    }

    /**
     * Kirim tautan reset password ke email pengguna.
     *
     * Balasan endpoint ini SELALU sama, baik emailnya terdaftar maupun tidak. Balasan
     * yang berbeda akan menjadikan formulir "lupa password" alat untuk memeriksa
     * apakah seseorang punya akun di sistem internal bank, tanpa perlu login.
     *
     * Kredensial pencarian menyertakan `is_active => true`, sehingga akun yang
     * dinonaktifkan administrator tidak dapat memakai jalur ini untuk kembali masuk.
     * Akun yang sudah dihapus lunak tersaring otomatis oleh `SoftDeletes`.
     *
     * Satu pengecualian pada keseragaman balasan: pembatasan laju dari broker
     * password (`config('auth.passwords.users.throttle')` detik) dijawab 429, agar
     * pengguna yang menekan "kirim ulang" terlalu cepat tahu harus menunggu, bukan
     * menyangka emailnya hilang.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $email = $request->validated('email');

        $status = Password::sendResetLink([
            'email'     => $email,
            'is_active' => true,
        ]);

        $this->logActivity(
            'request_password_reset',
            'Meminta Reset Password',
            "Permintaan tautan reset password untuk email \"{$email}\".",
            null,
            ['email' => $email, 'broker_status' => $status],
            $status === Password::RESET_LINK_SENT ? 'success' : 'warning'
        );

        if ($status === Password::RESET_THROTTLED) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Permintaan reset password terlalu sering. Tunggu beberapa saat sebelum mencoba lagi.',
            ], 429);
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'Jika email tersebut terdaftar dan akunnya aktif, tautan reset password sudah dikirim. Silakan cek kotak masuk beserta folder Spam.',
        ]);
    }

    /**
     * Setel password baru memakai token dari tautan email.
     *
     * Broker password Laravel yang memeriksa tokennya: perbandingannya memakai
     * `Hash::check` terhadap nilai pada `password_reset_tokens`, masa berlakunya
     * dibatasi `config('auth.passwords.users.expire')` menit, dan barisnya dihapus
     * begitu berhasil dipakai — jadi satu tautan hanya sekali pakai.
     *
     * Token tidak valid, sudah kadaluarsa, email tidak terdaftar, dan akun
     * dinonaktifkan semuanya dijawab dengan satu pesan yang sama. Membedakannya akan
     * membocorkan keberadaan akun kepada pemegang token yang salah.
     *
     * Seluruh token Sanctum pengguna dihapus setelah reset berhasil. Reset password
     * adalah jalur pemulihan akun yang dicurigai bocor, sehingga sesi apa pun yang
     * masih terbuka — termasuk milik pihak yang menguasainya — harus ikut berakhir.
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $email = $request->validated('email');

        $status = Password::reset(
            [
                'email'                 => $email,
                'password'              => $request->validated('password'),
                'password_confirmation' => $request->input('password_confirmation'),
                'token'                 => $request->validated('token'),
                'is_active'             => true,
            ],
            function (User $user, string $password): void {
                $user->forceFill([
                    'password'       => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Cabut semua sesi yang masih berjalan pada akun ini.
                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            $this->logActivity(
                'reset_password',
                'Reset Password Gagal',
                "Upaya reset password untuk email \"{$email}\" ditolak.",
                null,
                ['email' => $email, 'broker_status' => $status],
                'error'
            );

            return response()->json([
                'status'  => 'error',
                'message' => 'Tautan reset password tidak valid atau sudah kadaluarsa. Silakan minta tautan baru.',
            ], 422);
        }

        // Pelakunya belum punya sesi, jadi `user_id` pada log bernilai null. Akun yang
        // dipulihkan dicantumkan sebagai subject agar jejaknya tetap dapat ditelusuri —
        // pola yang sama dipakai pendaftaran akun mandiri.
        $user = User::where('email', $email)->first();

        $this->logActivity(
            'reset_password',
            'Reset Password Berhasil',
            "Password akun \"{$email}\" berhasil disetel ulang lewat tautan reset.",
            $user,
            ['email' => $email]
        );

        // Cookie sesi peminta ikut dihapus. Seluruh token Sanctum akun ini baru saja
        // dicabut di atas, jadi cookie yang tertinggal hanya akan menghasilkan 401
        // pada permintaan berikutnya.
        return response()->json([
            'status'  => 'success',
            'message' => 'Password berhasil disetel ulang. Silakan login dengan password baru Anda.',
        ])->withCookie(SessionTokenCookie::forget());
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['role', 'division']);

        return response()->json([
            'status' => 'success',
            'data' => new UserResource($user),
        ]);
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $user->update([
            'name' => $data['name'],
            'phone_number' => $data['phone_number'] ?? null,
        ]);

        $user->load(['role', 'division']);

        $this->logActivity(
            'update_profile',
            'Memperbarui Profil Saya',
            "Pengguna \"{$user->name}\" memperbarui data profilnya."
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Profil berhasil diperbarui.',
            'data' => new UserResource($user),
        ]);
    }

    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Password saat ini tidak sesuai.',
            ], 422);
        }

        $user->update([
            'password' => Hash::make($data['new_password']),
        ]);

        $this->logActivity(
            'change_password',
            'Mengubah Password',
            "Pengguna \"{$user->name}\" berhasil memperbarui password akunnya."
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Password berhasil diperbarui.',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        // Cookienya ikut dihapus. Tanpa langkah ini peramban masih mengirim cookie
        // berisi token yang sudah dicabut pada setiap permintaan berikutnya, dan
        // pengguna melihat 401 alih-alih halaman masuk yang bersih.
        return response()
            ->json([
                'status' => 'success',
                'message' => 'Logout berhasil.',
            ])
            ->withCookie(SessionTokenCookie::forget());
    }

    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['role', 'division']);

        // Revoke old token and issue new one
        $request->user()->currentAccessToken()->delete();
        $newToken = $user->createToken('auth_token')->plainTextToken;

        return $this->respondWithSessionToken(
            $newToken,
            [
                'status' => 'success',
                'message' => 'Token berhasil diperbarui.',
                'data' => [
                    'user' => new UserResource($user),
                ],
            ]
        );
    }
}
