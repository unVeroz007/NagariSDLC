<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi pengiriman pesan chat proyek.
 *
 * Tipe pesan sengaja tidak lagi diterima dari klien. Sebelumnya `type` boleh
 * bernilai `system`, sehingga pengguna biasa dapat menyisipkan pesan yang tampil
 * seperti pengumuman resmi sistem di ruang diskusi proyek — misalnya "Sistem SDLC:
 * proyek telah lulus QA". Pesan bertipe `system` hanya boleh lahir dari kode
 * server, jadi endpoint ini selalu menyimpan `text`.
 */
class StoreChatMessageRequest extends FormRequest
{
    /**
     * Otorisasi akses proyek dilakukan controller lewat pemeriksaan keanggotaan,
     * karena membutuhkan model proyek yang sudah dimuat.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'message.required' => 'Isi pesan wajib diisi.',
            'message.max' => 'Isi pesan maksimal 2000 karakter.',
        ];
    }
}
