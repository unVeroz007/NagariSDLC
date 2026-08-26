import { useCallback, useMemo, useRef, useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatFileSize } from '../utils/documentNaming';
import {
    EVIDENCE_FILE_INPUT_ACCEPT,
    EVIDENCE_MAX_FILES_PER_REPORT,
    EVIDENCE_UPLOAD_HINT,
    validateEvidenceFile,
} from '../utils/evidenceUpload';

/**
 * Kelas warna aksen ditulis utuh, bukan disusun dari potongan string.
 *
 * Tailwind memindai kelas secara statis pada saat build, sehingga nama kelas hasil
 * gabungan seperti `text-${accent}-600` tidak akan ikut terkompilasi.
 */
const ACCENT_STYLES = {
    purple: {
        icon: 'text-purple-600',
        link: 'text-purple-600',
        chip: 'bg-purple-50 text-purple-600',
        dragging: 'border-purple-500 bg-purple-50',
        idle: 'border-gray-200 hover:border-purple-400 bg-gray-50/50 hover:bg-purple-50/30',
    },
    red: {
        icon: 'text-red-600',
        link: 'text-red-600',
        chip: 'bg-red-50 text-red-600',
        dragging: 'border-red-500 bg-red-50',
        idle: 'border-gray-200 hover:border-red-400 bg-gray-50/50 hover:bg-red-50/30',
    },
};

/**
 * Pemilih berkas bukti pengujian untuk layar pelaksana pengujian (QA & Siber).
 *
 * Komponen ini hanya menahan berkas pilihan pengguna di state pemanggil; unggahannya
 * dilakukan saat laporan dikirim lewat `uploadEvidenceFiles()`. Pemisahan itu penting:
 * bukti baru boleh masuk lemari dokumen bila laporannya memang dikirim, dan berkas yang
 * ditolak batas server sudah disaring sebelum permintaan pertama berjalan.
 *
 * Berkas disimpan sebagai objek `File` asli — bukan data URL — supaya isi berkas tidak
 * pernah disalin ke memori peramban dua kali dan tetap dapat dikirim sebagai FormData.
 *
 * @param {object} props
 * @param {File[]} props.files - berkas terpilih, dikelola pemanggil.
 * @param {(files: File[]) => void} props.onChange - dipanggil dengan daftar berkas baru.
 * @param {'purple'|'red'} [props.accent] - warna aksen mengikuti identitas layar.
 * @param {string} [props.label] - judul blok unggahan.
 * @param {boolean} [props.disabled] - matikan interaksi saat laporan sedang dikirim.
 */
export default function EvidenceUploader({
    files,
    onChange,
    accent = 'purple',
    label = 'Upload Bukti Pengujian / Evidence',
    disabled = false,
}) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);
    const styles = ACCENT_STYLES[accent] ?? ACCENT_STYLES.purple;
    // Daftar berkas dinormalkan sekali per perubahan `files`. Tanpa useMemo, fallback
    // array kosong membuat identitasnya berubah setiap render sehingga `addFiles`
    // ikut dibuat ulang terus.
    const selectedFiles = useMemo(() => (Array.isArray(files) ? files : []), [files]);

    const addFiles = useCallback((incoming) => {
        const candidates = Array.from(incoming || []);

        if (candidates.length === 0) return;

        const accepted = [];

        for (const file of candidates) {
            const rejection = validateEvidenceFile(file);

            if (rejection) {
                toast.error(rejection);
                continue;
            }

            accepted.push(file);
        }

        if (accepted.length === 0) return;

        const remainingSlots = EVIDENCE_MAX_FILES_PER_REPORT - selectedFiles.length;

        if (remainingSlots <= 0) {
            toast.error(`Maksimal ${EVIDENCE_MAX_FILES_PER_REPORT} berkas bukti per laporan.`);
            return;
        }

        const admitted = accepted.slice(0, remainingSlots);

        if (admitted.length < accepted.length) {
            toast.error(`Hanya ${admitted.length} berkas ditambahkan — batas ${EVIDENCE_MAX_FILES_PER_REPORT} berkas per laporan tercapai.`);
        }

        onChange([...selectedFiles, ...admitted]);
        toast.success(`${admitted.length} berkas bukti ditambahkan.`);
    }, [onChange, selectedFiles]);

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        addFiles(event.dataTransfer?.files);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
    };

    const removeFileAt = (index) => {
        onChange(selectedFiles.filter((_, position) => position !== index));
    };

    return (
        <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
                <span className="flex items-center gap-1.5">
                    <Paperclip size={13} className={styles.icon} /> {label}
                    <span className="text-[10px] text-gray-400 font-normal">(screenshot, log, laporan pengujian)</span>
                </span>
            </label>

            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => !disabled && inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                    disabled ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' : 'cursor-pointer'
                } ${isDragging ? styles.dragging : styles.idle}`}
            >
                <Upload size={20} className="mx-auto mb-1.5 text-gray-400" />
                <p className="text-xs font-semibold text-gray-600">
                    Seret berkas ke sini atau <span className={`${styles.link} underline`}>klik untuk pilih berkas</span>
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{EVIDENCE_UPLOAD_HINT}</p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    disabled={disabled}
                    className="hidden"
                    accept={EVIDENCE_FILE_INPUT_ACCEPT}
                    onChange={(event) => {
                        addFiles(event.target.files);
                        // Kosongkan input agar berkas yang sama dapat dipilih ulang
                        // setelah dihapus dari daftar.
                        event.target.value = '';
                    }}
                />
            </div>

            {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                    <p className="text-[10px] text-gray-400">
                        {selectedFiles.length} berkas siap diunggah saat laporan dikirim. Nama dokumen final dibuat sistem.
                    </p>
                    {selectedFiles.map((file, index) => (
                        <div
                            key={`${file.name}-${file.size}-${index}`}
                            className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl"
                        >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${styles.chip}`}>
                                    <Paperclip size={13} />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-xs font-bold text-gray-800 truncate">{file.name}</p>
                                    <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => removeFileAt(index)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 disabled:cursor-not-allowed"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
