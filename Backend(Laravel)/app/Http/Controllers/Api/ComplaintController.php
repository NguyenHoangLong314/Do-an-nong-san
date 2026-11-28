<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DonHang;
use App\Models\KhieuNai;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class ComplaintController extends Controller
{
    public function index()
    {
        return response()->json(KhieuNai::with('order.items.batch.product', 'customer')->orderByDesc('ngay_tao')->paginate(20));
    }

    public function store(Request $request, DonHang $order)
    {
        abort_unless($order->ma_nguoi_dung === $request->user()->getKey(), 403);
        if ($order->trang_thai !== 'delivered' || !$order->ngay_giao_thuc_te || $order->ngay_giao_thuc_te->lt(now()->subHours(24))) {
            return response()->json(['message' => 'Đơn hàng chỉ có thể khiếu nại trong vòng 24 giờ sau khi giao.'], 422);
        }
        if ($order->complaints()->exists()) {
            return response()->json(['message' => 'Đơn hàng này đã có khiếu nại. Bạn có thể theo dõi kết quả trong chi tiết đơn hàng.'], 409);
        }
        $data = $request->validate([
            'ly_do' => ['required', 'string', 'max:255'],
            'evidence' => ['required', 'array', 'min:1'],
            'evidence.*' => ['required', 'file', 'mimes:jpg,png', 'extensions:jpg,png', 'max:5119'],
        ]);
        $paths = collect($request->file('evidence'))->map(fn ($file) => $file->store('complaints', 'public'))->all();
        $complaint = KhieuNai::create([
            'ma_don_hang' => $order->getKey(), 'ma_nguoi_dung' => $request->user()->getKey(),
            'ly_do' => $data['ly_do'], 'tep_minh_chung' => $paths,
            'trang_thai' => 'pending', 'ngay_tao' => now(),
        ]);
        return response()->json(['complaint' => $complaint->load('order', 'customer')], 201);
    }

    public function resolve(Request $request, KhieuNai $complaint)
    {
        $data = $request->validate([
            'trang_thai' => ['required', Rule::in(['approved', 'rejected', 'refunded', 'replacement'])],
            'ket_qua_xu_ly' => ['required', 'string', 'max:3000'],
        ]);
        $complaint->update($data);
        return response()->json(['complaint' => $complaint->load('order', 'customer')]);
    }

    public function evidence(Request $request, KhieuNai $complaint, int $index)
    {
        abort_unless(
            in_array($request->user()->vai_tro, ['Sales', 'Admin'], true)
                || (int) $complaint->ma_nguoi_dung === (int) $request->user()->getKey(),
            403
        );

        $paths = $complaint->tep_minh_chung ?? [];
        abort_unless(isset($paths[$index]) && Str::startsWith($paths[$index], 'complaints/'), 404);

        $disk = Storage::disk('public');
        abort_unless($disk->exists($paths[$index]), 404);

        return $disk->response($paths[$index]);
    }
}
