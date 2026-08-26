<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Jumlah notifikasi per halaman bila klien tidak menentukannya.
     *
     * Lonceng di topbar hanya menampilkan halaman pertama, jadi nilainya dipilih
     * cukup besar untuk menutupi riwayat yang masih relevan tanpa mengirim
     * seluruh kotak masuk pada setiap putaran polling.
     */
    private const DEFAULT_PER_PAGE = 20;

    /**
     * Batas atas `per_page`. Kotak masuk notifikasi tumbuh terus tanpa pernah
     * dipangkas, sehingga satu permintaan `?per_page=100000` dapat memaksa server
     * memuat ribuan baris sekaligus. Batasnya lebih rendah daripada milik
     * `ProjectController` (200) karena tidak ada layar yang perlu menelusuri
     * seluruh notifikasi — yang dibutuhkan hanyalah yang terbaru.
     */
    private const MAX_PER_PAGE = 100;

    /**
     * Kotak masuk notifikasi milik pengguna yang sedang masuk.
     *
     * Bentuk balasannya mengikuti kontrak envelope proyek — koleksi di `data`,
     * pagination di `meta` — sama seperti `ProjectController::index()` dan
     * `ActivityLogController::index()`. Sebelumnya paginator Laravel dikirim utuh
     * sebagai `data`, sehingga `data` berisi objek (`current_page`, `links`,
     * `data` bersarang, dan URL absolut halaman berikutnya) alih-alih daftar
     * notifikasi. Klien apa pun yang mengandalkan kontrak itu harus menempuh
     * `data.data` khusus untuk endpoint ini, dan `meta` tidak pernah ada.
     */
    public function index(Request $request): JsonResponse
    {
        // Divalidasi, bukan dijepit diam-diam: `per_page=abc` sebelumnya diteruskan
        // apa adanya ke `paginate()` dan menjadi 0 saat dikonversi, yang pada
        // MySQL berarti "LIMIT 0" — daftar kosong tanpa satu pun keterangan
        // kesalahan. Penolakan 422 memberi tahu kliennya bahwa yang salah adalah
        // permintaannya, bukan datanya yang habis.
        $validated = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:' . self::MAX_PER_PAGE],
        ]);

        $userId = $request->user()->id;
        $perPage = (int) ($validated['per_page'] ?? self::DEFAULT_PER_PAGE);

        $notifications = Notification::where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            // Pemecah imbang wajib. Notifikasi ditulis borongan oleh
            // `ProjectWorkflowService` dan `TestingTrackService` memakai satu nilai
            // `now()` untuk seluruh baris pada satu peristiwa, dan kolom `timestamps()`
            // tidak menyimpan pecahan detik. Tanpa urutan kedua yang pasti, urutan
            // antar baris berwaktu sama tidak dijamin database, sehingga satu baris
            // bisa muncul di dua halaman sekaligus atau terlewat sama sekali.
            ->orderBy('id', 'desc')
            ->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'message' => 'Daftar notifikasi berhasil dimuat.',
            'data' => collect($notifications->items())
                ->map(fn (Notification $notification): array => $notification->toApiArray())
                ->all(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page'    => $notifications->lastPage(),
                'per_page'     => $notifications->perPage(),
                'total'        => $notifications->total(),
                // Lencana lonceng menghitung seluruh kotak masuk, bukan hanya halaman
                // yang sedang dibuka. Bila frontend menghitungnya sendiri dari `data`,
                // angkanya terpotong pada `per_page` — pengguna dengan 30 notifikasi
                // belum dibaca akan melihat "20". Dihitung di sini karena hanya satu
                // `COUNT` beralas indeks `user_id`, dan alternatifnya adalah endpoint
                // kedua yang dipanggil pada setiap putaran polling yang sama.
                'unread_count' => Notification::where('user_id', $userId)
                    ->where('is_read', false)
                    ->count(),
            ],
        ]);
    }

    /**
     * Tandai satu notifikasi sebagai sudah dibaca.
     *
     * Pemeriksaan pemilik digabung ke dalam kueri, jadi id milik orang lain dan id
     * yang tidak ada sama-sama berakhir 403 dengan pesan yang sama. Itu memang
     * disengaja: membedakan keduanya (404 vs 403) akan mengubah endpoint ini
     * menjadi alat untuk menghitung jumlah notifikasi orang lain.
     */
    public function markRead(Request $request, int $id): JsonResponse
    {
        $notification = Notification::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $notification) {
            return response()->json([
                'status' => 'error',
                'message' => 'Notifikasi tidak ditemukan atau bukan milik Anda.',
            ], 403);
        }

        $notification->update(['is_read' => true]);

        return response()->json([
            'status' => 'success',
            'message' => 'Notifikasi ditandai telah dibaca.',
            // Model mentah sebelumnya dikirim langsung, sehingga bentuk satu
            // notifikasi pada endpoint ini berbeda dengan bentuknya di `index()`:
            // `created_at` berupa string database, bukan ISO 8601. Klien yang
            // menimpa item lamanya dengan balasan ini akan mendapati formatnya
            // berubah setelah diklik.
            'data' => $notification->toApiArray(),
            'meta' => [
                // Klien memerlukan angka lencana yang baru tanpa harus memuat ulang
                // seluruh daftar hanya karena satu baris berubah.
                'unread_count' => Notification::where('user_id', $request->user()->id)
                    ->where('is_read', false)
                    ->count(),
            ],
        ]);
    }

    /**
     * Tandai seluruh notifikasi belum dibaca milik pengguna sebagai sudah dibaca.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $affected = Notification::where('user_id', $request->user()->id)
            // Saringan `is_read = false` bukan hanya optimasi: tanpanya `updated_at`
            // seluruh baris ikut tergeser setiap kali tombol ini ditekan, padahal
            // pada baris yang sudah dibaca kolom itulah satu-satunya jejak kapan
            // pengguna membacanya. `update()` juga mengembalikan jumlah baris yang
            // benar-benar berubah, yang dipakai sebagai `updated_count` di bawah.
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json([
            'status' => 'success',
            'message' => 'Semua notifikasi ditandai telah dibaca.',
            // Envelope proyek selalu menyertakan `data`; sebelumnya kunci itu hilang
            // di sini, sehingga klien yang membaca `res.data` mendapat `undefined`
            // dan tidak bisa membedakan sukses dari balasan yang cacat.
            'data' => [
                'updated_count' => $affected,
                // Selalu 0 setelah operasi ini berhasil, tetapi dikirim eksplisit agar
                // klien memakai satu sumber angka lencana yang sama untuk ketiga
                // endpoint notifikasi.
                'unread_count' => 0,
            ],
        ]);
    }
}
