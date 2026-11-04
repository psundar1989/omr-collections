<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BannerResource;
use App\Models\Banner;
use App\Support\Media;
use Illuminate\Http\Request;

class BannerController extends Controller
{
    public function index()
    {
        return BannerResource::collection(Banner::orderBy('sort_order')->get());
    }

    public function store(Request $request)
    {
        $data = $this->validated($request, true);
        $data['sort_order'] ??= (int) Banner::max('sort_order') + 1;
        [$data['image_path'], $data['image_disk']] = Media::store($request->file('image'), 'banners');
        unset($data['image']);

        return (new BannerResource(Banner::create($data)))->response()->setStatusCode(201);
    }

    public function update(Request $request, Banner $banner)
    {
        $data = $this->validated($request, false);
        if ($request->hasFile('image')) {
            Media::delete($banner->image_path, $banner->image_disk);
            [$data['image_path'], $data['image_disk']] = Media::store($request->file('image'), 'banners');
        }
        unset($data['image']);
        $banner->update($data);

        return new BannerResource($banner);
    }

    public function destroy(Banner $banner)
    {
        Media::delete($banner->image_path, $banner->image_disk);
        $banner->delete();

        return response()->noContent();
    }

    public function reorder(Request $request)
    {
        $v = $request->validate(['ids' => 'required|array', 'ids.*' => 'integer']);
        foreach ($v['ids'] as $i => $id) {
            Banner::whereKey($id)->update(['sort_order' => $i + 1]);
        }

        return $this->index();
    }

    private function validated(Request $request, bool $creating): array
    {
        return $request->validate([
            'title' => ($creating ? 'required' : 'sometimes|required').'|string|max:150',
            'subtitle' => 'nullable|string|max:500',
            'button_text' => 'nullable|string|max:50',
            'button_link' => ['nullable', 'string', 'max:255', 'regex:/^(\/|https?:\/\/)/'],
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'image' => ($creating ? 'required' : 'nullable').'|image|mimes:jpg,jpeg,png,webp|max:6144',
        ], ['button_link.regex' => 'Link must start with / or http(s)://']);
    }
}
