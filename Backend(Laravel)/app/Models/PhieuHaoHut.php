<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PhieuHaoHut extends Model
{
    protected $table = 'PhieuHaoHut';
    protected $primaryKey = 'ma_phieu_hao_hut';
    public $timestamps = false;
    protected $fillable = ['ma_lo_hang', 'ma_nhan_vien', 'so_luong', 'ly_do', 'hinh_anh_minh_chung', 'ngay_ghi_nhan'];
    protected $casts = ['hinh_anh_minh_chung' => 'array', 'ngay_ghi_nhan' => 'datetime'];
    public function batch(): BelongsTo { return $this->belongsTo(LoHang::class, 'ma_lo_hang', 'ma_lo_hang'); }
    public function staff(): BelongsTo { return $this->belongsTo(User::class, 'ma_nhan_vien', 'ma_nguoi_dung'); }
}
