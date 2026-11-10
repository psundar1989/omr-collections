<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only timeline of everything that happened to an order. */
class OrderStatusHistory extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['order_id', 'event', 'from_status', 'status', 'note', 'user_id'];

    protected $casts = ['created_at' => 'datetime'];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
