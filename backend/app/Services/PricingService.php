<?php

namespace App\Services;

use App\Models\Offer;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Collection;

/**
 * Single source of truth for selling prices. Every price shown to customers
 * and every cart quote goes through here, so admin price changes and offers
 * take effect immediately everywhere.
 */
class PricingService
{
    private ?Collection $offers = null;

    /** Running offers, loaded once per request. */
    public function runningOffers(): Collection
    {
        return $this->offers ??= Offer::currentlyRunning()
            ->with(['products:id', 'categories:id'])
            ->orderByDesc('discount_percentage')
            ->get();
    }

    public function flush(): void
    {
        $this->offers = null;
    }

    /** Best running offer that applies to this product (directly or via category). */
    public function bestOfferFor(Product $product): ?Offer
    {
        return $this->runningOffers()->first(function (Offer $o) use ($product) {
            return $o->products->contains('id', $product->id)
                || ($product->category_id && $o->categories->contains('id', $product->category_id));
        });
    }

    public function priceFor(Product $product, ?ProductVariant $variant = null): array
    {
        $regular = (float) $product->regular_price;
        $sale = $product->sale_price !== null ? (float) $product->sale_price : null;
        $base = ($sale !== null && $sale < $regular) ? $sale : $regular;

        $offer = $this->bestOfferFor($product);
        if ($offer) {
            // Offer prices are rounded to the whole rupee.
            $offerPrice = round($regular * (1 - (float) $offer->discount_percentage / 100));
            if ($offerPrice < $base) {
                $base = $offerPrice;
            } else {
                $offer = null; // sale price is already better
            }
        }

        $extra = $variant ? (float) $variant->additional_price : 0.0;
        $price = round($base + $extra, 2);
        $original = round($regular + $extra, 2);
        $hasDiscount = $price < $original;

        return [
            'price' => $price,
            'original_price' => $hasDiscount ? $original : null,
            'discount_percentage' => $hasDiscount && $original > 0 ? (int) round(($original - $price) / $original * 100) : null,
            'currency' => $product->currency ?: config('shop.default_currency'),
            'offer' => $offer ? ['id' => $offer->id, 'name' => $offer->name, 'ends_at' => $offer->ends_at?->toIso8601String()] : null,
        ];
    }

    /**
     * SQL expression for the effective (pre-variant) selling price, used for
     * price filters and sorting. Offer percentages and ids are cast to numbers
     * before being inlined, so the expression is injection-safe.
     */
    public function effectivePriceSql(string $table = 'products'): string
    {
        $base = "(CASE WHEN {$table}.sale_price IS NOT NULL AND {$table}.sale_price < {$table}.regular_price THEN {$table}.sale_price ELSE {$table}.regular_price END)";

        $whens = [];
        foreach ($this->runningOffers() as $offer) {
            $conds = [];
            $pids = $offer->products->pluck('id')->map(fn ($id) => (int) $id)->all();
            $cids = $offer->categories->pluck('id')->map(fn ($id) => (int) $id)->all();
            if ($pids) {
                $conds[] = "{$table}.id IN (".implode(',', $pids).')';
            }
            if ($cids) {
                $conds[] = "{$table}.category_id IN (".implode(',', $cids).')';
            }
            if ($conds) {
                $whens[] = 'WHEN '.implode(' OR ', $conds).' THEN '.(float) $offer->discount_percentage;
            }
        }

        if (! $whens) {
            return $base;
        }

        $discount = '(CASE '.implode(' ', $whens).' ELSE 0 END)';
        $offerPrice = "ROUND({$table}.regular_price * (1 - {$discount} / 100.0))";

        return "(CASE WHEN {$offerPrice} < {$base} THEN {$offerPrice} ELSE {$base} END)";
    }
}
