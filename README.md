# Handmade Products Store — WhatsApp ordering (India)

A complete e-commerce site for handmade jewellery and accessories. Customers browse,
pick colour/size/quantity, add to cart and **order via WhatsApp** — no payment gateway.
Prices are in **₹ INR** with Indian number formatting (₹1,23,456), +91 WhatsApp numbers,
6-digit pincodes and the Asia/Kolkata timezone.

```
backend/    Laravel 13 REST API + admin APIs (Sanctum tokens), MySQL
frontend/   Next.js 16 (App Router, TypeScript, Tailwind v4, lucide-react)
            storefront at /  ·  admin dashboard at /admin
docs/API.md API reference
```

## Local setup

**Requirements:** PHP 8.3+ (pdo_mysql, gd, mbstring), Composer, Node 20+, MySQL 8.

### 1. Database

```sql
CREATE DATABASE handmade_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'handmade'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT ALL ON handmade_shop.* TO 'handmade'@'localhost';
```

### 2. Backend (http://localhost:8000)

```bash
cd backend
cp .env.example .env          # set DB_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD
composer install
php artisan key:generate
php artisan migrate --seed    # admin user + demo catalogue (non-production)
php artisan storage:link      # serves uploaded images from /storage
php artisan serve             # http://localhost:8000
```

> Quick try without MySQL: set `DB_CONNECTION=sqlite`, `touch database/database.sqlite`, then migrate.

### 3. Frontend (http://localhost:3000)

```bash
cd frontend
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm install
npm run dev                   # or: npm run build && npm start
```

Admin: http://localhost:3000/admin/login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`
(defaults `admin@example.in` / `ChangeMe@123` — **change it** under Settings → Change password).

Then set your real **WhatsApp number** in Admin → Settings (e.g. `919876543210`; a bare
10-digit number gets `91` added).

### Tests

```bash
cd backend && php artisan test     # pricing, cart quote, stock, offers, bulk prices, auth
cd frontend && npm run lint && npm run build
```

## How ordering works

1. Cart lives in `localStorage` (also wishlist and recently viewed) — no login.
2. The cart page sends the items to `POST /api/cart/quote`. The **server** re-prices every
   line from the database (sale price, running offers, variant extra price), checks active
   status, options and stock, and returns totals plus the formatted message and a
   `https://wa.me/<number>?text=…` link. Client-side prices are never trusted.
3. "Order via WhatsApp" opens that link. The site clearly states the order is **not confirmed**
   until the seller confirms on WhatsApp; no payment details are collected.

Custom orders (`/custom-order`) are saved in `custom_order_requests` (viewable in admin), the
optional reference image is uploaded, and its URL is included in the WhatsApp message.

## Pricing rules

* Customer price = lower of **sale price** and **regular price − best running offer %**
  (offers apply to selected products or whole categories, within start/end dates;
  offer prices are rounded to the rupee). Variant `additional_price` is added on top.
* Every change (manual, product form, bulk) is written to `product_price_histories`
  with previous/new price, admin user and date.
* Bulk updates (Admin → Bulk Prices): scope all / category / selected products; target regular,
  sale or both; ±% , ±₹, set fixed, or remove sale price; optional rounding to ₹1/₹5/₹10.
  A preview table is always shown and applying requires explicit confirmation.
  A sale price that would end up ≥ the regular price is removed (shown as a warning first).
* Storefront pages fetch fresh data on every request, so price/stock changes show immediately.

## Stock rules

* `track_stock` off → always orderable (made-to-order). On → `stock_quantity` must be > 0.
* Products with variants keep stock per colour/size; product stock = sum of active variants.
* Low-stock threshold per product; warnings on the dashboard and Stock page.
* Inactive products, products in inactive categories and out-of-stock items cannot be ordered
  (the quote endpoint rejects them).

## Security

* Admin APIs: `auth:sanctum` + `admin` middleware (`users.is_admin`). Tokens expire after 7 days.
* Login is rate-limited (5/min per email+IP); public forms 10/min per IP.
* All prices, quantities (1–50), pincodes and Indian mobile numbers are validated server-side.
* CORS restricted to `CORS_ALLOWED_ORIGINS`.

## Production notes

* `APP_ENV=production`, `APP_DEBUG=false`, real `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`.
* `NEXT_PUBLIC_SITE_URL` must be the public storefront URL (sitemap, canonical, Open Graph).
* **S3/Cloudinary later:** uploads go through `App\Support\Media` and each record stores its
  disk. Set `MEDIA_DISK=s3` + `AWS_*` (or add a Cloudinary flysystem disk) and add the image
  host to `NEXT_PUBLIC_IMAGE_HOSTS`. No code changes needed.
* `php artisan config:cache route:cache`; serve `backend/public` with nginx/Apache.

## Built for later (not implemented)

The structure leaves room for: payment gateway, customer accounts, an orders table
(the quote service already produces authoritative line items), coupons, reviews, emails,
automated WhatsApp (Cloud API), multi-currency (`currency` on products/settings),
English/Arabic or Hindi/Tamil i18n, and analytics.
