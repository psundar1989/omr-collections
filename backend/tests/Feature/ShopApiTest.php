<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Offer;
use App\Models\Product;
use App\Models\User;
use App\Support\Media;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ShopApiTest extends TestCase
{
    use RefreshDatabase;

    private Category $bracelets;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bracelets = Category::create(['name' => 'Handmade Bracelets', 'slug' => 'handmade-bracelets']);
    }

    private function product(array $attrs = []): Product
    {
        static $n = 0;
        $n++;

        return Product::create($attrs + [
            'category_id' => $this->bracelets->id, 'name' => "Bracelet {$n}", 'slug' => "bracelet-{$n}", 'sku' => "BR{$n}",
            'regular_price' => 15, 'stock_quantity' => 10,
        ]);
    }

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'a@example.in', 'password' => 'secret123', 'is_admin' => true]);
        Sanctum::actingAs($u);

        return $u;
    }

    public function test_indian_money_format(): void
    {
        $this->assertSame('₹1,23,456.50', Money::format(123456.5));
        $this->assertSame('₹999', Money::format(999));
    }

    public function test_only_active_products_are_listed(): void
    {
        $this->product(['name' => 'Visible']);
        $this->product(['name' => 'Hidden', 'is_active' => false]);

        $this->getJson('/api/products')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Visible');
    }

    public function test_quote_uses_server_prices_and_builds_whatsapp_message(): void
    {
        $a = $this->product(['name' => 'Pearl Handmade Bracelet', 'sku' => 'BR001', 'colours' => ['White & Gold']]);
        $b = $this->product(['name' => 'Gold Chain Bracelet', 'sku' => 'BR002', 'regular_price' => 19]);

        $res = $this->postJson('/api/cart/quote', [
            'items' => [
                ['product_id' => $a->id, 'colour' => 'White & Gold', 'quantity' => 2, 'unit_price' => 1], // client price ignored
                ['product_id' => $b->id, 'quantity' => 1],
            ],
            'customer_name' => 'Ravi', 'delivery_location' => 'Chennai', 'pincode' => '600001',
        ])->assertOk()->json('data');

        $this->assertTrue($res['valid']);
        $this->assertEquals(49, $res['total']);
        $this->assertStringContainsString('Colour: White & Gold', $res['message']);
        $this->assertStringContainsString('Total Amount: ₹49', $res['message']);
        $this->assertStringStartsWith('https://wa.me/', $res['whatsapp_url']);
        $this->assertStringContainsString(rawurlencode('Customer Name: Ravi'), $res['whatsapp_url']);
    }

    public function test_whatsapp_message_carries_an_absolute_link_to_each_product_image(): void
    {
        config(['shop.frontend_url' => 'https://shop.example/']);
        $static = $this->product(['name' => 'Kundan Bangle']);
        $static->images()->create(['path' => '/images/bangles/kundan set.jpg', 'disk' => Media::STATIC_DISK, 'is_primary' => true]);
        $external = $this->product(['name' => 'Pearl Bracelet']);
        $external->images()->create(['path' => 'https://cdn.example/pearl.jpg', 'disk' => 'public', 'is_primary' => true]);
        $noPhoto = $this->product(['name' => 'Plain Bracelet']);

        $message = $this->postJson('/api/cart/quote', [
            'items' => [
                ['product_id' => $static->id, 'quantity' => 1],
                ['product_id' => $external->id, 'quantity' => 1],
                ['product_id' => $noPhoto->id, 'quantity' => 1],
            ],
        ])->assertOk()->json('data.message');

        $this->assertStringContainsString("1. Product Name: Kundan Bangle\n\n   Product Image:\n   https://shop.example/images/bangles/kundan%20set.jpg\n\n", $message);
        $this->assertStringContainsString("2. Product Name: Pearl Bracelet\n\n   Product Image:\n   https://cdn.example/pearl.jpg\n\n", $message);
        $this->assertStringContainsString("3. Product Name: Plain Bracelet\n   Product Link: https://shop.example/products/{$noPhoto->slug}\n   SKU:", $message);
    }

    public function test_whatsapp_message_links_to_the_product_page_after_the_image(): void
    {
        config(['shop.frontend_url' => 'https://shop.example/']);
        $product = $this->product(['name' => 'Kundan Bangle']);
        $product->images()->create(['path' => 'https://cdn.example/kundan.jpg', 'disk' => 'public', 'is_primary' => true]);

        $message = $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk()->json('data.message');

        $this->assertStringContainsString(
            "Product Image:\nhttps://cdn.example/kundan.jpg\n\nProduct Link: https://shop.example/products/{$product->slug}\nSKU:",
            $message,
        );
    }

    #[DataProvider('unreachableFrontendUrls')]
    public function test_whatsapp_message_omits_a_storefront_image_link_the_recipient_could_not_open(string $frontendUrl): void
    {
        config(['shop.frontend_url' => $frontendUrl]);
        $product = $this->product(['name' => 'Kundan Bangle']);
        $product->images()->create(['path' => '/images/bangles/kundan.jpg', 'disk' => Media::STATIC_DISK, 'is_primary' => true]);

        $message = $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk()->json('data.message');

        $this->assertStringNotContainsString('Product Image:', $message);
        $this->assertStringNotContainsString('Product Link:', $message);
        $this->assertStringContainsString("Product Name: Kundan Bangle\nSKU:", $message);
    }

    /** @return array<string, array{string}> */
    public static function unreachableFrontendUrls(): array
    {
        return [
            'localhost' => ['http://localhost:3000'],
            'localhost over https' => ['https://localhost:3000'],
            'private address' => ['https://192.168.1.20'],
            'local dev domain' => ['https://omr.test'],
            'plain http on a public domain' => ['http://shop.example'],
        ];
    }

    public function test_whatsapp_message_keeps_a_localhost_image_link_on_a_local_environment(): void
    {
        $this->app->detectEnvironment(fn () => 'local');
        config(['shop.frontend_url' => 'http://localhost:3000']);
        $product = $this->product(['name' => 'Kundan Bangle']);
        $product->images()->create(['path' => '/images/bangles/kundan set.jpg', 'disk' => Media::STATIC_DISK, 'is_primary' => true]);

        $message = $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk()->json('data.message');

        $this->assertStringContainsString("Product Image:\nhttp://localhost:3000/images/bangles/kundan%20set.jpg\n", $message);
    }

    public function test_whatsapp_message_omits_an_uploaded_image_link_on_the_local_storage_url(): void
    {
        config(['shop.frontend_url' => 'https://shop.example']);
        Storage::fake('public', ['url' => 'http://localhost:8000/storage']);
        $product = $this->product(['name' => 'Kundan Bangle']);
        $product->images()->create(['path' => 'products/1/kundan.jpg', 'disk' => 'public', 'is_primary' => true]);

        $message = $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk()->json('data.message');

        $this->assertStringNotContainsString('Product Image:', $message);
    }

    public function test_whatsapp_message_links_an_uploaded_image_on_the_production_storage_url(): void
    {
        Storage::fake('public', ['url' => 'https://media.shop.example/storage']);
        $product = $this->product(['name' => 'Kundan Bangle']);
        $product->images()->create(['path' => 'products/1/kundan.jpg', 'disk' => 'public', 'is_primary' => true]);

        $message = $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk()->json('data.message');

        $this->assertStringContainsString("Product Image:\nhttps://media.shop.example/storage/products/1/kundan.jpg\n", $message);
    }

    public function test_whatsapp_message_links_an_image_on_the_s3_cloudfront_url(): void
    {
        Storage::fake('s3', ['url' => 'https://d111111abcdef8.cloudfront.net']);
        $product = $this->product(['name' => 'Kundan Bangle']);
        $product->images()->create(['path' => 'products/1/kundan.jpg', 'disk' => 's3', 'is_primary' => true]);

        $message = $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk()->json('data.message');

        $this->assertStringContainsString("Product Image:\nhttps://d111111abcdef8.cloudfront.net/products/1/kundan.jpg\n", $message);
    }

    public function test_whatsapp_message_uses_the_primary_image_of_the_ordered_product(): void
    {
        $other = $this->product(['name' => 'Pearl Bracelet']);
        $other->images()->create(['path' => 'https://cdn.example/other-product.jpg', 'disk' => 'public', 'is_primary' => true]);
        $product = $this->product(['name' => 'Kundan Bangle']);
        $product->images()->create(['path' => 'https://cdn.example/gallery.jpg', 'disk' => 'public', 'is_primary' => false, 'sort_order' => 0]);
        $product->images()->create(['path' => 'https://cdn.example/primary.jpg', 'disk' => 'public', 'is_primary' => true, 'sort_order' => 1]);

        $message = $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk()->json('data.message');

        $this->assertStringContainsString("Product Images:\nhttps://cdn.example/primary.jpg\n", $message);
        $this->assertStringNotContainsString('gallery.jpg', $message);
        $this->assertStringNotContainsString('other-product.jpg', $message);
    }

    public function test_leaving_out_an_unreachable_image_logs_a_warning(): void
    {
        config(['shop.frontend_url' => 'http://localhost:3000']);
        Log::spy();
        $product = $this->product(['name' => 'Kundan Bangle', 'sku' => 'KB-1']);
        $product->images()->create(['path' => '/images/bangles/kundan.jpg', 'disk' => Media::STATIC_DISK, 'is_primary' => true]);

        $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk();

        Log::shouldHaveReceived('warning')->once()->withArgs(fn (string $message, array $context): bool => str_contains($message, 'FRONTEND_URL')
            && $context === ['sku' => 'KB-1', 'image_url' => '/images/bangles/kundan.jpg']);
    }

    public function test_quote_rejects_out_of_stock_missing_options_and_excess_quantity(): void
    {
        $out = $this->product(['stock_quantity' => 0]);
        $needsColour = $this->product(['colours' => ['Red', 'Blue']]);
        $few = $this->product(['stock_quantity' => 2]);

        $res = $this->postJson('/api/cart/quote', ['items' => [
            ['product_id' => $out->id, 'quantity' => 1],
            ['product_id' => $needsColour->id, 'quantity' => 1],
            ['product_id' => $few->id, 'quantity' => 3],
        ]])->assertOk()->json('data');

        $this->assertFalse($res['valid']);
        $this->assertNull($res['whatsapp_url']);
        $this->assertSame(['Out of stock.', 'Please choose a colour.', 'Only 2 left in stock.'], array_column($res['items'], 'error'));
    }

    public function test_variant_stock_and_extra_price(): void
    {
        $p = $this->product(['regular_price' => 999]);
        $p->variants()->create(['colour' => 'Gold', 'size' => '2.8', 'additional_price' => 50, 'stock_quantity' => 1]);
        $p->variants()->create(['colour' => 'Maroon', 'size' => '2.8', 'stock_quantity' => 0]);

        $res = $this->postJson('/api/cart/quote', ['items' => [
            ['product_id' => $p->id, 'colour' => 'gold', 'size' => '2.8', 'quantity' => 1],
            ['product_id' => $p->id, 'colour' => 'Maroon', 'size' => '2.8', 'quantity' => 1],
        ]])->json('data');

        $this->assertEquals(1049, $res['items'][0]['unit_price']);
        $this->assertSame('Out of stock.', $res['items'][1]['error']);
    }

    public function test_best_of_sale_price_and_category_offer_applies(): void
    {
        $p = $this->product(['regular_price' => 1000, 'sale_price' => 850]);
        $offer = Offer::create(['name' => 'Diwali', 'discount_percentage' => 20, 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay()]);
        $offer->categories()->attach($this->bracelets->id);

        $this->getJson("/api/products/{$p->slug}")->assertJsonPath('data.price', 800)->assertJsonPath('data.original_price', 1000);

        // price filter/sort uses the same effective price in SQL
        $this->getJson('/api/products?max_price=800')->assertJsonCount(1, 'data');
        $this->getJson('/api/products?max_price=799')->assertJsonCount(0, 'data');
    }

    public function test_admin_routes_require_admin(): void
    {
        $this->getJson('/api/admin/dashboard')->assertUnauthorized();
        Sanctum::actingAs(User::create(['name' => 'C', 'email' => 'c@example.in', 'password' => 'secret123']));
        $this->getJson('/api/admin/dashboard')->assertForbidden();
    }

    public function test_bulk_percentage_update_needs_confirmation_and_records_history(): void
    {
        $user = $this->admin();
        $p = $this->product(['regular_price' => 15]);
        $other = Product::create(['name' => 'Necklace', 'slug' => 'n', 'sku' => 'NK1', 'regular_price' => 100]);
        $rule = ['scope' => 'category', 'category_id' => $this->bracelets->id, 'target' => 'regular', 'operation' => 'increase_percent', 'value' => 10];

        $this->postJson('/api/admin/prices/bulk/preview', $rule)->assertOk()
            ->assertJsonPath('data.rows.0.new_regular_price', 16.5)->assertJsonPath('data.matched', 1);
        $this->assertEquals(15, $p->fresh()->regular_price); // preview saves nothing

        $this->postJson('/api/admin/prices/bulk/apply', $rule)->assertUnprocessable();
        $this->postJson('/api/admin/prices/bulk/apply', $rule + ['confirm' => true])->assertOk()->assertJsonPath('data.updated', 1);

        $this->assertEquals(16.5, $p->fresh()->regular_price);
        $this->assertEquals(100, $other->fresh()->regular_price);
        $this->assertDatabaseHas('product_price_histories', ['product_id' => $p->id, 'old_price' => 15, 'new_price' => 16.5, 'user_id' => $user->id, 'change_source' => 'bulk']);
    }

    public function test_sale_price_must_be_lower_than_regular(): void
    {
        $this->admin();
        $p = $this->product(['regular_price' => 500]);
        $this->patchJson("/api/admin/products/{$p->id}/price", ['regular_price' => 500, 'sale_price' => 600])->assertUnprocessable();
        $this->patchJson("/api/admin/products/{$p->id}/price", ['regular_price' => 550, 'sale_price' => 499])->assertOk();
        $this->assertSame(2, $p->priceHistories()->count());
    }

    public function test_whatsapp_number_setting_is_normalised_and_used(): void
    {
        $this->admin();
        $this->putJson('/api/admin/settings', ['whatsapp_number' => '98404 65980'])->assertOk()->assertJsonPath('data.whatsapp_number', '919840465980'); // stored normalised for wa.me
        $p = $this->product();
        $url = $this->postJson('/api/cart/quote', ['items' => [['product_id' => $p->id, 'quantity' => 1]]])->json('data.whatsapp_url');
        $this->assertStringStartsWith('https://wa.me/919840465980?text=', $url);
    }
}
