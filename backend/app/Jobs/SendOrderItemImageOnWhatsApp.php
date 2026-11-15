<?php

namespace App\Jobs;

use App\Models\OrderItem;
use App\Services\WhatsAppCloudService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendOrderItemImageOnWhatsApp implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [30, 120];

    /** @param  string|null  $to  WhatsApp number; null = the customer's (jobs queued before this was added). */
    public function __construct(public OrderItem $item, public ?string $to = null) {}

    public function handle(WhatsAppCloudService $whatsAppCloud): void
    {
        $whatsAppCloud->sendOrderItemImage($this->item, $this->to);
    }

    public function failed(?Throwable $exception): void
    {
        Log::error('WhatsApp product photo could not be sent.', [
            'order_item_id' => $this->item->id,
            'to' => $this->to,
            'error' => $exception?->getMessage(),
        ]);
    }
}
