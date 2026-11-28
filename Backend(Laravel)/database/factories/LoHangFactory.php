<?php

namespace Database\Factories;

use App\Models\LoHang;
use App\Models\SanPham;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class LoHangFactory extends Factory
{
    protected $model = LoHang::class;

    public function definition(): array
    {
        $harvest = fake()->dateTimeBetween('-7 days', 'today');
        $expiry = (clone $harvest)->modify('+'.fake()->numberBetween(1, 14).' days');
        $stock = fake()->randomFloat(2, 0, 50);

        return [
            'ma_san_pham' => SanPham::query()->inRandomOrder()->value('ma_san_pham') ?? 1,
            'ngay_thu_hoach' => $harvest->format('Y-m-d'),
            'ngay_het_han' => $expiry->format('Y-m-d'),
            'so_luong_nhap' => max(1, $stock),
            'so_luong_ton' => $stock,
            'so_luong_hao_hut' => 0,
            'ma_qr' => (string) Str::uuid(),
        ];
    }

    public function expired(): static
    {
        return $this->state(fn () => [
            'ngay_thu_hoach' => today()->subDays(3)->toDateString(),
            'ngay_het_han' => today()->subDay()->toDateString(),
        ]);
    }

    public function emptyStock(): static
    {
        return $this->state(fn () => ['so_luong_ton' => 0]);
    }

    public function expiringSoon(): static
    {
        return $this->state(fn () => [
            'ngay_thu_hoach' => today()->subDay()->toDateString(),
            'ngay_het_han' => today()->addDay()->toDateString(),
        ]);
    }
}
