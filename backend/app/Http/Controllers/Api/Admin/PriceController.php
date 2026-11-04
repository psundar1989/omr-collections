<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductPriceHistory;
use App\Services\PriceManagementService as P;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PriceController extends Controller
{
    public function __construct(private P $prices) {}

    public function preview(Request $request)
    {
        $rule = $this->rule($request);
        $rows = $this->prices->preview($rule);

        return ['data' => [
            'summary' => $this->prices->describe($rule),
            'matched' => $rows->count(),
            'will_change' => $rows->where('changed', true)->count(),
            'rows' => $rows->values(),
        ]];
    }

    public function apply(Request $request)
    {
        $request->validate(['confirm' => 'accepted'], ['confirm.accepted' => 'Please confirm the bulk price update.']);
        $result = $this->prices->apply($this->rule($request), $request->user());

        return ['data' => $result, 'message' => "{$result['updated']} product(s) updated."];
    }

    public function history(Request $request)
    {
        $v = $request->validate([
            'product_id' => 'nullable|integer',
            'source' => 'nullable|in:manual,bulk,product_form',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        return ProductPriceHistory::with(['product:id,name,sku', 'user:id,name'])
            ->when($v['product_id'] ?? null, fn ($q, $id) => $q->where('product_id', $id))
            ->when($v['source'] ?? null, fn ($q, $s) => $q->where('change_source', $s))
            ->latest()->latest('id')
            ->paginate($v['per_page'] ?? 25);
    }

    private function rule(Request $request): array
    {
        return $request->validate([
            'scope' => ['required', Rule::in(P::SCOPES)],
            'category_id' => 'required_if:scope,category|nullable|integer|exists:categories,id',
            'product_ids' => 'required_if:scope,products|nullable|array|max:1000',
            'product_ids.*' => 'integer',
            'target' => ['required', Rule::in(P::TARGETS)],
            'operation' => ['required', Rule::in(P::OPERATIONS)],
            'value' => 'required_unless:operation,clear_sale|nullable|numeric|min:0|max:1000000',
            'rounding' => ['nullable', Rule::in(P::ROUNDING)],
            'only_active' => 'sometimes|boolean',
            'note' => 'nullable|string|max:255',
        ]) + ['rounding' => 'none'];
    }
}
