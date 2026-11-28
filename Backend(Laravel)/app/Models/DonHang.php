<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DonHang extends Model
{
    protected $table = 'DonHang';
    protected $primaryKey = 'ma_don_hang';
    public $timestamps = false;
    protected $fillable = ['ma_nguoi_dung', 'trang_thai', 'ngay_tao', 'ngay_giao_thuc_te', 'tong_tien', 'phi_giao_hang', 'dia_chi_giao_hang', 'phuong_thuc_thanh_toan'];
    protected $casts = ['ngay_tao' => 'datetime', 'ngay_giao_thuc_te' => 'datetime'];
    public function customer(): BelongsTo { return $this->belongsTo(User::class, 'ma_nguoi_dung', 'ma_nguoi_dung'); }
    public function items(): HasMany { return $this->hasMany(ChiTietDonHang::class, 'ma_don_hang', 'ma_don_hang'); }
    public function payments(): HasMany { return $this->hasMany(ThanhToan::class, 'ma_don_hang', 'ma_don_hang'); }
    public function complaints(): HasMany { return $this->hasMany(KhieuNai::class, 'ma_don_hang', 'ma_don_hang'); }
}
