<?php

namespace App\Models;

use App\Support\Media;
use Illuminate\Database\Eloquent\Model;

class Banner extends Model
{
    protected $attributes = ['is_active' => true, 'sort_order' => 0, 'image_disk' => 'public'];

    protected $fillable = ['title', 'subtitle', 'image_path', 'image_disk', 'button_text', 'button_link', 'sort_order', 'is_active'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function getImageUrlAttribute(): ?string
    {
        return Media::url($this->image_path, $this->image_disk);
    }
}
