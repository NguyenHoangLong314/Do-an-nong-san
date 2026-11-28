<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LichGiaoHang extends Model
{
    protected $table = 'LichGiaoHang';
    protected $primaryKey = 'ma_lich_giao';
    public $timestamps = false;
    protected $fillable = ['ma_dang_ky', 'ma_don_hang', 'ngay_giao', 'trang_thai'];
    protected $casts = ['ngay_giao' => 'date'];
    public function subscription(): BelongsTo { return $this->belongsTo(DangKyGoi::class, 'ma_dang_ky', 'ma_dang_ky'); }
    public function order(): BelongsTo { return $this->belongsTo(DonHang::class, 'ma_don_hang', 'ma_don_hang'); }
}
