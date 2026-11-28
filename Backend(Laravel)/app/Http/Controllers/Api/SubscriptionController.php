<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DangKyGoi;
use App\Models\GoiDinhKy;
use App\Models\LichGiaoHang;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubscriptionController extends Controller
{
    public function plans()
    {
        return response()->json(GoiDinhKy::orderBy('gia_goi')->get());
    }

    public function index(Request $request)
    {
        return response()->json(DangKyGoi::with('plan', 'deliveries.order')->where('ma_nguoi_dung', $request->user()->getKey())->orderByDesc('ma_dang_ky')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'ma_goi' => ['required', 'integer', 'exists:GoiDinhKy,ma_goi'],
            'ngay_bat_dau' => ['required', 'date', 'after_or_equal:today'],
            'ngay_ket_thuc' => ['required', 'date', 'after:ngay_bat_dau', 'before_or_equal:'.now()->addYear()->toDateString()],
            'ngay_giao_trong_tuan' => ['required', 'array', 'min:1'],
            'ngay_giao_trong_tuan.*' => ['required', 'integer', 'between:0,6'],
        ]);

        $subscription = DB::transaction(function () use ($request, $data) {
            $days = array_values(array_unique(array_map('intval', $data['ngay_giao_trong_tuan'])));
            $subscription = DangKyGoi::create([
                'ma_nguoi_dung' => $request->user()->getKey(), 'ma_goi' => $data['ma_goi'],
                'ngay_bat_dau' => $data['ngay_bat_dau'], 'ngay_ket_thuc' => $data['ngay_ket_thuc'],
                'chu_ky' => json_encode($days), 'trang_thai' => 'active',
            ]);

            $start = Carbon::parse($data['ngay_bat_dau']);
            $end = Carbon::parse($data['ngay_ket_thuc']);
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                if (in_array($date->dayOfWeek, $days, true)) {
                    LichGiaoHang::create([
                        'ma_dang_ky' => $subscription->getKey(), 'ngay_giao' => $date->toDateString(), 'trang_thai' => 'scheduled',
                    ]);
                }
            }
            return $subscription;
        });

        return response()->json(['subscription' => $subscription->load('plan', 'deliveries')], 201);
    }
}
