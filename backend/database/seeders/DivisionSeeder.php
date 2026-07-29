<?php

namespace Database\Seeders;

use App\Models\Division;
use Illuminate\Database\Seeder;

class DivisionSeeder extends Seeder
{
    public function run(): void
    {
        $divisions = [
            ['code' => 'IT-DEV', 'name' => 'Divisi Pengembangan TI'],
            ['code' => 'IT-OPS', 'name' => 'Divisi Operasional & Infra TI'],
            ['code' => 'IT-SEC', 'name' => 'Divisi Cyber Security'],
            ['code' => 'IT-QA', 'name' => 'Divisi Quality Assurance TI'],
            ['code' => 'DSI', 'name' => 'Divisi Strategi Perbankan Digital'],
        ];

        foreach ($divisions as $div) {
            Division::updateOrCreate(['code' => $div['code']], $div);
        }
    }
}
