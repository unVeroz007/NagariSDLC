// src/pages/pm/CyberRequest.jsx
import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import RBBBadge from '../../components/RBBBadge';
import {
  FileText,
  CloudUpload,
  Calendar,
  Link as LinkIcon,
  Send,
  X,
  ShieldCheck,
} from 'lucide-react';
import { PROJECT_STATUS } from '../../constants/projectStatus';

export default function CyberRequest() {
  const { user } = useAuth();
  const { projects, isLoading, updateProject } = useProjects();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [selectedProject, setSelectedProject] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    targetDate: '',
    stagingUrl: '',
    technicalNotes: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter projects ready for Cyber — QA_PASSED atau READY_FOR_CYBER
  const readyProjects = useMemo(() => {
    return projects.filter(
      p => p.status === PROJECT_STATUS.QA_PASSED || p.status === PROJECT_STATUS.READY_FOR_CYBER
    );
  }, [projects]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map((file) => ({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
      type: file.type,
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (e.target) e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const newFiles = files.map((file) => ({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
      type: file.type,
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedProject) {
      toast.error('Pilih proyek terlebih dahulu!');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      // Update status proyek agar Workspace Cyber bisa menerima proyek ini
      updateProject(selectedProject.id, { status: PROJECT_STATUS.READY_FOR_CYBER });

      addNotification(
        'Pengajuan Cyber Berhasil',
        `Proyek ${selectedProject.name} telah diajukan ke antrean Cyber Security.`,
        'success'
      );
      toast.success(`Pengajuan Cyber untuk ${selectedProject.id} berhasil dikirim!`);
      setIsSubmitting(false);

      // Reset form dan kembali ke PM Workspace
      setSelectedProject(null);
      setFormData({ targetDate: '', stagingUrl: '', technicalNotes: '' });
      setUploadedFiles([]);
      navigate('/pm/workspace');
    }, 1500);
  };

  if (isLoading) {
    return <LoadingSpinner text="Memuat data proyek..." />;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8f9fb] overflow-hidden">
      {/* Content Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Daftar Proyek */}
        <div className="w-1/3 border-r border-gray-200 bg-white overflow-y-auto p-4 flex flex-col gap-3">
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 px-2">
            <ShieldCheck size={18} className="text-[#1A56DB]" />
            Proyek Siap Cyber
            <span className="bg-blue-100 text-[#1A56DB] text-xs px-2 py-0.5 rounded-full ml-auto">
              {readyProjects.length}
            </span>
          </h3>
          {readyProjects.length > 0 ? (
            readyProjects.map(project => (
              <div
                key={project.id}
                onClick={() => {
                  setSelectedProject(project);
                  setFormData({ targetDate: '', stagingUrl: project.stagingUrl || '', technicalNotes: '' });
                  setUploadedFiles([]);
                }}
                className={`p-4 rounded-xl cursor-pointer transition-all ${
                  selectedProject?.id === project.id
                    ? 'bg-blue-50 border-2 border-[#1A56DB] shadow-sm'
                    : 'bg-white border border-gray-200 hover:border-[#1A56DB] hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-800 leading-tight pr-2">{project.name}</span>
                  <div className="shrink-0">
                    <RBBBadge type={project.type} />
                  </div>
                </div>
                <p className="text-xs font-semibold text-[#1A56DB] mb-1">{project.id}</p>
                <p className="text-xs text-gray-500">Status: <span className="font-medium text-gray-700">{project.status}</span></p>
                <p className="text-xs text-gray-500 mt-1">Divisi: {project.division || 'Umum'}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-10 px-4">
              <ShieldCheck size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Tidak ada proyek yang siap diajukan Cyber saat ini.</p>
            </div>
          )}
        </div>

        {/* Right Panel: Form Pengajuan */}
        <div className="w-2/3 overflow-y-auto p-8 bg-[#f8f9fb]">
          {selectedProject ? (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-white">
                  <h2 className="text-xl font-bold text-gray-800 mb-1">Form Pengajuan Cyber</h2>
                  <p className="text-sm text-gray-500">Silakan lengkapi detail pengajuan untuk proyek <span className="font-semibold text-gray-700">{selectedProject.name}</span>.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Read-only Project Info */}
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">ID Proyek</label>
                      <input type="text" value={selectedProject.id} disabled className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium cursor-not-allowed"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nama Proyek</label>
                      <input type="text" value={selectedProject.name} disabled className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium cursor-not-allowed"/>
                    </div>
                  </div>

                  {/* Target Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Target Selesai Pentest <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="date"
                        name="targetDate"
                        value={formData.targetDate}
                        onChange={handleChange}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none transition-all shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Staging URL */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      URL Staging / IP Server
                    </label>
                    <div className="relative">
                      <LinkIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="stagingUrl"
                        value={formData.stagingUrl}
                        onChange={handleChange}
                        placeholder="https://staging.banknagari.co.id/..."
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Technical Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Catatan Keamanan <span className="text-gray-400 font-normal">(Opsional)</span>
                    </label>
                    <textarea
                      name="technicalNotes"
                      value={formData.technicalNotes}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Sebutkan modul yang perlu diperhatikan atau kredensial tes..."
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none resize-none transition-all shadow-sm"
                    />
                  </div>

                  {/* Upload Dropzone */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Dokumen Pendukung <span className="text-gray-400 font-normal">(Topologi, Arsitektur, dll)</span>
                    </label>
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-blue-50 hover:border-[#1A56DB] transition-all cursor-pointer group bg-gray-50"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => document.getElementById('cyber-upload')?.click()}
                    >
                      <CloudUpload size={40} className="text-gray-300 mx-auto mb-3 group-hover:text-[#1A56DB] transition-colors" />
                      <p className="text-sm font-medium text-gray-700">Tarik &amp; lepas file di sini, atau klik untuk unggah</p>
                      <p className="text-xs text-gray-500 mt-1">Mendukung PDF, DOCX, ZIP (Max 10MB)</p>
                      <input
                        type="file"
                        id="cyber-upload"
                        className="hidden"
                        multiple
                        onChange={handleFileUpload}
                      />
                    </div>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-2">
                        {uploadedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white rounded-lg shadow-sm">
                                  <FileText size={16} className="text-[#1A56DB]" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-700 leading-none">{file.name}</p>
                                <p className="text-xs text-gray-500 mt-1">{file.size}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-3.5 bg-[#003a73] text-white rounded-xl font-bold hover:bg-[#002a5a] transition-all flex items-center gap-2 shadow-lg shadow-[#003a73]/20 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                    >
                      <Send size={18} />
                      {isSubmitting ? 'Memproses...' : 'Kirim ke Antrean Cyber'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center animate-fadeIn">
              <EmptyState 
                title="Pilih Proyek" 
                description="Silakan pilih proyek dari daftar di sebelah kiri untuk mengisi form pengajuan Cyber." 
                icon={ShieldCheck}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}