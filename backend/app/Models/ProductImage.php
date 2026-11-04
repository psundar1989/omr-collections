<?php

namespace App\Models;

use App\Support\Media;
use Illuminate\Database\Eloquent\Model;

class ProductImage extends Model
{
    protected $fillable = ['product_id', 'path', 'disk', 'alt_text', 'is_primary', 'sort_order'];

    protected $casts = ['is_primary' => 'boolean', 'sort_order' => 'integer'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function getUrlAttribute(): ?string
    {
        return Media::url($this->path, $this->disk);
    }
}
