<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Order management: every WhatsApp order placed on the website is stored here so the
 * admin can confirm it, assign a delivery person and follow it through to delivery.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_persons', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone', 20);
            $table->string('alternate_phone', 20)->nullable();
            $table->string('vehicle_type', 50)->nullable();   // bike, van, courier partner…
            $table->string('vehicle_number', 30)->nullable();
            $table->string('service_area')->nullable();       // areas / pincodes they cover
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index('is_active');
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 20)->unique();
            $table->string('status', 20)->default('pending');
            $table->string('source', 20)->default('cart');    // cart | buy_now

            // Customer & delivery address
            $table->string('customer_name');
            $table->string('phone', 20);
            $table->string('whatsapp_number', 20);
            $table->string('email')->nullable();
            $table->text('address');
            $table->string('landmark')->nullable();
            $table->string('city', 100);
            $table->string('state', 100)->nullable();
            $table->string('pincode', 10);
            $table->text('customer_notes')->nullable();

            // Money (re-priced on the server when the order is placed)
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('delivery_charge', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->boolean('has_price_on_request')->default(false);
            $table->string('currency', 3)->default('INR');
            $table->string('payment_status', 20)->default('unpaid'); // unpaid | paid | refunded
            $table->string('payment_method', 30)->nullable();        // upi, cod, bank_transfer, cash…
            $table->string('payment_reference')->nullable();

            // Delivery
            $table->foreignId('delivery_person_id')->nullable()->constrained('delivery_persons')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->string('courier_name')->nullable();
            $table->string('tracking_number')->nullable();
            $table->date('expected_delivery_date')->nullable();
            $table->text('delivery_notes')->nullable();

            // Lifecycle timestamps
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancellation_reason', 500)->nullable();
            $table->boolean('stock_deducted')->default(false);

            $table->text('admin_notes')->nullable();
            $table->text('whatsapp_message')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'created_at']);
            $table->index('phone');
            $table->index(['delivery_person_id', 'status']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->nullOnDelete();
            // Snapshot: the order keeps what was ordered even if the product changes later.
            $table->string('product_name');
            $table->string('sku', 64)->nullable();
            $table->string('image_url', 1000)->nullable();
            $table->string('colour', 100)->nullable();
            $table->string('size', 100)->nullable();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 10, 2)->nullable();      // null = price on request, not quoted yet
            $table->decimal('original_price', 10, 2)->nullable();
            $table->boolean('price_on_request')->default(false);
            $table->decimal('line_total', 10, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('event', 30);                 // placed | status_changed | assigned | unassigned | updated | payment
            $table->string('from_status', 20)->nullable();
            $table->string('status', 20);                // order status after the event
            $table->text('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // null = customer / system
            $table->timestamp('created_at')->useCurrent();
            $table->index(['order_id', 'id']);
        });
    }

    public function down(): void
    {
        foreach (['order_status_histories', 'order_items', 'orders', 'delivery_persons'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
