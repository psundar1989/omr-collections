<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'discount_percentage' => (float) $this->discount_percentage,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'ends_at' => $this->ends_at?->toIso8601String(),
            'is_active' => $this->is_active,
            'is_running' => $this->isRunning(),
            'product_ids' => $this->whenLoaded('products', fn () => $this->products->pluck('id')),
            'category_ids' => $this->whenLoaded('categories', fn () => $this->categories->pluck('id')),
            'products' => $this->whenLoaded('products', fn () => $this->products->map(fn ($p) => ['id' => $p->id, 'name' => $p->name, 'sku' => $p->sku])),
            'categories' => $this->whenLoaded('categories', fn () => $this->categories->map(fn ($c) => ['id' => $c->id, 'name' => $c->name])),
        ];
    }
}
