<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryPerson extends Model
{
    use SoftDeletes;

    protected $table = 'delivery_persons';

    protected $attributes = ['is_active' => true];

    protected $fillable = ['name', 'phone', 'alternate_phone', 'vehicle_type', 'vehicle_number', 'service_area', 'notes', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
