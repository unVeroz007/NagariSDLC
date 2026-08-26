/**
 * Label dan warna untuk setiap jenis aksi pada log aktivitas.
 *
 * Dipisah dari `contexts/ActivityContext.jsx` supaya berkas konteks hanya mengekspor
 * provider dan hook-nya — komponen penampil log memakai peta ini tanpa ikut memuat
 * provider aktivitas.
 */
export const actionMap = {
    create_user: { label: 'Membuat Pengguna Baru', color: 'bg-blue-100 text-blue-700' },
    update_user: { label: 'Memperbarui Pengguna', color: 'bg-amber-100 text-amber-700' },
    delete_user: { label: 'Menghapus Pengguna', color: 'bg-red-100 text-red-700' },
    create_division: { label: 'Membuat Divisi Baru', color: 'bg-teal-100 text-teal-700' },
    update_division: { label: 'Memperbarui Divisi', color: 'bg-cyan-100 text-cyan-700' },
    delete_division: { label: 'Menghapus Divisi', color: 'bg-rose-100 text-rose-700' },
    create_role: { label: 'Membuat Role Baru', color: 'bg-purple-100 text-purple-700' },
    update_role: { label: 'Memperbarui Role', color: 'bg-indigo-100 text-indigo-700' },
    delete_role: { label: 'Menghapus Role', color: 'bg-red-100 text-red-700' },
    approve_release: { label: 'Menyetujui Rilis', color: 'bg-emerald-100 text-emerald-700' },
    assign_team: { label: 'Alokasi Tim', color: 'bg-blue-100 text-blue-700' },
    upload_document: { label: 'Unggah Dokumen', color: 'bg-purple-100 text-purple-700' },
    auto_quality_gate: { label: 'Quality Gate Otomatis', color: 'bg-indigo-100 text-indigo-700' },
    create_project: { label: 'Inisiasi Proyek Baru', color: 'bg-sky-100 text-sky-700' },
    reject_project: { label: 'Menolak Proyek', color: 'bg-red-100 text-red-700' },
    upload_report: { label: 'Upload Laporan Pentest', color: 'bg-amber-100 text-amber-700' },
};
