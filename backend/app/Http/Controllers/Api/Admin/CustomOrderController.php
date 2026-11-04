<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomOrderRequest;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomOrderController extends Controller
{
    public function index(Request $request)
    {
        $v = $request->validate(['status' => ['nullable', Rule::in(CustomOrderRequest::STATUSES)]]);

        return CustomOrderRequest::when($v['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->latest()->paginate(20);
    }

    public function update(Request $request, CustomOrderRequest $customOrder)
    {
        $customOrder->update($request->validate([
            'status' => ['sometimes', Rule::in(CustomOrderRequest::STATUSES)],
            'admin_notes' => 'nullable|string|max:2000',
        ]));

        return ['data' => $customOrder];
    }

    public function destroy(CustomOrderRequest $customOrder)
    {
        $customOrder->delete();

        return response()->noContent();
    }
}
