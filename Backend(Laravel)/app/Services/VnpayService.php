<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VnpayService
{
    public function isConfigured(): bool
    {
        return (bool) config('services.vnpay.enabled')
            && filled(config('services.vnpay.tmn_code'))
            && filled(config('services.vnpay.hash_secret'))
            && filled(config('services.vnpay.return_url'))
            && filled(config('services.vnpay.ipn_url'));
    }

    public function createPaymentUrl(int $paymentId, int $amount, Request $request): string
    {
        $params = [
            'vnp_Version' => '2.1.0',
            'vnp_Command' => 'pay',
            'vnp_TmnCode' => config('services.vnpay.tmn_code'),
            'vnp_Amount' => (string) ((int) round($amount * 100)),
            'vnp_CurrCode' => 'VND',
            'vnp_TxnRef' => (string) $paymentId,
            'vnp_OrderInfo' => 'Thanh toan don hang ' . $paymentId,
            'vnp_OrderType' => 'other',
            'vnp_Locale' => 'vn',
            'vnp_ReturnUrl' => config('services.vnpay.return_url'),
            'vnp_IpAddr' => $request->ip() ?: '127.0.0.1',
            'vnp_CreateDate' => now()->format('YmdHis'),
            'vnp_ExpireDate' => now()->addMinutes(15)->format('YmdHis'),
        ];
        ksort($params);
        // VNPay's PHP integration example signs urlencode() output (RFC 1738),
        // where spaces become '+'. Keep the signed data and outgoing URL encoding
        // consistent with the gateway's canonical representation.
        $query = http_build_query($params, '', '&', PHP_QUERY_RFC1738);
        $params['vnp_SecureHash'] = hash_hmac('sha512', $query, (string) config('services.vnpay.hash_secret'));

        return rtrim((string) config('services.vnpay.url'), '?') . '?' . http_build_query($params, '', '&', PHP_QUERY_RFC1738);
    }

    public function hasValidSignature(Request $request): bool
    {
        $params = $request->query();
        $provided = (string) ($params['vnp_SecureHash'] ?? '');
        unset($params['vnp_SecureHash'], $params['vnp_SecureHashType']);
        if ($provided === '' || !config('services.vnpay.hash_secret')) return false;
        ksort($params);
        $query = http_build_query($params, '', '&', PHP_QUERY_RFC1738);

        return hash_equals(hash_hmac('sha512', $query, (string) config('services.vnpay.hash_secret')), Str::lower($provided));
    }
}
