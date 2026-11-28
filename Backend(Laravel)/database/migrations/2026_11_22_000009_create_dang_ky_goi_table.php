<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('DangKyGoi', function (Blueprint $table) {
            $table->bigIncrements('ma_dang_ky');
            $table->foreignId('ma_nguoi_dung')->constrained('NguoiDung', 'ma_nguoi_dung')->restrictOnDelete();
            $table->foreignId('ma_goi')->constrained('GoiDinhKy', 'ma_goi')->restrictOnDelete();
            $table->date('ngay_bat_dau');
            $table->date('ngay_ket_thuc');
            $table->string('chu_ky', 100);
            $table->string('trang_thai', 30)->default('active');
        });
    }

    public function down(): void { Schema::dropIfExists('DangKyGoi'); }
};
