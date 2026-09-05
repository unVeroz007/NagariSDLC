<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentVault extends Model
{
    use HasFactory;

    public const UAT_EVIDENCE_TYPE = 'UAT_EVIDENCE';

    public const SIT_TASK_EVIDENCE_TYPE = 'SIT_TASK_EVIDENCE';

    /**
     * Bukti pengujian yang diunggah QA Tester saat mengirim laporan.
     */
    public const QA_EVIDENCE_TYPE = 'QA_EVIDENCE';

    /**
     * Bukti audit yang diunggah Pentester saat mengirim laporan.
     */
    public const CYBER_EVIDENCE_TYPE = 'CYBER_EVIDENCE';

    /**
     * Tipe dokumen yang memenuhi bukti wajib Review & Sign-Off SIT.
     */
    public const SIT_SIGN_OFF_TYPES = [
        'SIT_RESULT',
        'SIT_SIGNOFF',
    ];

    /**
     * Seluruh tipe dokumen yang berperan sebagai bukti pengujian per-item.
     *
     * Dokumen bertipe ini diunggah berulang dalam satu proyek — satu berkas per task,
     * per skenario, atau per temuan — sehingga penamaannya wajib diberi penanda unik
     * dan tidak layak ditampilkan pada daftar dokumen ringkas per fase.
     */
    public const EVIDENCE_TYPES = [
        self::SIT_TASK_EVIDENCE_TYPE,
        self::UAT_EVIDENCE_TYPE,
        self::QA_EVIDENCE_TYPE,
        self::CYBER_EVIDENCE_TYPE,
    ];

    /**
     * Seluruh kode tipe dokumen yang sah.
     *
     * `document_type` ikut menyusun nama berkas resmi
     * (`XXX/GPTD/TIPE/DD-BulanYYYY_NamaProyek`) dan menjadi dasar pemeriksaan
     * prasyarat per fase — mis. bukti wajib Review & Sign-Off SIT, dan tipe bukti
     * yang boleh dirujuk sebagai `evidence_document_ids` pada laporan pengujian.
     * Karena itu nilainya tidak boleh string bebas dari klien: satu salah ketik
     * membuat dokumen tidak terhitung pada gate mana pun, dan nilai karangan bisa
     * dipakai untuk menitipkan berkas pada tipe yang tidak dikenali UI.
     *
     * ⚠️  Daftar ini harus sejalan dengan `DOCUMENT_TYPES` di
     * `frontend/src/utils/documentNaming.js`.
     */
    public const ALLOWED_TYPES = [
        // Fase 1 — Inisiasi
        'BRD',
        'MEMO',
        'LAMPIRAN',
        'LAINNYA',

        // Fase 2 — Pengembangan
        'FSD',
        'ARSITEKTUR',
        'SIT_PLAN',
        'SIT_RESULT',
        'SIT_SIGNOFF',
        self::SIT_TASK_EVIDENCE_TYPE,
        'UNDANGAN',
        'UAT_PLAN',
        'UAT_RESULT',
        self::UAT_EVIDENCE_TYPE,
        'UAT_SIGNOFF',

        // Fase 3 — QA & Audit Keamanan Siber
        'QA_REPORT',
        self::QA_EVIDENCE_TYPE,
        'QA_SIGNOFF',
        'CYBER_REPORT',
        self::CYBER_EVIDENCE_TYPE,
        'CYBER_SIGNOFF',

        // Fase 4 — Rilis
        'RELEASE_PLAN',

        // Umum
        'SPREADSHEET',
        'GAMBAR',
        'ARSIP',
    ];

    /**
     * Tipe dokumen yang boleh dilihat pemohon proyek (`business_user`).
     *
     * Hanya dokumen pengajuan dan rangkaian UAT yang terlihat; dokumen teknis internal
     * tetap tertutup. Scope proyek tetap diperiksa oleh `ProjectAccessService`.
     *
     * @var list<string>
     */
    public const REQUESTER_VISIBLE_TYPES = [
        'BRD',
        'MEMO',
        'UNDANGAN',
        'UAT_PLAN',
        'UAT_RESULT',
        self::UAT_EVIDENCE_TYPE,
        'UAT_SIGNOFF',
    ];

    protected $fillable = [
        'project_id',
        'uploaded_by',
        'document_type',
        'file_path',
        'file_name',
        'original_filename',
        'file_size',
        'mime_type',
    ];

    /**
     * Daftar putih tipe dokumen untuk satu pengguna, atau null bila tanpa batas tipe.
     *
     * Dipakai sebagai satu-satunya sumber kebenaran oleh ketiga jalur baca dokumen:
     * payload proyek (`ProjectResource`), daftar dokumen (`DocumentController::index`),
     * dan unduhan per id (`DocumentController::download`). Ketiganya wajib memakai
     * daftar yang sama, sebab menyaring hanya di payload masih menyisakan berkas
     * yang dapat diunduh langsung begitu id-nya diketahui.
     *
     * @return list<string>|null
     */
    public static function visibleTypesFor(?User $user): ?array
    {
        return $user?->hasRole(UserRole::BUSINESS_USER) ? self::REQUESTER_VISIBLE_TYPES : null;
    }

    /**
     * Apakah baris dokumen ini boleh dibaca pengguna tertentu.
     *
     * Dipanggil **setelah** hak akses proyek dinyatakan lolos, jadi hanya menilai
     * tipe dokumennya. Berkas yang diunggah pengguna itu sendiri selalu terlihat
     * olehnya: pemohon dapat melampirkan `LAMPIRAN` dan `LAINNYA` saat inisiasi
     * proyek, dan menyembunyikan kembali berkas yang baru saja ia kirim akan tampak
     * seperti unggahan yang gagal.
     */
    public function isVisibleTo(?User $user): bool
    {
        $allowedTypes = self::visibleTypesFor($user);

        if ($allowedTypes === null) {
            return true;
        }

        if ($user && $this->uploaded_by !== null && (int) $this->uploaded_by === (int) $user->id) {
            return true;
        }

        return in_array((string) $this->document_type, $allowedTypes, true);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
