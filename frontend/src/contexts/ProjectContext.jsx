import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { projectService, documentService, sessionStore } from '../services/api';
import { useAuth } from './AuthContext';
import { useVisibilityPolling } from '../hooks/usePolling';
import { POLLING_INTERVAL_MS } from '../constants/polling';
import { generateDocumentName } from '../utils/documentNaming';
import { TRACK_STATUS } from '../constants/projectStatus';
import { DEFAULT_PROJECT_PRIORITY } from '../constants/projectPriority';
import { getCyberCheckTypeLabel, normalizeCyberCheckType } from '../constants/cyberCheckType';
import toast from 'react-hot-toast';

const ProjectContext = createContext();

/**
 * Satu bentuk proyek yang dipakai seluruh komponen.
 *
 * API memaparkan snake_case; komponen memakai camelCase. Menempatkan penerjemahannya di
 * satu fungsi mencegah tiap layar menebak sendiri nama kuncinya — persis yang membuat
 * layar Lead sebelumnya membaca `qaAssignee` yang tidak pernah ada isinya.
 */
const normalizeProject = (project) => ({
    ...project,
    name: project.name || project.title || 'Tanpa Judul',
    reqId: project.reqId || project.req_id || null,
    targetDate: project.targetDate || project.target_date || 'TBD',
    // Tenggat RBB dibaca 17 tempat sebagai `rbbDeadline`. Tidak diberi nilai bawaan
    // 'TBD' seperti `targetDate`: dasbor menyaring dengan `p.rbbDeadline &&` lalu
    // membangun `new Date(...)` darinya, jadi teks sentinel akan lolos filter dan
    // menghasilkan `Invalid Date` yang tampil sebagai tenggat sungguhan.
    rbbDeadline: project.rbbDeadline || project.rbb_deadline || null,
    submittedAt: project.submittedAt || project.created_at || new Date().toISOString(),
    division: typeof project.division === 'string'
        ? project.division
        : (project.division?.name || project.division_detail?.name || null),
    contactPhone: project.contactPhone || project.contact_phone || '',
    // Normalisasi key snake_case → camelCase (ProjectResource mengekspos sit_uat_data)
    sitUatData: project.sitUatData || project.sit_uat_data || {},

    // ─── Dua jalur pengujian paralel ───
    // Status jalur adalah kebenaran masing-masing jalur; `status` proyek hanyalah satu
    // penunjuk siklus yang dipegang bergiliran, jadi layar jalur tidak boleh
    // menyimpulkan keadaan jalurnya dari `status`.
    qaStatus: project.qaStatus || project.qa_status || TRACK_STATUS.NOT_SUBMITTED,
    cyberStatus: project.cyberStatus || project.cyber_status || TRACK_STATUS.NOT_SUBMITTED,

    qaAssignee: project.qaAssignee ?? project.qa_assignee ?? null,
    qaAssigneeId: project.qaAssigneeId ?? project.qa_assignee_id ?? null,
    cyberAssignee: project.cyberAssignee ?? project.cyber_assignee ?? null,
    cyberAssigneeId: project.cyberAssigneeId ?? project.cyber_assignee_id ?? null,

    // Laporan pengujian terakhir per jalur, sudah termasuk keputusan Lead bila ada.
    qaReport: project.qaReport ?? project.qa_report ?? null,
    cyberReport: project.cyberReport ?? project.cyber_report ?? null,

    // Jenis pemeriksaan Audit Keamanan Siber pilihan PM beserta masukannya.
    cyberCheckType: normalizeCyberCheckType(project.cyberCheckType ?? project.cyber_check_type),
    cyberCheckTypeLabel: project.cyberCheckTypeLabel
        ?? project.cyber_check_type_label
        ?? getCyberCheckTypeLabel(project.cyberCheckType ?? project.cyber_check_type),
    cyberTargetUrl: project.cyberTargetUrl ?? project.cyber_target_url ?? null,
    cyberSourceCodeRef: project.cyberSourceCodeRef ?? project.cyber_source_code_ref ?? null,

    // ─── Fase 4: pengajuan rilis & penilaian kelayakan go-live ───
    // Keduanya berasal dari backend: `release_request` adalah pengajuan terakhir
    // (target rilis, estimasi downtime, prosedur rollback, keputusan Head of IT),
    // dan `release_readiness` adalah penilaian empat pilar yang dihitung dari
    // dokumen, laporan pengujian, serta kelengkapan rencana rilis yang tersimpan.
    // Bernilai null berarti belum tersedia — layar tidak boleh menggantinya dengan
    // nilai bawaan yang tampak seperti fakta.
    releaseRequest: project.releaseRequest ?? project.release_request ?? null,
    releaseReadiness: project.releaseReadiness ?? project.release_readiness ?? null,
});

export function ProjectProvider({ children }) {
    const { isLoggedIn } = useAuth();
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [meta, setMeta] = useState(null);

    // Penanda apakah daftar proyek sudah pernah dimuat pada sesi ini. Dipakai
    // untuk membedakan muat pertama (perlu spinner) dari tik polling (senyap).
    const hasLoadedOnceRef = useRef(false);

    const loadProjects = useCallback(async (showSpinner = false, silent = false) => {
        if (!isLoggedIn) return;
        if (showSpinner) setIsLoading(true);
        try {
            // Peramban ini belum pernah masuk — tidak ada gunanya menembak API
            // hanya untuk dijawab 401 (dan memicu pembersihan sesi).
            if (!sessionStore.read()) return;

            const res = await projectService.getAll();
            if (res && res.data) {
                setProjects(res.data.map(normalizeProject));
                setMeta(res.meta || null);
            }
            setLastUpdated(new Date());
        } catch (err) {
            // Mode silent (polling latar belakang): jangan spam toast error.
            if (!silent && err.status !== 401) {
                toast.error(`Gagal memuat proyek: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        // Setelah logout, muat berikutnya dianggap muat pertama lagi (pakai spinner).
        if (!isLoggedIn) hasLoadedOnceRef.current = false;
    }, [isLoggedIn]);

    // ─── AUTO-SYNC DATA PROYEK (Opsi A) ─────────────────────────────
    // Polling periodik + refresh saat tab aktif kembali agar perubahan
    // status/tahapan dari user lain otomatis sinkron tanpa refresh manual.
    // Selang waktunya dipusatkan di `constants/polling.js`, dan gerbang
    // visibilitas tab ditangani `useVisibilityPolling` sehingga tab yang
    // ditinggalkan tidak terus memukul API.

    // Silent refresh: tanpa spinner & tanpa toast error (fallback manual tetap ada).
    const refreshDataSilent = useCallback(() => {
        loadProjects(false, true);
    }, [loadProjects]);

    // Muat pertama memakai spinner dan melaporkan error; tik berikutnya senyap.
    // Keduanya lewat satu jalur supaya tidak ada dua permintaan bersamaan saat
    // aplikasi dibuka — sebelumnya efek muat awal dan tik polling pertama
    // berjalan berdampingan.
    const syncProjects = useCallback(() => {
        const isFirstLoad = !hasLoadedOnceRef.current;
        hasLoadedOnceRef.current = true;
        return loadProjects(isFirstLoad, !isFirstLoad);
    }, [loadProjects]);

    useVisibilityPolling(syncProjects, POLLING_INTERVAL_MS.projects, {
        enabled: isLoggedIn,
        immediate: true,
        refreshOnReturn: true,
        resetKey: isLoggedIn,
    });

    /**
     * Kirim pengajuan proyek, lalu unggah dokumen pendukungnya.
     *
     * Nilai kembaliannya adalah respons API pembuatan proyek, ditambah ringkasan
     * hasil unggahan pada `documentUpload` supaya pemanggil dapat menampilkan
     * keadaan sebenarnya. Sebelumnya method ini selalu berakhir dengan
     * `toast.success('Proyek berhasil diinisiasi!')` meskipun setiap unggahan gagal,
     * dan bila respons API tidak memuat `data` ia selesai tanpa nilai maupun
     * pengecualian — form pengaju menampilkan modal sukses atas proyek yang tidak
     * pernah ia terima nomornya.
     */
    const addProject = async (projectData) => {
        try {
            const res = await projectService.create({
                title: projectData.name || projectData.title,
                description: projectData.description || '',
                contact_phone: projectData.contact_phone || projectData.contactPhone || null,
                division: projectData.division,
                division_id: projectData.division_id,
                target_date: projectData.targetDate || null,
                // Tenggat RBB berdiri sendiri dari `target_date` — yang pertama komitmen
                // Rencana Bisnis Bank, yang kedua estimasi selesai pengerjaan. Tanpa
                // baris ini, tanggal yang diisi pengaju berhenti di browser dan panel
                // "Proyek RBB mendekati deadline" pada dasbor tetap kosong selamanya.
                rbb_deadline: projectData.rbb_deadline ?? projectData.rbbDeadline ?? null,
                type: projectData.type || 'RBB',
                project_type: projectData.project_type || 'baru',
                // Prioritas pilihan pengaju. Sebelumnya tidak diteruskan sama sekali, jadi
                // pilihan pada form inisiasi hilang di sini — bahkan sebelum permintaan
                // meninggalkan browser.
                priority: projectData.priority || DEFAULT_PROJECT_PRIORITY,
            });

            const project = res?.data;

            if (!project?.id) {
                // Tanpa id proyek tidak ada yang dapat dilanjutkan: dokumen tidak punya
                // tujuan unggah, dan layar pengaju tidak punya proyek untuk ditelusuri.
                throw new Error('Server tidak mengembalikan data proyek yang baru dibuat.');
            }

            // Re-upload documents with correct req_id-based filenames
            const pendingDocuments = Array.isArray(projectData.documents)
                ? projectData.documents.filter((doc) => doc.rawFile)
                : [];
            const failedDocuments = [];

            for (const doc of pendingDocuments) {
                try {
                    // Regenerate final filename with real req_id
                    const finalName = generateDocumentName(project.req_id, doc.doc_type || doc.type || 'BRD', project.title);
                    const ext = doc.rawFile.name.split('.').pop();
                    const finalFile = new File([doc.rawFile], `${finalName}.${ext}`, { type: doc.rawFile.type });
                    const uploadRes = await documentService.upload(finalFile, {
                        project_id: project.id,
                        document_type: doc.doc_type || doc.type || 'BRD',
                    });
                    // Simpan nama final dari API untuk ditampilkan di success modal
                    if (uploadRes?.data?.file_name) {
                        doc.finalName = uploadRes.data.file_name;
                    }
                } catch (err) {
                    failedDocuments.push(doc.originalName || doc.name || 'dokumen');
                    toast.error(`Gagal upload dokumen "${doc.originalName}": ${err.message}`);
                }
            }

            if (failedDocuments.length === 0) {
                toast.success('Proyek berhasil diinisiasi!');
            } else if (failedDocuments.length === pendingDocuments.length) {
                // Proyeknya tetap tercatat, jadi ini bukan kegagalan pengajuan — tetapi
                // juga bukan keberhasilan yang boleh dilaporkan sebagai sukses penuh.
                toast.error(
                    `Proyek "${project.req_id}" tercatat, tetapi seluruh ${failedDocuments.length} dokumen gagal diunggah. `
                    + 'Unggah ulang lewat Manajemen Dokumen.'
                );
            } else {
                toast.error(
                    `Proyek "${project.req_id}" tercatat dengan ${failedDocuments.length} dari ${pendingDocuments.length} `
                    + 'dokumen gagal diunggah. Unggah ulang lewat Manajemen Dokumen.'
                );
            }

            loadProjects(false);

            return {
                ...res,
                documentUpload: {
                    total: pendingDocuments.length,
                    failed: failedDocuments,
                },
            };
        } catch (err) {
            toast.error(`Gagal membuat proyek: ${err.message}`);
            throw err;
        }
    };

    const updateProject = async (id, updates) => {
        try {
            await projectService.update(id, updates);
            toast.success('Data proyek berhasil diperbarui!');
            loadProjects(false);
        } catch (err) {
            toast.error(`Gagal memperbarui proyek: ${err.message}`);
            throw err;
        }
    };

    const updateProjectStatus = async (id, newStatus, notes = '') => {
        try {
            await projectService.updateStatus(id, newStatus, notes);
            toast.success(`Status proyek diubah menjadi ${newStatus}`);
            loadProjects(false);
        } catch (err) {
            toast.error(`Gagal mengubah status: ${err.message}`);
            throw err;
        }
    };

    const deleteProject = async (id) => {
        try {
            await projectService.delete(id);
            toast.success('Proyek berhasil dihapus!');
            loadProjects(false);
        } catch (err) {
            toast.error(`Gagal menghapus proyek: ${err.message}`);
            throw err;
        }
    };

    const getProjectById = (id) => projects.find(p => String(p.id) === String(id) || p.req_id === id);

    const getProjectsByStatus = (status) => projects.filter(p => p.status === status);

    const refreshData = () => loadProjects(true);
    return (
        <ProjectContext.Provider
            value={{
                projects,
                isLoading,
                lastUpdated,
                meta,
                addProject,
                updateProject,
                updateProjectStatus,
                deleteProject,
                getProjectById,
                getProjectsByStatus,
                refreshData,
                refreshDataSilent,
            }}
        >
            {children}
        </ProjectContext.Provider>
    );
}

export function useProjects() {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProjects must be used within a ProjectProvider');
    }
    return context;
}
