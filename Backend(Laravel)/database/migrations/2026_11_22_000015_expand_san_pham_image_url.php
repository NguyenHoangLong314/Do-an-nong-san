<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('SanPham', function (Blueprint $table) {
            $table->text('hinh_anh')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Keep the wider text column so existing image URLs are never truncated.
    }
};
