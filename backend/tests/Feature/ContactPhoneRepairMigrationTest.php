<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pengujian migration perbaikan
 * `2026_08_24_000001_null_fabricated_contact_phone_on_projects_table`.
 *
 * Migration ini mengosongkan nomor telepon yang dikarang backfill lama. Yang harus
 * dibuktikan bukan sekadar "nomor karangan hilang", melainkan ketepatan predikatnya:
 * sebuah nomor asli yang bentuknya berdekatan — 10 digit, 12 digit, atau berpemisah
 * tanda hubung — tidak boleh ikut tersapu. Karena itu kasus batas diuji tepat di
 * sebelah kiri dan kanan panjang 11 karakter.
 *
 * Migration dipanggil manual, bukan lewat `artisan migrate`, karena `RefreshDatabase`
 * sudah menjalankan seluruh migration terhadap tabel yang masih kosong. Baris uji baru
 * ada sesudah itu, jadi `up()` perlu dijalankan sekali lagi terhadap data tersebut.
 */
class ContactPhoneRepairMigrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $author;
    protected Division $division;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::create(['name' => UserRole::BUSINESS_USER->value, 'display_name' => 'Business User']);
        $this->division = Division::create(['code' => 'IT', 'name' => 'Divisi TI']);

        $this->author = User::create([
            'name' => 'Pengaju',
            'email' => 'pengaju@nagari.co.id',
            'password' => bcrypt('password123'),
            'role_id' => $role->id,
            'division_id' => $this->division->id,
            'is_active' => true,
        ]);
    }

    public function test_fabricated_contact_phone_is_neutralised_and_archived(): void
    {
        // Dua bentuk keluaran generator lama: satu acak biasa, satu dengan blok digit
        // yang ter-zero-pad di depan — hasil `str_pad()` ketika `random_int()`
        // mengembalikan bilangan kecil.
        $acak = $this->createProject('Proyek Nomor Karangan', '08123456789');
        $terpad = $this->createProject('Proyek Nomor Ter-pad', '08000000001');

        $this->runRepairMigration();

        foreach ([$acak, $terpad] as $projectId) {
            $row = $this->freshProjectRow($projectId);

            // `assertArrayHasKey` + `assertNull`, bukan `$row['contact_phone'] ?? ...`:
            // operator `??` ikut menelan `null` yang benar-benar tersimpan, sehingga
            // kolom yang hilang dan kolom yang sengaja dikosongkan jadi tak terbedakan.
            $this->assertArrayHasKey('contact_phone', $row);
            $this->assertNull($row['contact_phone']);
        }

        // Nilai lama wajib masih dapat ditelusuri; pengosongan tanpa arsip berarti
        // menghapus data, dan itu dilarang.
        $archive = DB::table('activity_logs')
            ->where('action', 'revert_fabricated_contact_phone')
            ->where('subject_id', $acak)
            ->first();

        $this->assertNotNull($archive, 'Nomor lama harus diarsipkan ke activity_logs sebelum dikosongkan.');
        $this->assertNull($archive->user_id, 'Arsip bukan perbuatan pengguna, jadi user_id harus null.');

        $metadata = json_decode((string) $archive->metadata, true);
        $this->assertSame('08123456789', $metadata['previous_contact_phone']);
        $this->assertSame('system:migration', $metadata['performed_by']);
    }

    public function test_genuine_contact_phone_is_left_untouched(): void
    {
        // Kasus batas rapat di kedua sisi panjang 11 karakter, ditambah bentuk-bentuk
        // asli lain yang lolos saringan awal `LIKE '08%'` dan karena itu benar-benar
        // sampai ke predikat pengikat di PHP.
        //
        // Disimpan sebagai list pasangan, bukan array ber-key nomor telepon: PHP
        // memaksa key string yang berbentuk angka desimal menjadi integer, sehingga
        // '62812345678' akan berubah tipe dan perbandingan `assertSame` gagal karena
        // tipenya, bukan karena migration-nya salah.
        $genuine = [
            ['label' => 'Sepuluh digit', 'phone' => '0809123456'],
            ['label' => 'Dua belas digit', 'phone' => '081234567890'],
            ['label' => 'Tiga belas digit', 'phone' => '0812345678901'],
            ['label' => 'Pakai tanda hubung', 'phone' => '0812-3456-7890'],
            ['label' => 'Format internasional', 'phone' => '62812345678'],
        ];

        $cases = [];
        foreach ($genuine as $case) {
            $cases[] = [
                'phone' => $case['phone'],
                'id' => $this->createProject("Proyek {$case['label']}", $case['phone']),
            ];
        }

        $this->runRepairMigration();

        foreach ($cases as $case) {
            $row = $this->freshProjectRow($case['id']);
            $this->assertSame($case['phone'], $row['contact_phone'], "Nomor asli {$case['phone']} tidak boleh disentuh.");
        }

        $this->assertSame(
            0,
            DB::table('activity_logs')->where('action', 'revert_fabricated_contact_phone')->count(),
            'Tidak ada nomor asli yang boleh menghasilkan entri arsip.'
        );
    }

    public function test_running_the_migration_twice_changes_nothing_the_second_time(): void
    {
        $fabricated = $this->createProject('Proyek Nomor Karangan', '08987654321');
        $genuine = $this->createProject('Proyek Nomor Asli', '081234567890');

        $this->runRepairMigration();

        $archiveCountAfterFirstRun = DB::table('activity_logs')
            ->where('action', 'revert_fabricated_contact_phone')
            ->count();
        $this->assertSame(1, $archiveCountAfterFirstRun);

        $projectsAfterFirstRun = $this->projectPhoneSnapshot();

        $this->runRepairMigration();

        // Jalan kedua tidak boleh menyentuh apa pun: baris karangan sudah `NULL`
        // sehingga tidak lolos saringan, dan baris asli tidak pernah cocok predikat.
        $this->assertSame(
            $projectsAfterFirstRun,
            $this->projectPhoneSnapshot(),
            'Jalan kedua migration tidak boleh mengubah satu nilai pun.'
        );

        $this->assertSame(
            $archiveCountAfterFirstRun,
            DB::table('activity_logs')->where('action', 'revert_fabricated_contact_phone')->count(),
            'Jalan kedua tidak boleh menambah entri arsip duplikat.'
        );

        $fabricatedRow = $this->freshProjectRow($fabricated);
        $this->assertArrayHasKey('contact_phone', $fabricatedRow);
        $this->assertNull($fabricatedRow['contact_phone']);
        $this->assertSame('081234567890', $this->freshProjectRow($genuine)['contact_phone']);
    }

    /**
     * Muat dan jalankan migration perbaikan.
     *
     * `require` dipakai, bukan `require_once`: pengujian idempotensi perlu menjalankan
     * `up()` dua kali, dan `require_once` pada pemanggilan kedua mengembalikan `true`
     * alih-alih instance migration-nya.
     */
    private function runRepairMigration(): void
    {
        $migration = require database_path(
            'migrations/2026_08_24_000001_null_fabricated_contact_phone_on_projects_table.php'
        );

        $migration->up();
    }

    private function createProject(string $title, ?string $contactPhone): int
    {
        return Project::create([
            'req_id' => Project::generateReqId(),
            'title' => $title,
            'contact_phone' => $contactPhone,
            'created_by' => $this->author->id,
            'division_id' => $this->division->id,
            'status' => ProjectStatus::PENDING->value,
        ])->id;
    }

    /**
     * Ambil baris langsung dari database, bukan lewat model yang sudah dimuat.
     *
     * Migration menulis dengan query builder, jadi instance Eloquent apa pun yang
     * masih dipegang test sudah basi dan akan melaporkan nilai sebelum perbaikan.
     *
     * @return array<string, mixed>
     */
    private function freshProjectRow(int $projectId): array
    {
        return (array) DB::table('projects')->where('id', $projectId)->first();
    }

    /**
     * @return array<int, ?string>
     */
    private function projectPhoneSnapshot(): array
    {
        return DB::table('projects')
            ->orderBy('id')
            ->pluck('contact_phone', 'id')
            ->all();
    }
}
