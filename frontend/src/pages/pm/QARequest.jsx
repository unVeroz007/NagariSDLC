import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { getProjectRealDocuments } from '../../utils/projectDocuments';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';
import { DOCUMENT_TYPES, formatFileSize } from '../../utils/documentNaming';
import { documentService, qaRequestService } from '../../services/api';
import {
  PROJECT_STATUS,
  PROJECT_STATUS_LABEL,
  canStartQaTrack,
  getQaTrackStatus,
  isTrackActive,
  isTrackPassed,
} from '../../constants/projectStatus';

import { useNavigate } from 'react-router-dom';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import {
  FileText,
  CloudUpload,
  Calendar,
  Link as LinkIcon,
  Send,
  X,
  FolderOpen,
  Search,
  CheckCircle2,
  Copy,
  Eye,
  Building,
  User,
} from 'lucide-react';

/** Batas ukuran unggahan dokumen pendukung, cerminan `DocumentController::upload()`. */
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Bebaskan URL pratinjau berkas yang sudah tidak dipakai.
 *
 * `URL.createObjectURL` menahan berkasnya di memori sampai URL-nya dicabut.
 * Membuang acuannya dari state saja tidak cukup — tanpa pencabutan, setiap berkas
 * yang pernah dipilih tetap tertahan sepanjang tab dibuka, termasuk berkas draf
 * proyek yang sudah diganti dan berkas yang pengajuannya sudah terkirim.
 */
const releaseFilePreviews = (files) => {
  (files || []).forEach((file) => {
    if (file?.url) URL.revokeObjectURL(file.url);
  });
};

export default function QARequest() {
  const { user } = useAuth();
  const { projects, isLoading, refreshData } = useProjects();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const rightPanelRef = useRef(null);

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocPreview, setSelectedDocPreview] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    targetDate: '',
    stagingUrl: '',
    testPriority: 'Normal',
    technicalNotes: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper scroll ke paling atas
  const scrollPageToTop = () => {
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const mainContainer = rightPanelRef.current?.closest('main') || document.querySelector('main');
    if (mainContainer) {
      mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter proyek yang bisa diajukan ke QA oleh PM.
  // Mendukung 3 skenario alur kerja paralel yang fleksibel:
  // 1. QA Dulu: PM ajukan ke QA dari IN_DEVELOPMENT atau DEV_COMPLETED
  // 2. Serentak (Paralel): PM ajukan ke QA bersamaan dengan Cyber (saat CYBER_IN_PROGRESS)
  // 3. Cyber Dulu: PM ajukan ke QA setelah Cyber selesai (CYBER_PASSED)
  // + RETURN_TO_DEV: PM bisa resubmit ke QA setelah perbaikan defect
  const readyProjects = useMemo(() => {
    let list = projects.filter(p => {
      const qaSt = getQaTrackStatus(p);
      const st = String(p.status || '').toUpperCase();
      // Jalur QA yang sudah berjalan (termasuk menunggu review Lead) atau sudah
      // lulus tidak boleh diajukan ulang supaya tidak ada pengajuan ganda.
      const isAlreadySubmittedQA = isTrackActive(qaSt) || isTrackPassed(qaSt)
        || st === PROJECT_STATUS.READY_FOR_QA
        || st === PROJECT_STATUS.QA_IN_PROGRESS
        || st === PROJECT_STATUS.QA_PASSED;
      return canStartQaTrack(st) && !isAlreadySubmittedQA;
    });

    // Hanya Super Admin yang melihat seluruh proyek. Peran lain — termasuk
    // `lead_group`, `head_of_it`, dan `development_lead` yang sebelumnya diistimewakan
    // di sini — akan ditolak `TestingTrackService::submitRequest()` karena pengajuan
    // jalur pengujian hanya boleh dilakukan Analis Pengembangan pemegang disposisi.
    const isPrivileged = user?.role === 'super_admin';
    if (!isPrivileged && user?.id) {
      const pmId = user.id;
      list = list.filter(p => {
        const pmObjId = typeof p.pm === 'object' ? p.pm?.id : null;
        return pmObjId && pmObjId === pmId;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      // Nomor pengajuan ikut dicari karena itulah yang tampil pada kartu. Sebelumnya
      // hanya id numerik database yang dicocokkan, sehingga mengetikkan nomor yang
      // terlihat di layar tidak menemukan apa pun.
      return list.filter(p =>
        String(p.reqId || p.req_id || '').toLowerCase().includes(term) ||
        String(p.id).toLowerCase().includes(term) ||
        String(p.name).toLowerCase().includes(term) ||
        String(p.division).toLowerCase().includes(term)
      );
    }

    return list;
  }, [projects, user, searchTerm]);



  /**
   * Isi awal form untuk satu proyek.
   *
   * Alamat lingkungan uji hanya diambil dari data proyek. Sebelumnya `VITE_STAGING_URL`
   * dipakai sebagai cadangan, sehingga alamat bawaan lingkungan ikut terkirim seolah-olah
   * itu alamat proyek yang diajukan.
   */
  const buildFormStateFor = (project) => ({
    targetDate: project?.targetDate || '',
    stagingUrl: project?.stagingUrl || project?.staging_url || '',
    testPriority: 'Normal',
    technicalNotes: '',
  });

  /**
   * Proyek yang sedang dibuka.
   *
   * State hanya menyimpan id; objeknya dicari ulang dari daftar terbaru supaya isi
   * panel ikut diperbarui saat data proyek berubah (polling). Bila belum ada pilihan
   * — atau pilihan lama sudah keluar dari daftar karena pengajuannya selesai —
   * proyek pertama pada daftar yang dipakai.
   */
  const selectedProject = useMemo(() => {
    const picked = selectedProjectId
      ? readyProjects.find(p => String(p.id) === String(selectedProjectId))
      : null;
    return picked || readyProjects[0] || null;
  }, [readyProjects, selectedProjectId]);

  // Isian formulir adalah draf milik satu proyek: saat proyeknya berganti, draf
  // disusun ulang pada render yang sama (pola "sesuaikan state saat prop berubah"),
  // bukan lewat effect yang menyisakan satu render berisi isian proyek sebelumnya.
  const [formProjectId, setFormProjectId] = useState(null);
  if ((selectedProject?.id ?? null) !== formProjectId) {
    setFormProjectId(selectedProject?.id ?? null);
    setFormData(buildFormStateFor(selectedProject));
    // Berkas draf milik proyek sebelumnya dibuang bersama drafnya, jadi URL
    // pratinjaunya dicabut di sini juga.
    releaseFilePreviews(uploadedFiles);
    setUploadedFiles([]);
  }

  // Pembersihan saat komponen dilepas. Effect-nya hanya berjalan sekali, jadi daftar
  // berkas dibaca lewat ref — bukan dari closure yang sudah usang.
  const uploadedFilesRef = useRef([]);
  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);
  useEffect(() => () => releaseFilePreviews(uploadedFilesRef.current), []);

  const handleSelectProject = (project) => {
    setSelectedProjectId(project.id);
  };

  // Auto scroll ke atas saat proyek terpilih berubah. Yang dipantau id-nya, bukan
  // objek proyeknya: objek dibuat ulang setiap polling.
  const selectedProjectIdForScroll = selectedProject?.id ?? null;
  useEffect(() => {
    if (selectedProjectIdForScroll) {
      scrollPageToTop();
    }
  }, [selectedProjectIdForScroll]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const oversizedFiles = files.filter(f => f.size > MAX_UPLOAD_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => `"${f.name}"`).join(', ');
      toast.error(`Dokumen ${fileNames} ditolak karena ukurannya melebihi batas maksimal 5MB!`);
    }
    const validFiles = files.filter(f => f.size <= MAX_UPLOAD_SIZE_BYTES);
    if (validFiles.length === 0) {
      if (e.target) e.target.value = '';
      return;
    }
    // Nama dokumen final dibuat backend, jadi di sini cukup menahan berkas aslinya
    // beserta URL objek untuk pratinjau.
    const newFiles = validFiles.map((file) => ({
      name: file.name,
      originalName: file.name,
      size: formatFileSize(file.size),
      type: 'QA_REPORT',
      rawFile: file,
      url: URL.createObjectURL(file),
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (e.target) e.target.value = '';
    toast.success(`${newFiles.length} file dokumen pengujian siap diunggah!`);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => {
      const removed = prev[index];
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== index);
    });
    toast.success('File berhasil dihapus.');
  };

  /**
   * Kirim pengajuan ke jalur Pengujian QA.
   *
   * Pengajuan memakai endpoint jalur (`POST /qa-requests/submit`), bukan pembaruan proyek.
   * Endpoint itu yang menyetel `qa_status`, menaikkan status utama bila transisinya sah,
   * dan menuliskan jejak audit pengajuan — sehingga aturannya tinggal satu di backend.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) {
      toast.error('Pilih proyek yang akan diajukan terlebih dahulu!');
      return;
    }
    if (!formData.targetDate) {
      toast.error('Tentukan target tanggal selesai QA!');
      return;
    }

    setIsSubmitting(true);
    try {
      // Unggah dokumen pendukung ke document vault supaya benar-benar tersimpan
      // dan namanya dibuat backend. Payload `documents` pada endpoint update proyek
      // tidak pernah dibaca backend, jadi tidak dipakai lagi.
      const filesToUpload = uploadedFiles.filter(f => f.rawFile);
      const failedUploads = [];
      const succeededUploads = [];
      for (const uploadedFile of filesToUpload) {
        try {
          await documentService.upload(uploadedFile.rawFile, {
            project_id: selectedProject.id,
            document_type: DOCUMENT_TYPES.QA_REPORT.code,
            original_filename: uploadedFile.originalName || uploadedFile.rawFile.name,
          });
          succeededUploads.push(uploadedFile.originalName || uploadedFile.name);
        } catch (uploadErr) {
          failedUploads.push(uploadedFile.originalName || uploadedFile.name);
          toast.error(`Gagal mengunggah "${uploadedFile.originalName || uploadedFile.name}": ${uploadErr.message}`);
        }
      }

      if (filesToUpload.length > 0 && failedUploads.length === filesToUpload.length) {
        throw new Error('Seluruh dokumen pendukung gagal diunggah. Pengajuan QA dibatalkan.');
      }

      // Prioritas & catatan teknis belum memiliki kolom sendiri, jadi dirangkum sebagai
      // catatan pengajuan yang tersimpan pada jejak audit perubahan jalur pengujian.
      const submissionNote = [
        `Pengajuan Pengujian QA oleh ${user?.name || 'Analis Pengembangan'}.`,
        `Prioritas pengujian: ${formData.testPriority}.`,
        formData.technicalNotes ? `Catatan teknis: ${formData.technicalNotes}` : null,
      ].filter(Boolean).join(' ');

      try {
        await qaRequestService.submitRequest({
          project_id: selectedProject.id,
          staging_url: formData.stagingUrl.trim() || null,
          target_completion_date: formData.targetDate,
          notes: submissionNote,
        });
      } catch (submitErr) {
        // Dokumen yang sudah lolos unggah tetap tersimpan di Document Vault meski
        // pengajuannya ditolak. Tanpa keterangan ini pengaju akan mengunggah ulang
        // berkas yang sama dan meninggalkan duplikat di vault.
        if (succeededUploads.length > 0) {
          throw new Error(
            `${submitErr.message} Catatan: ${succeededUploads.length} dokumen sudah tersimpan di `
            + 'Manajemen Dokumen — tidak perlu diunggah ulang saat mencoba kembali.',
            { cause: submitErr }
          );
        }
        throw submitErr;
      }

      addNotification(
        'Pengajuan QA Berhasil',
        `Proyek ${selectedProject.name} telah resmi diajukan ke antrean Quality Assurance (QA).`,
        'success',
        '/workspace/qa'
      );

      // Kegagalan unggah sebagian tidak boleh berakhir sebagai pesan sukses tunggal.
      // Pengajuannya memang terkirim, tetapi QA Tester akan bekerja tanpa sebagian
      // dokumen yang pengaju yakin sudah terlampir.
      if (failedUploads.length > 0) {
        toast.error(
          `Pengajuan QA untuk ${selectedProject.name} terkirim, tetapi ${failedUploads.length} dari `
          + `${filesToUpload.length} dokumen gagal diunggah. Unggah ulang lewat Manajemen Dokumen.`,
          { duration: 8000 }
        );
      } else {
        toast.success(`Pengajuan QA untuk proyek ${selectedProject.name} berhasil dikirim!`);
      }

      // Halaman ini segera ditinggalkan, jadi URL pratinjaunya dicabut lebih dahulu.
      releaseFilePreviews(uploadedFiles);
      setUploadedFiles([]);

      refreshData();
      navigate('/workspace/qa');
    } catch (err) {
      toast.error(err.message || 'Gagal mengajukan proyek ke QA.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Salin alamat lingkungan uji ke papan klip.
   *
   * Kolomnya boleh kosong (proyek tanpa lingkungan uji), jadi salinan kosong ditolak
   * lebih dahulu — sebelumnya tombolnya melaporkan "berhasil disalin" atas string
   * kosong. Clipboard API juga tidak tersedia pada konteks non-HTTPS dan dapat
   * ditolak izinnya, sehingga kegagalannya perlu ditangani, bukan dilepas sebagai
   * promise tanpa penangkap.
   */
  const handleCopyStagingUrl = async (url) => {
    const value = String(url || '').trim();
    if (!value) {
      toast.error('Alamat lingkungan uji masih kosong.');
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Peramban tidak mengizinkan akses papan klip pada halaman ini.');
      }
      await navigator.clipboard.writeText(value);
      toast.success('Staging URL berhasil disalin ke clipboard!');
    } catch (err) {
      toast.error(`Gagal menyalin alamat: ${err.message}`);
    }
  };

  // Dokumen prasyarat per fase/aktivitas: BRD, MEMO, FSD, Berita Acara SIT/UAT, dsb.
  // Lampiran bukti per task/skenario SIT & UAT sengaja tidak ikut (dikecualikan di
  // getProjectRealDocuments) karena QA memverifikasi dokumen fase, bukan bukti per task.
  const projectDocsList = useMemo(() => {
    return getProjectRealDocuments(selectedProject);
  }, [selectedProject]);


  if (isLoading) {
    return <LoadingSpinner text="Memuat Laman Pengajuan QA..." />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
      {/* Header Laman */}
      <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-gray-800">Form Pengajuan Quality Assurance (QA)</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 size={14} /> SDLC Phase 3 QA Submission
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Pilih proyek yang telah selesai koding, lengkapi URL staging test, dan ajukan ke tim QA Lead.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LIST PANEL: Daftar Proyek Siap QA (Panel Kiri) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
          <div className="shrink-0 pb-3 border-b border-gray-100 space-y-3 mb-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <FolderOpen size={16} className="text-blue-600" />
                Pilih Proyek ({readyProjects.length})
              </h3>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari ID / Nama Proyek..."
                className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
            </div>
          </div>

          {/* List Cards */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {readyProjects.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs border-2 border-dashed border-gray-100 rounded-xl">
                Tidak ada proyek yang sesuai dengan kriteria pencarian.
              </div>
            ) : (
              readyProjects.map(project => (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedProject?.id === project.id
                      ? 'border-2 border-[#1a365d] bg-blue-50/40 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {project.req_id || project.reqId || project.id}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={project.type} /><ProjectTypeBadge type={project.project_type} /></div>
                  </div>
                  <h4 className="font-bold text-gray-800 text-xs line-clamp-1 mb-1.5">{project.name}</h4>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                    <span>{project.division}</span>
                    {/* Label status, bukan kode enum mentah seperti sebelumnya. */}
                    <span className="font-bold text-gray-700 text-right">{PROJECT_STATUS_LABEL[project.status] || project.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* FORM PANEL: Form Pengajuan & Detail Proyek (Panel Kanan) */}
        <div ref={rightPanelRef} className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-210px)] scroll-smooth">
          {!selectedProject ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-20">
              <FolderOpen size={48} className="mb-3 text-gray-300" />
              <p className="font-bold text-gray-600">Pilih Proyek di Panel Kiri</p>
              <p className="text-xs text-gray-400 mt-1">Silakan pilih proyek yang akan diajukan ke tim Quality Assurance.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header Proyek Terpilih */}
              <div className="pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                    {selectedProject.req_id || selectedProject.reqId || selectedProject.id}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={selectedProject.type} deadline={selectedProject.rbbDeadline} /><ProjectTypeBadge type={selectedProject.project_type} /></div>
                </div>
                <h3 className="text-xl font-extrabold text-gray-800">{selectedProject.name}</h3>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                  <Building size={14} className="text-gray-400" />
                  <span>Divisi: <strong className="text-gray-700">{selectedProject.division}</strong></span>
                  <span>•</span>
                  <User size={14} className="text-gray-400" />
                  <span>Analis Pengembangan: <strong className="text-gray-700">{typeof selectedProject.pm === 'object' ? selectedProject.pm?.name : (selectedProject.pm || '-')}</strong></span>
                </p>
              </div>

              {/* Deskripsi Proyek */}
              <div>
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={15} className="text-[#1a365d]" />
                  Lingkup &amp; Deskripsi Proyek
                </h4>
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                  {selectedProject.description || 'Pengembangan modul aplikasi dan integrasi layanan SDLC Bank Nagari.'}
                </div>
              </div>

              {/* URL Staging & Account Credentials */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Alamat Lingkungan Uji (Staging)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      name="stagingUrl"
                      value={formData.stagingUrl}
                      onChange={handleChange}
                      placeholder="https://staging.banknagari.co.id/nama-aplikasi"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyStagingUrl(formData.stagingUrl)}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all cursor-pointer shadow-xs"
                    title="Salin alamat lingkungan uji"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">Kosongkan bila proyek ini tidak memiliki lingkungan uji yang dapat diakses QA Tester.</p>
              </div>

              {/* Target Finish Date & Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                    Target Tanggal Selesai QA <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      name="targetDate"
                      value={formData.targetDate}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                    Tingkat Prioritas Pengujian
                  </label>
                  <select
                    name="testPriority"
                    value={formData.testPriority}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
                  >
                    <option value="Normal">Normal (Sesuai Antrean Reguler)</option>
                    <option value="Tinggi">Tinggi (High Priority - Proyek RBB)</option>
                    <option value="Urgent">Urgent (Mendesak / Mandat Regulasi)</option>
                  </select>
                </div>
              </div>

              {/* Dokumen Prasyarat SDLC (BRD & FSD) */}
              <div>
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={15} className="text-[#1a365d]" />
                  Dokumen SDLC Prasyarat Terlampir ({projectDocsList.length})
                </h4>
                <div className="space-y-2">
                  {projectDocsList.length === 0 ? (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400 italic text-center">
                      Belum ada dokumen prasyarat terlampir pada proyek ini.
                    </div>
                  ) : projectDocsList.map(doc => (
                    <div key={doc.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileText size={16} className="text-blue-600 shrink-0" />
                        <div className="truncate">
                          <span className="font-bold text-gray-800 text-xs truncate block">{doc.name}</span>
                          <span className="text-[10px] text-gray-500">{doc.type} • {doc.size}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDocPreview(doc)}
                        className="px-3 py-1 bg-[#1a365d] text-white rounded-lg text-xs font-bold hover:bg-[#0f2342] transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Eye size={12} />
                        Pratinjau
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upload Dokumen Skenario Tambahan */}
              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  Unggah Dokumen Tambahan (Skenario QA / Test Plan / Postman Collection)
                </label>
                <div className="border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50/50 rounded-2xl p-5 text-center transition-all">
                  <CloudUpload size={32} className="text-blue-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-700">Klik untuk memilih berkas pendukung</p>
                  <p className="text-[10px] text-gray-400 mt-1">PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), ZIP — maks. 5 MB per berkas</p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="qa-file-input"
                  />
                  <label
                    htmlFor="qa-file-input"
                    className="mt-3 inline-block px-4 py-2 bg-white border border-gray-300 hover:border-blue-600 text-gray-700 font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                  >
                    Pilih File dari Komputer
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] text-gray-400">Nama dokumen final dibuat sistem saat pengajuan dikirim.</p>
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText size={15} className="text-blue-600 shrink-0" />
                          <span className="font-semibold text-gray-800 truncate">{file.name}</span>
                          <span className="text-[10px] text-gray-500">({file.size})</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedDocPreview(file)}
                            className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Eye size={12} /> Pratinjau
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg cursor-pointer transition-all"
                            title="Hapus file"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Technical Notes & Instructions */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Catatan Teknis &amp; Instruksi Pengujian QA
                </label>

                <textarea
                  name="technicalNotes"
                  rows={4}
                  value={formData.technicalNotes}
                  onChange={handleChange}
                  placeholder="Tuliskan catatan teknis, instruksi khusus, atau informasi akun pengujian untuk QA Tester..."
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] transition-all"
                />
              </div>

              {/* Submit Action Button */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send size={16} />
                  <span>{isSubmitting ? 'Mengirim pengajuan...' : 'Kirim Pengajuan Quality Assurance (QA)'}</span>
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-2">
                  Pengajuan masuk ke Workspace Lead QA. Status jalur naik ke pelaksanaan setelah Lead mendisposisikan QA Tester.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* MODAL PRATINJAU DOKUMEN SDLC RESMI */}
      {selectedDocPreview && (
        <DocumentViewerModal
          doc={selectedDocPreview}
          project={selectedProject}
          onClose={() => setSelectedDocPreview(null)}
        />
      )}

    </div>
  );
}