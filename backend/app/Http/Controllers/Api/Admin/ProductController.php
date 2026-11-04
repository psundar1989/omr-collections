<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\PriceManagementService;
use App\Support\Media;
use App\Support\Slug;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function __construct(private PriceManagementService $prices) {}

    public function index(Request $request)
    {
        $v = $request->validate([
            'search' => 'nullable|string|max:120',
            'category_id' => 'nullable|integer',
            'status' => 'nullable|in:active,inactive',
            'stock' => 'nullable|in:in_stock,out_of_stock,low_stock',
            'flag' => 'nullable|in:featured,best_seller,new_arrival',
            'sort' => 'nullable|in:latest,name,price_asc,price_desc,stock_asc,updated',
            'per_page' => 'nullable|integer|min:1|max:200',
        ]);

        $q = Product::with(['category', 'primaryImage']);
        if (! empty($v['search'])) {
            $term = '%'.$v['search'].'%';
            $q->where(fn ($w) => $w->where('name', 'like', $term)->orWhere('sku', 'like', $term));
        }
        if (! empty($v['category_id'])) {
            $q->where('category_id', $v['category_id']);
        }
        if (! empty($v['status'])) {
            $q->where('is_active', $v['status'] === 'active');
        }
        match ($v['stock'] ?? null) {
            'in_stock' => $q->inStock(),
            'out_of_stock' => $q->outOfStock(),
            'low_stock' => $q->lowStock(),
            default => null,
        };
        if (! empty($v['flag'])) {
            $q->where('is_'.$v['flag'], true);
        }
        match ($v['sort'] ?? 'latest') {
            'name' => $q->orderBy('name'),
            'price_asc' => $q->orderBy('regular_price'),
            'price_desc' => $q->orderByDesc('regular_price'),
            'stock_asc' => $q->orderBy('track_stock', 'desc')->orderBy('stock_quantity'),
            'updated' => $q->latest('updated_at'),
            default => $q->latest('id'),
        };

        return ProductResource::collection($q->paginate($v['per_page'] ?? 20)->withQueryString());
    }

    public function show(Product $product)
    {
        return new ProductResource($product->load(['category', 'images', 'variants', 'activeVariants']));
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $variants = $data['variants'] ?? null;
        unset($data['variants']);
        $data['slug'] = Slug::unique(Product::class, $data['slug'] ?? $data['name']);
        $data['currency'] ??= config('shop.default_currency');

        $product = DB::transaction(function () use ($data, $variants, $request) {
            $product = Product::create($data);
            $this->syncVariants($product, $variants);
            $product->priceHistories()->create([
                'user_id' => $request->user()->id, 'price_type' => 'regular', 'old_price' => null,
                'new_price' => $product->regular_price, 'change_source' => 'product_form', 'note' => 'Product created',
            ]);

            return $product;
        });

        return $this->show($product->fresh())->response()->setStatusCode(201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $this->validated($request, $product);
        $variants = array_key_exists('variants', $data) ? $data['variants'] : null;
        unset($data['variants']);

        if (isset($data['slug']) || isset($data['name'])) {
            $data['slug'] = Slug::unique(Product::class, $data['slug'] ?? $product->slug, $product->id);
        }

        DB::transaction(function () use ($product, $data, $variants, $request) {
            $hasRegular = array_key_exists('regular_price', $data);
            $hasSale = array_key_exists('sale_price', $data);
            if ($hasRegular || $hasSale) {
                $this->prices->updatePrices(
                    $product,
                    (float) ($hasRegular ? $data['regular_price'] : $product->regular_price),
                    $hasSale ? ($data['sale_price'] !== null ? (float) $data['sale_price'] : null) : ($product->sale_price !== null ? (float) $product->sale_price : null),
                    $request->user(),
                    'product_form'
                );
            }
            unset($data['regular_price'], $data['sale_price']);
            $product->update($data);
            if ($variants !== null) {
                $this->syncVariants($product, $variants);
            }
        });

        return $this->show($product->fresh());
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->noContent();
    }

    /** Quick toggles: active / featured / best seller / new arrival. */
    public function flags(Request $request, Product $product)
    {
        $data = $request->validate([
            'is_active' => 'sometimes|boolean',
            'is_featured' => 'sometimes|boolean',
            'is_best_seller' => 'sometimes|boolean',
            'is_new_arrival' => 'sometimes|boolean',
        ]);
        $product->update($data);

        return $this->show($product);
    }

    public function stock(Request $request, Product $product)
    {
        $data = $request->validate([
            'track_stock' => 'sometimes|boolean',
            'stock_quantity' => 'sometimes|integer|min:0|max:1000000',
            'low_stock_threshold' => 'sometimes|integer|min:0|max:100000',
            'mark_out_of_stock' => 'sometimes|boolean',
        ]);
        if ($request->boolean('mark_out_of_stock')) {
            $data['track_stock'] = true;
            $data['stock_quantity'] = 0;
            $product->variants()->update(['stock_quantity' => 0]);
        }
        unset($data['mark_out_of_stock']);
        $product->update($data);

        return $this->show($product);
    }

    public function price(Request $request, Product $product)
    {
        $data = $request->validate([
            'regular_price' => 'required|numeric|min:0.01|max:10000000',
            'sale_price' => 'nullable|numeric|min:0.01|lt:regular_price',
            'note' => 'nullable|string|max:255',
        ]);
        $this->prices->updatePrices($product, (float) $data['regular_price'],
            isset($data['sale_price']) ? (float) $data['sale_price'] : null, $request->user(), 'manual', $data['note'] ?? null);

        return $this->show($product);
    }

    public function priceHistory(Product $product)
    {
        return ['data' => $product->priceHistories()->with('user:id,name')->limit(100)->get()];
    }

    /* ---------------------------------------------------------------- images */

    public function uploadImages(Request $request, Product $product)
    {
        $request->validate([
            'images' => 'required|array|min:1|max:10',
            'images.*' => 'image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $hasPrimary = $product->images()->where('is_primary', true)->exists();
        $order = (int) $product->images()->max('sort_order');

        foreach ($request->file('images') as $i => $file) {
            [$path, $disk] = Media::store($file, "products/{$product->id}");
            $product->images()->create([
                'path' => $path, 'disk' => $disk, 'alt_text' => $product->name,
                'is_primary' => ! $hasPrimary && $i === 0, 'sort_order' => ++$order,
            ]);
        }
        $product->touch();

        return $this->show($product);
    }

    public function setPrimaryImage(ProductImage $image)
    {
        DB::transaction(function () use ($image) {
            ProductImage::where('product_id', $image->product_id)->update(['is_primary' => false]);
            $image->update(['is_primary' => true]);
        });

        return $this->show($image->product);
    }

    public function updateImage(Request $request, ProductImage $image)
    {
        $image->update($request->validate(['alt_text' => 'nullable|string|max:255']));

        return $this->show($image->product);
    }

    public function reorderImages(Request $request, Product $product)
    {
        $v = $request->validate(['ids' => 'required|array', 'ids.*' => 'integer']);
        foreach ($v['ids'] as $i => $id) {
            $product->images()->whereKey($id)->update(['sort_order' => $i + 1]);
        }

        return $this->show($product);
    }

    public function deleteImage(ProductImage $image)
    {
        $product = $image->product;
        Media::delete($image->path, $image->disk);
        $wasPrimary = $image->is_primary;
        $image->delete();
        if ($wasPrimary && ($next = $product->images()->first())) {
            $next->update(['is_primary' => true]);
        }

        return $this->show($product);
    }

    /* --------------------------------------------------------------- helpers */

    private function validated(Request $request, ?Product $product = null): array
    {
        $req = $product ? 'sometimes|required' : 'required';

        $data = $request->validate([
            'name' => "{$req}|string|max:200",
            'slug' => ['nullable', 'string', 'max:220', 'alpha_dash', Rule::unique('products', 'slug')->ignore($product?->id)],
            'sku' => [$req, 'string', 'max:64', 'regex:/^[A-Za-z0-9\-_]+$/', Rule::unique('products', 'sku')->ignore($product?->id)],
            'category_id' => 'nullable|integer|exists:categories,id',
            'short_description' => 'nullable|string|max:500',
            'description' => 'nullable|string|max:20000',
            'regular_price' => "{$req}|numeric|min:0.01|max:10000000",
            'sale_price' => 'nullable|numeric|min:0.01|max:10000000',
            'currency' => 'nullable|string|size:3',
            'track_stock' => 'sometimes|boolean',
            'stock_quantity' => 'sometimes|integer|min:0|max:1000000',
            'low_stock_threshold' => 'sometimes|integer|min:0|max:100000',
            'material' => 'nullable|string|max:200',
            'colours' => 'nullable|array|max:30',
            'colours.*' => 'nullable|string|max:60',
            'sizes' => 'nullable|array|max:30',
            'sizes.*' => 'nullable|string|max:60',
            'is_featured' => 'sometimes|boolean',
            'is_best_seller' => 'sometimes|boolean',
            'is_new_arrival' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string|max:500',
            'variants' => 'nullable|array|max:100',
            'variants.*.id' => 'nullable|integer',
            'variants.*.colour' => 'nullable|string|max:60',
            'variants.*.size' => 'nullable|string|max:60',
            'variants.*.sku' => 'nullable|string|max:64',
            'variants.*.additional_price' => 'nullable|numeric|min:-1000000|max:1000000',
            'variants.*.stock_quantity' => 'nullable|integer|min:0|max:1000000',
            'variants.*.is_active' => 'nullable|boolean',
        ], ['sku.regex' => 'SKU may only contain letters, numbers, dashes and underscores.']);

        $regular = $data['regular_price'] ?? $product?->regular_price;
        if (isset($data['sale_price']) && $data['sale_price'] !== null && (float) $data['sale_price'] >= (float) $regular) {
            abort(response()->json(['message' => 'Sale price must be lower than the regular price.',
                'errors' => ['sale_price' => ['Sale price must be lower than the regular price.']]], 422));
        }
        foreach (['colours', 'sizes'] as $k) {
            if (isset($data[$k])) {
                $data[$k] = array_values(array_unique(array_filter(array_map(fn ($x) => trim((string) $x), $data[$k]), 'strlen')));
            }
        }

        return $data;
    }

    private function syncVariants(Product $product, ?array $variants): void
    {
        if ($variants === null) {
            return;
        }
        $keep = [];
        foreach ($variants as $row) {
            if (empty($row['colour']) && empty($row['size'])) {
                continue;
            }
            $attrs = [
                'colour' => $row['colour'] ?? null,
                'size' => $row['size'] ?? null,
                'sku' => $row['sku'] ?? null,
                'additional_price' => $row['additional_price'] ?? 0,
                'stock_quantity' => $row['stock_quantity'] ?? 0,
                'is_active' => $row['is_active'] ?? true,
            ];
            $variant = ! empty($row['id']) ? $product->variants()->find($row['id']) : null;
            $variant ? $variant->update($attrs) : $variant = $product->variants()->create($attrs);
            $keep[] = $variant->id;
        }
        $product->variants()->whereNotIn('id', $keep)->delete();

        // Variant colours/sizes become the product option lists.
        $active = $product->variants()->where('is_active', true)->get();
        if ($active->isNotEmpty()) {
            $product->forceFill([
                'colours' => $active->pluck('colour')->filter()->unique()->values()->all(),
                'sizes' => $active->pluck('size')->filter()->unique()->values()->all(),
            ])->saveQuietly();
            $product->syncStockFromVariants();
        }
    }
}
