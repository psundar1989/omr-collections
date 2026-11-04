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
    ];

    public const JSON_KEYS = ['testimonials', 'instagram_images'];

    public const FILE_KEYS = ['logo_path', 'favicon_path'];

    public function all(): array
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
