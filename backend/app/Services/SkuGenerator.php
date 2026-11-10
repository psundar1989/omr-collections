<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Str;

/**
 * Builds SKUs in the format OMR-<CATEGORY>-<NUMBER>[-<SIZE>][-<COLOUR>]:
 *
 *   OMR-BG-001          product 1 of the Bangles category (code BG)
 *   OMR-BG-001-24-RED   that bangle in size 2.4, colour Red
 *   OMR-BR-004-SKYBLU   bracelet 4 in Sky Blue (no size)
 *
 * - The category code is stored on the category (set in Admin → Categories); a category
 *   without one gets the configured default for its slug or a code derived from its name.
 * - Product numbers count up per category code, never reusing a number (deleted products
 *   included), so a SKU always points to one product.
 * - SKUs are unique across products and variants together. Existing SKUs are never
 *   regenerated: only empty SKUs (or catalogue placeholders, see the importer) are filled.
 */
class SkuGenerator
{
    public const GENERAL_CODE = 'GN';

    public function prefix(): string
    {
        return strtoupper((string) config('shop.sku_prefix', 'OMR'));
    }

    /** Category part of the SKU; assigns and stores a code on the category when it has none. */
    public function categoryCode(?Category $category): string
    {
        if (! $category) {
            return self::GENERAL_CODE;
        }
        if ($category->sku_code) {
            return $category->sku_code;
        }

        $preferred = config("shop.sku_category_codes.{$category->slug}") ?: $this->deriveCode($category->name);
        $code = $preferred;
        for ($n = 2; Category::withTrashed()->where('sku_code', $code)->whereKeyNot($category->id)->exists() || $code === self::GENERAL_CODE; $n++) {
            $code = substr($preferred, 0, 4).$n;
        }
        $category->forceFill(['sku_code' => $code])->saveQuietly();

        return $code;
    }

    /** Next free product SKU for a category, e.g. OMR-BG-013. */
    public function nextProductSku(?Category $category): string
    {
        $base = $this->prefix().'-'.$this->categoryCode($category).'-';
        $number = $this->highestNumber($base) + 1;
        while ($this->isTaken($sku = $base.str_pad((string) $number, 3, '0', STR_PAD_LEFT))) {
            $number++;
        }

        return $sku;
    }

    /**
     * SKU of one colour/size choice of a product, e.g. OMR-BG-001-24-RED. Deterministic and
     * not stored: used for products whose options are plain colour/size lists.
     */
    public function selectionSku(string $productSku, ?string $colour, ?string $size): string
    {
        $parts = array_filter([$productSku, $this->sizeCode($size), $this->colourCode($colour)], fn ($p) => $p !== '');

        return Str::limit(implode('-', $parts), 64, '');
    }

    /** Stored variant SKU: the selection SKU, made unique if another product or variant already has it. */
    public function variantSku(string $productSku, ?string $colour, ?string $size, ?int $ignoreVariantId = null): string
    {
        $base = $this->selectionSku($productSku, $colour, $size);
        if ($base === $productSku) {
            $base .= '-V';
        }
        $sku = $base;
        for ($n = 2; $this->isTaken($sku, ignoreVariantId: $ignoreVariantId); $n++) {
            $sku = Str::limit($base, 60, '').'-'.$n;
        }

        return $sku;
    }

    /** Every colour × size choice of a product without variants, with its SKU. */
    public function optionSkus(Product $product): array
    {
        $colours = array_values($product->colours ?? []) ?: [null];
        $sizes = $product->selectableSizes() ?: [null];
        if ($colours === [null] && $sizes === [null]) {
            return [];
        }
        $out = [];
        foreach ($colours as $colour) {
            foreach ($sizes as $size) {
                $out[] = ['colour' => $colour, 'size' => $size, 'sku' => $this->selectionSku($product->sku, $colour, $size)];
            }
        }

        return $out;
    }

    /** True when a product (deleted ones included) or a variant already uses this SKU (case-insensitive). */
    public function isTaken(string $sku, ?int $ignoreProductId = null, ?int $ignoreVariantId = null): bool
    {
        $sku = strtolower($sku);

        return Product::withTrashed()->whereRaw('lower(sku) = ?', [$sku])->when($ignoreProductId, fn ($q) => $q->whereKeyNot($ignoreProductId))->exists()
            || ProductVariant::whereRaw('lower(sku) = ?', [$sku])->when($ignoreVariantId, fn ($q) => $q->whereKeyNot($ignoreVariantId))->exists();
    }

    /** "2.4" → "24", "Free Size" → "FREESIZE", "XL" → "XL". */
    public function sizeCode(?string $size): string
    {
        return substr(strtoupper(preg_replace('/[^A-Za-z0-9]+/', '', (string) $size)), 0, 10);
    }

    /**
     * "Red" → "RED", "Blue" → "BLU", "Sky Blue" → "SKYBLU", "Purple & White" → "PURWHI":
     * the first three letters of each word (connectors such as "and"/"with" skipped).
     */
    public function colourCode(?string $colour): string
    {
        $words = preg_split('/[^A-Za-z0-9]+/', strtoupper(Str::ascii((string) $colour)), -1, PREG_SPLIT_NO_EMPTY);
        $words = array_values(array_diff($words, ['AND', 'WITH', 'OF', 'THE']));

        return substr(implode('', array_map(fn ($w) => substr($w, 0, 3), $words)), 0, 12);
    }

    /** "Hair Clips" → "HC", "Bangles" → "BA", "Haldi Kumkum Sets" → "HKS". */
    private function deriveCode(string $name): string
    {
        $words = preg_split('/[^A-Za-z0-9]+/', strtoupper(Str::ascii($name)), -1, PREG_SPLIT_NO_EMPTY) ?: ['X'];
        $words = array_values(array_diff($words, ['AND', 'WITH', 'OF', 'THE'])) ?: ['X'];
        $code = count($words) === 1 ? substr($words[0], 0, 2) : implode('', array_map(fn ($w) => $w[0], array_slice($words, 0, 3)));

        return str_pad($code, 2, 'X');
    }

    private function highestNumber(string $base): int
    {
        $pattern = '/^'.preg_quote($base, '/').'(\d+)$/i';

        // $base is "<PREFIX>-<CODE>-" with an alphanumeric code, so it holds no LIKE wildcards.
        return (int) Product::withTrashed()->where('sku', 'like', $base.'%')->pluck('sku')
            ->map(fn ($sku) => preg_match($pattern, $sku, $m) ? (int) $m[1] : 0)
            ->max();
    }
}
