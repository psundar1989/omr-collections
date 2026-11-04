<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\OfferResource;
use App\Models\Offer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OfferController extends Controller
{
    public function index()
    {
        return OfferResource::collection(Offer::with(['products:id,name,sku', 'categories:id,name'])->latest()->get());
    }

    public function show(Offer $offer)
    {
        return new OfferResource($offer->load(['products:id,name,sku', 'categories:id,name']));
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $offer = DB::transaction(function () use ($data) {
            $offer = Offer::create($data);
            $offer->products()->sync($data['product_ids'] ?? []);
            $offer->categories()->sync($data['category_ids'] ?? []);

            return $offer;
        });

        return $this->show($offer)->response()->setStatusCode(201);
    }

    public function update(Request $request, Offer $offer)
    {
        $data = $this->validated($request, $offer);
        DB::transaction(function () use ($offer, $data) {
            $offer->update($data);
            if (array_key_exists('product_ids', $data)) {
                $offer->products()->sync($data['product_ids'] ?? []);
            }
            if (array_key_exists('category_ids', $data)) {
                $offer->categories()->sync($data['category_ids'] ?? []);
            }
        });

        return $this->show($offer);
    }

    public function destroy(Offer $offer)
    {
        $offer->delete();

        return response()->noContent();
    }

    private function validated(Request $request, ?Offer $offer = null): array
    {
        $req = $offer ? 'sometimes|required' : 'required';

        return $request->validate([
            'name' => "{$req}|string|max:150",
            'description' => 'nullable|string|max:1000',
            'discount_percentage' => "{$req}|numeric|min:0.01|max:90",
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'is_active' => 'sometimes|boolean',
            'product_ids' => 'nullable|array',
            'product_ids.*' => 'integer|exists:products,id',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:categories,id',
        ]);
    }
}
