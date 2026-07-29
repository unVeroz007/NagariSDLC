<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Division;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $devDiv = Division::where('code', 'IT-DEV')->first();
        $secDiv = Division::where('code', 'IT-SEC')->first();
        $qaDiv  = Division::where('code', 'IT-QA')->first();
        $dsiDiv = Division::where('code', 'DSI')->first();

        $users = [
            [
                'email' => 'admin@nagari.co.id',
                'name' => 'Super Administrator',
                'role' => UserRole::SUPER_ADMIN->value,
                'division_id' => $devDiv?->id,
            ],
            [
                'email' => 'headit@nagari.co.id',
                'name' => 'Budi Santoso (Head of IT)',
                'role' => UserRole::HEAD_OF_IT->value,
                'division_id' => $devDiv?->id,
            ],
            [
                'email' => 'lead@nagari.co.id',
                'name' => 'Dewi Lestari (Lead Group)',
                'role' => UserRole::LEAD_GROUP->value,
                'division_id' => $devDiv?->id,
            ],
            [
                'email' => 'analyst@nagari.co.id',
                'name' => 'Citra Kirana (System Analyst)',
                'role' => UserRole::ANALYST->value,
                'division_id' => $devDiv?->id,
            ],
            [
                'email' => 'devlead@nagari.co.id',
                'name' => 'Fajar Nugroho (Dev Lead)',
                'role' => UserRole::DEVELOPMENT_LEAD->value,
                'division_id' => $devDiv?->id,
            ],
            [
                'email' => 'pm@nagari.co.id',
                'name' => 'Andi Wijaya (Project Manager)',
                'role' => UserRole::PROJECT_MANAGER->value,
                'division_id' => $devDiv?->id,
            ],
            [
                'email' => 'developer@nagari.co.id',
                'name' => 'Dimas Anggara (Developer)',
                'role' => UserRole::DEVELOPER->value,
                'division_id' => $devDiv?->id,
            ],
            [
                'email' => 'qalead@nagari.co.id',
                'name' => 'Eko Prasetyo (QA Lead)',
                'role' => UserRole::QA_LEAD->value,
                'division_id' => $qaDiv?->id,
            ],
            [
                'email' => 'qatester@nagari.co.id',
                'name' => 'Siti Rahmawati (QA Tester)',
                'role' => UserRole::QA_TESTER->value,
                'division_id' => $qaDiv?->id,
            ],
            [
                'email' => 'cyberlead@nagari.co.id',
                'name' => 'Gita Savitri (Cyber Lead)',
                'role' => UserRole::CYBER_LEAD->value,
                'division_id' => $secDiv?->id,
            ],
            [
                'email' => 'pentester@nagari.co.id',
                'name' => 'Rizal Pratama (Pentester)',
                'role' => UserRole::PENTESTER->value,
                'division_id' => $secDiv?->id,
            ],
            [
                'email' => 'user@nagari.co.id',
                'name' => 'Rina Amalia (Business User)',
                'role' => UserRole::BUSINESS_USER->value,
                'division_id' => $dsiDiv?->id,
            ],
        ];

        foreach ($users as $u) {
            $role = Role::where('name', $u['role'])->first();
            User::updateOrCreate(
                ['email' => $u['email']],
                [
                    'name' => $u['name'],
                    'password' => Hash::make('password123'),
                    'role_id' => $role?->id,
                    'division_id' => $u['division_id'],
                    'phone_number' => '081234567890',
                    'is_active' => true,
                ]
            );
        }
    }
}
