<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\PhotoCatalogueImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * OMR SKUs (products, variants, chosen options), colour-tagged product photos, image
 * upload validation / replacement and the 2026-11-10 photo rename.
 */
class SkuAndColourImageTest extends TestCase
{
    use RefreshDatabase;

    private Category $bangles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bangles = Category::create(['name' => 'Bangles', 'slug' => 'bangles', 'section' => 'collections']);
    }

    private function admin(): void
    {
        Sanctum::actingAs(User::create(['name' => 'Admin', 'email' => 'admin@example.in', 'password' => 'secret123', 'is_admin' => true]));
    }

    private function createProduct(array $attrs = []): array
    {
        return $this->postJson('/api/admin/products', $attrs + [
            'name' => 'Kundan Bangle', 'category_id' => $this->bangles->id, 'regular_price' => 450, 'track_stock' => false,
        ])->assertCreated()->json('data');
    }

    /* ------------------------------------------------------------------ SKU */

    public function test_new_products_get_sequential_omr_skus_per_category(): void
    {
        $this->admin();
        $this->getJson("/api/admin/products/next-sku?category_id={$this->bangles->id}")->assertOk()->assertJsonPath('data.sku', 'OMR-BG-001');

        $this->assertSame('OMR-BG-001', $this->createProduct()['sku']);
        $second = $this->createProduct(['name' => 'Pearl Bangle']);
        $this->assertSame('OMR-BG-002', $second['sku']);

        // Numbers of deleted products are never reused.
        $this->deleteJson("/api/admin/products/{$second['id']}")->assertNoContent();
        $this->assertSame('OMR-BG-003', $this->createProduct(['name' => 'Gold Bangle'])['sku']);

        // A category without a code gets one from its name, stored for next time; no category = GN.
        $clips = Category::create(['name' => 'Hair Clips', 'slug' => 'hair-clips']);
        $this->assertSame('OMR-HC-001', $this->createProduct(['name' => 'Pearl Clip', 'category_id' => $clips->id])['sku']);
        $this->assertSame('HC', $clips->fresh()->sku_code);
        $this->assertSame('OMR-GN-001', $this->createProduct(['name' => 'Loose Piece', 'category_id' => null])['sku']);

        // An entered SKU is kept, and editing a product never regenerates it.
        $own = $this->createProduct(['name' => 'Custom', 'sku' => 'MY-SKU-1']);
        $this->assertSame('MY-SKU-1', $own['sku']);
        $this->putJson("/api/admin/products/{$own['id']}", ['name' => 'Custom 2', 'category_id' => $clips->id])->assertOk()->assertJsonPath('data.sku', 'MY-SKU-1');
    }

    public function test_variants_get_their_own_unique_skus(): void
    {
        $this->admin();
        $p = $this->createProduct(['variants' => [
            ['colour' => 'Red', 'size' => '2.4'], ['colour' => 'Sky Blue', 'size' => '2.6'], ['colour' => 'Blue', 'size' => null],
        ]]);
        $this->assertSame(['OMR-BG-001-24-RED', 'OMR-BG-001-26-SKYBLU', 'OMR-BG-001-BLU'], array_column($p['variants'], 'sku'));

        // Saving again keeps existing variant SKUs.
        $rows = array_map(fn ($v) => ['id' => $v['id'], 'colour' => $v['colour'], 'size' => $v['size'], 'sku' => $v['sku']], $p['variants']);
        $again = $this->putJson("/api/admin/products/{$p['id']}", ['variants' => $rows])->assertOk()->json('data.variants');
        $this->assertSame(array_column($p['variants'], 'sku'), array_column($again, 'sku'));

        // A SKU already used elsewhere is rejected, in the form and against the database.
        $other = $this->createProduct(['name' => 'Other']);
        $this->putJson("/api/admin/products/{$other['id']}", ['variants' => [['colour' => 'Red', 'sku' => 'OMR-BG-001-24-RED']]])
            ->assertStatus(422)->assertJsonValidationErrors('variants.0.sku');
        $this->putJson("/api/admin/products/{$other['id']}", ['variants' => [['colour' => 'Red', 'sku' => 'X-1'], ['colour' => 'Pink', 'sku' => 'x-1']]])
            ->assertStatus(422)->assertJsonValidationErrors('variants.1.sku');
        $this->putJson("/api/admin/products/{$other['id']}", ['sku' => 'OMR-BG-001-BLU'])->assertStatus(422)->assertJsonValidationErrors('sku');
        $this->putJson("/api/admin/products/{$other['id']}", ['sku' => 'OMR-BG-001'])->assertStatus(422)->assertJsonValidationErrors('sku');

        // Same colour+size on another product: still unique.
        $copy = $this->putJson("/api/admin/products/{$other['id']}", ['sku' => 'OMR-BG-001-24-RED-X', 'variants' => [['colour' => 'Red', 'size' => '2.4']]])->assertOk();
        $this->assertSame('OMR-BG-001-24-RED-X-24-RED', $copy->json('data.variants.0.sku'));
        $this->assertSame(ProductVariant::count(), ProductVariant::distinct()->count('sku'));
    }

    public function test_admin_search_finds_products_by_sku_variant_sku_and_catalogue_code(): void
    {
        $this->admin();
        $p = $this->createProduct(['variants' => [['colour' => 'Red', 'size' => '2.4']]]);
        Product::find($p['id'])->update(['catalog_code' => 'product-062']);
        $this->createProduct(['name' => 'Something else']);

        foreach (['OMR-BG-001', 'omr-bg-001-24', '24-RED', 'product-062'] as $term) {
            $this->getJson('/api/admin/products?search='.urlencode($term))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $p['id']);
        }
    }

    public function test_quote_whatsapp_message_and_order_carry_the_chosen_option_sku(): void
    {
        $p = Product::create(['category_id' => $this->bangles->id, 'name' => 'Silk Bangle', 'slug' => 'silk-bangle', 'regular_price' => 300,
            'track_stock' => false, 'colours' => ['Red', 'Sky Blue'], 'sizes' => ['2.4', '2.6']]);
        $this->assertSame('OMR-BG-001', $p->sku);

        $product = $this->getJson('/api/products/silk-bangle')->assertOk()->json('data');
        $this->assertContains(['colour' => 'Sky Blue', 'size' => '2.6', 'sku' => 'OMR-BG-001-26-SKYBLU'], $product['option_skus']);

        $order = $this->postJson('/api/orders', [
            'items' => [['product_id' => $p->id, 'colour' => 'Sky Blue', 'size' => '2.6', 'quantity' => 2]],
            'customer_name' => 'Priya', 'phone' => '9876543210', 'address' => '12 Main Road', 'city' => 'Chennai', 'pincode' => '600001',
        ])->assertCreated()->json('data');

        $this->assertStringContainsString("Product Name: Silk Bangle\n", $order['message']);
        foreach (['SKU: OMR-BG-001-26-SKYBLU', 'Colour: Sky Blue', 'Size: 2.6', 'Quantity: 2', 'Price: ₹300', 'Total Amount: ₹600'] as $line) {
            $this->assertStringContainsString($line, $order['message']);
        }
        $this->assertDatabaseHas('order_items', ['sku' => 'OMR-BG-001-26-SKYBLU', 'colour' => 'Sky Blue', 'size' => '2.6', 'quantity' => 2]);
    }

    /* --------------------------------------------------------------- images */

    public function test_photos_are_tagged_with_a_colour_and_the_chosen_colour_photo_is_ordered(): void
    {
        Storage::fake('public');
        $this->admin();
        $p = $this->createProduct(['colours' => ['Red', 'Blue']]);

        $img = fn (string $name) => UploadedFile::fake()->image($name, 800, 800);
        $images = $this->post("/api/admin/products/{$p['id']}/images", ['images' => [$img('main.jpg')]], ['Accept' => 'application/json'])->assertOk()->json('data.images');
        $blue = $this->post("/api/admin/products/{$p['id']}/images", ['images' => [$img('blue.jpg')], 'colour' => 'blue'], ['Accept' => 'application/json'])
            ->assertOk()->json('data.images.1');
        $this->assertSame('Blue', $blue['colour']); // the product's spelling
        $this->assertNull($images[0]['colour']);

        $this->patchJson("/api/admin/product-images/{$images[0]['id']}", ['colour' => 'Red'])->assertOk()->assertJsonPath('data.images.0.colour', 'Red');
        $this->patchJson("/api/admin/product-images/{$images[0]['id']}", ['colour' => 'Green'])->assertStatus(422)->assertJsonValidationErrors('colour');

        $this->getJson("/api/products/{$p['slug']}")->assertOk()->assertJsonPath('data.images.1.colour', 'Blue');
        $line = $this->postJson('/api/cart/quote', ['items' => [['product_id' => $p['id'], 'colour' => 'Blue', 'quantity' => 1]]])->assertOk()->json('data.items.0');
        $this->assertSame($blue['url'], $line['image_url']);
        $this->assertSame('OMR-BG-001-BLU', $line['sku']);
    }

    public function test_upload_validation_and_replacing_an_image_file(): void
    {
        Storage::fake('public');
        $this->admin();
        $p = $this->createProduct();
        $upload = fn (array $files) => $this->post("/api/admin/products/{$p['id']}/images", ['images' => $files], ['Accept' => 'application/json']);

        $upload([UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf')])->assertStatus(422)->assertJsonValidationErrors(['images.0' => 'Only JPG, PNG or WEBP images can be uploaded.']);
        $upload([UploadedFile::fake()->image('tiny.jpg', 120, 120)])->assertStatus(422)->assertJsonValidationErrors(['images.0' => 'Images must be at least 300 × 300 pixels.']);
        $upload([UploadedFile::fake()->image('huge.jpg', 800, 800)->size(9000)])->assertStatus(422)->assertJsonValidationErrors(['images.0' => 'Each image must be 8 MB or smaller.']);

        $first = $upload([UploadedFile::fake()->image('a.jpg', 800, 800), UploadedFile::fake()->image('b.png', 800, 800)])->assertOk()->json('data.images.0');
        $old = ProductImage::find($first['id']);
        Storage::disk('public')->assertExists($old->path);

        $after = $this->post("/api/admin/product-images/{$first['id']}/replace", ['image' => UploadedFile::fake()->image('new.webp', 800, 800)], ['Accept' => 'application/json'])
            ->assertOk()->json('data.images.0');
        $this->assertSame($first['id'], $after['id']);
        $this->assertTrue($after['is_primary']);
        $this->assertNotSame($first['url'], $after['url']);
        Storage::disk('public')->assertMissing($old->path);
        Storage::disk('public')->assertExists(ProductImage::find($first['id'])->path);
        $this->assertStringStartsWith("products/{$p['id']}/", ProductImage::find($first['id'])->path);

        // Replacing a storefront photo never deletes the storefront's file.
        $static = ProductImage::create(['product_id' => $p['id'], 'path' => '/images/bangles/x.jpg', 'disk' => 'static']);
        $this->post("/api/admin/product-images/{$static->id}/replace", ['image' => UploadedFile::fake()->image('y.jpg', 800, 800)], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame('public', $static->fresh()->disk);
    }

    /* ---------------------------------------------------- catalogue import */

    public function test_import_upgrades_placeholder_skus_and_adds_colour_variants_without_touching_admin_data(): void
    {
        // Imported before catalogue codes existed: the catalogue code was the SKU.
        $legacy = Product::create(['category_id' => $this->bangles->id, 'name' => 'Old', 'slug' => 'evil-eye-bead-bracelet', 'sku' => 'product-353',
            'regular_price' => 0, 'price_on_request' => true, 'track_stock' => false, 'source' => Product::SOURCE_PHOTO_CATALOGUE]);
        $edited = Product::create(['category_id' => $this->bangles->id, 'name' => 'Kept', 'slug' => 'kept', 'sku' => 'ADMIN-1', 'catalog_code' => 'product-354',
            'regular_price' => 10, 'track_stock' => false, 'source' => Product::SOURCE_PHOTO_CATALOGUE, 'colours' => ['Gold']]);

        $entries = [
            ['id' => 'product-353', 'slug' => 'evil-eye-bead-bracelet', 'name' => 'Evil Eye Bead Bracelet', 'collection' => 'bangles',
                'images' => ['/images/b/red.jpg', '/images/b/blue.jpg', '/images/b/blue-2.jpg'],
                'colours' => [['colour' => 'Red & White', 'images' => ['/images/b/red.jpg']], ['colour' => 'Blue', 'images' => ['/images/b/blue.jpg', '/images/b/blue-2.jpg']]]],
            ['id' => 'product-354', 'slug' => 'kept', 'name' => 'Kept', 'collection' => 'bangles', 'images' => ['/images/b/k.jpg'],
                'colours' => [['colour' => 'Silver', 'images' => ['/images/b/k.jpg']]]],
        ];
        $r = app(PhotoCatalogueImporter::class)->import($entries, sync: true);
        $this->assertSame(0, $r['stats']['skipped'], implode("\n", $r['messages']));

        $legacy->refresh();
        $this->assertSame('product-353', $legacy->catalog_code);
        $this->assertSame('OMR-BG-001', $legacy->sku);
        $this->assertSame(['Red & White', 'Blue'], $legacy->colours);
        $this->assertSame(['OMR-BG-001-REDWHI', 'OMR-BG-001-BLU'], $legacy->variants->pluck('sku')->all());
        $this->assertSame(['Red & White', 'Blue', 'Blue'], $legacy->images->pluck('colour')->all());
        $this->assertSame('Evil Eye Bead Bracelet – Blue', $legacy->images[1]->alt_text);

        // Admin-owned SKU and colours are left alone.
        $edited->refresh();
        $this->assertSame('ADMIN-1', $edited->sku);
        $this->assertSame(['Gold'], $edited->colours);
        $this->assertSame(0, $edited->variants()->count());

        $again = app(PhotoCatalogueImporter::class)->import($entries, sync: true);
        $this->assertSame(0, $again['stats']['skus_assigned']);
        $this->assertSame(2, ProductVariant::count());
    }

    public function test_renamed_photo_paths_are_remapped_in_products_and_past_orders(): void
    {
        $map = json_decode(file_get_contents(database_path('data/image-path-map-2026-11-10.json')), true);
        [$old, $new] = [array_key_first($map), $map[array_key_first($map)]];

        $p = Product::create(['name' => 'P', 'slug' => 'p', 'regular_price' => 1]);
        $img = ProductImage::create(['product_id' => $p->id, 'path' => $old, 'disk' => 'static']);
        $upload = ProductImage::create(['product_id' => $p->id, 'path' => $old, 'disk' => 'public']); // not a storefront photo
        $order = Order::create(['order_number' => 'ORD-1', 'customer_name' => 'A', 'phone' => '9876543210', 'whatsapp_number' => '9876543210',
            'address' => 'x', 'city' => 'Chennai', 'pincode' => '600001']);
        $relative = $order->items()->create(['product_name' => 'P', 'quantity' => 1, 'image_url' => $old]);
        $absolute = $order->items()->create(['product_name' => 'P', 'quantity' => 1, 'image_url' => 'https://shop.example'.$old]);

        $migration = require database_path('migrations/2026_11_10_110000_remap_renamed_product_image_paths.php');
        $migration->up();
        $migration->up(); // idempotent

        $this->assertSame($new, $img->fresh()->path);
        $this->assertSame($old, $upload->fresh()->path);
        $this->assertSame($new, $relative->fresh()->image_url);
        $this->assertSame('https://shop.example'.$new, $absolute->fresh()->image_url);
        $this->assertFileExists(base_path('../frontend/public'.$new));

        $migration->down();
        $this->assertSame($old, $img->fresh()->path);
    }

    public function test_category_sku_code_is_validated_and_unique(): void
    {
        $this->admin();
        $this->putJson("/api/admin/categories/{$this->bangles->id}", ['sku_code' => 'bg'])->assertOk();
        $this->assertSame('BG', $this->bangles->fresh()->sku_code);
        $other = Category::create(['name' => 'Rings', 'slug' => 'rings']);
        $this->putJson("/api/admin/categories/{$other->id}", ['sku_code' => 'BG'])->assertStatus(422)->assertJsonValidationErrors('sku_code');
        $this->putJson("/api/admin/categories/{$other->id}", ['sku_code' => 'R-1'])->assertStatus(422)->assertJsonValidationErrors('sku_code');
        $this->assertSame(0, DB::table('categories')->where('sku_code', 'R-1')->count());
    }
}
