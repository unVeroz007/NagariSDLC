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
  ShieldCheck,
  Building,
  Copy,
  Search,
  Eye,
  Download,
  ShieldAlert,
  User,
} from 'lucide-react';

export default function CyberRequest() {
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
    testPriority: 'Tinggi',
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

  // Filter proyek yang bisa diajukan ke Cyber oleh PM.
  // Mendukung 3 skenario alur kerja paralel yang fleksibel:
  // 1. Cyber Dulu: PM ajukan ke Cyber dari IN_DEVELOPMENT atau READY_FOR_QA
  // 2. Serentak (Paralel): PM ajukan ke Cyber bersamaan dengan QA (saat QA_IN_PROGRESS)
  // 3. QA Dulu: PM ajukan ke Cyber setelah QA selesai (QA_PASSED)
  // + RETURN_TO_DEV: PM bisa resubmit ke Cyber setelah perbaikan vulnerability
  const readyProjects = useMemo(() => {
    let list = projects.filter(p => {
      const cyberSt = String(p.cyberStatus || p.cyber_status || '').toUpperCase();
      const st = String(p.status || '').toUpperCase();
      const isEligibleStage = ['DEV_COMPLETED', 'SIT_PASSED', 'UAT_PASSED', 'IN_DEVELOPMENT', 'READY_FOR_QA', 'QA_IN_PROGRESS', 'QA_PASSED', 'RETURN_TO_DEV'].includes(st);
      const isAlreadySubmittedCyber = ['SUBMITTED', 'IN_PROGRESS', 'PASSED'].includes(cyberSt) || st === 'CYBER_IN_PROGRESS';
      return isEligibleStage && !isAlreadySubmittedCyber;
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



  // Auto Select Proyek Pertama
  useEffect(() => {
    if (readyProjects.length > 0 && !selectedProject) {
      setSelectedProject(readyProjects[0]);
      setFormData(prev => ({
        ...prev,
        stagingUrl: readyProjects[0].stagingUrl || import.meta.env.VITE_STAGING_URL,
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
    toast.success('Instruksi preset keamanan berhasil ditambahkan!');
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
        DOCUMENT_TYPES.CYBER_REPORT.code,
        selectedProject?.title || selectedProject?.name
      ) + '.' + ext;
      return {
        name: autoName,
        originalName: file.name,
        size: formatFileSize(file.size),
        type: 'CYBER_REPORT',
        rawFile: file,
        url: url,
      };
    });
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (e.target) e.target.value = '';
    toast.success(`${newFiles.length} file dokumen audit siber berhasil diunggah!`);
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
      toast.error('Tentukan target tanggal selesai Audit Cyber!');
      return;
    }

    setIsSubmitting(true);
    try {
      const liveProj = (projects || []).find(p => String(p.id) === String(selectedProject.id)) || selectedProject;
      const isQAActive = ['SUBMITTED', 'IN_PROGRESS'].includes(String(liveProj.qaStatus || liveProj.qa_status || '').toUpperCase()) || ['READY_FOR_QA', 'QA_IN_PROGRESS'].includes(liveProj.status);

      const newUploadedDocs = uploadedFiles.map(f => ({
        id: `cyber-doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: f.name,
        type: 'Dokumen Tambahan Audit Siber',
        size: f.size,
        uploadedAt: new Date().toISOString(),
        author: user?.name || 'Project Manager',
        url: f.url
      }));

      const existingDocs = Array.isArray(liveProj.documents) ? liveProj.documents : [];
      const updatedDocs = [...existingDocs, ...newUploadedDocs];

      await updateProject(selectedProject.id, {
        status: isQAActive ? 'TESTING_IN_PROGRESS' : 'CYBER_IN_PROGRESS',
        cyberStatus: 'SUBMITTED',
        ...(liveProj.qaStatus ? { qaStatus: liveProj.qaStatus } : {}),
        cyberSubmittedAt: new Date().toISOString(),
        cyberTargetDate: formData.targetDate,
        cyberStagingUrl: formData.stagingUrl,
        cyberNotes: formData.technicalNotes,
        documents: updatedDocs
      });



      addNotification(
        'Pengajuan Cyber Security Berhasil',
        `Proyek ${selectedProject.name} telah diajukan ke antrean Penetration Test & Audit Keamanan Siber.`,
        'success',
        '/workspace/cyber'
      );

      toast.success(`Pengajuan Cyber Security untuk proyek ${selectedProject.name} berhasil dikirim!`);
      
      setTimeout(() => {
        setIsSubmitting(false);
        navigate('/workspace/cyber');
      }, 600);
    } catch (err) {
      toast.error(err.message || 'Gagal mengajukan proyek ke Cyber Security.');
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
    return <LoadingSpinner text="Memuat Laman Pengajuan Cyber..." />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
      {/* Header Laman */}
      <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-gray-800">Form Pengajuan Audit Cyber Security &amp; Pentest</h2>
            <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldAlert size={14} /> SDLC Phase 3 Cyber Security Submission
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Ajukan proyek yang telah lulus QA ke tim Cyber Security Lead untuk pengujian penetration test dan audit keamanan siber.
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
                  onClick={() => {
                    setSelectedProject(project);
                    setFormData(prev => ({
                      ...prev,
                      stagingUrl: project.stagingUrl || import.meta.env.VITE_STAGING_URL,
                      targetDate: project.targetDate || ''
                    }));
                    scrollPageToTop();
                  }}
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
                    <span className="font-bold text-orange-700">{project.status}</span>
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
              <p className="text-xs text-gray-400 mt-1">Silakan pilih proyek yang akan diajukan ke tim Cyber Security Lead.</p>
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
                  <span>PM: <strong className="text-gray-700">{typeof selectedProject.pm === 'object' ? selectedProject.pm?.name : (selectedProject.pm || 'Budi Santoso')}</strong></span>
                </p>
              </div>

              {/* Deskripsi Proyek */}
              <div>
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={15} className="text-[#1a365d]" />
                  Deskripsi &amp; Lingkup Sistem
                </h4>
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                  {selectedProject.description || 'Pengembangan sistem perbankan digital Bank Nagari. Wajib melalui audit pengerasan jaringan (hardening) dan tes penetration test.'}
                </div>
              </div>

              {/* URL Staging Target Penetration Test */}
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
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
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
                    Target Tanggal Selesai Pentest <span className="text-red-500">*</span>
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

              {/* Dokumen Prasyarat SDLC & Laporan QA Passed */}
              <div>
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={15} className="text-[#1a365d]" />
                  Dokumen SDLC &amp; Laporan Verifikasi QA Passed ({projectDocsList.length})
                </h4>
                <div className="space-y-2">
                  {projectDocsList.map(doc => (
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
                  Unggah Dokumen Keamanan Tambahan (Spesifikasi Enkripsi / API Collection / Network Rule)
                </label>
                <div className="border-2 border-dashed border-gray-200 hover:border-orange-400 bg-gray-50/50 rounded-2xl p-5 text-center transition-all">
                  <CloudUpload size={32} className="text-orange-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-700">Tarik &amp; lepas file di sini, atau klik untuk memilih file</p>
                  <p className="text-[10px] text-gray-400 mt-1">Format dukungan: PDF, DOCX, XLSX, JSON (Maksimal 5 MB)</p>
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
                  Catatan &amp; Instruksi Khusus Audit Cyber Security
                </label>
                <textarea
                  name="technicalNotes"
                  rows={4}
                  value={formData.technicalNotes}
                  onChange={handleChange}
                  placeholder="Tuliskan catatan keamanan siber, fokus pengujian penetration test, atau batasan akses untuk Security Auditor..."
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
                  <span>Kirim Pengajuan Cyber Security Audit</span>
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