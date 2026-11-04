<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $v = $request->validate(['email' => 'required|email', 'password' => 'required|string']);

        $user = User::where('email', $v['email'])->first();
        if (! $user || ! $user->is_admin || ! Hash::check($v['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Invalid admin credentials.']);
        }

        $token = $user->createToken('admin', ['admin'], now()->addDays(7))->plainTextToken;

        return ['data' => ['token' => $token, 'user' => $this->userData($user)]];
    }

    public function me(Request $request)
    {
        return ['data' => $this->userData($request->user())];
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->noContent();
    }

    public function changePassword(Request $request)
    {
        $v = $request->validate([
            'current_password' => 'required|current_password:sanctum',
            'password' => 'required|string|min:8|confirmed',
        ]);
        $request->user()->update(['password' => $v['password']]);

        return ['message' => 'Password updated.'];
    }

    private function userData(User $u): array
    {
        return ['id' => $u->id, 'name' => $u->name, 'email' => $u->email];
    }
}
