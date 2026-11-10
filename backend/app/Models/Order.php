<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use SoftDeletes;

    public const PENDING = 'pending';

    public const CONFIRMED = 'confirmed';

    public const PACKED = 'packed';

    public const OUT_FOR_DELIVERY = 'out_for_delivery';

    public const DELIVERED = 'delivered';

    public const CANCELLED = 'cancelled';

    public const RETURNED = 'returned';

    public const STATUSES = [self::PENDING, self::CONFIRMED, self::PACKED, self::OUT_FOR_DELIVERY, self::DELIVERED, self::CANCELLED, self::RETURNED];

    public const LABELS = [
        self::PENDING => 'Pending',
        self::CONFIRMED => 'Confirmed',
        self::PACKED => 'Packed',
        self::OUT_FOR_DELIVERY => 'Out for Delivery',
        self::DELIVERED => 'Delivered',
        self::CANCELLED => 'Cancelled',
        self::RETURNED => 'Returned',
    ];

    /** Allowed next statuses. Cancelled and returned are final. */
    public const TRANSITIONS = [
        self::PENDING => [self::CONFIRMED, self::CANCELLED],
        self::CONFIRMED => [self::PACKED, self::OUT_FOR_DELIVERY, self::CANCELLED],
        self::PACKED => [self::OUT_FOR_DELIVERY, self::CANCELLED],
        // Back to "packed" = delivery attempt failed, to be re-attempted.
        self::OUT_FOR_DELIVERY => [self::DELIVERED, self::PACKED, self::RETURNED, self::CANCELLED],
        self::DELIVERED => [self::RETURNED],
        self::CANCELLED => [],
        self::RETURNED => [],
    ];

    /** Orders still being worked on (shown as "open"). */
    public const OPEN = [self::PENDING, self::CONFIRMED, self::PACKED, self::OUT_FOR_DELIVERY];

    public const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

    public const PAYMENT_METHODS = ['upi', 'cod', 'bank_transfer', 'cash', 'other'];

    protected $attributes = ['status' => self::PENDING, 'source' => 'cart', 'payment_status' => 'unpaid', 'currency' => 'INR',
        'subtotal' => 0, 'delivery_charge' => 0, 'discount' => 0, 'total' => 0, 'has_price_on_request' => false, 'stock_deducted' => false];

    protected $fillable = [
        'order_number', 'status', 'source', 'customer_name', 'phone', 'whatsapp_number', 'email', 'address', 'landmark', 'city', 'state', 'pincode',
        'customer_notes', 'subtotal', 'delivery_charge', 'discount', 'total', 'has_price_on_request', 'currency',
        'payment_status', 'payment_method', 'payment_reference', 'delivery_person_id', 'assigned_at', 'courier_name', 'tracking_number',
        'expected_delivery_date', 'delivery_notes', 'confirmed_at', 'dispatched_at', 'delivered_at', 'cancelled_at', 'cancellation_reason',
        'stock_deducted', 'admin_notes', 'whatsapp_message', 'ip_address',
    ];

    protected $hidden = ['ip_address'];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'delivery_charge' => 'decimal:2',
        'discount' => 'decimal:2',
        'total' => 'decimal:2',
        'has_price_on_request' => 'boolean',
        'stock_deducted' => 'boolean',
        'assigned_at' => 'datetime',
        'expected_delivery_date' => 'date:Y-m-d',
        'confirmed_at' => 'datetime',
        'dispatched_at' => 'datetime',
        'delivered_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    protected $appends = ['status_label', 'next_statuses'];

    public function items()
    {
        return $this->hasMany(OrderItem::class)->orderBy('id');
    }

    public function histories()
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('id');
    }

    public function deliveryPerson()
    {
        return $this->belongsTo(DeliveryPerson::class)->withTrashed();
    }

    public function getStatusLabelAttribute(): string
    {
        return self::LABELS[$this->status] ?? $this->status;
    }

    public function getNextStatusesAttribute(): array
    {
        return self::TRANSITIONS[$this->status] ?? [];
    }

    public function canTransitionTo(string $status): bool
    {
        return in_array($status, self::TRANSITIONS[$this->status] ?? [], true);
    }

    public function isClosed(): bool
    {
        return in_array($this->status, [self::DELIVERED, self::CANCELLED, self::RETURNED], true);
    }

    public function scopeOpen(Builder $q): Builder
    {
        return $q->whereIn('status', self::OPEN);
    }

    /** Subtotal of priced lines + delivery − discount. Never negative. */
    public function recalculateTotals(): void
    {
        $items = $this->relationLoaded('items') ? $this->items : $this->items()->get();
        $this->subtotal = round((float) $items->sum('line_total'), 2);
        $this->has_price_on_request = $items->contains(fn (OrderItem $i) => $i->unit_price === null);
        $this->total = max(0, round((float) $this->subtotal + (float) $this->delivery_charge - (float) $this->discount, 2));
    }
}
