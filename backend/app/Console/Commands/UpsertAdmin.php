<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

/**
 * Create an admin account, or promote/update an existing one (matched by email – never duplicates).
 *
 *   php artisan admin:upsert you@example.com --name="Store Admin"   # prompts for the password
 *   ADMIN_PASSWORD='...' php artisan admin:upsert you@example.com    # non-interactive
 */
class UpsertAdmin extends Command
{
    protected $signature = 'admin:upsert
        {email : Admin email address}
        {--name= : Display name (kept as-is for an existing user unless given)}';

    protected $description = 'Create or update an admin user (password hashed, is_admin = true)';

    public function handle(): int
    {
        $email = strtolower(trim($this->argument('email')));
        $password = getenv('ADMIN_PASSWORD') ?: $this->secret('Password');

        $v = Validator::make(compact('email', 'password'), [
            'email' => 'required|email',
            'password' => 'required|string|min:8',
        ]);
        if ($v->fails()) {
            foreach ($v->errors()->all() as $e) {
                $this->error($e);
            }

            return self::FAILURE;
        }

        $user = User::firstOrNew(['email' => $email]);
        $existed = $user->exists;

        $user->name = $this->option('name') ?: ($user->name ?: 'Store Admin');
        $user->password = Hash::make($password);
        $user->is_admin = true;
        $user->save();

        $this->info(($existed ? 'Updated' : 'Created')." admin #{$user->id} <{$user->email}> on database '"
            .$user->getConnection()->getDatabaseName()."'.");

        return self::SUCCESS;
    }
}
