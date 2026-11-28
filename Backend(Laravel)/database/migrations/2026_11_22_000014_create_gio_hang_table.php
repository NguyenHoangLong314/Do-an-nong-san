<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('GioHang', function (Blueprint $table) {
            $table->bigIncrements('ma_gio_hang');
            $table->foreignId('ma_nguoi_dung')->unique()->constrained('NguoiDung', 'ma_nguoi_dung')->cascadeOnDelete();
            $table->dateTime('cap_nhat_luc')->useCurrent();
        });

        Schema::create('ChiTietGioHang', function (Blueprint $table) {
            $table->bigIncrements('ma_chi_tiet_gio_hang');
            $table->foreignId('ma_gio_hang')->constrained('GioHang', 'ma_gio_hang')->cascadeOnDelete();
            $table->foreignId('ma_san_pham')->constrained('SanPham', 'ma_san_pham')->cascadeOnDelete();
            $table->decimal('so_luong', 10, 2);
            $table->unique(['ma_gio_hang', 'ma_san_pham'], 'chitietgiohang_unique_product');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ChiTietGioHang');
        Schema::dropIfExists('GioHang');
    }
};
