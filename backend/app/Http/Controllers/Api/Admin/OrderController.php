<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryPerson;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrderController extends Controller
{
    public function __construct(private OrderService $orders) {}

    public function index(Request $request)
    {
        $v = $this->filters($request);
        $v += $request->validate(['per_page' => 'nullable|integer|min:5|max:100']);

        $page = $this->query($v)
            ->with(['deliveryPerson:id,name,phone', 'items:id,order_id,product_id,product_variant_id,product_name,product_slug,sku,image_url,image_path,image_disk,colour,size,quantity'])
            ->withCount('items')->withSum('items as total_quantity', 'quantity')
            ->latest('id')
            ->paginate($v['per_page'] ?? 20);

        $counts = Order::query()->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');

        return [
            ...$page->toArray(),
            'status_counts' => collect(Order::STATUSES)->mapWithKeys(fn ($s) => [$s => (int) ($counts[$s] ?? 0)]),
            'unassigned_open' => Order::open()->whereNull('delivery_person_id')->whereNull('courier_name')->whereNot('status', Order::PENDING)->count(),
        ];
    }

    public function show(Order $order)
    {
        return ['data' => $this->detail($order)];
    }

    public function update(Request $request, Order $order)
    {
        $v = $request->validate([
            'customer_name' => 'sometimes|string|min:2|max:100',
            'phone' => 'sometimes|string|max:20',
            'whatsapp_number' => 'sometimes|string|max:20',
            'email' => 'nullable|email|max:150',
            'address' => 'sometimes|string|max:500',
            'landmark' => 'nullable|string|max:150',
            'city' => 'sometimes|string|max:100',
            'state' => 'nullable|string|max:100',
            'pincode' => ['sometimes', 'regex:/^[1-9][0-9]{5}$/'],
            'delivery_charge' => 'sometimes|numeric|min:0|max:100000',
            'discount' => 'sometimes|numeric|min:0|max:1000000',
            'payment_status' => ['sometimes', Rule::in(Order::PAYMENT_STATUSES)],
            'payment_method' => ['nullable', Rule::in(Order::PAYMENT_METHODS)],
            'payment_reference' => 'nullable|string|max:150',
            'courier_name' => 'nullable|string|max:100',
            'tracking_number' => 'nullable|string|max:100',
            'expected_delivery_date' => 'nullable|date',
            'delivery_notes' => 'nullable|string|max:2000',
            'admin_notes' => 'nullable|string|max:5000',
            'items' => 'sometimes|array',
            'items.*.id' => 'required|integer',
            'items.*.unit_price' => 'nullable|numeric|min:0|max:10000000',
        ], ['pincode.regex' => 'Please enter a valid 6-digit pincode.']);

        $this->orders->update($order, $v, $request->user());

        return ['data' => $this->detail($order)];
    }

    public function status(Request $request, Order $order)
    {
        $v = $request->validate([
            'status' => ['required', Rule::in(Order::STATUSES)],
            'note' => 'nullable|string|max:1000',
            'cancellation_reason' => 'nullable|string|max:500',
            'mark_paid' => 'sometimes|boolean',
        ]);

        $this->orders->changeStatus($order, $v['status'], $v['note'] ?? null, $request->user(), $v);

        return ['data' => $this->detail($order)];
    }

    public function assign(Request $request, Order $order)
    {
        $v = $request->validate([
            'delivery_person_id' => 'nullable|integer|exists:delivery_persons,id',
            'note' => 'nullable|string|max:500',
        ]);
        $person = isset($v['delivery_person_id']) ? DeliveryPerson::find($v['delivery_person_id']) : null;

        $this->orders->assign($order, $person, $v['note'] ?? null, $request->user());

        return ['data' => $this->detail($order)];
    }

    public function note(Request $request, Order $order)
    {
        $v = $request->validate(['note' => 'required|string|max:1000']);
        $this->orders->addNote($order, $v['note'], $request->user());

        return response()->json(['data' => $this->detail($order)], 201);
    }

    /** CSV of the filtered orders (one row per item) for accounts / delivery planning. */
    public function export(Request $request): StreamedResponse
    {
        $v = $this->filters($request);
        $query = $this->query($v)->with(['items', 'deliveryPerson'])->latest('id');

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Order No', 'Date', 'Status', 'Customer', 'Phone', 'WhatsApp', 'Address', 'Landmark', 'City', 'State', 'Pincode',
                'Product', 'Code', 'Colour', 'Size', 'Qty', 'Unit Price', 'Line Total', 'Delivery Charge', 'Discount', 'Order Total',
                'Payment', 'Payment Method', 'Delivery Person', 'Delivery Phone', 'Courier', 'Tracking No', 'Expected Delivery', 'Delivered At']);
            $query->chunk(200, function ($orders) use ($out) {
                foreach ($orders as $o) {
                    foreach ($o->items as $i => $item) {
                        $first = $i === 0;
                        fputcsv($out, array_map([self::class, 'csvSafe'], [
                            $o->order_number, $o->created_at?->format('Y-m-d H:i'), $o->status_label, $o->customer_name, $o->phone, $o->whatsapp_number,
                            $o->address, $o->landmark, $o->city, $o->state, $o->pincode,
                            $item->product_name, $item->sku, $item->colour, $item->size, $item->quantity,
                            $item->unit_price ?? 'On request', $item->line_total,
                            $first ? $o->delivery_charge : '', $first ? $o->discount : '', $first ? $o->total : '',
                            $o->payment_status, $o->payment_method, $o->deliveryPerson?->name, $o->deliveryPerson?->phone,
                            $o->courier_name, $o->tracking_number, $o->expected_delivery_date?->format('Y-m-d'), $o->delivered_at?->format('Y-m-d H:i'),
                        ]));
                    }
                }
            });
            fclose($out);
        }, 'orders-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv']);
    }

    /** Neutralise spreadsheet formula injection from customer-entered text. */
    private static function csvSafe(mixed $v): mixed
    {
        return is_string($v) && $v !== '' && in_array($v[0], ['=', '+', '-', '@', "\t", "\r"], true) && ! is_numeric($v) ? "'".$v : $v;
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'status' => ['nullable', Rule::in([...Order::STATUSES, 'open'])],
            'search' => 'nullable|string|max:100',
            'delivery_person_id' => 'nullable', // id, or "none" for unassigned
            'payment_status' => ['nullable', Rule::in(Order::PAYMENT_STATUSES)],
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);
    }

    private function query(array $v): Builder
    {
        return Order::query()
            ->when($v['status'] ?? null, fn ($q, $s) => $s === 'open' ? $q->open() : $q->where('status', $s))
            ->when($v['payment_status'] ?? null, fn ($q, $s) => $q->where('payment_status', $s))
            ->when($v['delivery_person_id'] ?? null, fn ($q, $d) => $d === 'none' ? $q->whereNull('delivery_person_id') : $q->where('delivery_person_id', (int) $d))
            ->when($v['from'] ?? null, fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($v['to'] ?? null, fn ($q, $d) => $q->whereDate('created_at', '<=', $d))
            ->when(trim((string) ($v['search'] ?? '')), function ($q, $term) {
                $digits = preg_replace('/\D+/', '', $term);
                $q->where(function ($q) use ($term, $digits) {
                    $q->where('order_number', 'like', "%{$term}%")
                        ->orWhere('customer_name', 'like', "%{$term}%")
                        ->orWhere('city', 'like', "%{$term}%")
                        ->orWhere('pincode', $term)
                        ->orWhereHas('items', fn ($i) => $i->where('sku', 'like', "%{$term}%"));
                    if (strlen($digits) >= 4) {
                        $q->orWhere('phone', 'like', "%{$digits}%")->orWhere('whatsapp_number', 'like', "%{$digits}%");
                    }
                });
            });
    }

    private function detail(Order $order): Order
    {
        // items.product: the product link follows the product's current slug.
        return $order->fresh()->load(['items.product:id,slug,deleted_at', 'deliveryPerson', 'histories.user:id,name']);
    }
}
