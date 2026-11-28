<?php

namespace App\Services;

use App\Models\SanPham;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class ShippingQuoteService
{
    public function quote(array $destination, array $origin, array $items, int $customerId): array
    {
        $config = config('services.ghtk');

        $cart = collect($items)->groupBy('ma_san_pham')->map(fn ($rows, $id) => [
            'ma_san_pham' => (int) $id,
            'so_luong' => round($rows->sum(fn ($row) => (float) $row['so_luong']), 2),
        ])->sortBy('ma_san_pham')->values();
        $products = SanPham::whereIn('ma_san_pham', $cart->pluck('ma_san_pham'))->get()->keyBy('ma_san_pham');
        abort_if($products->count() !== $cart->count(), 422, 'Có sản phẩm không còn tồn tại.');

        foreach ($cart as $item) {
            if ($products[$item['ma_san_pham']]->don_vi_tinh === 'bao'
                && abs((float) $item['so_luong'] - round((float) $item['so_luong'])) > 0.000001) {
                abort(422, 'Số lượng sản phẩm bán theo bao phải là số nguyên.');
            }
        }

        // Convert each product's sale units to grams for the courier API.
        $weight = (int) ceil($cart->sum(fn ($item) => $item['so_luong'] * (float) $products[$item['ma_san_pham']]->trong_luong_don_vi_kg) * 1000);
        $value = (int) round($cart->sum(fn ($item) => $item['so_luong'] * (float) $products[$item['ma_san_pham']]->gia_co_ban));
        abort_if($weight < 1, 422, 'Khối lượng đơn hàng không hợp lệ.');

        if ($config['demo_mode']) {
            // In demo mode, estimate straight-line distance from the saved device
            // location to the delivery address; no courier account or charge is used.
            $coordinates = $this->geocodeDestination($destination);
            $distanceKm = $this->distanceKm((float) $origin['latitude'], (float) $origin['longitude'], $coordinates['latitude'], $coordinates['longitude']);
            $rate = (int) config('services.ghtk.demo_rate_per_km', 5000);
            $fee = (int) ceil($distanceKm) * $rate;
            $insuranceFee = 0;
            $extFees = 0;
        } else {
            if (empty($config['token']) || empty($config['pick_province']) || empty($config['pick_ward'])) {
                abort(503, 'GHTK chưa được cấu hình. Hãy thêm token và địa chỉ lấy hàng của shop trong Backend .env.');
            }
            $params = [
                'pick_province' => $config['pick_province'],
                'pick_district' => $config['pick_district'] ?: null,
                'pick_ward' => $config['pick_ward'],
                'pick_address' => $config['pick_address'] ?: null,
                'province' => $destination['province'],
                'district' => $destination['district'] ?: null,
                'ward' => $destination['ward'],
                'address' => $destination['address'],
                'weight' => $weight,
                'value' => $value,
                'deliver_option' => 'none',
            ];

            try {
                $response = Http::acceptJson()
                    ->withHeaders(array_filter([
                        'Token' => $config['token'],
                        'X-Client-Source' => $config['partner_code'] ?: null,
                    ]))
                    ->timeout(12)
                    ->get(rtrim($config['base_url'], '/').'/services/shipment/fee', array_filter($params, fn ($v) => $v !== null && $v !== ''));
            } catch (Throwable $exception) {
                report($exception);
                abort(502, 'Không kết nối được GHTK để tính phí giao hàng. Vui lòng thử lại.');
            }

            if (!$response->successful() || !$response->json('success') || !$response->json('fee.delivery')) {
                report(new \RuntimeException('GHTK fee API returned HTTP '.$response->status().': '.Str::limit($response->body(), 1000)));
                abort(422, 'GHTK chưa hỗ trợ tuyến giao này hoặc thông tin địa chỉ chưa hợp lệ. Hãy kiểm tra tỉnh/thành và phường/xã.');
            }
            $fee = (int) data_get($response->json(), 'fee.fee', 0);
            $insuranceFee = (int) data_get($response->json(), 'fee.insurance_fee', 0);
            $extFees = (int) data_get($response->json(), 'fee.extFees', 0);
        }

        $quote = [
            'fee' => $fee,
            'insurance_fee' => $insuranceFee,
            'ext_fees' => $extFees,
            'weight_grams' => $weight,
            'distance_km' => isset($distanceKm) ? round($distanceKm, 1) : null,
            'rate_per_km' => isset($rate) ? $rate : null,
            'method' => $config['demo_mode'] ? 'ghtk_demo' : 'ghtk',
            'is_demo' => (bool) $config['demo_mode'],
        ];
        $quote['quote_token'] = $this->makeQuoteToken($destination, $cart->all(), $customerId, $quote);
        return $quote;
    }

    public function verifyQuoteToken(string $token, array $destination, array $items, int $customerId): array
    {
        try {
            $payload = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            abort(422, 'Báo giá giao hàng không hợp lệ. Hãy tính lại phí giao hàng.');
        }

        $cart = collect($items)->groupBy('ma_san_pham')->map(fn ($rows, $id) => [
            'ma_san_pham' => (int) $id,
            'so_luong' => round($rows->sum(fn ($row) => (float) $row['so_luong']), 2),
        ])->sortBy('ma_san_pham')->values()->all();
        $valid = is_array($payload)
            && ($payload['customer_id'] ?? null) === $customerId
            && ($payload['destination_hash'] ?? '') === hash('sha256', json_encode($this->normalizeDestination($destination), JSON_THROW_ON_ERROR))
            && ($payload['items_hash'] ?? '') === hash('sha256', json_encode($cart, JSON_THROW_ON_ERROR))
            && (int) ($payload['expires_at'] ?? 0) >= now()->timestamp;
        if (!$valid) abort(422, 'Báo giá đã hết hạn hoặc địa chỉ/giỏ hàng đã thay đổi. Hãy tính lại phí giao hàng.');

        return [
            'fee' => (int) $payload['fee'],
            'insurance_fee' => (int) $payload['insurance_fee'],
            'ext_fees' => (int) $payload['ext_fees'],
            'weight_grams' => (int) $payload['weight_grams'],
            'distance_km' => $payload['distance_km'] ?? null,
            'rate_per_km' => $payload['rate_per_km'] ?? null,
            'method' => ($payload['is_demo'] ?? true) ? 'ghtk_demo' : 'ghtk',
            'is_demo' => (bool) ($payload['is_demo'] ?? true),
        ];
    }

    private function makeQuoteToken(array $destination, array $items, int $customerId, array $quote): string
    {
        return Crypt::encryptString(json_encode([
            'customer_id' => $customerId,
            'destination_hash' => hash('sha256', json_encode($this->normalizeDestination($destination), JSON_THROW_ON_ERROR)),
            'items_hash' => hash('sha256', json_encode($items, JSON_THROW_ON_ERROR)),
            'fee' => $quote['fee'],
            'insurance_fee' => $quote['insurance_fee'],
            'ext_fees' => $quote['ext_fees'],
            'weight_grams' => $quote['weight_grams'],
            'is_demo' => $quote['is_demo'],
            'distance_km' => $quote['distance_km'],
            'rate_per_km' => $quote['rate_per_km'],
            'expires_at' => now()->addMinutes(15)->timestamp,
        ], JSON_THROW_ON_ERROR));
    }

    private function geocodeDestination(array $destination): array
    {
        $query = implode(', ', array_filter([
            $destination['address'] ?? '',
            $destination['ward'] ?? '',
            $destination['district'] ?? '',
            $destination['province'] ?? '',
            'Vietnam',
        ]));
        $cacheKey = 'shipping-geocode:'.hash('sha256', mb_strtolower($query, 'UTF-8'));

        return Cache::remember($cacheKey, now()->addDays(7), function () use ($query) {
            try {
                $result = Cache::lock('nominatim-request-lock', 10)->block(5, function () use ($query) {
                    $lastRequestAt = (float) Cache::get('nominatim-last-request-at', 0);
                    $delayMicroseconds = (int) max(0, (1 - (microtime(true) - $lastRequestAt)) * 1000000);
                    if ($delayMicroseconds > 0) usleep($delayMicroseconds);
                    Cache::put('nominatim-last-request-at', microtime(true), now()->addMinute());

                    return Http::acceptJson()
                        ->withHeaders(['User-Agent' => 'NongTraiLanh/1.0 (student project)', 'Referer' => config('app.url')])
                        ->timeout(10)
                        ->get('https://nominatim.openstreetmap.org/search', [
                            'q' => $query,
                            'format' => 'jsonv2',
                            'limit' => 1,
                            'countrycodes' => 'vn',
                        ]);
                });
            } catch (Throwable $exception) {
                report($exception);
                abort(502, 'Không tra được tọa độ địa chỉ giao hàng. Kiểm tra kết nối Internet hoặc thử ghi rõ địa chỉ hơn.');
            }

            if (!$result->successful()) abort(502, 'Dịch vụ bản đồ đang tạm thời không phản hồi. Vui lòng thử lại sau.');
            $place = $result->json('0');
            if (!is_array($place) || !isset($place['lat'], $place['lon'])) {
                abort(422, 'Không tìm thấy địa chỉ này trên bản đồ. Hãy nhập đủ số nhà, phường/xã, quận/huyện và tỉnh/thành.');
            }

            return ['latitude' => (float) $place['lat'], 'longitude' => (float) $place['lon']];
        });
    }

    private function distanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadiusKm = 6371.0088;
        $latDelta = deg2rad($lat2 - $lat1);
        $lonDelta = deg2rad($lon2 - $lon1);
        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lonDelta / 2) ** 2;
        return $earthRadiusKm * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function normalizeDestination(array $destination): array
    {
        return array_map(fn ($value) => mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string) $value) ?? (string) $value), 'UTF-8'), [
            'province' => $destination['province'] ?? '',
            'district' => $destination['district'] ?? '',
            'ward' => $destination['ward'] ?? '',
            'address' => $destination['address'] ?? '',
        ]);
    }
}
