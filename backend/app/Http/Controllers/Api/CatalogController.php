<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BannerResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Models\Banner;
use App\Models\Category;
use App\Models\Product;
use App\Services\PricingService;
use App\Services\SettingsService;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    public function __construct(private PricingService $pricing) {}

    public function settings(SettingsService $settings)
    {
        return ['data' => $settings->publicSettings()];
    }

    public function home(Request $request)
    {
        $cards = fn ($q, int $n = 8) => ProductResource::collection(
            $this->baseQuery()->where($q)->latest('products.id')->limit($n)->get()
        );

        $offerProducts = $this->baseQuery()
            ->whereRaw($this->pricing->effectivePriceSql().' < products.regular_price')
            ->latest('products.id')->limit(8)->get();

        return ['data' => [
            'banners' => BannerResource::collection(Banner::where('is_active', true)->orderBy('sort_order')->get()),
            'categories' => CategoryResource::collection(Category::active()->ordered()->withCount(['products' => fn ($q) => $q->where('is_active', true)])->get()),
            'featured' => $cards(fn ($q) => $q->where('is_featured', true)),
            'new_arrivals' => $cards(fn ($q) => $q->where('is_new_arrival', true)),
            'best_sellers' => $cards(fn ($q) => $q->where('is_best_seller', true)),
            'special_offers' => ProductResource::collection($offerProducts),
        ]];
    }

    public function categories()
    {
        return CategoryResource::collection(
            Category::active()->ordered()->withCount(['products' => fn ($q) => $q->where('is_active', true)])->get()
        );
    }

    public function category(string $slug)
    {
        return new CategoryResource(Category::active()->where('slug', $slug)->firstOrFail());
    }

    public function products(Request $request)
    {
        $v = $request->validate([
            'category' => 'nullable|string|max:120',
            'search' => 'nullable|string|max:120',
            'min_price' => 'nullable|numeric|min:0',
            'max_price' => 'nullable|numeric|min:0',
            'availability' => 'nullable|in:in_stock,out_of_stock',
            'new' => 'nullable|boolean',
            'best_seller' => 'nullable|boolean',
            'featured' => 'nullable|boolean',
            'on_sale' => 'nullable|boolean',
            'sort' => 'nullable|in:latest,price_asc,price_desc,popular,name',
            'per_page' => 'nullable|integer|min:1|max:48',
        ]);

        $priceSql = $this->pricing->effectivePriceSql();
        $q = $this->baseQuery();

        if (! empty($v['category'])) {
            $q->whereHas('category', fn ($c) => $c->where('slug', $v['category']));
        }
        if (! empty($v['search'])) {
            $term = '%'.str_replace(['%', '_'], ['\%', '\_'], $v['search']).'%';
            $q->where(fn ($w) => $w->where('products.name', 'like', $term)
                ->orWhere('products.sku', 'like', $term)
                ->orWhere('products.short_description', 'like', $term)
                ->orWhere('products.material', 'like', $term)
                ->orWhereHas('category', fn ($c) => $c->where('name', 'like', $term)));
        }
        if (isset($v['min_price'])) {
            $q->whereRaw("{$priceSql} >= ".sprintf('%.2F', (float) $v['min_price'])); // numeric literal: PDO would bind floats as text
        }
        if (isset($v['max_price'])) {
            $q->whereRaw("{$priceSql} <= ".sprintf('%.2F', (float) $v['max_price']));
        }
        if (($v['availability'] ?? null) === 'in_stock') {
            $q->inStock();
        } elseif (($v['availability'] ?? null) === 'out_of_stock') {
            $q->outOfStock();
        }
        if ($request->boolean('new')) {
            $q->where('is_new_arrival', true);
        }
        if ($request->boolean('best_seller')) {
            $q->where('is_best_seller', true);
        }
        if ($request->boolean('featured')) {
            $q->where('is_featured', true);
        }
        if ($request->boolean('on_sale')) {
            $q->whereRaw("{$priceSql} < products.regular_price");
        }

        match ($v['sort'] ?? 'latest') {
            'price_asc' => $q->orderByRaw("{$priceSql} asc"),
            'price_desc' => $q->orderByRaw("{$priceSql} desc"),
            'popular' => $q->orderByDesc('is_best_seller')->orderByDesc('views_count'),
            'name' => $q->orderBy('products.name'),
            default => $q->latest('products.created_at'),
        };
        $q->orderByDesc('products.id');

        return ProductResource::collection($q->paginate($v['per_page'] ?? 12)->withQueryString())
            ->additional(['meta_extra' => $this->priceBounds()]);
    }

    public function product(string $slug)
    {
        $product = $this->baseQuery()->with(['images', 'activeVariants'])->where('slug', $slug)->firstOrFail();

        $related = $this->baseQuery()
            ->where('products.id', '!=', $product->id)
            ->when($product->category_id, fn ($q) => $q->where('category_id', $product->category_id))
            ->inRandomOrder()->limit(4)->get();

        return (new ProductResource($product))->detailed()->additional([
            'related' => ProductResource::collection($related),
        ]);
    }

    /** Fetch specific products (wishlist, recently viewed). */
    public function productsByIds(Request $request)
    {
        $v = $request->validate(['ids' => 'required|array|max:50', 'ids.*' => 'integer']);
        $order = array_flip($v['ids']);

        $items = $this->baseQuery()->whereIn('products.id', $v['ids'])->get()
            ->sortBy(fn ($p) => $order[$p->id] ?? 0)->values();

        return ProductResource::collection($items);
    }

    public function recordView(Product $product)
    {
        if ($product->is_active) {
            $product->increment('views_count');
        }

        return response()->noContent();
    }

    public function sitemap()
    {
        return ['data' => [
            'products' => Product::visible()->select('slug', 'updated_at')->get(),
            'categories' => Category::active()->select('slug', 'updated_at')->get(),
        ]];
    }

    private function baseQuery()
    {
        return Product::query()->visible()->with(['category', 'primaryImage', 'activeVariants']);
    }

    private function priceBounds(): array
    {
        $sql = $this->pricing->effectivePriceSql();
        $row = Product::visible()->selectRaw("MIN({$sql}) as min_price, MAX({$sql}) as max_price")->first();

        return ['min_price' => (float) ($row->min_price ?? 0), 'max_price' => (float) ($row->max_price ?? 0)];
    }
}
