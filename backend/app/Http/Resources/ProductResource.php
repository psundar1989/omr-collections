<?php

namespace App\Http\Resources;

use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    /** Include full detail (images, description, variants). */
    public bool $detailed = false;

    public function detailed(): static
    {
        $this->detailed = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $admin = $request->is('api/admin/*');
        $pricing = $this->pricing();
        $primary = $this->relationLoaded('images') ? $this->images->first() : ($this->relationLoaded('primaryImage') ? $this->primaryImage : null);
        $inStock = $this->isInStock();

        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'short_description' => $this->short_description,
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id, 'name' => $this->category->name, 'slug' => $this->category->slug,
            ] : null),
            'image_url' => $primary ? Media::url($primary->path, $primary->disk) : null,
            'price' => $pricing['price'],
            'original_price' => $pricing['original_price'],
            'discount_percentage' => $pricing['discount_percentage'],
            'currency' => $pricing['currency'],
            'offer' => $pricing['offer'],
            'is_featured' => $this->is_featured,
            'is_best_seller' => $this->is_best_seller,
            'is_new_arrival' => $this->is_new_arrival,
            'in_stock' => $inStock,
            'stock_quantity' => $this->track_stock ? max(0, $this->stock_quantity) : null,
            'colours' => $this->colours ?? [],
            'sizes' => $this->sizes ?? [],
            'has_variants' => $this->relationLoaded('activeVariants') ? $this->activeVariants->isNotEmpty() : null,
        ];

        if ($this->detailed || $admin) {
            $data += [
                'description' => $this->description,
                'material' => $this->material,
                'meta_title' => $this->meta_title,
                'meta_description' => $this->meta_description,
                'images' => $this->whenLoaded('images', fn () => $this->images->map(fn ($img) => [
                    'id' => $img->id,
                    'url' => Media::url($img->path, $img->disk),
                    'alt_text' => $img->alt_text,
                    'is_primary' => $img->is_primary,
                    'sort_order' => $img->sort_order,
                ])->values()),
                'variants' => $this->when(
                    $this->relationLoaded('activeVariants') || $this->relationLoaded('variants'),
                    fn () => ($admin && $this->relationLoaded('variants') ? $this->variants : $this->activeVariants)->map(function ($v) use ($admin) {
                        $p = $this->pricing($v);
                        $row = [
                            'id' => $v->id,
                            'colour' => $v->colour,
                            'size' => $v->size,
                            'sku' => $v->sku,
                            'additional_price' => (float) $v->additional_price,
                            'price' => $p['price'],
                            'original_price' => $p['original_price'],
                            'in_stock' => ! $this->track_stock || $v->stock_quantity > 0,
                            'stock_quantity' => $this->track_stock ? max(0, $v->stock_quantity) : null,
                        ];

                        return $admin ? $row + ['is_active' => $v->is_active] : $row;
                    })->values()
                ),
            ];
        }

        if ($admin) {
            $data += [
                'category_id' => $this->category_id,
                'regular_price' => (float) $this->regular_price,
                'sale_price' => $this->sale_price !== null ? (float) $this->sale_price : null,
                'track_stock' => $this->track_stock,
                'raw_stock_quantity' => $this->stock_quantity,
                'low_stock_threshold' => $this->low_stock_threshold,
                'is_low_stock' => $this->track_stock && $this->stock_quantity > 0 && $this->stock_quantity <= $this->low_stock_threshold,
                'is_active' => $this->is_active,
                'views_count' => $this->views_count,
                'created_at' => $this->created_at?->toIso8601String(),
                'updated_at' => $this->updated_at?->toIso8601String(),
            ];
        }

        return $data;
    }
}
