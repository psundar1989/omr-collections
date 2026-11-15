<?php

namespace App\Services;

use App\Jobs\SendOrderItemImageOnWhatsApp;
use App\Models\DeliveryPerson;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Order lifecycle. Every change goes through here so the status history is always complete:
 * placing an order, status changes (with stock deduction / restoration), delivery assignment
 * and admin edits each write a timeline entry.
 */
class OrderService
{
    public function __construct(private CartQuoteService $quotes, private SettingsService $settings, private WhatsAppCloudService $whatsAppCloud) {}

    /**
     * Re-price the cart and store the order. Returns [order|null, quote]; the order is null
     * when the cart is not valid (the quote then explains which lines need attention).
     */
    public function place(array $items, array $customer, string $source = 'cart', ?string $ip = null): array
    {
        $quote = $this->quotes->quote($items);
        if (! $quote['valid']) {
            return [null, $quote];
        }

        $order = DB::transaction(function () use ($quote, $customer, $source, $ip) {
            $order = Order::create([
                'order_number' => 'TMP-'.bin2hex(random_bytes(6)),
                'source' => $source,
                'customer_name' => $customer['customer_name'],
                'phone' => $customer['phone'],
                'whatsapp_number' => $customer['whatsapp_number'] ?: $customer['phone'],
                'email' => $customer['email'] ?? null,
                'address' => $customer['address'],
                'landmark' => $customer['landmark'] ?? null,
                'city' => $customer['city'],
                'state' => $customer['state'] ?? null,
                'pincode' => $customer['pincode'],
                'customer_notes' => $customer['notes'] ?? null,
                'currency' => $quote['currency'] ?: 'INR',
                'ip_address' => $ip,
            ]);
            $order->order_number = self::orderNumber($order->id);

            foreach ($quote['items'] as $line) {
                $order->items()->create([
                    'product_id' => $line['product_id'],
                    'product_variant_id' => $line['variant_id'],
                    'product_name' => $line['name'],
                    'product_slug' => $line['slug'],
                    'sku' => $line['sku'],
                    'image_url' => $line['image_url'],
                    'image_path' => $line['image_path'],
                    'image_disk' => $line['image_disk'],
                    'colour' => $line['colour'],
                    'size' => $line['size'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['price_on_request'] ? null : $line['unit_price'],
                    'original_price' => $line['price_on_request'] ? null : $line['original_price'],
                    'price_on_request' => $line['price_on_request'],
                    'line_total' => $line['line_total'],
                ]);
            }

            $order->load('items');
            $order->recalculateTotals();
            $symbol = $this->settings->get('currency_symbol', '₹');
            $order->whatsapp_message = $this->quotes->buildMessage($quote['items'], (float) $order->subtotal, $symbol, [
                ...$customer,
                'whatsapp_number' => $order->whatsapp_number !== $order->phone ? $order->whatsapp_number : null,
            ], $order->order_number);
            $order->save();

            $this->log($order, 'placed', null, 'Order placed on the website via WhatsApp.');

            return $order;
        });

        $this->queueProductPhotos($order);

        return [$order, $quote];
    }

    /**
     * Send each product photo as a real WhatsApp attachment when the Cloud API is configured.
     * The order is already saved, so a problem here must never fail the checkout.
     */
    private function queueProductPhotos(Order $order): void
    {
        if (! $this->whatsAppCloud->isEnabled()) {
            return;
        }

        rescue(function () use ($order) {
            $recipients = $this->whatsAppCloud->recipients($order);
            foreach ($order->items as $item) {
                if ($this->whatsAppCloud->attachableImageUrl($item)) {
                    foreach ($recipients as $to) {
                        SendOrderItemImageOnWhatsApp::dispatch($item, $to);
                    }
                } else {
                    Log::warning('WhatsApp photo not sent: the image must be a public HTTPS JPEG or PNG.', ['order_item_id' => $item->id, 'image_url' => $item->image_url]);
                }
            }
        });
    }

    public static function orderNumber(int $id): string
    {
        return config('shop.order_prefix', 'ORD').'-'.str_pad((string) $id, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Move an order to a new status. Confirming deducts stock; cancelling or returning a
     * confirmed order puts it back.
     *
     * @throws ValidationException
     */
    public function changeStatus(Order $order, string $status, ?string $note, ?User $user, array $extra = []): Order
    {
        return DB::transaction(function () use ($order, $status, $note, $user, $extra) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            $from = $order->status;

            if (! $order->canTransitionTo($status)) {
                throw ValidationException::withMessages(['status' => 'An order that is '.Order::LABELS[$from].' cannot be changed to '.(Order::LABELS[$status] ?? $status).'.']);
            }
            if ($status === Order::CANCELLED && blank($extra['cancellation_reason'] ?? $note)) {
                throw ValidationException::withMessages(['cancellation_reason' => 'Please give a reason for cancelling.']);
            }
            if (in_array($status, [Order::PACKED, Order::OUT_FOR_DELIVERY, Order::DELIVERED], true) && $order->items()->whereNull('unit_price')->exists()) {
                throw ValidationException::withMessages(['status' => 'Set a price for every "price on request" item before continuing.']);
            }

            $now = now();
            if ($status === Order::CONFIRMED) {
                $this->deductStock($order);
                $order->confirmed_at = $now;
            }
            if ($status === Order::OUT_FOR_DELIVERY) {
                if (! $order->delivery_person_id && blank($order->courier_name)) {
                    throw ValidationException::withMessages(['status' => 'Assign a delivery person (or enter a courier) before sending the order out for delivery.']);
                }
                $order->dispatched_at = $now;
            }
            if ($status === Order::DELIVERED) {
                $order->delivered_at = $now;
                if (($extra['mark_paid'] ?? false) && $order->payment_status === 'unpaid') {
                    $order->payment_status = 'paid';
                }
            }
            if (in_array($status, [Order::CANCELLED, Order::RETURNED], true)) {
                $this->restoreStock($order);
                if ($status === Order::CANCELLED) {
                    $order->cancelled_at = $now;
                    $order->cancellation_reason = $extra['cancellation_reason'] ?? $note;
                }
            }

            $order->status = $status;
            $order->save();
            $this->log($order, 'status_changed', $from, $note ?: ($status === Order::CANCELLED ? $order->cancellation_reason : null), $user);

            return $order;
        });
    }

    public function assign(Order $order, ?DeliveryPerson $person, ?string $note, ?User $user): Order
    {
        if ($order->isClosed()) {
            throw ValidationException::withMessages(['delivery_person_id' => 'This order is already '.strtolower($order->status_label).'.']);
        }
        if ($person && ! $person->is_active) {
            throw ValidationException::withMessages(['delivery_person_id' => "{$person->name} is marked inactive."]);
        }
        if ($person?->id === $order->delivery_person_id) {
            return $order;
        }

        return DB::transaction(function () use ($order, $person, $note, $user) {
            $previous = $order->deliveryPerson;
            $order->forceFill(['delivery_person_id' => $person?->id, 'assigned_at' => $person ? now() : null])->save();

            $text = $person
                ? ($previous ? "Delivery reassigned from {$previous->name} to {$person->name} ({$person->phone})." : "Assigned to {$person->name} ({$person->phone}).")
                : "Delivery person {$previous?->name} unassigned.";
            $this->log($order, $person ? 'assigned' : 'unassigned', null, trim($text.' '.($note ?? '')), $user);

            return $order->setRelation('deliveryPerson', $person);
        });
    }

    /**
     * Admin edits: customer / address, charges, payment, delivery info and prices for
     * "price on request" lines. Items cannot change once the order is closed.
     */
    public function update(Order $order, array $data, ?User $user): Order
    {
        return DB::transaction(function () use ($order, $data, $user) {
            $itemPrices = $data['items'] ?? null;
            unset($data['items']);

            $changes = [];
            if ($itemPrices) {
                if ($order->isClosed()) {
                    throw ValidationException::withMessages(['items' => 'Prices cannot be changed on a closed order.']);
                }
                $symbol = $this->settings->get('currency_symbol', '₹');
                foreach ($itemPrices as $row) {
                    /** @var OrderItem|null $item */
                    $item = $order->items()->whereKey($row['id'])->first();
                    if (! $item) {
                        throw ValidationException::withMessages(['items' => 'Item not found on this order.']);
                    }
                    $price = $row['unit_price'] === null ? null : round((float) $row['unit_price'], 2);
                    if ($price === ($item->unit_price === null ? null : (float) $item->unit_price)) {
                        continue;
                    }
                    $item->update(['unit_price' => $price, 'line_total' => $price === null ? 0 : round($price * $item->quantity, 2)]);
                    $changes[] = "{$item->product_name}: ".($price === null ? 'price on request' : Money::format($price, $symbol));
                }
            }

            $paymentChanged = array_key_exists('payment_status', $data) && $data['payment_status'] !== $order->payment_status;
            $order->fill($data);
            $dirty = array_keys($order->getDirty());
            $order->load('items');
            $order->recalculateTotals();
            $order->save();

            if ($paymentChanged) {
                $this->log($order, 'payment', null, 'Payment marked '.$order->payment_status.($order->payment_method ? " ({$order->payment_method})" : '').'.', $user);
                $dirty = array_diff($dirty, ['payment_status', 'payment_method', 'payment_reference']);
            }
            $dirty = array_diff($dirty, ['admin_notes']); // private notes are not timeline events
            if ($dirty || $changes) {
                $fields = array_map(fn ($f) => str_replace('_', ' ', $f), $dirty);
                $this->log($order, 'updated', null, trim(($fields ? 'Updated '.implode(', ', $fields).'. ' : '').($changes ? 'Prices: '.implode('; ', $changes).'.' : '')), $user);
            }

            return $order;
        });
    }

    public function addNote(Order $order, string $note, ?User $user): OrderStatusHistory
    {
        return $this->log($order, 'note', null, $note, $user);
    }

    private function log(Order $order, string $event, ?string $from, ?string $note, ?User $user = null): OrderStatusHistory
    {
        return $order->histories()->create([
            'event' => $event, 'from_status' => $from, 'status' => $order->status, 'note' => $note ?: null, 'user_id' => $user?->id,
        ]);
    }

    /** Take the ordered quantities out of stock (tracked products only). All-or-nothing. */
    private function deductStock(Order $order): void
    {
        if ($order->stock_deducted) {
            return;
        }
        $short = [];
        foreach ($order->items()->get() as $item) {
            [$row, $label] = $this->stockRow($item);
            if (! $row) {
                continue;
            }
            if ($row->stock_quantity < $item->quantity) {
                $short[] = "{$label}: only {$row->stock_quantity} in stock, {$item->quantity} ordered";

                continue;
            }
            $row->decrement('stock_quantity', $item->quantity);
        }
        if ($short) {
            throw ValidationException::withMessages(['status' => 'Not enough stock to confirm – '.implode('; ', $short).'. Update stock first.']);
        }
        $order->stock_deducted = true;
    }

    private function restoreStock(Order $order): void
    {
        if (! $order->stock_deducted) {
            return;
        }
        foreach ($order->items()->get() as $item) {
            [$row] = $this->stockRow($item);
            $row?->increment('stock_quantity', $item->quantity);
        }
        $order->stock_deducted = false;
    }

    /** The locked row whose stock this item uses (variant or product), or null when stock is not tracked. */
    private function stockRow(OrderItem $item): array
    {
        $product = $item->product_id ? Product::withTrashed()->whereKey($item->product_id)->lockForUpdate()->first() : null;
        if (! $product || ! $product->track_stock) {
            return [null, null];
        }
        $variant = $item->product_variant_id ? ProductVariant::whereKey($item->product_variant_id)->lockForUpdate()->first() : null;
        $label = $item->product_name.($item->colour || $item->size ? ' ('.implode(' / ', array_filter([$item->colour, $item->size])).')' : '');

        return [$variant ?? $product, $label];
    }
}
