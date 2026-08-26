<?php

namespace App\Enums;

/**
 * Status satu putaran pengembalian proyek dari jalur pengujian ke pengembangan.
 *
 * Satu putaran lahir ketika Lead QA atau Lead Keamanan Siber melakukan sign-off
 * dengan hasil TIDAK LULUS, dan tertutup ketika Project Manager berhasil mengajukan
 * ulang jalur yang sama untuk diuji kembali.
 *
 * Siklusnya sengaja hanya dua keadaan. Putaran adalah catatan peristiwa, bukan
 * papan kerja: yang berubah selama putaran terbuka adalah task perbaikannya, bukan
 * putarannya sendiri. Menambah keadaan perantara ("sedang dikerjakan", "menunggu")
 * hanya menduplikasi apa yang sudah dapat dibaca dari status task perbaikan.
 *
 * OPEN        → baru dikembalikan, perbaikan belum diajukan ulang.
 * RESUBMITTED → seluruh task perbaikan selesai dan jalurnya sudah diajukan ulang.
 *
 * Putaran tidak pernah dihapus dan tidak pernah kembali dari RESUBMITTED ke OPEN.
 * Bila jalur yang sama gagal lagi, yang lahir adalah putaran BARU dengan
 * `round_number` berikutnya, sehingga riwayat setiap putaran tetap utuh.
 */
enum ReturnRoundStatus: string
{
    case OPEN = 'OPEN';
    case RESUBMITTED = 'RESUBMITTED';

    /**
     * Daftar nilai yang sah, untuk dipakai pada aturan validasi `in:`.
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Normalisasi nilai bebas (data lama, huruf kecil, null) menjadi enum.
     *
     * Nilai yang tidak dikenal dianggap masih terbuka. Sebuah putaran yang tidak
     * dapat dibaca lebih baik tetap menahan pengajuan ulang daripada diam-diam
     * dianggap selesai — gerbang yang gagal terbuka menghapus gunanya gerbang.
     */
    public static function normalize(mixed $value): self
    {
        if ($value instanceof self) {
            return $value;
        }

        return self::tryFrom(mb_strtoupper(trim((string) $value))) ?? self::OPEN;
    }

    public function isOpen(): bool
    {
        return $this === self::OPEN;
    }

    public function label(): string
    {
        return match ($this) {
            self::OPEN => 'Menunggu Perbaikan',
            self::RESUBMITTED => 'Sudah Diajukan Ulang',
        };
    }
}
