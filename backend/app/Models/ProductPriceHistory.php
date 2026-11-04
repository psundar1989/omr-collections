<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductPriceHistory extends Model
{
    protected $fillable = ['product_id', 'user_id', 'price_type', 'old_price', 'new_price', 'change_source', 'note'];

    protected $casts = ['old_price' => 'decimal:2', 'new_price' => 'decimal:2'];

    public function product()
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
