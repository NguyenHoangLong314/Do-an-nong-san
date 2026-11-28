<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory;

    protected $table = 'NguoiDung';
    protected $primaryKey = 'ma_nguoi_dung';
    public $timestamps = false;

    protected $fillable = ['ho_ten', 'email', 'mat_khau', 'vai_tro'];
    protected $hidden = ['mat_khau'];
    protected $casts = ['mat_khau' => 'hashed', 'ngay_tao' => 'datetime'];

    public function getAuthPasswordName(): string { return 'mat_khau'; }
    public function getAuthPassword(): string { return $this->mat_khau; }

    public function orders(): HasMany { return $this->hasMany(DonHang::class, 'ma_nguoi_dung', 'ma_nguoi_dung'); }
    public function subscriptions(): HasMany { return $this->hasMany(DangKyGoi::class, 'ma_nguoi_dung', 'ma_nguoi_dung'); }
    public function cultivationLogs(): HasMany { return $this->hasMany(NhatKyCanhTac::class, 'ma_nhan_vien', 'ma_nguoi_dung'); }
    public function lossReports(): HasMany { return $this->hasMany(PhieuHaoHut::class, 'ma_nhan_vien', 'ma_nguoi_dung'); }
}
