<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentVault;
use App\Models\Project;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DocumentController extends Controller
{
    public function __construct(
        protected FileUploadService $uploadService
    ) {}

    /**
     * Format nama dokumen sesuai konvensi Bank Nagari:
     * XXX/GPTD/TIPE/DD-BulanYYYY_NamaProyek
     *   XXX = nomor urut dari req_id (contoh: REQ-2026-001 → 001)
     *   TIPE = kode tipe dokumen (BRD, MEMO, FSD, dll)
     */
    protected function generateDocumentFileName(Project $project, string $docType, ?string $originalName = null, ?string $mimeType = null): string
    {
        // Nomor proyek dari req_id
        $nomor = '001';
        if ($project->req_id && preg_match('/(\d+)$/', $project->req_id, $m)) {
            $nomor = str_pad($m[1], 3, '0', STR_PAD_LEFT);
        }

        // Tanggal
        $now = now();
        $bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];
        $dd = $now->format('d');
        $bl = $bulan[$now->month - 1];
        $th = $now->format('Y');

        // Nama proyek (aman untuk file system)
        $pp = preg_replace('/[^a-zA-Z0-9\s]/', '', $project->title);
        $pp = trim(preg_replace('/\s+/', '_', mb_substr($pp, 0, 30)));

        $prefix = "{$nomor}/GPTD/{$docType}/{$dd}-{$bl}{$th}_{$pp}";

        // Ekstensi dari original filename
        $ext = '';
        if ($originalName) {
            $parts = explode('.', $originalName);
            if (count($parts) > 1) {
                $ext = '.' . strtolower(end($parts));
            }
        }
        // Fallback: ekstensi dari MIME type file jika tidak ada di original name
        if ($ext === '') {
            $ext = match ($mimeType) {
                'application/pdf' => '.pdf',
                'application/vnd.ms-excel' => '.xls',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => '.xlsx',
                'image/jpeg' => '.jpg',
                'image/png' => '.png',
                'application/zip' => '.zip',
                default => '.bin',
            };
        }

        return $prefix . $ext;
    }

    public function index(Request $request): JsonResponse
    {
        $query = DocumentVault::with(['project', 'uploader']);

        if ($request->has('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        $documents = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $documents,
        ]);
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'document_type' => ['required', 'string'],
            'file' => ['required', 'file', 'max:5120', 'mimes:pdf,xls,xlsx,jpg,jpeg,png,zip'],
            'original_filename' => ['nullable', 'string', 'max:255'],
        ], [
            'file.max' => 'Ukuran berkas dokumen melebihi batas maksimal 5 MB.',
            'file.mimes' => 'Format yang diizinkan: PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), ZIP.',
        ]);

        $project = Project::findOrFail($request->project_id);
        $file = $request->file('file');
        $fileInfo = $this->uploadService->upload($file);
        $originalName = $request->original_filename ?? $file->getClientOriginalName();
        $docName = $this->generateDocumentFileName($project, $request->document_type, $originalName, $fileInfo['mime_type']);

        $document = DocumentVault::create([
            'project_id' => $project->id,
            'uploaded_by' => $request->user()->id,
            'document_type' => $request->document_type,
            'original_filename' => $originalName,
            'file_path' => $fileInfo['file_path'],
            'file_name' => $docName,
            'file_size' => $fileInfo['file_size'],
            'mime_type' => $fileInfo['mime_type'],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Dokumen berhasil diunggah.',
            'data' => $document->load('uploader'),
        ], 201);
    }

    public function download(int $id): BinaryFileResponse|JsonResponse
    {
        $document = DocumentVault::findOrFail($id);
        $user = request()->user();

        // Authorization: user must have a relationship to this project
        $project = $document->project;
        $isAuthorized = false;

        if ($user->role) {
            $roleName = $user->role->name;
            // Super Admin, Head of IT, Lead Group (Plan + QA), Dev Lead: full access
            if (in_array($roleName, ['super_admin', 'head_of_it', 'lead_group', 'development_lead'])) {
                $isAuthorized = true;
            }
            // Project creator, PM, or analyst
            elseif (in_array($user->id, [$project->created_by, $project->pm_id, $project->analyst_id])) {
                $isAuthorized = true;
            }
            // Team member of this project
            elseif ($project->teamMembers()->where('user_id', $user->id)->exists()) {
                $isAuthorized = true;
            }
            // QA/Cyber team can access documents for testing
            elseif (in_array($roleName, ['qa_lead', 'qa_tester', 'cyber_lead', 'pentester'])) {
                $isAuthorized = true;
            }
        }

        if (! $isAuthorized) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk mengunduh dokumen ini.',
            ], 403);
        }

        if (! Storage::disk('local')->exists($document->file_path)) {
            return response()->json([
                'status' => 'error',
                'message' => 'File tidak ditemukan di server.',
            ], 404);
        }

        $path = Storage::disk('local')->path($document->file_path);

        // Nama file di DB memakai format "XXX/GPTD/TIPE/DD-BulanYYYY_Nama" yang mengandung "/".
        // Laravel response()->download() menolak filename dengan "/" atau "\".
        // Sanitasi untuk Content-Disposition (tampilan download tetap format lengkap, "/" diganti "-").
        $downloadName = str_replace(['/', '\\'], '-', $document->file_name);

        return response()->download($path, $downloadName);
    }

    public function destroy(int $id): JsonResponse
    {
        $document = DocumentVault::findOrFail($id);
        $user = request()->user();

        // Only the uploader, project creator, PM, or admin can delete
        $project = $document->project;
        $canDelete = in_array($user->role?->name ?? '', ['super_admin', 'head_of_it'])
            || $document->uploaded_by === $user->id
            || $project->created_by === $user->id
            || $project->pm_id === $user->id;

        if (! $canDelete) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk menghapus dokumen ini.',
            ], 403);
        }

        if (Storage::disk('local')->exists($document->file_path)) {
            Storage::disk('local')->delete($document->file_path);
        }

        $document->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Dokumen berhasil dihapus.',
        ]);
    }
}
