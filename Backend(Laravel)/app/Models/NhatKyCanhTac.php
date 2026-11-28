<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NhatKyCanhTac extends Model
{
    protected $table = 'NhatKyCanhTac';
    protected $primaryKey = 'ma_nhat_ky';
    public $timestamps = false;
    protected $fillable = ['ma_lo_hang', 'ma_nhan_vien', 'hanh_dong', 'hinh_anh_minh_chung', 'thoi_gian', 'ghi_chu'];
    protected $casts = ['hinh_anh_minh_chung' => 'array', 'thoi_gian' => 'datetime'];
    public function batch(): BelongsTo { return $this->belongsTo(LoHang::class, 'ma_lo_hang', 'ma_lo_hang'); }
    public function staff(): BelongsTo { return $this->belongsTo(User::class, 'ma_nhan_vien', 'ma_nguoi_dung'); }
}
