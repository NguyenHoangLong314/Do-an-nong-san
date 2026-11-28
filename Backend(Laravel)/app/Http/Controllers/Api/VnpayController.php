<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DonHang;
use App\Models\LoHang;
use App\Models\ThanhToan;
use App\Services\VnpayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VnpayController extends Controller
{
    public function ipn(Request $request, VnpayService $vnpay)
    {
        if (!$vnpay->hasValidSignature($request)) return response()->json(['RspCode' => '97', 'Message' => 'Invalid signature']);

        $payment = ThanhToan::with('order')->find($request->query('vnp_TxnRef'));
        if (!$payment) return response()->json(['RspCode' => '01', 'Message' => 'Order not found']);
        if ($request->query('vnp_CurrCode') !== 'VND'
            || (int) $request->query('vnp_Amount') !== (int) round((float) $payment->so_tien * 100)) {
            return response()->json(['RspCode' => '04', 'Message' => 'Invalid amount']);
        }
        // VNPay may retry IPN delivery. A final result must never apply its
        // inventory side effects a second time (especially restoring stock).
        if (in_array($payment->trang_thai, ['paid', 'failed'], true)) {
            return response()->json(['RspCode' => '00', 'Message' => 'Confirm Success']);
        }

        DB::transaction(function () use ($request, $payment) {
            $lockedPayment = ThanhToan::whereKey($payment->getKey())->lockForUpdate()->firstOrFail();
            $order = DonHang::whereKey($lockedPayment->ma_don_hang)->lockForUpdate()->firstOrFail();
            // Recheck under lock to cover simultaneous/retried callbacks.
            if (in_array($lockedPayment->trang_thai, ['paid', 'failed'], true)) return;

            if ($request->query('vnp_ResponseCode') === '00' && $request->query('vnp_TransactionStatus') === '00') {
                $lockedPayment->update([
                    'trang_thai' => 'paid',
                    'ma_giao_dich' => (string) $request->query('vnp_TransactionNo'),
                    'ngay_thanh_toan' => now(),
                ]);
                if ($order->trang_thai === 'pending') $order->update(['trang_thai' => 'confirmed']);
            } else {
                $lockedPayment->update(['trang_thai' => 'failed']);
                if (in_array($order->trang_thai, ['pending', 'confirmed'], true)) {
                    foreach ($order->items()->get() as $item) {
                        LoHang::whereKey($item->ma_lo_hang)->lockForUpdate()->increment('so_luong_ton', $item->so_luong);
                    }
                    $order->update(['trang_thai' => 'cancelled']);
                }
            }
        }, 3);

        return response()->json(['RspCode' => '00', 'Message' => 'Confirm Success']);
    }

    public function returned(Request $request, VnpayService $vnpay)
    {
        $success = $vnpay->hasValidSignature($request)
            && $request->query('vnp_ResponseCode') === '00'
            && $request->query('vnp_TransactionStatus') === '00';
        $payment = $success ? ThanhToan::find($request->query('vnp_TxnRef')) : null;
        $orderId = $payment?->ma_don_hang ?? '';
        $url = rtrim((string) config('services.vnpay.frontend_url'), '/') . '/?payment=' . ($success ? 'success' : 'failed');
        if ($orderId) $url .= '&order_id=' . urlencode((string) $orderId);

        return redirect()->away($url);
    }
}
