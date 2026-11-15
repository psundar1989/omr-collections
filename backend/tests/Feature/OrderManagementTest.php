<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DeliveryPerson;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** WhatsApp orders: placing with customer details, admin tracking, delivery assignment and the status history. */
class OrderManagementTest extends TestCase
{
    use RefreshDatabase;

    private Category $category;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->category = Category::create(['name' => 'Bangles', 'slug' => 'bangles']);
        $this->admin = User::create(['name' => 'Admin', 'email' => 'admin@example.in', 'password' => 'secret123', 'is_admin' => true]);
    }

    private function product(array $attrs = []): Product
    {
        static $n = 0;
        $n++;

        return Product::create($attrs + [
            'category_id' => $this->category->id, 'name' => "Bangle {$n}", 'slug' => "bangle-{$n}", 'sku' => "BG-{$n}",
            'regular_price' => 500, 'track_stock' => true, 'stock_quantity' => 10,
        ]);
    }

    private function customer(array $over = []): array
    {
        return $over + [
            'customer_name' => 'Priya Raman', 'phone' => '98765 43210', 'whatsapp_number' => '9123456789',
            'address' => '12, 3rd Cross Street, Velachery', 'landmark' => 'Near Phoenix Mall', 'city' => 'Chennai',
            'state' => 'Tamil Nadu', 'pincode' => '600042', 'notes' => 'Gift wrap please',
        ];
    }

    private function place(array $items, array $over = []): Order
    {
        $res = $this->postJson('/api/orders', ['items' => $items] + $this->customer($over))->assertCreated();

        return Order::where('order_number', $res->json('data.order_number'))->firstOrFail();
    }

    private function moveTo(Order $o, string $status, array $extra = [])
    {
        return $this->postJson("/api/admin/orders/{$o->id}/status", ['status' => $status] + $extra);
    }

    public function test_placing_an_order_stores_customer_details_and_builds_whatsapp_message(): void
    {
        $p = $this->product(['name' => 'Pearl Bangle', 'sku' => 'PB-01']);

        $res = $this->postJson('/api/orders', ['items' => [['product_id' => $p->id, 'quantity' => 2]]] + $this->customer())->assertCreated();

        $number = $res->json('data.order_number');
        $this->assertMatchesRegularExpression('/^ORD-\d{6}$/', $number);
        $msg = $res->json('data.message');
        foreach (["Order No: {$number}", 'Pearl Bangle', 'Quantity: 2', 'Customer Name: Priya Raman', 'Phone: +919876543210',
            'WhatsApp: +919123456789', 'Delivery Address: 12, 3rd Cross Street, Velachery', 'Landmark: Near Phoenix Mall',
            'City: Chennai', 'Pincode: 600042', 'Notes: Gift wrap please'] as $needle) {
            $this->assertStringContainsString($needle, $msg);
        }
        $this->assertStringStartsWith('https://wa.me/', $res->json('data.whatsapp_url'));

        $order = Order::with('items', 'histories')->firstWhere('order_number', $number);
        $this->assertSame(Order::PENDING, $order->status);
        $this->assertSame('+919876543210', $order->phone);
        $this->assertSame('1000.00', $order->total);
        $this->assertSame('Pearl Bangle', $order->items[0]->product_name);
        $this->assertSame('placed', $order->histories[0]->event);
        $this->assertSame(10, $p->fresh()->stock_quantity, 'stock is only taken when the admin confirms');
    }

    public function test_whatsapp_number_defaults_to_phone_and_details_are_required(): void
    {
        $p = $this->product();
        $this->postJson('/api/orders', ['items' => [['product_id' => $p->id, 'quantity' => 1]]])
            ->assertStatus(422)->assertJsonValidationErrors(['customer_name', 'phone', 'address', 'city', 'pincode']);

        $order = $this->place([['product_id' => $p->id, 'quantity' => 1]], ['whatsapp_number' => null]);
        $this->assertSame($order->phone, $order->whatsapp_number);
        $this->assertStringNotContainsString('WhatsApp:', $order->whatsapp_message);
    }

    public function test_unorderable_cart_is_rejected_without_creating_an_order(): void
    {
        $p = $this->product(['availability_status' => Product::STATUS_SOLD_OUT]);
        $this->postJson('/api/orders', ['items' => [['product_id' => $p->id, 'quantity' => 1]]] + $this->customer())
            ->assertStatus(422)->assertJsonPath('data.quote.items.0.error', 'This product is sold out.');
        $this->assertSame(0, Order::count());
    }

    public function test_admin_lists_and_views_orders_with_items_and_customer(): void
    {
        $p = $this->product();
        $order = $this->place([['product_id' => $p->id, 'quantity' => 3]]);
        $this->getJson('/api/admin/orders')->assertUnauthorized();

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/admin/orders?status=pending&search=98765')
            ->assertOk()->assertJsonPath('data.0.order_number', $order->order_number)
            ->assertJsonPath('data.0.total_quantity', 3)->assertJsonPath('status_counts.pending', 1);

        $this->getJson("/api/admin/orders/{$order->id}")->assertOk()
            ->assertJsonPath('data.customer_name', 'Priya Raman')
            ->assertJsonPath('data.items.0.quantity', 3)
            ->assertJsonPath('data.items.0.unit_price', '500.00')
            ->assertJsonPath('data.next_statuses', [Order::CONFIRMED, Order::CANCELLED]);
    }

    public function test_full_lifecycle_with_delivery_person_stock_and_history(): void
    {
        $p = $this->product(['stock_quantity' => 5]);
        $order = $this->place([['product_id' => $p->id, 'quantity' => 2]]);
        Sanctum::actingAs($this->admin);

        $rider = $this->postJson('/api/admin/delivery-persons', ['name' => 'Karthik', 'phone' => '9000011111', 'vehicle_type' => 'Bike', 'service_area' => 'Velachery'])
            ->assertCreated()->json('data');
        $this->assertSame('+919000011111', $rider['phone']);

        $this->moveTo($order, Order::DELIVERED)->assertStatus(422); // cannot skip ahead
        $this->moveTo($order, Order::CONFIRMED, ['note' => 'Customer confirmed on WhatsApp'])->assertOk();
        $this->assertSame(3, $p->fresh()->stock_quantity);

        $this->moveTo($order, Order::OUT_FOR_DELIVERY)->assertStatus(422)->assertJsonValidationErrors('status'); // nobody assigned yet
        $this->postJson("/api/admin/orders/{$order->id}/assign", ['delivery_person_id' => $rider['id']])
            ->assertOk()->assertJsonPath('data.delivery_person.name', 'Karthik');

        $this->patchJson("/api/admin/orders/{$order->id}", ['delivery_charge' => 60, 'expected_delivery_date' => '2026-11-10', 'payment_method' => 'cod'])
            ->assertOk()->assertJsonPath('data.total', '1060.00');

        $this->moveTo($order, Order::PACKED)->assertOk();
        $this->moveTo($order, Order::OUT_FOR_DELIVERY)->assertOk();
        $this->moveTo($order, Order::DELIVERED, ['mark_paid' => true])->assertOk()
            ->assertJsonPath('data.status', Order::DELIVERED)->assertJsonPath('data.payment_status', 'paid');

        $order->refresh()->load('histories');
        $this->assertNotNull($order->confirmed_at);
        $this->assertNotNull($order->dispatched_at);
        $this->assertNotNull($order->delivered_at);
        $this->assertSame(
            ['placed', 'status_changed', 'assigned', 'updated', 'status_changed', 'status_changed', 'status_changed'],
            $order->histories->pluck('event')->all(),
        );
        $this->assertSame('Customer confirmed on WhatsApp', $order->histories[1]->note);
        $this->assertSame($this->admin->id, $order->histories[1]->user_id);

        $this->getJson("/api/admin/delivery-persons/{$rider['id']}")->assertOk()->assertJsonPath('data.orders.0.order_number', $order->order_number);
        $this->getJson('/api/admin/delivery-persons')->assertJsonPath('data.0.delivered_orders_count', 1);

        // Returning a delivered order puts the stock back.
        $this->moveTo($order, Order::RETURNED, ['note' => 'Wrong size'])->assertOk();
        $this->assertSame(5, $p->fresh()->stock_quantity);
        $this->moveTo($order, Order::CONFIRMED)->assertStatus(422);
    }

    public function test_cancel_requires_reason_and_restores_variant_stock(): void
    {
        $p = $this->product(['colours' => ['Red']]);
        $v = ProductVariant::create(['product_id' => $p->id, 'colour' => 'Red', 'stock_quantity' => 4]);
        $order = $this->place([['product_id' => $p->id, 'variant_id' => $v->id, 'quantity' => 3]]);
        Sanctum::actingAs($this->admin);

        $this->moveTo($order, Order::CONFIRMED)->assertOk();
        $this->assertSame(1, $v->fresh()->stock_quantity);

        $this->moveTo($order, Order::CANCELLED)->assertStatus(422)->assertJsonValidationErrors('cancellation_reason');
        $this->moveTo($order, Order::CANCELLED, ['cancellation_reason' => 'Customer changed mind'])->assertOk()
            ->assertJsonPath('data.cancellation_reason', 'Customer changed mind');
        $this->assertSame(4, $v->fresh()->stock_quantity);
    }

    public function test_confirm_fails_when_stock_ran_out(): void
    {
        $p = $this->product(['stock_quantity' => 2]);
        $a = $this->place([['product_id' => $p->id, 'quantity' => 2]]);
        $b = $this->place([['product_id' => $p->id, 'quantity' => 2]]);
        Sanctum::actingAs($this->admin);

        $this->moveTo($a, Order::CONFIRMED)->assertOk();
        $this->moveTo($b, Order::CONFIRMED)->assertStatus(422)->assertJsonValidationErrors('status');
        $this->assertSame(Order::PENDING, $b->fresh()->status);
        $this->assertSame(0, $p->fresh()->stock_quantity);
    }

    public function test_price_on_request_items_are_priced_by_admin_before_dispatch(): void
    {
        $p = $this->product(['price_on_request' => true, 'track_stock' => false]);
        $order = $this->place([['product_id' => $p->id, 'quantity' => 2]]);
        $this->assertTrue($order->has_price_on_request);
        Sanctum::actingAs($this->admin);

        $this->moveTo($order, Order::CONFIRMED)->assertOk();
        $this->moveTo($order, Order::PACKED)->assertStatus(422);

        $item = $order->items()->first();
        $this->patchJson("/api/admin/orders/{$order->id}", ['items' => [['id' => $item->id, 'unit_price' => 750]]])
            ->assertOk()->assertJsonPath('data.total', '1500.00')->assertJsonPath('data.has_price_on_request', false);
        $this->moveTo($order, Order::PACKED)->assertOk();
    }

    public function test_reassigning_and_deleting_delivery_persons(): void
    {
        $p = $this->product();
        $order = $this->place([['product_id' => $p->id, 'quantity' => 1]]);
        Sanctum::actingAs($this->admin);
        $a = DeliveryPerson::create(['name' => 'Arun', 'phone' => '+919000000001']);
        $b = DeliveryPerson::create(['name' => 'Bala', 'phone' => '+919000000002']);
        $off = DeliveryPerson::create(['name' => 'Off', 'phone' => '+919000000003', 'is_active' => false]);

        $this->postJson("/api/admin/orders/{$order->id}/assign", ['delivery_person_id' => $a->id])->assertOk();
        $this->postJson("/api/admin/orders/{$order->id}/assign", ['delivery_person_id' => $off->id])->assertStatus(422);
        $this->postJson("/api/admin/orders/{$order->id}/assign", ['delivery_person_id' => $b->id])->assertOk();
        $this->assertStringContainsString('reassigned from Arun to Bala', $order->histories()->reorder('id', 'desc')->first()->note);

        $this->deleteJson("/api/admin/delivery-persons/{$b->id}")->assertStatus(422); // has an open order
        $this->deleteJson("/api/admin/delivery-persons/{$a->id}")->assertNoContent();
    }

    public function test_customer_can_track_order_with_matching_phone_only(): void
    {
        $p = $this->product();
        $order = $this->place([['product_id' => $p->id, 'quantity' => 1]]);
        Sanctum::actingAs($this->admin);
        $this->moveTo($order, Order::CONFIRMED, ['note' => 'internal: VIP'])->assertOk();

        $this->postJson('/api/orders/track', ['order_number' => $order->order_number, 'phone' => '9999999999'])->assertNotFound();
        $res = $this->postJson('/api/orders/track', ['order_number' => strtolower($order->order_number), 'phone' => '+91 98765 43210'])
            ->assertOk()->assertJsonPath('data.status', Order::CONFIRMED)->assertJsonCount(2, 'data.timeline');
        $this->assertStringNotContainsString('VIP', $res->getContent());
        $this->assertStringNotContainsString('Velachery', $res->getContent(), 'full address is not exposed');
    }

    public function test_export_csv_and_dashboard_stats(): void
    {
        $p = $this->product(['name' => '=HYPERLINK("x")']);
        $this->place([['product_id' => $p->id, 'quantity' => 1]]);
        Sanctum::actingAs($this->admin);

        $csv = $this->get('/api/admin/orders/export')->assertOk()->streamedContent();
        $this->assertStringContainsString('Priya Raman', $csv);
        $this->assertStringContainsString("'=HYPERLINK", $csv);

        $this->getJson('/api/admin/dashboard')->assertOk()
            ->assertJsonPath('data.stats.pending_orders', 1)->assertJsonPath('data.stats.orders_today', 1)
            ->assertJsonPath('data.recent_orders.0.customer_name', 'Priya Raman');
    }

    private function enableWhatsAppCloud(): void
    {
        config(['shop.frontend_url' => 'https://shop.example']);
        config(['services.whatsapp_cloud' => [
            'token' => 'test-token', 'phone_number_id' => '12345', 'template' => 'order_photo',
            'template_language' => 'en', 'api_version' => 'v26.0',
        ]]);
    }

    public function test_cloud_api_sends_the_ordered_colour_photo_as_a_template_image(): void
    {
        $this->enableWhatsAppCloud();
        Http::preventStrayRequests();
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.1']]])]);
        $product = $this->product(['name' => 'Pearl Bangle', 'regular_price' => 500, 'colours' => ['Rose Gold']]);
        $product->images()->create(['path' => 'https://cdn.example/pearl.jpg', 'disk' => 'public', 'is_primary' => true]);

        $this->place([['product_id' => $product->id, 'colour' => 'Rose Gold', 'quantity' => 2]]);

        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request) => $request->url() === 'https://graph.facebook.com/v26.0/12345/messages'
            && $request->hasHeader('Authorization', 'Bearer test-token')
            && $request['to'] === '919123456789'
            && $request['type'] === 'template'
            && $request['template']['name'] === 'order_photo'
            && $request['template']['components'][0]['parameters'][0]['image']['link'] === 'https://cdn.example/pearl.jpg'
            && array_column($request['template']['components'][1]['parameters'], 'text') === [
                'ORD-000001', 'Pearl Bangle (Rose Gold)', $product->sku.'-ROSGOL', '₹500', '2', 'https://shop.example/products/'.$product->slug,
                'Priya Raman, +919876543210, +919123456789', '12, 3rd Cross Street, Velachery, Near Phoenix Mall, Chennai, Tamil Nadu, 600042', '₹1,000',
            ]);
    }

    public function test_cloud_api_also_notifies_the_shop_numbers_with_a_single_line_address(): void
    {
        $this->enableWhatsAppCloud();
        config(['services.whatsapp_cloud.notify_numbers' => '+91 90000 11111, 919123456789']);
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.1']]])]);
        $first = $this->product();
        $first->images()->create(['path' => 'https://cdn.example/one.jpg', 'disk' => 'public', 'is_primary' => true]);
        $second = $this->product();
        $second->images()->create(['path' => 'https://cdn.example/two.png', 'disk' => 'public', 'is_primary' => true]);

        $this->place([['product_id' => $first->id, 'quantity' => 1], ['product_id' => $second->id, 'quantity' => 3]], ['address' => "12, 3rd Cross Street\n  Velachery"]);

        // 2 items × (customer + shop number); the customer's number given twice is sent once.
        Http::assertSentCount(4);
        $sent = Http::recorded()->map(fn ($pair) => $pair[0]);
        $this->assertEqualsCanonicalizing(['919123456789', '919123456789', '919000011111', '919000011111'], $sent->map(fn ($r) => $r['to'])->all());
        $texts = array_column($sent->first()['template']['components'][1]['parameters'], 'text');
        $this->assertSame('12, 3rd Cross Street, Velachery, Near Phoenix Mall, Chennai, Tamil Nadu, 600042', $texts[7]);
        $this->assertSame('₹2,000', $texts[8]);
    }

    public function test_cloud_api_is_not_called_until_it_is_configured(): void
    {
        Http::fake();
        $product = $this->product();
        $product->images()->create(['path' => 'https://cdn.example/pearl.jpg', 'disk' => 'public', 'is_primary' => true]);

        $this->place([['product_id' => $product->id, 'quantity' => 1]]);

        Http::assertNothingSent();
    }

    /** @return array<string, array{0: string}> */
    public static function imagesMetaCannotAttach(): array
    {
        return [
            'webp format' => ['https://cdn.example/pearl.webp'],
            'plain http' => ['http://cdn.example/pearl.jpg'],
            'localhost' => ['https://localhost/pearl.jpg'],
        ];
    }

    #[DataProvider('imagesMetaCannotAttach')]
    public function test_cloud_api_skips_an_image_meta_could_not_attach(string $imageUrl): void
    {
        $this->enableWhatsAppCloud();
        Http::fake();
        $product = $this->product();
        $product->images()->create(['path' => $imageUrl, 'disk' => 'public', 'is_primary' => true]);

        $order = $this->place([['product_id' => $product->id, 'quantity' => 1]]);

        Http::assertNothingSent();
        $this->assertSame($imageUrl, $order->items->first()->image_url);
    }

    public function test_cloud_api_failure_does_not_fail_the_order(): void
    {
        $this->enableWhatsAppCloud();
        Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['message' => 'Template not found']], 400)]);
        $product = $this->product();
        $product->images()->create(['path' => 'https://cdn.example/pearl.jpg', 'disk' => 'public', 'is_primary' => true]);

        $order = $this->place([['product_id' => $product->id, 'quantity' => 1]]);

        Http::assertSentCount(1);
        $this->assertSame(Order::PENDING, $order->status);
    }

    public function test_admin_order_details_show_the_photo_of_the_ordered_colour(): void
    {
        $product = $this->product(['name' => 'Pearl Bangle', 'colours' => ['Gold', 'Rose Gold']]);
        $product->images()->create(['path' => 'https://cdn.example/gold.jpg', 'disk' => 'public', 'alt_text' => 'Pearl Bangle – Gold', 'is_primary' => true]);
        $product->images()->create(['path' => 'https://cdn.example/rose-gold.jpg', 'disk' => 'public', 'alt_text' => 'Pearl Bangle – Rose Gold', 'sort_order' => 1]);
        $order = $this->place([['product_id' => $product->id, 'colour' => 'Rose Gold', 'quantity' => 1]]);
        Sanctum::actingAs($this->admin);

        $this->getJson("/api/admin/orders/{$order->id}")->assertOk()
            ->assertJsonPath('data.items.0.image_url', 'https://cdn.example/rose-gold.jpg')
            ->assertJsonPath('data.items.0.colour', 'Rose Gold');
    }

    public function test_order_item_keeps_the_stored_image_path_and_resolves_it_for_the_current_environment(): void
    {
        Storage::fake('public', ['url' => 'http://localhost:8000/storage']);
        $product = $this->product();
        $product->images()->create(['path' => 'products/1/pearl.jpg', 'disk' => 'public', 'is_primary' => true]);
        $order = $this->place([['product_id' => $product->id, 'quantity' => 1]]);
        $item = $order->items->first();

        $this->assertSame(['products/1/pearl.jpg', 'public', $product->slug], [$item->image_path, $item->image_disk, $item->product_slug]);
        $this->assertSame('http://localhost:8000/storage/products/1/pearl.jpg', $item->image_url);

        // Same row, production storage URL: no localhost link baked into the order.
        Storage::fake('public', ['url' => 'https://api.shop.example/storage']);
        Sanctum::actingAs($this->admin);
        $this->getJson("/api/admin/orders/{$order->id}")->assertOk()
            ->assertJsonPath('data.items.0.image_url', 'https://api.shop.example/storage/products/1/pearl.jpg')
            ->assertJsonMissingPath('data.items.0.image_path');
    }

    public function test_replacing_or_deleting_a_product_photo_keeps_the_file_an_order_shows(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->admin);
        $product = $this->product();
        $upload = fn () => $this->post("/api/admin/products/{$product->id}/images", ['images' => [UploadedFile::fake()->image('a.jpg', 800, 800)]], ['Accept' => 'application/json'])
            ->assertOk()->json('data.images');
        $ordered = ProductImage::find($upload()[0]['id']);
        $order = $this->place([['product_id' => $product->id, 'quantity' => 1]]);
        $orderedPath = $ordered->path;

        $this->post("/api/admin/product-images/{$ordered->id}/replace", ['image' => UploadedFile::fake()->image('new.jpg', 800, 800)], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('public')->assertExists($orderedPath);
        $this->assertSame(Storage::disk('public')->url($orderedPath), $order->items()->first()->image_url);
        $this->assertNotSame($orderedPath, $ordered->fresh()->path);

        // A photo no order uses is still removed from disk.
        $unused = ProductImage::find($ordered->id);
        $this->deleteJson("/api/admin/product-images/{$unused->id}")->assertOk();
        Storage::disk('public')->assertMissing($unused->path);
        Storage::disk('public')->assertExists($orderedPath);
    }

    public function test_admin_order_items_link_to_the_public_product_page(): void
    {
        config(['shop.frontend_url' => 'https://shop.example/']);
        $first = $this->product(['slug' => 'pearl-bangle']);
        $second = $this->product(['slug' => 'kundan-bangle']);
        $order = $this->place([['product_id' => $first->id, 'quantity' => 1], ['product_id' => $second->id, 'quantity' => 2]]);
        $first->update(['slug' => 'pearl-bangle-set']);
        $second->delete();
        Sanctum::actingAs($this->admin);

        $this->getJson("/api/admin/orders/{$order->id}")->assertOk()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.product_url', 'https://shop.example/products/pearl-bangle-set')
            ->assertJsonPath('data.items.1.product_url', null)
            ->assertJsonPath('data.items.1.product_name', $second->name)
            ->assertJsonPath('data.items.1.quantity', 2);
    }
}
