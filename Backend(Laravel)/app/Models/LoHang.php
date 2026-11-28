<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LoHang extends Model
{
    use HasFactory;

    protected $table = 'LoHang';
    protected $primaryKey = 'ma_lo_hang';
    public $timestamps = false;
    protected $fillable = ['ma_san_pham', 'ngay_thu_hoach', 'ngay_het_han', 'so_luong_nhap', 'so_luong_ton', 'so_luong_hao_hut', 'ma_qr'];
    protected $casts = ['ngay_thu_hoach' => 'date', 'ngay_het_han' => 'date'];
    public function product(): BelongsTo { return $this->belongsTo(SanPham::class, 'ma_san_pham', 'ma_san_pham'); }
    public function logs(): HasMany { return $this->hasMany(NhatKyCanhTac::class, 'ma_lo_hang', 'ma_lo_hang'); }
    public function losses(): HasMany { return $this->hasMany(PhieuHaoHut::class, 'ma_lo_hang', 'ma_lo_hang'); }
    public function orderLines(): HasMany { return $this->hasMany(ChiTietDonHang::class, 'ma_lo_hang', 'ma_lo_hang'); }
}
