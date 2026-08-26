/**
 * Penanda asal task perbaikan: putaran pengembalian jalur QA / Keamanan Siber.
 *
 * Satu-satunya tempat label lencana "task perbaikan" dibentuk. Tiga daftar task
 * membacanya — Manajemen Task, Tugas Developer Saya, dan tabel task PM Workspace —
 * dan lencana yang menandai hal yang sama tidak boleh berbeda bunyinya di tiga
 * layar.
 *
 * Penanda ini BUKAN `revision_note`. `revision_note` adalah siklus Change Request
 * UAT di Fase 2, diminta PM atau penguji internal. `return_round_id` adalah
 * pengembalian jalur pengujian Fase 3 oleh Lead QA atau Lead Keamanan Siber, dan
 * konsekuensinya berbeda: selama satu task perbaikan belum selesai, jalur yang
 * mengembalikannya tidak dapat diajukan ulang. Karena itu keduanya sengaja tampil
 * dengan bobot dan warna yang berbeda, bukan sebagai satu penanda "revisi".
 *
 * @see backend/app/Models/ProjectReturnRound.php  roundLabel() — sebutan resminya.
 * @see frontend/src/pages/pm/ReturnRounds.jsx     Pemilik alur putaran pengembalian.
 */

/** Nilai jalur pengujian. Cermin `App\Enums\TestingTrack`. */
const RETURN_TRACK_QA = 'qa';
const RETURN_TRACK_CYBER = 'cyber';

/**
 * Sebutan ringkas jalur untuk lencana di dalam baris tabel.
 *
 * Sengaja lebih pendek daripada `TestingTrack::label()` ("Pengujian QA" / "Audit
 * Keamanan Siber") yang dipakai sebagai judul putaran di halaman Putaran
 * Pengembalian: di dalam satu sel tabel, sebutan panjang itu mendorong nama task
 * sampai terpotong. Sebutan lengkap milik server tetap dibawa pada tooltip,
 * sehingga tidak ada keterangan yang hilang.
 */
const SHORT_TRACK_LABEL = {
    [RETURN_TRACK_QA]: 'QA',
    [RETURN_TRACK_CYBER]: 'Keamanan Siber',
};

/**
 * Daftar putaran pengembalian satu proyek.
 *
 * `ProjectResource` selalu mengirim `return_rounds` sebagai array — kosong bila
 * relasinya belum dimuat — jadi pemanggil tidak perlu membedakan "belum dimuat"
 * dari "tidak pernah dikembalikan".
 */
export const readReturnRounds = (project) =>
    (Array.isArray(project?.return_rounds) ? project.return_rounds : []);

/** Id putaran pada satu task, apa pun bentuk key-nya (mentah dari API atau hasil normalisasi layar). */
const readTaskRoundId = (task) => task?.returnRoundId ?? task?.return_round_id ?? null;

/** Task ini lahir dari putaran pengembalian? Dipakai filter "hanya task perbaikan". */
export const isFixTask = (task) => readTaskRoundId(task) != null;

/**
 * Lencana penanda task perbaikan, atau null bila task ini pekerjaan biasa.
 *
 * Labelnya dibentuk dari data yang benar-benar tersedia, dengan urutan pembacaan:
 *
 * 1. Entri putaran pada `project.return_rounds`. Inilah sumber terkaya — ia
 *    membawa `round_label` dan `track_label` langsung dari server.
 * 2. Kolom `return_round_track` / `return_round_number` pada task itu sendiri.
 *    Keduanya hanya terisi ketika relasi `returnRound` dimuat, dan endpoint daftar
 *    task (`GET /projects/{id}/tasks`) TIDAK memuatnya — karena itu langkah 1 yang
 *    dipakai lebih dulu, bukan sebaliknya.
 * 3. Bila keduanya tidak menjawab, task tetap ditandai sebagai task perbaikan tanpa
 *    menyebut jalur atau nomor putaran. Menyembunyikan lencananya jauh lebih
 *    menyesatkan daripada lencana tanpa rincian, dan `return_round_id` mentah tidak
 *    ditampilkan karena angka itu tidak berarti apa pun bagi pembacanya.
 */
export const getTaskReturnRoundTag = (task, project) => {
    const roundId = readTaskRoundId(task);
    if (roundId == null) return null;

    const round = readReturnRounds(project)
        .find((item) => String(item?.id) === String(roundId)) || null;

    const track = round?.track ?? task?.returnRoundTrack ?? task?.return_round_track ?? null;
    const roundNumber = round?.round_number ?? task?.returnRoundNumber ?? task?.return_round_number ?? null;
    const trackLabel = SHORT_TRACK_LABEL[track] ?? round?.track_label ?? null;

    if (!trackLabel || roundNumber == null) {
        return {
            label: 'Task Perbaikan',
            title: 'Task ini lahir dari pengembalian jalur pengujian. Rincian putarannya belum termuat di halaman ini — buka halaman Putaran Pengembalian untuk melihat temuan yang mendasarinya.',
        };
    }

    // Sebutan lengkap milik server dipakai apa adanya bila ada, supaya tooltip di
    // sini dan judul putaran di halaman Putaran Pengembalian tidak pernah berbeda.
    const roundLabel = round?.round_label || `${trackLabel} — Pengembalian ke-${roundNumber}`;

    return {
        label: `Perbaikan ${trackLabel} — Pengembalian ke-${roundNumber}`,
        title: `Task perbaikan atas ${roundLabel}. Seluruh task perbaikan pada putaran ini harus selesai dan memiliki penerima sebelum jalurnya dapat diajukan ulang.`,
    };
};
