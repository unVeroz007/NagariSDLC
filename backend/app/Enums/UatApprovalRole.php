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
