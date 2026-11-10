<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Services\PriceManagementService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Gives every unpriced product (regular price 0 / "price on request") a realistic dummy
 * price based on its category, and switches it to a fixed price so it can be added to cart.
 *
 * Idempotent: products that already have a price are never touched, so re-running is safe
 * and prices set in the admin are kept.
 *
 *   php artisan db:seed --class=DummyPriceSeeder
 */
class DummyPriceSeeder extends Seeder
{
    /** category slug => [min, max] price range in INR */
    private const RANGES = [
        'silk-thread-jhumka' => [149, 349],
        'bangles' => [199, 599],
        'alligator-clips' => [49, 149],
        'brooch-pins' => [99, 249],
        'haldi-kumkum-sets' => [299, 799],
        'headbands' => [99, 299],
        'invisible-chains' => [149, 399],
        'jasmine-hair-accessories' => [149, 499],
        'keychains' => [99, 249],
        'rings' => [99, 299],
        'u-pins' => [29, 99],
    ];

    private const DEFAULT_RANGE = [149, 499];

    public function run(PriceManagementService $prices): void
    {
        $count = 0;

        DB::transaction(function () use ($prices, &$count) {
            Product::with('category:id,slug')
                ->where('regular_price', '<=', 0)
                ->orderBy('id')
                ->each(function (Product $product) use ($prices, &$count) {
                    [$min, $max] = self::RANGES[$product->category?->slug] ?? self::DEFAULT_RANGE;

                    // Deterministic per product (same price on every run), ending in 9 like real retail prices.
                    mt_srand($product->id);
                    $regular = (float) (intdiv(mt_rand($min, $max), 10) * 10 + 9);
                    $regular = min($regular, (float) $max);

                    // Every 4th product gets a ~15% sale price.
                    $sale = $product->id % 4 === 0 ? (float) (intdiv((int) ($regular * 0.85), 10) * 10 - 1) : null;

                    $prices->updatePrices($product, $regular, $sale, null, 'bulk', 'Dummy price (DummyPriceSeeder)', false);
                    $count++;
                });
        });

        mt_srand();

        $this->command?->info("Dummy prices set for {$count} product(s).");
    }
}
