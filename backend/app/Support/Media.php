<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class Media
{
    public static function disk(): string
    {
        return config('shop.media_disk', 'public');
    }

    /** Store an upload and return [path, disk]. */
    public static function store(UploadedFile $file, string $folder): array
    {
        $disk = self::disk();
        $path = $file->store($folder, ['disk' => $disk, 'visibility' => 'public']);

        return [$path, $disk];
    }

    public static function url(?string $path, ?string $disk = null): ?string
    {
        if (! $path) {
            return null;
        }
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return Storage::disk($disk ?: self::disk())->url($path);
    }

    public static function delete(?string $path, ?string $disk = null): void
    {
        if ($path && ! str_starts_with($path, 'http')) {
            Storage::disk($disk ?: self::disk())->delete($path);
        }
    }
}
