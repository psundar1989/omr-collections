# API Reference

Base URL: `http://localhost:8000/api` · JSON in/out · send `Accept: application/json`.
Validation errors return **422** `{ message, errors: { field: [msg] } }`.

## Public (storefront)

| Method | Path | Description |
|---|---|---|
| GET | `/settings` | Public website settings (business name, WhatsApp number, logo_url, testimonials…) |
| GET | `/home` | `banners, categories, featured, new_arrivals, best_sellers, special_offers` |
| GET | `/categories` | Active categories in display order (with `products_count`) |
| GET | `/categories/{slug}` | One active category |
| GET | `/catalog` | **All** visible products (enabled, in an active category) in one list, newest first, plus `meta.total`. The storefront builds the shop, collection, new-arrival and wishlist listings from it |
| GET | `/products` | Product listing (see query below) — paginated, plus `meta_extra.min_price/max_price` |
| GET | `/products/{slug}` | Product detail with `images`, `variants`; `related` (4) |
| GET | `/products/by-ids?ids[]=1&ids[]=2` | Specific active products (wishlist / recently viewed) |
| GET | `/products/by-ids?skus[]=product-001` | Same, by product code (photo-catalogue cards load live prices this way; ≤ 50) |
| POST | `/products/{id}/view` | Count a view (used for "popular" sort) |
| GET | `/sitemap` | Slugs + `updated_at` for products and categories |
| POST | `/cart/quote` | Server-side cart pricing + WhatsApp link |
| POST | `/custom-orders` | Custom order request (multipart) → WhatsApp link |
| POST | `/orders` | Place an order (cart or buy-now) with delivery details → stored order + WhatsApp link |
| POST | `/orders/track` | Customer order tracking by `order_number` + `phone` |

### `GET /products` query

`category` (slug) · `search` (name, SKU, category, material) · `min_price` · `max_price` ·
`availability=in_stock|out_of_stock` (in stock = status `available` and stock available; out of stock = sold out, discontinued or no stock) · `new=1` · `best_seller=1` · `featured=1` · `on_sale=1` ·
`sort=latest|popular|price_asc|price_desc|name` · `page` · `per_page` (≤ 48).
Price filters/sorts use the effective selling price (sale price and running offers included).
"Price on request" products are excluded from `min_price`/`max_price`/`on_sale` and the
`meta_extra` bounds, and listed after priced products in `price_asc`/`price_desc`.

### Product object (public)

```json
{ "id": 6, "name": "Kundan Bangle Pair", "slug": "kundan-bangle-pair", "sku": "GP001",
  "category": {"id":3,"name":"Gold Plated Jewellery","slug":"gold-plated-jewellery"},
  "image_url": "http://localhost:8000/storage/products/6/gp001-gold.jpg",
  "price": 999, "price_on_request": false, "original_price": 1299, "discount_percentage": 23, "currency": "INR",
  "offer": null, "is_featured": true, "is_best_seller": true, "is_new_arrival": false,
  "in_stock": true, "stock_quantity": 15, "availability_status": "available", "is_orderable": true,
  "colours": ["Gold","Maroon"], "sizes": ["2.4","2.6","2.8"], "listed_at": "2026-03-07T21:37:22+05:30",
  "colour_options": [{"name":"Gold","hex":"#C9A227"},{"name":"Maroon","hex":"#800020"}],
  "has_variants": true,
  "description": "…", "material": "…", "images": [{"id":1,"url":"…","is_primary":true}],
  "variants": [{"id":1,"colour":"Gold","size":"2.8","price":1049,"in_stock":true,"stock_quantity":3}] }
```

- **Visibility vs availability** (independent fields): disabled products (`is_active = false`)
  are absent from every public endpoint (`/products`, `/catalog`, `/products/{slug}` → 404,
  `/products/by-ids`, `/sitemap`, `/home`) and rejected by `/cart/quote`. `availability_status`
  is `available | sold_out | discontinued`; sold-out and discontinued products stay listed with
  `is_orderable: false` and `/cart/quote` rejects them (`"This product is sold out."` /
  `"…has been discontinued."`, no `whatsapp_url`). Products without stock tracking are never
  sold out automatically.
- `sizes` is empty when the admin switched size selection off (`sizes_enabled: false`); the
  quote then ignores any size sent.
- **Price on request**: `price_on_request: true`, `price`/`original_price`/`discount_percentage`
  are `null` (variant `price` too). Never derive a price client-side.
- `colour_options`: `colours` with swatch colours from the `colour_swatches` setting
  (exact name match, else the longest palette name contained in the colour; `hex: null` if none).
- `image_url` / `images[].url` of imported photo products are root-relative storefront paths
  (`/images/bangles/…`, media disk `static`); uploads are absolute storage/S3 URLs.

### `POST /cart/quote`

```json
{ "items": [
    { "key": "line-1", "product_id": 1, "variant_id": null, "colour": "White & Gold", "size": "Medium", "quantity": 2 }
  ],
  "customer_name": "Ravi", "delivery_location": "Anna Nagar, Chennai", "pincode": "600040", "notes": "Gift wrap" }
```

Response `data`: `valid`, `items[]` (`unit_price`, `original_price`, `price_on_request`, `line_total`,
`available_quantity`, `error` per line), `total` (priced lines only), `total_formatted` (₹),
`has_price_on_request`, `disclaimer`, `message`, `whatsapp_url` (null when any line has an error).
Customer fields are optional (the product page "Order via WhatsApp" sends one item and none;
the cart sends them). Price-on-request lines have `unit_price: null`, `line_total: 0` and are
written as `Price: On Request` in the message, which then ends with "Please share the price and
availability." Each product with a photo gets a `Product Image:` label followed by the absolute HTTPS URL of its primary image on the next line (wa.me can only prefill text, so the photo is sent as a link; any preview is up to WhatsApp). Each product also gets a `Product Link:` line with its storefront page, `<FRONTEND_URL>/products/<slug>`. Either is left out when its URL would be `http://`, localhost or a private address (except with `APP_ENV=local`, where localhost links are kept for development); a left-out image also logs a warning. The image is the one whose alt text ends in `– <ordered colour>`, otherwise the primary image. The message is built only from server values; the URL is `https://wa.me/<whatsapp_number setting>?text=<rawurlencoded message>`.
Line errors: inactive product, missing/unknown colour or size, unavailable variant,
out of stock, quantity above stock. `quantity` 1–50; `pincode` 6 digits.

### `POST /custom-orders` (multipart)

`customer_name`*, `whatsapp_number`* (Indian mobile, +91 optional), `product_type`*,
`preferred_colour`, `size`, `description`*, `reference_image` (jpg/png/webp ≤ 5 MB).
→ **201** `{ data: { id, message, whatsapp_url } }`. Rate limit 10/min/IP.

### `POST /orders`

Body: `items[]` (same shape as `/cart/quote`), `source` (`cart`|`buy_now`), `customer_name`*,
`phone`* (Indian mobile), `whatsapp_number` (defaults to `phone`), `email`, `address`*, `landmark`,
`city`*, `state`, `pincode`* (6 digits), `notes`. The cart is re-priced on the server; the order is
stored as **pending** with a snapshot of every line, and the WhatsApp message carries the order
number and full delivery details. When `WHATSAPP_CLOUD_*` is configured (see `.env.example`), a queued job also sends each product photo to the customer's WhatsApp number through the Meta Cloud API, using the approved image template; a failure there never fails the order. → **201** `{ data: { order_number, status, total, has_price_on_request, message, whatsapp_url, quote } }`;
**422** with `data.quote` when a line can no longer be ordered (nothing is stored). Rate limit 10/min/IP.

### `POST /orders/track`

`order_number`*, `phone`* (must match the checkout phone, last 10 digits). → `{ data: { status, status_label,
timeline[], items[], totals, expected_delivery_date, delivery } }` — no address or internal notes;
delivery person name/phone only once out for delivery. **404** when not matched.

## Admin

Prefix `/admin`. All routes except login need `Authorization: Bearer <token>` from an
`is_admin` user (401 without a token, 403 for non-admins).

| Method | Path | Description |
|---|---|---|
| POST | `/admin/login` | `{email,password}` → `{ data: { token, user } }` (5/min) |
| GET | `/admin/me` · POST `/admin/logout` · POST `/admin/change-password` | Session; change needs `current_password, password, password_confirmation` |
| GET | `/admin/dashboard` | Stats, low/out-of-stock lists, best sellers, recent updates & price changes |
| GET/POST | `/admin/categories` | List / create (multipart: `name, slug?, description, is_active, image`) |
| GET/PUT/DELETE | `/admin/categories/{id}` | Update (multipart → POST with `_method=PUT`; `remove_image=1`) / delete (products become uncategorised) |
| POST | `/admin/categories/reorder` | `{ ids: [3,1,2] }` |
| GET/POST | `/admin/products` | List (`search` (name or code), `category_id`, `section=collections\|beads\|charms\|general`, `status=enabled\|disabled` (also `active\|inactive`), `availability=available\|sold_out\|discontinued`, `min_price`, `max_price`, `stock=in_stock\|low_stock\|out_of_stock`, `flag`, `pricing=fixed\|sale\|on_request`, `source=photo_catalogue\|manual`, `sort=latest\|oldest\|name\|name_desc\|sku\|price_asc\|price_desc\|status\|stock_asc\|updated`, `per_page` ≤ 200) / create |
| POST | `/admin/products/bulk` | `{ ids: [..≤1000], action, category_id?, confirm: true }` → `{ data: { updated } }`. `action`: `enable, disable, mark_available, mark_sold_out, mark_discontinued, assign_category (needs category_id), feature, unfeature, best_seller, unbest_seller, new_arrival, unnew_arrival, delete`. Bulk prices: `/admin/prices/bulk/*` with `scope: "products"` |
| GET/PUT/DELETE | `/admin/products/{id}` | Detail / update / soft delete |
| PATCH | `/admin/products/{id}/flags` | `is_active, availability_status, is_featured, is_best_seller, is_new_arrival` |
| PATCH | `/admin/products/{id}/stock` | `track_stock, stock_quantity, low_stock_threshold, mark_out_of_stock` |
| PATCH | `/admin/products/{id}/price` | `price_on_request?, regular_price (not required when on request), sale_price?, note?` (logged) |
| GET | `/admin/products/{id}/price-history` | Last 100 changes |
| POST | `/admin/products/{id}/images` | multipart `images[]` (≤10, jpg/png/webp ≤5 MB); first becomes primary if none |
| POST | `/admin/products/{id}/images/reorder` | `{ ids: [...] }` |
| PATCH / DELETE | `/admin/product-images/{id}` | Update `alt_text` / delete (next image becomes primary) |
| POST | `/admin/product-images/{id}/primary` | Set primary image |
| POST | `/admin/prices/bulk/preview` | Rule (below) → `{ summary, matched, will_change, rows[] }` — nothing saved |
| POST | `/admin/prices/bulk/apply` | Rule + `confirm: true` → `{ matched, updated }` (transaction, logged) |
| GET | `/admin/prices/history` | Paginated; `product_id`, `source=manual\|bulk\|product_form\|import`; rows have `price_type` regular\|sale\|on_request |
| GET/POST | `/admin/banners` · PUT/DELETE `/admin/banners/{id}` · POST `/admin/banners/reorder` | `title, subtitle, button_text, button_link, is_active, image` |
| GET/POST | `/admin/offers` · GET/PUT/DELETE `/admin/offers/{id}` | `name, description, discount_percentage (≤90), starts_at, ends_at, is_active, product_ids[], category_ids[]` |
| GET/PUT | `/admin/settings` | All settings incl. `whatsapp_number`, socials, `testimonials[]`, `instagram_images[]`, `colour_swatches[]` (`{name, hex:"#RRGGBB"}`, ≤ 200), `size_presets[]` (`{name, sizes:[…]}`, ≤ 50 – quick-add size sets in the product form) |
| POST | `/admin/settings/upload` | multipart `type=logo\|favicon\|media`, `file` → `{ url }` |
| GET | `/admin/orders?status=&search=&delivery_person_id=&payment_status=&from=&to=&page=` | `status` = any status or `open`; `delivery_person_id=none` for unassigned. Adds `status_counts`, `unassigned_open` |
| GET | `/admin/orders/export?…` | CSV (one row per item) for the same filters |
| GET · PATCH | `/admin/orders/{id}` | Detail with `items`, `delivery_person`, `histories`. PATCH: customer/address fields, `delivery_charge`, `discount`, `payment_status\|method\|reference`, `courier_name`, `tracking_number`, `expected_delivery_date`, `delivery_notes`, `admin_notes`, `items[{id, unit_price}]` (price "on request" lines) |
| POST | `/admin/orders/{id}/status` | `status`, `note`, `cancellation_reason` (required to cancel), `mark_paid` (on delivery). Enforces the flow below |
| POST | `/admin/orders/{id}/assign` | `delivery_person_id` (null to unassign), `note` |
| POST | `/admin/orders/{id}/notes` | `note` → timeline entry |
| CRUD | `/admin/delivery-persons` | `name`*, `phone`*, `alternate_phone`, `vehicle_type`, `vehicle_number`, `service_area`, `notes`, `is_active`. List adds `active_orders_count`, `delivered_orders_count`; show adds recent `orders`. Delete refused while the person has open orders (soft delete) |
| GET | `/admin/custom-orders?status=` · PATCH/DELETE `/admin/custom-orders/{id}` | `status=new\|contacted\|completed\|cancelled`, `admin_notes` |

### Product create/update body

```json
{ "name": "Pearl Handmade Bracelet", "sku": "BR001", "slug": null, "category_id": 1,
  "short_description": "…", "description": "…", "price_on_request": false, "regular_price": 499, "sale_price": 399,
  "currency": "INR", "track_stock": true, "stock_quantity": 25, "low_stock_threshold": 5,
  "material": "Freshwater pearls", "colours": ["White & Gold"], "sizes": ["Small","Medium"], "sizes_enabled": true,
  "is_featured": true, "is_best_seller": false, "is_new_arrival": true, "is_active": true, "availability_status": "available",
  "meta_title": null, "meta_description": null,
  "variants": [ { "id": null, "colour": "White & Gold", "size": "Small", "sku": "BR001-S",
                  "additional_price": 0, "stock_quantity": 5, "is_active": true } ] }
```

Sending `variants` replaces the variant list (omitted ids are deleted). With active variants,
`colours`/`sizes` and product stock are derived from them. `sale_price` must be lower than `regular_price`.
Pricing modes (admin `pricing_mode`, read-only): **fixed** (`sale_price: null`), **sale**
(`sale_price` < `regular_price`), **on_request** (`price_on_request: true`; `regular_price` may be
null/0 and stored prices are kept hidden). Leaving on-request needs a `regular_price` ≥ 0.01.
Admin product responses also include `pricing_mode` and `source` (`photo_catalogue` | null).

### Bulk price rule

```json
{ "scope": "category", "category_id": 1, "product_ids": null,
  "target": "regular", "operation": "increase_percent", "value": 10,
  "rounding": "none", "only_active": false, "note": "Silver rate increase" }
```

`scope`: `all|category|products` · `target`: `regular|sale|both` ·
`operation`: `increase_percent|decrease_percent|increase_fixed|decrease_fixed|set_fixed|clear_sale` ·
`rounding`: `none|1|5|10`. Example: ₹15 + 10% → ₹16.50 (or ₹17 with rounding `1`).
"Price on request" products are skipped, except `set_fixed` on the regular price, which gives
them that price and turns price-on-request off (preview rows: `price_on_request`, `new_price_on_request`).

## Photo catalogue import

The 352 photographed products (`frontend/src/data/products.json`) are imported into
`products`/`product_images`/`categories` so they share pricing, colours, sizes, stock, cart and
WhatsApp ordering with every other product.

```bash
php artisan migrate                                   # adds products.price_on_request, products.source, categories.source
php artisan catalog:import-photos --dry-run           # report only
php artisan catalog:import-photos --sizes="bangles=2.2,2.4,2.6,2.8"
php artisan catalog:import-photos --file=/srv/products.json   # if the frontend is not at ../frontend
php artisan catalog:import-photos --sync              # refresh name, collection, new-arrival, slug, missing photos
php artisan catalog:import-photos --rollback          # delete imported products + empty imported categories
```

- Matched on product code (`sku` = `product-001`); re-running creates only missing products and
  never overwrites prices, colours, sizes, stock, variants or uploaded images (`--sync` refreshes
  catalogue fields only). Products deleted in the admin are not restored; a code or slug already
  used by a non-imported product is reported and skipped.
- Slugs are kept exactly → product URLs unchanged. Collections become categories with the same
  slug (`section: "collections"`, so they stay out of the homepage "Shop by Category"); existing
  categories with that slug are reused.
- New products: price on request, stock not tracked (made to order), `is_new_arrival` from the
  JSON, `created_at` = `photographedAt` (keeps "Latest" order). Photos stay in `frontend/public/images`
  and are referenced with the `static` media disk.
- The storefront reads every listing and product page from the API. Only when the API cannot
  be reached does it fall back to products.json (browsing only – ordering always needs the
  API). A 404 from the API (product disabled or deleted) is a 404 on the storefront.
- Keep products.json until the import is verified in production (see backup & rollback below).

### Backup & rollback

1. Before importing in production: `mysqldump omrcollection > backup-$(date +%F).sql`.
2. `php artisan migrate` (both product migrations are additive and reversible), then
   `php artisan catalog:import-photos --dry-run`, then without `--dry-run`.
3. Verify: Admin → Products → Source "Photo catalogue" shows 352; re-running the import reports
   `Created 0 · Unchanged 352`.
4. Undo options: `catalog:import-photos --rollback` (removes only imported rows), or
   `php artisan migrate:rollback --step=1` (drops `availability_status`/`sizes_enabled`), or
   restore the SQL dump. products.json and the photos in `frontend/public/images` are never
   modified by the import.

### Order status flow

`pending → confirmed → packed → out_for_delivery → delivered`; `cancelled` from any open status,
`returned` from out for delivery / delivered; `out_for_delivery → packed` = failed attempt.
Confirming deducts stock (all-or-nothing, 422 if short); cancelling/returning a confirmed order
restores it. Packing onward needs a price on every line; out for delivery needs a delivery person
or courier. Every change (status, assignment, edits, payment, notes) is written to
`order_status_histories` with the admin user.

## Database tables

`users` (`is_admin`), `categories`* (`section`, `source`), `products`* (`price_on_request`, `source`), `product_images` (`disk`: public|s3|static), `product_variants`,
`product_price_histories`, `banners`, `offers`*, `offer_products`, `offer_categories`,
`website_settings` (key/value), `custom_order_requests`*, `orders`*, `order_items`, `order_status_histories`,
`delivery_persons`*, `personal_access_tokens`.
(* soft deletes). Foreign keys cascade for images/variants/history; deleting a category nulls
`products.category_id`. Indexed on status flags, `sort_order`, slugs and SKUs (unique).
