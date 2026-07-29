<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileUploadService
{
    /**
     * Upload file dokumen dengan UUID filename.
     */
    public function upload(UploadedFile $file, string $folder = 'documents'): array
    {
        $originalName = $file->getClientOriginalName();
        $extension = $file->getClientOriginalExtension();
        $size = $file->getSize();

        // Unique hash file path
        $filename = Str::uuid()->toString() . '.' . $extension;
        $path = $file->storeAs($folder, $filename, 'local');

        return [
            'file_name' => $originalName,
            'file_path' => $path,
            'file_size' => $size,
        ];
    }
}
