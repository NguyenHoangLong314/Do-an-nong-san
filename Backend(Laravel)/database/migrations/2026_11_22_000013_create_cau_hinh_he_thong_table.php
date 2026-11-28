<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('CauHinhHeThong', function (Blueprint $table) {
            $table->string('ma_cau_hinh', 100)->primary();
            $table->text('gia_tri')->nullable();
            $table->dateTime('cap_nhat_luc')->useCurrent();
        });

        DB::table('CauHinhHeThong')->insert([
            'ma_cau_hinh' => 'so_ngay_canh_bao_xa_hang',
            'gia_tri' => '2',
            'cap_nhat_luc' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('CauHinhHeThong');
    }
};
