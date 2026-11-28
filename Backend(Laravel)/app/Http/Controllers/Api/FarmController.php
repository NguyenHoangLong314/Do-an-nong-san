<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoHang;
use App\Models\NhatKyCanhTac;
use App\Models\PhieuHaoHut;
use App\Models\SanPham;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FarmController extends Controller
{
    public function index()
    {
        return response()->json(LoHang::with('product')->orderBy('ngay_het_han')->paginate(30));
    }

    public function losses()
    {
        return response()->json(PhieuHaoHut::with([
            'batch.product',
            'staff:ma_nguoi_dung,ho_ten',
        ])->orderByDesc('ngay_ghi_nhan')->paginate(20));
    }

    public function lossEvidence(string $path)
    {
        abort_unless(Str::startsWith($path, 'loss-reports/'), 404);
        $disk = Storage::disk('public');
        abort_unless($disk->exists($path), 404);

        return $disk->response($path);
    }

    public function storeBatch(Request $request)
    {
        $data = $request->validate([
            'ma_san_pham' => ['required', 'integer', 'exists:SanPham,ma_san_pham'],
            'ngay_thu_hoach' => ['required', 'date'],
            'ngay_het_han' => ['required', 'date', 'after_or_equal:ngay_thu_hoach'],
            'so_luong_nhap' => ['required', 'numeric', 'gt:0'],
        ]);
        $product = SanPham::findOrFail($data['ma_san_pham']);
        if ($product->don_vi_tinh === 'bao' && abs((float) $data['so_luong_nhap'] - round((float) $data['so_luong_nhap'])) > 0.000001) {
            abort(422, 'Số lượng nhập của sản phẩm bán theo bao phải là số nguyên.');
        }
        $batch = LoHang::create($data + [
            'so_luong_ton' => $data['so_luong_nhap'], 'so_luong_hao_hut' => 0,
            'ma_qr' => (string) Str::uuid(),
        ]);
        $traceUrl = rtrim((string) config('services.frontend_url'), '/')
            .'/trace/'.rawurlencode((string) $batch->ma_qr);

        return response()->json([
            'batch' => $batch->load('product'),
            'trace_url' => $traceUrl,
            'qr_image_url' => route('farm.batches.qr', $batch),
        ], 201);
    }

    public function updateBatch(Request $request, LoHang $batch)
    {
        $data = $request->validate([
            'ngay_thu_hoach' => ['required', 'date'],
            'ngay_het_han' => ['required', 'date', 'after_or_equal:ngay_thu_hoach'],
        ]);
        $batch->update($data);
        return response()->json(['batch' => $batch->load('product')]);
    }

    public function destroyBatch(LoHang $batch)
    {
        if ((float) $batch->so_luong_ton > 0) {
            return response()->json(['status' => 'error', 'message' => 'Không thể xóa lô còn tồn kho. Hãy xuất bán hoặc ghi nhận hao hụt trước.'], 409);
        }
        if ($batch->logs()->exists() || $batch->losses()->exists() || $batch->orderLines()->exists()) {
            return response()->json(['status' => 'error', 'message' => 'Không thể xóa lô đã có nhật ký, hao hụt hoặc đơn hàng để bảo toàn lịch sử truy xuất.'], 409);
        }

        $batch->delete();
        return response()->json(['message' => 'Đã xóa lô hàng.']);
    }

    public function storeLog(Request $request, LoHang $batch)
    {
        $data = $request->validate([
            'hanh_dong' => ['required', 'string', 'max:150'],
            'ghi_chu' => ['nullable', 'string', 'max:5000'],
            'thoi_gian' => ['nullable', 'date'],
            'evidence.*' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,mp4,mov', 'max:10240'],
        ]);
        $files = collect($request->file('evidence', []))->map(fn ($file) => $file->store('farm-journals', 'public'))->all();
        $log = NhatKyCanhTac::create([
            'ma_lo_hang' => $batch->getKey(), 'ma_nhan_vien' => $request->user()->getKey(),
            'hanh_dong' => $data['hanh_dong'], 'ghi_chu' => $data['ghi_chu'] ?? null,
            'thoi_gian' => $data['thoi_gian'] ?? now(), 'hinh_anh_minh_chung' => $files,
        ]);
        return response()->json(['log' => $log], 201);
    }

    public function storeLoss(Request $request, LoHang $batch)
    {
        $data = $request->validate([
            'so_luong' => ['required', 'numeric', 'gt:0'],
            'ly_do' => ['required', 'string', 'max:255'],
            'evidence.*' => ['nullable', 'image', 'max:10240'],
        ]);
        $unit = $batch->product?->don_vi_tinh ?? 'kg';
        if ($unit === 'bao' && abs((float) $data['so_luong'] - round((float) $data['so_luong'])) > 0.000001) {
            abort(422, 'Số lượng hao hụt của sản phẩm bán theo bao phải là số nguyên.');
        }
        $files = collect($request->file('evidence', []))->map(fn ($file) => $file->store('loss-reports', 'public'))->all();
        $loss = DB::transaction(function () use ($request, $batch, $data, $files) {
            $locked = LoHang::whereKey($batch->getKey())->lockForUpdate()->firstOrFail();
            if ((float) $data['so_luong'] > (float) $locked->so_luong_ton) abort(422, 'Số lượng hao hụt vượt quá tồn kho hiện tại.');
            $locked->decrement('so_luong_ton', $data['so_luong']);
            $locked->increment('so_luong_hao_hut', $data['so_luong']);
            return PhieuHaoHut::create([
                'ma_lo_hang' => $locked->getKey(), 'ma_nhan_vien' => $request->user()->getKey(),
                'so_luong' => $data['so_luong'], 'ly_do' => $data['ly_do'],
                'hinh_anh_minh_chung' => $files, 'ngay_ghi_nhan' => now(),
            ]);
        }, 3);
        return response()->json(['loss' => $loss->load('batch.product')], 201);
    }

    public function alerts()
    {
        $alertDays = max(0, min(30, (int) (DB::table('CauHinhHeThong')->where('ma_cau_hinh', 'so_ngay_canh_bao_xa_hang')->value('gia_tri') ?? 2)));
        $alerts = LoHang::with('product')
            ->where('so_luong_ton', '>', 0)
            ->whereBetween('ngay_het_han', [now()->toDateString(), now()->addDays($alertDays)->toDateString()])
            ->orderBy('ngay_het_han')->get();
        return response()->json(['count' => $alerts->count(), 'alert_days' => $alertDays, 'batches' => $alerts]);
    }
}
