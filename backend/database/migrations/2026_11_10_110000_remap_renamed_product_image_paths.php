<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The photographed catalogue was reorganised on 2026-11-10: every product photo now has a
 * product-based name, e.g. /images/bangles/olive_green_gold_flower_bangle_pair_01.jpg became
 * /images/bangles/olive-green-gold-flower-silk-thread-bangle-pair.jpg
 * (full list: docs/image-rename-manifest-2026-11-10.csv).
 *
 * Points existing rows at the new files so nothing shows a broken image:
 * - product_images on the "static" disk (the storefront's own photos);
 * - order_items.image_url snapshots, so past orders keep their photo – both the stored
 *   relative path and an absolute URL that ends with it.
 * The old URLs also keep working through redirects in the storefront (next.config.ts),
 * for links already sent in WhatsApp messages.
 *
 * Idempotent: only rows that still hold an old path are touched. down() maps them back.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->remap($this->map());
    }

    public function down(): void
    {
        $this->remap(array_flip($this->map()));
    }

    /** @return array<string, string> old path => new path */
    private function map(): array
    {
        return json_decode((string) file_get_contents(database_path('data/image-path-map-2026-11-10.json')), true, flags: JSON_THROW_ON_ERROR);
    }

    private function remap(array $map): void
    {
        DB::transaction(function () use ($map) {
            foreach ($map as $from => $to) {
                DB::table('product_images')->where('disk', 'static')->where('path', $from)->update(['path' => $to]);
                DB::table('order_items')->where('image_url', $from)->update(['image_url' => $to]);
            }
            // Absolute snapshot URLs (https://shop.example/images/...): replace the path part only.
            DB::table('order_items')->where('image_url', 'like', 'http%/images/%')->orderBy('id')
                ->each(function ($item) use ($map) {
                    $path = parse_url($item->image_url, PHP_URL_PATH);
                    if (is_string($path) && isset($map[$path])) {
                        DB::table('order_items')->where('id', $item->id)
                            ->update(['image_url' => substr($item->image_url, 0, -strlen($path)).$map[$path]]);
                    }
                });
        });
    }
};
