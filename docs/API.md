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
| GET | `/products` | Product listing (see query below) — paginated, plus `meta_extra.min_price/max_price` |
| GET | `/products/{slug}` | Product detail with `images`, `variants`; `related` (4) |
| GET | `/products/by-ids?ids[]=1&ids[]=2` | Specific active products (wishlist / recently viewed) |
| POST | `/products/{id}/view` | Count a view (used for "popular" sort) |
| GET | `/sitemap` | Slugs + `updated_at` for products and categories |
| POST | `/cart/quote` | Server-side cart pricing + WhatsApp link |
| POST | `/custom-orders` | Custom order request (multipart) → WhatsApp link |

### `GET /products` query

`category` (slug) · `search` (name, SKU, category, material) · `min_price` · `max_price` ·
`availability=in_stock|out_of_stock` · `new=1` · `best_seller=1` · `featured=1` · `on_sale=1` ·
`sort=latest|popular|price_asc|price_desc|name` · `page` · `per_page` (≤ 48).
Price filters/sorts use the effective selling price (sale price and running offers included).

### Product object (public)

```json
{ "id": 6, "name": "Kundan Bangle Pair", "slug": "kundan-bangle-pair", "sku": "GP001",
  "category": {"id":3,"name":"Gold Plated Jewellery","slug":"gold-plated-jewellery"},
  "image_url": "http://localhost:8000/storage/products/6/gp001-gold.jpg",
  "price": 999, "original_price": 1299, "discount_percentage": 23, "currency": "INR",
  "offer": null, "is_featured": true, "is_best_seller": true, "is_new_arrival": false,
  "in_stock": true, "stock_quantity": 15, "colours": ["Gold","Maroon"], "sizes": ["2.4","2.6","2.8"],
  "has_variants": true,
  "description": "…", "material": "…", "images": [{"id":1,"url":"…","is_primary":true}],
  "variants": [{"id":1,"colour":"Gold","size":"2.8","price":1049,"in_stock":true,"stock_quantity":3}] }
```

### `POST /cart/quote`

```json
{ "items": [
    { "key": "line-1", "product_id": 1, "variant_id": null, "colour": "White & Gold", "size": "Medium", "quantity": 2 }
  ],
  "customer_name": "Ravi", "delivery_location": "Anna Nagar, Chennai", "pincode": "600040", "notes": "Gift wrap" }
```

Response `data`: `valid`, `items[]` (`unit_price`, `original_price`, `line_total`,
`available_quantity`, `error` per line), `total`, `total_formatted` (₹), `disclaimer`,
`message`, `whatsapp_url` (null when any line has an error).
Line errors: inactive product, missing/unknown colour or size, unavailable variant,
out of stock, quantity above stock. `quantity` 1–50; `pincode` 6 digits.

### `POST /custom-orders` (multipart)

`customer_name`*, `whatsapp_number`* (Indian mobile, +91 optional), `product_type`*,
`preferred_colour`, `size`, `description`*, `reference_image` (jpg/png/webp ≤ 5 MB).
→ **201** `{ data: { id, message, whatsapp_url } }`. Rate limit 10/min/IP.

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
| GET/POST | `/admin/products` | List (`search, category_id, status, stock=in_stock\|low_stock\|out_of_stock, flag, sort, per_page`) / create |
| GET/PUT/DELETE | `/admin/products/{id}` | Detail / update / soft delete |
| PATCH | `/admin/products/{id}/flags` | `is_active, is_featured, is_best_seller, is_new_arrival` |
| PATCH | `/admin/products/{id}/stock` | `track_stock, stock_quantity, low_stock_threshold, mark_out_of_stock` |
| PATCH | `/admin/products/{id}/price` | `regular_price, sale_price?, note?` (logged) |
| GET | `/admin/products/{id}/price-history` | Last 100 changes |
| POST | `/admin/products/{id}/images` | multipart `images[]` (≤10, jpg/png/webp ≤5 MB); first becomes primary if none |
| POST | `/admin/products/{id}/images/reorder` | `{ ids: [...] }` |
| PATCH / DELETE | `/admin/product-images/{id}` | Update `alt_text` / delete (next image becomes primary) |
| POST | `/admin/product-images/{id}/primary` | Set primary image |
| POST | `/admin/prices/bulk/preview` | Rule (below) → `{ summary, matched, will_change, rows[] }` — nothing saved |
| POST | `/admin/prices/bulk/apply` | Rule + `confirm: true` → `{ matched, updated }` (transaction, logged) |
| GET | `/admin/prices/history` | Paginated; `product_id`, `source=manual\|bulk\|product_form` |
| GET/POST | `/admin/banners` · PUT/DELETE `/admin/banners/{id}` · POST `/admin/banners/reorder` | `title, subtitle, button_text, button_link, is_active, image` |
| GET/POST | `/admin/offers` · GET/PUT/DELETE `/admin/offers/{id}` | `name, description, discount_percentage (≤90), starts_at, ends_at, is_active, product_ids[], category_ids[]` |
| GET/PUT | `/admin/settings` | All settings incl. `whatsapp_number`, socials, `testimonials[]`, `instagram_images[]` |
| POST | `/admin/settings/upload` | multipart `type=logo\|favicon\|media`, `file` → `{ url }` |
| GET | `/admin/custom-orders?status=` · PATCH/DELETE `/admin/custom-orders/{id}` | `status=new\|contacted\|completed\|cancelled`, `admin_notes` |

### Product create/update body

```json
{ "name": "Pearl Handmade Bracelet", "sku": "BR001", "slug": null, "category_id": 1,
  "short_description": "…", "description": "…", "regular_price": 499, "sale_price": 399,
  "currency": "INR", "track_stock": true, "stock_quantity": 25, "low_stock_threshold": 5,
  "material": "Freshwater pearls", "colours": ["White & Gold"], "sizes": ["Small","Medium"],
  "is_featured": true, "is_best_seller": false, "is_new_arrival": true, "is_active": true,
  "meta_title": null, "meta_description": null,
  "variants": [ { "id": null, "colour": "White & Gold", "size": "Small", "sku": "BR001-S",
                  "additional_price": 0, "stock_quantity": 5, "is_active": true } ] }
```

Sending `variants` replaces the variant list (omitted ids are deleted). With active variants,
`colours`/`sizes` and product stock are derived from them. `sale_price` must be lower than `regular_price`.

### Bulk price rule

```json
{ "scope": "category", "category_id": 1, "product_ids": null,
  "target": "regular", "operation": "increase_percent", "value": 10,
  "rounding": "none", "only_active": false, "note": "Silver rate increase" }
```

`scope`: `all|category|products` · `target`: `regular|sale|both` ·
`operation`: `increase_percent|decrease_percent|increase_fixed|decrease_fixed|set_fixed|clear_sale` ·
`rounding`: `none|1|5|10`. Example: ₹15 + 10% → ₹16.50 (or ₹17 with rounding `1`).

## Database tables

`users` (`is_admin`), `categories`*, `products`*, `product_images`, `product_variants`,
`product_price_histories`, `banners`, `offers`*, `offer_products`, `offer_categories`,
`website_settings` (key/value), `custom_order_requests`*, `personal_access_tokens`.
(* soft deletes). Foreign keys cascade for images/variants/history; deleting a category nulls
`products.category_id`. Indexed on status flags, `sort_order`, slugs and SKUs (unique).
