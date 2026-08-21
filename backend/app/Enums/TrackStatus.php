<?php

namespace App\Enums;

/**
 * Status jalur pengujian independen: QA dan Keamanan Siber.
 *
 * Dipakai oleh kolom `projects.qa_status` dan `projects.cyber_status`.
 *
 * Sengaja dipisah dari ProjectStatus. `projects.status` menyimpan SATU penunjuk
 * siklus utama proyek, sedangkan dua jalur pengujian di sini berjalan paralel,
 * bisa maju-mundur sendiri, dan tidak boleh saling menimpa. Tanpa pemisahan ini
 * satu kolom skalar dipaksa mewakili dua keadaan sekaligus, sehingga urutan
 * penyelesaian jalur menentukan berhasil atau gagalnya transisi.
 *
 * Siklus normal satu jalur:
 * NOT_SUBMITTED → SUBMITTED    (PM mengajukan)
 *               → IN_PROGRESS  (Lead mendisposisikan ke tester / auditor)
 *               → REVIEW       (tester / auditor mengirim laporan)
 *               → PASSED | FAILED (Lead melakukan sign-off)
 */
enum TrackStatus: string
{
    case NOT_SUBMITTED = 'NOT_SUBMITTED';
    case SUBMITTED = 'SUBMITTED';
    case IN_PROGRESS = 'IN_PROGRESS';
    case REVIEW = 'REVIEW';
    case PASSED = 'PASSED';
    case FAILED = 'FAILED';

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
     * Nilai yang tidak dikenal dianggap belum diajukan, supaya pembacaan model
     * tidak pernah melempar exception hanya karena ada satu baris lama yang
     * nilainya di luar enum.
     */
    public static function normalize(mixed $value): self
    {
        if ($value instanceof self) {
            return $value;
        }

        return self::tryFrom(mb_strtoupper(trim((string) $value))) ?? self::NOT_SUBMITTED;
    }

    public function isPassed(): bool
    {
        return $this === self::PASSED;
    }

    /**
     * Jalur sedang berjalan: sudah diajukan namun belum ada keputusan akhir.
     */
    public function isActive(): bool
    {
        return in_array($this, [self::SUBMITTED, self::IN_PROGRESS, self::REVIEW], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::NOT_SUBMITTED => 'Belum Diajukan',
            self::SUBMITTED => 'Sudah Diajukan',
            self::IN_PROGRESS => 'Sedang Dikerjakan',
            self::REVIEW => 'Menunggu Review Lead',
            self::PASSED => 'Lulus',
            self::FAILED => 'Tidak Lulus',
        };
    }
}
