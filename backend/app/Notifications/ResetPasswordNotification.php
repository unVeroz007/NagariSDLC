<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Email berisi tautan reset password.
 *
 * Notifikasi bawaan Laravel mengarahkan penerima ke route bernama `password.reset`
 * di sisi backend. Aplikasi ini memisahkan backend (API) dari frontend (SPA), dan
 * halaman penyetelan password baru berada di frontend pada `/reset-password`.
 * Karena itu tautannya dibangun sendiri dari `app.frontend_url`, dengan `token` dan
 * `email` sebagai query string — dua nilai itulah yang dikirim balik oleh formulir
 * ke `POST /auth/reset-password`.
 *
 * `email` ikut dibawa di tautan supaya pengguna tidak perlu mengetiknya ulang; ia
 * bukan rahasia dan bukan pengaman. Satu-satunya pengaman adalah `token`, yang
 * disimpan dalam bentuk hash pada `password_reset_tokens`, hanya berlaku
 * `config('auth.passwords.users.expire')` menit, dan dihapus begitu dipakai.
 *
 * Isi email ditulis dalam Bahasa Indonesia karena seluruh antarmuka aplikasi ini
 * berbahasa Indonesia.
 */
class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(
        /** Token mentah (belum di-hash) yang dikirim ke pengguna. */
        public string $token
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $expireMinutes = (int) config('auth.passwords.users.expire', 60);

        return (new MailMessage)
            ->subject('Reset Password Akun Nagari SDLC')
            ->greeting("Halo {$notifiable->name},")
            ->line('Kami menerima permintaan reset password untuk akun Nagari SDLC Anda.')
            ->action('Setel Password Baru', $this->resetUrl($notifiable))
            ->line("Tautan ini hanya berlaku {$expireMinutes} menit dan hanya dapat dipakai satu kali.")
            ->line('Jika Anda tidak meminta reset password, abaikan email ini — password Anda tidak berubah.')
            ->salutation('Terima kasih, Tim Teknologi Informasi Bank Nagari');
    }

    /**
     * Alamat halaman penyetelan password baru di frontend.
     *
     * `rtrim` mencegah garis miring ganda bila `FRONTEND_URL` diakhiri `/`, dan
     * `http_build_query` memastikan token ter-encode dengan benar — token Laravel
     * dapat memuat karakter yang harus di-escape di dalam URL.
     */
    private function resetUrl(object $notifiable): string
    {
        $baseUrl = rtrim((string) config('app.frontend_url'), '/');

        $query = http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);

        return "{$baseUrl}/reset-password?{$query}";
    }
}
