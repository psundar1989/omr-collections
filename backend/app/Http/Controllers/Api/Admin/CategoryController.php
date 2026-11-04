<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Support\Media;
use App\Support\Slug;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index()
    {
        return CategoryResource::collection(Category::ordered()->withCount('products')->get());
    }

    public function show(Category $category)
    {
        return new CategoryResource($category->loadCount('products'));
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = Slug::unique(Category::class, $data['slug'] ?? $data['name']);
        $data['sort_order'] ??= (int) Category::max('sort_order') + 1;
        $this->handleImage($request, $data);

        return (new CategoryResource(Category::create($data)))->response()->setStatusCode(201);
    }

    public function update(Request $request, Category $category)
    {
        $data = $this->validated($request, $category);
        if (array_key_exists('slug', $data) || isset($data['name'])) {
            $data['slug'] = Slug::unique(Category::class, $data['slug'] ?? $category->slug, $category->id);
        }
        $this->handleImage($request, $data, $category);
        $category->update($data);

        return new CategoryResource($category->loadCount('products'));
    }

    public function destroy(Category $category)
    {
        // Products keep existing but become uncategorised.
        $category->products()->update(['category_id' => null]);
        $category->delete();

        return response()->noContent();
    }

    public function reorder(Request $request)
    {
        $v = $request->validate(['ids' => 'required|array', 'ids.*' => 'integer|exists:categories,id']);
        DB::transaction(function () use ($v) {
            foreach ($v['ids'] as $i => $id) {
                Category::whereKey($id)->update(['sort_order' => $i + 1]);
            }
        });

        return $this->index();
    }

    private function validated(Request $request, ?Category $category = null): array
    {
        $req = $category ? 'sometimes|required' : 'required';

        return $request->validate([
            'name' => "{$req}|string|max:120",
            'slug' => ['nullable', 'string', 'max:140', 'alpha_dash', Rule::unique('categories', 'slug')->ignore($category?->id)],
            'description' => 'nullable|string|max:2000',
            'section' => ['nullable', Rule::in(Category::SECTIONS)],
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
            'remove_image' => 'sometimes|boolean',
        ]);
    }

    private function handleImage(Request $request, array &$data, ?Category $category = null): void
    {
        $remove = $request->boolean('remove_image');
        unset($data['image'], $data['remove_image']);
        if ($request->hasFile('image') || $remove) {
            if ($category) {
                Media::delete($category->image_path, $category->image_disk);
            }
            $data['image_path'] = null;
        }
        if ($request->hasFile('image')) {
            [$data['image_path'], $data['image_disk']] = Media::store($request->file('image'), 'categories');
        }
    }
}
