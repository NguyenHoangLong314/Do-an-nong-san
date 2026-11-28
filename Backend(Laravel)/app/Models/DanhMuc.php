<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DanhMuc extends Model
{
    protected $table = 'DanhMuc';
    protected $primaryKey = 'ma_danh_muc';
    public $timestamps = false;
    protected $fillable = ['ten_danh_muc', 'mo_ta'];
    public function products(): HasMany { return $this->hasMany(SanPham::class, 'ma_danh_muc', 'ma_danh_muc'); }
}
