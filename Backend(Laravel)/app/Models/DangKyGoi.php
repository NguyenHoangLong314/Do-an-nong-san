<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DangKyGoi extends Model
{
    protected $table = 'DangKyGoi';
    protected $primaryKey = 'ma_dang_ky';
    public $timestamps = false;
    protected $fillable = ['ma_nguoi_dung', 'ma_goi', 'ngay_bat_dau', 'ngay_ket_thuc', 'chu_ky', 'trang_thai'];
    protected $casts = ['ngay_bat_dau' => 'date', 'ngay_ket_thuc' => 'date'];
    public function customer(): BelongsTo { return $this->belongsTo(User::class, 'ma_nguoi_dung', 'ma_nguoi_dung'); }
    public function plan(): BelongsTo { return $this->belongsTo(GoiDinhKy::class, 'ma_goi', 'ma_goi'); }
    public function deliveries(): HasMany { return $this->hasMany(LichGiaoHang::class, 'ma_dang_ky', 'ma_dang_ky'); }
}
