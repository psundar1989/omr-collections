<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_log_in_use_the_token_and_log_out(): void
    {
        User::factory()->create(['email' => 'admin@example.com', 'password' => 'Secret@123', 'is_admin' => true]);

        $token = $this->postJson('/api/admin/login', ['email' => 'admin@example.com', 'password' => 'Secret@123'])
            ->assertOk()
            ->assertJsonPath('data.user.email', 'admin@example.com')
            ->json('data.token');

        $this->withToken($token)->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('data.email', 'admin@example.com');

        $this->withToken($token)->postJson('/api/admin/logout')->assertNoContent();
        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/admin/me')->assertUnauthorized();
    }

    public function test_login_rejects_wrong_password_and_non_admin_users(): void
    {
        User::factory()->create(['email' => 'admin@example.com', 'password' => 'Secret@123', 'is_admin' => true]);
        User::factory()->create(['email' => 'customer@example.com', 'password' => 'Secret@123', 'is_admin' => false]);

        $this->postJson('/api/admin/login', ['email' => 'admin@example.com', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->postJson('/api/admin/login', ['email' => 'customer@example.com', 'password' => 'Secret@123'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_admin_routes_require_a_token(): void
    {
        $this->getJson('/api/admin/me')->assertUnauthorized();
        $this->postJson('/api/admin/logout')->assertUnauthorized();
    }
}
