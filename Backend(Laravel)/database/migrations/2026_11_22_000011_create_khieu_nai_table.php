<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('KhieuNai', function (Blueprint $table) {
            $table->bigIncrements('ma_khieu_nai');
            $table->foreignId('ma_don_hang')->constrained('DonHang', 'ma_don_hang')->cascadeOnDelete();
            $table->foreignId('ma_nguoi_dung')->constrained('NguoiDung', 'ma_nguoi_dung')->restrictOnDelete();
            $table->string('ly_do', 255);
            $table->text('tep_minh_chung');
            $table->string('trang_thai', 30)->default('pending')->index();
            $table->text('ket_qua_xu_ly')->nullable();
            $table->dateTime('ngay_tao')->useCurrent();
        });
    }

    public function down(): void { Schema::dropIfExists('KhieuNai'); }
};
