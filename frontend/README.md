# Storefront + Admin (Next.js 16)

See the [project README](../README.md) for full setup.

```bash
cp .env.example .env.local
npm install
npm run dev    # http://localhost:3000  (admin: /admin)
```

Key folders: `src/app/(shop)` storefront routes · `src/app/admin` dashboard ·
`src/components/shop|admin|layout|home` · `src/lib/api.ts` (server fetches, uncached so prices
are always current) · `src/lib/client-api.ts` · `src/lib/store.ts` (cart / wishlist / recently viewed
in localStorage) · `src/lib/admin-api.ts`.

## Product photos & catalogue

Photographed products live in `public/images/<collection>/` (handmade categories under
`public/images/handmade_jewellerycollections/<category>/`) and are described in
**`src/data/products.json`**: one entry per product (id, slug, name, collection, category,
images, `isNewArrival`, `homepageBanner`). The homepage, collections, New Arrivals
(`/new-arrivals`), product pages (`/products/<slug>`) and related products all read it
through `src/lib/catalog.ts`. Homepage carousel copy is in `src/lib/home-content.ts`.

To add a product, save the photo as `<colour>_<design>_<type>_NN.jpg` in its folder, add an
entry to `products.json`, then run `npm run catalog:check`. It lists photos that aren't
catalogued yet and fails on missing files or duplicate ids/slugs. Reviews go in
`src/data/reviews.json`, keyed by product id (real customer reviews only).
Rename history is in `../docs/image-rename-manifest*.csv`.
