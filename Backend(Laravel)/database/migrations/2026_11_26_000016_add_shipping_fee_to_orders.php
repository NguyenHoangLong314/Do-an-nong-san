<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('DonHang', function (Blueprint $table) {
            $table->decimal('phi_giao_hang', 12, 2)->default(0)->after('tong_tien');
        });
    }

    public function down(): void
    {
        Schema::table('DonHang', function (Blueprint $table) {
            $table->dropColumn('phi_giao_hang');
        });
    }
};
