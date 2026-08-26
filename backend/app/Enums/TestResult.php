<?php

namespace App\Enums;

/**
 * Hasil satu laporan pengujian pada jalur QA atau Keamanan Siber.
 *
 * CONDITIONAL_PASS hanya sah sebagai penilaian pelaksana pengujian ("lulus dengan
 * catatan"). Keputusan Lead pada sign-off tetap biner — lulus atau kembalikan ke
 * pengembangan — karena alur kerja tidak punya jalur untuk keadaan ketiga.
 */
enum TestResult: string
{
    case PASS = 'pass';
    case FAIL = 'fail';
    case CONDITIONAL_PASS = 'conditional_pass';

    /**
     * Daftar nilai yang sah, untuk dipakai pada aturan validasi `in:`.
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::PASS => 'Lulus',
            self::FAIL => 'Tidak Lulus',
            self::CONDITIONAL_PASS => 'Lulus dengan Catatan',
        };
    }

    /**
     * Hasil ini tidak menyisakan temuan yang wajib diperbaiki.
     */
    public function isPass(): bool
    {
        return $this === self::PASS;
    }
}
