<?php

namespace App\Support;

class Money
{
    /** Indian-style grouping: 123456.5 => "1,23,456.50"; whole numbers drop decimals. */
    public static function format(float $amount, string $symbol = '₹'): string
    {
        $negative = $amount < 0;
        $amount = abs(round($amount, 2));
        $int = (string) (int) floor($amount);
        $dec = (int) round(($amount - floor($amount)) * 100);

        if (strlen($int) > 3) {
            $last3 = substr($int, -3);
            $rest = substr($int, 0, -3);
            $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);
            $int = $rest.','.$last3;
        }

        $str = $symbol.$int.($dec > 0 ? '.'.str_pad((string) $dec, 2, '0', STR_PAD_LEFT) : '');

        return $negative ? '-'.$str : $str;
    }
}
