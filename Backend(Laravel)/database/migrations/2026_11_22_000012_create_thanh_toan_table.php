<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ThanhToan', function (Blueprint $table) {
            $table->bigIncrements('ma_thanh_toan');
            $table->foreignId('ma_don_hang')->constrained('DonHang', 'ma_don_hang')->cascadeOnDelete();
            $table->decimal('so_tien', 12, 2);
            $table->string('phuong_thuc', 30);
            $table->string('ma_giao_dich', 150)->nullable()->unique();
            $table->string('trang_thai', 30)->default('pending')->index();
            $table->dateTime('ngay_thanh_toan')->nullable();
        });
    }

    public function down(): void { Schema::dropIfExists('ThanhToan'); }
};
