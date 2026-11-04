<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\Media;
use App\Support\Money;

/**
 * Re-prices a client cart from the database. Client-side totals are never
 * trusted: prices, stock and variations are validated here and the WhatsApp
 * message is built from these authoritative values.
 */
class CartQuoteService
{
    public function __construct(private PricingService $pricing, private SettingsService $settings) {}

    public function quote(array $items, array $customer = []): array
    {
        $ids = collect($items)->pluck('product_id')->unique()->all();
        $products = Product::with(['category', 'activeVariants', 'primaryImage'])
            ->whereIn('id', $ids)->get()->keyBy('id');

        $symbol = $this->settings->get('currency_symbol', '₹');
        $lines = [];
        $total = 0.0;
        $valid = true;

        foreach ($items as $i => $item) {
            $line = $this->quoteLine($products->get($item['product_id']), $item);
            $line['key'] = $item['key'] ?? (string) $i;
            if ($line['error']) {
                $valid = false;
            } else {
                $total += $line['line_total'];
            }
            $lines[] = $line;
        }

        $total = round($total, 2);
        $result = [
            'valid' => $valid && count($lines) > 0,
            'items' => $lines,
            'total' => $total,
            'total_formatted' => Money::format($total, $symbol),
            'currency' => $this->settings->get('currency', 'INR'),
            'disclaimer' => $this->settings->get('order_disclaimer'),
            'message' => null,
            'whatsapp_url' => null,
        ];

        if ($result['valid']) {
            $result['message'] = $this->buildMessage($lines, $total, $symbol, $customer);
            $result['whatsapp_url'] = $this->settings->whatsappUrl($result['message']);
        }

        return $result;
    }

    private function quoteLine(?Product $product, array $item): array
    {
        $qty = (int) $item['quantity'];
        $base = [
            'product_id' => $item['product_id'],
            'variant_id' => null,
            'name' => $product?->name,
            'slug' => $product?->slug,
            'sku' => $product?->sku,
            'image_url' => $product?->primaryImage ? Media::url($product->primaryImage->path, $product->primaryImage->disk) : null,
            'colour' => $item['colour'] ?? null,
            'size' => $item['size'] ?? null,
            'quantity' => $qty,
            'unit_price' => null,
            'original_price' => null,
            'line_total' => 0,
            'available_quantity' => null,
            'error' => null,
        ];

        if (! $product || ! $product->is_active || ($product->category && ! $product->category->is_active)) {
            return [...$base, 'error' => 'This product is no longer available.'];
        }

        $colour = $this->clean($item['colour'] ?? null);
        $size = $this->clean($item['size'] ?? null);
        $variant = null;

        if ($product->activeVariants->isNotEmpty()) {
            $variant = ! empty($item['variant_id'])
                ? $product->activeVariants->firstWhere('id', (int) $item['variant_id'])
                : $product->activeVariants->first(fn (ProductVariant $v) => $this->same($v->colour, $colour) && $this->same($v->size, $size));
            if (! $variant) {
                return [...$base, 'error' => 'Please choose an available colour / size option.'];
            }
            $colour = $variant->colour;
            $size = $variant->size;
            $available = $product->track_stock ? (int) $variant->stock_quantity : null;
        } else {
            if (! empty($product->colours)) {
                if (! $colour || ! $this->inList($colour, $product->colours)) {
                    return [...$base, 'error' => 'Please choose a colour.'];
                }
            } else {
                $colour = null;
            }
            if (! empty($product->sizes)) {
                if (! $size || ! $this->inList($size, $product->sizes)) {
                    return [...$base, 'error' => 'Please choose a size.'];
                }
            } else {
                $size = null;
            }
            $available = $product->track_stock ? (int) $product->stock_quantity : null;
        }

        $pricing = $this->pricing->priceFor($product, $variant);
        $base = [
            ...$base,
            'variant_id' => $variant?->id,
            'sku' => $variant?->sku ?: $product->sku,
            'colour' => $colour,
            'size' => $size,
            'unit_price' => $pricing['price'],
            'original_price' => $pricing['original_price'],
            'available_quantity' => $available,
        ];

        if ($available !== null && $available <= 0) {
            return [...$base, 'error' => 'Out of stock.'];
        }
        if ($available !== null && $qty > $available) {
            return [...$base, 'error' => "Only {$available} left in stock."];
        }

        return [...$base, 'line_total' => round($pricing['price'] * $qty, 2)];
    }

    private function buildMessage(array $lines, float $total, string $symbol, array $customer): string
    {
        $out = ["Hello! I would like to order the following handmade products.", '', '*Order Details:*', ''];

        foreach ($lines as $n => $l) {
            $out[] = ($n + 1).'. Product: '.$l['name'];
            $out[] = '   Product Code: '.$l['sku'];
            if ($l['colour']) {
                $out[] = '   Colour: '.$l['colour'];
            }
            if ($l['size']) {
                $out[] = '   Size: '.$l['size'];
            }
            $out[] = '   Quantity: '.$l['quantity'];
            $out[] = '   Price: '.Money::format($l['unit_price'], $symbol);
            $out[] = '   Total: '.Money::format($l['line_total'], $symbol);
            $out[] = '';
        }

        $out[] = '----------------------';
        $out[] = '*Total Amount: '.Money::format($total, $symbol).'*';
        $out[] = '';
        $out[] = 'Please confirm availability and delivery details.';
        $out[] = '';
        $out[] = 'Customer Name: '.trim((string) ($customer['customer_name'] ?? ''));
        $out[] = 'Delivery Location: '.trim((string) ($customer['delivery_location'] ?? ''));
        $out[] = 'Pincode: '.trim((string) ($customer['pincode'] ?? ''));
        if (! empty($customer['notes'])) {
            $out[] = 'Notes: '.trim((string) $customer['notes']);
        }

        return implode("\n", $out);
    }

    private function clean(?string $v): ?string
    {
        $v = $v !== null ? trim($v) : null;

        return $v === '' ? null : $v;
    }

    private function same(?string $a, ?string $b): bool
    {
        return mb_strtolower((string) $a) === mb_strtolower((string) $b);
    }

    private function inList(string $v, array $list): bool
    {
        return collect($list)->contains(fn ($x) => $this->same((string) $x, $v));
    }
}
