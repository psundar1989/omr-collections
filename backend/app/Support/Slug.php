<?php

namespace App\Support;

use Illuminate\Support\Str;

class Slug
{
    /** Unique slug for a model class (soft-deleted rows included, since the column is unique). */
    public static function unique(string $modelClass, string $source, ?int $ignoreId = null): string
    {
        $base = Str::slug($source) ?: Str::lower(Str::random(6));
        $slug = $base;
        $i = 2;
        $query = fn ($s) => $modelClass::withTrashed()->where('slug', $s)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists();
        while ($query($slug)) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
