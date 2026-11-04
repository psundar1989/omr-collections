<?php

namespace Database\Seeders;

use App\Models\Banner;
use App\Models\Category;
use App\Models\Product;
use App\Services\SettingsService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Demo "Trendset Beads" + "Signature Charms" collections, their products, banners
 * and the Acrylic Beads gallery – all with generated placeholder artwork.
 * Everything can be replaced from the admin panel. Safe to re-run: skips if already seeded.
 */
class BeadsCharmsCatalogSeeder extends Seeder
{
    /** Supersampling factor – draw large, downscale for smooth edges. */
    private const SS = 2;

    private const COLOURS = [
        'Coral' => [238, 112, 98], 'Mint' => [118, 196, 168], 'Lilac' => [176, 146, 210], 'Sky Blue' => [104, 168, 222],
        'Sunflower' => [240, 190, 70], 'Rose Pink' => [232, 128, 160], 'Emerald' => [36, 140, 98], 'Ruby' => [176, 32, 58],
        'Ivory' => [244, 236, 220], 'Black' => [44, 40, 38], 'Gold' => [201, 160, 72], 'Silver' => [176, 180, 186],
        'Peach' => [246, 170, 130], 'Navy' => [36, 56, 110], 'Olive' => [128, 132, 70], 'Turquoise' => [48, 178, 186],
    ];

    private const BG = [[250, 246, 238], [246, 239, 228], [244, 236, 226], [249, 242, 236], [242, 238, 230]];

    public function run(): void
    {
        if (Category::where('slug', 'crackle-beads')->exists()) {
            return;
        }

        $beads = [
            ['Crackle Beads', 'crackle', 'Glass beads with a crackled, ice-like inner texture that catches the light.', ['Sky Blue', 'Coral', 'Mint', 'Sunflower']],
            ['Jelly Beads', 'jelly', 'Translucent candy-coloured jelly beads for playful, summery designs.', ['Rose Pink', 'Mint', 'Lilac', 'Peach']],
            ['Printed Beads', 'printed', 'Hand-printed floral and dotted beads that add a pop of pattern.', ['Ivory', 'Sky Blue', 'Rose Pink', 'Sunflower']],
            ['Crystal Beads', 'crystal', 'Faceted crystal beads with a brilliant sparkle for statement pieces.', ['Lilac', 'Sky Blue', 'Ruby', 'Emerald']],
            ['Fimo Beads', 'fimo', 'Soft polymer-clay fimo slices in fruity and floral cane patterns.', ['Coral', 'Sunflower', 'Mint', 'Rose Pink']],
            ['Matte Beads', 'matte', 'Velvety frosted beads with a soft, understated matte finish.', ['Olive', 'Navy', 'Peach', 'Turquoise']],
        ];
        $charms = [
            ['Butterfly Charms', 'butterfly', 'Delicate butterfly charms to make every bracelet take flight.', ['Lilac', 'Sky Blue', 'Rose Pink']],
            ['Evil Eye Charms', 'evil-eye', 'Protective evil eye charms in classic blue and gold.', ['Navy', 'Sky Blue', 'Turquoise']],
            ['Heart Charms', 'heart', 'Love-filled heart charms in enamel, glass and metal.', ['Ruby', 'Rose Pink', 'Gold']],
            ['Kitty Charms', 'kitty', 'Adorable kitty face charms for cat lovers of all ages.', ['Peach', 'Ivory', 'Black']],
            ['Magnet Charms', 'magnet', 'Quirky magnet charms with a retro, playful vibe.', ['Ruby', 'Navy', 'Silver']],
            ['Metal Charms', 'metal', 'Gold and silver tone metal charms – stars, coins and more.', ['Gold', 'Silver', 'Gold']],
            ['Panda Charms', 'panda', 'Cute panda charms that bring a smile to every piece.', ['Black', 'Emerald', 'Rose Pink']],
            ['Stone Charms', 'stone', 'Natural stone and gem charms with rich, earthy colour.', ['Emerald', 'Ruby', 'Turquoise']],
        ];

        $sort = (int) Category::max('sort_order');
        $skuNo = 1;
        foreach ([['beads', $beads], ['charms', $charms]] as [$section, $list]) {
            foreach ($list as $i => [$name, $style, $desc, $colours]) {
                $slug = Str::slug($name);
                $cat = Category::create([
                    'name' => $name, 'slug' => $slug, 'description' => $desc, 'section' => $section,
                    'image_path' => $this->categoryArt($section, $style, $slug, $colours, $i), 'sort_order' => ++$sort,
                ]);
                $this->products($cat, $section, $style, $colours, $i, $skuNo);
            }
        }

        $this->banners();
        $this->gallery();
    }

    private function products(Category $cat, string $section, string $style, array $colours, int $ci, int &$skuNo): void
    {
        $singular = Str::singular(Str::before($cat->name, ' '));
        $types = $section === 'beads'
            ? [["{$singular} Bead Bracelet", 349], ["{$singular} Bead Necklace", 699], ["{$singular} Beads Pack (50 pcs)", 199], ["{$singular} Bead Anklet", 299]]
            : [["{$singular} Charm Bracelet", 449], ["{$singular} Charm Necklace", 599], ["{$singular} Charm Earrings", 349], ["{$singular} Charm Keychain", 249]];

        foreach ($types as $k => [$name, $price]) {
            $seed = $ci * 7 + $k;
            $sku = strtoupper($section === 'beads' ? 'BD' : 'CH').str_pad((string) $skuNo++, 3, '0', STR_PAD_LEFT);
            $sale = $k % 3 === 0 ? (int) round($price * 0.85 / 10) * 10 - 1 : null;
            $kind = $section === 'beads' ? ($k === 2 ? 'pack' : 'bracelet') : ($k === 1 ? 'pendant' : 'bracelet');
            $p = Product::create([
                'category_id' => $cat->id, 'name' => $name, 'slug' => Str::slug($name), 'sku' => $sku,
                'short_description' => "Handmade {$name} – lightweight, colourful and gift ready.",
                'description' => "Our {$name} is handcrafted in small batches using hand-picked ".strtolower($cat->name).".\n\n{$cat->description}\n\nCare: keep away from water and perfume, store in the pouch provided.",
                'regular_price' => $price, 'sale_price' => $sale, 'currency' => 'INR',
                'track_stock' => true, 'stock_quantity' => $k === 3 && $ci % 3 === 0 ? 0 : 6 + ($seed * 5) % 30, 'low_stock_threshold' => 5,
                'material' => $section === 'beads' ? "{$cat->name}, elastic cord" : "{$cat->name}, gold plated chain",
                'colours' => array_values(array_unique(array_slice($colours, 0, 3))), 'sizes' => $kind === 'bracelet' ? ['Small', 'Medium', 'Large'] : [],
                'is_featured' => $k === 0 && $ci % 2 === 0, 'is_best_seller' => $k === 1 && $ci % 2 === 1, 'is_new_arrival' => $k === 3 && $ci % 2 === 0,
                'is_active' => true, 'views_count' => 20 + ($seed * 37) % 380,
            ]);
            foreach (array_values(array_unique(array_slice($colours, 0, 3))) as $j => $colour) {
                $p->images()->create([
                    'path' => $this->productArt($p->id, Str::slug("{$sku}-{$colour}"), $section, $style, $kind, $colour, $colours, $seed + $j),
                    'disk' => 'public', 'alt_text' => "{$name} – {$colour}", 'is_primary' => $j === 0, 'sort_order' => $j + 1,
                ]);
            }
            $p->priceHistories()->create(['price_type' => 'regular', 'new_price' => $price, 'change_source' => 'product_form', 'note' => 'Product created']);
        }
    }

    private function banners(): void
    {
        $sort = (int) Banner::max('sort_order');
        $defs = [
            ['Trendset Beads Collection', 'Crackle, jelly, crystal and fimo beads – set the trend with every bead.', 'Shop Beads', '/categories/crackle-beads', 'beads'],
            ['Signature Charms Hub', 'Butterflies, evil eyes, hearts and kitties – your go-to place for iconic charms.', 'Shop Charms', '/categories/butterfly-charms', 'charms'],
            ['Acrylic Beads Gallery', 'Bright, glossy acrylic bead jewellery handmade in small batches.', 'Explore Now', '/shop', 'acrylic'],
        ];
        foreach ($defs as $i => [$title, $sub, $btn, $link, $theme]) {
            Banner::create([
                'title' => $title, 'subtitle' => $sub, 'button_text' => $btn, 'button_link' => $link, 'sort_order' => $sort + $i + 1,
                'image_path' => $this->bannerArt("banner-{$theme}", $theme, $i),
            ]);
        }
    }

    private function gallery(): void
    {
        $settings = app(SettingsService::class);
        $images = [];
        $names = array_keys(self::COLOURS);
        for ($i = 0; $i < 12; $i++) {
            $palette = [$names[$i % 16], $names[($i + 5) % 16], $names[($i + 9) % 16]];
            $kind = ['bracelet', 'pack', 'pendant', 'bracelet'][$i % 4];
            $path = $this->productArt(0, "acrylic-{$i}", 'beads', 'acrylic', $kind, $palette[0], $palette, $i, 'gallery');
            $images[] = ['image_url' => Storage::disk('public')->url($path), 'link' => ''];
        }
        $settings->set(['instagram_images' => $images]);
    }

    /* ---------------------------------------------------------------- artwork */

    private function categoryArt(string $section, string $style, string $slug, array $colours, int $seed): string
    {
        [$img, $s] = $this->canvas(800, 800, self::BG[$seed % 5]);
        $c = 400 * $s;
        if ($section === 'beads') {
            $spots = [[0, 0, 150], [-170, -120, 100], [175, -110, 95], [-165, 150, 105], [170, 160, 100], [0, -230, 70], [0, 245, 72], [-260, 20, 60], [265, 25, 62]];
            foreach ($spots as $k => [$dx, $dy, $r]) {
                $this->shadow($img, $c + $dx * $s, $c + $dy * $s, $r * $s);
                $this->bead($img, $c + $dx * $s, $c + $dy * $s, $r * $s, $style, self::COLOURS[$colours[$k % count($colours)]], $seed + $k);
            }
        } else {
            $this->beadRing($img, $c, $c, 300 * $s, 30, 14 * $s, 'gold', [self::COLOURS['Gold']], 0);
            $this->shadow($img, $c, $c + 20 * $s, 190 * $s);
            $this->charm($img, $c, $c, 190 * $s, $style, self::COLOURS[$colours[0]]);
        }

        return $this->save($img, $s, 800, 800, "categories/{$slug}.jpg");
    }

    private function productArt(int $id, string $name, string $section, string $style, string $kind, string $colour, array $palette, int $seed, string $folder = ''): string
    {
        [$img, $s] = $this->canvas(900, 900, self::BG[$seed % 5]);
        $cx = 450 * $s; $cy = 430 * $s;
        $main = self::COLOURS[$colour];
        $mix = array_map(fn ($n) => self::COLOURS[$n], array_values(array_unique([$colour, ...$palette])));

        if ($kind === 'pack') {
            mt_srand($seed * 13 + 7);
            for ($k = 0; $k < 34; $k++) {
                $a = mt_rand(0, 628) / 100; $d = sqrt(mt_rand(0, 1000) / 1000) * 300;
                $x = $cx + cos($a) * $d * $s; $y = $cy + 20 * $s + sin($a) * $d * 0.8 * $s; $r = mt_rand(38, 58) * $s;
                $this->shadow($img, $x, $y, $r);
                $this->bead($img, $x, $y, $r, $section === 'beads' ? $style : 'acrylic', $mix[$k % count($mix)], $seed + $k);
            }
        } elseif ($kind === 'pendant') {
            $this->chain($img, $cx, 40 * $s, 330 * $s, 470 * $s, self::COLOURS['Gold']);
            if ($section === 'charms') {
                $this->shadow($img, $cx, 600 * $s, 140 * $s);
                $this->charm($img, $cx, 590 * $s, 140 * $s, $style, $main);
            } else {
                for ($k = -3; $k <= 3; $k++) {
                    $x = $cx + $k * 62 * $s; $y = 470 * $s + (9 - $k * $k) * 14 * $s;
                    $this->bead($img, $x, $y, 34 * $s, $style, $mix[abs($k) % count($mix)], $seed + $k);
                }
            }
        } else {
            $this->shadow($img, $cx, $cy + 40 * $s, 330 * $s, 0.25);
            $beadStyle = $section === 'beads' ? $style : 'gold';
            $this->beadRing($img, $cx, $cy, 290 * $s, 22 + $seed % 3 * 2, 36 * $s, $beadStyle, $section === 'beads' ? $mix : [self::COLOURS['Gold'], self::COLOURS['Ivory']], $seed);
            if ($section === 'charms') {
                $this->charm($img, $cx, $cy + 310 * $s, 105 * $s, $style, $main);
            }
        }

        return $this->save($img, $s, 900, 900, $folder ? "{$folder}/{$name}.jpg" : "products/{$id}/{$name}.jpg");
    }

    private function bannerArt(string $name, string $theme, int $seed): string
    {
        [$img, $s] = $this->canvas(1600, 800, [246, 238, 226]);
        $names = array_keys(self::COLOURS);
        mt_srand(99 + $seed);
        $styles = ['beads' => ['crackle', 'jelly', 'crystal', 'fimo', 'printed', 'matte'], 'acrylic' => ['acrylic'], 'charms' => ['gold']][$theme];
        for ($k = 0; $k < 46; $k++) {
            $x = mt_rand(420, 1640) * $s; $y = mt_rand(-40, 840) * $s; $r = mt_rand(30, 72) * $s;
            $this->shadow($img, $x, $y, $r);
            $this->bead($img, $x, $y, $r, $styles[$k % count($styles)], self::COLOURS[$names[mt_rand(0, 15)]], $k);
        }
        if ($theme === 'charms') {
            foreach ([['butterfly', 'Lilac', 820, 260], ['evil-eye', 'Navy', 1120, 520], ['heart', 'Ruby', 1380, 230], ['kitty', 'Peach', 980, 600], ['panda', 'Black', 1420, 560]] as [$st, $col, $x, $y]) {
                $this->shadow($img, $x * $s, $y * $s + 14 * $s, 120 * $s);
                $this->charm($img, $x * $s, $y * $s, 120 * $s, $st, self::COLOURS[$col]);
            }
        } elseif ($theme === 'beads') {
            $this->beadRing($img, 1100 * $s, 400 * $s, 240 * $s, 24, 34 * $s, 'crackle', array_map(fn ($n) => self::COLOURS[$n], ['Sky Blue', 'Coral', 'Mint', 'Sunflower']), 3);
        } else {
            $this->beadRing($img, 1100 * $s, 400 * $s, 240 * $s, 22, 36 * $s, 'acrylic', array_map(fn ($n) => self::COLOURS[$n], ['Rose Pink', 'Sunflower', 'Turquoise', 'Lilac']), 5);
        }

        return $this->save($img, $s, 1600, 800, "banners/{$name}.jpg");
    }

    /* ---------------------------------------------------------------- primitives */

    private function canvas(int $w, int $h, array $bg): array
    {
        $s = self::SS;
        $img = imagecreatetruecolor($w * $s, $h * $s);
        imagealphablending($img, true);
        imagefill($img, 0, 0, $this->rgb($img, $bg));

        return [$img, $s];
    }

    private function save($img, int $s, int $w, int $h, string $path): string
    {
        $out = imagecreatetruecolor($w, $h);
        imagecopyresampled($out, $img, 0, 0, 0, 0, $w, $h, $w * $s, $h * $s);
        ob_start();
        imagejpeg($out, null, 86);
        Storage::disk('public')->put($path, ob_get_clean());
        imagedestroy($img);
        imagedestroy($out);

        return $path;
    }

    private function rgb($img, array $c, int $alpha = 0): int
    {
        return imagecolorallocatealpha($img, max(0, min(255, (int) $c[0])), max(0, min(255, (int) $c[1])), max(0, min(255, (int) $c[2])), $alpha);
    }

    private function tint(array $c, float $f): array
    {
        return $f >= 0
            ? [$c[0] + (255 - $c[0]) * $f, $c[1] + (255 - $c[1]) * $f, $c[2] + (255 - $c[2]) * $f]
            : [$c[0] * (1 + $f), $c[1] * (1 + $f), $c[2] * (1 + $f)];
    }

    private function circle($img, float $x, float $y, float $r, array $c, int $alpha = 0): void
    {
        imagefilledellipse($img, (int) $x, (int) $y, (int) ($r * 2), (int) ($r * 2), $this->rgb($img, $c, $alpha));
    }

    private function shadow($img, float $x, float $y, float $r, float $strength = 0.35): void
    {
        imagefilledellipse($img, (int) ($x + $r * 0.12), (int) ($y + $r * 0.9), (int) ($r * 1.9), (int) ($r * 0.45), $this->rgb($img, [80, 60, 40], (int) (127 - 127 * $strength * 0.5)));
    }

    /** Shaded sphere: darker rim, base body, soft highlight. */
    private function sphere($img, float $x, float $y, float $r, array $c, bool $gloss = true): void
    {
        $this->circle($img, $x, $y, $r, $this->tint($c, -0.28));
        $this->circle($img, $x - $r * 0.06, $y - $r * 0.06, $r * 0.9, $c);
        $this->circle($img, $x - $r * 0.16, $y - $r * 0.16, $r * 0.62, $this->tint($c, 0.12));
        if ($gloss) {
            $this->circle($img, $x - $r * 0.36, $y - $r * 0.38, $r * 0.2, [255, 255, 255], 30);
            $this->circle($img, $x - $r * 0.42, $y - $r * 0.44, $r * 0.09, [255, 255, 255]);
        }
    }

    private function bead($img, float $x, float $y, float $r, string $style, array $c, int $seed): void
    {
        mt_srand($seed * 31 + (int) $r);
        switch ($style) {
            case 'crackle':
                $this->sphere($img, $x, $y, $r, $c, false);
                imagesetthickness($img, max(1, (int) ($r / 22)));
                $line = $this->rgb($img, $this->tint($c, 0.55), 20);
                for ($k = 0; $k < 14; $k++) {
                    $a = mt_rand(0, 628) / 100; $d = mt_rand(0, 70) / 100 * $r; $l = mt_rand(15, 35) / 100 * $r;
                    $px = $x + cos($a) * $d; $py = $y + sin($a) * $d; $b = $a + mt_rand(-150, 150) / 100;
                    imageline($img, (int) $px, (int) $py, (int) ($px + cos($b) * $l), (int) ($py + sin($b) * $l), $line);
                }
                imagesetthickness($img, 1);
                $this->circle($img, $x - $r * 0.4, $y - $r * 0.42, $r * 0.1, [255, 255, 255]);
                break;
            case 'jelly':
                $this->circle($img, $x, $y, $r, $this->tint($c, -0.15), 35);
                $this->circle($img, $x, $y, $r * 0.82, $this->tint($c, 0.2), 45);
                $this->circle($img, $x + $r * 0.2, $y + $r * 0.25, $r * 0.35, $this->tint($c, 0.45), 50);
                $this->circle($img, $x - $r * 0.35, $y - $r * 0.38, $r * 0.16, [255, 255, 255], 15);
                break;
            case 'printed':
                $this->sphere($img, $x, $y, $r, $c, false);
                $dot = $this->tint($c, -0.45);
                $alt = [255, 250, 240];
                foreach ([[0, 0], [-0.45, -0.2], [0.42, -0.28], [-0.3, 0.45], [0.38, 0.4]] as $k => [$dx, $dy]) {
                    $px = $x + $dx * $r; $py = $y + $dy * $r;
                    for ($p = 0; $p < 5; $p++) {
                        $a = $p * 2 * M_PI / 5;
                        $this->circle($img, $px + cos($a) * $r * 0.1, $py + sin($a) * $r * 0.1, $r * 0.08, $k % 2 ? $dot : $alt);
                    }
                    $this->circle($img, $px, $py, $r * 0.05, [240, 190, 70]);
                }
                $this->circle($img, $x - $r * 0.42, $y - $r * 0.44, $r * 0.08, [255, 255, 255]);
                break;
            case 'crystal':
                $pts = []; $n = 8;
                for ($k = 0; $k < $n; $k++) {
                    $a = M_PI / 8 + $k * 2 * M_PI / $n;
                    $pts[] = (int) ($x + cos($a) * $r); $pts[] = (int) ($y + sin($a) * $r);
                }
                imagefilledpolygon($img, $pts, $this->rgb($img, $this->tint($c, -0.2)));
                for ($k = 0; $k < $n; $k++) {
                    $tri = [(int) $x, (int) $y, $pts[$k * 2], $pts[$k * 2 + 1], $pts[(($k + 1) % $n) * 2], $pts[(($k + 1) % $n) * 2 + 1]];
                    imagefilledpolygon($img, $tri, $this->rgb($img, $this->tint($c, [0.35, 0.1, -0.1, -0.25, -0.15, 0.05, 0.25, 0.45][$k]), 10));
                }
                $this->circle($img, $x, $y, $r * 0.32, $this->tint($c, 0.4), 20);
                $this->circle($img, $x - $r * 0.35, $y - $r * 0.35, $r * 0.08, [255, 255, 255]);
                break;
            case 'fimo':
                $this->circle($img, $x, $y, $r, $this->tint($c, -0.2));
                $this->circle($img, $x, $y, $r * 0.88, [252, 246, 236]);
                for ($p = 0; $p < 8; $p++) {
                    $a = $p * M_PI / 4;
                    imagefilledarc($img, (int) $x, (int) $y, (int) ($r * 1.6), (int) ($r * 1.6), (int) rad2deg($a) + 4, (int) rad2deg($a + M_PI / 4) - 4, $this->rgb($img, $c), IMG_ARC_PIE);
                }
                $this->circle($img, $x, $y, $r * 0.22, [252, 246, 236]);
                $this->circle($img, $x, $y, $r * 0.12, $this->tint($c, -0.3));
                break;
            case 'matte':
                $this->circle($img, $x, $y, $r, $this->tint($c, -0.18));
                $this->circle($img, $x - $r * 0.08, $y - $r * 0.08, $r * 0.88, $c);
                $this->circle($img, $x - $r * 0.25, $y - $r * 0.25, $r * 0.45, $this->tint($c, 0.08));
                break;
            case 'gold':
                $this->sphere($img, $x, $y, $r, $c);
                break;
            default: // acrylic: bright glossy
                $this->sphere($img, $x, $y, $r, $c);
                $this->circle($img, $x + $r * 0.3, $y + $r * 0.35, $r * 0.12, $this->tint($c, 0.5), 40);
        }
        // string hole
        $this->circle($img, $x, $y, max(2, $r * 0.07), $this->tint($c, -0.5), 30);
    }

    private function beadRing($img, float $cx, float $cy, float $R, int $count, float $r, string $style, array $mix, int $seed): void
    {
        imagesetthickness($img, max(2, (int) ($r / 8)));
        imageellipse($img, (int) $cx, (int) $cy, (int) ($R * 2), (int) ($R * 1.7), $this->rgb($img, [200, 185, 160]));
        imagesetthickness($img, 1);
        for ($k = 0; $k < $count; $k++) {
            $a = -M_PI / 2 + 2 * M_PI * $k / $count;
            $this->bead($img, $cx + cos($a) * $R, $cy + sin($a) * $R * 0.85, $r * ($k % 5 === 0 ? 1.15 : 1), $style, $mix[$k % count($mix)], $seed + $k);
        }
    }

    /** U-shaped necklace chain from the top corners down to ($cx, $bottom). */
    private function chain($img, float $cx, float $top, float $half, float $bottom, array $c): void
    {
        $link = $this->rgb($img, $this->tint($c, -0.15));
        $hole = $this->rgb($img, [250, 244, 234]);
        for ($t = -1.0; $t <= 1.0001; $t += 0.035) {
            $x = (int) ($cx + $t * $half); $y = (int) ($bottom - ($bottom - $top) * $t * $t);
            imagefilledellipse($img, $x, $y, 14 * self::SS, 20 * self::SS, $link);
            imagefilledellipse($img, $x, $y, 6 * self::SS, 11 * self::SS, $hole);
        }
    }

    /** Charm motif with a gold jump ring on top. */
    private function charm($img, float $x, float $y, float $r, string $style, array $c): void
    {
        $gold = self::COLOURS['Gold'];
        imagesetthickness($img, max(2, (int) ($r / 14)));
        imageellipse($img, (int) $x, (int) ($y - $r * 1.02), (int) ($r * 0.34), (int) ($r * 0.34), $this->rgb($img, $this->tint($gold, -0.15)));
        imagesetthickness($img, 1);

        switch ($style) {
            case 'butterfly':
                foreach ([-1, 1] as $sd) {
                    imagefilledellipse($img, (int) ($x + $sd * $r * 0.45), (int) ($y - $r * 0.25), (int) ($r * 0.95), (int) ($r * 1.0), $this->rgb($img, $this->tint($gold, -0.1)));
                    imagefilledellipse($img, (int) ($x + $sd * $r * 0.45), (int) ($y - $r * 0.25), (int) ($r * 0.8), (int) ($r * 0.85), $this->rgb($img, $c));
                    imagefilledellipse($img, (int) ($x + $sd * $r * 0.35), (int) ($y + $r * 0.4), (int) ($r * 0.7), (int) ($r * 0.7), $this->rgb($img, $this->tint($gold, -0.1)));
                    imagefilledellipse($img, (int) ($x + $sd * $r * 0.35), (int) ($y + $r * 0.4), (int) ($r * 0.56), (int) ($r * 0.56), $this->rgb($img, $this->tint($c, 0.25)));
                    $this->circle($img, $x + $sd * $r * 0.5, $y - $r * 0.3, $r * 0.12, [255, 250, 240]);
                }
                imagefilledellipse($img, (int) $x, (int) ($y + $r * 0.05), (int) ($r * 0.18), (int) ($r * 1.2), $this->rgb($img, $gold));
                break;
            case 'evil-eye':
                $this->sphere($img, $x, $y, $r, $gold);
                $this->circle($img, $x, $y, $r * 0.86, $c);
                $this->circle($img, $x, $y, $r * 0.58, [252, 250, 245]);
                $this->circle($img, $x, $y, $r * 0.38, [110, 170, 225]);
                $this->circle($img, $x, $y, $r * 0.18, [20, 22, 30]);
                $this->circle($img, $x - $r * 0.4, $y - $r * 0.45, $r * 0.1, [255, 255, 255], 20);
                break;
            case 'heart':
                $this->heart($img, $x, $y, $r, $this->tint($gold, -0.1));
                $this->heart($img, $x, $y + $r * 0.04, $r * 0.84, $c);
                $this->circle($img, $x - $r * 0.4, $y - $r * 0.35, $r * 0.12, [255, 255, 255], 25);
                break;
            case 'kitty':
                foreach ([-1, 1] as $sd) {
                    imagefilledpolygon($img, [(int) ($x + $sd * $r * 0.85), (int) ($y - $r * 0.9), (int) ($x + $sd * $r * 0.2), (int) ($y - $r * 0.6), (int) ($x + $sd * $r * 0.9), (int) ($y - $r * 0.1)], $this->rgb($img, $this->tint($c, -0.2)));
                }
                $this->circle($img, $x, $y, $r * 0.85, $this->tint($c, -0.2));
                $this->circle($img, $x, $y, $r * 0.78, $c);
                foreach ([-1, 1] as $sd) {
                    $this->circle($img, $x + $sd * $r * 0.3, $y - $r * 0.1, $r * 0.1, [40, 35, 30]);
                    imagesetthickness($img, max(1, (int) ($r / 40)));
                    imageline($img, (int) ($x + $sd * $r * 0.3), (int) ($y + $r * 0.18), (int) ($x + $sd * $r * 0.9), (int) ($y + $r * 0.1), $this->rgb($img, [90, 70, 60]));
                    imageline($img, (int) ($x + $sd * $r * 0.3), (int) ($y + $r * 0.25), (int) ($x + $sd * $r * 0.9), (int) ($y + $r * 0.32), $this->rgb($img, [90, 70, 60]));
                    imagesetthickness($img, 1);
                    $this->circle($img, $x + $sd * $r * 0.5, $y + $r * 0.25, $r * 0.1, [240, 150, 160], 40);
                }
                imagefilledpolygon($img, [(int) ($x - $r * 0.08), (int) ($y + $r * 0.1), (int) ($x + $r * 0.08), (int) ($y + $r * 0.1), (int) $x, (int) ($y + $r * 0.2)], $this->rgb($img, [220, 110, 130]));
                $this->circle($img, $x + $r * 0.5, $y - $r * 0.55, $r * 0.16, [232, 90, 120]);
                break;
            case 'magnet':
                $t = (int) ($r * 0.42);
                imagesetthickness($img, $t);
                imagearc($img, (int) $x, (int) ($y - $r * 0.05), (int) ($r * 1.3), (int) ($r * 1.3), 180, 360, $this->rgb($img, $c));
                imagesetthickness($img, 1);
                foreach ([-1, 1] as $sd) {
                    $lx = $x + $sd * $r * 0.65;
                    imagefilledrectangle($img, (int) ($lx - $t / 2), (int) ($y - $r * 0.08), (int) ($lx + $t / 2), (int) ($y + $r * 0.45), $this->rgb($img, $c));
                    imagefilledrectangle($img, (int) ($lx - $t / 2), (int) ($y + $r * 0.45), (int) ($lx + $t / 2), (int) ($y + $r * 0.8), $this->rgb($img, self::COLOURS['Silver']));
                }
                break;
            case 'metal':
                $pts = [];
                for ($k = 0; $k < 10; $k++) {
                    $a = -M_PI / 2 + $k * M_PI / 5; $rr = $k % 2 ? $r * 0.45 : $r;
                    $pts[] = (int) ($x + cos($a) * $rr); $pts[] = (int) ($y + sin($a) * $rr);
                }
                imagefilledpolygon($img, $pts, $this->rgb($img, $this->tint($c, -0.25)));
                foreach ($pts as $i => $v) {
                    $pts[$i] = $i % 2 ? (int) ($y + ($v - $y) * 0.82) : (int) ($x + ($v - $x) * 0.82);
                }
                imagefilledpolygon($img, $pts, $this->rgb($img, $c));
                $this->circle($img, $x - $r * 0.15, $y - $r * 0.15, $r * 0.22, $this->tint($c, 0.4), 30);
                break;
            case 'panda':
                foreach ([-1, 1] as $sd) {
                    $this->circle($img, $x + $sd * $r * 0.62, $y - $r * 0.62, $r * 0.3, [36, 34, 34]);
                }
                $this->circle($img, $x, $y, $r * 0.9, [210, 205, 198]);
                $this->circle($img, $x, $y, $r * 0.84, [252, 250, 246]);
                foreach ([-1, 1] as $sd) {
                    imagefilledellipse($img, (int) ($x + $sd * $r * 0.32), (int) ($y - $r * 0.05), (int) ($r * 0.36), (int) ($r * 0.46), $this->rgb($img, [36, 34, 34]));
                    $this->circle($img, $x + $sd * $r * 0.3, $y - $r * 0.08, $r * 0.07, [255, 255, 255]);
                    $this->circle($img, $x + $sd * $r * 0.52, $y + $r * 0.3, $r * 0.1, [244, 170, 180], 40);
                }
                imagefilledellipse($img, (int) $x, (int) ($y + $r * 0.25), (int) ($r * 0.18), (int) ($r * 0.12), $this->rgb($img, [36, 34, 34]));
                $this->circle($img, $x + $r * 0.55, $y + $r * 0.62, $r * 0.18, $c);
                break;
            default: // stone
                $pts = [];
                for ($k = 0; $k < 6; $k++) {
                    $a = -M_PI / 2 + $k * M_PI / 3;
                    $pts[] = (int) ($x + cos($a) * $r * 0.8); $pts[] = (int) ($y + sin($a) * $r);
                }
                imagefilledpolygon($img, $pts, $this->rgb($img, $gold));
                for ($k = 0; $k < 6; $k++) {
                    $tri = [(int) $x, (int) $y, (int) ($x + ($pts[$k * 2] - $x) * 0.85), (int) ($y + ($pts[$k * 2 + 1] - $y) * 0.85),
                        (int) ($x + ($pts[(($k + 1) % 6) * 2] - $x) * 0.85), (int) ($y + ($pts[(($k + 1) % 6) * 2 + 1] - $y) * 0.85)];
                    imagefilledpolygon($img, $tri, $this->rgb($img, $this->tint($c, [0.3, 0.05, -0.2, -0.3, -0.1, 0.15][$k])));
                }
                $this->circle($img, $x - $r * 0.2, $y - $r * 0.35, $r * 0.08, [255, 255, 255]);
        }
    }

    private function heart($img, float $x, float $y, float $r, array $c): void
    {
        $col = $this->rgb($img, $c);
        $this->circle($img, $x - $r * 0.45, $y - $r * 0.25, $r * 0.52, $c);
        $this->circle($img, $x + $r * 0.45, $y - $r * 0.25, $r * 0.52, $c);
        imagefilledpolygon($img, [(int) ($x - $r * 0.95), (int) ($y - $r * 0.1), (int) ($x + $r * 0.95), (int) ($y - $r * 0.1), (int) $x, (int) ($y + $r * 0.95)], $col);
    }
}
