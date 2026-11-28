<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoHang;

class TraceController extends Controller
{
    public function show(string $qr)
    {
        $query = LoHang::with(['product.category', 'logs' => fn ($q) => $q->orderBy('thoi_gian')]);
        $batch = (clone $query)->where('ma_qr', $qr)->first();

        // The product page displays the first 8 characters as a short lookup code.
        // QR links still contain the full UUID, but allow that displayed code too.
        if (!$batch && preg_match('/^[a-f0-9]{8}$/i', $qr)) {
            $matches = (clone $query)->where('ma_qr', 'like', $qr.'%')->limit(2)->get();

            if ($matches->count() === 1) {
                $batch = $matches->first();
            }
        }

        if (!$batch) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lô hàng. Hãy quét mã QR đầy đủ hoặc kiểm tra mã truy xuất.',
            ], 404);
        }

        return response()->json($batch);
    }
}
