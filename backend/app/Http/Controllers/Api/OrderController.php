<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomOrderRequest;
use App\Services\CartQuoteService;
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
