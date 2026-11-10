<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Media
{
    /**
     * Pseudo-disk for files the storefront serves itself (frontend/public), e.g. the
     * photographed catalogue images at "/images/bangles/…". Paths are returned as-is
     * (root-relative to the storefront) and are never deleted from here.
     */
    public const STATIC_DISK = 'static';

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
        if ($disk === self::STATIC_DISK) {
            return '/'.ltrim($path, '/');
        }

        return Storage::disk($disk ?: self::disk())->url($path);
    }

    /**
     * Full public HTTPS URL of a media file, for places outside the storefront such as
     * WhatsApp messages. Storefront-relative paths are resolved against the frontend URL.
     * Returns null when the result would not open for the recipient: plain HTTP, localhost
     * or a private address (FRONTEND_URL / PUBLIC_STORAGE_URL / AWS_URL not set to production).
     */
    public static function absoluteUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }
        if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
            $url = rtrim(config('shop.frontend_url'), '/').$url;
        }

        if (! self::isPublicHttpsUrl($url)) {
            return null;
        }

        return str_replace(' ', '%20', $url); // a raw space would cut the link short in chat apps
    }

    /**
     * Link for a WhatsApp text message. Same as absoluteUrl(), except that on a local
     * environment a localhost link is kept so the message can be checked during development.
     */
    public static function shareableUrl(?string $url): ?string
    {
        if ($public = self::absoluteUrl($url)) {
            return $public;
        }
        if (! $url || ! app()->isLocal()) {
            return null;
        }
        if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
            $url = rtrim(config('shop.frontend_url'), '/').$url;
        }

        return str_replace(' ', '%20', $url);
    }

    private static function isPublicHttpsUrl(string $url): bool
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);
        $host = parse_url($url, PHP_URL_HOST);
        if (! is_string($scheme) || strtolower($scheme) !== 'https' || ! is_string($host)) {
            return false;
        }

        $host = strtolower(trim($host, '[]'));
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return (bool) filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
        }

        return str_contains($host, '.') && ! Str::endsWith($host, ['.localhost', '.local', '.test', '.internal']);
    }

    public static function delete(?string $path, ?string $disk = null): void
    {
        if ($path && $disk !== self::STATIC_DISK && ! str_starts_with($path, 'http')) {
            Storage::disk($disk ?: self::disk())->delete($path);
        }
    }
}
