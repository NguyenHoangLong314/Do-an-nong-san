<?php

namespace Database\Seeders;

use App\Models\DanhMuc;
use App\Models\GoiDinhKy;
use App\Models\LoHang;
use App\Models\SanPham;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $vegetables = DanhMuc::firstOrCreate(['ten_danh_muc' => 'Rau xanh'], ['mo_ta' => 'Rau trồng theo mùa']);
        $fruits = DanhMuc::firstOrCreate(['ten_danh_muc' => 'Trái cây'], ['mo_ta' => 'Trái cây thu hoạch tại vườn']);
        $products = [
            [$vegetables, 'Cải kale hữu cơ', 'Rau xanh giàu dinh dưỡng, thu hoạch trong ngày.', 49000, 'KALE-001', 24],
            [$vegetables, 'Cà chua bi', 'Cà chua chín tự nhiên trên cây.', 39000, 'TOMATO-001', 18],
            [$vegetables, 'Rau xà lách mỡ', 'Lá non giòn ngọt, canh tác không thuốc trừ sâu.', 32000, 'LETTUCE-001', 15],
            [$fruits, 'Dâu tây Đà Lạt', 'Dâu tây hái chín, đóng gói trong ngày.', 89000, 'STRAWBERRY-001', 12],
        ];
        foreach ($products as [$category, $name, $description, $price, $qr, $stock]) {
            $product = SanPham::firstOrCreate(['ten_san_pham' => $name], [
                'ma_danh_muc' => $category->getKey(), 'mo_ta' => $description,
                'gia_co_ban' => $price, 'trang_thai' => 'active',
            ]);
            LoHang::firstOrCreate(['ma_qr' => $qr], [
                'ma_san_pham' => $product->getKey(), 'ngay_thu_hoach' => today(),
                'ngay_het_han' => today()->addDays(6), 'so_luong_nhap' => $stock,
                'so_luong_ton' => $stock, 'so_luong_hao_hut' => 0,
            ]);
            if ($name === 'Cà chua bi') {
                $scenarios = [
                    ['TOMATO-SOON', 1, 5],
                    ['TOMATO-EXPIRED', -2, 6],
                    ['TOMATO-EMPTY', 3, 0],
                    ['TOMATO-LATER', 4, 8],
                ];
                foreach ($scenarios as [$scenarioQr, $expiryOffset, $stock]) {
                    LoHang::firstOrCreate(['ma_qr' => $scenarioQr], [
                        'ma_san_pham' => $product->getKey(),
                        'ngay_thu_hoach' => today()->subDays(max(0, -$expiryOffset)),
                        'ngay_het_han' => today()->addDays($expiryOffset),
                        'so_luong_nhap' => max(10, $stock), 'so_luong_ton' => $stock,
                        'so_luong_hao_hut' => 0,
                    ]);
                }
            }
        }
        GoiDinhKy::firstOrCreate(['ten_goi' => 'Rau xanh mỗi tuần'], [
            'gia_goi' => 399000, 'thoi_han_thang' => 1, 'mo_ta' => 'Giao rau theo lịch bạn chọn trong tuần.',
        ]);
    }
}
