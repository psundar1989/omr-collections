<?php

namespace App\Models;

use App\Support\Media;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Category extends Model
{
    use SoftDeletes;

    /** Homepage collections a category can be grouped into. */
    public const SECTIONS = ['beads', 'charms'];

    protected $attributes = ['is_active' => true, 'sort_order' => 0, 'image_disk' => 'public'];

    protected $fillable = ['name', 'slug', 'description', 'section', 'image_path', 'image_disk', 'sort_order', 'is_active'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function scopeActive(Builder $q): Builder
    {
        return $q->where('is_active', true);
    }

    public function scopeOrdered(Builder $q): Builder
    {
        return $q->orderBy('sort_order')->orderBy('name');
    }

    public function getImageUrlAttribute(): ?string
    {
        return Media::url($this->image_path, $this->image_disk);
    }
}
