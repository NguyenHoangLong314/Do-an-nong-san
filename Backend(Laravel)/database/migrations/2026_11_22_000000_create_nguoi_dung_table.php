<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('NguoiDung')) return;

        Schema::create('NguoiDung', function (Blueprint $table) {
            $table->bigIncrements('ma_nguoi_dung');
            $table->string('ho_ten', 100);
            $table->string('email', 150)->unique();
            $table->string('mat_khau');
            $table->string('vai_tro', 20)->default('Customer')->index();
            $table->dateTime('ngay_tao')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('NguoiDung');
    }
};
