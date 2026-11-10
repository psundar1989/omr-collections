<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Services\PhotoCatalogueImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin product management: CRUD, images, prices, colours, sizes, availability status,
 * enable/disable, bulk actions, and how each of these is enforced on the public API.
 */
class ProductManagementTest extends TestCase
{
    use RefreshDatabase;

    private Category $bangles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bangles = Category::create(['name' => 'Bangles', 'slug' => 'bangles', 'section' => 'collections']);
    }

    private function product(array $attrs = []): Product
    {
        static $n = 0;
        $n++;

        return Product::create($attrs + [
            'category_id' => $this->bangles->id, 'name' => "Silk Thread Bangle {$n}", 'slug' => "silk-thread-bangle-{$n}",
            'sku' => "product-9{$n}", 'regular_price' => 350, 'track_stock' => false,
        ]);
    }

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.in', 'password' => 'secret123', 'is_admin' => true]);
        Sanctum::actingAs($u);

        return $u;
    }

    private function quote(array $item): array
    {
        return $this->postJson('/api/cart/quote', ['items' => [$item + ['quantity' => 1]]])->assertOk()->json('data');
    }

    /* ----------------------------------------------------------------- CRUD */

    public function test_admin_adds_edits_and_deletes_a_product(): void
    {
        $this->admin();

        $id = $this->postJson('/api/admin/products', [
            'name' => 'Silk Thread Bangle', 'sku' => 'product-500', 'category_id' => $this->bangles->id,
            'description' => 'Hand-wrapped.', 'regular_price' => 450, 'track_stock' => false,
            'colours' => ['Red', 'Pink', 'Yellow', 'Olive Green', 'Aqua Blue'], 'sizes' => ['2.2', '2.4', '2.6', '2.8', '10'],
            'availability_status' => 'available', 'is_active' => true, 'is_new_arrival' => true,
        ])->assertCreated()
            ->assertJsonPath('data.slug', 'silk-thread-bangle')
            ->assertJsonPath('data.availability_status', 'available')
            ->assertJsonPath('data.sizes_enabled', true)
            ->assertJsonPath('data.colours.4', 'Aqua Blue')
            ->json('data.id');

        $this->putJson("/api/admin/products/{$id}", ['name' => 'Silk Thread Bangle Set', 'sku' => 'product-501', 'description' => 'Updated'])
            ->assertOk()->assertJsonPath('data.name', 'Silk Thread Bangle Set')->assertJsonPath('data.sku', 'product-501')
            ->assertJsonPath('data.slug', 'silk-thread-bangle'); // slug is kept – URLs do not change

        $this->getJson('/api/products/silk-thread-bangle')->assertOk()->assertJsonPath('data.sku', 'product-501');

        $this->deleteJson("/api/admin/products/{$id}")->assertNoContent();
        $this->getJson('/api/products/silk-thread-bangle')->assertNotFound();
        $this->assertSoftDeleted('products', ['id' => $id]);
    }

    public function test_admin_uploads_replaces_and_deletes_images(): void
    {
        Storage::fake('public');
        $this->admin();
        $p = $this->product();

        $images = $this->post("/api/admin/products/{$p->id}/images", ['images' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')]], ['Accept' => 'application/json'])
            ->assertOk()->json('data.images');
        $this->assertCount(2, $images);
        $this->assertTrue($images[0]['is_primary']);

        // Replace the primary image: make the second one primary, delete the first.
        $this->postJson("/api/admin/product-images/{$images[1]['id']}/primary")->assertOk()->assertJsonPath('data.images.0.id', $images[1]['id']);
        $this->deleteJson("/api/admin/product-images/{$images[0]['id']}")->assertOk()->assertJsonCount(1, 'data.images');
    }

    /* --------------------------------------------------------------- prices */

    public function test_regular_sale_and_on_request_prices(): void
    {
        $this->admin();
        $p = $this->product();

        $this->patchJson("/api/admin/products/{$p->id}/price", ['regular_price' => 500])->assertOk();
        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.price', 500)->assertJsonPath('data.original_price', null);

        $this->patchJson("/api/admin/products/{$p->id}/price", ['regular_price' => 500, 'sale_price' => 400])->assertOk();
        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.price', 400)->assertJsonPath('data.original_price', 500)
            ->assertJsonPath('data.discount_percentage', 20);

        $this->patchJson("/api/admin/products/{$p->id}/price", ['price_on_request' => true])->assertOk();
        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.price', null)->assertJsonPath('data.price_on_request', true);

        $this->assertSame(['on_request', 'regular', 'sale'], $p->priceHistories()->pluck('price_type')->unique()->sort()->values()->all());
    }

    /* ------------------------------------------------------ colours & sizes */

    public function test_colours_and_sizes_can_be_added_removed_and_size_selection_switched_off(): void
    {
        $this->admin();
        $p = $this->product();

        $this->putJson("/api/admin/products/{$p->id}", ['colours' => ['Red', 'Pink'], 'sizes' => ['2.4', '2.6']])->assertOk();
        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.colours', ['Red', 'Pink'])->assertJsonPath('data.sizes', ['2.4', '2.6']);
        $this->assertSame('Please choose a size.', $this->quote(['product_id' => $p->id, 'colour' => 'Red'])['items'][0]['error']);

        // Remove a colour, add a size.
        $this->putJson("/api/admin/products/{$p->id}", ['colours' => ['Red'], 'sizes' => ['2.4', '2.6', '2.8']])->assertOk();
        $this->assertSame('Please choose a colour.', $this->quote(['product_id' => $p->id, 'colour' => 'Pink', 'size' => '2.4'])['items'][0]['error']);
        $this->assertTrue($this->quote(['product_id' => $p->id, 'colour' => 'Red', 'size' => '2.8'])['valid']);

        // Size selection off: sizes are kept for the admin but not asked of customers.
        $this->putJson("/api/admin/products/{$p->id}", ['sizes_enabled' => false])->assertOk()
            ->assertJsonPath('data.sizes', ['2.4', '2.6', '2.8'])->assertJsonPath('data.sizes_enabled', false);
        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.sizes', []);
        $q = $this->quote(['product_id' => $p->id, 'colour' => 'Red', 'size' => '9.9']);
        $this->assertTrue($q['valid']);
        $this->assertNull($q['items'][0]['size']);
    }

    public function test_size_presets_are_editable_in_settings(): void
    {
        $this->admin();
        $this->getJson('/api/admin/settings')->assertJsonPath('data.size_presets.0.sizes', ['2.2', '2.4', '2.6', '2.8', '10']);
        $this->putJson('/api/admin/settings', ['size_presets' => [['name' => 'Kids', 'sizes' => [' 1.8 ', '2.0', '2.0']]]])
            ->assertOk()->assertJsonPath('data.size_presets', [['name' => 'Kids', 'sizes' => ['1.8', '2.0']]]);
    }

    /* ------------------------------------------------- availability status */

    public function test_sold_out_products_stay_visible_but_cannot_be_ordered(): void
    {
        $this->admin();
        $p = $this->product();

        $this->patchJson("/api/admin/products/{$p->id}/flags", ['availability_status' => 'sold_out'])->assertOk()
            ->assertJsonPath('data.availability_status', 'sold_out')->assertJsonPath('data.is_orderable', false);

        $this->getJson('/api/products')->assertJsonCount(1, 'data')->assertJsonPath('data.0.availability_status', 'sold_out');
        $this->getJson("/api/products/{$p->slug}")->assertOk()->assertJsonPath('data.is_orderable', false);
        $this->getJson('/api/catalog')->assertJsonCount(1, 'data');

        $q = $this->quote(['product_id' => $p->id]);
        $this->assertFalse($q['valid']);
        $this->assertNull($q['whatsapp_url']); // no WhatsApp order link for a sold-out product
        $this->assertSame('This product is sold out.', $q['items'][0]['error']);

        $this->getJson('/api/products?availability=in_stock')->assertJsonCount(0, 'data');
        $this->getJson('/api/products?availability=out_of_stock')->assertJsonCount(1, 'data');

        $this->patchJson("/api/admin/products/{$p->id}/flags", ['availability_status' => 'available'])->assertOk();
        $this->assertTrue($this->quote(['product_id' => $p->id])['valid']);
    }

    public function test_discontinued_products_cannot_be_ordered_and_keep_their_data(): void
    {
        $this->admin();
        $p = $this->product(['colours' => ['Red']]);

        $this->putJson("/api/admin/products/{$p->id}", ['availability_status' => 'discontinued'])->assertOk();
        $this->assertSame('This product has been discontinued.', $this->quote(['product_id' => $p->id, 'colour' => 'Red'])['items'][0]['error']);
        $this->getJson("/api/admin/products/{$p->id}")->assertJsonPath('data.colours', ['Red'])->assertJsonPath('data.regular_price', 350);
    }

    public function test_made_to_order_products_without_stock_tracking_are_not_sold_out(): void
    {
        $p = $this->product(['track_stock' => false, 'stock_quantity' => 0]);
        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.availability_status', 'available')->assertJsonPath('data.is_orderable', true);
        $this->assertTrue($this->quote(['product_id' => $p->id])['valid']);
    }

    public function test_invalid_status_is_rejected(): void
    {
        $this->admin();
        $p = $this->product();
        $this->patchJson("/api/admin/products/{$p->id}/flags", ['availability_status' => 'gone'])->assertUnprocessable();
        $this->putJson("/api/admin/products/{$p->id}", ['availability_status' => 'gone'])->assertUnprocessable();
    }

    /* ------------------------------------------------------ enable/disable */

    public function test_disabled_products_are_hidden_everywhere_public_but_kept_in_admin(): void
    {
        $this->admin();
        $p = $this->product(['name' => 'Ruby Bangle']);
        $this->product(['name' => 'Other Bangle']);

        $this->patchJson("/api/admin/products/{$p->id}/flags", ['is_active' => false])->assertOk();

        $this->getJson('/api/products')->assertJsonCount(1, 'data');
        $this->getJson('/api/products?search=Ruby')->assertJsonCount(0, 'data');
        $this->getJson('/api/products?category=bangles')->assertJsonCount(1, 'data');
        $this->getJson('/api/catalog')->assertJsonCount(1, 'data');
        $this->getJson("/api/products/{$p->slug}")->assertNotFound();
        $this->getJson("/api/products/by-ids?ids[]={$p->id}")->assertJsonCount(0, 'data');
        $this->getJson("/api/products/by-ids?skus[]={$p->sku}")->assertJsonCount(0, 'data');
        $this->assertNotContains($p->slug, collect($this->getJson('/api/sitemap')->json('data.products'))->pluck('slug'));
        $this->assertSame('This product is no longer available.', $this->quote(['product_id' => $p->id])['items'][0]['error']);

        $this->getJson("/api/admin/products/{$p->id}")->assertOk()->assertJsonPath('data.is_active', false);
        $this->getJson('/api/admin/products?status=disabled')->assertJsonCount(1, 'data');

        // Re-enabled: visible again, and its availability status was never touched.
        $this->patchJson("/api/admin/products/{$p->id}/flags", ['is_active' => true])->assertOk()->assertJsonPath('data.availability_status', 'available');
        $this->getJson("/api/products/{$p->slug}")->assertOk();
    }

    public function test_enabled_and_sold_out_are_independent(): void
    {
        $this->admin();
        $p = $this->product();
        $this->patchJson("/api/admin/products/{$p->id}/flags", ['availability_status' => 'sold_out'])->assertOk();
        $this->patchJson("/api/admin/products/{$p->id}/flags", ['is_active' => false])->assertOk();
        $this->patchJson("/api/admin/products/{$p->id}/flags", ['is_active' => true])->assertOk()
            ->assertJsonPath('data.availability_status', 'sold_out')->assertJsonPath('data.is_active', true);
    }

    /* ------------------------------------------------------------- listing */

    public function test_admin_listing_filters_search_and_sorting(): void
    {
        $this->admin();
        $charms = Category::create(['name' => 'Charms', 'slug' => 'charms', 'section' => 'charms']);
        $a = $this->product(['name' => 'Alpha Bangle', 'sku' => 'product-701', 'regular_price' => 100]);
        $this->product(['name' => 'Beta Bangle', 'sku' => 'product-702', 'regular_price' => 300, 'sale_price' => 250, 'availability_status' => 'sold_out']);
        $this->product(['name' => 'Gamma Charm', 'sku' => 'product-703', 'category_id' => $charms->id, 'is_active' => false, 'price_on_request' => true]);

        $this->getJson('/api/admin/products?search=product-701')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $a->id);
        $this->getJson('/api/admin/products?search=Beta')->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/products?availability=sold_out')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Beta Bangle');
        $this->getJson('/api/admin/products?status=enabled')->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/products?section=charms')->assertJsonCount(1, 'data');
        $this->getJson("/api/admin/products?category_id={$this->bangles->id}")->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/products?min_price=200&max_price=260')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Beta Bangle');
        $this->getJson('/api/admin/products?sort=name_desc')->assertJsonPath('data.0.name', 'Gamma Charm');
        $this->getJson('/api/admin/products?sort=price_asc')->assertJsonPath('data.0.name', 'Alpha Bangle');
        $this->getJson('/api/admin/products?sort=status')->assertJsonPath('data.0.name', 'Beta Bangle');
        $this->getJson('/api/admin/products?per_page=2')->assertJsonCount(2, 'data')->assertJsonPath('meta.last_page', 2);
    }

    /* ---------------------------------------------------------------- bulk */

    public function test_bulk_enable_disable_status_category_and_flags(): void
    {
        $this->admin();
        $ids = [$this->product()->id, $this->product()->id];
        $untouched = $this->product();
        $charms = Category::create(['name' => 'Charms', 'slug' => 'charms']);

        $this->postJson('/api/admin/products/bulk', ['ids' => $ids, 'action' => 'disable'])->assertUnprocessable(); // needs confirmation

        $bulk = fn (array $body) => $this->postJson('/api/admin/products/bulk', $body + ['ids' => $ids, 'confirm' => true])->assertOk();

        $bulk(['action' => 'disable'])->assertJsonPath('data.updated', 2);
        $this->assertSame(2, Product::where('is_active', false)->count());
        $bulk(['action' => 'enable']);
        $this->assertSame(0, Product::where('is_active', false)->count());

        $bulk(['action' => 'mark_sold_out']);
        $this->assertSame(2, Product::availability('sold_out')->count());
        $bulk(['action' => 'mark_available']);
        $this->assertSame(3, Product::availability('available')->count());

        $bulk(['action' => 'assign_category', 'category_id' => $charms->id]);
        $this->assertSame(2, Product::where('category_id', $charms->id)->count());
        $bulk(['action' => 'feature']);
        $this->assertSame(2, Product::where('is_featured', true)->count());

        $this->postJson('/api/admin/products/bulk', ['ids' => $ids, 'action' => 'assign_category', 'confirm' => true])->assertUnprocessable();
        $this->assertSame($this->bangles->id, $untouched->fresh()->category_id);
    }

    public function test_bulk_price_update_for_selected_products(): void
    {
        $this->admin();
        $a = $this->product(['regular_price' => 100]);
        $b = $this->product(['regular_price' => 200]);
        $c = $this->product(['regular_price' => 300]);

        $this->postJson('/api/admin/prices/bulk/apply', [
            'scope' => 'products', 'product_ids' => [$a->id, $b->id], 'target' => 'regular',
            'operation' => 'increase_percent', 'value' => 10, 'confirm' => true,
        ])->assertOk()->assertJsonPath('data.updated', 2);

        $this->assertEquals(110, $a->fresh()->regular_price);
        $this->assertEquals(220, $b->fresh()->regular_price);
        $this->assertEquals(300, $c->fresh()->regular_price);
    }

    public function test_bulk_actions_require_admin(): void
    {
        $p = $this->product();
        $this->postJson('/api/admin/products/bulk', ['ids' => [$p->id], 'action' => 'disable', 'confirm' => true])->assertUnauthorized();
        $u = User::create(['name' => 'Customer', 'email' => 'c@example.in', 'password' => 'secret123', 'is_admin' => false]);
        Sanctum::actingAs($u);
        $this->postJson('/api/admin/products/bulk', ['ids' => [$p->id], 'action' => 'disable', 'confirm' => true])->assertForbidden();
        $this->assertTrue($p->fresh()->is_active);
    }

    /* ------------------------------------------------------------ whatsapp */

    public function test_whatsapp_order_message_has_every_field(): void
    {
        $p = $this->product(['name' => 'Silk Thread Bangle', 'sku' => 'product-800', 'regular_price' => 450, 'colours' => ['Olive Green'], 'sizes' => ['2.4']]);
        $q = $this->postJson('/api/cart/quote', ['items' => [['product_id' => $p->id, 'colour' => 'olive green', 'size' => '2.4', 'quantity' => 2, 'price' => 1]]])->json('data');

        $this->assertTrue($q['valid']);
        foreach (['Product Name: Silk Thread Bangle', 'Product Code: product-800', 'Price: ₹450', 'Colour: Olive Green', 'Size: 2.4', 'Quantity: 2', 'Total Amount: ₹900'] as $line) {
            $this->assertStringContainsString($line, $q['message']);
        }
    }

    public function test_price_on_request_enquiry_only_when_available(): void
    {
        $p = $this->product(['price_on_request' => true]);
        $q = $this->quote(['product_id' => $p->id]);
        $this->assertTrue($q['valid']);
        $this->assertStringContainsString('Price: On Request', $q['message']);

        $p->update(['availability_status' => 'sold_out']);
        $this->assertFalse($this->quote(['product_id' => $p->id])['valid']);
    }

    /* -------------------------------------------------------------- import */

    public function test_full_photo_catalogue_imports_all_products_once(): void
    {
        $file = base_path('../frontend/src/data/products.json');
        if (! is_file($file)) {
            $this->markTestSkipped('frontend/src/data/products.json not found');
        }
        $entries = json_decode(file_get_contents($file), true);
        $importer = app(PhotoCatalogueImporter::class);

        $first = $importer->import($entries);
        $this->assertSame(count($entries), $first['stats']['created'], implode("\n", $first['messages']));
        $this->assertSame(0, $first['stats']['skipped']);
        $this->assertSame(count($entries), Product::where('source', Product::SOURCE_PHOTO_CATALOGUE)->count());

        $second = $importer->import($entries);
        $this->assertSame(0, $second['stats']['created']);
        $this->assertSame(count($entries), $second['stats']['unchanged']);
        $this->assertSame(count($entries), Product::count());

        // Every imported product keeps its code, slug, collection, new-arrival flag and photos.
        $byCode = Product::with(['category', 'images'])->get()->keyBy('sku');
        foreach ($entries as $e) {
            $p = $byCode[$e['id']];
            $this->assertSame($e['slug'], $p->slug);
            $this->assertSame($e['name'], $p->name);
            $this->assertSame($e['collection'], $p->category->slug);
            $this->assertSame((bool) $e['isNewArrival'], $p->is_new_arrival);
            $this->assertSame($e['images'], $p->images->pluck('path')->all());
            $this->assertSame('available', $p->availability_status);
            $this->assertTrue($p->is_active);
        }
    }
}
