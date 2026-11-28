<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('PhieuHaoHut', function (Blueprint $table) {
            $table->bigIncrements('ma_phieu_hao_hut');
            $table->foreignId('ma_lo_hang')->constrained('LoHang', 'ma_lo_hang')->restrictOnDelete();
            $table->foreignId('ma_nhan_vien')->constrained('NguoiDung', 'ma_nguoi_dung')->restrictOnDelete();
            $table->decimal('so_luong', 10, 2);
            $table->string('ly_do', 255);
            $table->text('hinh_anh_minh_chung')->nullable();
            $table->dateTime('ngay_ghi_nhan')->useCurrent();
        });
    }

    public function down(): void { Schema::dropIfExists('PhieuHaoHut'); }
};
