<?php

namespace App\Enums;

enum UatApprovalRole: string
{
    case REQUESTER = 'requester';
    case REQUESTER_GROUP_LEAD = 'requester_group_lead';
    case REQUESTER_DIVISION_LEAD = 'requester_division_lead';
    case DEVELOPER = 'developer';
    case ANALYST_PM = 'analyst_pm';
    case DEVELOPMENT_GROUP_LEAD = 'development_group_lead';
    case TECHNOLOGY_DIVISION_LEAD = 'technology_division_lead';

    public function side(): string
    {
        return match ($this) {
            self::REQUESTER,
            self::REQUESTER_GROUP_LEAD,
            self::REQUESTER_DIVISION_LEAD => 'requester',
            default => 'it',
        };
    }

    /**
     * Metode approval yang wajib dipakai posisi ini.
     *
     * Pemohon proyek selalu memiliki akun aplikasi — dialah yang menginisiasi
     * proyek — sehingga persetujuannya dikerjakan langsung di dalam aplikasi dan
     * tidak perlu link pribadi. Pimpinan grup dan pimpinan divisi pemohon belum
     * tentu memiliki akun, jadi keduanya tetap memakai link pribadi berverifikasi
     * nomor HP. Seluruh pihak IT wajib memakai akun internal.
     */
    public function requiredMode(): UatApproverMode
    {
        return match ($this) {
            self::REQUESTER_GROUP_LEAD,
            self::REQUESTER_DIVISION_LEAD => UatApproverMode::EXTERNAL_LINK,
            default => UatApproverMode::INTERNAL_ACCOUNT,
        };
    }

    /**
     * Hanya pihak IT yang boleh menolak hasil UAT.
     *
     * Seluruh penolakan dan permintaan revisi dari sisi pemohon sudah dicatat serta
     * diaudit saat eksekusi UAT (Tahap 2) melalui skenario dan permintaan tambahan.
     * Pada tahap persetujuan, pemohon beserta pimpinannya hanya memeriksa hasil lalu
     * menyetujui, sehingga tidak ada jalur penolakan ganda atas temuan yang sama.
     */
    public function canReject(): bool
    {
        return $this->side() === 'it';
    }

    public function label(): string
    {
        return match ($this) {
            self::REQUESTER => 'Pemohon Proyek',
            self::REQUESTER_GROUP_LEAD => 'Pimpinan Grup Pemohon',
            self::REQUESTER_DIVISION_LEAD => 'Pimpinan Divisi Pemohon',
            self::DEVELOPER => 'Developer',
            self::ANALYST_PM => 'Analyst / Project Manager',
            self::DEVELOPMENT_GROUP_LEAD => 'Pimpinan Grup Pengembangan',
            self::TECHNOLOGY_DIVISION_LEAD => 'Pimpinan Divisi Teknologi dan Digitalisasi',
        };
    }
}
