<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Enums\UatApprovalRoundStatus;
use App\Enums\UatApprovalStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Document\UploadDocumentRequest;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Services\FileUploadService;
use App\Services\ProjectAccessService;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DocumentController extends Controller
{
    use LogsActivity;

    /**
     * Tipe dokumen bukti (evidence) yang secara alami diunggah berkali-kali
     * dalam satu proyek pada tanggal yang sama (bukti per task SIT, bukti per
     * skenario UAT, bukti per skenario QA, bukti per temuan Siber). Nama dokumen
     * tipe ini wajib diberi penanda unik agar tidak kembar dan tetap dapat
     * dilacak ke baris document vault-nya.
     */
    protected const UNIQUELY_NAMED_DOC_TYPES = DocumentVault::EVIDENCE_TYPES;

    /**
     * Status proyek yang membekukan dokumen Berita Acara / Hasil Review SIT.
     *
     * Begitu SIT dinyatakan lulus, dokumennya menjadi dasar dibukanya gerbang UAT dan
     * seluruh fase sesudahnya, jadi tidak boleh hilang. Daftar ini adalah cermin
     * `SIT_COMPLETED_STATUSES` di `frontend/src/components/SITUATWizard.jsx` — nilai
     * yang membuat `sitDone` bernilai true dan tombol hapus dokumen SIT sudah
     * dimatikan (`readOnly={sitDone}`) — ditambah `CANCELLED`, karena proyek yang
     * dibatalkan justru paling butuh buktinya utuh. Bila daftar di frontend berubah,
     * perbarui keduanya.
     *
     * @var list<string>
     */
    private const SIT_EVIDENCE_FROZEN_STATUSES = [
        ProjectStatus::SIT_PASSED->value,
        ProjectStatus::UAT_IN_PROGRESS->value,
        ProjectStatus::UAT_REVISION_SIT->value,
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::DEV_COMPLETED->value,
        ProjectStatus::RETURN_TO_DEV->value,
        ProjectStatus::READY_FOR_QA->value,
        ProjectStatus::QA_IN_PROGRESS->value,
        ProjectStatus::QA_PASSED->value,
        ProjectStatus::CYBER_IN_PROGRESS->value,
        ProjectStatus::CYBER_PASSED->value,
        ProjectStatus::READY_FOR_UAT->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
        ProjectStatus::CANCELLED->value,
    ];

    /**
     * Status proyek yang membekukan dokumen undangan dan berita acara UAT Internal.
     *
     * Cermin `UAT_COMPLETED_STATUSES` di `SITUATWizard.jsx` (nilai yang membuat
     * `uatDone` true, sehingga tombol hapus dokumen UAT sudah dimatikan) ditambah
     * `CANCELLED`. `UAT_IN_PROGRESS` dan `UAT_REVISION_SIT` sengaja TIDAK termasuk:
     * selama putaran UAT masih berjalan atau sedang menunggu SIT ulang, PM masih boleh
     * mengganti berkas yang salah unggah.
     *
     * @var list<string>
     */
    private const UAT_EVIDENCE_FROZEN_STATUSES = [
        ProjectStatus::UAT_PASSED->value,
        ProjectStatus::DEV_COMPLETED->value,
        ProjectStatus::RETURN_TO_DEV->value,
        ProjectStatus::READY_FOR_QA->value,
        ProjectStatus::QA_IN_PROGRESS->value,
        ProjectStatus::QA_PASSED->value,
        ProjectStatus::CYBER_IN_PROGRESS->value,
        ProjectStatus::CYBER_PASSED->value,
        ProjectStatus::READY_FOR_UAT->value,
        ProjectStatus::PENDING_GOLIVE->value,
        ProjectStatus::LIVE_PRODUCTION->value,
        ProjectStatus::CANCELLED->value,
    ];

    public function __construct(
        protected FileUploadService $uploadService,
        protected ProjectAccessService $access
    ) {}

    /**
     * Format nama dokumen sesuai konvensi Bank Nagari:
     * XXX/GPTD/TIPE/DD-BulanYYYY_NamaProyek[_PENANDA...]
     *   XXX = nomor urut dari req_id (contoh: REQ-2026-001 → 001)
     *   TIPE = kode tipe dokumen (BRD, MEMO, FSD, dll)
     *   PENANDA = pembeda opsional untuk dokumen bukti, mis. konteks
     *             ("TASK-42") dan nomor dokumen ("DOC-0091").
     *
     * @param  list<string>  $discriminators  Penanda tambahan yang sudah bersih.
     */
    protected function generateDocumentFileName(
        Project $project,
        string $docType,
        ?string $originalName = null,
        ?string $mimeType = null,
        array $discriminators = []
    ): string {
        // Nomor proyek dari req_id
        $nomor = '001';
        if ($project->req_id && preg_match('/(\d+)$/', $project->req_id, $m)) {
            $nomor = str_pad($m[1], 3, '0', STR_PAD_LEFT);
        }

        // Tanggal
        $now = now();
        $bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];
        $dd = $now->format('d');
        $bl = $bulan[$now->month - 1];
        $th = $now->format('Y');

        // Nama proyek (aman untuk file system)
        $pp = preg_replace('/[^a-zA-Z0-9\s]/', '', $project->title);
        $pp = trim(preg_replace('/\s+/', '_', mb_substr($pp, 0, 30)));

        $prefix = "{$nomor}/GPTD/{$docType}/{$dd}-{$bl}{$th}_{$pp}";

        // Penanda pembeda (konteks + nomor dokumen) untuk lampiran bukti.
        foreach ($discriminators as $discriminator) {
            if ($discriminator !== null && $discriminator !== '') {
                $prefix .= '_' . $discriminator;
            }
        }

        // Ekstensi dari original filename
        $ext = '';
        if ($originalName) {
            $parts = explode('.', $originalName);
            if (count($parts) > 1) {
                $ext = '.' . strtolower(end($parts));
            }
        }
        // Fallback: ekstensi dari MIME type file jika tidak ada di original name
        if ($ext === '') {
            $ext = match ($mimeType) {
                'application/pdf' => '.pdf',
                'application/vnd.ms-excel' => '.xls',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => '.xlsx',
                'image/jpeg' => '.jpg',
                'image/png' => '.png',
                'application/zip' => '.zip',
                default => '.bin',
            };
        }

        return $prefix . $ext;
    }

    /**
     * Bersihkan label konteks dari klien (mis. "TASK-42", "PERMINTAAN-3") agar
     * aman dipakai di nama dokumen: hanya huruf, angka, dan tanda hubung.
     */
    protected function sanitizeContextLabel(?string $label): ?string
    {
        if ($label === null) {
            return null;
        }

        $clean = trim((string) preg_replace('/[^A-Za-z0-9\-]/', '', $label), '-');

        return $clean === '' ? null : mb_strtoupper(mb_substr($clean, 0, 24));
    }

    /**
     * Daftar dokumen, disaring pada proyek yang boleh dilihat pengguna.
     *
     * Sebelumnya endpoint ini mengembalikan seluruh isi Document Vault ketika
     * `project_id` tidak dikirim, dan menerima `project_id` apa pun tanpa
     * memeriksa hak akses. Karena responsnya menyertakan relasi `project`, satu
     * permintaan tanpa parameter cukup untuk membaca judul, pemohon, dan seluruh
     * daftar berkas setiap proyek di bank.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = DocumentVault::with(['project', 'uploader']);

        if ($request->filled('project_id')) {
            $project = Project::find($request->integer('project_id'));

            if (! $project) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Proyek tidak ditemukan.',
                ], 404);
            }

            // Pemeriksaan per baris dipakai untuk permintaan yang menyebut satu
            // proyek: `canView()` lebih longgar daripada penyaring daftar karena
            // ikut menghitung keterlibatan personal, mis. approver UAT yang harus
            // membuka dokumen proyek di luar fasenya.
            if (! $this->access->canView($user, $project)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda tidak memiliki hak akses untuk melihat dokumen proyek ini.',
                ], 403);
            }

            $query->where('project_id', $project->id);
        } else {
            $query->whereHas(
                'project',
                fn (Builder $project) => $this->access->applyVisibilityScope($project, $user)
            );
        }

        // Batas tipe dokumen per role, di atas batas proyek di atas. Pemohon
        // (`business_user`) hanya berhak atas berkas pengajuannya dan berkas
        // rangkaian UAT — lihat `DocumentVault::REQUESTER_VISIBLE_TYPES`. Berkas
        // yang ia unggah sendiri tetap ikut agar lampiran inisiasinya tidak hilang
        // dari layarnya.
        $allowedTypes = DocumentVault::visibleTypesFor($user);

        if ($allowedTypes !== null) {
            $query->where(function (Builder $scope) use ($allowedTypes, $user): void {
                $scope->whereIn('document_type', $allowedTypes)
                    ->orWhere('uploaded_by', $user->id);
            });
        }

        $documents = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $documents,
        ]);
    }

    /**
     * Unggah dokumen ke Document Vault proyek.
     *
     * Hak tulis diperiksa lewat `ProjectAccessService::canUpdate()` — sengaja
     * lebih ketat daripada hak baca. Tanpa pemeriksaan ini setiap pengguna
     * terautentikasi dapat menitipkan berkas pada proyek mana pun hanya dengan
     * menebak `project_id`, termasuk berkas yang lalu terhitung sebagai bukti
     * prasyarat pada gate fase proyek tersebut.
     */
    public function upload(UploadDocumentRequest $request): JsonResponse
    {
        $project = Project::findOrFail($request->integer('project_id'));

        if (! $this->access->canUpdate($request->user(), $project)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk mengunggah dokumen pada proyek ini.',
            ], 403);
        }

        $file = $request->file('file');
        $fileInfo = $this->uploadService->upload($file);
        $originalName = $request->input('original_filename') ?? $file->getClientOriginalName();
        $docType = $request->validated('document_type');

        // Penanda konteks opsional dari pengunggah (mis. "TASK-42") supaya
        // lampiran bukti bisa dibedakan langsung dari namanya.
        $discriminators = array_values(array_filter([
            $this->sanitizeContextLabel($request->input('context_label')),
        ]));

        $document = DB::transaction(function () use ($project, $request, $fileInfo, $originalName, $docType, $discriminators) {
            $document = DocumentVault::create([
                'project_id' => $project->id,
                'uploaded_by' => $request->user()->id,
                'document_type' => $docType,
                'original_filename' => $originalName,
                'file_path' => $fileInfo['file_path'],
                'file_name' => $this->generateDocumentFileName($project, $docType, $originalName, $fileInfo['mime_type'], $discriminators),
                'file_size' => $fileInfo['file_size'],
                'mime_type' => $fileInfo['mime_type'],
            ]);

            // Nomor dokumen dipakai sebagai pembeda final untuk tipe bukti.
            // Diambil dari primary key agar dijamin unik walau beberapa berkas
            // diunggah paralel, dan tetap bisa dirujuk saat audit.
            if (in_array($docType, self::UNIQUELY_NAMED_DOC_TYPES, true)) {
                $discriminators[] = 'DOC-' . str_pad((string) $document->id, 4, '0', STR_PAD_LEFT);
                $document->file_name = $this->generateDocumentFileName($project, $docType, $originalName, $fileInfo['mime_type'], $discriminators);
                $document->save();
            }

            return $document;
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Dokumen berhasil diunggah.',
            'data' => $document->load('uploader'),
        ], 201);
    }

    /**
     * Unduh satu dokumen dari Document Vault.
     *
     * Wewenangnya diputuskan `ProjectAccessService::canView()`, sumber kebenaran yang
     * sama dengan `index()` dan `upload()`. Sebelumnya method ini memakai tangga
     * pemeriksaan sendiri yang memberi akses tanpa syarat kepada seluruh role
     * `qa_lead`, `qa_tester`, `cyber_lead`, `pentester`, dan `development_lead`:
     * seorang tester dapat mengunduh dokumen proyek mana pun di bank — termasuk BRD
     * dan memo fase awal proyek yang tidak pernah diajukan ke jalur pengujiannya —
     * padahal daftar dokumen di layar mereka sudah dibatasi `applyVisibilityScope()`.
     * Sekarang QA / Siber / Development Lead tetap dapat mengunduh, namun hanya pada
     * proyek yang benar-benar berada di fase mereka atau yang jalurnya mereka pegang.
     */
    public function download(int $id): BinaryFileResponse|JsonResponse
    {
        $document = DocumentVault::findOrFail($id);
        $user = request()->user();
        $project = $document->project;

        // Proyek yang dihapus lunak tidak lagi punya konteks otorisasi yang bisa
        // dipercaya (relasinya menghilang dari query biasa), jadi berkasnya ditutup
        // alih-alih dinilai dengan data yang sudah tidak lengkap.
        if (! $project) {
            return response()->json([
                'status' => 'error',
                'message' => 'Proyek pemilik dokumen ini tidak tersedia.',
            ], 404);
        }

        if (! $this->access->canView($user, $project)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk mengunduh dokumen ini.',
            ], 403);
        }

        // Hak akses proyek saja belum cukup: pemohon berhak membuka proyeknya
        // sendiri, namun tidak setiap berkas di dalamnya. Tanpa pemeriksaan tipe di
        // sini, penyaring pada daftar dan pada payload proyek hanya menyembunyikan
        // berkas dari layar — satu permintaan langsung ke endpoint ini dengan id
        // yang ditebak tetap mengembalikan isi laporan audit keamanan siber atau
        // rencana rollback.
        if (! $document->isVisibleTo($user)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dokumen ini bukan bagian dari berkas yang dapat Anda akses.',
            ], 403);
        }

        if (! Storage::disk('local')->exists($document->file_path)) {
            return response()->json([
                'status' => 'error',
                'message' => 'File tidak ditemukan di server.',
            ], 404);
        }

        $path = Storage::disk('local')->path($document->file_path);

        // Nama file di DB memakai format "XXX/GPTD/TIPE/DD-BulanYYYY_Nama" yang mengandung "/".
        // Laravel response()->download() menolak filename dengan "/" atau "\".
        // Sanitasi untuk Content-Disposition (tampilan download tetap format lengkap, "/" diganti "-").
        $downloadName = str_replace(['/', '\\'], '-', $document->file_name);

        return response()->download($path, $downloadName);
    }

    /**
     * Hapus satu dokumen dari Document Vault.
     *
     * Dua lapis pemeriksaan, keduanya wajib lolos:
     *
     *   1. **Wewenang** — hanya pengunggah, pemohon, PM proyek, Super Admin, atau
     *      Head of IT.
     *   2. **Keterikatan jejak audit** — dokumen yang sudah menjadi dasar sebuah
     *      gerbang terbuka tidak boleh dihapus. Tanpa lapis ini, satu panggilan
     *      `DELETE` dapat menghapus Berita Acara SIT proyek yang sudah LIVE, atau
     *      bukti pengujian yang dirujuk baris `test_reports`, dan yang tertinggal
     *      hanyalah rujukan ke berkas yang tidak ada lagi.
     *
     * Baris vault dihapus lebih dulu, lalu dicatat, baru berkas fisiknya dibuang.
     * Urutan ini dipilih agar kegagalan pada storage tidak pernah meninggalkan baris
     * vault yang menunjuk berkas hilang; sisa berkas tanpa baris jauh lebih aman.
     */
    public function destroy(int $id): JsonResponse
    {
        $document = DocumentVault::findOrFail($id);
        $user = request()->user();
        $project = $document->project;

        // Sama seperti download(): proyek yang dihapus lunak tidak menyediakan konteks
        // otorisasi yang utuh, jadi permintaan ditolak alih-alih diputuskan setengah.
        if (! $project) {
            return response()->json([
                'status' => 'error',
                'message' => 'Proyek pemilik dokumen ini tidak tersedia.',
            ], 404);
        }

        $canDelete = in_array($user->role?->name ?? '', ['super_admin', 'head_of_it'], true)
            || $document->uploaded_by === $user->id
            || $project->created_by === $user->id
            || $project->pm_id === $user->id;

        if (! $canDelete) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk menghapus dokumen ini.',
            ], 403);
        }

        // Wewenang hapus milik pemohon berlaku sebatas berkas yang boleh ia lihat.
        // Sebagai `created_by` proyek, pemohon lolos pemeriksaan di atas untuk
        // setiap dokumen di proyeknya — termasuk FSD, laporan QA, dan laporan audit
        // keamanan siber yang kini tidak lagi tampil di layarnya. Tanpa lapis ini,
        // berkas yang tidak dapat ia baca tetap dapat ia hapus.
        if (! $document->isVisibleTo($user)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dokumen ini bukan bagian dari berkas yang dapat Anda kelola.',
            ], 403);
        }

        $blockers = $this->auditTrailBlockers($document, $project);

        if ($blockers !== []) {
            $this->logActivity(
                'delete_document_blocked',
                'Penghapusan Dokumen Ditolak',
                "Permintaan penghapusan dokumen \"{$document->file_name}\" pada proyek \"{$project->title}\" ditolak karena dokumen tersebut masih menjadi bukti jejak audit.",
                $document,
                [
                    'project_id'    => $project->id,
                    'project_name'  => $project->title,
                    'document_id'   => $document->id,
                    'document_type' => $document->document_type,
                    'reasons'       => $blockers,
                ],
                'error'
            );

            return response()->json([
                'status' => 'error',
                'message' => 'Dokumen ini tidak dapat dihapus karena masih menjadi bukti jejak audit: '.implode(' ', $blockers),
                'data' => [
                    'reasons' => $blockers,
                ],
            ], 422);
        }

        $auditMetadata = [
            'project_id'        => $project->id,
            'project_name'      => $project->title,
            'document_id'       => $document->id,
            'document_type'     => $document->document_type,
            'file_name'         => $document->file_name,
            'original_filename' => $document->original_filename,
            'uploaded_by'       => $document->uploaded_by,
        ];
        $filePath = $document->file_path;

        $document->delete();

        $this->logActivity(
            'delete_document',
            'Menghapus Dokumen',
            "Dokumen \"{$auditMetadata['file_name']}\" dihapus dari proyek \"{$project->title}\".",
            $project,
            $auditMetadata
        );

        if (Storage::disk('local')->exists($filePath)) {
            Storage::disk('local')->delete($filePath);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Dokumen berhasil dihapus.',
        ]);
    }

    /**
     * Kumpulkan alasan mengapa sebuah dokumen tidak boleh dihapus.
     *
     * Mengembalikan daftar kalimat siap tampil; daftar kosong berarti penghapusan
     * boleh dilanjutkan. Pemeriksaan sengaja dilakukan terhadap rujukan yang nyata
     * (baris `test_reports` dan isi `sit_uat_data`), bukan terhadap tipe dokumen,
     * supaya dokumen yang salah unggah dan belum dipakai tetap bisa dibersihkan.
     *
     * Batas pembekuan berbasis status dipilih agar identik dengan kondisi `readOnly`
     * pada wizard SIT/UAT: setiap penolakan di sini adalah tombol yang di layar sudah
     * mati, jadi tidak ada alur sah yang mendadak gagal.
     *
     * @return list<string>
     */
    private function auditTrailBlockers(DocumentVault $document, Project $project): array
    {
        $blockers = [];
        $status = $project->status instanceof ProjectStatus
            ? $project->status->value
            : (string) $project->status;
        $sitUatData = (array) $project->sit_uat_data;

        // 1. Bukti yang sudah dilampirkan pada laporan pengujian QA / Siber.
        //    Perbandingan dilakukan di PHP lewat evidenceDocumentIdList() agar tidak
        //    bergantung pada pencocokan tipe JSON di database.
        $referencingReports = $project->testReports
            ->filter(fn ($report): bool => in_array($document->id, $report->evidenceDocumentIdList(), true));

        if ($referencingReports->isNotEmpty()) {
            $reportTypes = $referencingReports
                ->pluck('test_type')
                ->map(fn ($type): string => strtoupper((string) $type))
                ->unique()
                ->implode(', ');

            $blockers[] = "Dokumen dirujuk sebagai bukti pada laporan pengujian {$reportTypes}.";
        }

        // 2. Berita Acara / Hasil Review SIT setelah SIT dinyatakan selesai.
        if (in_array($status, self::SIT_EVIDENCE_FROZEN_STATUSES, true)
            && in_array($document->id, $this->documentIdsFrom($sitUatData['sit3_docs'] ?? []), true)) {
            $blockers[] = 'Dokumen adalah bukti sign-off SIT yang sudah membuka fase berikutnya.';
        }

        // 3. Dokumen UAT Internal (undangan Tahap 1 dan berita acara Tahap 3) setelah
        //    UAT selesai.
        $uatFrozenByStatus = in_array($status, self::UAT_EVIDENCE_FROZEN_STATUSES, true);
        $uatDocumentIds = array_merge(
            $this->documentIdsFrom($sitUatData['uat1_docs'] ?? []),
            $this->documentIdsFrom($sitUatData['uat3_docs'] ?? [])
        );

        if ($uatFrozenByStatus && in_array($document->id, $uatDocumentIds, true)) {
            $blockers[] = 'Dokumen adalah bukti UAT Internal yang sudah selesai.';
        }

        // 4. Dokumen Tahap 3 UAT juga terkunci begitu ada satu keputusan approver yang
        //    tercatat, meski status proyek belum berpindah: approver memutuskan dengan
        //    dokumen itu di depan mata, jadi berkasnya bagian dari keputusan.
        if (! $uatFrozenByStatus
            && in_array($document->id, $this->documentIdsFrom($sitUatData['uat3_docs'] ?? []), true)
            && $this->hasRecordedUatApprovalDecision($project)) {
            $blockers[] = 'Sudah ada approver UAT yang memberikan keputusan atas dokumen ini.';
        }

        // 5. Dokumen yang tersimpan pada snapshot siklus SIT lama. Siklus tersebut
        //    tertutup secara definisi dan hanya berfungsi sebagai histori.
        foreach ((array) ($sitUatData['sit_cycles'] ?? []) as $cycle) {
            if (in_array($document->id, $this->documentIdsFrom($cycle['documents'] ?? []), true)) {
                $blockers[] = 'Dokumen tersimpan pada histori siklus SIT sebelumnya.';
                break;
            }
        }

        return $blockers;
    }

    /**
     * Ambil seluruh id document vault dari satu koleksi rujukan `sit_uat_data`.
     *
     * Frontend menyimpan rujukan dokumen sebagai objek dengan kunci `docId`, dan
     * nilainya bisa berupa angka maupun string angka tergantung jalur unggahnya.
     *
     * @return list<int>
     */
    private function documentIdsFrom(mixed $entries): array
    {
        if (! is_array($entries)) {
            return [];
        }

        $ids = [];

        foreach ($entries as $entry) {
            $docId = is_array($entry) ? ($entry['docId'] ?? null) : null;

            if (is_numeric($docId)) {
                $ids[] = (int) $docId;
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * Apakah putaran approval UAT terakhir sudah punya minimal satu keputusan.
     *
     * Memakai putaran `active`/`completed` terakhir, pola yang sama dengan
     * `UatApprovalService`, sehingga putaran `superseded` tidak lagi mengunci apa pun.
     */
    private function hasRecordedUatApprovalDecision(Project $project): bool
    {
        $latestRound = $project->uatApprovalRounds()
            ->whereIn('status', [
                UatApprovalRoundStatus::ACTIVE->value,
                UatApprovalRoundStatus::COMPLETED->value,
            ])
            ->latest('round_number')
            ->first();

        if (! $latestRound) {
            return false;
        }

        return $latestRound->approvers()
            ->where('status', '!=', UatApprovalStatus::PENDING->value)
            ->exists();
    }
}
