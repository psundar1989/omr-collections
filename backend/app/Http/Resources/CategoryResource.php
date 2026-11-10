<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            // Category part of product SKUs (OMR-<CODE>-001); null until the first SKU is generated.
            'sku_code' => $this->sku_code,
            'description' => $this->description,
            'section' => $this->section,
            'image_url' => $this->image_url,
            'sort_order' => $this->sort_order,
            'is_active' => $this->is_active,
            'products_count' => $this->whenCounted('products'),
        ];
    }
}
