<?php

namespace App\Models;

use App\Services\SkuGenerator;
use Illuminate\Database\Eloquent\Model;

class ProductVariant extends Model
{
    protected $attributes = ['is_active' => true, 'additional_price' => 0, 'stock_quantity' => 0];

    protected $fillable = ['product_id', 'colour', 'size', 'sku', 'additional_price', 'stock_quantity', 'is_active'];

    protected $casts = [
        'additional_price' => 'decimal:2',
        'stock_quantity' => 'integer',
        'is_active' => 'boolean',
    ];

    protected static function booted(): void
    {
        // Each colour/size variant gets its own SKU, e.g. OMR-BG-001-24-RED, unless one was entered.
        static::saving(function (ProductVariant $variant) {
            if (trim((string) $variant->sku) === '') {
                $productSku = $variant->product?->sku ?? Product::withTrashed()->whereKey($variant->product_id)->value('sku');
                $variant->sku = app(SkuGenerator::class)->variantSku((string) $productSku, $variant->colour, $variant->size, $variant->id);
            }
        });
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
