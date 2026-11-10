<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Support\Media;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Imports the photographed catalogue (frontend/src/data/products.json) into the
 * products / product_images / categories tables so those products get prices,
 * colours, sizes, stock, cart and WhatsApp ordering like every other product.
 *
 * Safe to run repeatedly:
 * - products are matched on their catalogue code (catalog_code = "product-001"; older imports
 *   stored it as the SKU and are matched on that); existing ones are left alone unless $sync
 *   is true, and admin-owned data (prices, colours, sizes, stock, variants, uploaded images)
 *   is never overwritten;
 * - every product gets an OMR-<CATEGORY>-<NUMBER> SKU (SkuGenerator). A product whose SKU is
 *   still its catalogue code gets one on the next run; a SKU set in the admin is kept;
 * - an entry's "colours" ([{colour, images}]) become colour variants, each with its own SKU,
 *   and their photos are tagged with the colour – for new products, and for existing ones
 *   that have no colours or variants yet;
 * - slugs are kept exactly as in the JSON so product URLs do not change; a slug that
 *   already belongs to another product is reported instead of being renamed;
 * - images stay where they are (frontend/public/images) and are referenced with the
 *   "static" media disk.
 *
 * New products start as "price on request", without stock tracking (made to order),
 * so they stay orderable exactly as before until the admin sets prices.
 */
class PhotoCatalogueImporter
{
    public const SOURCE = Product::SOURCE_PHOTO_CATALOGUE;

    /** @var array<string, int> */
    private array $stats = [];

    /** @var list<string> */
    private array $messages = [];

    public function __construct(private SkuGenerator $skus) {}

    /**
     * @param  array<int, array<string, mixed>>  $entries  decoded products.json
     * @param  array<string, list<string>>  $defaultSizes  collection slug => sizes for newly created products
     * @return array{stats: array<string, int>, messages: list<string>}
     */
    public function import(array $entries, bool $sync = false, array $defaultSizes = [], bool $dryRun = false): array
    {
        $this->stats = ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'skipped' => 0, 'categories_created' => 0, 'images_added' => 0, 'skus_assigned' => 0];
        $this->messages = [];

        DB::beginTransaction();
        try {
            $categories = $this->categories($entries);
            $seen = [];
            foreach ($entries as $i => $entry) {
                $error = $this->invalid($entry, $seen);
                if ($error) {
                    $this->skip('#'.($i + 1).' '.($entry['id'] ?? '?').": {$error}");

                    continue;
                }
                $seen['id'][strtolower($entry['id'])] = true;
                $seen['slug'][$entry['slug']] = true;
                $this->importOne($entry, $categories[$entry['collection']] ?? null, $sync, $defaultSizes);
            }
            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return ['stats' => $this->stats, 'messages' => $this->messages];
    }

    /**
     * Remove everything the import created: imported products (with their images, variants
     * and price history) and imported categories that no longer hold other products.
     * The photo files themselves belong to the storefront and are not touched.
     *
     * @return array{products: int, categories: int}
     */
    public function rollback(): array
    {
        return DB::transaction(function () {
            $products = Product::withTrashed()->where('source', self::SOURCE)->with('images')->get();
            foreach ($products as $p) {
                foreach ($p->images as $img) {
                    Media::delete($img->path, $img->disk); // admin uploads only; static files are skipped
                }
                $p->forceDelete();
            }

            $categories = Category::withTrashed()->where('source', self::SOURCE)
                ->whereDoesntHave('products', fn ($q) => $q->withTrashed())->get();
            $categories->each->forceDelete();

            return ['products' => $products->count(), 'categories' => $categories->count()];
        });
    }

    /* --------------------------------------------------------------- helpers */

    /** @return array<string, ?Category> collection slug => category */
    private function categories(array $entries): array
    {
        $out = [];
        $order = (int) Category::max('sort_order');
        foreach ($entries as $e) {
            $slug = $e['collection'] ?? null;
            if (! is_string($slug) || $slug === '' || array_key_exists($slug, $out)) {
                continue;
            }
            $category = Category::withTrashed()->where('slug', $slug)->first();
            if ($category?->trashed()) {
                $this->messages[] = "Category \"{$slug}\" was deleted in the admin – its products are imported uncategorised.";
                $out[$slug] = null;

                continue;
            }
            if (! $category) {
                $category = Category::create([
                    'name' => trim((string) ($e['category'] ?? $slug)), 'slug' => $slug, 'section' => 'collections',
                    'is_active' => true, 'sort_order' => ++$order, 'source' => self::SOURCE,
                ]);
                $this->stats['categories_created']++;
            }
            $out[$slug] = $category;
        }

        return $out;
    }

    private function invalid(mixed $e, array $seen): ?string
    {
        if (! is_array($e)) {
            return 'not an object';
        }
        foreach (['id', 'slug', 'name', 'collection'] as $k) {
            if (! isset($e[$k]) || ! is_string($e[$k]) || trim($e[$k]) === '') {
                return "missing \"{$k}\"";
            }
        }
        if (! preg_match('/^[A-Za-z0-9\-_]{1,64}$/', $e['id'])) {
            return 'product code may only contain letters, numbers, - and _';
        }
        if (! preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $e['slug']) || strlen($e['slug']) > 220) {
            return "invalid slug \"{$e['slug']}\"";
        }
        if (isset($seen['id'][strtolower($e['id'])]) || isset($seen['slug'][$e['slug']])) {
            return 'duplicate product code or slug in the file';
        }
        foreach ($e['images'] ?? [] as $src) {
            if (! is_string($src) || ! preg_match('#^/images/[^\s?\#]+$#', $src) || str_contains($src, '..')) {
                return 'image paths must be under /images/';
            }
        }
        $names = [];
        foreach ($e['colours'] ?? [] as $c) {
            if (! is_array($c) || ! is_string($c['colour'] ?? null) || trim($c['colour']) === '' || mb_strlen($c['colour']) > 60) {
                return 'each colour needs a "colour" name (max 60 characters)';
            }
            if (isset($names[strtolower(trim($c['colour']))])) {
                return "colour \"{$c['colour']}\" is listed twice";
            }
            $names[strtolower(trim($c['colour']))] = true;
            if (array_diff((array) ($c['images'] ?? []), (array) ($e['images'] ?? []))) {
                return "colour \"{$c['colour']}\" uses an image that is not in the product's images";
            }
        }

        return null;
    }

    private function importOne(array $e, ?Category $category, bool $sync, array $defaultSizes): void
    {
        $code = $e['id'];
        $product = Product::withTrashed()->where('catalog_code', $code)->first()
            ?? Product::withTrashed()->whereNull('catalog_code')->where('sku', $code)->first(); // imported before catalogue codes

        if ($product?->trashed()) {
            $this->skip("{$code}: deleted in the admin – not restored.");

            return;
        }
        if ($product && $product->source !== self::SOURCE) {
            $this->skip("{$code}: product code already used by product #{$product->id} \"{$product->name}\" – left untouched.");

            return;
        }

        $slugOwner = Product::withTrashed()->where('slug', $e['slug'])->when($product, fn ($q) => $q->whereKeyNot($product->id))->first();

        if (! $product) {
            if ($slugOwner) {
                $this->skip("{$code}: slug \"{$e['slug']}\" already used by product #{$slugOwner->id} – rename one of them, then re-run.");

                return;
            }
            $this->create($e, $category, $defaultSizes);

            return;
        }

        $product->catalog_code ??= $code;
        $changed = $this->assignSku($product, $category);

        if (! $sync) {
            if ($product->isDirty()) {
                $product->save();
            }
            $this->stats[$changed ? 'updated' : 'unchanged']++;

            return;
        }

        // --sync: refresh catalogue-owned fields only.
        $product->fill([
            'name' => trim($e['name']),
            'category_id' => $category?->id,
            'is_new_arrival' => (bool) ($e['isNewArrival'] ?? false),
        ]);
        if (! $slugOwner) {
            $product->slug = $e['slug'];
        } elseif ($product->slug !== $e['slug']) {
            $this->messages[] = "{$code}: slug \"{$e['slug']}\" is used by product #{$slugOwner->id} – kept \"{$product->slug}\".";
        }
        $added = $this->addImages($product, $e);
        $added += $this->applyColours($product, $e);
        if ($product->isDirty() || $added || $changed) {
            $product->save();
            $this->stats['updated']++;
        } else {
            $this->stats['unchanged']++;
        }
    }

    private function create(array $e, ?Category $category, array $defaultSizes): void
    {
        $product = new Product([
            'category_id' => $category?->id,
            'name' => trim($e['name']),
            'slug' => $e['slug'],
            'sku' => $this->skus->nextProductSku($category), // OMR-<CATEGORY>-<NUMBER>
            'catalog_code' => $e['id'],
            'regular_price' => 0,
            'sale_price' => null,
            'price_on_request' => true,
            'currency' => config('shop.default_currency', 'INR'),
            'track_stock' => false, // handmade / made to order until the admin manages stock
            'stock_quantity' => 0,
            'colours' => [],
            'sizes' => array_values($defaultSizes[$e['collection']] ?? []),
            'is_new_arrival' => (bool) ($e['isNewArrival'] ?? false),
            'is_active' => true,
            'source' => self::SOURCE,
        ]);
        // Keep "Latest" ordering as on the photo catalogue: newest photo first.
        if (! empty($e['photographedAt']) && ($at = $this->date($e['photographedAt']))) {
            $product->created_at = $at;
        }
        $product->save();
        $this->stats['skus_assigned']++;
        $this->addImages($product, $e);
        $this->applyColours($product, $e);
        $product->priceHistories()->create([
            'price_type' => 'on_request', 'old_price' => null, 'new_price' => null,
            'change_source' => 'import', 'note' => 'Imported from photo catalogue (price on request)',
        ]);
        $this->stats['created']++;
    }

    /** Add catalogue images the product does not have yet. Never removes images. */
    private function addImages(Product $product, array $e): int
    {
        $existing = $product->images()->pluck('path')->all();
        $hasPrimary = $product->images()->where('is_primary', true)->exists();
        $order = (int) $product->images()->max('sort_order');
        $added = 0;

        $colourOf = $this->colourByImage($e);
        foreach (array_values($e['images'] ?? []) as $i => $src) {
            if (in_array($src, $existing, true)) {
                continue;
            }
            ProductImage::create([
                'product_id' => $product->id, 'path' => $src, 'disk' => Media::STATIC_DISK,
                'alt_text' => isset($colourOf[$src]) ? trim($e['name']).' – '.$colourOf[$src] : ($i === 0 ? trim($e['name']) : trim($e['name']).' – view '.($i + 1)),
                'is_primary' => ! $hasPrimary && $added === 0, 'sort_order' => ++$order,
            ]);
            $added++;
        }
        $this->stats['images_added'] += $added;

        return $added;
    }

    /**
     * Give a product its OMR SKU when it still carries its catalogue code as the SKU (imports
     * made before SKUs existed). A SKU set in the admin is never changed.
     */
    private function assignSku(Product $product, ?Category $category): bool
    {
        if (strcasecmp((string) $product->sku, (string) $product->catalog_code) !== 0) {
            return false;
        }
        $product->sku = $this->skus->nextProductSku($category);
        $this->stats['skus_assigned']++;

        return true;
    }

    /** @return array<string, string> image path => colour */
    private function colourByImage(array $e): array
    {
        $out = [];
        foreach ($e['colours'] ?? [] as $c) {
            foreach ((array) ($c['images'] ?? []) as $src) {
                $out[$src] ??= trim($c['colour']);
            }
        }

        return $out;
    }

    /**
     * Colour options from the catalogue: tag untagged photos with their colour and, when the
     * product has no colours or variants yet (i.e. nothing set in the admin), create one
     * colour variant per colour – each gets its own SKU, e.g. OMR-BR-004-SKYBLU.
     * Returns the number of changes.
     */
    private function applyColours(Product $product, array $e): int
    {
        $colours = array_values(array_map(fn ($c) => trim($c['colour']), $e['colours'] ?? []));
        if (! $colours) {
            return 0;
        }
        $changes = 0;
        $useColours = empty($product->colours) && ! $product->variants()->exists();
        if ($useColours) {
            $product->forceFill(['colours' => $colours])->saveQuietly();
            // One variant per colour (× size, when the product also has sizes – e.g. bangles).
            foreach ($colours as $colour) {
                foreach ($product->selectableSizes() ?: [null] as $size) {
                    ProductVariant::create(['product_id' => $product->id, 'colour' => $colour, 'size' => $size, 'stock_quantity' => 0, 'is_active' => true]);
                    $changes++;
                }
            }
        }
        $known = collect($product->colours ?? []);
        foreach ($this->colourByImage($e) as $src => $colour) {
            $canonical = $known->first(fn ($c) => strcasecmp($c, $colour) === 0);
            if ($canonical) {
                $changes += ProductImage::where('product_id', $product->id)->where('path', $src)->whereNull('colour')->update(['colour' => $canonical]);
            }
        }

        return $changes;
    }

    private function date(string $value): ?Carbon
    {
        try {
            return Carbon::parse($value, config('app.timezone'));
        } catch (\Throwable) {
            return null;
        }
    }

    private function skip(string $message): void
    {
        $this->stats['skipped']++;
        $this->messages[] = $message;
    }
}
