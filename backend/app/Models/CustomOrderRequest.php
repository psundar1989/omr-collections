<?php

namespace App\Models;

use App\Support\Media;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomOrderRequest extends Model
{
    use SoftDeletes;

    public const STATUSES = ['new', 'contacted', 'completed', 'cancelled'];

    protected $attributes = ['status' => 'new', 'reference_image_disk' => 'public'];

    protected $fillable = ['customer_name', 'whatsapp_number', 'product_type', 'preferred_colour', 'size',
        'description', 'reference_image_path', 'reference_image_disk', 'status', 'admin_notes'];

    protected $appends = ['reference_image_url'];

    public function getReferenceImageUrlAttribute(): ?string
    {
        return Media::url($this->reference_image_path, $this->reference_image_disk);
    }
}
