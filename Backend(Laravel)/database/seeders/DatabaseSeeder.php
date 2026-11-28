<?php

namespace Database\Seeders;

use App\Models\DanhMuc;
use App\Models\GoiDinhKy;
use App\Models\LoHang;
use App\Models\NhatKyCanhTac;
use App\Models\SanPham;
use App\Models\User;
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
        $demoBatches = [];
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
            $batch = LoHang::firstOrCreate(['ma_qr' => $qr], [
                'ma_san_pham' => $product->getKey(), 'ngay_thu_hoach' => today(),
                'ngay_het_han' => today()->addDays(6), 'so_luong_nhap' => $stock,
                'so_luong_ton' => $stock, 'so_luong_hao_hut' => 0,
            ]);
            $demoBatches[] = $batch;
            if ($name === 'Cà chua bi') {
                $scenarios = [
                    ['TOMATO-SOON', 1, 5],
                    ['TOMATO-EXPIRED', -2, 6],
                    ['TOMATO-EMPTY', 3, 0],
                    ['TOMATO-LATER', 4, 8],
                ];
                foreach ($scenarios as [$scenarioQr, $expiryOffset, $stock]) {
                    $scenarioBatch = LoHang::firstOrCreate(['ma_qr' => $scenarioQr], [
                        'ma_san_pham' => $product->getKey(),
                        'ngay_thu_hoach' => today()->subDays(max(0, -$expiryOffset)),
                        'ngay_het_han' => today()->addDays($expiryOffset),
                        'so_luong_nhap' => max(10, $stock), 'so_luong_ton' => $stock,
                        'so_luong_hao_hut' => 0,
                    ]);
                    $demoBatches[] = $scenarioBatch;
                }
            }
        }

        // Add repeatable, date-relative cultivation history to the demo lots.
        // The entries are intentionally text-only because no real evidence photos are provided.
        $staff = User::where('vai_tro', 'Staff')->orderBy('ma_nguoi_dung')->first()
            ?? User::where('vai_tro', 'Admin')->orderBy('ma_nguoi_dung')->first();
        if ($staff) {
            $activities = [
                [28, 'Chuẩn bị đất và lên luống', 'Đất được làm tơi, lên luống và kiểm tra khả năng thoát nước trước khi xuống giống.', '07:10:00'],
                [20, 'Gieo trồng và ghi nhận mật độ', 'Xuống giống theo hàng, giữ khoảng cách thông thoáng để cây phát triển đồng đều.', '06:45:00'],
                [12, 'Tưới nước và kiểm tra độ ẩm', 'Tưới vừa đủ vào gốc, kiểm tra độ ẩm đất; không để luống bị đọng nước.', '06:30:00'],
                [6, 'Bổ sung dinh dưỡng hữu cơ', 'Bổ sung phân hữu cơ theo lượng phù hợp, sau đó tưới nhẹ để dinh dưỡng ngấm đều.', '07:00:00'],
                [2, 'Kiểm tra lá và sâu bệnh', 'Quan sát mặt dưới lá, loại bỏ lá già hoặc hư hỏng; chưa ghi nhận dấu hiệu bất thường.', '08:15:00'],
                [0, 'Thu hoạch và phân loại', 'Thu hoạch nhẹ tay, loại bỏ sản phẩm dập hỏng và chuyển vào khu vực bảo quản sạch.', '06:20:00'],
            ];

            foreach ($demoBatches as $demoBatch) {
                if (!$demoBatch->ngay_thu_hoach) continue;
                foreach ($activities as [$daysBeforeHarvest, $action, $note, $time]) {
                    $loggedAt = $demoBatch->ngay_thu_hoach->copy()->subDays($daysBeforeHarvest)->setTimeFromTimeString($time);
                    NhatKyCanhTac::firstOrCreate([
                        'ma_lo_hang' => $demoBatch->getKey(),
                        'hanh_dong' => $action,
                        'thoi_gian' => $loggedAt,
                    ], [
                        'ma_nhan_vien' => $staff->getKey(),
                        'ghi_chu' => $note,
                        'hinh_anh_minh_chung' => null,
                    ]);
                }
            }
        }

        GoiDinhKy::firstOrCreate(['ten_goi' => 'Rau xanh mỗi tuần'], [
            'gia_goi' => 399000, 'thoi_han_thang' => 1, 'mo_ta' => 'Giao rau theo lịch bạn chọn trong tuần.',
        ]);
    }
}
