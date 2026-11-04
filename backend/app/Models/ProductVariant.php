<?php

namespace App\Models;

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

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
