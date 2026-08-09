import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects, getProjectRealDocuments, saveFileToStore } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';
import { generateDocumentName, DOCUMENT_TYPES, formatFileSize } from '../../utils/documentNaming';

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
  AlertCircle,
  Copy,
  ExternalLink,
  Eye,
  Download,
  Building,
  User,
  ShieldCheck,
  Zap,
  Check
} from 'lucide-react';
import { PROJECT_STATUS } from '../../constants/projectStatus';

export default function QARequest() {
  const { user } = useAuth();
  const { projects, isLoading, updateProject } = useProjects();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const rightPanelRef = useRef(null);

  const [selectedProject, setSelectedProject] = useState(null);
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
  // 1. QA Dulu: PM ajukan ke QA dari IN_DEVELOPMENT atau READY_FOR_QA
  // 2. Serentak (Paralel): PM ajukan ke QA bersamaan dengan Cyber (saat CYBER_IN_PROGRESS)
  // 3. Cyber Dulu: PM ajukan ke QA setelah Cyber selesai (CYBER_PASSED)
  // + RETURN_TO_DEV: PM bisa resubmit ke QA setelah perbaikan defect
  const readyProjects = useMemo(() => {
    let list = projects.filter(p => {
      const qaSt = String(p.qaStatus || p.qa_status || '').toUpperCase();
      const st = String(p.status || '').toUpperCase();
      const isEligibleStage = ['DEV_COMPLETED', 'SIT_PASSED', 'UAT_PASSED', 'IN_DEVELOPMENT', 'CYBER_IN_PROGRESS', 'CYBER_PASSED', 'RETURN_TO_DEV'].includes(st);
      const isAlreadySubmittedQA = ['SUBMITTED', 'IN_PROGRESS', 'PASSED'].includes(qaSt) || st === 'READY_FOR_QA' || st === 'QA_IN_PROGRESS';
      return isEligibleStage && !isAlreadySubmittedQA;
    });

    const isPrivileged = user?.role && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);
    if (!isPrivileged && user?.id) {
      const pmId = user.id;
      list = list.filter(p => {
        const pmObjId = typeof p.pm === 'object' ? p.pm?.id : null;
        return pmObjId && pmObjId === pmId;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return list.filter(p =>
        String(p.id).toLowerCase().includes(term) ||
        String(p.name).toLowerCase().includes(term) ||
        String(p.division).toLowerCase().includes(term)
      );
    }

    return list;
  }, [projects, user, searchTerm]);



  // Auto Select Proyek Pertama jika belum ada yang terpilih
  useEffect(() => {
    if (readyProjects.length > 0 && !selectedProject) {
      setSelectedProject(readyProjects[0]);
      setFormData(prev => ({
        ...prev,
        stagingUrl: readyProjects[0].stagingUrl || 'https://staging-app.banknagari.co.id',
        targetDate: readyProjects[0].targetDate || ''
      }));
    }
  }, [readyProjects]);

  // Auto scroll ke atas saat proyek terpilih berubah
  useEffect(() => {
    if (selectedProject) {
      scrollPageToTop();
    }
  }, [selectedProject?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyPresetNote = (presetText) => {
    setFormData(prev => ({
      ...prev,
      technicalNotes: prev.technicalNotes ? `${prev.technicalNotes}\n- ${presetText}` : `- ${presetText}`
    }));
    toast.success('Instruksi preset berhasil ditambahkan!');
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const MAX_SIZE = 5 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > MAX_SIZE);
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => `"${f.name}"`).join(', ');
      toast.error(`Dokumen ${fileNames} ditolak karena ukurannya melebihi batas maksimal 5MB!`);
    }
    const validFiles = files.filter(f => f.size <= MAX_SIZE);
    if (validFiles.length === 0) {
      if (e.target) e.target.value = '';
      return;
    }
    const newFiles = validFiles.map((file) => {
      const url = URL.createObjectURL(file);
      saveFileToStore(file.name, url);
      const ext = file.name.split('.').pop() || '';
      const autoName = generateDocumentName(
        selectedProject?.req_id || selectedProject?.id,
        DOCUMENT_TYPES.QA_REPORT.code,
        selectedProject?.title || selectedProject?.name
      ) + '.' + ext;
      return {
        name: autoName,
        originalName: file.name,
        size: formatFileSize(file.size),
        type: 'QA_REPORT',
        rawFile: file,
        url: url,
      };
    });
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (e.target) e.target.value = '';
    toast.success(`${newFiles.length} file dokumen pengujian berhasil diunggah!`);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    toast.success('File berhasil dihapus.');
  };

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
      const liveProj = (projects || []).find(p => String(p.id) === String(selectedProject.id)) || selectedProject;
      const isCyberActive = ['SUBMITTED', 'IN_PROGRESS'].includes(String(liveProj.cyberStatus || liveProj.cyber_status || '').toUpperCase()) || liveProj.status === 'CYBER_IN_PROGRESS';

      const newUploadedDocs = uploadedFiles.map(f => ({
        id: `qa-doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: f.name,
        type: 'Dokumen Tambahan Pengajuan QA',
        size: f.size,
        uploadedAt: new Date().toISOString(),
        author: user?.name || 'Project Manager',
        url: f.url
      }));

      const existingDocs = Array.isArray(liveProj.documents) ? liveProj.documents : [];
      const updatedDocs = [...existingDocs, ...newUploadedDocs];

      await updateProject(selectedProject.id, {
        status: isCyberActive ? 'TESTING_IN_PROGRESS' : 'READY_FOR_QA',
        qaStatus: 'SUBMITTED',
        ...(liveProj.cyberStatus ? { cyberStatus: liveProj.cyberStatus } : {}),
        qaSubmittedAt: new Date().toISOString(),
        qaTargetDate: formData.targetDate,
        qaStagingUrl: formData.stagingUrl,
        qaNotes: formData.technicalNotes,
        documents: updatedDocs
      });

      addNotification(
        'Pengajuan QA Berhasil',
        `Proyek ${selectedProject.name} telah resmi diajukan ke antrean Quality Assurance (QA).`,
        'success',
        '/workspace/qa'
      );

      toast.success(`Pengajuan QA untuk proyek ${selectedProject.name} berhasil dikirim!`);
      
      setTimeout(() => {
        setIsSubmitting(false);
        navigate('/workspace/qa');
      }, 600);
    } catch (err) {
      toast.error(err.message || 'Gagal mengajukan proyek ke QA.');
      setIsSubmitting(false);
    }
  };

  const handleCopyStagingUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Staging URL berhasil disalin ke clipboard!');
  };

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
                  onClick={() => {
                    setSelectedProject(project);
                    setFormData(prev => ({
                      ...prev,
                      stagingUrl: project.stagingUrl || 'https://staging-app.banknagari.co.id',
                      targetDate: project.targetDate || ''
                    }));
                    scrollPageToTop();
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedProject?.id === project.id
                      ? 'border-2 border-[#1a365d] bg-blue-50/40 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {project.id}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={project.type} /><ProjectTypeBadge type={project.project_type} /></div>
                  </div>
                  <h4 className="font-bold text-gray-800 text-xs line-clamp-1 mb-1.5">{project.name}</h4>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                    <span>{project.division}</span>
                    <span className="font-bold text-gray-700">{project.status}</span>
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
                    {selectedProject.id}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={selectedProject.type} deadline={selectedProject.rbbDeadline} /><ProjectTypeBadge type={selectedProject.project_type} /></div>
                </div>
                <h3 className="text-xl font-extrabold text-gray-800">{selectedProject.name}</h3>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                  <Building size={14} className="text-gray-400" />
                  <span>Divisi: <strong className="text-gray-700">{selectedProject.division}</strong></span>
                  <span>•</span>
                  <User size={14} className="text-gray-400" />
                  <span>PM: <strong className="text-gray-700">{typeof selectedProject.pm === 'object' ? selectedProject.pm?.name : (selectedProject.pm || 'Andi Wijaya')}</strong></span>
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
                  Target Staging Test Environment URL <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      name="stagingUrl"
                      value={formData.stagingUrl}
                      onChange={handleChange}
                      placeholder="https://staging-app.banknagari.co.id"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyStagingUrl(formData.stagingUrl)}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all cursor-pointer shadow-xs"
                    title="Salin Staging URL"
                  >
                    <Copy size={16} />
                  </button>
                </div>
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
                  {projectDocsList.map(doc => (
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
                  <p className="text-xs font-bold text-gray-700">Tarik &amp; lepas file di sini, atau klik untuk memilih file</p>
                  <p className="text-[10px] text-gray-400 mt-1">Format dukungan: PDF, DOCX, XLSX, JSON (Maksimal 5 MB)</p>
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
                  <span>Kirim Pengajuan Quality Assurance (QA)</span>
                </button>
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