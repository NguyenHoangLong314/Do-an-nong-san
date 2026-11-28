<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('DonHang', function (Blueprint $table) {
            $table->bigIncrements('ma_don_hang');
            $table->foreignId('ma_nguoi_dung')->constrained('NguoiDung', 'ma_nguoi_dung')->restrictOnDelete();
            $table->string('trang_thai', 30)->default('pending')->index();
            $table->dateTime('ngay_tao')->useCurrent()->index();
            $table->dateTime('ngay_giao_thuc_te')->nullable();
            $table->decimal('tong_tien', 12, 2);
            $table->text('dia_chi_giao_hang');
            $table->string('phuong_thuc_thanh_toan', 30);
        });
    }

    public function down(): void { Schema::dropIfExists('DonHang'); }
};
