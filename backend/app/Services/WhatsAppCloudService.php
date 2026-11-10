<?php

namespace App\Services;

use App\Models\OrderItem;
use App\Support\Media;
use App\Support\Money;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * Meta WhatsApp Cloud API. A wa.me link can only prefill text, so this is the only way to
 * deliver a product photo as an attachment. The customer has not messaged the business when
 * the order is placed, so Meta only accepts an approved template here, not a free-form image.
 */
class WhatsAppCloudService
{
    /** Image formats WhatsApp accepts as image media. */
    private const ATTACHABLE_EXTENSIONS = ['jpg', 'jpeg', 'png'];

    public function __construct(private SettingsService $settings) {}

    public function isEnabled(): bool
    {
        return filled(config('services.whatsapp_cloud.token'))
            && filled(config('services.whatsapp_cloud.phone_number_id'))
            && filled(config('services.whatsapp_cloud.template'));
    }

    /** The URL Meta can download this item's photo from, or null when it could not. */
    public function attachableImageUrl(OrderItem $item): ?string
    {
        $url = Media::absoluteUrl($item->image_url);
        if (! $url) {
            return null;
        }
        $extension = strtolower(pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));

        return in_array($extension, self::ATTACHABLE_EXTENSIONS, true) ? $url : null;
    }

    /**
     * Send the item's photo to the WhatsApp number on its order.
     *
     * @throws ConnectionException
     * @throws RequestException
     */
    public function sendOrderItemImage(OrderItem $item): void
    {
        $config = config('services.whatsapp_cloud');
        $order = $item->order;
        $variation = array_filter([$item->colour, $item->size]);
        $product = $item->product_name.($variation ? ' ('.implode(' / ', $variation).')' : '');
        $amount = $item->unit_price === null
            ? 'On Request'
            : Money::format((float) $item->line_total, $this->settings->get('currency_symbol', '₹'));

        Http::connectTimeout(5)
            ->timeout(15)
            ->withToken($config['token'])
            ->post("https://graph.facebook.com/{$config['api_version']}/{$config['phone_number_id']}/messages", [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => preg_replace('/\D+/', '', $order->whatsapp_number),
                'type' => 'template',
                'template' => [
                    'name' => $config['template'],
                    'language' => ['code' => $config['template_language']],
                    'components' => [
                        ['type' => 'header', 'parameters' => [
                            ['type' => 'image', 'image' => ['link' => $this->attachableImageUrl($item)]],
                        ]],
                        ['type' => 'body', 'parameters' => array_map(
                            fn (string $text) => ['type' => 'text', 'text' => $text],
                            [$order->order_number, $product, (string) $item->quantity, $amount],
                        )],
                    ],
                ],
            ])
            ->throw();
    }
}
