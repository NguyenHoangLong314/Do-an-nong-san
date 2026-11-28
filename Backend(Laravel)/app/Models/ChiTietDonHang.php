<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChiTietDonHang extends Model
{
    protected $table = 'ChiTietDonHang';
    protected $primaryKey = 'ma_chi_tiet';
    public $timestamps = false;
    protected $fillable = ['ma_don_hang', 'ma_lo_hang', 'so_luong', 'don_gia'];
    public function order(): BelongsTo { return $this->belongsTo(DonHang::class, 'ma_don_hang', 'ma_don_hang'); }
    public function batch(): BelongsTo { return $this->belongsTo(LoHang::class, 'ma_lo_hang', 'ma_lo_hang'); }
}
