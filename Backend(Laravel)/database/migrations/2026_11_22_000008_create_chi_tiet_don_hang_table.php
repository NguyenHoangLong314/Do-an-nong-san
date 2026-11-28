<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ChiTietDonHang', function (Blueprint $table) {
            $table->bigIncrements('ma_chi_tiet');
            $table->foreignId('ma_don_hang')->constrained('DonHang', 'ma_don_hang')->cascadeOnDelete();
            $table->foreignId('ma_lo_hang')->constrained('LoHang', 'ma_lo_hang')->restrictOnDelete();
            $table->decimal('so_luong', 10, 2);
            $table->decimal('don_gia', 12, 2);
        });
    }

    public function down(): void { Schema::dropIfExists('ChiTietDonHang'); }
};
