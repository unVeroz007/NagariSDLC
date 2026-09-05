<?php

namespace App\Services;

use App\Enums\TestingTrack;
use App\Enums\TrackStatus;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Models\ReleaseRequest;
use App\Models\TestReport;
use Illuminate\Support\Collection;

/**
 * Menilai kesiapan rilis produksi sebuah proyek dari data yang benar-benar tersimpan.
 *
 * Empat pilar berasal dari dokumen kebutuhan, hasil QA, hasil Siber, dan rencana
 * rilis. Hasilnya informatif; gerbang transisi tetap milik `ProjectWorkflowService`.
 * Seluruh data dibaca dari relasi yang sudah dimuat untuk menghindari N+1.
 */
class ReleaseReadinessService
{
    /**
     * Pilar sudah terpenuhi.
     */
    public const STATUS_READY = 'ready';

    /**
     * Pilar sedang berjalan atau baru sebagian terpenuhi.
     */
    public const STATUS_ATTENTION = 'attention';

    /**
     * Pilar belum ada buktinya sama sekali.
     */
    public const STATUS_MISSING = 'missing';

    /**
     * Dokumen kebutuhan yang diharapkan ada sebelum rilis.
     *
     * BRD lahir di Fase 1 (permintaan bisnis) dan FSD di Fase 2 (rancangan
     * fungsional). Keduanya adalah rujukan yang dipakai QA menyusun skenario uji,
     * sehingga rilis tanpa keduanya berarti tidak ada acuan pembanding hasil uji.
     *
     * @var array<string, string>
     */
    private const REQUIRED_DOCUMENT_TYPES = [
        'BRD' => 'Dokumen Kebutuhan Bisnis (BRD)',
        'FSD' => 'Spesifikasi Fungsional (FSD)',
    ];

    /**
     * Tingkat keparahan temuan yang perlu ditonjolkan meski jalur dinyatakan lulus.
     *
     * Sign-off Lead adalah keputusan final jalurnya, tetapi laporan berlabel
     * kritikal tetap wajib terlihat pada keputusan go-live: Head of IT berhak tahu
     * bahwa kelulusan diberikan di atas temuan berisiko tinggi.
     *
     * @var list<string>
     */
    private const NOTABLE_SEVERITIES = ['critical', 'high'];

    /**
     * @return array{
     *     is_ready: bool,
     *     pillars: list<array<string, mixed>>,
     *     blocking: list<string>
     * }
     */
    public function evaluate(Project $project): array
    {
        $pillars = [
            $this->evaluateRequirementDocuments($project),
            $this->evaluateTestingTrack($project, TestingTrack::QA),
            $this->evaluateTestingTrack($project, TestingTrack::CYBER),
            $this->evaluateReleasePlan($project),
        ];

        $blocking = array_values(array_map(
            static fn (array $pillar): string => $pillar['label'],
            array_filter(
                $pillars,
                static fn (array $pillar): bool => $pillar['status'] !== self::STATUS_READY
            )
        ));

        return [
            'is_ready' => $blocking === [],
            'pillars' => $pillars,
            'blocking' => $blocking,
        ];
    }

    /**
     * Pilar 1 — dokumen kebutuhan tersimpan di Document Vault.
     *
     * @return array<string, mixed>
     */
    private function evaluateRequirementDocuments(Project $project): array
    {
        $availableTypes = $this->loadedDocuments($project)
            ->pluck('document_type')
            ->map(static fn ($type): string => mb_strtoupper(trim((string) $type)))
            ->unique();

        $missingLabels = [];

        foreach (self::REQUIRED_DOCUMENT_TYPES as $type => $label) {
            if (! $availableTypes->contains($type)) {
                $missingLabels[] = $label;
            }
        }

        $requiredCount = count(self::REQUIRED_DOCUMENT_TYPES);
        $presentCount = $requiredCount - count($missingLabels);

        return $this->pillar(
            key: 'requirements',
            label: 'Dokumen Kebutuhan',
            description: 'BRD & FSD tersimpan di Document Vault',
            status: match (true) {
                $missingLabels === [] => self::STATUS_READY,
                $presentCount > 0 => self::STATUS_ATTENTION,
                default => self::STATUS_MISSING,
            },
            statusLabel: match (true) {
                $missingLabels === [] => 'Lengkap',
                $presentCount > 0 => 'Sebagian',
                default => 'Belum Ada',
            },
            detail: $missingLabels === []
                ? 'BRD dan FSD sudah tersedia.'
                : 'Belum diunggah: '.implode(', ', $missingLabels).'.',
        );
    }

    /**
     * Pilar 2 & 3 — hasil satu jalur pengujian.
     *
     * @return array<string, mixed>
     */
    private function evaluateTestingTrack(Project $project, TestingTrack $track): array
    {
        $trackStatus = $project->trackStatus($track);
        $report = $this->loadedLatestReport($project, $track);

        $status = match (true) {
            $trackStatus->isPassed() => self::STATUS_READY,
            $trackStatus === TrackStatus::FAILED => self::STATUS_MISSING,
            $trackStatus->isActive() => self::STATUS_ATTENTION,
            default => self::STATUS_MISSING,
        };

        $details = [];

        if ($report !== null) {
            $reviewedLabel = $report->reviewed_result?->label();
            $details[] = $reviewedLabel !== null
                ? "Sign-off Lead: {$reviewedLabel}."
                : 'Laporan sudah dikirim, menunggu sign-off Lead.';

            $severity = mb_strtolower(trim((string) $report->severity));

            if (in_array($severity, self::NOTABLE_SEVERITIES, true)) {
                // Kelulusan tetap dihormati, tetapi temuan berisiko tinggi
                // diturunkan menjadi perlu perhatian agar tidak lewat tanpa dibaca.
                $status = $status === self::STATUS_READY ? self::STATUS_ATTENTION : $status;
                $details[] = 'Terdapat temuan dengan tingkat keparahan '.$severity.'.';
            }
        } else {
            $details[] = 'Belum ada laporan pengujian tersimpan.';
        }

        if ($track === TestingTrack::CYBER) {
            $checkTypeLabel = $project->cyberCheckTypeValue()?->label();

            if ($checkTypeLabel !== null) {
                $details[] = "Jenis pemeriksaan: {$checkTypeLabel}.";
            }
        }

        return $this->pillar(
            key: $track->value,
            label: $track->label(),
            description: $track === TestingTrack::QA
                ? 'Sign-off QA Lead atas laporan pengujian'
                : 'Sign-off Cyber Lead atas hasil audit keamanan',
            status: $status,
            statusLabel: $trackStatus->label(),
            detail: implode(' ', $details),
        );
    }

    /**
     * Pilar 4 — rencana rilis dan prosedur rollback dari pengajuan PM.
     *
     * @return array<string, mixed>
     */
    private function evaluateReleasePlan(Project $project): array
    {
        $release = $this->loadedLatestRelease($project);

        if ($release === null) {
            return $this->pillar(
                key: 'release_plan',
                label: 'Rencana Rilis & Rollback',
                description: 'Target rilis, estimasi downtime, prosedur rollback',
                status: self::STATUS_MISSING,
                statusLabel: 'Belum Ada',
                detail: 'Belum ada pengajuan rilis tersimpan untuk proyek ini.',
            );
        }

        $missingLabels = [];

        if ($release->target_release_date === null) {
            $missingLabels[] = 'target tanggal rilis';
        }

        if (trim((string) $release->downtime_estimate) === '') {
            $missingLabels[] = 'estimasi downtime';
        }

        if (trim((string) $release->rollback_plan) === '') {
            $missingLabels[] = 'prosedur rollback';
        }

        return $this->pillar(
            key: 'release_plan',
            label: 'Rencana Rilis & Rollback',
            description: 'Target rilis, estimasi downtime, prosedur rollback',
            status: $missingLabels === [] ? self::STATUS_READY : self::STATUS_ATTENTION,
            statusLabel: $missingLabels === [] ? 'Siap' : 'Belum Lengkap',
            detail: $missingLabels === []
                ? 'Target rilis '.$release->target_release_date->format('d-m-Y')
                    .', estimasi downtime dan prosedur rollback sudah diisi pengaju.'
                : 'Pengaju belum mengisi: '.implode(', ', $missingLabels).'.',
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function pillar(
        string $key,
        string $label,
        string $description,
        string $status,
        string $statusLabel,
        string $detail,
    ): array {
        return [
            'key' => $key,
            'label' => $label,
            'description' => $description,
            'status' => $status,
            'status_label' => $statusLabel,
            'detail' => $detail,
        ];
    }

    /**
     * Dokumen proyek yang sudah dimuat, tanpa memicu query baru.
     *
     * @return Collection<int, DocumentVault>
     */
    private function loadedDocuments(Project $project): Collection
    {
        if (! $project->relationLoaded('documents')) {
            return collect();
        }

        return $project->documents;
    }

    private function loadedLatestReport(Project $project, TestingTrack $track): ?TestReport
    {
        if (! $project->relationLoaded('testReports')) {
            return null;
        }

        return $project->testReports
            ->where('test_type', $track->value)
            ->sortByDesc('id')
            ->first();
    }

    private function loadedLatestRelease(Project $project): ?ReleaseRequest
    {
        if (! $project->relationLoaded('releaseRequests')) {
            return null;
        }

        return $project->releaseRequests->sortByDesc('id')->first();
    }
}
