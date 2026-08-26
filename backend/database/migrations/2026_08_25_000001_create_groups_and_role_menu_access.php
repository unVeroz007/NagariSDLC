<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jadikan grup kerja sebagai data, dan jadikan kolom "Akses Menu" nyata.
 *
 * Sebelum ini konsep grup hanya hidup sebagai konstanta di kode
 * (`UserRole::PLANNING_QA_*`) sehingga tidak bisa dilihat maupun diatur dari halaman
 * Administrasi, sementara kolom "Akses Menu" pada daftar role selalu menampilkan
 * "Modul Standar" untuk semua role — nilai yang tidak pernah tersimpan dan tidak
 * pernah dibaca siapa pun.
 *
 * Tiga perubahan:
 *
 *   1. Tabel `groups` — grup kerja yang bisa dibuat dan diubah Super Admin.
 *   2. `roles.group_id` — role ditempatkan pada satu grup. Boleh kosong: role sistem
 *      seperti `super_admin` tidak mewakili unit kerja mana pun.
 *   3. `roles.menu_access` — daftar path menu yang boleh dilihat role tersebut.
 *      Kosong (NULL) berarti "tanpa pembatasan": sidebar memakai seluruh menu bawaan
 *      role itu. Kolom ini hanya MEMBATASI tampilan; gerbang keamanan tetap
 *      `ProtectedRoute` di frontend dan middleware `role:` beserta service otorisasi
 *      di backend, sehingga menyembunyikan menu tidak pernah menjadi satu-satunya
 *      pelindung sebuah halaman.
 *
 * Isi awal grup mengikuti pembagian fase yang sudah berjalan, termasuk keputusan
 * pengguna bahwa Perencanaan (Fase 1) dan Quality Assurance (Fase 3) adalah SATU grup
 * dengan orang yang sama. Backfill memakai nama role, bukan ID, karena ID role berbeda
 * antar lingkungan.
 *
 * Catatan penting: matriks otorisasi fase tetap milik kode
 * (`ProjectWorkflowService::$rolePermissions`, `ProjectAccessService`,
 * `TestingTrack::testerRoles()`). Memindahkan role antar grup di sini mengubah
 * pengelompokan dan tampilan, bukan hak transisi status.
 */
return new class extends Migration
{
    /**
     * Grup awal beserta role anggotanya.
     *
     * @var list<array{code: string, name: string, description: string, roles: list<string>}>
     */
    private const SEED_GROUPS = [
        [
            'code' => 'PERENCANAAN-QA',
            'name' => 'Grup Perencanaan dan Quality Assurance',
            'description' => 'Menangani analisis kebutuhan pada Fase 1 dan pengujian QA pada Fase 3. Satu kumpulan orang, dua fase kerja, dengan halaman kerja terpisah per fase.',
            'roles' => ['lead_group', 'analyst', 'qa_lead', 'qa_tester'],
        ],
        [
            'code' => 'PENGEMBANGAN',
            'name' => 'Grup Pengembangan',
            'description' => 'Menangani perencanaan teknis, penugasan, dan pengerjaan pengembangan pada Fase 2.',
            'roles' => ['development_lead', 'project_manager', 'developer'],
        ],
        [
            'code' => 'KEAMANAN-SIBER',
            'name' => 'Grup Keamanan Siber',
            'description' => 'Menangani audit keamanan pada Fase 3. Grup terpisah dari QA: ruang lingkup dan pelaksananya berbeda.',
            'roles' => ['cyber_lead', 'pentester'],
        ],
        [
            'code' => 'MANAJEMEN-TI',
            'name' => 'Grup Manajemen TI',
            'description' => 'Memegang persetujuan gerbang mutu dan keputusan rilis pada Fase 4.',
            'roles' => ['head_of_it'],
        ],
        [
            'code' => 'PEMOHON',
            'name' => 'Grup Pemohon Bisnis',
            'description' => 'Mengajukan kebutuhan proyek dan melacak jalannya pengajuan.',
            'roles' => ['business_user'],
        ],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('groups')) {
            Schema::create('groups', function (Blueprint $table) {
                $table->id();
                $table->string('code')->unique();
                $table->string('name');
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        Schema::table('roles', function (Blueprint $table) {
            if (! Schema::hasColumn('roles', 'group_id')) {
                // nullOnDelete, bukan cascade: menghapus grup tidak boleh ikut
                // menghapus role beserta seluruh pengguna yang memakainya.
                $table->foreignId('group_id')->nullable()->after('display_name')
                    ->constrained('groups')->nullOnDelete();
            }

            if (! Schema::hasColumn('roles', 'menu_access')) {
                $table->json('menu_access')->nullable()->after('description');
            }
        });

        $this->backfillGroups();
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            if (Schema::hasColumn('roles', 'group_id')) {
                $table->dropConstrainedForeignId('group_id');
            }

            if (Schema::hasColumn('roles', 'menu_access')) {
                $table->dropColumn('menu_access');
            }
        });

        Schema::dropIfExists('groups');
    }

    /**
     * Isi grup awal dan tempatkan role yang sudah ada ke dalamnya.
     *
     * Aman dijalankan ulang: grup dicocokkan berdasarkan `code`, dan role hanya
     * dipindahkan bila grupnya masih kosong sehingga penempatan yang sudah diubah
     * Super Admin tidak ditimpa.
     */
    private function backfillGroups(): void
    {
        $now = now();

        foreach (self::SEED_GROUPS as $seed) {
            $groupId = DB::table('groups')->where('code', $seed['code'])->value('id');

            if ($groupId === null) {
                $groupId = DB::table('groups')->insertGetId([
                    'code' => $seed['code'],
                    'name' => $seed['name'],
                    'description' => $seed['description'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('roles')
                ->whereIn('name', $seed['roles'])
                ->whereNull('group_id')
                ->update(['group_id' => $groupId, 'updated_at' => $now]);
        }
    }
};
