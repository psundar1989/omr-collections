<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Additive and reversible.
 *
 * - products.availability_status: available | sold_out | discontinued. Chosen by the admin and
 *   independent of `is_active` (enabled/visible) and of stock tracking, so a made-to-order
 *   product without stock tracking is never "sold out" by accident.
 * - products.sizes_enabled: lets the admin switch size selection off for a product without
 *   losing its stored size list.
 *
 * Every existing product starts as "available" with size selection on – the storefront behaves
 * exactly as before until the admin changes something.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('availability_status', 16)->default('available')->after('is_active');
            $table->boolean('sizes_enabled')->default(true)->after('sizes');
            $table->index(['is_active', 'availability_status']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['is_active', 'availability_status']);
            $table->dropColumn(['availability_status', 'sizes_enabled']);
        });
    }
};
