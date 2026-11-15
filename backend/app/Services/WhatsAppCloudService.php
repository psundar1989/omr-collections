<?php

namespace App\Services;

use App\Models\Order;
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

    /**
     * WhatsApp numbers (digits only) that receive the photo of each ordered item: the
     * customer's WhatsApp number, plus the shop's notification numbers if set.
     *
     * @return list<string>
     */
    public function recipients(Order $order): array
    {
        $numbers = [$order->whatsapp_number, ...explode(',', (string) config('services.whatsapp_cloud.notify_numbers'))];

        return array_values(array_unique(array_filter(array_map(fn ($n) => preg_replace('/\D+/', '', (string) $n), $numbers))));
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
     * Send the item's photo with the order details to one WhatsApp number (by default the
     * customer's). Template body variables, in order:
     * {{1}} order number, {{2}} product (with colour / size), {{3}} SKU, {{4}} unit price,
     * {{5}} quantity, {{6}} product link, {{7}} customer (name and phone numbers),
     * {{8}} delivery address, {{9}} order total.
     *
     * @throws ConnectionException
     * @throws RequestException
     */
    public function sendOrderItemImage(OrderItem $item, ?string $to = null): void
    {
        $config = config('services.whatsapp_cloud');
        $order = $item->order;
        $to ??= $order->whatsapp_number;

        Http::connectTimeout(5)
            ->timeout(15)
            ->withToken($config['token'])
            ->post("https://graph.facebook.com/{$config['api_version']}/{$config['phone_number_id']}/messages", [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => preg_replace('/\D+/', '', $to),
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
                            $this->bodyTexts($item, $order),
                        )],
                    ],
                ],
            ])
            ->throw();
    }

    /** @return list<string> */
    public function bodyTexts(OrderItem $item, Order $order): array
    {
        $symbol = $this->settings->get('currency_symbol', '₹');
        $variation = array_filter([$item->colour, $item->size]);
        $phones = array_unique(array_filter([$order->phone, $order->whatsapp_number]));
        $total = $order->has_price_on_request
            ? ((float) $order->total > 0 ? Money::format((float) $order->total, $symbol).' + items on request' : 'On Request')
            : Money::format((float) $order->total, $symbol);

        return array_map(self::templateText(...), [
            $order->order_number,
            $item->product_name.($variation ? ' ('.implode(' / ', $variation).')' : ''),
            (string) $item->sku,
            $item->unit_price === null ? 'On Request' : Money::format((float) $item->unit_price, $symbol),
            (string) $item->quantity,
            (string) Media::shareableUrl($item->product_url),
            implode(', ', [$order->customer_name, ...$phones]),
            implode(', ', array_filter([$order->address, $order->landmark, $order->city, $order->state, $order->pincode])),
            $total,
        ]);
    }

    /**
     * Meta rejects template variables that are empty or contain new lines, tabs or more than
     * four spaces in a row, so addresses typed on several lines are joined into one.
     */
    private static function templateText(string $text): string
    {
        $text = trim((string) preg_replace('/\s*[\r\n]+\s*/u', ', ', $text));
        $text = (string) preg_replace('/[\t ]+/u', ' ', $text);

        return $text === '' ? '-' : mb_strimwidth($text, 0, 300, '…');
    }
}
