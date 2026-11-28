<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SanPham;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $products = SanPham::query()
            ->with('category')
            ->withSum(['batches as ton_kho' => fn ($q) => $q->where('ngay_het_han', '>=', now()->toDateString())], 'so_luong_ton')
            ->when($request->filled('q'), fn ($q) => $q->where('ten_san_pham', 'like', '%'.$request->string('q').'%'))
            ->when($request->filled('danh_muc'), fn ($q) => $q->where('ma_danh_muc', $request->integer('danh_muc')))
            ->where('trang_thai', 'active')
            ->orderBy('ten_san_pham')
            ->paginate(12);

        return response()->json($products);
    }

    public function show(SanPham $product)
    {
        $product->load(['category', 'batches' => fn ($q) => $q
            ->where('so_luong_ton', '>', 0)
            ->where('ngay_het_han', '>=', now()->toDateString())
            ->orderBy('ngay_het_han'), 'batches.logs' => fn ($q) => $q->orderBy('thoi_gian')]);

        return response()->json($product);
    }
}
