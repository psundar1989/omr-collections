<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@example.in')],
            ['name' => 'Store Admin', 'password' => env('ADMIN_PASSWORD', 'ChangeMe@123'), 'is_admin' => true]
        );

        if (! app()->environment('production') || env('SEED_DEMO_DATA', false)) {
            $this->call([DemoCatalogSeeder::class, BeadsCharmsCatalogSeeder::class]);
        }
    }
}
