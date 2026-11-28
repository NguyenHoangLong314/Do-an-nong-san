<?php

namespace App\Services;

use App\Models\LoHang;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class FefoService
{
    /** @return Collection<int, array{lot: LoHang, quantity: float}> */
    public function allocate(int $productId, float $quantity): Collection
    {
        $remaining = round($quantity, 2);
        $allocations = collect();
        $lots = LoHang::where('ma_san_pham', $productId)
            ->whereDate('ngay_het_han', '>=', today())
            ->where('so_luong_ton', '>', 0)
            ->orderBy('ngay_het_han')->orderBy('ma_lo_hang')
            ->lockForUpdate()->get();

        foreach ($lots as $lot) {
            if ($remaining <= 0) break;
            $taken = min($remaining, (float) $lot->so_luong_ton);
            $allocations->push(['lot' => $lot, 'quantity' => $taken]);
            $remaining = round($remaining - $taken, 2);
        }

        if ($remaining > 0) {
            throw ValidationException::withMessages([
                'items' => ['Tổng tồn kho còn hạn không đủ số lượng yêu cầu.'],
            ]);
        }

        return $allocations;
    }
}
