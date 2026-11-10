<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Additive and reversible – existing rows keep working unchanged.
 *
 * - categories.sku_code: the CATEGORY part of OMR-<CATEGORY>-<NUMBER> SKUs (e.g. BG).
 * - products.catalog_code: stable key of a photo-catalogue product ("product-062"). It used to
 *   double as the SKU; keeping it separately lets the SKU move to the OMR format while the
 *   catalogue import, wishlists and product-code lookups keep matching the same product.
 * - product_images.colour: the colour an image shows, so choosing a colour shows its photo.
 *   Filled from the old "Product name – Colour" alt-text convention where it matches.
 * - product_variants.sku: unique (NULL allowed), so two variants never share a SKU.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('sku_code', 10)->nullable()->unique()->after('slug');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->string('catalog_code', 64)->nullable()->unique()->after('sku');
        });
        Schema::table('product_images', function (Blueprint $table) {
            $table->string('colour', 60)->nullable()->after('alt_text');
        });

        foreach (config('shop.sku_category_codes', []) as $slug => $code) {
            // Only where the code is still free (an admin may already use it elsewhere).
            if (! DB::table('categories')->where('sku_code', $code)->exists()) {
                DB::table('categories')->where('slug', $slug)->whereNull('sku_code')->update(['sku_code' => $code]);
            }
        }

        DB::table('products')->where('source', 'photo_catalogue')->whereNull('catalog_code')
            ->update(['catalog_code' => DB::raw('sku')]);

        $products = DB::table('products')->whereNotNull('colours')->pluck('colours', 'id');
        foreach ($products as $id => $json) {
            $colours = collect(json_decode((string) $json, true) ?: [])->filter(fn ($c) => is_string($c) && $c !== '');
            if ($colours->isEmpty()) {
                continue;
            }
            foreach (DB::table('product_images')->where('product_id', $id)->whereNull('colour')->get(['id', 'alt_text']) as $img) {
                $suffix = trim((string) str($img->alt_text)->afterLast(' – '));
                $match = $colours->first(fn ($c) => strcasecmp($c, $suffix) === 0);
                if ($match && $suffix !== (string) $img->alt_text) {
                    DB::table('product_images')->where('id', $img->id)->update(['colour' => $match]);
                }
            }
        }

        $duplicates = DB::table('product_variants')->whereNotNull('sku')->select('sku')
            ->groupBy('sku')->havingRaw('count(*) > 1')->pluck('sku');
        if ($duplicates->isEmpty()) {
            Schema::table('product_variants', fn (Blueprint $table) => $table->unique('sku'));
        } else {
            // Never rewrite existing SKUs here: the app still prevents new duplicates.
            Log::warning('product_variants.sku left without a unique index – fix these duplicate SKUs in the admin and re-run the migration.', ['skus' => $duplicates->all()]);
        }
    }

    public function down(): void
    {
        if (collect(Schema::getIndexes('product_variants'))->contains(fn ($i) => $i['columns'] === ['sku'] && $i['unique'])) {
            Schema::table('product_variants', fn (Blueprint $table) => $table->dropUnique(['sku']));
        }
        Schema::table('product_images', fn (Blueprint $table) => $table->dropColumn('colour'));
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['catalog_code']);
            $table->dropColumn('catalog_code');
        });
        Schema::table('categories', function (Blueprint $table) {
            $table->dropUnique(['sku_code']);
            $table->dropColumn('sku_code');
        });
    }
};
