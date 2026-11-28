<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SanPham extends Model
{
    protected $table = 'SanPham';
    protected $primaryKey = 'ma_san_pham';
    public $timestamps = false;
    protected $fillable = ['ma_danh_muc', 'ten_san_pham', 'mo_ta', 'hinh_anh', 'gia_co_ban', 'trang_thai', 'don_vi_tinh', 'trong_luong_don_vi_kg'];
    public function category(): BelongsTo { return $this->belongsTo(DanhMuc::class, 'ma_danh_muc', 'ma_danh_muc'); }
    public function batches(): HasMany { return $this->hasMany(LoHang::class, 'ma_san_pham', 'ma_san_pham'); }
}
