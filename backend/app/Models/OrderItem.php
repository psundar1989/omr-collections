<?php

namespace App\Models;

use App\Support\Media;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = ['order_id', 'product_id', 'product_variant_id', 'product_name', 'product_slug', 'sku', 'image_url', 'image_path', 'image_disk',
        'colour', 'size', 'quantity', 'unit_price', 'original_price', 'price_on_request', 'line_total'];

    protected $hidden = ['image_path', 'image_disk'];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'original_price' => 'decimal:2',
        'price_on_request' => 'boolean',
        'line_total' => 'decimal:2',
    ];

    protected $appends = ['product_url'];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    /**
     * Photo of what was ordered. Built from the stored path / disk on every read, so it follows
     * the current environment (APP_URL, PUBLIC_STORAGE_URL, FRONTEND_URL). Older rows without a
     * path keep the URL resolved when they were placed.
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (?string $value) => $this->image_path ? Media::url($this->image_path, $this->image_disk) : $value);
    }

    /**
     * Public storefront page of the product: the current slug when the product is loaded (so a
     * renamed product still links correctly), else the slug saved with the order. Null once the
     * product has been deleted, as its page no longer exists.
     */
    protected function productUrl(): Attribute
    {
        return Attribute::get(function () {
            $product = $this->relationLoaded('product') ? $this->product : null;
            if ($this->relationLoaded('product') && (! $product || $product->trashed())) {
                return null;
            }
            $slug = $product?->slug ?: $this->product_slug;

            return $slug ? self::productPageUrl($slug) : null;
        });
    }

    public static function productPageUrl(string $slug): string
    {
        return rtrim(config('shop.frontend_url'), '/').'/products/'.rawurlencode($slug);
    }

    /** True while an order still shows this file, so it must stay on disk. */
    public static function usesImage(?string $path, ?string $disk): bool
    {
        return $path !== null && self::query()->where('image_path', $path)->where('image_disk', $disk)->exists();
    }
}
