<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomOrderRequest;
use App\Models\Order;
use App\Services\CartQuoteService;
use App\Services\OrderService;
use App\Services\SettingsService;
use App\Support\Media;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    /**
     * Re-price the cart on the server and return the authoritative totals plus
     * the WhatsApp click-to-chat URL. No payment is collected.
     */
    public function quote(Request $request, CartQuoteService $quotes)
    {
        $max = config('shop.max_order_quantity');
        $v = $request->validate([
            'items' => 'required|array|min:1|max:50',
            'items.*.key' => 'nullable|string|max:100',
            'items.*.product_id' => 'required|integer',
            'items.*.variant_id' => 'nullable|integer',
            'items.*.colour' => 'nullable|string|max:100',
            'items.*.size' => 'nullable|string|max:100',
            'items.*.quantity' => "required|integer|min:1|max:{$max}",
            'customer_name' => 'nullable|string|max:100',
            'delivery_location' => 'nullable|string|max:300',
            'pincode' => ['nullable', 'regex:/^[1-9][0-9]{5}$/'],
            'notes' => 'nullable|string|max:500',
        ], ['pincode.regex' => 'Please enter a valid 6-digit Indian pincode.', 'items.*.quantity.max' => "You can order at most {$max} of one item."]);

        return ['data' => $quotes->quote($v['items'], $v)];
    }

    /**
     * Place an order: re-price the cart, store it with the customer's delivery details and
     * return the WhatsApp URL whose message carries the order number. 422 with the quote
     * when some line can no longer be ordered.
     */
    public function store(Request $request, OrderService $orders, SettingsService $settings)
    {
        $max = config('shop.max_order_quantity');
        $phone = ['regex:/^(\+?91[\s-]?)?0?[6-9]\d{4}[\s-]?\d{5}$/'];
        $v = $request->validate([
            'items' => 'required|array|min:1|max:50',
            'items.*.key' => 'nullable|string|max:100',
            'items.*.product_id' => 'required|integer',
            'items.*.variant_id' => 'nullable|integer',
            'items.*.colour' => 'nullable|string|max:100',
            'items.*.size' => 'nullable|string|max:100',
            'items.*.quantity' => "required|integer|min:1|max:{$max}",
            'source' => 'nullable|in:cart,buy_now',
            'customer_name' => 'required|string|min:2|max:100',
            'phone' => ['required', 'string', ...$phone],
            'whatsapp_number' => ['nullable', 'string', ...$phone],
            'email' => 'nullable|email|max:150',
            'address' => 'required|string|min:5|max:500',
            'landmark' => 'nullable|string|max:150',
            'city' => 'required|string|max:100',
            'state' => 'nullable|string|max:100',
            'pincode' => ['required', 'regex:/^[1-9][0-9]{5}$/'],
            'notes' => 'nullable|string|max:500',
        ], [
            'pincode.regex' => 'Please enter a valid 6-digit Indian pincode.',
            'phone.regex' => 'Please enter a valid 10-digit Indian mobile number.',
            'whatsapp_number.regex' => 'Please enter a valid 10-digit Indian mobile number.',
            'items.*.quantity.max' => "You can order at most {$max} of one item.",
        ]);

        $customer = collect($v)->except(['items', 'source'])->map(fn ($x) => is_string($x) ? trim($x) : $x)->all();
        $customer['phone'] = self::normalisePhone($customer['phone']);
        $customer['whatsapp_number'] = filled($customer['whatsapp_number'] ?? null) ? self::normalisePhone($customer['whatsapp_number']) : null;

        [$order, $quote] = $orders->place($v['items'], $customer, $v['source'] ?? 'cart', $request->ip());
        if (! $order) {
            return response()->json(['message' => 'Some items need your attention before ordering.', 'errors' => ['items' => ['Some items need your attention before ordering.']], 'data' => ['quote' => $quote]], 422);
        }

        return response()->json(['data' => [
            'order_number' => $order->order_number,
            'status' => $order->status,
            'total' => (float) $order->total,
            'has_price_on_request' => $order->has_price_on_request,
            'message' => $order->whatsapp_message,
            'whatsapp_url' => $settings->whatsappUrl($order->whatsapp_message),
            'quote' => $quote,
        ]], 201);
    }

    /**
     * Customer order tracking. The phone number used at checkout must match, so order
     * numbers alone reveal nothing. Internal notes are never returned.
     */
    public function track(Request $request)
    {
        $v = $request->validate([
            'order_number' => 'required|string|max:30',
            'phone' => 'required|string|max:20',
        ]);
        $digits = substr(preg_replace('/\D+/', '', $v['phone']), -10);
        $order = Order::with(['items', 'histories', 'deliveryPerson'])->where('order_number', strtoupper(trim($v['order_number'])))->first();

        if (! $order || strlen($digits) !== 10 || substr(preg_replace('/\D+/', '', $order->phone), -10) !== $digits) {
            return response()->json(['message' => 'No order found with that order number and phone number.'], 404);
        }

        $showCourier = in_array($order->status, [Order::OUT_FOR_DELIVERY, Order::DELIVERED], true);

        return ['data' => [
            'order_number' => $order->order_number,
            'status' => $order->status,
            'status_label' => $order->status_label,
            'placed_at' => $order->created_at,
            'expected_delivery_date' => $order->expected_delivery_date?->format('Y-m-d'),
            'delivered_at' => $order->delivered_at,
            'cancellation_reason' => $order->status === Order::CANCELLED ? $order->cancellation_reason : null,
            'customer_name' => $order->customer_name,
            'city' => $order->city,
            'pincode' => $order->pincode,
            'items' => $order->items->map->only(['product_name', 'sku', 'image_url', 'colour', 'size', 'quantity', 'unit_price', 'line_total']),
            'subtotal' => (float) $order->subtotal,
            'delivery_charge' => (float) $order->delivery_charge,
            'discount' => (float) $order->discount,
            'total' => (float) $order->total,
            'has_price_on_request' => $order->has_price_on_request,
            'payment_status' => $order->payment_status,
            'delivery' => $showCourier ? [
                'person_name' => $order->deliveryPerson?->name,
                'person_phone' => $order->status === Order::OUT_FOR_DELIVERY ? $order->deliveryPerson?->phone : null,
                'courier_name' => $order->courier_name,
                'tracking_number' => $order->tracking_number,
            ] : null,
            'timeline' => $order->histories->whereIn('event', ['placed', 'status_changed'])->values()->map(fn ($h) => [
                'status' => $h->status, 'label' => Order::LABELS[$h->status] ?? $h->status, 'at' => $h->created_at,
            ]),
        ]];
    }

    private static function normalisePhone(string $phone): string
    {
        return '+91'.substr(preg_replace('/\D+/', '', $phone), -10);
    }

    public function customOrder(Request $request, SettingsService $settings)
    {
        $v = $request->validate([
            'customer_name' => 'required|string|max:100',
            'whatsapp_number' => ['required', 'string', 'regex:/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/'],
            'product_type' => 'required|string|max:120',
            'preferred_colour' => 'nullable|string|max:100',
            'size' => 'nullable|string|max:100',
            'description' => 'required|string|max:2000',
            'reference_image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
        ], ['whatsapp_number.regex' => 'Please enter a valid 10-digit Indian mobile number.']);

        $digits = preg_replace('/\D+/', '', $v['whatsapp_number']);
        $v['whatsapp_number'] = '+91'.substr($digits, -10);

        if ($request->hasFile('reference_image')) {
            [$v['reference_image_path'], $v['reference_image_disk']] = Media::store($request->file('reference_image'), 'custom-orders');
        }
        unset($v['reference_image']);

        $order = CustomOrderRequest::create($v);

        $lines = [
            'Hello! I would like to request a *custom handmade order*.',
            '',
            'Request No: CO-'.str_pad((string) $order->id, 5, '0', STR_PAD_LEFT),
            'Name: '.$order->customer_name,
            'WhatsApp: '.$order->whatsapp_number,
            'Product Type: '.$order->product_type,
        ];
        if ($order->preferred_colour) {
            $lines[] = 'Preferred Colour: '.$order->preferred_colour;
        }
        if ($order->size) {
            $lines[] = 'Size: '.$order->size;
        }
        $lines[] = '';
        $lines[] = 'Customisation Details:';
        $lines[] = $order->description;
        if ($order->reference_image_url) {
            $lines[] = '';
            $lines[] = 'Reference Image: '.$order->reference_image_url;
        }
        $lines[] = '';
        $lines[] = 'Please share the price and delivery time. Thank you!';
        $message = implode("\n", $lines);

        return response()->json(['data' => [
            'id' => $order->id,
            'message' => $message,
            'whatsapp_url' => $settings->whatsappUrl($message),
        ]], 201);
    }
}
