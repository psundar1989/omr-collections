<?php

namespace App\Services;

use App\Models\WebsiteSetting;
use App\Support\Media;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    private const CACHE_KEY = 'website_settings.v1';

    /** Every setting key with its default. JSON settings are stored encoded. */
    public const DEFAULTS = [
        'business_name' => 'OMR Collections',
        'tagline' => 'Handmade With Love',
        'hero_description' => 'Thoughtfully handcrafted bracelets, necklaces and accessories, made in small batches by Indian artisans.',
        'announcement_text' => 'Free delivery across India on orders above ₹999 · Order easily on WhatsApp',
        'logo_path' => null,
        'favicon_path' => null,
        'whatsapp_number' => '919840465980',
        'contact_email' => 'hello@example.in',
        'phone_number' => '+91 98404 65980',
        'currency' => 'INR',
        'currency_symbol' => '₹',
        'business_address' => 'Chennai, Tamil Nadu, India',
        'footer_description' => 'Handcrafted jewellery and accessories, made with love in India. All orders are placed and confirmed personally over WhatsApp.',
        'instagram_url' => null,
        'facebook_url' => null,
        'youtube_url' => null,
        'pinterest_url' => null,
        'price_note' => 'Inclusive of all taxes',
        'order_disclaimer' => 'Your order is not confirmed until the seller confirms it on WhatsApp. Delivery charges and payment (UPI / bank transfer / COD where available) are shared on WhatsApp.',
        'free_shipping_threshold' => '999',
        'testimonials' => '[]',
        'instagram_images' => '[]',
        'meta_description' => 'Shop handmade bracelets, necklaces, earrings and gift collections. Order directly on WhatsApp.',
        // Colour name → swatch colour for product colour pickers. Product colours are plain
        // names; the storefront looks the swatch up here (editable in Admin → Settings).
        'colour_swatches' => '[{"name":"Red","hex":"#D32F2F"},{"name":"Ruby Red","hex":"#9B111E"},{"name":"Maroon","hex":"#800020"},{"name":"Pink","hex":"#F06292"},{"name":"Blush Pink","hex":"#F4C2C2"},{"name":"Baby Pink","hex":"#F8BBD0"},{"name":"Rani Pink","hex":"#E3107A"},{"name":"Peach","hex":"#FFCBA4"},{"name":"Peach Pink","hex":"#F7A9A0"},{"name":"Magenta","hex":"#C2185B"},{"name":"Orange","hex":"#F57C00"},{"name":"Yellow","hex":"#FBC02D"},{"name":"Mustard","hex":"#D4A017"},{"name":"Gold","hex":"#C9A227"},{"name":"Champagne","hex":"#F1DDB5"},{"name":"Green","hex":"#2E7D32"},{"name":"Olive Green","hex":"#708238"},{"name":"Emerald Green","hex":"#046307"},{"name":"Bottle Green","hex":"#006A4E"},{"name":"Parrot Green","hex":"#57B947"},{"name":"Lime Green","hex":"#8BC34A"},{"name":"Mint Green","hex":"#98E2C6"},{"name":"Teal","hex":"#00897B"},{"name":"Aqua Blue","hex":"#3CC7D6"},{"name":"Sky Blue","hex":"#7EC8E3"},{"name":"Blue","hex":"#1E63C6"},{"name":"Royal Blue","hex":"#2747B3"},{"name":"Sapphire Blue","hex":"#0F52BA"},{"name":"Navy Blue","hex":"#1B2A57"},{"name":"Purple","hex":"#7B1FA2"},{"name":"Lavender","hex":"#B9A3E3"},{"name":"Lilac","hex":"#C8A2C8"},{"name":"White","hex":"#FFFFFF"},{"name":"Ivory","hex":"#FFFFF0"},{"name":"Cream","hex":"#F6EBD3"},{"name":"Silver","hex":"#C0C0C0"},{"name":"Brown","hex":"#795548"},{"name":"Black","hex":"#1A1A1A"}]',
        // Reusable size sets offered in the product form (Admin → Settings → Size presets).
        // Products store their own size list; presets only speed up data entry.
        'size_presets' => '[{"name":"Bangle sizes","sizes":["2.2","2.4","2.6","2.8","10"]},{"name":"Clothing (S – XXL)","sizes":["S","M","L","XL","XXL"]},{"name":"Free size","sizes":["Free Size"]}]',
    ];

    public const JSON_KEYS = ['testimonials', 'instagram_images', 'colour_swatches', 'size_presets'];

    public const FILE_KEYS = ['logo_path', 'favicon_path'];

    /** Decoded settings, memoised for the request (the service is scoped). */
    private ?array $resolved = null;

    public function all(): array
    {
        return $this->resolved ??= $this->load();
    }

    private function load(): array
    {
        $stored = Cache::rememberForever(self::CACHE_KEY, fn () => WebsiteSetting::pluck('value', 'key')->all());

        $out = [];
        foreach (self::DEFAULTS as $key => $default) {
            $value = array_key_exists($key, $stored) ? $stored[$key] : $default;
            $out[$key] = in_array($key, self::JSON_KEYS, true) ? (json_decode((string) $value, true) ?: []) : $value;
        }

        return $out;
    }

    public function get(string $key, mixed $fallback = null): mixed
    {
        return $this->all()[$key] ?? $fallback;
    }

    /** Settings safe to expose to the storefront, with resolved media URLs. */
    public function publicSettings(): array
    {
        $s = $this->all();
        $s['logo_url'] = Media::url($s['logo_path']);
        $s['favicon_url'] = Media::url($s['favicon_path']);
        unset($s['logo_path'], $s['favicon_path']);

        return $s;
    }

    public function set(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, self::DEFAULTS)) {
                continue;
            }
            if (in_array($key, self::JSON_KEYS, true) && ! is_string($value)) {
                $value = json_encode($value ?? [], JSON_UNESCAPED_UNICODE);
            }
            WebsiteSetting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
        Cache::forget(self::CACHE_KEY);
        $this->resolved = null;
    }

    /**
     * Resolve product colour names to swatches: [{name, hex}] (hex null when unknown).
     * Exact (case-insensitive) palette match first, otherwise the longest palette name
     * contained in the colour, so "Ruby Red & Gold" still gets the "Ruby Red" swatch.
     */
    public function colourOptions(array $names): array
    {
        $palette = collect($this->get('colour_swatches', []))
            ->filter(fn ($c) => is_array($c) && ! empty($c['name']) && ! empty($c['hex']))
            ->mapWithKeys(fn ($c) => [mb_strtolower(trim($c['name'])) => $c['hex']])
            ->sortByDesc(fn ($hex, $name) => mb_strlen($name));

        return array_values(array_map(function ($name) use ($palette) {
            $key = mb_strtolower(trim((string) $name));
            $hex = $palette->get($key)
                ?? $palette->first(fn ($hex, $p) => preg_match('/\\b'.preg_quote($p, '/').'\\b/u', $key) === 1);

            return ['name' => (string) $name, 'hex' => $hex];
        }, $names));
    }

    /** Digits only, as required by wa.me links (country code included, e.g. 9198xxxxxxx). */
    public function whatsappNumber(): string
    {
        return preg_replace('/\D+/', '', (string) $this->get('whatsapp_number'));
    }

    public function whatsappUrl(string $message): string
    {
        return 'https://wa.me/'.$this->whatsappNumber().'?text='.rawurlencode($message);
    }
}
