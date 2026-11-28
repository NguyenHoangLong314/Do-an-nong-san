<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ShippingQuoteService;
use Illuminate\Http\Request;

class ShippingController extends Controller
{
    public function quote(Request $request, ShippingQuoteService $shipping)
    {
        $data = $request->validate([
            'destination.province' => ['required', 'string', 'max:120'],
            'destination.district' => ['nullable', 'string', 'max:120'],
            'destination.ward' => ['required', 'string', 'max:120'],
            'destination.address' => ['required', 'string', 'min:3', 'max:250'],
            'origin.latitude' => ['required', 'numeric', 'between:-90,90'],
            'origin.longitude' => ['required', 'numeric', 'between:-180,180'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.ma_san_pham' => ['required', 'integer', 'exists:SanPham,ma_san_pham'],
            'items.*.so_luong' => ['required', 'numeric', 'gt:0', 'max:10000'],
        ]);

        return response()->json($shipping->quote($data['destination'], $data['origin'], $data['items'], (int) $request->user()->getKey()));
    }
}
