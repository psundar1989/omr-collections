<?php

return [
    // Disk used for uploaded media. "public" locally; switch to "s3" (or a Cloudinary
    // flysystem driver) later without code changes – the disk is stored per record.
    'media_disk' => env('MEDIA_DISK', 'public'),
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),
    'default_currency' => env('SHOP_CURRENCY', 'INR'),
    // Prefix of website order numbers, e.g. ORD-000042.
    'order_prefix' => env('SHOP_ORDER_PREFIX', 'ORD'),
    'max_order_quantity' => (int) env('SHOP_MAX_ORDER_QTY', 50),

    /*
     * SKUs: OMR-<CATEGORY>-<NUMBER>[-<SIZE>][-<COLOUR>], e.g. OMR-BG-001, OMR-BG-001-24-RED.
     * The category code is stored on the category (Admin → Categories). These defaults are
     * used the first time a category needs a code; any other category gets one derived from
     * its name (e.g. "Hair Clips" → HC).
     */
    'sku_prefix' => env('SHOP_SKU_PREFIX', 'OMR'),
    'sku_category_codes' => [
        'bangles' => 'BG',
        'silk-thread-jhumka' => 'JH',
        'alligator-clips' => 'AC',
        'coin-alligator-clips' => 'CA',
        'centre-clips' => 'CC',
        'hairbands' => 'HB',
        'headbands' => 'HD',
        'fabric-hair-accessories' => 'FH',
        'jasmine-hair-accessories' => 'JS',
        'u-pins' => 'UP',
        'brooch-pins' => 'BP',
        'saree-pins' => 'SP',
        'haldi-kumkum-sets' => 'HK',
        'invisible-chains' => 'IC',
        'keychains' => 'KC',
        'rings' => 'RG',
        'bracelets' => 'BR',
        'rakhis' => 'RK',
        'fancy-earrings' => 'FE',
        'stud-earrings' => 'SE',
        'traditional-earrings' => 'TE',
    ],

    // Admin product image uploads: maximum file size and minimum width/height.
    'image_max_kb' => (int) env('SHOP_IMAGE_MAX_KB', 8192),
    'image_min_px' => 300,
];
