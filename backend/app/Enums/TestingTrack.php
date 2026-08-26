<?php

namespace App\Enums;

use App\Models\DocumentVault;

/**
 * Dua jalur pengujian paralel: Pengujian QA dan Audit Keamanan Siber.
 *
 * Nilai enum sengaja sama dengan isi kolom `test_reports.test_type` supaya tidak ada
 * pemetaan tambahan antara jalur dan laporannya.
 *
 * Kedua jalur menjalankan alur yang identik — PM mengajukan, Lead mendisposisikan ke
 * tester, tester mengirim laporan, Lead melakukan sign-off — hanya dengan kolom, role,
 * dan status utama yang berbeda. Sebelum enum ini ada, perbedaan itu tersebar sebagai
 * dua controller yang saling menyalin.
 *
 * Menaruh seluruh perbedaan jalur di satu tempat membuat `TestingTrackService` bisa
 * menangani keduanya dengan satu jalur kode, sehingga penyimpangan perilaku antar
 * jalur tidak bisa muncul tanpa terlihat.
 *
 * @see \App\Services\TestingTrackService
 */
enum TestingTrack: string
{
    case QA = 'qa';
    case CYBER = 'cyber';

    public function label(): string
    {
        return match ($this) {
            self::QA => 'Pengujian QA',
            self::CYBER => 'Audit Keamanan Siber',
        };
    }

    /**
     * Kolom status jalur pada tabel `projects`.
     */
    public function statusColumn(): string
    {
        return match ($this) {
            self::QA => 'qa_status',
            self::CYBER => 'cyber_status',
        };
    }

    /**
     * Kolom penugasan tester / auditor pada tabel `projects`.
     */
    public function assigneeColumn(): string
    {
        return match ($this) {
            self::QA => 'qa_assignee_id',
            self::CYBER => 'cyber_assignee_id',
        };
    }

    /**
     * Status utama saat jalur ini mulai dikerjakan tester.
     */
    public function inProgressStatus(): ProjectStatus
    {
        return match ($this) {
            self::QA => ProjectStatus::QA_IN_PROGRESS,
            self::CYBER => ProjectStatus::CYBER_IN_PROGRESS,
        };
    }

    /**
     * Status utama saat jalur ini dinyatakan lulus oleh Lead.
     */
    public function passedStatus(): ProjectStatus
    {
        return match ($this) {
            self::QA => ProjectStatus::QA_PASSED,
            self::CYBER => ProjectStatus::CYBER_PASSED,
        };
    }

    /**
     * Role yang berwenang mendisposisikan dan melakukan sign-off pada jalur ini.
     *
     * Daftar ini sengaja mencerminkan persis matriks `$rolePermissions` pada
     * `ProjectWorkflowService`, termasuk asimetrinya: `lead_group` (Kadiv) diakui
     * pada jalur QA tetapi tidak pada jalur Keamanan Siber. Menyamakan keduanya
     * berarti memperluas wewenang sign-off keamanan, dan itu keputusan kebijakan —
     * bukan sesuatu yang layak diputuskan diam-diam di lapisan kode.
     *
     * Bila daftar di sini lebih longgar daripada matriks transisi, pengguna akan
     * lolos gerbang service lalu ditolak workflow service dengan pesan yang
     * membingungkan. Karena itu keduanya harus selalu diubah bersamaan.
     *
     * @return list<string>
     */
    public function leadRoles(): array
    {
        return match ($this) {
            self::QA => [
                UserRole::QA_LEAD->value,
                UserRole::LEAD_GROUP->value,
                UserRole::SUPER_ADMIN->value,
            ],
            self::CYBER => [
                UserRole::CYBER_LEAD->value,
                UserRole::SUPER_ADMIN->value,
            ],
        };
    }

    /**
     * Role yang sah menjadi penerima disposisi pengujian pada jalur ini.
     *
     * Lead ikut disertakan karena pada tim kecil seorang Lead kadang mengerjakan
     * pengujiannya sendiri. `super_admin` dan `lead_group` tidak disertakan: keduanya
     * role pengawas, bukan pelaksana pengujian.
     *
     * Jalur QA memakai `UserRole::PLANNING_QA_ANALYST_ROLES`, bukan hanya `qa_tester`.
     * Perencanaan (Fase 1) dan Pengujian QA (Fase 3) berada dalam satu grup —
     * `UserRole::PLANNING_QA_GROUP_LABEL` — dengan kumpulan analis yang sama, sehingga
     * QA Lead boleh mendisposisikan pengujian kepada analis mana pun di grup itu.
     * Jalur Siber tidak ikut diperluas: Keamanan Siber adalah grup yang berbeda.
     *
     * @return list<string>
     */
    public function testerRoles(): array
    {
        return match ($this) {
            self::QA => [...UserRole::PLANNING_QA_ANALYST_ROLES, UserRole::QA_LEAD->value],
            self::CYBER => [UserRole::PENTESTER->value, UserRole::CYBER_LEAD->value],
        };
    }

    /**
     * Jenis dokumen vault untuk bukti pengujian yang diunggah tester.
     */
    public function evidenceDocumentType(): string
    {
        return match ($this) {
            self::QA => DocumentVault::QA_EVIDENCE_TYPE,
            self::CYBER => DocumentVault::CYBER_EVIDENCE_TYPE,
        };
    }

    /**
     * Sebutan pelaksana pengujian pada jalur ini, untuk teks catatan dan notifikasi.
     *
     * Jalur QA memakai "Analis QA", bukan "QA Tester", karena pelaksananya bisa berasal
     * dari sisi Perencanaan maupun sisi QA pada grup yang sama — lihat `testerRoles()`.
     * Menyebut satu role saja membuat pesan penolakan terbaca seolah analis Perencanaan
     * tidak berhak, padahal ia berhak.
     */
    public function testerLabel(): string
    {
        return match ($this) {
            self::QA => 'Analis QA',
            self::CYBER => 'Pentester',
        };
    }
}
