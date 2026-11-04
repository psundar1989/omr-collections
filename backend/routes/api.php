<?php

use App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\OrderController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public storefront API  (prefix: /api)
|--------------------------------------------------------------------------
*/
Route::middleware('throttle:api')->group(function () {
    Route::get('settings', [CatalogController::class, 'settings']);
    Route::get('home', [CatalogController::class, 'home']);
    Route::get('categories', [CatalogController::class, 'categories']);
    Route::get('categories/{slug}', [CatalogController::class, 'category']);
    Route::get('products', [CatalogController::class, 'products']);
    Route::get('products/by-ids', [CatalogController::class, 'productsByIds']);
    Route::get('products/{slug}', [CatalogController::class, 'product']);
    Route::post('products/{product}/view', [CatalogController::class, 'recordView']);
    Route::get('sitemap', [CatalogController::class, 'sitemap']);

    Route::post('cart/quote', [OrderController::class, 'quote']);
});
Route::post('custom-orders', [OrderController::class, 'customOrder'])->middleware('throttle:public-forms');

/*
|--------------------------------------------------------------------------
| Admin API  (prefix: /api/admin) – Sanctum token + is_admin required
|--------------------------------------------------------------------------
*/
Route::prefix('admin')->group(function () {
    Route::post('login', [Admin\AuthController::class, 'login'])->middleware('throttle:admin-login');

    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
        Route::get('me', [Admin\AuthController::class, 'me']);
        Route::post('logout', [Admin\AuthController::class, 'logout']);
        Route::post('change-password', [Admin\AuthController::class, 'changePassword']);

        Route::get('dashboard', Admin\DashboardController::class);

        Route::post('categories/reorder', [Admin\CategoryController::class, 'reorder']);
        Route::apiResource('categories', Admin\CategoryController::class);

        Route::apiResource('products', Admin\ProductController::class);
        Route::patch('products/{product}/flags', [Admin\ProductController::class, 'flags']);
        Route::patch('products/{product}/stock', [Admin\ProductController::class, 'stock']);
        Route::patch('products/{product}/price', [Admin\ProductController::class, 'price']);
        Route::get('products/{product}/price-history', [Admin\ProductController::class, 'priceHistory']);
        Route::post('products/{product}/images', [Admin\ProductController::class, 'uploadImages']);
        Route::post('products/{product}/images/reorder', [Admin\ProductController::class, 'reorderImages']);
        Route::patch('product-images/{image}', [Admin\ProductController::class, 'updateImage']);
        Route::post('product-images/{image}/primary', [Admin\ProductController::class, 'setPrimaryImage']);
        Route::delete('product-images/{image}', [Admin\ProductController::class, 'deleteImage']);

        Route::post('prices/bulk/preview', [Admin\PriceController::class, 'preview']);
        Route::post('prices/bulk/apply', [Admin\PriceController::class, 'apply']);
        Route::get('prices/history', [Admin\PriceController::class, 'history']);

        Route::post('banners/reorder', [Admin\BannerController::class, 'reorder']);
        Route::apiResource('banners', Admin\BannerController::class)->except('show');

        Route::apiResource('offers', Admin\OfferController::class);

        Route::get('settings', [Admin\SettingController::class, 'show']);
        Route::put('settings', [Admin\SettingController::class, 'update']);
        Route::post('settings/upload', [Admin\SettingController::class, 'upload']);

        Route::get('custom-orders', [Admin\CustomOrderController::class, 'index']);
        Route::patch('custom-orders/{customOrder}', [Admin\CustomOrderController::class, 'update']);
        Route::delete('custom-orders/{customOrder}', [Admin\CustomOrderController::class, 'destroy']);
    });
});
