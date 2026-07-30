<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            DivisionSeeder::class,
            UserSeeder::class,
            // ProjectSeeder::class, // Nonaktifkan seeder proyek agar database bersih dari proyek awal
        ]);
    }

}
