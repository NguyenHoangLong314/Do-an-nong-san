<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('LichGiaoHang', function (Blueprint $table) {
            $table->bigIncrements('ma_lich_giao');
            $table->foreignId('ma_dang_ky')->constrained('DangKyGoi', 'ma_dang_ky')->cascadeOnDelete();
            $table->foreignId('ma_don_hang')->nullable()->unique()->constrained('DonHang', 'ma_don_hang')->nullOnDelete();
            $table->date('ngay_giao')->index();
            $table->string('trang_thai', 30)->default('scheduled');
        });
    }

    public function down(): void { Schema::dropIfExists('LichGiaoHang'); }
};
