<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChiTietDonHang;
use App\Models\DonHang;
use App\Models\GioHang;
use App\Models\LoHang;
use App\Models\SanPham;
use App\Models\ThanhToan;
use App\Services\FefoService;
use App\Services\ShippingQuoteService;
use App\Services\VnpayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $query = DonHang::with(['customer:ma_nguoi_dung,ho_ten,email', 'items.batch.product'])->orderByDesc('ngay_tao');
        if (!in_array($request->user()->vai_tro, ['Sales', 'Admin'], true)) {
            $query->where('ma_nguoi_dung', $request->user()->getKey());
        }
        return response()->json($query->paginate(12));
    }

    public function store(Request $request, FefoService $fefo, ShippingQuoteService $shipping, VnpayService $vnpay)
    {
        $data = $request->validate([
            'dia_chi_giao_hang' => ['required', 'string', 'max:2000'],
            'phuong_thuc_thanh_toan' => ['required', Rule::in(['cod', 'bank_transfer', 'vnpay', 'momo'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.ma_san_pham' => ['required', 'integer', 'exists:SanPham,ma_san_pham'],
            'items.*.so_luong' => ['required', 'numeric', 'gt:0', 'max:10000'],
            'shipping_quote_token' => ['required', 'string', 'max:4096'],
            'shipping_destination.province' => ['required', 'string', 'max:120'],
            'shipping_destination.district' => ['nullable', 'string', 'max:120'],
            'shipping_destination.ward' => ['required', 'string', 'max:120'],
            'shipping_destination.address' => ['required', 'string', 'min:3', 'max:250'],
        ]);
        $products = SanPham::whereIn('ma_san_pham', collect($data['items'])->pluck('ma_san_pham'))->get()->keyBy('ma_san_pham');
        foreach ($data['items'] as $item) {
            $product = $products[$item['ma_san_pham']] ?? null;
            if ($product?->don_vi_tinh === 'bao' && abs((float) $item['so_luong'] - round((float) $item['so_luong'])) > 0.000001) {
                return response()->json(['status' => 'error', 'message' => 'Số lượng sản phẩm bán theo bao phải là số nguyên.'], 422);
            }
        }
        $shippingQuote = $shipping->verifyQuoteToken($data['shipping_quote_token'], $data['shipping_destination'], $data['items'], (int) $request->user()->getKey());
        if ($data['phuong_thuc_thanh_toan'] === 'vnpay' && !$vnpay->isConfigured()) {
            return response()->json(['status' => 'error', 'message' => 'VNPay chưa được cấu hình. Hãy thêm TMN Code, Hash Secret và URL callback trong Backend .env.'], 503);
        }

        [$order, $paymentUrl] = DB::transaction(function () use ($request, $data, $fefo, $shippingQuote, $vnpay) {
            $allocations = [];
            $total = 0.0;
            $requestedItems = collect($data['items'])->groupBy('ma_san_pham')->map(fn ($items, $productId) => [
                'ma_san_pham' => (int) $productId,
                'so_luong' => round($items->sum(fn ($item) => (float) $item['so_luong']), 2),
            ]);
            foreach ($requestedItems as $item) {
                $product = \App\Models\SanPham::whereKey($item['ma_san_pham'])->where('trang_thai', 'active')->firstOrFail();
                if ($product->don_vi_tinh === 'bao' && abs((float) $item['so_luong'] - round((float) $item['so_luong'])) > 0.000001) {
                    abort(422, 'Số lượng sản phẩm bán theo bao phải là số nguyên.');
                }
                foreach ($fefo->allocate($product->getKey(), (float) $item['so_luong']) as $allocation) {
                    $allocations[] = $allocation + ['price' => (float) $product->gia_co_ban];
                }
            }
            foreach ($allocations as $allocation) $total += $allocation['quantity'] * $allocation['price'];

            $order = DonHang::create([
                'ma_nguoi_dung' => $request->user()->getKey(), 'trang_thai' => 'pending',
                'ngay_tao' => now(), 'tong_tien' => round($total + $shippingQuote['fee'], 2),
                'phi_giao_hang' => $shippingQuote['fee'],
                'dia_chi_giao_hang' => $data['dia_chi_giao_hang'],
                'phuong_thuc_thanh_toan' => $data['phuong_thuc_thanh_toan'],
            ]);
            foreach ($allocations as $allocation) {
                $lot = LoHang::whereKey($allocation['lot']->getKey())->lockForUpdate()->firstOrFail();
                $lot->decrement('so_luong_ton', $allocation['quantity']);
                ChiTietDonHang::create([
                    'ma_don_hang' => $order->getKey(), 'ma_lo_hang' => $lot->getKey(),
                    'so_luong' => $allocation['quantity'], 'don_gia' => $allocation['price'],
                ]);
            }
            $payment = ThanhToan::create([
                'ma_don_hang' => $order->getKey(), 'so_tien' => round($total + $shippingQuote['fee'], 2),
                'phuong_thuc' => $data['phuong_thuc_thanh_toan'], 'trang_thai' => 'pending',
            ]);
            $paymentUrl = $data['phuong_thuc_thanh_toan'] === 'vnpay'
                ? $vnpay->createPaymentUrl($payment->getKey(), (int) round($payment->so_tien), $request)
                : null;
            GioHang::where('ma_nguoi_dung', $request->user()->getKey())->first()?->items()->delete();
            return [$order, $paymentUrl];
        }, 3);

        return response()->json(['order' => $order->load('items.batch.product'), 'payment_url' => $paymentUrl], 201);
    }

    public function show(Request $request, DonHang $order)
    {
        abort_unless(in_array($request->user()->vai_tro, ['Sales', 'Admin'], true) || (int) $order->ma_nguoi_dung === (int) $request->user()->getKey(), 403);
        return response()->json($order->load('customer:ma_nguoi_dung,ho_ten,email', 'items.batch.product', 'payments', 'complaints'));
    }

    public function updateStatus(Request $request, DonHang $order)
    {
        $data = $request->validate(['trang_thai' => ['required', Rule::in(['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'])]]);
        DB::transaction(function () use ($order, $data) {
            $lockedOrder = DonHang::whereKey($order->getKey())->lockForUpdate()->firstOrFail();
            $transitions = [
                'pending' => ['confirmed', 'cancelled'],
                'confirmed' => ['preparing', 'cancelled'],
                'preparing' => ['shipped', 'cancelled'],
                'shipped' => ['delivered'],
            ];
            if (!in_array($data['trang_thai'], $transitions[$lockedOrder->trang_thai] ?? [], true)) {
                abort(422, 'Trạng thái đơn hàng không thể chuyển theo bước này.');
            }
            if ($data['trang_thai'] === 'cancelled') {
                foreach ($lockedOrder->items()->get() as $item) {
                    LoHang::whereKey($item->ma_lo_hang)->lockForUpdate()->increment('so_luong_ton', $item->so_luong);
                }
            }
            $lockedOrder->trang_thai = $data['trang_thai'];
            if ($data['trang_thai'] === 'delivered') $lockedOrder->ngay_giao_thuc_te = now();
            $lockedOrder->save();
        }, 3);
        $order->refresh();
        return response()->json(['order' => $order]);
    }
}
