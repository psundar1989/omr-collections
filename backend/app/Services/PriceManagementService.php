<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductPriceHistory;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PriceManagementService
{
    public const OPERATIONS = ['increase_percent', 'decrease_percent', 'increase_fixed', 'decrease_fixed', 'set_fixed', 'clear_sale'];

    public const TARGETS = ['regular', 'sale', 'both'];

    public const SCOPES = ['all', 'category', 'products'];

    public const ROUNDING = ['none', '1', '5', '10'];

    /**
     * Compute the changes a bulk rule would make, without saving anything.
     * Each row: product, old/new regular, old/new sale, warnings.
     */
    public function preview(array $rule): Collection
    {
        return $this->query($rule)->with('category:id,name')->orderBy('name')->get()
            ->map(fn (Product $p) => $this->computeRow($p, $rule));
    }

    /** Apply a bulk rule inside a transaction, logging every changed price. */
    public function apply(array $rule, User $user): array
    {
        return DB::transaction(function () use ($rule, $user) {
            $rows = $this->query($rule)->lockForUpdate()->get()
                ->map(fn (Product $p) => ['product' => $p, 'row' => $this->computeRow($p, $rule)]);

            $changed = 0;
            foreach ($rows as ['product' => $p, 'row' => $row]) {
                if (! $row['changed']) {
                    continue;
                }
                $this->updatePrices($p, $row['new_regular_price'], $row['new_sale_price'], $user, 'bulk', $rule['note'] ?? $this->describe($rule));
                $changed++;
            }

            return ['matched' => $rows->count(), 'updated' => $changed];
        });
    }

    /** Update one product's prices and write history rows for anything that changed. */
    public function updatePrices(Product $product, float $regular, ?float $sale, ?User $user, string $source = 'manual', ?string $note = null): Product
    {
        $oldRegular = (float) $product->regular_price;
        $oldSale = $product->sale_price !== null ? (float) $product->sale_price : null;

        $product->regular_price = $regular;
        $product->sale_price = $sale;
        $product->save();

        if (round($oldRegular, 2) !== round($regular, 2)) {
            $this->log($product, 'regular', $oldRegular, $regular, $user, $source, $note);
        }
        if ($oldSale === null ? $sale !== null : ($sale === null || round($oldSale, 2) !== round($sale, 2))) {
            $this->log($product, 'sale', $oldSale, $sale, $user, $source, $note);
        }

        return $product;
    }

    private function log(Product $p, string $type, ?float $old, ?float $new, ?User $user, string $source, ?string $note): void
    {
        ProductPriceHistory::create([
            'product_id' => $p->id,
            'user_id' => $user?->id,
            'price_type' => $type,
            'old_price' => $old,
            'new_price' => $new,
            'change_source' => $source,
            'note' => $note ? mb_substr($note, 0, 255) : null,
        ]);
    }

    private function query(array $rule): Builder
    {
        $q = Product::query();
        if ($rule['scope'] === 'category') {
            $q->where('category_id', $rule['category_id']);
        } elseif ($rule['scope'] === 'products') {
            $q->whereIn('id', $rule['product_ids'] ?? []);
        }
        if (! empty($rule['only_active'])) {
            $q->where('is_active', true);
        }

        return $q;
    }

    private function computeRow(Product $p, array $rule): array
    {
        $op = $rule['operation'];
        $value = (float) ($rule['value'] ?? 0);
        $target = $rule['target'] ?? 'regular';
        $round = $rule['rounding'] ?? 'none';

        $oldRegular = (float) $p->regular_price;
        $oldSale = $p->sale_price !== null ? (float) $p->sale_price : null;
        $newRegular = $oldRegular;
        $newSale = $oldSale;
        $warnings = [];

        if ($op === 'clear_sale') {
            $newSale = null;
        } else {
            if (in_array($target, ['regular', 'both'], true)) {
                $newRegular = $this->roundPrice($this->calc($oldRegular, $op, $value), $round);
            }
            if (in_array($target, ['sale', 'both'], true)) {
                if ($oldSale === null && $op !== 'set_fixed') {
                    $warnings[] = 'No sale price set – sale price left empty.';
                } else {
                    $newSale = $this->roundPrice($this->calc($oldSale ?? $oldRegular, $op, $value), $round);
                }
            }
        }

        if ($newRegular <= 0) {
            $warnings[] = 'Regular price would be zero or negative – kept at 0.01 minimum.';
            $newRegular = 0.01;
        }
        if ($newSale !== null && $newSale <= 0) {
            $warnings[] = 'Sale price would be zero or negative – sale price removed.';
            $newSale = null;
        }
        if ($newSale !== null && $newSale >= $newRegular) {
            $warnings[] = 'Sale price would not be lower than the regular price – sale price removed.';
            $newSale = null;
        }

        return [
            'product_id' => $p->id,
            'name' => $p->name,
            'sku' => $p->sku,
            'category' => $p->category?->name,
            'old_regular_price' => $oldRegular,
            'new_regular_price' => round($newRegular, 2),
            'old_sale_price' => $oldSale,
            'new_sale_price' => $newSale !== null ? round($newSale, 2) : null,
            'changed' => round($oldRegular, 2) !== round($newRegular, 2) || $oldSale !== ($newSale !== null ? round($newSale, 2) : null),
            'warnings' => $warnings,
        ];
    }

    private function calc(float $price, string $op, float $value): float
    {
        return match ($op) {
            'increase_percent' => $price * (1 + $value / 100),
            'decrease_percent' => $price * (1 - $value / 100),
            'increase_fixed' => $price + $value,
            'decrease_fixed' => $price - $value,
            'set_fixed' => $value,
            default => $price,
        };
    }

    private function roundPrice(float $price, string $mode): float
    {
        if ($mode === 'none') {
            return round($price, 2);
        }
        $step = (int) $mode;

        return round($price / $step) * $step;
    }

    public function describe(array $rule): string
    {
        $v = $rule['value'] ?? '';
        $op = match ($rule['operation']) {
            'increase_percent' => "+{$v}%",
            'decrease_percent' => "-{$v}%",
            'increase_fixed' => "+₹{$v}",
            'decrease_fixed' => "-₹{$v}",
            'set_fixed' => "set to ₹{$v}",
            'clear_sale' => 'sale price cleared',
            default => $rule['operation'],
        };

        return "Bulk update ({$rule['target']} price {$op})";
    }
}
