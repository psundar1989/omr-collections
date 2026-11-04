<?php

namespace App\Models;

use App\Services\PricingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes;

    protected $attributes = ['currency' => 'INR', 'track_stock' => true, 'stock_quantity' => 0, 'low_stock_threshold' => 5, 'is_featured' => false, 'is_best_seller' => false, 'is_new_arrival' => false, 'is_active' => true, 'views_count' => 0];

    protected $fillable = [
        'category_id', 'name', 'slug', 'sku', 'short_description', 'description',
        'regular_price', 'sale_price', 'currency', 'track_stock', 'stock_quantity', 'low_stock_threshold',
        'material', 'colours', 'sizes', 'is_featured', 'is_best_seller', 'is_new_arrival', 'is_active',
        'meta_title', 'meta_description',
    ];

    protected $casts = [
        'regular_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'track_stock' => 'boolean',
        'stock_quantity' => 'integer',
        'low_stock_threshold' => 'integer',
        'colours' => 'array',
        'sizes' => 'array',
        'is_featured' => 'boolean',
        'is_best_seller' => 'boolean',
        'is_new_arrival' => 'boolean',
        'is_active' => 'boolean',
        'views_count' => 'integer',
    ];

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

    public function isInStock(): bool
    {
        return ! $this->track_stock || $this->stock_quantity > 0;
    }

    public function isOrderable(): bool
    {
        return $this->is_active && $this->isInStock() && (! $this->category || $this->category->is_active);
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
