<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Notification;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kotak masuk notifikasi.
 *
 * Endpoint `index` dahulu mengirim paginator Laravel utuh sebagai `data`, sehingga
 * `data` berisi objek pagination dengan daftar sebenarnya bersarang di
 * `data.data`, dan `meta` tidak ada. Pengujian ini menjaga bentuk envelope
 * proyek — koleksi di `data`, pagination di `meta` — sekaligus memastikan kotak
 * masuk satu pengguna tidak dapat dibaca atau diubah pengguna lain.
 */
class NotificationTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $stranger;

    protected function setUp(): void
    {
        parent::setUp();

        $division = Division::create(['code' => 'IT-NOTIF', 'name' => 'Divisi Teknologi Informasi']);

        $this->owner = $this->makeUser(UserRole::PROJECT_MANAGER, 'pm-notif@nagari.co.id', $division);
        $this->stranger = $this->makeUser(UserRole::DEVELOPER, 'dev-notif@nagari.co.id', $division);
    }

    public function test_index_puts_collection_in_data_and_pagination_in_meta(): void
    {
        $this->makeNotification($this->owner, 'Proyek Ditolak', 'Perlu perbaikan dokumen.', 'warning', false);
        $this->makeNotification($this->owner, 'Pembaruan Alur Kerja', 'Proyek masuk fase QA.', 'info', true);

        $response = $this->actingAs($this->owner)->getJson('/api/v1/notifications');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            // Envelope proyek mewajibkan `message`; endpoint ini sebelumnya tidak punya.
            ->assertJsonPath('message', 'Daftar notifikasi berhasil dimuat.')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 1)
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.unread_count', 1);

        // Inti perbaikannya: `data` adalah daftar berindeks 0..n, bukan objek
        // paginator. Bila paginator kembali dikirim utuh, nilai ini menjadi objek
        // berkunci `current_page`/`links`/`data` dan pemeriksaan ini gagal.
        $data = $response->json('data');
        $this->assertTrue(array_is_list($data), 'data harus berupa array notifikasi, bukan objek paginator.');

        $this->assertSame(
            ['id', 'title', 'message', 'type', 'is_read', 'created_at'],
            array_keys($data[0]),
            'Bentuk satu notifikasi harus tetap seperti Notification::toApiArray().',
        );

        // Pagination tidak boleh ikut bocor ke dalam `data`.
        $response->assertJsonMissingPath('data.current_page')
            ->assertJsonMissingPath('data.links');
    }

    public function test_index_returns_newest_first_including_rows_sharing_a_timestamp(): void
    {
        // Notifikasi ditulis borongan dengan satu nilai `now()` untuk seluruh baris
        // (lihat `ProjectWorkflowService` dan `TestingTrackService`), jadi urutannya
        // wajib punya pemecah imbang yang pasti.
        $shared = now()->subMinute();
        $this->makeNotification($this->owner, 'Borongan A', 'Pesan A.', 'info', false, $shared);
        $this->makeNotification($this->owner, 'Borongan B', 'Pesan B.', 'info', false, $shared);
        $this->makeNotification($this->owner, 'Paling Baru', 'Pesan C.', 'info', false, now());

        $titles = $this->actingAs($this->owner)
            ->getJson('/api/v1/notifications')
            ->assertStatus(200)
            ->json('data.*.title');

        $this->assertSame(['Paling Baru', 'Borongan B', 'Borongan A'], $titles);
    }

    public function test_index_only_returns_notifications_owned_by_the_caller(): void
    {
        $this->makeNotification($this->owner, 'Milik Saya', 'Untuk PM.', 'info', false);
        $this->makeNotification($this->stranger, 'Milik Orang Lain', 'Untuk developer.', 'info', false);

        $response = $this->actingAs($this->owner)->getJson('/api/v1/notifications');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Milik Saya')
            // `unread_count` juga wajib dibatasi pada pemiliknya — angka ini yang
            // dipakai sebagai lencana lonceng.
            ->assertJsonPath('meta.unread_count', 1);
    }

    public function test_index_rejects_invalid_per_page(): void
    {
        $this->makeNotification($this->owner, 'Satu', 'Pesan.', 'info', false);

        foreach (['abc', '0', '-5', '101', '1.5'] as $invalid) {
            $this->actingAs($this->owner)
                ->getJson("/api/v1/notifications?per_page={$invalid}")
                ->assertStatus(422)
                ->assertJsonPath('status', 'error')
                ->assertJsonValidationErrors(['per_page']);
        }

        // `per_page` yang sah tetap dihormati. Sebelumnya nilai apa pun — termasuk
        // `abc` yang menjadi 0 dan berarti LIMIT 0 — diteruskan langsung ke paginate().
        $this->actingAs($this->owner)
            ->getJson('/api/v1/notifications?per_page=1')
            ->assertStatus(200)
            ->assertJsonPath('meta.per_page', 1);
    }

    public function test_index_unread_count_covers_the_whole_inbox_not_just_the_page(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->makeNotification($this->owner, "Belum Dibaca {$i}", 'Pesan.', 'info', false);
        }

        $this->actingAs($this->owner)
            ->getJson('/api/v1/notifications?per_page=1')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 3)
            // Bila angka ini dihitung dari halaman yang termuat, hasilnya 1 dan lencana
            // lonceng akan mengecilkan kenyataan.
            ->assertJsonPath('meta.unread_count', 3);
    }

    public function test_mark_read_flips_the_row_and_returns_the_same_shape_as_index(): void
    {
        $notification = $this->makeNotification($this->owner, 'Perlu Dibaca', 'Pesan.', 'info', false);

        $response = $this->actingAs($this->owner)
            ->patchJson("/api/v1/notifications/{$notification->id}/read");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.id', $notification->id)
            ->assertJsonPath('data.is_read', true)
            ->assertJsonPath('meta.unread_count', 0);

        // Bentuknya harus identik dengan satu item pada `index`, supaya klien boleh
        // menimpa item lamanya dengan balasan ini tanpa formatnya berubah.
        $this->assertSame(
            ['id', 'title', 'message', 'type', 'is_read', 'created_at'],
            array_keys($response->json('data')),
        );

        $this->assertTrue($notification->fresh()->is_read);
    }

    public function test_mark_read_on_someone_elses_notification_is_refused(): void
    {
        $foreign = $this->makeNotification($this->stranger, 'Bukan Milik Anda', 'Pesan.', 'info', false);

        $this->actingAs($this->owner)
            ->patchJson("/api/v1/notifications/{$foreign->id}/read")
            ->assertStatus(403)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('message', 'Notifikasi tidak ditemukan atau bukan milik Anda.');

        $this->assertFalse($foreign->fresh()->is_read, 'Notifikasi orang lain tidak boleh berubah.');

        // Id yang tidak ada dibalas sama, bukan 404: membedakannya akan mengubah
        // endpoint ini menjadi alat menghitung notifikasi orang lain.
        $this->actingAs($this->owner)
            ->patchJson('/api/v1/notifications/999999/read')
            ->assertStatus(403);
    }

    public function test_mark_all_read_flips_only_the_callers_unread_rows(): void
    {
        $mineUnread = $this->makeNotification($this->owner, 'Belum Dibaca', 'Pesan.', 'info', false);
        $mineRead = $this->makeNotification($this->owner, 'Sudah Dibaca', 'Pesan.', 'info', true);
        $foreignUnread = $this->makeNotification($this->stranger, 'Milik Orang Lain', 'Pesan.', 'info', false);

        // Waktu baca baris yang sudah dibaca tidak boleh tergeser oleh sapuan ini —
        // itulah satu-satunya jejak kapan pengguna membacanya.
        $readAtBefore = $mineRead->fresh()->updated_at;

        $response = $this->actingAs($this->owner)->patchJson('/api/v1/notifications/read-all');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('message', 'Semua notifikasi ditandai telah dibaca.')
            // `data` sebelumnya tidak ada sama sekali pada balasan ini.
            ->assertJsonPath('data.updated_count', 1)
            ->assertJsonPath('data.unread_count', 0);

        $this->assertTrue($mineUnread->fresh()->is_read);
        $this->assertFalse($foreignUnread->fresh()->is_read, 'Kotak masuk pengguna lain tidak boleh tersentuh.');
        $this->assertEquals($readAtBefore, $mineRead->fresh()->updated_at);

        // Pemanggilan kedua tidak menemukan baris untuk diubah.
        $this->actingAs($this->owner)
            ->patchJson('/api/v1/notifications/read-all')
            ->assertStatus(200)
            ->assertJsonPath('data.updated_count', 0);
    }

    public function test_notification_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/notifications')->assertStatus(401);
        $this->patchJson('/api/v1/notifications/1/read')->assertStatus(401);
        $this->patchJson('/api/v1/notifications/read-all')->assertStatus(401);
    }

    private function makeNotification(
        User $user,
        string $title,
        string $message,
        string $type,
        bool $isRead,
        $createdAt = null,
    ): Notification {
        $notification = Notification::create([
            'user_id' => $user->id,
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'is_read' => $isRead,
        ]);

        if ($createdAt !== null) {
            // `created_at` bukan kolom fillable, jadi diisi paksa. Dipakai pengujian
            // urutan untuk meniru penulisan borongan berwaktu sama.
            $notification->forceFill(['created_at' => $createdAt])->saveQuietly();
        }

        return $notification;
    }

    private function makeUser(UserRole $role, string $email, Division $division): User
    {
        $roleRow = Role::firstOrCreate(
            ['name' => $role->value],
            ['display_name' => $role->label()]
        );

        return User::create([
            'name' => $role->label(),
            'email' => $email,
            'password' => bcrypt('password123'),
            'role_id' => $roleRow->id,
            'division_id' => $division->id,
            'is_active' => true,
        ]);
    }
}
