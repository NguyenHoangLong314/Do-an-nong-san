<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChiTietGioHang extends Model
{
    protected $table = 'ChiTietGioHang';
    protected $primaryKey = 'ma_chi_tiet_gio_hang';
    public $timestamps = false;
    protected $fillable = ['ma_gio_hang', 'ma_san_pham', 'so_luong'];
    protected $casts = ['so_luong' => 'float'];

    public function cart(): BelongsTo { return $this->belongsTo(GioHang::class, 'ma_gio_hang', 'ma_gio_hang'); }
    public function product(): BelongsTo { return $this->belongsTo(SanPham::class, 'ma_san_pham', 'ma_san_pham'); }
}
