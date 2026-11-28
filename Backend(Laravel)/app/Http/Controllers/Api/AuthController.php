<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $request, JwtService $jwt)
    {
        $data = $request->validate([
            'ho_ten' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:NguoiDung,email'],
            'mat_khau' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $user = User::create([...$data, 'mat_khau' => Hash::make($data['mat_khau']), 'vai_tro' => 'Customer']);
        return response()->json(['user' => $this->publicUser($user), 'token' => $jwt->issue($user)], 201);
    }

    public function login(Request $request, JwtService $jwt)
    {
        $data = $request->validate(['email' => ['required', 'email'], 'mat_khau' => ['required', 'string']]);
        $user = User::where('email', $data['email'])->first();
        if (!$user || !Hash::check($data['mat_khau'], $user->mat_khau)) {
            return response()->json(['message' => 'Tên đăng nhập hoặc mật khẩu không đúng.'], 401);
        }
        return response()->json(['user' => $this->publicUser($user), 'token' => $jwt->issue($user)]);
    }

    public function me(Request $request) { return response()->json(['user' => $this->publicUser($request->user())]); }
    public function logout(Request $request, JwtService $jwt)
    {
        if ($token = $request->bearerToken()) $jwt->revoke($token);
        return response()->json(['message' => 'Đã đăng xuất.']);
    }

    private function publicUser(User $user): array
    {
        return ['ma_nguoi_dung' => $user->ma_nguoi_dung, 'ho_ten' => $user->ho_ten, 'email' => $user->email, 'vai_tro' => $user->vai_tro];
    }
}
