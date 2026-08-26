/**
 * Helper bentuk data profil untuk halaman Profil dan tab Profil pada Pengaturan.
 *
 * Semua nilai diturunkan dari user hasil autentikasi (`UserResource` di backend:
 * name, email, role, role_detail, division, phone_number, created_at). Tidak ada
 * nilai contoh atau nama orang di sini: identitas fiktif yang dipakai sebagai
 * "fallback" membuat pengguna mengira sedang melihat datanya sendiri, dan nomor
 * telepon karangan bisa ikut tersimpan ke database saat profil disimpan.
 *
 * Field yang memang belum terisi dikembalikan sebagai string kosong, lalu
 * lapisan tampilan yang memilih teks penggantinya (misal "Belum diisi").
 */

/**
 * @param {object|null|undefined} user - user aktif dari AuthContext
 * @returns {{name: string, email: string, role: string, roleLabel: string, department: string, phone: string}}
 */
export function buildProfileFromUser(user) {
    return {
        name: user?.name || '',
        email: user?.email || '',
        role: user?.role || '',
        // display_name berasal dari tabel roles, jadi lebih tepat daripada
        // memetakan ulang nama role di sisi frontend.
        roleLabel: user?.role_detail?.display_name || '',
        department: user?.division || '',
        phone: user?.phone_number || '',
    };
}
