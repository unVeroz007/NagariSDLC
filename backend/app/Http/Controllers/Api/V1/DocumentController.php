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
            'file' => ['required', 'file', 'max:5120', 'mimes:pdf,doc,docx,xls,xlsx,png,jpg'],
        ], [
            'file.max' => 'Ukuran berkas dokumen melebihi batas maksimal 5 MB.',
        ]);

        $project = Project::findOrFail($request->project_id);
        $fileInfo = $this->uploadService->upload($request->file('file'));

        $document = DocumentVault::create([
            'project_id' => $project->id,
            'uploaded_by' => $request->user()->id,
            'document_type' => $request->document_type,
            'file_path' => $fileInfo['file_path'],
            'file_name' => $fileInfo['file_name'],
            'file_size' => $fileInfo['file_size'],
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
