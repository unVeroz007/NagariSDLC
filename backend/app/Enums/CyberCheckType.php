<?php

namespace App\Enums;

/**
 * Jenis pemeriksaan pada jalur Audit Keamanan Siber.
 *
 * Dipakai kolom `projects.cyber_check_type`. PM memilih salah satu saat mengajukan
 * audit, dan pilihan itu menentukan masukan wajib bagi Pentester:
 *
 * - PENTEST menguji aplikasi berjalan, sehingga `cyber_target_url` wajib diisi.
 * - SECURE_CODE membaca kode sumber, sehingga `cyber_source_code_ref` wajib diisi.
 *
 * Jenis pemeriksaan tidak menentukan daftar skenario yang wajib dikerjakan. Ruang lingkup
 * audit keamanan berbeda pada tiap proyek, sehingga pelaksana menarasikan lingkup dan
 * temuannya pada catatan laporan, bukan mencentang daftar tetap.
 *
 * Pemeriksaan wajib-isi tersebut ditegakkan di Form Request pengajuan, bukan di sini;
 * enum ini hanya menjadi satu sumber kebenaran atas jenis yang dikenal beserta
 * konsekuensinya.
 */
enum CyberCheckType: string
{
    case PENTEST = 'pentest';
    case SECURE_CODE = 'secure_code';

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
     * Normalisasi nilai bebas (huruf besar, spasi, null) menjadi enum.
     *
     * Mengembalikan null — bukan nilai bawaan — karena proyek yang belum pernah
     * diajukan ke jalur Siber memang belum punya jenis pemeriksaan, dan menebaknya
     * akan menyesatkan Pentester.
     */
    public static function normalize(mixed $value): ?self
    {
        if ($value instanceof self) {
            return $value;
        }

        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        return self::tryFrom(mb_strtolower(trim((string) $value)));
    }

    public function label(): string
    {
        return match ($this) {
            self::PENTEST => 'Penetration Test',
            self::SECURE_CODE => 'Secure Code Review',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::PENTEST => 'Pengujian keamanan terhadap aplikasi yang sudah berjalan pada lingkungan uji.',
            self::SECURE_CODE => 'Penelaahan keamanan terhadap kode sumber aplikasi.',
        };
    }

    /**
     * Jenis ini menguji aplikasi berjalan, sehingga alamat web target wajib ada.
     */
    public function requiresTargetUrl(): bool
    {
        return $this === self::PENTEST;
    }

    /**
     * Jenis ini menelaah kode, sehingga rujukan kode sumber wajib ada.
     */
    public function requiresSourceCodeRef(): bool
    {
        return $this === self::SECURE_CODE;
    }
}
