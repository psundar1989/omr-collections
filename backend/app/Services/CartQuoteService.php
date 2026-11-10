<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Support\Media;
use App\Support\Money;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Re-prices a client cart from the database. Client-side totals are never
 * trusted: prices, stock and variations are validated here and the WhatsApp
 * message is built from these authoritative values.
 */
class CartQuoteService
{
    public function __construct(private PricingService $pricing, private SettingsService $settings, private SkuGenerator $skus) {}

    public function quote(array $items, array $customer = []): array
    {
        $ids = collect($items)->pluck('product_id')->unique()->all();
        $products = Product::with(['category', 'activeVariants', 'images'])
            ->whereIn('id', $ids)->get()->keyBy('id');

        $symbol = $this->settings->get('currency_symbol', '₹');
        $lines = [];
        $total = 0.0;
        $valid = true;
        $onRequest = false;

        foreach ($items as $i => $item) {
            $line = $this->quoteLine($products->get($item['product_id']), $item);
            $line['key'] = $item['key'] ?? (string) $i;
            if ($line['error']) {
                $valid = false;
            } else {
                $total += $line['line_total'];
                $onRequest = $onRequest || $line['price_on_request'];
            }
            $lines[] = $line;
        }

        $total = round($total, 2);
        $result = [
            'valid' => $valid && count($lines) > 0,
            'items' => $lines,
            // Sum of the priced lines; "price on request" lines are quoted by the seller on WhatsApp.
            'total' => $total,
            'total_formatted' => Money::format($total, $symbol),
            'has_price_on_request' => $onRequest,
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
            'image_url' => $product ? $this->imageUrl($product, null) : null,
            'colour' => $item['colour'] ?? null,
            'size' => $item['size'] ?? null,
            'quantity' => $qty,
            'unit_price' => null,
            'original_price' => null,
            'price_on_request' => (bool) $product?->price_on_request,
            'line_total' => 0,
            'available_quantity' => null,
            'error' => null,
        ];

        // Disabled products (or products in a hidden category) are treated as not existing.
        if (! $product || ! $product->is_active || ($product->category && ! $product->category->is_active)) {
            return [...$base, 'error' => 'This product is no longer available.'];
        }
        // Sold-out / discontinued products stay visible but can never be ordered, whatever the client sends.
        if ($product->availability_status === Product::STATUS_SOLD_OUT) {
            return [...$base, 'error' => 'This product is sold out.'];
        }
        if (! $product->isAvailable()) {
            return [...$base, 'error' => 'This product has been discontinued.'];
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
                $colour = $this->canonical($colour, $product->colours); // the admin's spelling, not the client's
            } else {
                $colour = null;
            }
            $sizes = $product->selectableSizes();
            if (! empty($sizes)) {
                if (! $size || ! $this->inList($size, $sizes)) {
                    return [...$base, 'error' => 'Please choose a size.'];
                }
                $size = $this->canonical($size, $sizes);
            } else {
                $size = null;
            }
            $available = $product->track_stock ? (int) $product->stock_quantity : null;
        }

        $pricing = $this->pricing->priceFor($product, $variant);
        $base = [
            ...$base,
            'variant_id' => $variant?->id,
            // The SKU of exactly what was chosen: the variant's, or product SKU + size + colour.
            'sku' => $variant?->sku ?: $this->skus->selectionSku($product->sku, $colour, $size),
            'image_url' => $this->imageUrl($product, $colour),
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

        return [...$base, 'line_total' => $pricing['price_on_request'] ? 0 : round($pricing['price'] * $qty, 2)];
    }

    /**
     * Photo of the ordered colour: the image tagged with that colour in the admin, else one
     * whose alt text ends in "– Colour" (older convention). Falls back to the primary image.
     */
    private function imageUrl(Product $product, ?string $colour): ?string
    {
        $image = $colour
            ? ($product->images->first(fn (ProductImage $image) => $image->colour !== null && $this->same($image->colour, $colour))
                ?? $product->images->first(fn (ProductImage $image) => $this->same(Str::afterLast((string) $image->alt_text, ' – '), $colour)))
            : null;
        $image ??= $product->images->first();

        return $image ? Media::url($image->path, $image->disk) : null;
    }

    /**
     * WhatsApp order message, built only from server-side values. One product reads as a
     * simple block; several products are numbered with a grand total.
     */
    public function buildMessage(array $lines, float $total, string $symbol, array $customer, ?string $orderNumber = null): string
    {
        $single = count($lines) === 1;
        $onRequest = collect($lines)->contains('price_on_request', true);
        $out = ['Hello! I would like to place an order.', ''];
        if ($orderNumber) {
            $out[] = '*Order No: '.$orderNumber.'*';
            $out[] = '';
        }
        $out[] = '*Product Details*';
        $out[] = '';

        foreach ($lines as $n => $l) {
            $indent = $single ? '' : '   ';
            $block = ['Product Name: '.$l['name']];
            // wa.me links can only prefill text, so the photo travels as a direct link to the original
            // file. WhatsApp decides whether to show a preview; it is omitted if not publicly reachable.
            if ($image = Media::shareableUrl($l['image_url'] ?? null)) {
                array_push($block, '', 'Product Image:', $image, '');
            } elseif (! empty($l['image_url'])) {
                Log::warning('WhatsApp order message left out a product image that is not publicly reachable. Set FRONTEND_URL, PUBLIC_STORAGE_URL or AWS_URL to a public HTTPS address.', [
                    'sku' => $l['sku'],
                    'image_url' => $l['image_url'],
                ]);
            }
            if (! empty($l['slug']) && $link = Media::shareableUrl('/products/'.$l['slug'])) {
                $block[] = 'Product Link: '.$link;
            }
            $block[] = 'SKU: '.$l['sku'];
            $block[] = 'Price: '.$this->priceText($l, $symbol);
            if ($l['colour']) {
                $block[] = 'Colour: '.$l['colour'];
            }
            if ($l['size']) {
                $block[] = 'Size: '.$l['size'];
            }
            $block[] = 'Quantity: '.$l['quantity'];
            if (! $l['price_on_request']) {
                $block[] = ($single ? 'Total Amount: ' : 'Total: ').Money::format($l['line_total'], $symbol);
            }
            foreach ($block as $j => $text) {
                $out[] = $text === '' ? '' : ($single ? '' : ($j === 0 ? ($n + 1).'. ' : $indent)).$text;
            }
            $out[] = '';
        }

        if (! $single) {
            $out[] = '----------------------';
            if ($total > 0) {
                $out[] = '*Total Amount: '.Money::format($total, $symbol).($onRequest ? ' + items on request' : '').'*';
            } else {
                $out[] = '*Total Amount: On Request*';
            }
            $out[] = '';
        }

        $out[] = $onRequest ? 'Please share the price and availability.' : 'Please confirm availability and delivery details.';

        $labels = [
            'customer_name' => 'Customer Name', 'phone' => 'Phone', 'whatsapp_number' => 'WhatsApp', 'email' => 'Email',
            'address' => 'Delivery Address', 'delivery_location' => 'Delivery Location', 'landmark' => 'Landmark',
            'city' => 'City', 'state' => 'State', 'pincode' => 'Pincode', 'notes' => 'Notes',
        ];
        $details = array_filter(array_combine(
            array_values($labels),
            array_map(fn ($key) => trim((string) ($customer[$key] ?? '')), array_keys($labels)),
        ), 'strlen');
        if ($details) {
            $out[] = '';
            $out[] = '*Customer Details*';
            foreach ($details as $label => $value) {
                $out[] = "{$label}: {$value}";
            }
        }

        $out[] = '';
        $out[] = 'Thank you!';

        return implode("\n", $out);
    }

    private function priceText(array $line, string $symbol): string
    {
        if ($line['price_on_request']) {
            return 'On Request';
        }
        $text = Money::format($line['unit_price'], $symbol);

        return $line['original_price'] ? $text.' (Regular '.Money::format($line['original_price'], $symbol).')' : $text;
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

    private function canonical(string $v, array $list): string
    {
        return (string) collect($list)->first(fn ($x) => $this->same((string) $x, $v), $v);
    }

    private function inList(string $v, array $list): bool
    {
        return collect($list)->contains(fn ($x) => $this->same((string) $x, $v));
    }
}
