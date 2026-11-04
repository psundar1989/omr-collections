<?php

namespace Database\Seeders;

use App\Models\Banner;
use App\Models\Category;
use App\Models\Offer;
use App\Models\Product;
use App\Services\SettingsService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Demo catalogue with generated placeholder artwork (replace via the admin panel). */
class DemoCatalogSeeder extends Seeder
{
    private const PALETTE = [
        'White & Gold' => [[250, 246, 238], [212, 175, 55]],
        'Gold' => [[247, 240, 226], [201, 160, 72]],
        'Rose Gold' => [[250, 238, 234], [196, 130, 120]],
        'Silver' => [[240, 241, 243], [168, 172, 178]],
        'Maroon' => [[248, 236, 236], [128, 32, 48]],
        'Emerald' => [[234, 244, 238], [36, 120, 84]],
        'Peacock Blue' => [[232, 241, 246], [22, 98, 132]],
        'Pastel Pink' => [[252, 238, 242], [226, 150, 172]],
        'Black' => [[242, 240, 238], [40, 40, 40]],
        'Multicolour' => [[248, 244, 236], [190, 110, 60]],
    ];

    public function run(): void
    {
        if (Product::exists()) {
            return; // never overwrite a real catalogue
        }

        $cats = [
            ['Handmade Bracelets', 'Delicate everyday bracelets, crafted by hand.'],
            ['Beaded Bracelets', 'Colourful glass, crystal and gemstone bead bracelets.'],
            ['Gold Plated Jewellery', 'Festive-ready gold plated pieces with a lasting finish.'],
            ['Necklaces', 'Chokers, layered chains and pendant necklaces.'],
            ['Earrings', 'Jhumkas, studs and drops for every occasion.'],
            ['Handmade Accessories', 'Hair clips, keychains, anklets and more.'],
            ['Gift Collections', 'Curated gift boxes for birthdays, Rakhi and weddings.'],
            ['Customised Products', 'Name bracelets and personalised keepsakes.'],
        ];
        $categories = [];
        foreach ($cats as $i => [$name, $desc]) {
            $colour = array_keys(self::PALETTE)[$i % count(self::PALETTE)];
            $categories[$name] = Category::create([
                'name' => $name, 'slug' => Str::slug($name), 'description' => $desc,
                'image_path' => $this->art('categories', Str::slug($name), $colour, $i), 'sort_order' => $i + 1,
            ]);
        }

        $products = [
            // name, sku, category, regular, sale, stock, colours, sizes, material, flags[f,b,n]
            ['Pearl Handmade Bracelet', 'BR001', 'Handmade Bracelets', 499, 399, 25, ['White & Gold', 'Rose Gold'], ['Small', 'Medium', 'Large'], 'Freshwater pearls, gold plated wire', [1, 1, 0]],
            ['Gold Chain Bracelet', 'BR002', 'Handmade Bracelets', 649, null, 12, ['Gold'], ['Free Size'], '18K gold plated brass', [1, 0, 1]],
            ['Evil Eye Thread Bracelet', 'BR003', 'Handmade Bracelets', 249, 199, 40, ['Peacock Blue', 'Black', 'Maroon'], [], 'Cotton thread, glass evil eye', [0, 1, 0]],
            ['Crystal Bead Stretch Bracelet', 'BB001', 'Beaded Bracelets', 349, null, 30, ['Pastel Pink', 'Silver', 'Emerald'], ['Small', 'Medium'], 'Czech crystal beads', [0, 0, 1]],
            ['Rudraksha Bead Bracelet', 'BB002', 'Beaded Bracelets', 399, 349, 3, ['Multicolour'], ['Free Size'], 'Natural rudraksha, elastic cord', [0, 1, 0]],
            ['Kundan Bangle Pair', 'GP001', 'Gold Plated Jewellery', 1299, 999, 8, ['Gold', 'Maroon'], ['2.4', '2.6', '2.8'], 'Gold plated alloy, kundan stones', [1, 1, 0]],
            ['Temple Coin Choker', 'NK001', 'Necklaces', 1899, null, 5, ['Gold'], [], 'Gold plated brass, temple coins', [1, 0, 1]],
            ['Layered Pearl Necklace', 'NK002', 'Necklaces', 1199, 899, 0, ['White & Gold'], [], 'Shell pearls, gold plated chain', [0, 0, 1]],
            ['Oxidised Jhumka Earrings', 'ER001', 'Earrings', 449, null, 20, ['Silver', 'Black'], [], 'German silver, oxidised finish', [1, 1, 0]],
            ['Pastel Meenakari Studs', 'ER002', 'Earrings', 299, 249, 15, ['Pastel Pink', 'Emerald', 'Peacock Blue'], [], 'Meenakari enamel on brass', [0, 0, 1]],
            ['Beaded Hair Clip Set', 'AC001', 'Handmade Accessories', 199, null, 50, ['Pastel Pink', 'White & Gold'], [], 'Seed beads, metal clip', [0, 0, 1]],
            ['Ghungroo Anklet', 'AC002', 'Handmade Accessories', 549, null, 10, ['Silver', 'Gold'], ['Free Size'], 'Silver plated brass, ghungroo bells', [0, 1, 0]],
            ['Rakhi Gift Hamper', 'GC001', 'Gift Collections', 999, 799, 18, ['Multicolour'], [], 'Handmade rakhi, bracelet, gift box', [1, 0, 1]],
            ['Bridesmaid Gift Box', 'GC002', 'Gift Collections', 1499, null, 6, ['Rose Gold', 'Gold'], [], 'Bracelet, earrings, keepsake box', [0, 0, 0]],
            ['Custom Name Bracelet', 'CP001', 'Customised Products', 599, null, 0, ['Gold', 'Silver', 'Rose Gold'], ['Small', 'Medium', 'Large'], 'Letter beads, stretch cord', [1, 1, 0]],
            ['Birthstone Charm Bracelet', 'CP002', 'Customised Products', 749, 649, 9, ['Gold', 'Silver'], ['Small', 'Medium'], 'Gold plated chain, birthstone charm', [0, 0, 1]],
        ];

        foreach ($products as $i => [$name, $sku, $cat, $regular, $sale, $stock, $colours, $sizes, $material, [$f, $b, $n]]) {
            $p = Product::create([
                'category_id' => $categories[$cat]->id,
                'name' => $name, 'slug' => Str::slug($name), 'sku' => $sku,
                'short_description' => "Handcrafted {$name} – lightweight, skin-friendly and gift ready.",
                'description' => "Each {$name} is handmade to order in our studio. Small variations in colour and finish are a mark of genuine handwork.\n\nCare: keep away from water and perfume, store in the pouch provided.",
                'regular_price' => $regular, 'sale_price' => $sale, 'currency' => 'INR',
                'track_stock' => $sku !== 'CP001', 'stock_quantity' => $stock, 'low_stock_threshold' => 5,
                'material' => $material, 'colours' => $colours, 'sizes' => $sizes,
                'is_featured' => (bool) $f, 'is_best_seller' => (bool) $b, 'is_new_arrival' => (bool) $n, 'is_active' => true,
                'views_count' => random_int(10, 400),
            ]);
            foreach (array_slice($colours, 0, 3) as $j => $colour) {
                $p->images()->create([
                    'path' => $this->art("products/{$p->id}", Str::slug($sku.'-'.$colour), $colour, $i + $j),
                    'disk' => 'public', 'alt_text' => "{$name} – {$colour}", 'is_primary' => $j === 0, 'sort_order' => $j + 1,
                ]);
            }
            $p->priceHistories()->create(['price_type' => 'regular', 'new_price' => $regular, 'change_source' => 'product_form', 'note' => 'Product created']);
        }

        // Variant-level stock example: Kundan bangles by colour + size.
        $bangle = Product::where('sku', 'GP001')->first();
        foreach (['Gold', 'Maroon'] as $c) {
            foreach (['2.4' => 0, '2.6' => 0, '2.8' => 50] as $size => $extra) {
                $bangle->variants()->create(['colour' => $c, 'size' => $size, 'sku' => "GP001-{$c}-{$size}", 'additional_price' => $extra, 'stock_quantity' => $c === 'Maroon' && $size === '2.8' ? 0 : 3]);
            }
        }
        $bangle->syncStockFromVariants();

        $offer = Offer::create(['name' => 'Festive Earrings Sale', 'description' => '15% off all earrings', 'discount_percentage' => 15, 'starts_at' => now()->subDay(), 'ends_at' => now()->addDays(30), 'is_active' => true]);
        $offer->categories()->attach($categories['Earrings']->id);

        Banner::create(['title' => 'Handmade With Love', 'subtitle' => 'Bracelets, necklaces and gifts – handcrafted in small batches across India.', 'image_path' => $this->art('banners', 'hero-1', 'White & Gold', 0, 1600, 800), 'button_text' => 'Shop Now', 'button_link' => '/shop', 'sort_order' => 1]);
        Banner::create(['title' => 'Festive Collection', 'subtitle' => 'Kundan, temple and meenakari pieces for the wedding season.', 'image_path' => $this->art('banners', 'hero-2', 'Maroon', 3, 1600, 800), 'button_text' => 'Explore', 'button_link' => '/categories/gold-plated-jewellery', 'sort_order' => 2]);

        app(SettingsService::class)->set([
            'testimonials' => [
                ['name' => 'Priya S.', 'location' => 'Bengaluru', 'text' => 'The pearl bracelet is even prettier in person. Ordering on WhatsApp was so easy!', 'rating' => 5],
                ['name' => 'Ananya R.', 'location' => 'Mumbai', 'text' => 'Ordered a custom name bracelet for my sister – beautifully packed and delivered on time.', 'rating' => 5],
                ['name' => 'Meera K.', 'location' => 'Kochi', 'text' => 'Lovely jhumkas and very quick replies from the seller. Will order again.', 'rating' => 4],
            ],
        ]);
    }

    /** Draw a simple bead-ring illustration so the demo store isn't blank. */
    private function art(string $folder, string $name, string $colour, int $seed, int $w = 900, int $h = 900): string
    {
        [$bg, $fg] = self::PALETTE[$colour] ?? self::PALETTE['Gold'];
        $img = imagecreatetruecolor($w, $h);
        imagefill($img, 0, 0, imagecolorallocate($img, ...$bg));
        $shade = imagecolorallocate($img, max(0, $bg[0] - 14), max(0, $bg[1] - 14), max(0, $bg[2] - 14));
        imagefilledellipse($img, (int) ($w / 2), (int) ($h * 0.56), (int) ($h * 0.75), (int) ($h * 0.16), $shade);

        $bead = imagecolorallocate($img, ...$fg);
        $hl = imagecolorallocate($img, min(255, $fg[0] + 60), min(255, $fg[1] + 60), min(255, $fg[2] + 60));
        $cx = $w / 2; $cy = $h / 2; $r = $h * 0.28; $count = 18 + ($seed % 3) * 4;
        for ($k = 0; $k < $count; $k++) {
            $a = 2 * M_PI * $k / $count;
            $x = (int) ($cx + cos($a) * $r);
            $y = (int) ($cy + sin($a) * $r * 0.82);
            $size = (int) ($h * ($k % 4 === 0 ? 0.07 : 0.05));
            imagefilledellipse($img, $x, $y, $size, $size, $bead);
            imagefilledellipse($img, $x - (int) ($size / 5), $y - (int) ($size / 5), (int) ($size / 3), (int) ($size / 3), $hl);
        }

        ob_start();
        imagejpeg($img, null, 85);
        $path = "{$folder}/{$name}.jpg";
        Storage::disk('public')->put($path, ob_get_clean());
        imagedestroy($img);

        return $path;
    }
}
