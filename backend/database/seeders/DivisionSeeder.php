<?php

namespace Database\Seeders;

use App\Models\Division;
use Illuminate\Database\Seeder;

class DivisionSeeder extends Seeder
{
    public function run(): void
    {
        $divisions = [
            ['code' => 'IT-DEV', 'name' => 'Divisi Teknologi dan Digitalisasi', 'description' => 'Unit kerja riset, pengembang perangkat lunak, dan arsitektur sistem TI Bank Nagari'],
            ['code' => 'IT-OPS', 'name' => 'Divisi Operasional & Infra TI', 'description' => 'Pengelolaan infrastruktur server, jaringan, data center, dan operasional TI'],
            ['code' => 'IT-SEC', 'name' => 'Divisi Cyber Security', 'description' => 'Pengamanan siber, audit pentest, dan tata kelola keamanan informasi'],
            ['code' => 'IT-QA', 'name' => 'Divisi Quality Assurance TI', 'description' => 'Pengujian kualitas lunak (SIT) dan pemastian standar mutu pengiriman aplikasi'],
            ['code' => 'DSI', 'name' => 'Divisi Strategi Perbankan Digital', 'description' => 'Perencanaan bisnis digital, inovasi layanan digital, dan channel perbankan'],
            ['code' => 'KREDIT', 'name' => 'Divisi Kredit & Pembiayaan', 'description' => 'Pengelolaan produk dan analisis pembiayaan ritel, komersial, & korporasi'],
            ['code' => 'DANA', 'name' => 'Divisi Dana & Jasa', 'description' => 'Pengembangan produk simpanan, giro, deposito, dan transaksi jasa keuangan'],
            ['code' => 'KEPATUHAN', 'name' => 'Divisi Kepatuhan & Manajemen Risiko', 'description' => 'Pemastian kepatuhan regulasi OJK/BI dan manajemen risiko operasional'],
            ['code' => 'SDM', 'name' => 'Divisi Human Capital & Umum', 'description' => 'Pengelolaan sumber daya manusia, organisasi, dan sarana prasarana'],
            ['code' => 'AUDIT', 'name' => 'Divisi Audit Internal', 'description' => 'Pemeriksaan internal dan evaluasi tata kelola operasional serta TI'],
        ];

        foreach ($divisions as $div) {
            Division::updateOrCreate(['code' => $div['code']], $div);
        }
    }
}
