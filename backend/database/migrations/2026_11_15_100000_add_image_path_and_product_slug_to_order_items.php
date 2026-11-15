<?php

use App\Support\Media;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Order items keep a reference to the stored product photo (path + disk on the existing
 * Laravel media disk) instead of only a URL resolved when the order was placed. The URL is
 * built when it is read, so the same order shows its photo on localhost and in production.
 * The file itself is not copied: ProductController keeps a photo on disk while an order
 * item still points at it (see OrderItem::usesImage()).
 *
 * product_slug is the product's public link at order time, used if the product is gone.
 *
 * Existing rows are backfilled: the slug from the product, and the path / disk from the
 * product image whose URL matches the stored image_url. Unmatched rows keep image_url.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->string('image_path', 1000)->nullable()->after('image_url');
            $table->string('image_disk', 20)->nullable()->after('image_path');
            $table->string('product_slug')->nullable()->after('product_name');
        });

        DB::table('order_items')->whereNotNull('product_id')->orderBy('id')->chunkById(200, function ($items) {
            $products = DB::table('products')->whereIn('id', $items->pluck('product_id')->unique())->pluck('slug', 'id');
            $images = DB::table('product_images')->whereIn('product_id', $items->pluck('product_id')->unique())
                ->get(['product_id', 'path', 'disk'])->groupBy('product_id');

            foreach ($items as $item) {
                $update = ['product_slug' => $products[$item->product_id] ?? null];
                $match = $item->image_url ? ($images[$item->product_id] ?? collect())
                    ->first(fn ($image) => Media::url($image->path, $image->disk) === $item->image_url) : null;
                if ($match) {
                    $update += ['image_path' => $match->path, 'image_disk' => $match->disk];
                }
                DB::table('order_items')->where('id', $item->id)->update($update);
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['image_path', 'image_disk', 'product_slug']);
        });
    }
};
