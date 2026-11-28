<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('SanPham', function (Blueprint $table) {
            $table->string('don_vi_tinh', 12)->default('kg');
            $table->decimal('trong_luong_don_vi_kg', 8, 3)->default(1);
        });

        $fertilizerCategories = DB::table('DanhMuc')
            ->where('ten_danh_muc', 'like', '%phân bón%')
            ->pluck('ma_danh_muc');
        if ($fertilizerCategories->isNotEmpty()) {
            DB::table('SanPham')->whereIn('ma_danh_muc', $fertilizerCategories)
                ->update(['don_vi_tinh' => 'bao']);
        }
    }

    public function down(): void
    {
        Schema::table('SanPham', function (Blueprint $table) {
            $table->dropColumn(['don_vi_tinh', 'trong_luong_don_vi_kg']);
        });
    }
};
