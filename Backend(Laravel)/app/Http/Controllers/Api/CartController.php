<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChiTietGioHang;
use App\Models\GioHang;
use App\Models\SanPham;
use App\Models\LoHang;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CartController extends Controller
{
    public function show(Request $request)
    {
        $cart = $this->cartFor($request)->load('items.product.category');

        return response()->json([
            'items' => $cart->items->map(fn (ChiTietGioHang $item) => [
                'product' => $item->product,
                'quantity' => $item->so_luong,
            ])->values(),
        ]);
    }

    public function sync(Request $request)
    {
        $data = $request->validate([
            'items' => ['present', 'array', 'max:100'],
            'items.*.ma_san_pham' => ['required', 'integer', 'distinct', 'exists:SanPham,ma_san_pham'],
            'items.*.so_luong' => ['required', 'numeric', 'gt:0', 'max:10000'],
        ]);

        $cart = $this->cartFor($request);

        DB::transaction(function () use ($data, $cart) {
            $productIds = collect($data['items'])->pluck('ma_san_pham')->map(fn ($id) => (int) $id);
            if ($productIds->isNotEmpty() && SanPham::whereIn('ma_san_pham', $productIds)->where('trang_thai', 'active')->count() !== $productIds->count()) {
                abort(422, 'Một số sản phẩm trong giỏ hiện không còn được mở bán.');
            }

            foreach ($data['items'] as $item) {
                $product = SanPham::findOrFail($item['ma_san_pham']);
                if ($product->don_vi_tinh === 'bao' && abs((float) $item['so_luong'] - round((float) $item['so_luong'])) > 0.000001) {
                    abort(422, 'Số lượng sản phẩm bán theo bao phải là số nguyên.');
                }
                $available = LoHang::where('ma_san_pham', $item['ma_san_pham'])
                    ->whereDate('ngay_het_han', '>=', today())
                    ->where('so_luong_ton', '>', 0)->sum('so_luong_ton');
                if ((float) $item['so_luong'] > (float) $available) {
                    abort(422, 'Số lượng vượt quá tồn kho còn hạn. Hiện còn '.$available.' '.$product->don_vi_tinh.'.');
                }
            }

            $cart->items()->delete();
            foreach ($data['items'] as $item) {
                $cart->items()->create([
                    'ma_san_pham' => $item['ma_san_pham'],
                    'so_luong' => $item['so_luong'],
                ]);
            }
            $cart->update(['cap_nhat_luc' => now()]);
        }, 3);

        return $this->show($request);
    }

    public function clear(Request $request)
    {
        $cart = $this->cartFor($request);
        $cart->items()->delete();
        $cart->update(['cap_nhat_luc' => now()]);

        return response()->json(['items' => []]);
    }

    private function cartFor(Request $request): GioHang
    {
        return GioHang::firstOrCreate(['ma_nguoi_dung' => $request->user()->getKey()]);
    }
}
