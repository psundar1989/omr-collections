<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UpsertAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_an_admin_who_can_log_in(): void
    {
        $this->artisan('admin:upsert', ['email' => 'Boss@Example.com', '--name' => 'Boss'])
            ->expectsQuestion('Password', 'Secret@123')
            ->assertSuccessful();

        $user = User::sole();
        $this->assertSame('boss@example.com', $user->email);
        $this->assertTrue($user->is_admin);
        $this->assertNotSame('Secret@123', $user->password);
        $this->assertTrue(Hash::check('Secret@123', $user->password));

        $this->postJson('/api/admin/login', ['email' => 'boss@example.com', 'password' => 'Secret@123'])
            ->assertOk()
            ->assertJsonPath('data.user.email', 'boss@example.com');
    }

    public function test_it_promotes_an_existing_user_without_duplicating(): void
    {
        $existing = User::create(['name' => 'Customer', 'email' => 'boss@example.com', 'password' => 'Old@12345', 'is_admin' => false]);

        $this->artisan('admin:upsert', ['email' => 'boss@example.com'])
            ->expectsQuestion('Password', 'New@12345')
            ->assertSuccessful();

        $this->assertSame(1, User::count());
        $existing->refresh();
        $this->assertTrue($existing->is_admin);
        $this->assertSame('Customer', $existing->name);
        $this->assertTrue(Hash::check('New@12345', $existing->password));
    }

    public function test_it_rejects_a_short_password(): void
    {
        $this->artisan('admin:upsert', ['email' => 'boss@example.com'])
            ->expectsQuestion('Password', 'short')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }
}
