<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (!$request->user() || !in_array($request->user()->vai_tro, $roles, true)) {
            return response()->json(['message' => 'Bạn không có quyền thực hiện thao tác này.'], 403);
        }
        return $next($request);
    }
}
