<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KhieuNai extends Model
{
    protected $table = 'KhieuNai';
    protected $primaryKey = 'ma_khieu_nai';
    public $timestamps = false;
    protected $fillable = ['ma_don_hang', 'ma_nguoi_dung', 'ly_do', 'tep_minh_chung', 'trang_thai', 'ket_qua_xu_ly', 'ngay_tao'];
    protected $casts = ['tep_minh_chung' => 'array', 'ngay_tao' => 'datetime'];
    public function order(): BelongsTo { return $this->belongsTo(DonHang::class, 'ma_don_hang', 'ma_don_hang'); }
    public function customer(): BelongsTo { return $this->belongsTo(User::class, 'ma_nguoi_dung', 'ma_nguoi_dung'); }
}
