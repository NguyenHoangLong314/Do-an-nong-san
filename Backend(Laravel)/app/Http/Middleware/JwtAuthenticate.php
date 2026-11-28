<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\JwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class JwtAuthenticate
{
    public function __construct(private JwtService $jwt) {}

    public function handle(Request $request, Closure $next): Response
    {
        $claims = $request->bearerToken() ? $this->jwt->verify($request->bearerToken()) : null;
        $user = $claims ? User::find($claims['sub']) : null;
        if (!$user) return response()->json(['message' => 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'], 401);
        $request->setUserResolver(fn () => $user);
        return $next($request);
    }
}
