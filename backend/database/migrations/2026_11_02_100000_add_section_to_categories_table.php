<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Homepage collection a category is shown in (e.g. "beads", "charms"); null = general "Shop by Category". */
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('section', 32)->nullable()->after('description');
            $table->index(['section', 'is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropIndex(['section', 'is_active', 'sort_order']);
            $table->dropColumn('section');
        });
    }
};
