<?php

namespace App\Console\Commands;

use App\Services\PhotoCatalogueImporter;
use Illuminate\Console\Command;

class ImportPhotoCatalogue extends Command
{
    protected $signature = 'catalog:import-photos
        {--file= : Path to products.json (default: ../frontend/src/data/products.json)}
        {--dry-run : Show what would change without saving anything}
        {--sync : Also refresh name, collection, new-arrival flag, slug and missing photos of already imported products}
        {--sizes=* : Sizes for newly imported products of a collection, e.g. --sizes="bangles=2.2,2.4,2.6,2.8"}
        {--rollback : Delete everything this command imported}
        {--force : Do not ask for confirmation}';

    protected $description = 'Import the photographed catalogue (products.json) into the product database – safe to re-run';

    public function handle(PhotoCatalogueImporter $importer): int
    {
        if ($this->option('rollback')) {
            return $this->rollback($importer);
        }

        $file = $this->option('file') ?: base_path('../frontend/src/data/products.json');
        if (! is_file($file)) {
            $this->error("File not found: {$file} (use --file=/path/to/products.json)");

            return self::FAILURE;
        }
        $entries = json_decode((string) file_get_contents($file), true);
        if (! is_array($entries) || ! array_is_list($entries)) {
            $this->error('products.json must contain a JSON array of products.');

            return self::FAILURE;
        }

        $sizes = [];
        foreach ((array) $this->option('sizes') as $rule) {
            if (! preg_match('/^([a-z0-9-]+)=(.+)$/', trim($rule), $m)) {
                $this->error("Invalid --sizes value \"{$rule}\" – expected collection=size1,size2");

                return self::FAILURE;
            }
            $sizes[$m[1]] = array_values(array_unique(array_filter(array_map('trim', explode(',', $m[2])), 'strlen')));
        }

        $dry = (bool) $this->option('dry-run');
        $this->info(($dry ? '[dry run] ' : '').'Importing '.count($entries)." products from {$file}");

        $result = $importer->import($entries, (bool) $this->option('sync'), $sizes, $dry);

        foreach ($result['messages'] as $m) {
            $this->warn('  '.$m);
        }
        $this->table(['Created', 'Updated', 'Unchanged', 'Skipped', 'Categories created', 'Images added'], [array_values($result['stats'])]);
        $this->info($dry ? 'Dry run – nothing was saved.' : 'Done. Imported products are "price on request" until you set prices in Admin → Products or Admin → Prices.');

        return self::SUCCESS;
    }

    private function rollback(PhotoCatalogueImporter $importer): int
    {
        if (! $this->option('force') && ! $this->confirm('Delete ALL imported photo-catalogue products, including prices, colours, sizes, variants and stock set in the admin since the import?')) {
            $this->line('Cancelled.');

            return self::SUCCESS;
        }
        $r = $importer->rollback();
        $this->info("Removed {$r['products']} imported product(s) and {$r['categories']} imported categor".($r['categories'] === 1 ? 'y' : 'ies').'. The storefront falls back to the static photo catalogue.');

        return self::SUCCESS;
    }
}
