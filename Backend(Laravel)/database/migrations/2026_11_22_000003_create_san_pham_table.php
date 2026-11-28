<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('SanPham', function (Blueprint $table) {
            $table->bigIncrements('ma_san_pham');
            $table->foreignId('ma_danh_muc')->constrained('DanhMuc', 'ma_danh_muc')->restrictOnDelete();
            $table->string('ten_san_pham', 150);
            $table->text('mo_ta')->nullable();
            $table->string('hinh_anh')->nullable();
            $table->decimal('gia_co_ban', 12, 2);
            $table->string('trang_thai', 20)->default('active')->index();
        });
    }

    public function down(): void { Schema::dropIfExists('SanPham'); }
};
