<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('DanhMuc', function (Blueprint $table) {
            $table->bigIncrements('ma_danh_muc');
            $table->string('ten_danh_muc', 100)->unique();
            $table->text('mo_ta')->nullable();
        });
    }

    public function down(): void { Schema::dropIfExists('DanhMuc'); }
};
