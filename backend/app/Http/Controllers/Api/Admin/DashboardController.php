<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Category;
use App\Models\CustomOrderRequest;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductPriceHistory;

class DashboardController extends Controller
{
    public function __invoke()
    {
        return ['data' => [
            'stats' => [
                'total_products' => Product::count(),
                'active_products' => Product::where('is_active', true)->count(),
                'inactive_products' => Product::where('is_active', false)->count(),
                'out_of_stock_products' => Product::outOfStock()->count(),
                'sold_out_products' => Product::availability(Product::STATUS_SOLD_OUT)->count(),
                'discontinued_products' => Product::availability(Product::STATUS_DISCONTINUED)->count(),
                'low_stock_products' => Product::lowStock()->count(),
                'total_categories' => Category::count(),
                'featured_products' => Product::where('is_featured', true)->count(),
                'best_seller_products' => Product::where('is_best_seller', true)->count(),
                'running_offers' => Offer::currentlyRunning()->count(),
                'new_custom_orders' => CustomOrderRequest::where('status', 'new')->count(),
                'pending_orders' => Order::where('status', Order::PENDING)->count(),
                'open_orders' => Order::open()->count(),
                'out_for_delivery_orders' => Order::where('status', Order::OUT_FOR_DELIVERY)->count(),
                'unassigned_orders' => Order::whereIn('status', [Order::CONFIRMED, Order::PACKED])->whereNull('delivery_person_id')->whereNull('courier_name')->count(),
                'orders_today' => Order::whereDate('created_at', today())->count(),
                'delivered_this_month' => Order::where('status', Order::DELIVERED)->where('delivered_at', '>=', now()->startOfMonth())->count(),
                'revenue_this_month' => (float) Order::where('status', Order::DELIVERED)->where('delivered_at', '>=', now()->startOfMonth())->sum('total'),
            ],
            'recent_orders' => Order::with('deliveryPerson:id,name')->withCount('items')->latest('id')->limit(8)
                ->get(['id', 'order_number', 'status', 'customer_name', 'phone', 'city', 'total', 'has_price_on_request', 'delivery_person_id', 'created_at']),
            'low_stock' => ProductResource::collection(Product::with('primaryImage')->lowStock()->orderBy('stock_quantity')->limit(10)->get()),
            'out_of_stock' => ProductResource::collection(Product::with('primaryImage')->outOfStock()->latest('updated_at')->limit(10)->get()),
            'best_sellers' => ProductResource::collection(Product::with('primaryImage')->where('is_best_seller', true)->orderByDesc('views_count')->limit(5)->get()),
            'most_viewed' => ProductResource::collection(Product::with('primaryImage')->orderByDesc('views_count')->limit(5)->get()),
            'recent_updates' => ProductResource::collection(Product::with(['primaryImage', 'category'])->latest('updated_at')->limit(8)->get()),
            'recent_price_changes' => ProductPriceHistory::with(['product:id,name,sku', 'user:id,name'])->latest()->limit(8)->get(),
        ]];
    }
}
