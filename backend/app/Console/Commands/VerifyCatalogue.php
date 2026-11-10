<?php

namespace App\Console\Commands;

use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Support\Media;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\AwsS3V3\AwsS3V3Adapter;

/**
 * Read-only health check of the catalogue – run after a deploy or an image clean-up:
 *
 *   php artisan catalog:verify                      # files + data
 *   php artisan catalog:verify --http=50            # also request 50 live image URLs
 *   php artisan catalog:verify --public=/srv/shop/frontend/public
 */
class VerifyCatalogue extends Command
{
    protected $signature = 'catalog:verify
        {--public= : Storefront public folder holding /images (default: ../frontend/public)}
        {--http=0 : Also request this many image URLs over HTTP (uses FRONTEND_URL / the media disk URL)}';

    protected $description = 'Check product images, SKUs and colour variants (read-only)';

    private int $errors = 0;

    public function handle(): int
    {
        $public = rtrim($this->option('public') ?: base_path('../frontend/public'), '/');
        $this->checkMediaDisk();
        $this->checkImages($public);
        $this->checkSkus();
        $this->checkColours();
        $this->checkOrderImages($public);
        if ((int) $this->option('http') > 0) {
            $this->checkHttp((int) $this->option('http'));
        }

        $this->newLine();
        if ($this->errors) {
            $this->error("{$this->errors} problem(s) found.");

            return self::FAILURE;
        }
        $this->info('Catalogue OK.');

        return self::SUCCESS;
    }

    private function checkMediaDisk(): void
    {
        $disk = Media::disk();
        $driver = config("filesystems.disks.{$disk}.driver");
        $this->line("Upload disk: <info>{$disk}</info> ({$driver})");
        if (! $driver) {
            $this->problem("MEDIA_DISK={$disk} is not a disk in config/filesystems.php.");

            return;
        }
        if ($driver === 's3' && ! class_exists(AwsS3V3Adapter::class)) {
            $this->problem('MEDIA_DISK uses S3 but the S3 driver is not installed: composer require league/flysystem-aws-s3-v3 "^3.0"');
        }
        $sample = Media::url('products/example.jpg', $disk);
        if (app()->isProduction() && ! Media::absoluteUrl($sample)) {
            $this->problem("Uploaded images resolve to {$sample} – set PUBLIC_STORAGE_URL (public disk) or AWS_URL (S3) to a public https:// address.");
        }
    }

    private function checkImages(string $public): void
    {
        $missing = 0;
        ProductImage::with('product:id,sku,name,deleted_at')->whereHas('product')->orderBy('id')->each(function (ProductImage $img) use ($public, &$missing) {
            $exists = $img->disk === Media::STATIC_DISK
                ? is_file($public.'/'.ltrim(rawurldecode($img->path), '/'))
                : (str_starts_with($img->path, 'http') || Storage::disk($img->disk)->exists($img->path));
            if (! $exists) {
                $missing++;
                $this->problem("Missing image #{$img->id} of {$img->product->sku} ({$img->product->name}): {$img->disk}:{$img->path}");
            }
        });
        $total = ProductImage::whereHas('product')->count();
        $this->line("Images: {$total} checked, {$missing} missing.");

        $noImage = Product::where('is_active', true)->whereDoesntHave('images')->pluck('sku');
        if ($noImage->isNotEmpty()) {
            $this->warn('  Enabled products without an image: '.$noImage->implode(', '));
        }
    }

    private function checkSkus(): void
    {
        $all = Product::withTrashed()->pluck('sku')->merge(ProductVariant::whereNotNull('sku')->pluck('sku'))->map(fn ($s) => strtolower($s));
        $dupes = $all->duplicates()->unique();
        foreach ($dupes as $sku) {
            $this->problem("SKU used more than once (products/variants): {$sku}");
        }
        $noVariantSku = ProductVariant::where(fn ($q) => $q->whereNull('sku')->orWhere('sku', ''))->count();
        if ($noVariantSku) {
            $this->problem("{$noVariantSku} variant(s) without a SKU – open and save the product, or re-run catalog:import-photos.");
        }
        $placeholder = Product::whereColumn('sku', 'catalog_code')->count();
        if ($placeholder) {
            $this->warn("  {$placeholder} product(s) still use their catalogue code as SKU – run: php artisan catalog:import-photos");
        }
        $this->line('SKUs: '.$all->count().' checked, '.$dupes->count().' duplicate(s).');
    }

    private function checkColours(): void
    {
        $bad = 0;
        Product::with(['images', 'variants'])->whereNotNull('colours')->orderBy('id')->each(function (Product $p) use (&$bad) {
            $colours = collect($p->colours ?? [])->map(fn ($c) => strtolower($c));
            foreach ($p->images->whereNotNull('colour') as $img) {
                if (! $colours->contains(strtolower($img->colour))) {
                    $bad++;
                    $this->problem("{$p->sku}: image #{$img->id} is tagged \"{$img->colour}\", which is not one of the product's colours.");
                }
            }
            foreach ($p->variants->where('is_active', true)->whereNotNull('colour') as $v) {
                if (! $colours->contains(strtolower($v->colour))) {
                    $bad++;
                    $this->problem("{$p->sku}: variant {$v->sku} colour \"{$v->colour}\" is not in the colour list.");
                }
            }
        });
        $withPhotos = Product::whereHas('images', fn ($q) => $q->whereNotNull('colour'))->count();
        $this->line("Colours: {$withPhotos} product(s) with colour photos, {$bad} problem(s).");
    }

    private function checkOrderImages(string $public): void
    {
        $missing = OrderItem::where('image_url', 'like', '/images/%')->pluck('image_url')->unique()
            ->reject(fn ($u) => is_file($public.rawurldecode($u)));
        foreach ($missing as $url) {
            $this->problem("Order photo no longer exists: {$url}");
        }
        $this->line('Order photos: '.$missing->count().' missing.');
    }

    private function checkHttp(int $limit): void
    {
        $urls = ProductImage::whereHas('product', fn ($q) => $q->where('is_active', true))->where('is_primary', true)
            ->inRandomOrder()->limit($limit)->get()->map(fn ($i) => Media::absoluteUrl(Media::url($i->path, $i->disk)) ?? Media::shareableUrl(Media::url($i->path, $i->disk)))->filter();
        $failed = 0;
        foreach ($urls as $url) {
            try {
                $r = Http::timeout(15)->withHeaders(['User-Agent' => 'catalog-verify'])->head($url);
                $ok = $r->successful() && str_starts_with((string) $r->header('Content-Type'), 'image/');
            } catch (\Throwable) {
                $ok = false;
            }
            if (! $ok) {
                $failed++;
                $this->problem("Image URL does not load: {$url}");
            }
        }
        $this->line("HTTP: {$urls->count()} image URL(s) requested, {$failed} failed.");
    }

    private function problem(string $message): void
    {
        $this->errors++;
        $this->error('  '.$message);
    }
}
