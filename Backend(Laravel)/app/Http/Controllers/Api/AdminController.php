<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DanhMuc;
use App\Models\DonHang;
use App\Models\LoHang;
use App\Models\PhieuHaoHut;
use App\Models\SanPham;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    private const ALERT_DAYS_KEY = 'so_ngay_canh_bao_xa_hang';

    public function overview()
    {
        $alertDays = $this->alertDays();
        $products = SanPham::selectRaw(
            'COUNT(*) as total, COALESCE(SUM(CASE WHEN trang_thai = ? THEN 1 ELSE 0 END), 0) as active',
            ['active']
        )->first();
        $users = User::selectRaw(
            'COUNT(*) as total, COALESCE(SUM(CASE WHEN vai_tro IN (?, ?) THEN 1 ELSE 0 END), 0) as staff',
            ['Staff', 'Sales']
        )->first();
        $orders = DonHang::selectRaw(
            'COUNT(*) as total, COALESCE(SUM(CASE WHEN trang_thai = ? THEN 1 ELSE 0 END), 0) as pending, COALESCE(SUM(CASE WHEN trang_thai <> ? THEN tong_tien ELSE 0 END), 0) as revenue',
            ['pending', 'cancelled']
        )->first();

        return response()->json([
            'categories' => DanhMuc::count(),
            'products' => (int) $products->total,
            'active_products' => (int) $products->active,
            'users' => (int) $users->total,
            'staff' => (int) $users->staff,
            'orders' => (int) $orders->total,
            'pending_orders' => (int) $orders->pending,
            'revenue' => (float) $orders->revenue,
            'loss_quantity' => (float) PhieuHaoHut::sum('so_luong'),
            'expiring_batches' => LoHang::where('so_luong_ton', '>', 0)
                ->whereBetween('ngay_het_han', [today(), today()->addDays($alertDays)])
                ->count(),
            'alert_days' => $alertDays,
        ]);
    }

    public function categories()
    {
        return response()->json(DanhMuc::withCount('products')->orderBy('ten_danh_muc')->get());
    }

    public function storeCategory(Request $request)
    {
        $data = $request->validate([
            'ten_danh_muc' => ['required', 'string', 'max:100', 'unique:DanhMuc,ten_danh_muc'],
            'mo_ta' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json(['category' => DanhMuc::create($data)], 201);
    }

    public function updateCategory(Request $request, DanhMuc $category)
    {
        $data = $request->validate([
            'ten_danh_muc' => ['required', 'string', 'max:100', Rule::unique('DanhMuc', 'ten_danh_muc')->ignore($category->getKey(), 'ma_danh_muc')],
            'mo_ta' => ['nullable', 'string', 'max:2000'],
        ]);
        $category->update($data);

        return response()->json(['category' => $category->loadCount('products')]);
    }

    public function destroyCategory(DanhMuc $category)
    {
        if ($category->products()->exists()) {
            return response()->json(['message' => 'Danh mục đang có sản phẩm, hãy chuyển sản phẩm sang danh mục khác trước.'], 409);
        }
        $category->delete();

        return response()->json(['message' => 'Đã xóa danh mục.']);
    }

    public function products()
    {
        $products = SanPham::with('category')
            ->withSum('batches as ton_kho', 'so_luong_ton')
            ->orderByDesc('ma_san_pham')->get();

        return response()->json($products);
    }

    public function storeProduct(Request $request)
    {
        $data = $request->validate([
            'ma_danh_muc' => ['required', 'integer', 'exists:DanhMuc,ma_danh_muc'],
            'ten_san_pham' => ['required', 'string', 'max:150'],
            'mo_ta' => ['nullable', 'string', 'max:5000'],
            'hinh_anh' => ['nullable', 'url', 'max:2048'],
            'gia_co_ban' => ['required', 'numeric', 'gt:0', 'max:9999999999'],
            'trang_thai' => ['required', Rule::in(['active', 'inactive'])],
            'don_vi_tinh' => ['nullable', Rule::in(['kg', 'bao'])],
            'trong_luong_don_vi_kg' => ['nullable', 'numeric', 'gt:0', 'max:1000'],
        ], [
            'hinh_anh.url' => 'Link ảnh không hợp lệ. Hãy nhập đường dẫn trực tiếp đến ảnh.',
            'hinh_anh.max' => 'Link ảnh quá dài (tối đa 2.048 ký tự).',
        ]);

        $data['don_vi_tinh'] = $this->defaultProductUnit((int) $data['ma_danh_muc']);
        $data['trong_luong_don_vi_kg'] = $data['don_vi_tinh'] === 'kg'
            ? 1
            : (float) ($data['trong_luong_don_vi_kg'] ?? 1);

        return response()->json(['product' => SanPham::create($data)->load('category')], 201);
    }

    public function updateProduct(Request $request, SanPham $product)
    {
        $data = $request->validate([
            'ma_danh_muc' => ['required', 'integer', 'exists:DanhMuc,ma_danh_muc'],
            'ten_san_pham' => ['required', 'string', 'max:150'],
            'mo_ta' => ['nullable', 'string', 'max:5000'],
            'hinh_anh' => ['nullable', 'url', 'max:2048'],
            'gia_co_ban' => ['required', 'numeric', 'gt:0', 'max:9999999999'],
            'trang_thai' => ['required', Rule::in(['active', 'inactive'])],
            'don_vi_tinh' => ['nullable', Rule::in(['kg', 'bao'])],
            'trong_luong_don_vi_kg' => ['nullable', 'numeric', 'gt:0', 'max:1000'],
        ], [
            'hinh_anh.url' => 'Link ảnh không hợp lệ. Hãy nhập đường dẫn trực tiếp đến ảnh.',
            'hinh_anh.max' => 'Link ảnh quá dài (tối đa 2.048 ký tự).',
        ]);
        $data['don_vi_tinh'] = $this->defaultProductUnit((int) $data['ma_danh_muc']);
        $data['trong_luong_don_vi_kg'] = $data['don_vi_tinh'] === 'kg'
            ? 1
            : (float) ($data['trong_luong_don_vi_kg'] ?? $product->trong_luong_don_vi_kg ?? 1);
        $product->update($data);

        return response()->json(['product' => $product->load('category')]);
    }

    public function destroyProduct(SanPham $product)
    {
        if ($product->batches()->exists()) {
            return response()->json(['message' => 'Sản phẩm đã có lô hàng nên không thể xóa. Hãy chuyển trạng thái sang Ngừng bán.'], 409);
        }
        $product->delete();

        return response()->json(['message' => 'Đã xóa sản phẩm.']);
    }

    private function defaultProductUnit(int $categoryId): string
    {
        $name = (string) DanhMuc::whereKey($categoryId)->value('ten_danh_muc');
        return str_contains(mb_strtolower($name, 'UTF-8'), 'phân bón') ? 'bao' : 'kg';
    }

    public function users(Request $request)
    {
        $users = User::query()
            ->select(['ma_nguoi_dung', 'ho_ten', 'email', 'vai_tro', 'ngay_tao'])
            ->when($request->filled('vai_tro'), fn ($query) => $query->where('vai_tro', (string) $request->string('vai_tro')))
            ->when($request->filled('q'), fn ($query) => $query->where(function ($subquery) use ($request) {
                $term = '%'.$request->string('q').'%';
                $subquery->where('ho_ten', 'like', $term)->orWhere('email', 'like', $term);
            }))
            ->orderByDesc('ma_nguoi_dung')->paginate(30);

        return response()->json($users);
    }

    public function storeEmployee(Request $request)
    {
        $data = $request->validate([
            'ho_ten' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:NguoiDung,email'],
            'vai_tro' => ['required', Rule::in(['Staff', 'Sales'])],
            'mat_khau' => ['required', 'string', 'min:8', 'max:255'],
        ]);

        $user = User::create([
            'ho_ten' => $data['ho_ten'],
            'email' => $data['email'],
            'vai_tro' => $data['vai_tro'],
            'mat_khau' => Hash::make($data['mat_khau']),
        ]);

        return response()->json(['user' => [
            'ma_nguoi_dung' => $user->ma_nguoi_dung,
            'ho_ten' => $user->ho_ten,
            'email' => $user->email,
            'vai_tro' => $user->vai_tro,
        ]], 201);
    }

    public function updateUserRole(Request $request, User $user)
    {
        $data = $request->validate(['vai_tro' => ['required', Rule::in(['Customer', 'Staff', 'Sales', 'Admin'])]]);
        $actorId = (int) $request->user()->getKey();

        if ((int) $user->getKey() === $actorId && $data['vai_tro'] !== 'Admin') {
            return response()->json(['message' => 'Bạn không thể tự hạ quyền tài khoản Admin đang đăng nhập.'], 422);
        }

        if ($user->vai_tro === 'Admin' && $data['vai_tro'] !== 'Admin' && User::where('vai_tro', 'Admin')->count() <= 1) {
            return response()->json(['message' => 'Hệ thống cần giữ lại ít nhất một tài khoản Admin.'], 422);
        }

        $user->update(['vai_tro' => $data['vai_tro']]);

        return response()->json(['user' => [
            'ma_nguoi_dung' => $user->ma_nguoi_dung,
            'ho_ten' => $user->ho_ten,
            'email' => $user->email,
            'vai_tro' => $user->vai_tro,
        ]]);
    }

    public function reports()
    {
        $sales = DB::table('DonHang')
            ->selectRaw('DATE(ngay_tao) as ngay, COUNT(*) as so_don, SUM(tong_tien) as doanh_thu')
            ->whereDate('ngay_tao', '>=', today()->subDays(6))
            ->where('trang_thai', '<>', 'cancelled')
            ->groupByRaw('DATE(ngay_tao)')->orderBy('ngay')->get();

        $statuses = DonHang::query()->select('trang_thai', DB::raw('COUNT(*) as so_don'))
            ->groupBy('trang_thai')->orderBy('trang_thai')->get();

        $topProducts = DB::table('ChiTietDonHang as details')
            ->join('LoHang as batches', 'batches.ma_lo_hang', '=', 'details.ma_lo_hang')
            ->join('SanPham as products', 'products.ma_san_pham', '=', 'batches.ma_san_pham')
            ->join('DonHang as orders', 'orders.ma_don_hang', '=', 'details.ma_don_hang')
            ->where('orders.trang_thai', '<>', 'cancelled')
            ->select('products.ma_san_pham', 'products.ten_san_pham', 'products.don_vi_tinh')
            ->selectRaw('SUM(details.so_luong) as so_luong_ban, SUM(details.so_luong * details.don_gia) as doanh_thu')
            ->groupBy('products.ma_san_pham', 'products.ten_san_pham', 'products.don_vi_tinh')
            ->orderByDesc('so_luong_ban')->limit(5)->get();

        $lossByUnit = DB::table('PhieuHaoHut as losses')
            ->join('LoHang as batches', 'batches.ma_lo_hang', '=', 'losses.ma_lo_hang')
            ->join('SanPham as products', 'products.ma_san_pham', '=', 'batches.ma_san_pham')
            ->select('products.don_vi_tinh')
            ->selectRaw('SUM(losses.so_luong) as so_luong')
            ->groupBy('products.don_vi_tinh')->get();

        return response()->json([
            'sales' => $sales,
            'order_statuses' => $statuses,
            'top_products' => $topProducts,
            'loss_quantity' => (float) PhieuHaoHut::sum('so_luong'),
            'loss_by_unit' => $lossByUnit,
            'loss_records' => PhieuHaoHut::count(),
        ]);
    }

    public function settings()
    {
        return response()->json(['so_ngay_canh_bao_xa_hang' => $this->alertDays()]);
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate(['so_ngay_canh_bao_xa_hang' => ['required', 'integer', 'min:0', 'max:30']]);
        DB::table('CauHinhHeThong')->updateOrInsert(
            ['ma_cau_hinh' => self::ALERT_DAYS_KEY],
            ['gia_tri' => (string) $data['so_ngay_canh_bao_xa_hang'], 'cap_nhat_luc' => now()],
        );

        return response()->json(['so_ngay_canh_bao_xa_hang' => (int) $data['so_ngay_canh_bao_xa_hang']]);
    }

    private function alertDays(): int
    {
        return max(0, min(30, (int) (DB::table('CauHinhHeThong')->where('ma_cau_hinh', self::ALERT_DAYS_KEY)->value('gia_tri') ?? 2)));
    }
}
