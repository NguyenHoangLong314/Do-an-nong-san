<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('NhatKyCanhTac', function (Blueprint $table) {
            $table->bigIncrements('ma_nhat_ky');
            $table->foreignId('ma_lo_hang')->constrained('LoHang', 'ma_lo_hang')->restrictOnDelete();
            $table->foreignId('ma_nhan_vien')->constrained('NguoiDung', 'ma_nguoi_dung')->restrictOnDelete();
            $table->string('hanh_dong', 150);
            $table->text('hinh_anh_minh_chung')->nullable();
            $table->dateTime('thoi_gian')->useCurrent()->index();
            $table->text('ghi_chu')->nullable();
        });
    }

    public function down(): void { Schema::dropIfExists('NhatKyCanhTac'); }
};
