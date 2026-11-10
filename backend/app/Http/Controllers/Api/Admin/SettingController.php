<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\SettingsService;
use App\Support\Media;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function __construct(private SettingsService $settings) {}

    public function show()
    {
        return ['data' => $this->settings->publicSettings()];
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'business_name' => 'sometimes|required|string|max:120',
            'tagline' => 'nullable|string|max:150',
            'hero_description' => 'nullable|string|max:500',
            'announcement_text' => 'nullable|string|max:200',
            'whatsapp_number' => ['sometimes', 'required', 'string', 'regex:/^\+?[0-9\s\-]{10,16}$/'],
            'contact_email' => 'nullable|email|max:150',
            'phone_number' => 'nullable|string|max:30',
            'currency' => 'sometimes|required|string|size:3',
            'currency_symbol' => 'sometimes|required|string|max:5',
            'business_address' => 'nullable|string|max:500',
            'footer_description' => 'nullable|string|max:500',
            'instagram_url' => 'nullable|url|max:255',
            'facebook_url' => 'nullable|url|max:255',
            'youtube_url' => 'nullable|url|max:255',
            'pinterest_url' => 'nullable|url|max:255',
            'price_note' => 'nullable|string|max:100',
            'order_disclaimer' => 'nullable|string|max:500',
            'free_shipping_threshold' => 'nullable|numeric|min:0',
            'meta_description' => 'nullable|string|max:300',
            'testimonials' => 'nullable|array|max:20',
            'testimonials.*.name' => 'required|string|max:80',
            'testimonials.*.location' => 'nullable|string|max:80',
            'testimonials.*.text' => 'required|string|max:500',
            'testimonials.*.rating' => 'nullable|integer|min:1|max:5',
            'instagram_images' => 'nullable|array|max:12',
            'instagram_images.*.image_url' => 'required|url|max:500',
            'instagram_images.*.link' => 'nullable|url|max:500',
            'colour_swatches' => 'nullable|array|max:200',
            'colour_swatches.*.name' => 'required|string|max:60|distinct:ignore_case',
            'colour_swatches.*.hex' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'size_presets' => 'nullable|array|max:50',
            'size_presets.*.name' => 'required|string|max:60|distinct:ignore_case',
            'size_presets.*.sizes' => 'required|array|min:1|max:30',
            'size_presets.*.sizes.*' => 'required|string|max:60',
        ], [
            'size_presets.*.name.distinct' => 'Each size preset name can only be used once.',
            'colour_swatches.*.hex.regex' => 'Swatch colours must be hex codes like #708238.',
            'colour_swatches.*.name.distinct' => 'Each colour name can only be listed once.', 'whatsapp_number.regex' => 'Enter the WhatsApp number with country code, e.g. 919876543210.']);

        if (isset($data['whatsapp_number'])) {
            $digits = preg_replace('/\D+/', '', $data['whatsapp_number']);
            // A bare 10-digit Indian mobile gets the 91 country code.
            $data['whatsapp_number'] = strlen($digits) === 10 ? '91'.$digits : $digits;
        }

        if (isset($data['colour_swatches'])) {
            $data['colour_swatches'] = array_values(array_map(fn ($c) => ['name' => trim($c['name']), 'hex' => strtoupper($c['hex'])], $data['colour_swatches']));
        }

        if (isset($data['size_presets'])) {
            $data['size_presets'] = array_values(array_map(fn ($p) => [
                'name' => trim($p['name']),
                'sizes' => array_values(array_unique(array_filter(array_map(fn ($x) => trim((string) $x), $p['sizes']), 'strlen'))),
            ], $data['size_presets']));
        }

        $this->settings->set($data);

        return $this->show();
    }

    /** Upload logo / favicon / generic media (e.g. Instagram gallery images). */
    public function upload(Request $request)
    {
        $v = $request->validate([
            'type' => 'required|in:logo,favicon,media',
            'file' => 'required|file|mimes:jpg,jpeg,png,webp,svg,ico|max:4096',
        ]);
        [$path, $disk] = Media::store($request->file('file'), 'settings');

        if ($v['type'] !== 'media') {
            $key = $v['type'].'_path';
            Media::delete($this->settings->get($key));
            $this->settings->set([$key => $path]);
        }

        return ['data' => ['url' => Media::url($path, $disk), 'settings' => $this->settings->publicSettings()]];
    }
}
