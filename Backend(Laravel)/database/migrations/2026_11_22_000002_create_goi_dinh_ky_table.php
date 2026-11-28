<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('GoiDinhKy', function (Blueprint $table) {
            $table->bigIncrements('ma_goi');
            $table->string('ten_goi', 100);
            $table->decimal('gia_goi', 12, 2);
            $table->unsignedInteger('thoi_han_thang');
            $table->text('mo_ta')->nullable();
        });
    }

    public function down(): void { Schema::dropIfExists('GoiDinhKy'); }
};
