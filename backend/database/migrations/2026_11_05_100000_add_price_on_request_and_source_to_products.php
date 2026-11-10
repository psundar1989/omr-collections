<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Additive and reversible: existing rows keep working unchanged.
 *
 * - products.price_on_request: hide the stored price and let customers enquire on WhatsApp.
 *   The regular/sale prices stay in place, so switching back to a fixed price restores them.
 * - products.source / categories.source: which import created the row (null = created in the
 *   admin). Used to make `php artisan catalog:import-photos` idempotent and to roll it back.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('price_on_request')->default(false)->after('sale_price');
            $table->string('source', 32)->nullable()->after('meta_description');
            $table->index('source');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->string('source', 32)->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('source');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['source']);
            $table->dropColumn(['price_on_request', 'source']);
        });
    }
};
