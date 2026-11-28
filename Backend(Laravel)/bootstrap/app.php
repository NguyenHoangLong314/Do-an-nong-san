<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\JwtAuthenticate;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'jwt' => JwtAuthenticate::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $exception) =>
            $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(function (\Throwable $exception, Request $request) {
            if (!$request->is('api/*')) return null;

            if ($exception instanceof ValidationException) {
                return response()->json([
                    'status' => 'error',
                    'message' => collect($exception->errors())->flatten()->first() ?? 'Dữ liệu gửi lên không hợp lệ.',
                    'errors' => $exception->errors(),
                ], $exception->status);
            }

            $status = $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500;
            $safeHttpStatuses = [401, 403, 404, 409, 422, 429, 502, 503];
            $exceptionMessage = $exception->getMessage();
            $message = $exception instanceof HttpExceptionInterface && in_array($status, $safeHttpStatuses, true) && $exceptionMessage !== ''
                ? $exceptionMessage
                : ($status < 500 ? ($exceptionMessage ?: 'Yêu cầu không hợp lệ.') : 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại.');

            return response()->json(['status' => 'error', 'message' => $message], $status);
        });
    })->create();
