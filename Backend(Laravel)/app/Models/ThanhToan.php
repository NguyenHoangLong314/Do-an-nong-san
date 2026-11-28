<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ThanhToan extends Model
{
    protected $table = 'ThanhToan';
    protected $primaryKey = 'ma_thanh_toan';
    public $timestamps = false;
    protected $fillable = ['ma_don_hang', 'so_tien', 'phuong_thuc', 'ma_giao_dich', 'trang_thai', 'ngay_thanh_toan'];
    protected $casts = ['ngay_thanh_toan' => 'datetime'];
    public function order(): BelongsTo { return $this->belongsTo(DonHang::class, 'ma_don_hang', 'ma_don_hang'); }
}
