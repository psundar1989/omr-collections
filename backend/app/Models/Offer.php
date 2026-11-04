<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Offer extends Model
{
    use SoftDeletes;

    protected $attributes = ['is_active' => true];

    protected $fillable = ['name', 'description', 'discount_percentage', 'starts_at', 'ends_at', 'is_active'];

    protected $casts = [
        'discount_percentage' => 'decimal:2',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function products()
    {
        return $this->belongsToMany(Product::class, 'offer_products');
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'offer_categories');
    }

    /** Offers that are enabled and inside their date window right now. */
    public function scopeCurrentlyRunning(Builder $q): Builder
    {
        $now = now();

        return $q->where('is_active', true)
            ->where(fn ($w) => $w->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn ($w) => $w->whereNull('ends_at')->orWhere('ends_at', '>=', $now));
    }

    public function isRunning(): bool
    {
        $now = now();

        return $this->is_active
            && (! $this->starts_at || $this->starts_at <= $now)
            && (! $this->ends_at || $this->ends_at >= $now);
    }
}
