<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryPerson;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class DeliveryPersonController extends Controller
{
    public function index(Request $request)
    {
        $v = $request->validate(['active' => 'nullable|boolean', 'search' => 'nullable|string|max:100']);

        return ['data' => DeliveryPerson::query()
            ->when(isset($v['active']), fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->when($v['search'] ?? null, fn ($q, $t) => $q->where(fn ($q) => $q->where('name', 'like', "%{$t}%")->orWhere('phone', 'like', "%{$t}%")->orWhere('service_area', 'like', "%{$t}%")))
            ->withCount([
                'orders as active_orders_count' => fn ($q) => $q->whereIn('status', Order::OPEN),
                'orders as delivered_orders_count' => fn ($q) => $q->where('status', Order::DELIVERED),
            ])
            ->orderByDesc('is_active')->orderBy('name')
            ->get()];
    }

    public function show(DeliveryPerson $deliveryPerson)
    {
        return ['data' => [
            ...$deliveryPerson->toArray(),
            'orders' => $deliveryPerson->orders()->latest('id')->limit(50)
                ->get(['id', 'order_number', 'status', 'customer_name', 'city', 'pincode', 'total', 'assigned_at', 'delivered_at', 'created_at']),
        ]];
    }

    public function store(Request $request)
    {
        return response()->json(['data' => DeliveryPerson::create($this->validated($request))], 201);
    }

    public function update(Request $request, DeliveryPerson $deliveryPerson)
    {
        $deliveryPerson->update($this->validated($request, true));

        return ['data' => $deliveryPerson];
    }

    public function destroy(DeliveryPerson $deliveryPerson)
    {
        if ($deliveryPerson->orders()->whereIn('status', Order::OPEN)->exists()) {
            throw ValidationException::withMessages(['delivery_person' => "{$deliveryPerson->name} still has open orders. Reassign them first, or mark the person inactive."]);
        }
        $deliveryPerson->delete(); // soft delete: past orders keep showing who delivered them

        return response()->noContent();
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';
        $phone = 'regex:/^(\+?91[\s-]?)?0?[6-9]\d{4}[\s-]?\d{5}$/';
        $v = $request->validate([
            'name' => "{$req}|string|max:100",
            'phone' => [$req, 'string', $phone],
            'alternate_phone' => ['nullable', 'string', $phone],
            'vehicle_type' => 'nullable|string|max:50',
            'vehicle_number' => 'nullable|string|max:30',
            'service_area' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
            'is_active' => 'sometimes|boolean',
        ], ['phone.regex' => 'Please enter a valid 10-digit mobile number.', 'alternate_phone.regex' => 'Please enter a valid 10-digit mobile number.']);

        foreach (['phone', 'alternate_phone'] as $k) {
            if (filled($v[$k] ?? null)) {
                $v[$k] = '+91'.substr(preg_replace('/\D+/', '', $v[$k]), -10);
            }
        }

        return $v;
    }
}
