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

    /**
     * Nama resmi grup yang menaungi fase Perencanaan (Fase 1) dan Pengujian QA (Fase 3).
     *
     * Grup ini tidak punya perwakilan data: tabel `divisions` hanya memuat divisi
     * organisasi (tidak ada baris "Perencanaan"), tabel `roles` tidak punya kolom
     * `division_id`, dan tidak ada tabel grup. Karena itu grup di sini adalah
     * PENGELOMPOKAN ROLE, bukan entitas tersimpan, dan konstanta ini satu-satunya tempat
     * namanya ditulis di backend.
     *
     * Cerminannya di frontend ada di `frontend/src/constants/roles.js`; keduanya harus
     * diubah bersamaan.
     */
    public const PLANNING_QA_GROUP_LABEL = 'Grup Perencanaan dan Quality Assurance';

    /**
     * Analis anggota Grup Perencanaan dan Quality Assurance.
     *
     * Satu kumpulan orang, dua fase kerja: `analyst` memegang analisis perencanaan
     * (Fase 1) dan `qa_tester` memegang pengujian QA (Fase 3). Pembedaan role hanya
     * menandai fase yang biasa dikerjakan, bukan orang yang berbeda — sehingga setiap
     * anggota berhak menerima penugasan pada kedua fase.
     *
     * Satu sumber kebenaran bagi:
     *   - `TestingTrack::QA->testerRoles()` — siapa yang sah menerima disposisi QA;
     *   - `ProjectWorkflowService::$rolePermissions` — transisi Fase 1 dan jalur QA;
     *   - `ProjectAccessService` — cakupan daftar, baca, dan tulis proyek grup ini;
     *   - `ProjectController@update` — pencarian analis Fase 1 berdasarkan nama.
     *
     * Ditulis sebagai konstanta, bukan method, supaya bisa dipakai langsung pada nilai
     * awal properti (`$rolePermissions`) — PHP tidak mengizinkan panggilan method di
     * sana. Menambah role di sini tanpa menambahkannya pada matriks transisi akan
     * membuat pengguna lolos gerbang penugasan lalu ditolak saat status proyek bergerak;
     * keduanya satu paket.
     *
     * @var list<string>
     */
    public const PLANNING_QA_ANALYST_ROLES = [
        self::ANALYST->value,
        self::QA_TESTER->value,
    ];

    /**
     * Lead pada Grup Perencanaan dan Quality Assurance.
     *
     * `lead_group` (Kadiv) memimpin sisi Perencanaan, `qa_lead` memimpin sisi QA.
     * Keduanya mendisposisikan pekerjaan ke kumpulan analis yang sama.
     *
     * @var list<string>
     */
    public const PLANNING_QA_LEAD_ROLES = [
        self::LEAD_GROUP->value,
        self::QA_LEAD->value,
    ];

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

    /**
     * Apakah role ini analis pada Grup Perencanaan dan Quality Assurance?
     */
    public static function isPlanningQaAnalyst(?string $roleName): bool
    {
        return in_array($roleName, self::PLANNING_QA_ANALYST_ROLES, true);
    }
}
