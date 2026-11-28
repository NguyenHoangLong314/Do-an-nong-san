<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\ComplaintController;
use App\Http\Controllers\Api\FarmController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\QrController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\ShippingController;
use App\Http\Controllers\Api\TraceController;
use App\Http\Controllers\Api\VnpayController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{product}', [ProductController::class, 'show']);
Route::get('/trace/{qr}', [TraceController::class, 'show']);
Route::get('/farm/loss-evidence/{path}', [FarmController::class, 'lossEvidence'])->where('path', '.*');
Route::get('/farm/batches/{batch}/qr', [QrController::class, 'show'])->name('farm.batches.qr');
Route::get('/payments/vnpay/return', [VnpayController::class, 'returned']);
Route::get('/payments/vnpay/ipn', [VnpayController::class, 'ipn']);
Route::get('/plans', [SubscriptionController::class, 'plans']);

Route::middleware('jwt')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/cart', [CartController::class, 'show']);
    Route::post('/shipping/quote', [ShippingController::class, 'quote'])->middleware('role:Customer');
    Route::put('/cart', [CartController::class, 'sync']);
    Route::delete('/cart', [CartController::class, 'clear']);
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store'])->middleware('role:Customer');
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus'])->middleware('role:Sales,Admin');
    Route::post('/orders/{order}/complaints', [ComplaintController::class, 'store'])->middleware('role:Customer');
    Route::get('/complaints', [ComplaintController::class, 'index'])->middleware('role:Sales,Admin');
    Route::patch('/complaints/{complaint}', [ComplaintController::class, 'resolve'])->middleware('role:Sales,Admin');
    Route::post('/subscriptions', [SubscriptionController::class, 'store'])->middleware('role:Customer');
    Route::get('/subscriptions', [SubscriptionController::class, 'index'])->middleware('role:Customer');
    Route::get('/farm/batches', [FarmController::class, 'index'])->middleware('role:Staff,Admin,Sales');
    Route::get('/farm/losses', [FarmController::class, 'losses'])->middleware('role:Staff,Admin');
    Route::post('/farm/batches', [FarmController::class, 'storeBatch'])->middleware('role:Staff,Admin');
    Route::put('/farm/batches/{batch}', [FarmController::class, 'updateBatch'])->middleware('role:Staff,Admin');
    Route::delete('/farm/batches/{batch}', [FarmController::class, 'destroyBatch'])->middleware('role:Staff,Admin');
    Route::post('/farm/batches/{batch}/logs', [FarmController::class, 'storeLog'])->middleware('role:Staff,Admin');
    Route::post('/farm/batches/{batch}/losses', [FarmController::class, 'storeLoss'])->middleware('role:Staff,Admin');
    Route::get('/farm/alerts', [FarmController::class, 'alerts'])->middleware('role:Staff,Admin,Sales');

    Route::prefix('admin')->middleware('role:Admin')->group(function () {
        Route::get('/overview', [AdminController::class, 'overview']);
        Route::get('/categories', [AdminController::class, 'categories']);
        Route::post('/categories', [AdminController::class, 'storeCategory']);
        Route::put('/categories/{category}', [AdminController::class, 'updateCategory']);
        Route::delete('/categories/{category}', [AdminController::class, 'destroyCategory']);
        Route::get('/products', [AdminController::class, 'products']);
        Route::post('/products', [AdminController::class, 'storeProduct']);
        Route::put('/products/{product}', [AdminController::class, 'updateProduct']);
        Route::delete('/products/{product}', [AdminController::class, 'destroyProduct']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::post('/users', [AdminController::class, 'storeEmployee']);
        Route::put('/users/{user}', [AdminController::class, 'updateEmployee']);
        Route::delete('/users/{user}', [AdminController::class, 'destroyEmployee']);
        Route::patch('/users/{user}/role', [AdminController::class, 'updateUserRole']);
        Route::get('/reports', [AdminController::class, 'reports']);
        Route::get('/settings', [AdminController::class, 'settings']);
        Route::put('/settings', [AdminController::class, 'updateSettings']);
    });
});
