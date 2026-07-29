<?php

namespace App\Enums;

enum UserRole: string
{
    case SUPER_ADMIN = 'super_admin';
    case HEAD_OF_IT = 'head_of_it';
    case LEAD_GROUP = 'lead_group';
    case ANALYST = 'analyst';
    case DEVELOPMENT_LEAD = 'development_lead';
    case PROJECT_MANAGER = 'project_manager';
    case DEVELOPER = 'developer';
    case QA_LEAD = 'qa_lead';
    case QA_TESTER = 'qa_tester';
    case CYBER_LEAD = 'cyber_lead';
    case PENTESTER = 'pentester';
    case BUSINESS_USER = 'business_user';

    public function label(): string
    {
        return match ($this) {
            self::SUPER_ADMIN => 'Super Admin',
            self::HEAD_OF_IT => 'Head of IT',
            self::LEAD_GROUP => 'Lead Group / Kadiv',
            self::ANALYST => 'System Analyst',
            self::DEVELOPMENT_LEAD => 'Development Lead',
            self::PROJECT_MANAGER => 'Project Manager',
            self::DEVELOPER => 'Developer',
            self::QA_LEAD => 'QA Lead',
            self::QA_TESTER => 'QA Tester',
            self::CYBER_LEAD => 'Cyber Security Lead',
            self::PENTESTER => 'Pentester',
            self::BUSINESS_USER => 'Business User / Pemohon',
        };
    }
}
