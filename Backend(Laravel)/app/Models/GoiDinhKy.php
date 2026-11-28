<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GoiDinhKy extends Model
{
    protected $table = 'GoiDinhKy';
    protected $primaryKey = 'ma_goi';
    public $timestamps = false;
    protected $fillable = ['ten_goi', 'gia_goi', 'thoi_han_thang', 'mo_ta'];
    public function subscriptions(): HasMany { return $this->hasMany(DangKyGoi::class, 'ma_goi', 'ma_goi'); }
}
