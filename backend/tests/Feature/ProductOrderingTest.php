<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\CustomOrderRequest;
use App\Models\Product;
use App\Models\ProductPriceHistory;
use App\Models\User;
use App\Services\PhotoCatalogueImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Product ordering: pricing modes, colours, sizes, quantity, WhatsApp message and the photo import. */
class ProductOrderingTest extends TestCase
{
    use RefreshDatabase;

    private Category $bangles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bangles = Category::create(['name' => 'Bangles', 'slug' => 'bangles']);
    }

    private function product(array $attrs = []): Product
    {
        static $n = 0;
        $n++;

        return Product::create($attrs + [
            'category_id' => $this->bangles->id, 'name' => "Bangle {$n}", 'slug' => "bangle-{$n}", 'sku' => "product-{$n}",
            'regular_price' => 499, 'track_stock' => false,
        ]);
    }

    private function quote(array $items, array $extra = []): array
    {
        return $this->postJson('/api/cart/quote', ['items' => $items] + $extra)->assertOk()->json('data');
    }

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.in', 'password' => 'secret123', 'is_admin' => true]);
        Sanctum::actingAs($u);

        return $u;
    }

    private static function entries(): array
    {
        return [
            ['id' => 'product-001', 'slug' => 'blush-pink-pearl-silk-thread-jhumka', 'name' => 'Blush Pink Pearl Silk Thread Jhumka', 'collection' => 'silk-thread-jhumka',
                'category' => 'Silk Thread Jhumka', 'images' => ['/images/silk_thread_jhumka/a_01.png', '/images/silk_thread_jhumka/a_02.png'],
                'photographedAt' => '2026-03-07T21:37:22', 'isNewArrival' => true, 'homepageBanner' => true],
            ['id' => 'product-062', 'slug' => 'olive-green-gold-flower-silk-thread-bangle-pair', 'name' => 'Olive Green Gold Flower Silk Thread Bangle Pair', 'collection' => 'bangles',
                'category' => 'Bangles', 'images' => ['/images/bangles/olive_01.jpg'], 'photographedAt' => null, 'isNewArrival' => false, 'homepageBanner' => false],
        ];
    }

    /* ------------------------------------------------------------- pricing */

    public function test_fixed_price_product_order_message(): void
    {
        $p = $this->product(['name' => 'Olive Green Gold Flower Silk Thread Bangle Pair', 'sku' => 'product-062',
            'colours' => ['Olive Green', 'Red'], 'sizes' => ['2.4', '2.6']]);

        $q = $this->quote([['product_id' => $p->id, 'colour' => 'Olive Green', 'size' => '2.6', 'quantity' => 1]]);

        $this->assertTrue($q['valid']);
        $this->assertEquals(499, $q['total']);
        $this->assertFalse($q['has_price_on_request']);
        $this->assertSame(implode("\n", [
            'Hello! I would like to place an order.', '',
            '*Product Details*', '',
            'Product Name: Olive Green Gold Flower Silk Thread Bangle Pair',
            'SKU: product-062-26-OLIGRE',
            'Price: ₹499',
            'Colour: Olive Green',
            'Size: 2.6',
            'Quantity: 1',
            'Total Amount: ₹499', '',
            'Please confirm availability and delivery details.', '',
            'Thank you!',
        ]), $q['message']);
        $this->assertStringStartsWith('https://wa.me/919840465980?text=', $q['whatsapp_url']);
        $this->assertSame($q['message'], rawurldecode(explode('?text=', $q['whatsapp_url'])[1]));
    }

    public function test_sale_price_is_shown_with_regular_price(): void
    {
        $p = $this->product(['regular_price' => 599, 'sale_price' => 449]);

        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.price', 449)->assertJsonPath('data.original_price', 599)
            ->assertJsonPath('data.price_on_request', false);
        $q = $this->quote([['product_id' => $p->id, 'quantity' => 2, 'unit_price' => 1]]); // client price ignored

        $this->assertEquals(898, $q['total']);
        $this->assertStringContainsString('Price: ₹449 (Regular ₹599)', $q['message']);
        $this->assertStringContainsString('Total Amount: ₹898', $q['message']);
    }

    public function test_price_on_request_product_enquiry(): void
    {
        $p = $this->product(['price_on_request' => true, 'regular_price' => 350, 'colours' => ['Red'], 'sizes' => ['2.4']]);

        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.price', null)->assertJsonPath('data.price_on_request', true)
            ->assertJsonPath('data.original_price', null);

        $q = $this->quote([['product_id' => $p->id, 'colour' => 'Red', 'size' => '2.4', 'quantity' => 3]]);
        $this->assertTrue($q['valid']);
        $this->assertTrue($q['has_price_on_request']);
        $this->assertNull($q['items'][0]['unit_price']);
        $this->assertEquals(0, $q['total']);
        $this->assertStringContainsString("Price: On Request\nColour: Red\nSize: 2.4\nQuantity: 3\n\nPlease share the price and availability.", $q['message']);
        $this->assertStringNotContainsString('₹350', $q['message']); // the hidden stored price never leaks
    }

    public function test_price_on_request_products_are_excluded_from_price_filters_and_sorted_last(): void
    {
        $this->product(['name' => 'Priced', 'regular_price' => 100]);
        $this->product(['name' => 'On request', 'price_on_request' => true, 'regular_price' => 0]);

        $this->getJson('/api/products?max_price=500')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Priced');
        $this->getJson('/api/products?sort=price_asc')->assertJsonPath('data.0.name', 'Priced')->assertJsonPath('data.1.name', 'On request');
        $this->getJson('/api/products?on_sale=1')->assertJsonCount(0, 'data');
        $this->assertEquals(100, $this->getJson('/api/products')->json('meta_extra.min_price'));
    }

    /* ----------------------------------------------------- colours & sizes */

    public function test_colour_options_get_swatches_from_the_admin_palette(): void
    {
        $p = $this->product(['colours' => ['Olive Green', 'Ruby Red & Gold', 'Unicorn Sparkle']]);

        $opts = $this->getJson("/api/products/{$p->slug}")->json('data.colour_options');
        $this->assertSame(['name' => 'Olive Green', 'hex' => '#708238'], $opts[0]);
        $this->assertSame('#9B111E', $opts[1]['hex']); // longest contained palette name: "Ruby Red"
        $this->assertNull($opts[2]['hex']);

        $this->admin();
        $this->putJson('/api/admin/settings', ['colour_swatches' => [['name' => 'Unicorn Sparkle', 'hex' => '#e0b0ff']]])->assertOk();
        $this->assertSame('#E0B0FF', $this->getJson("/api/products/{$p->slug}")->json('data.colour_options.2.hex'));
        $this->putJson('/api/admin/settings', ['colour_swatches' => [['name' => 'Bad', 'hex' => 'red']]])->assertUnprocessable();
    }

    public function test_colour_and_size_are_validated(): void
    {
        $p = $this->product(['colours' => ['Red', 'Pink'], 'sizes' => ['2.2', '2.4']]);

        $q = $this->quote([
            ['product_id' => $p->id, 'size' => '2.2', 'quantity' => 1],
            ['product_id' => $p->id, 'colour' => 'Red', 'quantity' => 1],
            ['product_id' => $p->id, 'colour' => 'Green', 'size' => '2.2', 'quantity' => 1],
            ['product_id' => $p->id, 'colour' => 'pink', 'size' => '2.4', 'quantity' => 1],
        ]);

        $this->assertFalse($q['valid']);
        $this->assertSame(['Please choose a colour.', 'Please choose a size.', 'Please choose a colour.', null], array_column($q['items'], 'error'));
    }

    public function test_products_without_sizes_ignore_size_and_need_no_selection(): void
    {
        $p = $this->product(['name' => 'Keychain']);
        $q = $this->quote([['product_id' => $p->id, 'size' => 'XL', 'colour' => 'Blue', 'quantity' => 1]]);

        $this->assertTrue($q['valid']);
        $this->assertNull($q['items'][0]['size']);
        $this->assertStringNotContainsString('Size:', $q['message']);
        $this->assertStringNotContainsString('Colour:', $q['message']);
    }

    public function test_multiple_colour_variants_with_their_own_stock_and_price(): void
    {
        $p = $this->product(['regular_price' => 299, 'track_stock' => true]);
        $red = $p->variants()->create(['colour' => 'Red', 'size' => '2.4', 'stock_quantity' => 2]);
        $p->variants()->create(['colour' => 'Pink', 'size' => '2.4', 'stock_quantity' => 5, 'additional_price' => 50]);

        $q = $this->quote([
            ['key' => 'a', 'product_id' => $p->id, 'variant_id' => $red->id, 'quantity' => 2],
            ['key' => 'b', 'product_id' => $p->id, 'colour' => 'Pink', 'size' => '2.4', 'quantity' => 1],
        ]);
        $this->assertTrue($q['valid']);
        $this->assertEquals(299 * 2 + 349, $q['total']);
        $this->assertStringStartsWith("Hello! I would like to place an order.\n\n*Product Details*\n\n1. Product Name:", $q['message']);
        $this->assertStringContainsString('*Total Amount: ₹947*', $q['message']);

        $q = $this->quote([['product_id' => $p->id, 'variant_id' => $red->id, 'quantity' => 3]]);
        $this->assertSame('Only 2 left in stock.', $q['items'][0]['error']);
    }

    /* ------------------------------------------------------ quantity & cart */

    public function test_quantity_limits_and_stock(): void
    {
        $tracked = $this->product(['track_stock' => true, 'stock_quantity' => 4]);
        $madeToOrder = $this->product(['track_stock' => false, 'stock_quantity' => 0]);

        $this->postJson('/api/cart/quote', ['items' => [['product_id' => $madeToOrder->id, 'quantity' => 51]]])->assertUnprocessable();
        $this->postJson('/api/cart/quote', ['items' => [['product_id' => $madeToOrder->id, 'quantity' => 0]]])->assertUnprocessable();
        $this->assertTrue($this->quote([['product_id' => $madeToOrder->id, 'quantity' => 50]])['valid']);
        $this->assertSame('Only 4 left in stock.', $this->quote([['product_id' => $tracked->id, 'quantity' => 5]])['items'][0]['error']);
    }

    public function test_cart_with_priced_and_on_request_products_and_customer_details(): void
    {
        $a = $this->product(['regular_price' => 299]);
        $b = $this->product(['price_on_request' => true]);

        $q = $this->quote([['product_id' => $a->id, 'quantity' => 2], ['product_id' => $b->id, 'quantity' => 1]],
            ['customer_name' => 'Priya', 'delivery_location' => 'Velachery, Chennai', 'pincode' => '600042']);

        $this->assertTrue($q['valid']);
        $this->assertEquals(598, $q['total']);
        $this->assertTrue($q['has_price_on_request']);
        $this->assertStringContainsString('*Total Amount: ₹598 + items on request*', $q['message']);
        $this->assertStringContainsString("Customer Name: Priya\nDelivery Location: Velachery, Chennai\nPincode: 600042", $q['message']);
    }

    /* --------------------------------------------------------------- admin */

    public function test_admin_can_switch_between_fixed_sale_and_on_request_pricing(): void
    {
        $this->admin();
        $create = ['name' => 'Kundan Bangle', 'sku' => 'product-900', 'price_on_request' => true, 'regular_price' => null, 'category_id' => $this->bangles->id];
        $id = $this->postJson('/api/admin/products', $create)->assertCreated()
            ->assertJsonPath('data.pricing_mode', 'on_request')->assertJsonPath('data.price', null)->json('data.id');

        // Fixed price needs a regular price.
        $this->putJson("/api/admin/products/{$id}", ['price_on_request' => false])->assertUnprocessable()->assertJsonValidationErrors('regular_price');
        $this->putJson("/api/admin/products/{$id}", ['price_on_request' => false, 'regular_price' => 499])->assertOk()
            ->assertJsonPath('data.pricing_mode', 'fixed')->assertJsonPath('data.price', 499);
        $this->putJson("/api/admin/products/{$id}", ['sale_price' => 399])->assertOk()
            ->assertJsonPath('data.pricing_mode', 'sale')->assertJsonPath('data.price', 399)->assertJsonPath('data.original_price', 499);
        $this->putJson("/api/admin/products/{$id}", ['sale_price' => 599])->assertUnprocessable();

        // Back to on request keeps the stored prices hidden but intact.
        $this->putJson("/api/admin/products/{$id}", ['price_on_request' => true])->assertOk()->assertJsonPath('data.price', null)
            ->assertJsonPath('data.regular_price', 499);

        $types = ProductPriceHistory::where('product_id', $id)->orderBy('id')->pluck('price_type')->all();
        $this->assertSame(['on_request', 'on_request', 'regular', 'sale', 'on_request'], $types);
        $this->getJson('/api/admin/products?pricing=on_request')->assertJsonCount(1, 'data');
    }

    public function test_admin_updates_colours_sizes_and_variants(): void
    {
        $this->admin();
        $p = $this->product();

        $this->putJson("/api/admin/products/{$p->id}", ['colours' => ['Red', ' Pink ', 'Red'], 'sizes' => ['2.2', '2.4']])->assertOk()
            ->assertJsonPath('data.colours', ['Red', 'Pink'])->assertJsonPath('data.sizes', ['2.2', '2.4']);

        $this->putJson("/api/admin/products/{$p->id}", ['track_stock' => true, 'variants' => [
            ['colour' => 'Red', 'size' => '2.2', 'stock_quantity' => 3, 'additional_price' => 0],
            ['colour' => 'Yellow', 'size' => '2.8', 'stock_quantity' => 1, 'additional_price' => 25],
        ]])->assertOk()->assertJsonPath('data.colours', ['Red', 'Yellow'])->assertJsonPath('data.sizes', ['2.2', '2.8'])
            ->assertJsonPath('data.raw_stock_quantity', 4);

        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.variants.1.price', 524);
    }

    public function test_bulk_set_fixed_prices_imported_on_request_products_and_skips_others(): void
    {
        $user = $this->admin();
        $onRequest = $this->product(['price_on_request' => true, 'regular_price' => 0]);
        $priced = $this->product(['regular_price' => 100]);

        $rule = ['scope' => 'category', 'category_id' => $this->bangles->id, 'target' => 'regular', 'operation' => 'increase_percent', 'value' => 10, 'confirm' => true];
        $this->postJson('/api/admin/prices/bulk/apply', $rule)->assertOk()->assertJsonPath('data.updated', 1);
        $this->assertTrue($onRequest->fresh()->price_on_request);

        $rule = ['operation' => 'set_fixed', 'value' => 299] + $rule;
        $this->postJson('/api/admin/prices/bulk/apply', $rule)->assertOk()->assertJsonPath('data.updated', 2);
        $this->assertFalse($onRequest->fresh()->price_on_request);
        $this->assertEquals(299, $onRequest->fresh()->regular_price);
        $this->assertDatabaseHas('product_price_histories', ['product_id' => $onRequest->id, 'price_type' => 'on_request', 'new_price' => 299, 'user_id' => $user->id]);
        $this->assertEquals(299, $priced->fresh()->regular_price);
    }

    /* -------------------------------------------------------------- import */

    public function test_photo_catalogue_import_is_idempotent_and_preserves_codes_slugs_and_images(): void
    {
        $importer = app(PhotoCatalogueImporter::class);

        $dry = $importer->import(self::entries(), dryRun: true);
        $this->assertSame(2, $dry['stats']['created']);
        $this->assertSame(0, Product::count());

        $r = $importer->import(self::entries(), defaultSizes: ['bangles' => ['2.2', '2.4', '2.6', '2.8']]);
        $this->assertSame(['created' => 2, 'updated' => 0, 'unchanged' => 0, 'skipped' => 0, 'categories_created' => 1, 'images_added' => 3, 'skus_assigned' => 2], $r['stats']);

        $jhumka = Product::where('catalog_code', 'product-001')->firstOrFail();
        $this->assertSame('OMR-JH-001', $jhumka->sku);
        $this->assertSame('blush-pink-pearl-silk-thread-jhumka', $jhumka->slug);
        $this->assertTrue($jhumka->price_on_request);
        $this->assertFalse($jhumka->track_stock);
        $this->assertTrue($jhumka->is_new_arrival);
        $this->assertSame('2026-03-07 21:37:22', $jhumka->created_at->format('Y-m-d H:i:s'));
        $this->assertSame('collections', $jhumka->category->section);
        $this->assertSame(Product::SOURCE_PHOTO_CATALOGUE, $jhumka->source);
        $bangle = Product::where('catalog_code', 'product-062')->firstOrFail();
        $this->assertSame('OMR-BG-001', $bangle->sku);
        $this->assertSame($this->bangles->id, $bangle->category_id); // existing category reused
        $this->assertSame(['2.2', '2.4', '2.6', '2.8'], $bangle->sizes);

        $this->getJson('/api/products/blush-pink-pearl-silk-thread-jhumka')->assertOk()
            ->assertJsonPath('data.sku', 'OMR-JH-001')->assertJsonPath('data.catalog_code', 'product-001')->assertJsonPath('data.image_url', '/images/silk_thread_jhumka/a_01.png')
            ->assertJsonPath('data.images.1.url', '/images/silk_thread_jhumka/a_02.png');
        // Catalogue cards still find products by catalogue code; SKUs work too.
        $this->getJson('/api/products/by-ids?skus[]=product-062&skus[]=product-001')->assertJsonPath('data.0.sku', 'OMR-BG-001')->assertJsonPath('data.1.sku', 'OMR-JH-001');
        $this->getJson('/api/products/by-ids?skus[]=OMR-JH-001')->assertJsonPath('data.0.catalog_code', 'product-001');

        // Admin edits survive a re-run, nothing is duplicated.
        $jhumka->update(['name' => 'Edited name', 'price_on_request' => false, 'regular_price' => 450]);
        $again = $importer->import(self::entries());
        $this->assertSame(2, $again['stats']['unchanged']);
        $this->assertSame(2, Product::count());
        $this->assertSame(2, $jhumka->images()->count());
        $this->assertSame('Edited name', $jhumka->fresh()->name);
        $this->assertEquals(450, $jhumka->fresh()->regular_price);

        // --sync refreshes catalogue fields only; prices stay.
        $importer->import(self::entries(), sync: true);
        $this->assertSame('Blush Pink Pearl Silk Thread Jhumka', $jhumka->fresh()->name);
        $this->assertEquals(450, $jhumka->fresh()->regular_price);
    }

    public function test_import_never_takes_over_existing_products_and_reports_conflicts(): void
    {
        $this->product(['sku' => 'product-001', 'slug' => 'my-own-product']);
        $this->product(['sku' => 'OTHER1', 'slug' => 'olive-green-gold-flower-silk-thread-bangle-pair']);

        $r = app(PhotoCatalogueImporter::class)->import([...self::entries(), ['id' => '../x', 'slug' => 'x', 'name' => 'x', 'collection' => 'x']]);

        $this->assertSame(0, $r['stats']['created']);
        $this->assertSame(3, $r['stats']['skipped']);
        $this->assertSame('my-own-product', Product::where('sku', 'product-001')->value('slug'));
    }

    public function test_import_rollback_removes_only_imported_rows(): void
    {
        $own = $this->product();
        $this->artisan('catalog:import-photos', ['--file' => $this->jsonFile()])->assertSuccessful();
        $this->assertSame(3, Product::count());

        $this->artisan('catalog:import-photos', ['--rollback' => true, '--force' => true])->assertSuccessful();
        $this->assertSame([$own->id], Product::pluck('id')->all());
        $this->assertNull(Category::where('slug', 'silk-thread-jhumka')->first());
        $this->assertNotNull($this->bangles->fresh()); // pre-existing category kept
        $this->assertDatabaseCount('product_images', 0);
    }

    private function jsonFile(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'cat');
        file_put_contents($path, json_encode(self::entries()));

        return $path;
    }

    /* -------------------------------------------------------- custom order */

    public function test_custom_order_still_works_and_uses_the_configured_storage_url(): void
    {
        config(['filesystems.disks.public.url' => 'https://api.omrcollections.in/storage']);
        Storage::fake('public', ['url' => 'https://api.omrcollections.in/storage']);

        $res = $this->post('/api/custom-orders', [
            'customer_name' => 'Lakshmi', 'whatsapp_number' => '98400 12345', 'product_type' => 'Bangles',
            'preferred_colour' => 'Olive Green', 'size' => '2.6', 'description' => 'Matching my saree, 6 bangles.',
            'reference_image' => UploadedFile::fake()->image('ref.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');

        $order = CustomOrderRequest::findOrFail($res['id']);
        $this->assertSame('+919840012345', $order->whatsapp_number);
        $this->assertStringStartsWith('https://api.omrcollections.in/storage/custom-orders/', $order->reference_image_url);
        $this->assertStringContainsString('Request No: CO-'.str_pad((string) $order->id, 5, '0', STR_PAD_LEFT), $res['message']);
        $this->assertStringContainsString('Reference Image: https://api.omrcollections.in/storage/', $res['message']);
        $this->assertStringContainsString("Preferred Colour: Olive Green\nSize: 2.6", $res['message']);
    }
}
