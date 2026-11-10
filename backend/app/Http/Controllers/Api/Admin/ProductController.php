<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Services\PriceManagementService;
use App\Services\SkuGenerator;
use App\Support\Media;
use App\Support\Slug;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function __construct(private PriceManagementService $prices, private SkuGenerator $skus) {}

    public function index(Request $request)
    {
        $v = $request->validate([
            'search' => 'nullable|string|max:120',
            'category_id' => 'nullable|integer',
            // Visibility (enabled / disabled). "active/inactive" kept for existing links.
            'status' => 'nullable|in:active,inactive,enabled,disabled',
            'availability' => ['nullable', Rule::in(Product::STATUSES)],
            'section' => ['nullable', Rule::in([...Category::SECTIONS, 'general'])],
            'min_price' => 'nullable|numeric|min:0',
            'max_price' => 'nullable|numeric|min:0',
            'stock' => 'nullable|in:in_stock,out_of_stock,low_stock',
            'flag' => 'nullable|in:featured,best_seller,new_arrival',
            'pricing' => 'nullable|in:fixed,sale,on_request',
            'source' => 'nullable|in:'.Product::SOURCE_PHOTO_CATALOGUE.',manual',
            'sort' => 'nullable|in:latest,oldest,name,name_desc,sku,price_asc,price_desc,stock_asc,updated,status',
            'per_page' => 'nullable|integer|min:1|max:200',
        ]);

        $q = Product::with(['category', 'primaryImage']);
        if (! empty($v['search'])) {
            $term = '%'.str_replace(['%', '_'], ['\%', '\_'], $v['search']).'%';
            $q->where(fn ($w) => $w->where('name', 'like', $term)->orWhere('sku', 'like', $term)->orWhere('catalog_code', 'like', $term)
                ->orWhereHas('variants', fn ($v) => $v->where('sku', 'like', $term)));
        }
        if (! empty($v['category_id'])) {
            $q->where('category_id', $v['category_id']);
        }
        if (! empty($v['status'])) {
            $q->where('is_active', in_array($v['status'], ['active', 'enabled'], true));
        }
        if (! empty($v['availability'])) {
            $q->availability($v['availability']);
        }
        // Collection group of the category (beads / charms / photo collections / general categories).
        if (! empty($v['section'])) {
            $v['section'] === 'general'
                ? $q->whereHas('category', fn ($c) => $c->whereNull('section'))
                : $q->whereHas('category', fn ($c) => $c->where('section', $v['section']));
        }
        // Price filters use the stored selling price (sale price when lower); "on request" products have none.
        $selling = '(CASE WHEN sale_price IS NOT NULL AND sale_price < regular_price THEN sale_price ELSE regular_price END)';
        if (isset($v['min_price'])) {
            $q->where('price_on_request', false)->whereRaw("{$selling} >= ".sprintf('%.2F', (float) $v['min_price'])); // numeric literal: PDO binds floats as text
        }
        if (isset($v['max_price'])) {
            $q->where('price_on_request', false)->whereRaw("{$selling} <= ".sprintf('%.2F', (float) $v['max_price']));
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
        match ($v['pricing'] ?? null) {
            'on_request' => $q->where('price_on_request', true),
            'sale' => $q->where('price_on_request', false)->whereNotNull('sale_price')->whereColumn('sale_price', '<', 'regular_price'),
            'fixed' => $q->where('price_on_request', false)->where(fn ($w) => $w->whereNull('sale_price')->orWhereColumn('sale_price', '>=', 'regular_price')),
            default => null,
        };
        if (! empty($v['source'])) {
            $v['source'] === 'manual' ? $q->whereNull('source') : $q->where('source', $v['source']);
        }
        match ($v['sort'] ?? 'latest') {
            'oldest' => $q->oldest('id'),
            'name' => $q->orderBy('name'),
            'name_desc' => $q->orderByDesc('name'),
            'sku' => $q->orderBy('sku'),
            'price_asc' => $q->orderBy('price_on_request')->orderByRaw("{$selling} asc"),
            'price_desc' => $q->orderBy('price_on_request')->orderByRaw("{$selling} desc"),
            'status' => $q->orderByRaw("CASE availability_status WHEN 'sold_out' THEN 0 WHEN 'discontinued' THEN 1 ELSE 2 END")->orderBy('name'),
            'stock_asc' => $q->orderBy('track_stock', 'desc')->orderBy('stock_quantity'),
            'updated' => $q->latest('updated_at'),
            default => $q->latest('id'),
        };

        return ProductResource::collection($q->paginate($v['per_page'] ?? 20)->withQueryString());
    }

    /** The SKU a new product in this category would get (shown in the admin form before saving). */
    public function nextSku(Request $request)
    {
        $v = $request->validate(['category_id' => 'nullable|integer|exists:categories,id']);

        return ['data' => ['sku' => $this->skus->nextProductSku(! empty($v['category_id']) ? Category::find($v['category_id']) : null)]];
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
        $data['regular_price'] ??= 0; // price on request without a stored price

        $product = DB::transaction(function () use ($data, $variants, $request) {
            $product = Product::create($data);
            $this->syncVariants($product, $variants);
            $product->priceHistories()->create([
                'user_id' => $request->user()->id, 'price_type' => $product->price_on_request ? 'on_request' : 'regular', 'old_price' => null,
                'new_price' => $product->price_on_request ? null : $product->regular_price, 'change_source' => 'product_form',
                'note' => $product->price_on_request ? 'Product created (price on request)' : 'Product created',
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
            $hasRegular = array_key_exists('regular_price', $data) && $data['regular_price'] !== null;
            $hasSale = array_key_exists('sale_price', $data);
            $hasOnRequest = array_key_exists('price_on_request', $data);
            if ($hasRegular || $hasSale || $hasOnRequest) {
                $this->prices->updatePrices(
                    $product,
                    (float) ($hasRegular ? $data['regular_price'] : $product->regular_price),
                    $hasSale ? ($data['sale_price'] !== null ? (float) $data['sale_price'] : null) : ($product->sale_price !== null ? (float) $product->sale_price : null),
                    $request->user(),
                    'product_form',
                    null,
                    $hasOnRequest ? (bool) $data['price_on_request'] : null,
                );
            }
            unset($data['regular_price'], $data['sale_price'], $data['price_on_request']);
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

    /** Quick toggles: enabled / availability / featured / best seller / new arrival. */
    public function flags(Request $request, Product $product)
    {
        $data = $request->validate([
            'is_active' => 'sometimes|boolean',
            'availability_status' => ['sometimes', Rule::in(Product::STATUSES)],
            'is_featured' => 'sometimes|boolean',
            'is_best_seller' => 'sometimes|boolean',
            'is_new_arrival' => 'sometimes|boolean',
        ]);
        $product->update($data);

        return $this->show($product);
    }

    /**
     * Bulk actions on selected products. Prices are bulk-updated through
     * PriceManagementService (POST /admin/prices/bulk/apply with scope=products) so every
     * change is validated and logged in the price history.
     */
    public function bulk(Request $request)
    {
        $v = $request->validate([
            'ids' => 'required|array|min:1|max:1000',
            'ids.*' => 'integer',
            'action' => ['required', Rule::in(array_keys(self::BULK_ACTIONS))],
            'category_id' => 'required_if:action,assign_category|nullable|integer|exists:categories,id',
            'confirm' => 'accepted',
        ], ['confirm.accepted' => 'Please confirm the bulk action.']);

        $q = Product::whereIn('id', array_unique($v['ids']));
        $count = DB::transaction(function () use ($q, $v) {
            if ($v['action'] === 'delete') {
                $n = 0;
                $q->get()->each(function (Product $p) use (&$n) {
                    $p->delete();
                    $n++;
                });

                return $n;
            }
            $changes = $v['action'] === 'assign_category'
                ? ['category_id' => $v['category_id']]
                : self::BULK_ACTIONS[$v['action']];

            return $q->update($changes + ['updated_at' => now()]);
        });

        return ['data' => ['updated' => $count], 'message' => "{$count} product(s) updated."];
    }

    /** Bulk action => column changes. */
    private const BULK_ACTIONS = [
        'enable' => ['is_active' => true],
        'disable' => ['is_active' => false],
        'mark_available' => ['availability_status' => Product::STATUS_AVAILABLE],
        'mark_sold_out' => ['availability_status' => Product::STATUS_SOLD_OUT],
        'mark_discontinued' => ['availability_status' => Product::STATUS_DISCONTINUED],
        'feature' => ['is_featured' => true],
        'unfeature' => ['is_featured' => false],
        'best_seller' => ['is_best_seller' => true],
        'unbest_seller' => ['is_best_seller' => false],
        'new_arrival' => ['is_new_arrival' => true],
        'unnew_arrival' => ['is_new_arrival' => false],
        'assign_category' => [],
        'delete' => [],
    ];

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
        $onRequest = $request->boolean('price_on_request');
        $data = $request->validate([
            'price_on_request' => 'sometimes|boolean',
            'regular_price' => [$onRequest ? 'nullable' : 'required', 'numeric', 'min:0.01', 'max:10000000'],
            'sale_price' => 'nullable|numeric|min:0.01|lt:regular_price',
            'note' => 'nullable|string|max:255',
        ]);
        $this->prices->updatePrices($product, (float) ($data['regular_price'] ?? $product->regular_price),
            isset($data['sale_price']) ? (float) $data['sale_price'] : null, $request->user(), 'manual', $data['note'] ?? null,
            $request->has('price_on_request') ? $onRequest : null);

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
            'images.*' => $this->imageRules(),
            'colour' => 'nullable|string|max:60',
        ], $this->imageMessages());
        $colour = $this->productColour($product, $request->input('colour'));

        $hasPrimary = $product->images()->where('is_primary', true)->exists();
        $order = (int) $product->images()->max('sort_order');

        foreach ($request->file('images') as $i => $file) {
            [$path, $disk] = Media::store($file, "products/{$product->id}");
            $product->images()->create([
                'path' => $path, 'disk' => $disk, 'alt_text' => $colour ? "{$product->name} – {$colour}" : $product->name, 'colour' => $colour,
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

    /** Alt text and the colour this image shows (one of the product's colours, or none). */
    public function updateImage(Request $request, ProductImage $image)
    {
        $data = $request->validate(['alt_text' => 'sometimes|nullable|string|max:255', 'colour' => 'sometimes|nullable|string|max:60']);
        if (array_key_exists('colour', $data)) {
            $data['colour'] = $this->productColour($image->product, $data['colour']);
        }
        $image->update($data);

        return $this->show($image->product);
    }

    /** Swap the file of an image, keeping its position, primary flag, colour and alt text. */
    public function replaceImage(Request $request, ProductImage $image)
    {
        $request->validate(['image' => ['required', ...$this->imageRules()]], $this->imageMessages('image'));

        [$path, $disk] = Media::store($request->file('image'), "products/{$image->product_id}");
        [$oldPath, $oldDisk] = [$image->path, $image->disk];
        $image->update(['path' => $path, 'disk' => $disk]);
        Media::delete($oldPath, $oldDisk); // uploaded files only; storefront photos are never deleted from here
        $image->product->touch();

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

    /** JPG / PNG / WEBP, up to shop.image_max_kb, at least shop.image_min_px on each side. */
    private function imageRules(): array
    {
        $min = (int) config('shop.image_min_px', 300);

        return ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp',
            'max:'.(int) config('shop.image_max_kb', 8192), "dimensions:min_width={$min},min_height={$min}"];
    }

    private function imageMessages(string $field = 'images.*'): array
    {
        $mb = round(config('shop.image_max_kb', 8192) / 1024, 1);
        $min = (int) config('shop.image_min_px', 300);

        return [
            "{$field}.mimes" => 'Only JPG, PNG or WEBP images can be uploaded.',
            "{$field}.mimetypes" => 'Only JPG, PNG or WEBP images can be uploaded.',
            "{$field}.image" => 'This file is not an image.',
            "{$field}.max" => "Each image must be {$mb} MB or smaller.",
            "{$field}.dimensions" => "Images must be at least {$min} × {$min} pixels.",
            "{$field}.uploaded" => "The image could not be uploaded – it may be larger than the server allows ({$mb} MB).",
        ];
    }

    /** The product's own spelling of a colour, or 422 when the product does not have it. */
    private function productColour(Product $product, ?string $colour): ?string
    {
        $colour = trim((string) $colour);
        if ($colour === '') {
            return null;
        }
        $match = collect($product->colours ?? [])->first(fn ($c) => strcasecmp($c, $colour) === 0);
        if (! $match) {
            abort(response()->json(['message' => "Add \"{$colour}\" to the product's colours first.", 'errors' => ['colour' => ["Add \"{$colour}\" to the product's colours first."]]], 422));
        }

        return $match;
    }

    private function validated(Request $request, ?Product $product = null): array
    {
        $req = $product ? 'sometimes|required' : 'required';

        $data = $request->validate([
            'name' => "{$req}|string|max:200",
            'slug' => ['nullable', 'string', 'max:220', 'alpha_dash', Rule::unique('products', 'slug')->ignore($product?->id)],
            // Optional when creating: an empty SKU is generated as OMR-<CATEGORY>-<NUMBER>.
            'sku' => [$product ? 'sometimes' : 'nullable', ...($product ? ['required'] : []), 'string', 'max:64', 'regex:/^[A-Za-z0-9\-_]+$/', Rule::unique('products', 'sku')->ignore($product?->id)],
            'category_id' => 'nullable|integer|exists:categories,id',
            'short_description' => 'nullable|string|max:500',
            'description' => 'nullable|string|max:20000',
            'price_on_request' => 'sometimes|boolean',
            // Not required for "price on request" products (checked below).
            'regular_price' => 'sometimes|nullable|numeric|min:0|max:10000000',
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
            'sizes_enabled' => 'sometimes|boolean',
            'availability_status' => ['sometimes', Rule::in(Product::STATUSES)],
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
            'variants.*.sku' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9\-_]+$/'],
            'variants.*.additional_price' => 'nullable|numeric|min:-1000000|max:1000000',
            'variants.*.stock_quantity' => 'nullable|integer|min:0|max:1000000',
            'variants.*.is_active' => 'nullable|boolean',
        ], ['sku.regex' => 'SKU may only contain letters, numbers, dashes and underscores.', 'variants.*.sku.regex' => 'Variant SKU may only contain letters, numbers, dashes and underscores.']);

        if (! empty($data['sku']) && ProductVariant::where('sku', $data['sku'])->when($product, fn ($q) => $q->where('product_id', '!=', $product->id))->exists()) {
            abort(response()->json(['message' => 'This SKU is already used by a product variant.', 'errors' => ['sku' => ['This SKU is already used by a product variant.']]], 422));
        }
        $this->checkVariantSkus($data['variants'] ?? [], $product, $data['sku'] ?? null);

        $onRequest = (bool) ($data['price_on_request'] ?? $product?->price_on_request ?? false);
        $regular = $data['regular_price'] ?? $product?->regular_price;
        if (! $onRequest && (float) $regular < 0.01) {
            $msg = 'Enter the regular price, or choose "Price on request".';
            abort(response()->json(['message' => $msg, 'errors' => ['regular_price' => [$msg]]], 422));
        }
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

    /** Entered variant SKUs must be unique: within the form, and against every other product and variant. */
    private function checkVariantSkus(array $variants, ?Product $product, ?string $productSku): void
    {
        $seen = [];
        foreach ($variants as $i => $row) {
            $sku = trim((string) ($row['sku'] ?? ''));
            if ($sku === '') {
                continue;
            }
            $key = strtolower($sku);
            $ownVariant = ! empty($row['id']) && $product ? $product->variants()->whereKey($row['id'])->value('id') : null;
            $clash = isset($seen[$key]) || ($productSku !== null && strcasecmp($sku, $productSku) === 0)
                || $this->skus->isTaken($sku, ignoreProductId: null, ignoreVariantId: $ownVariant);
            if ($clash) {
                $msg = "SKU {$sku} is already in use. Leave it empty to generate one.";
                abort(response()->json(['message' => $msg, 'errors' => ["variants.{$i}.sku" => [$msg]]], 422));
            }
            $seen[$key] = true;
        }
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
            $sizes = $active->pluck('size')->filter()->unique()->values()->all();
            $product->forceFill([
                'colours' => $active->pluck('colour')->filter()->unique()->values()->all(),
                'sizes' => $sizes,
                // Variant sizes are part of the variant, so size selection must stay on.
                'sizes_enabled' => $sizes ? true : $product->sizes_enabled,
            ])->saveQuietly();
            $product->syncStockFromVariants();
        }
    }
}
