<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('LoHang', function (Blueprint $table) {
            $table->bigIncrements('ma_lo_hang');
            $table->foreignId('ma_san_pham')->constrained('SanPham', 'ma_san_pham')->restrictOnDelete();
            $table->date('ngay_thu_hoach');
            $table->date('ngay_het_han')->index();
            $table->decimal('so_luong_nhap', 10, 2);
            $table->decimal('so_luong_ton', 10, 2);
            $table->decimal('so_luong_hao_hut', 10, 2)->default(0);
            $table->string('ma_qr', 255)->unique();
            $table->index(['ma_san_pham', 'ngay_het_han'], 'lohang_fefo_index');
        });
    }

    public function down(): void { Schema::dropIfExists('LoHang'); }
};
