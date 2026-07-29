<?php

namespace Database\Seeders;

use App\Enums\ProjectStatus;

use App\Models\Division;
use App\Models\Project;
use App\Models\ProjectStatusHistory;
use App\Models\ProjectTask;
use App\Models\User;
use Illuminate\Database\Seeder;

class ProjectSeeder extends Seeder
{
    public function run(): void
    {
        $admin      = User::where('email', 'admin@nagari.co.id')->first();
        $headIt     = User::where('email', 'headit@nagari.co.id')->first();
        $lead       = User::where('email', 'lead@nagari.co.id')->first();
        $analyst    = User::where('email', 'analyst@nagari.co.id')->first();
        $devLead    = User::where('email', 'devlead@nagari.co.id')->first();
        $pm         = User::where('email', 'pm@nagari.co.id')->first();
        $developer  = User::where('email', 'developer@nagari.co.id')->first();
        $qaLead     = User::where('email', 'qalead@nagari.co.id')->first();
        $qaTester   = User::where('email', 'qatester@nagari.co.id')->first();
        $cyberLead  = User::where('email', 'cyberlead@nagari.co.id')->first();
        $pentester  = User::where('email', 'pentester@nagari.co.id')->first();

        $devDiv = Division::where('code', 'IT-DEV')->first();
        $opsDiv = Division::where('code', 'IT-OPS')->first();
        $secDiv = Division::where('code', 'IT-SEC')->first();
        $qaDiv  = Division::where('code', 'IT-QA')->first();
        $dsiDiv = Division::where('code', 'DSI')->first();

        $projects = [
            // ==========================================
            // FASE 1: INISIASI & REVIEW (MINIMAL 2 PER STEP)
            // ==========================================
            [
                'title' => 'Integrasi BI-FAST Payment Gateway',
                'description' => 'Implementasi layanan transfer real-time BI-FAST pada core banking.',
                'status' => ProjectStatus::PENDING->value,
                'creator' => $admin,
                'division' => $devDiv,
                'target_days' => 60,
                'history_notes' => 'Pengajuan proyek baru diajukan ke sistem.',
            ],
            [
                'title' => 'Sistem QRIS Merchant Bank Nagari',
                'description' => 'Pengembangan portal pendaftaran & MDR merchant QRIS Bank Nagari.',
                'status' => ProjectStatus::PENDING->value,
                'creator' => $admin,
                'division' => $dsiDiv,
                'target_days' => 45,
                'history_notes' => 'Pengajuan sistem QRIS baru diajukan oleh bisnis.',
            ],
            [
                'title' => 'Modul Pelaporan OJK Terpusat (OJK Reporting)',
                'description' => 'Sentralisasi modul pelaporan keuangan dan transaksi untuk regulator OJK.',
                'status' => ProjectStatus::IN_REVIEW->value,
                'creator' => $admin,
                'division' => $devDiv,
                'target_days' => 90,
                'history_notes' => 'Pengkajian awal oleh Lead Group sedang berlangsung.',
            ],
            [
                'title' => 'Sistem Manajemen Dokumen Kredit (LOS Digital)',
                'description' => 'Digitalisasi berkas agunan dan pengajuan kredit nasabah ritel.',
                'status' => ProjectStatus::IN_REVIEW->value,
                'creator' => $admin,
                'division' => $opsDiv,
                'target_days' => 75,
                'history_notes' => 'Sedang diverifikasi kesiapan infrastruktur dokumen.',
            ],
            [
                'title' => 'Update Core Banking ISO 20022 Standard',
                'description' => 'Penyesuaian format pesan finansial antarbank sesuai standar internasional.',
                'status' => ProjectStatus::DEV_ANALYSIS->value,
                'creator' => $admin,
                'analyst' => $analyst,
                'division' => $devDiv,
                'target_days' => 120,
                'history_notes' => 'Penyusunan FSD & kajian teknis oleh System Analyst.',
            ],
            [
                'title' => 'Portal Smart Branch Self-Service Kios',
                'description' => 'Platform mesin cetak buku tabungan dan ganti kartu ATM mandiri.',
                'status' => ProjectStatus::DEV_ANALYSIS->value,
                'creator' => $admin,
                'analyst' => $analyst,
                'division' => $dsiDiv,
                'target_days' => 60,
                'history_notes' => 'Kajian integrasi perangkat keras kios sedang berjalan.',
            ],

            // ==========================================
            // FASE 2: PENGEMBANGAN (MINIMAL 2 PER STEP)
            // ==========================================
            [
                'title' => 'Nagari Corporate Internet Banking (NCIB)',
                'description' => 'Layanan internet banking giro & payroll untuk nasabah korporat.',
                'status' => ProjectStatus::READY_FOR_DEVELOPMENT->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $devDiv,
                'target_days' => 90,
                'history_notes' => 'Kajian FSD selesai, proyek siap ditunjuk PM & sprint dev.',
            ],
            [
                'title' => 'Sistem Anti-Money Laundering (AML) V2',
                'description' => 'Peningkatan modul pemantauan profil risiko dan transaksi mencurigakan.',
                'status' => ProjectStatus::READY_FOR_DEVELOPMENT->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $secDiv,
                'target_days' => 60,
                'history_notes' => 'FSD AML disetujui, siap alokasi tim developer.',
            ],
            [
                'title' => 'Nagari Mobile Banking V3 Redesign',
                'description' => 'Redesain UI/UX serta integrasi fitur transfer biometrik.',
                'status' => ProjectStatus::IN_DEVELOPMENT->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $dsiDiv,
                'target_days' => 30,
                'history_notes' => 'Pengembangan Sprint 1 frontend & backend sedang berjalan.',
            ],
            [
                'title' => 'Portal E-Form Pembukaan Rekening Digital',
                'description' => 'Portal KYC e-form mandiri calon nasabah Bank Nagari.',
                'status' => ProjectStatus::IN_DEVELOPMENT->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $dsiDiv,
                'target_days' => 40,
                'history_notes' => 'Pengembangan API integrasi Dukcapil & OCR KTP.',
            ],
            [
                'title' => 'Modul Autentikasi Biometrik Face Recognition',
                'description' => 'Verifikasi wajah untuk transaksi di atas limit harian.',
                'status' => ProjectStatus::RETURN_TO_DEV->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $secDiv,
                'target_days' => 15,
                'history_notes' => 'Dikembalikan ke Dev: Bug pada akurasi pencahayaan camera liveness.',
            ],
            [
                'title' => 'Integrasi API Payment Aggregator H2H',
                'description' => 'Host-to-Host API biller pembayaran listrik, air, dan pulsa.',
                'status' => ProjectStatus::RETURN_TO_DEV->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $devDiv,
                'target_days' => 20,
                'history_notes' => 'Dikembalikan ke Dev: Timeout pada koneksi socket biller.',
            ],

            // ==========================================
            // FASE 3: PENGUJIAN QA & CYBER (MINIMAL 2 PER STEP)
            // ==========================================
            [
                'title' => 'Portal Layanan Kas Mobil Keliling',
                'description' => 'Aplikasi pencatatan setoran & penarikan kas mobil cabang.',
                'status' => ProjectStatus::READY_FOR_QA->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $opsDiv,
                'target_days' => 25,
                'history_notes' => 'Pengembangan selesai, diajukan PM ke tim QA.',
            ],
            [
                'title' => 'Sistem Notifikasi Push SMS & WhatsApp Gateway',
                'description' => 'Layanan pengiriman OTP & notifikasi transaksi real-time.',
                'status' => ProjectStatus::READY_FOR_QA->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $devDiv,
                'target_days' => 20,
                'history_notes' => 'Modul gateway diajukan ke antrean QA.',
            ],
            [
                'title' => 'Aplikasi Modul Microfinance & KUR Digital',
                'description' => 'Sistem pemrosesan kredit usaha rakyat secara mobile oleh mantri.',
                'status' => ProjectStatus::QA_IN_PROGRESS->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $qaDiv,
                'target_days' => 15,
                'history_notes' => 'Sedang dilakukan pengujian fungsionalitas oleh QA Tester.',
            ],
            [
                'title' => 'Upgrade Middleware Messaging Queue Service',
                'description' => 'Peningkatan performa message broker RabbitMQ & Kafka.',
                'status' => ProjectStatus::QA_IN_PROGRESS->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $qaDiv,
                'target_days' => 10,
                'history_notes' => 'Uji beban stress test messaging queue sedang dilakukan.',
            ],
            [
                'title' => 'Sistem Deteksi Anomali Transaksi Anti-Fraud',
                'description' => 'Deteksi kecurangan transaksi berbasis kecerdasan buatan.',
                'status' => ProjectStatus::CYBER_IN_PROGRESS->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $secDiv,
                'target_days' => 12,
                'history_notes' => 'Pengujian penetration testing oleh Pentester Cyber Security.',
            ],
            [
                'title' => 'Integrasi API e-KTP Dukcapil Validasi NIK',
                'description' => 'Enkripsi data pribadi nasabah pada jalur komunikasi API Dukcapil.',
                'status' => ProjectStatus::CYBER_IN_PROGRESS->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $secDiv,
                'target_days' => 8,
                'history_notes' => 'Audit siber sertifikat SSL & inspeksi enkripsi AES-256.',
            ],

            // ==========================================
            // FASE 4: RILIS & QUALITY GATE (MINIMAL 2 PER STEP)
            // ==========================================
            [
                'title' => 'Portal E-Form KYC Digital V2',
                'description' => 'Lulus UAT & QA 100%, siap pengajuan rilis ke produksi.',
                'status' => ProjectStatus::PENDING_GOLIVE->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $devDiv,
                'target_days' => 5,
                'staging_url' => 'https://staging-kyc.banknagari.co.id',
                'uat_notes' => 'UAT Lulus 100% tanpa catatan minor.',
                'history_notes' => 'Diajukan ke antrean Quality Gate persetujuan Head of IT.',
            ],
            [
                'title' => 'Upgrade Server API Gateway Core Banking',
                'description' => 'Kesiapan infrastruktur dan migrasi microservices ke cluster baru.',
                'status' => ProjectStatus::PENDING_GOLIVE->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $opsDiv,
                'target_days' => 3,
                'staging_url' => 'https://staging-apigw.banknagari.co.id',
                'uat_notes' => 'Sign-off UAT dan sertifikat uji beban selesai.',
                'history_notes' => 'Menunggu verifikasi risah rilis oleh Head of IT.',
            ],
            [
                'title' => 'Sistem Audit Trail Centralized Logging',
                'description' => 'Log aktivitas seluruh aplikasi finansial tersentralisasi.',
                'status' => ProjectStatus::LIVE_PRODUCTION->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $devDiv,
                'target_days' => 0,
                'staging_url' => 'https://audit.banknagari.co.id',
                'uat_notes' => 'Proyek telah beroperasi 100% di lingkungan produksi.',
                'history_notes' => 'Disetujui untuk rilis produksi oleh Head of IT.',
            ],
            [
                'title' => 'Nagari Cash Management System (CMS) V4',
                'description' => 'Platform pengelolaan likuiditas instansi pemerintah daerah.',
                'status' => ProjectStatus::LIVE_PRODUCTION->value,
                'creator' => $admin,
                'pm' => $pm,
                'analyst' => $analyst,
                'division' => $devDiv,
                'target_days' => 0,
                'staging_url' => 'https://cms.banknagari.co.id',
                'uat_notes' => 'Go-live sukses tanpa insiden downtime.',
                'history_notes' => 'Rilis produksi resmi disetujui Head of IT.',
            ],
        ];

        foreach ($projects as $item) {
            $p = Project::create([
                'req_id' => Project::generateReqId(),
                'title' => $item['title'],
                'description' => $item['description'],
                'status' => $item['status'],
                'created_by' => $item['creator']?->id,
                'pm_id' => $item['pm']?->id ?? null,
                'analyst_id' => $item['analyst']?->id ?? null,
                'division_id' => $item['division']?->id,
                'target_date' => now()->addDays($item['target_days']),
                'staging_url' => $item['staging_url'] ?? null,
                'uat_notes' => $item['uat_notes'] ?? null,
            ]);

            ProjectStatusHistory::create([
                'project_id' => $p->id,
                'from_status' => null,
                'to_status' => $item['status'],
                'changed_by' => $item['creator']?->id,
                'notes' => $item['history_notes'],
            ]);

            // Buat sample task untuk proyek yang sedang di tahap DEV / RETURN_TO_DEV
            if (in_array($item['status'], [ProjectStatus::IN_DEVELOPMENT->value, ProjectStatus::RETURN_TO_DEV->value])) {
                ProjectTask::create([
                    'project_id' => $p->id,
                    'title' => 'Setup Environment & Modul Database',
                    'description' => 'Konfigurasi schema database & migration.',
                    'status' => 'done',
                    'assignee_id' => $developer?->id,
                    'due_date' => now()->addDays(5),
                ]);

                ProjectTask::create([
                    'project_id' => $p->id,
                    'title' => 'Pengembangan Rest API Endpoint',
                    'description' => 'Pembuatan controller & service logic.',
                    'status' => 'in_progress',
                    'assignee_id' => $developer?->id,
                    'due_date' => now()->addDays(10),
                ]);

                ProjectTask::create([
                    'project_id' => $p->id,
                    'title' => 'Integrasi Unit Testing & Security Check',
                    'description' => 'Penulisan automated test case & sanitasi input.',
                    'status' => 'todo',
                    'assignee_id' => $developer?->id,
                    'due_date' => now()->addDays(15),
                ]);
            }
        }
    }
}
