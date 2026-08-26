import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { getProjectRealDocuments } from '../../utils/projectDocuments';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';
import { DOCUMENT_TYPES, formatFileSize } from '../../utils/documentNaming';
import { cyberRequestService, documentService } from '../../services/api';
import {
  PROJECT_STATUS,
  PROJECT_STATUS_LABEL,
  canStartCyberTrack,
  getCyberTrackStatus,
  isTrackActive,
  isTrackPassed,
} from '../../constants/projectStatus';
import {
  CYBER_CHECK_TYPE,
  CYBER_CHECK_TYPE_OPTIONS,
  getCyberCheckTypeOption,
  requiresSourceCodeRef,
  requiresTargetUrl,
} from '../../constants/cyberCheckType';

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
  ShieldCheck,
  Building,
  Copy,
  Search,
  Eye,
  ShieldAlert,
  User,
  Code2,
  CheckCircle2,
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

export default function CyberRequest() {
  const { user } = useAuth();
  const { projects, isLoading, refreshData } = useProjects();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const rightPanelRef = useRef(null);

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocPreview, setSelectedDocPreview] = useState(null);

  /**
   * Form State.
   *
   * `checkType` menentukan mana di antara `targetUrl` dan `sourceCodeRef` yang wajib —
   * aturan yang sama ditegakkan backend pada `SubmitCyberAuditRequest`. Keduanya disimpan
   * terpisah agar isian yang sudah ditulis tidak hilang ketika pengaju berganti pilihan
   * lalu kembali lagi.
   */
  const [formData, setFormData] = useState({
    checkType: CYBER_CHECK_TYPE.PENTEST,
    targetUrl: '',
    sourceCodeRef: '',
    targetDate: '',
    stagingUrl: '',
    testPriority: 'Tinggi',
    technicalNotes: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeCheckTypeOption = getCyberCheckTypeOption(formData.checkType);

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

  // Filter proyek yang bisa diajukan ke Cyber oleh PM.
  // Mendukung 3 skenario alur kerja paralel yang fleksibel:
  // 1. Cyber Dulu: PM ajukan ke Cyber dari IN_DEVELOPMENT atau DEV_COMPLETED
  // 2. Serentak (Paralel): PM ajukan ke Cyber bersamaan dengan QA (saat QA_IN_PROGRESS)
  // 3. QA Dulu: PM ajukan ke Cyber setelah QA selesai (QA_PASSED)
  // + RETURN_TO_DEV: PM bisa resubmit ke Cyber setelah perbaikan vulnerability
  const readyProjects = useMemo(() => {
    let list = projects.filter(p => {
      const cyberSt = getCyberTrackStatus(p);
      const st = String(p.status || '').toUpperCase();
      // Jalur Siber yang sudah berjalan (termasuk menunggu review Lead) atau sudah
      // lulus tidak boleh diajukan ulang supaya tidak ada pengajuan ganda.
      const isAlreadySubmittedCyber = isTrackActive(cyberSt) || isTrackPassed(cyberSt)
        || st === PROJECT_STATUS.CYBER_IN_PROGRESS
        || st === PROJECT_STATUS.CYBER_PASSED;
      return canStartCyberTrack(st) && !isAlreadySubmittedCyber;
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
   * Alamat lingkungan uji diambil dari data proyek saja. Sebelumnya nilai
   * `VITE_STAGING_URL` dipakai sebagai cadangan, sehingga alamat bawaan lingkungan
   * ikut terkirim seolah-olah itu alamat proyek yang diajukan.
   */
  const buildFormStateFor = (project) => ({
    checkType: CYBER_CHECK_TYPE.PENTEST,
    targetUrl: project?.stagingUrl || project?.staging_url || '',
    sourceCodeRef: '',
    targetDate: project?.targetDate || '',
    stagingUrl: project?.stagingUrl || project?.staging_url || '',
    testPriority: 'Tinggi',
    technicalNotes: '',
  });

  /**
   * Proyek yang sedang dibuka.
   *
   * Yang disimpan di state hanya id-nya; objeknya selalu dicari ulang dari daftar
   * terbaru supaya isi panel ikut diperbarui saat data proyek berubah (polling).
   * Bila belum ada pilihan — atau pilihan lama sudah keluar dari daftar karena
   * pengajuannya selesai — proyek pertama pada daftar yang dipakai.
   */
  const selectedProject = useMemo(() => {
    const picked = selectedProjectId
      ? readyProjects.find(p => String(p.id) === String(selectedProjectId))
      : null;
    return picked || readyProjects[0] || null;
  }, [readyProjects, selectedProjectId]);

  // Isian formulir adalah draf milik satu proyek: begitu proyeknya berganti, draf
  // disusun ulang pada render yang sama (pola "sesuaikan state saat prop berubah").
  // Sebelumnya pengisian awal dikerjakan effect, sehingga formulir sempat tampil
  // dengan isian proyek sebelumnya selama satu render.
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
      type: 'CYBER_REPORT',
      rawFile: file,
      url: URL.createObjectURL(file),
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (e.target) e.target.value = '';
    toast.success(`${newFiles.length} file dokumen audit siber siap diunggah!`);
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
   * Kirim pengajuan ke jalur Audit Keamanan Siber.
   *
   * Pengajuan memakai endpoint jalur (`POST /cyber-requests/submit`), bukan pembaruan
   * proyek. Endpoint itu yang menyetel `cyber_status`, mencatat jenis pemeriksaan beserta
   * masukannya, dan menuliskan jejak audit pengajuan.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) {
      toast.error('Pilih proyek yang akan diajukan terlebih dahulu!');
      return;
    }
    if (!formData.checkType) {
      toast.error('Pilih jenis pemeriksaan keamanan siber: Penetration Test atau Secure Code Review.');
      return;
    }
    if (requiresTargetUrl(formData.checkType) && !formData.targetUrl.trim()) {
      toast.error('Penetration Test menguji aplikasi berjalan, jadi alamat web target wajib diisi.');
      return;
    }
    if (requiresSourceCodeRef(formData.checkType) && !formData.sourceCodeRef.trim()) {
      toast.error('Secure Code Review menelaah kode sumber, jadi rujukan kode wajib diisi.');
      return;
    }
    if (!formData.targetDate) {
      toast.error('Tentukan target tanggal selesai Audit Keamanan Siber!');
      return;
    }

    setIsSubmitting(true);
    try {
      // Unggah dokumen pendukung ke document vault supaya benar-benar tersimpan
      // dan namanya dibuat backend. Dilakukan sebelum pengajuan agar dokumen sudah
      // tersedia begitu tim Keamanan Siber membuka proyeknya.
      const filesToUpload = uploadedFiles.filter(f => f.rawFile);
      const failedUploads = [];
      const succeededUploads = [];
      for (const uploadedFile of filesToUpload) {
        try {
          await documentService.upload(uploadedFile.rawFile, {
            project_id: selectedProject.id,
            document_type: DOCUMENT_TYPES.CYBER_REPORT.code,
            original_filename: uploadedFile.originalName || uploadedFile.rawFile.name,
          });
          succeededUploads.push(uploadedFile.originalName || uploadedFile.name);
        } catch (uploadErr) {
          failedUploads.push(uploadedFile.originalName || uploadedFile.name);
          toast.error(`Gagal mengunggah "${uploadedFile.originalName || uploadedFile.name}": ${uploadErr.message}`);
        }
      }

      if (filesToUpload.length > 0 && failedUploads.length === filesToUpload.length) {
        throw new Error('Seluruh dokumen pendukung gagal diunggah. Pengajuan Audit Keamanan Siber dibatalkan.');
      }

      // `notes` merangkum keterangan pengajuan; backend menyimpannya pada metadata
      // audit perubahan jalur pengujian sekaligus menampilkannya di layar Lead.
      const submissionNote = [
        `Pengajuan Audit Keamanan Siber oleh ${user?.name || 'Analis Pengembangan'}.`,
        `Jenis pemeriksaan: ${activeCheckTypeOption?.label || formData.checkType}.`,
        `Prioritas audit: ${formData.testPriority}.`,
        formData.technicalNotes ? `Catatan teknis: ${formData.technicalNotes}` : null,
      ].filter(Boolean).join(' ');

      try {
        await cyberRequestService.submitRequest({
          project_id: selectedProject.id,
          cyber_check_type: formData.checkType,
          // Hanya masukan yang relevan dikirim. Backend memakai `exclude_unless`, sehingga
          // field yang tidak relevan diabaikan; mengirim null pun tidak akan menimpa apa pun.
          cyber_target_url: requiresTargetUrl(formData.checkType) ? formData.targetUrl.trim() : null,
          cyber_source_code_ref: requiresSourceCodeRef(formData.checkType) ? formData.sourceCodeRef.trim() : null,
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
        'Pengajuan Audit Keamanan Siber Berhasil',
        `Proyek ${selectedProject.name} masuk antrean ${activeCheckTypeOption?.label || 'Audit Keamanan Siber'}.`,
        'success',
        '/workspace/cyber'
      );

      // Kegagalan unggah sebagian tidak boleh berakhir sebagai pesan sukses tunggal.
      // Pengajuannya memang terkirim, tetapi tim Keamanan Siber akan bekerja tanpa
      // sebagian dokumen yang pengaju yakin sudah terlampir.
      if (failedUploads.length > 0) {
        toast.error(
          `Pengajuan Audit Keamanan Siber untuk ${selectedProject.name} terkirim, tetapi `
          + `${failedUploads.length} dari ${filesToUpload.length} dokumen gagal diunggah. `
          + 'Unggah ulang lewat Manajemen Dokumen.',
          { duration: 8000 }
        );
      } else {
        toast.success(`Pengajuan Audit Keamanan Siber untuk proyek ${selectedProject.name} berhasil dikirim!`);
      }

      // Halaman ini segera ditinggalkan, jadi URL pratinjaunya dicabut lebih dahulu.
      releaseFilePreviews(uploadedFiles);
      setUploadedFiles([]);

      refreshData();
      navigate('/workspace/cyber');
    } catch (err) {
      toast.error(err.message || 'Gagal mengajukan proyek ke Audit Keamanan Siber.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Salin sebuah nilai ke papan klip.
   *
   * Clipboard API tidak tersedia pada konteks non-HTTPS dan izinnya dapat ditolak,
   * sehingga kegagalannya perlu ditangani — sebelumnya promise-nya dilepas tanpa
   * penangkap dan pesan "Berhasil disalin" tetap muncul meski penyalinan gagal.
   */
  const handleCopyValue = async (value) => {
    const text = String(value || '').trim();
    if (!text) {
      toast.error('Belum ada nilai yang dapat disalin.');
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Peramban tidak mengizinkan akses papan klip pada halaman ini.');
      }
      await navigator.clipboard.writeText(text);
      toast.success('Berhasil disalin ke papan klip!');
    } catch (err) {
      toast.error(`Gagal menyalin: ${err.message}`);
    }
  };

  // Dokumen prasyarat per fase/aktivitas: BRD, MEMO, FSD, Berita Acara SIT/UAT, dsb.
  // Lampiran bukti per task/skenario SIT & UAT sengaja tidak ikut (dikecualikan di
  // getProjectRealDocuments) karena Cyber memverifikasi dokumen fase, bukan bukti per task.
  const projectDocsList = useMemo(() => {
    return getProjectRealDocuments(selectedProject);
  }, [selectedProject]);


  if (isLoading) {
    return <LoadingSpinner text="Memuat Laman Pengajuan Audit Keamanan Siber..." />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
      {/* Header Laman */}
      <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-gray-800">Form Pengajuan Audit Keamanan Siber</h2>
            <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldAlert size={14} /> Pengajuan Pemeriksaan Keamanan
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Pilih jenis pemeriksaan yang dibutuhkan, lengkapi masukannya, lalu ajukan proyek ke Lead Keamanan Siber untuk didisposisikan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LIST PANEL: Daftar Proyek Siap Cyber (Panel Kiri) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
          <div className="shrink-0 pb-3 border-b border-gray-100 space-y-3 mb-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <ShieldCheck size={16} className="text-orange-600" />
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
                      ? 'border-2 border-[#1a365d] bg-orange-50/40 shadow-sm'
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
                    <span className="font-bold text-orange-700 text-right">{PROJECT_STATUS_LABEL[project.status] || project.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* FORM PANEL: Form Pengajuan Cyber Security (Panel Kanan) */}
        <div ref={rightPanelRef} className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-210px)] scroll-smooth">
          {!selectedProject ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-20">
              <ShieldAlert size={48} className="mb-3 text-gray-300" />
              <p className="font-bold text-gray-600">Pilih Proyek di Panel Kiri</p>
              <p className="text-xs text-gray-400 mt-1">Silakan pilih proyek yang akan diajukan ke Lead Keamanan Siber.</p>
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
                  Deskripsi &amp; Lingkup Sistem
                </h4>
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                  {selectedProject.description || 'Tidak ada deskripsi kebutuhan yang dilampirkan pada proyek ini.'}
                </div>
              </div>

              {/*
                Pemilihan jenis pemeriksaan.

                Dua jenis pemeriksaan menuntut masukan yang tidak dapat saling
                menggantikan, sehingga hanya satu masukan yang ditampilkan sesuai
                pilihan. Aturan wajib-isinya sama dengan `SubmitCyberAuditRequest`.
              */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Jenis Pemeriksaan Keamanan <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {CYBER_CHECK_TYPE_OPTIONS.map(option => {
                    const isActive = formData.checkType === option.value;
                    const OptionIcon = option.value === CYBER_CHECK_TYPE.SECURE_CODE ? Code2 : ShieldAlert;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, checkType: option.value }))}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                          isActive
                            ? 'border-2 border-orange-500 bg-orange-50/70 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-2">
                            <OptionIcon size={16} className={isActive ? 'text-orange-600' : 'text-gray-400'} />
                            <span className={`text-xs font-extrabold ${isActive ? 'text-orange-900' : 'text-gray-700'}`}>
                              {option.label}
                            </span>
                          </span>
                          {isActive && <CheckCircle2 size={16} className="text-orange-600 shrink-0" />}
                        </div>
                        <p className={`text-[11px] leading-relaxed ${isActive ? 'text-orange-950' : 'text-gray-500'}`}>
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Masukan sesuai jenis pemeriksaan */}
              {activeCheckTypeOption && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                    {activeCheckTypeOption.inputLabel} <span className="text-red-500">*</span>
                  </label>

                  {formData.checkType === CYBER_CHECK_TYPE.PENTEST ? (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <LinkIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="url"
                          name="targetUrl"
                          value={formData.targetUrl}
                          onChange={handleChange}
                          placeholder={activeCheckTypeOption.inputPlaceholder}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyValue(formData.targetUrl)}
                        className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all cursor-pointer shadow-xs"
                        title="Salin alamat target"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  ) : (
                    <textarea
                      name="sourceCodeRef"
                      rows={3}
                      value={formData.sourceCodeRef}
                      onChange={handleChange}
                      placeholder={activeCheckTypeOption.inputPlaceholder}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                      required
                    />
                  )}

                  <p className="text-[10px] text-gray-400">{activeCheckTypeOption.inputHelp}</p>
                </div>
              )}

              {/* Target Finish Date & Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                    Target Tanggal Selesai Pemeriksaan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      name="targetDate"
                      value={formData.targetDate}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                    Tingkat Prioritas Audit Siber
                  </label>
                  <select
                    name="testPriority"
                    value={formData.testPriority}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                  >
                    <option value="Normal">Normal (Pengujian Reguler)</option>
                    <option value="Tinggi">Tinggi (High Priority - Proyek RBB)</option>
                    <option value="Critical">Critical (Mandat Regulasi OJK &amp; BI)</option>
                  </select>
                </div>
              </div>

              {/*
                Alamat lingkungan uji tetap diisikan terpisah karena dipakai layar lain
                sebagai alamat lingkungan proyek — berbeda peran dari alamat target
                Penetration Test yang khusus menjadi ruang lingkup satu pemeriksaan.
              */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Alamat Lingkungan Uji Proyek (Opsional)
                </label>
                <div className="relative">
                  <LinkIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    name="stagingUrl"
                    value={formData.stagingUrl}
                    onChange={handleChange}
                    placeholder="https://staging.banknagari.co.id/nama-aplikasi"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                  />
                </div>
                <p className="text-[10px] text-gray-400">Kosongkan bila proyek ini tidak memiliki lingkungan uji yang dapat diakses.</p>
              </div>

              {/* Dokumen Prasyarat SDLC */}
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
                        <FileText size={16} className="text-orange-600 shrink-0" />
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

              {/* Upload Dokumen Keamanan Tambahan */}
              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  Unggah Dokumen Pendukung Keamanan (Spesifikasi Enkripsi / Koleksi API / Aturan Jaringan)
                </label>
                <div className="border-2 border-dashed border-gray-200 hover:border-orange-400 bg-gray-50/50 rounded-2xl p-5 text-center transition-all">
                  <CloudUpload size={32} className="text-orange-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-700">Klik untuk memilih berkas pendukung</p>
                  <p className="text-[10px] text-gray-400 mt-1">PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), ZIP — maks. 5 MB per berkas</p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="cyber-file-input"
                  />
                  <label
                    htmlFor="cyber-file-input"
                    className="mt-3 inline-block px-4 py-2 bg-white border border-gray-300 hover:border-orange-600 text-gray-700 font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                  >
                    Pilih File dari Komputer
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] text-gray-400">Nama dokumen final dibuat sistem saat pengajuan dikirim.</p>
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="p-2.5 bg-orange-50/60 border border-orange-200 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText size={15} className="text-orange-600 shrink-0" />
                          <span className="font-semibold text-gray-800 truncate">{file.name}</span>
                          <span className="text-[10px] text-gray-500">({file.size})</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedDocPreview(file)}
                            className="px-2.5 py-1 bg-white hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
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
                  Catatan &amp; Instruksi Khusus Pemeriksaan
                </label>
                <textarea
                  name="technicalNotes"
                  rows={4}
                  value={formData.technicalNotes}
                  onChange={handleChange}
                  placeholder="Tuliskan fokus pemeriksaan, modul yang paling sensitif, atau batasan akses untuk tim Keamanan Siber..."
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition-all"
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
                  <span>{isSubmitting ? 'Mengirim pengajuan...' : 'Kirim Pengajuan Audit Keamanan Siber'}</span>
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-2">
                  Pengajuan masuk ke Workspace Lead Keamanan Siber. Status jalur naik ke pelaksanaan setelah Lead mendisposisikan pelaksana.
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
