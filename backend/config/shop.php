<?php

return [
    // Disk used for uploaded media. "public" locally; switch to "s3" (or a Cloudinary
    // flysystem driver) later without code changes – the disk is stored per record.
    'media_disk' => env('MEDIA_DISK', 'public'),
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),
    'default_currency' => env('SHOP_CURRENCY', 'INR'),
    'max_order_quantity' => (int) env('SHOP_MAX_ORDER_QTY', 50),
];
