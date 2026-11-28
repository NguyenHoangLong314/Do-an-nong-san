<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GioHang extends Model
{
    protected $table = 'GioHang';
    protected $primaryKey = 'ma_gio_hang';
    public $timestamps = false;
    protected $fillable = ['ma_nguoi_dung', 'cap_nhat_luc'];
    protected $casts = ['cap_nhat_luc' => 'datetime'];

    public function user(): BelongsTo { return $this->belongsTo(User::class, 'ma_nguoi_dung', 'ma_nguoi_dung'); }
    public function items(): HasMany { return $this->hasMany(ChiTietGioHang::class, 'ma_gio_hang', 'ma_gio_hang'); }
}
