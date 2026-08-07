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
        $fileInfo = $this->uploadService->upload($request->file('file'));

        $document = DocumentVault::create([
            'project_id' => $project->id,
            'uploaded_by' => $request->user()->id,
            'document_type' => $request->document_type,
            'original_filename' => $request->original_filename ?? $fileInfo['file_name'],
            'file_path' => $fileInfo['file_path'],
            'file_name' => $fileInfo['file_name'],
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
            // Super Admin & Head of IT have full access
            if (in_array($roleName, ['super_admin', 'head_of_it'])) {
                $isAuthorized = true;
            }
            // Project creator, PM, or analyst
            elseif (in_array([$project->created_by, $project->pm_id, $project->analyst_id], [$user->id])) {
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

        return response()->download($path, $document->file_name);
    }

    public function destroy(int $id): JsonResponse
    {
        $document = DocumentVault::findOrFail($id);
        $user = request()->user();

        // Only the uploader, project creator, PM, or admin can delete
        $project = $document->project;
        $canDelete = in_array($user->role->name, ['super_admin', 'head_of_it'])
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
