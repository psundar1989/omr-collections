<?php

namespace App\Models;

use App\Services\PricingService;
use App\Services\SkuGenerator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes;

    /*
     * Availability is chosen by the admin and is independent of `is_active` (enabled = shown on
     * the website) and of stock tracking. Only "available" products can be ordered.
     */
    public const STATUS_AVAILABLE = 'available';

    public const STATUS_SOLD_OUT = 'sold_out';

    public const STATUS_DISCONTINUED = 'discontinued';

    public const STATUSES = [self::STATUS_AVAILABLE, self::STATUS_SOLD_OUT, self::STATUS_DISCONTINUED];

    protected $attributes = ['currency' => 'INR', 'track_stock' => true, 'stock_quantity' => 0, 'low_stock_threshold' => 5, 'is_featured' => false, 'is_best_seller' => false, 'is_new_arrival' => false, 'is_active' => true, 'views_count' => 0, 'price_on_request' => false, 'availability_status' => self::STATUS_AVAILABLE, 'sizes_enabled' => true];

    protected $fillable = [
        'category_id', 'name', 'slug', 'sku', 'catalog_code', 'short_description', 'description',
        'regular_price', 'sale_price', 'price_on_request', 'currency', 'track_stock', 'stock_quantity', 'low_stock_threshold',
        'material', 'colours', 'sizes', 'sizes_enabled', 'is_featured', 'is_best_seller', 'is_new_arrival', 'is_active', 'availability_status',
        'meta_title', 'meta_description', 'source',
    ];

    protected $casts = [
        'regular_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'price_on_request' => 'boolean',
        'track_stock' => 'boolean',
        'stock_quantity' => 'integer',
        'low_stock_threshold' => 'integer',
        'colours' => 'array',
        'sizes' => 'array',
        'sizes_enabled' => 'boolean',
        'is_featured' => 'boolean',
        'is_best_seller' => 'boolean',
        'is_new_arrival' => 'boolean',
        'is_active' => 'boolean',
        'views_count' => 'integer',
    ];

    protected static function booted(): void
    {
        // Every product gets a SKU: an empty one is generated as OMR-<CATEGORY>-<NUMBER>.
        static::creating(function (Product $product) {
            if (trim((string) $product->sku) === '') {
                $product->sku = app(SkuGenerator::class)->nextProductSku($product->category_id ? Category::find($product->category_id) : null);
            }
        });
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class)->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id');
    }

    public function primaryImage()
    {
        return $this->hasOne(ProductImage::class)->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id');
    }

    public function variants()
    {
        return $this->hasMany(ProductVariant::class)->orderBy('id');
    }

    public function activeVariants()
    {
        return $this->hasMany(ProductVariant::class)->where('is_active', true)->orderBy('id');
    }

    public function priceHistories()
    {
        return $this->hasMany(ProductPriceHistory::class)->latest();
    }

    public function offers()
    {
        return $this->belongsToMany(Offer::class, 'offer_products');
    }

    /* ---------------------------------------------------------------- scopes */

    /** Products customers may see: active, and not inside an inactive category. */
    public function scopeVisible(Builder $q): Builder
    {
        return $q->where('products.is_active', true)
            ->where(fn ($w) => $w->whereNull('category_id')
                ->orWhereHas('category', fn ($c) => $c->where('is_active', true)));
    }

    public function scopeAvailability(Builder $q, string $status): Builder
    {
        return $q->where('products.availability_status', $status);
    }

    public function scopeInStock(Builder $q): Builder
    {
        return $q->where(fn ($w) => $w->where('track_stock', false)->orWhere('stock_quantity', '>', 0));
    }

    public function scopeOutOfStock(Builder $q): Builder
    {
        return $q->where('track_stock', true)->where('stock_quantity', '<=', 0);
    }

    public function scopeLowStock(Builder $q): Builder
    {
        return $q->where('track_stock', true)->where('stock_quantity', '>', 0)
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold');
    }

    /* --------------------------------------------------------------- helpers */

    /** Products imported from the photographed catalogue (frontend/src/data/products.json). */
    public const SOURCE_PHOTO_CATALOGUE = 'photo_catalogue';

    /** fixed | sale | on_request – how the admin chose to price this product. */
    public function pricingMode(): string
    {
        if ($this->price_on_request) {
            return 'on_request';
        }

        return $this->sale_price !== null && (float) $this->sale_price < (float) $this->regular_price ? 'sale' : 'fixed';
    }

    public function isInStock(): bool
    {
        return ! $this->track_stock || $this->stock_quantity > 0;
    }

    public function isAvailable(): bool
    {
        return ($this->availability_status ?? self::STATUS_AVAILABLE) === self::STATUS_AVAILABLE;
    }

    /** Enabled, in a visible category, marked available and (when stock is tracked) in stock. */
    public function isOrderable(): bool
    {
        return $this->is_active && $this->isAvailable() && $this->isInStock() && (! $this->category || $this->category->is_active);
    }

    /** Sizes customers choose from: none when size selection is switched off for this product. */
    public function selectableSizes(): array
    {
        return $this->sizes_enabled ? array_values($this->sizes ?? []) : [];
    }

    /** Keep product-level stock equal to the sum of variant stock when variants exist. */
    public function syncStockFromVariants(): void
    {
        $variants = $this->variants()->where('is_active', true)->get();
        if ($variants->isNotEmpty()) {
            $this->forceFill(['stock_quantity' => (int) $variants->sum('stock_quantity')])->saveQuietly();
        }
    }

    public function pricing(?ProductVariant $variant = null): array
    {
        return app(PricingService::class)->priceFor($this, $variant);
    }
}
