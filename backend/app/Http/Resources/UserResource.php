<?php

namespace App\Http\Resources;

use App\Services\ProjectAccessService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $exposeContact = $this->exposeContactDetails($request);

        return [
            'id'               => $this->id,
            'name'             => $this->name,
            'email'            => $this->email,
            'role'             => $this->role?->name,
            'role_detail'      => $this->role ? [
                'id'           => $this->role->id,
                'name'         => $this->role->name,
                'display_name' => $this->role->display_name,

                // Daftar path menu yang boleh dilihat role ini, atau `null` bila tanpa
                // pembatasan. Dipakai `MainLayout` untuk menyaring sidebar akun yang
                // sedang login. Ikut disertakan pada pengguna lain karena isinya bukan
                // data rahasia — hanya susunan menu — dan menyalin bentuknya ke resource
                // terpisah hanya menambah satu tempat lagi yang bisa menyimpang.
                //
                // Tidak ada query tambahan: relasi `role` sudah dibaca pada baris di atas.
                'menu_access'  => $this->role->menuAccessPaths(),
            ] : null,
            'division'         => $this->division?->name,
            'division_detail'  => $this->division ? [
                'id'   => $this->division->id,
                'code' => $this->division->code,
                'name' => $this->division->name,
            ] : null,
            // Nomor telepon hanya diberikan kepada pemilik akunnya sendiri dan kepada
            // role pengawas. Resource ini disematkan pada hampir setiap balasan proyek
            // (pemohon, PM, analis, pelaksana uji, penandatangan riwayat status), jadi
            // sebelumnya satu permintaan `GET /projects/{id}` atau `GET /users` sudah
            // cukup untuk mengumpulkan nomor telepon seluruh pegawai. Nomor itu juga
            // dipakai sebagai faktor verifikasi approval UAT non-IT, sehingga
            // penyebarannya memperlemah pemeriksaan tersebut.
            //
            // Satu-satunya layar yang menampilkannya adalah Manajemen Pengguna milik
            // Super Admin; pemilih anggota tim, assignee, dan peserta UAT hanya memakai
            // id, nama, role, dan divisi.
            'phone_number'     => $exposeContact ? $this->phone_number : null,
            'is_active'        => $this->is_active,
            'created_at'       => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Apakah peminta berhak melihat data kontak akun ini?
     *
     * Daftar role pengawas diambil dari `ProjectAccessService` agar tidak ada salinan
     * kedua yang bisa menyimpang. `development_lead` sengaja tidak termasuk: ia
     * mengalokasikan tim, dan alokasi tim tidak membutuhkan nomor telepon.
     */
    private function exposeContactDetails(Request $request): bool
    {
        $viewer = $request->user();

        if (! $viewer) {
            return false;
        }

        if ((int) $viewer->id === (int) $this->id) {
            return true;
        }

        $viewer->loadMissing('role');

        return in_array($viewer->role?->name, ProjectAccessService::OVERSIGHT_ROLES, true);
    }
}
