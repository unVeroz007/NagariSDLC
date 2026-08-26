<?php

namespace App\Http\Requests\Project;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pembaruan data proyek (`PATCH /projects/{id}`).
 *
 * Wewenangnya tetap diputuskan controller lewat `ProjectAccessService::canUpdate()`
 * dan — untuk perubahan penanggung jawab — `canAssignPersonnel()`. Keduanya
 * memerlukan baris proyek yang tersimpan sebagai pembanding, dan penolakannya
 * memakai pesan spesifik per kasus, jadi tetap di controller. Yang dipindahkan ke
 * sini adalah bentuk masukan beserta normalisasinya, sesuai ketentuan AGENTS.md
 * bahwa validasi write backend memakai Form Request.
 *
 * Endpoint ini juga menerima beberapa kunci yang tidak dipetakan langsung ke kolom
 * proyek dan dibaca controller sesudahnya: `status` (transisi lewat
 * `ProjectWorkflowService`), `notes`/`leadNote`/`lead_note` (catatan transisi),
 * `analyst` (nama analis dari workspace, dipetakan ke `analyst_id`), serta
 * `team`/`team_ids`/`developers` (alokasi tim). Semuanya dicantumkan di sini agar
 * seluruh permukaan masukan endpoint ini terdokumentasi dan tipenya terjaga —
 * sebelumnya kunci-kunci itu dibaca tanpa pernah divalidasi.
 *
 * Kolom jalur pengujian (`qa_status`, `cyber_status`) DILARANG di sini. Kolom itu
 * adalah kebenaran fase pengujian, dan satu-satunya pemiliknya adalah empat endpoint
 * jalur pengujian (`submit`, `assign`, `report`, `sign-off` di TestingTrackService)
 * beserta `ProjectWorkflowService::syncTestingTrackStatuses()`. Termasuk penetapan
 * TIDAK LULUS: keputusan gagal hanya lahir dari `sign-off` Lead, yang sekaligus
 * membuka putaran pengembalian lewat `ProjectReturnRoundService`. Membiarkan kolom
 * ini ditulis dari sini — walau ditahan sampai transisi RETURN_TO_DEV seperti versi
 * sebelumnya — membuka jalur menandai proyek gagal tanpa satu pun putaran terbuka,
 * sehingga sisi pengembangan tak pernah tahu apa yang harus diperbaiki.
 */
class UpdateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'contact_phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'type' => ['sometimes', 'nullable', 'string', 'in:RBB,NON_RBB,Non-RBB'],
            'pm_id' => ['sometimes', 'nullable', Rule::exists('users', 'id')],
            'analyst_id' => ['sometimes', 'nullable', Rule::exists('users', 'id')],
            'division_id' => ['sometimes', 'nullable', Rule::exists('divisions', 'id')],
            'target_date' => ['sometimes', 'nullable', 'date'],
            // Tenggat RBB dipakai panel "Proyek RBB mendekati deadline" di dasbor.
            // Aturannya sengaja sama persis dengan `StoreProjectRequest`: nullable,
            // tanpa `required_if` dan tanpa perbandingan terhadap `target_date`, karena
            // tenggat RBB adalah komitmen tahunan bank yang dapat mendahului maupun
            // sudah terlewat dari target internal.
            'rbb_deadline' => ['sometimes', 'nullable', 'date'],
            'current_stage_deadline' => ['sometimes', 'nullable', 'date'],
            'staging_url' => ['sometimes', 'nullable', 'string'],
            'uat_notes' => ['sometimes', 'nullable', 'string'],
            'sit_uat_data' => ['sometimes', 'nullable'],
            'sitUatData' => ['sometimes', 'nullable'],
            'analyst_result' => ['sometimes', 'nullable'],
            'dev_analyst_result' => ['sometimes', 'nullable'],
            // Kolom jalur pengujian dilarang sepenuhnya dari endpoint ini (lihat
            // docblock kelas). `prohibited` menolak kehadiran nilai apa pun namun tetap
            // membiarkan kunci absen atau null, jadi formulir yang tidak menyentuh jalur
            // pengujian tidak terpengaruh.
            'qa_status' => ['prohibited'],
            'cyber_status' => ['prohibited'],
            'team_allocated_by_pm' => ['sometimes', 'nullable', 'boolean'],
            'status' => ['sometimes', 'string'],
            'project_type' => ['sometimes', 'nullable', 'string', 'in:baru,perbaikan,update'],

            // Prioritas memakai kosakata dan padanan label lama yang sama dengan jalur
            // pembuatan. Sebelumnya kunci ini tidak ada di sini sama sekali, sehingga
            // `PATCH /projects/{id}` menerima permintaan pengubahan prioritas dengan
            // status 200 lalu membuangnya diam-diam — pengguna melihat konfirmasi
            // berhasil untuk perubahan yang tidak pernah tersimpan.
            //
            // Tidak dikunci ke `PERSONNEL_ASSIGNER_ROLES` seperti `pm_id`/`analyst_id`.
            // Alasan gerbang personel adalah rantai disposisi pada jejak audit: PM
            // tidak boleh mengalihkan tanggung jawab proyeknya sendiri. Prioritas tidak
            // memindahkan tanggung jawab siapa pun, sudah dapat ditetapkan bebas oleh
            // pemohon pada saat pengajuan, dan setiap perubahannya tercatat di
            // `activity_logs`. Mempersempitnya di sini justru akan menjadi aturan baru,
            // bukan penegakan aturan yang sudah ada.
            'priority' => ['sometimes', 'string', Rule::in(StoreProjectRequest::PRIORITIES)],

            // Nama analis yang dikirim workspace ketika `analyst_id` tidak tersedia.
            'analyst' => ['sometimes', 'nullable', 'string', 'max:255'],

            // Catatan transisi status. Tiga nama diterima karena dipakai formulir yang
            // berbeda; controller mengambil yang pertama terisi.
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'leadNote' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'lead_note' => ['sometimes', 'nullable', 'string', 'max:2000'],

            // Alokasi tim. Anggota boleh berupa id numerik atau objek berisi
            // user_id/id/email/name, jadi tipe elemennya tidak dipatok lebih jauh.
            'team' => ['sometimes', 'nullable', 'array'],
            'team_ids' => ['sometimes', 'nullable', 'array'],
            'developers' => ['sometimes', 'nullable', 'array'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'qa_status.prohibited' => 'Status jalur QA tidak dapat diubah dari endpoint ini. Gunakan endpoint jalur QA (pengajuan, disposisi, laporan, sign-off).',
            'cyber_status.prohibited' => 'Status jalur Keamanan Siber tidak dapat diubah dari endpoint ini. Gunakan endpoint jalur Siber (pengajuan, disposisi, laporan, sign-off).',
            'pm_id.exists' => 'Project Manager yang dipilih tidak terdaftar.',
            'analyst_id.exists' => 'Analis yang dipilih tidak terdaftar.',
            'division_id.exists' => 'Divisi yang dipilih tidak terdaftar.',
            'priority.in' => 'Prioritas proyek harus salah satu dari: '.implode(', ', StoreProjectRequest::PRIORITIES).'.',
            'rbb_deadline.date' => 'Tenggat RBB harus berupa tanggal yang sah.',
        ];
    }

    /**
     * Seragamkan bentuk masukan sebelum divalidasi.
     *
     * Kolom jalur pengujian tidak lagi diseragamkan di sini karena sudah dilarang
     * (lihat docblock kelas); yang tersisa hanya normalisasi prioritas dan tenggat RBB.
     */
    protected function prepareForValidation(): void
    {
        // Padanan label prioritas lama (`Rendah`/`Urgent`) diseragamkan memakai
        // pemetaan milik `StoreProjectRequest` supaya klien lama tidak ditolak di satu
        // endpoint tetapi diterima di endpoint lainnya.
        if ($this->filled('priority')) {
            $this->merge(['priority' => StoreProjectRequest::canonicalPriority($this->input('priority'))]);
        }

        // Klien mengirim tenggat RBB sebagai `rbbDeadline` (lihat 17 pembacanya di
        // frontend). Diseragamkan ke `rbb_deadline`, dan 'TBD' — sentinel yang dipakai
        // frontend untuk tanggal kosong — diterjemahkan menjadi null.
        $rbbDeadline = $this->input('rbb_deadline', $this->input('rbbDeadline'));
        if ($rbbDeadline === 'TBD' || $rbbDeadline === '') {
            $rbbDeadline = null;
        }
        if ($this->has('rbb_deadline') || $this->has('rbbDeadline')) {
            $this->merge(['rbb_deadline' => $rbbDeadline]);
        }
    }
}
