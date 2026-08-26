<?php

namespace App\Http\Requests\Project;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProjectRequest extends FormRequest
{
    /**
     * Kosakata prioritas proyek.
     *
     * Sama dengan `project_tasks.priority` dan dengan
     * `frontend/src/constants/projectPriority.js`. Bila salah satu berubah, ubah
     * ketiganya bersamaan — kalau tidak, pilihan pengaju ditolak validasi atau
     * tersimpan dengan nilai yang tidak dikenali layar pembacanya.
     */
    public const PRIORITIES = ['High', 'Medium', 'Low'];

    /**
     * Padanan label lama ke nilai kanonis.
     *
     * Form inisiasi pernah mengirim `Rendah|Medium|Urgent`, sementara seluruh layar
     * pembaca membandingkan dengan `High|Medium|Low`. Memetakan padanannya di sini
     * membuat klien versi lama tetap dapat mengajukan proyek tanpa ditolak validasi.
     */
    private const PRIORITY_ALIASES = [
        'high' => 'High',
        'tinggi' => 'High',
        'urgent' => 'High',
        'mendesak' => 'High',
        'medium' => 'Medium',
        'sedang' => 'Medium',
        'normal' => 'Medium',
        'low' => 'Low',
        'rendah' => 'Low',
    ];

    /**
     * Role yang berwenang mengajukan proyek baru.
     *
     * Nilai ini bukan aturan baru — ia menuliskan aturan yang sudah berlaku. Route
     * `POST /projects` tidak memasang middleware `role:`, jadi satu-satunya penjaga
     * pembuatan proyek selama ini adalah `BUSINESS_ROLES` pada
     * `frontend/src/router/index.jsx` yang mengawal halaman `/projects/new`. Daftarnya
     * disalin apa adanya supaya wewenangnya tidak melebar maupun menyempit, dan supaya
     * pemeriksaannya tetap hidup bila route dipasang ulang tanpa middleware.
     *
     * Preseden yang diikuti: `GET /dashboard/analytics` juga dikunci `role:super_admin`
     * di route agar cocok dengan daftar role halamannya (lihat `docs/AI_HANDOFF.md`
     * bagian 7). Server dan klien harus menyebut daftar yang sama.
     *
     * @var list<string>
     */
    public const CREATOR_ROLES = [
        'super_admin',
        'head_of_it',
        'business_user',
    ];

    /**
     * Nilai kanonis prioritas dari masukan klien, atau null bila tidak dikirim.
     *
     * Dipakai request ini dan `UpdateProjectRequest` agar padanan label lama hanya
     * ditulis satu kali; dua salinan pasti akan menyimpang.
     */
    public static function canonicalPriority(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $alias = strtolower(trim((string) $value));

        return self::PRIORITY_ALIASES[$alias] ?? (string) $value;
    }

    public function authorize(): bool
    {
        $user = $this->user();
        $user?->loadMissing('role');

        return in_array($user?->role?->name, self::CREATOR_ROLES, true);
    }

    protected function prepareForValidation(): void
    {
        $targetDate = $this->target_date ?? $this->targetDate;
        if ($targetDate === 'TBD' || empty($targetDate)) {
            $this->merge(['target_date' => null]);
        }

        if ($this->filled('priority')) {
            $this->merge([
                'priority' => self::canonicalPriority($this->priority),
            ]);
        }

        // `rbb_deadline` dikirim frontend dalam gaya camelCase (`rbbDeadline`), sama
        // seperti `targetDate`. Diseragamkan ke kunci snake_case supaya aturan validasi
        // dan penulisan kolomnya bekerja pada satu bentuk saja.
        $rbbDeadline = $this->input('rbb_deadline', $this->input('rbbDeadline'));
        if ($rbbDeadline === 'TBD' || $rbbDeadline === '') {
            $rbbDeadline = null;
        }
        if ($this->has('rbb_deadline') || $this->has('rbbDeadline')) {
            $this->merge(['rbb_deadline' => $rbbDeadline]);
        }
    }

    public function rules(): array
    {
        return [
            // FE bisa kirim 'title' ATAU 'name'
            'title'       => ['nullable', 'string', 'max:255'],
            'name'        => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'contact_phone' => ['nullable', 'string', 'max:30'],
            // FE bisa kirim 'division_id' (int) ATAU 'division' (string)
            'division_id' => ['nullable', 'exists:divisions,id'],
            'division'    => ['nullable', 'string'],
            'target_date' => ['nullable', 'date'],
            // Kosakata `type` dan `project_type` disamakan dengan
            // `UpdateProjectRequest`. Sebelumnya keduanya tidak dibatasi di sini —
            // `type` hanya `string`, dan `project_type` tidak divalidasi sama sekali
            // meskipun `ProjectController@store` menuliskannya langsung ke database.
            // Akibatnya proyek dapat lahir dengan nilai yang tidak dikenali
            // `RBBBadge` maupun `ProjectTypeBadge`, lalu nilai itu baru ditolak
            // ketika seseorang mencoba menyuntingnya lewat `PATCH`.
            'type'        => ['nullable', 'string', 'in:RBB,NON_RBB,Non-RBB'],
            'project_type' => ['nullable', 'string', 'in:baru,perbaikan,update'],
            'priority'    => ['nullable', 'string', Rule::in(self::PRIORITIES)],

            // Tenggat RBB (Rencana Bisnis Bank) — komitmen tahunan bank, berbeda dari
            // `target_date` yang merupakan target internal pengerjaan.
            //
            // Tidak `required_if:type,RBB`. `ProjectController@store` memakai
            // `$request->type ?? 'RBB'`, jadi hampir setiap pengajuan bertipe RBB;
            // mewajibkannya akan menolak semua pengajuan dari `ProjectNew.jsx` yang
            // sampai sekarang tidak punya input untuk field ini.
            //
            // Juga tidak ada aturan urutan terhadap `target_date`. Tenggat RBB boleh
            // mendahului target internal, bahkan boleh sudah terlewat: panel "Proyek RBB
            // mendekati deadline" di `Dashboard.jsx` justru menampilkan "Terlewat Nh"
            // untuk keadaan itu. Menolak tanggal lampau akan membuat kenyataan proyek
            // yang meleset tidak bisa dicatat.
            'rbb_deadline' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'priority.in' => 'Prioritas proyek harus salah satu dari: '.implode(', ', self::PRIORITIES).'.',
            'type.in' => 'Jenis proyek harus RBB atau Non-RBB.',
            'project_type.in' => 'Tipe proyek harus salah satu dari: baru, perbaikan, update.',
            'rbb_deadline.date' => 'Tenggat RBB harus berupa tanggal yang sah.',
        ];
    }

    /**
     * Pesan penolakan wewenang dalam Bahasa Indonesia.
     *
     * Tanpa ini Laravel mengembalikan "This action is unauthorized." berbahasa Inggris,
     * yang menembus ke layar pengguna.
     */
    protected function failedAuthorization(): void
    {
        throw new \Illuminate\Auth\Access\AuthorizationException(
            'Pengajuan proyek baru hanya dapat dilakukan oleh Pemohon (Business User), Head of IT, atau Super Admin.'
        );
    }

    /**
     * Pastikan minimal 'title' atau 'name' diisi.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            if (empty($this->title) && empty($this->name)) {
                $v->errors()->add('title', 'Nama/judul proyek wajib diisi.');
            }
        });
    }
}

