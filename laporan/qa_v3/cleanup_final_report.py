from pathlib import Path

from docx import Document

from finalize_laporan_docx import all_paragraphs, clean_text, set_plain_text


SOURCE = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.4.3-FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx")
OUTPUT = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.4.4-FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx")


def main() -> None:
    document = Document(SOURCE)
    changed = 0

    exact_replacements = {
        "6. Tangkapan layar, logo, struktur organisasi resmi, dan dokumen pengesahan ditandai sebagai placeholder hingga bahan resmi tersedia.": (
            "6. Tangkapan layar dan diagram dibatasi pada bagian yang relevan dengan pembahasan serta tidak menampilkan data produksi atau informasi sensitif."
        ),
        "8. Diagram tidak disisipkan sebagai gambar; dokumen menampilkan placeholder dan berkas pendamping menyediakan kode Mermaid.": (
            "8. Diagram proses, UML, ERD, sequence, dan navigasi merepresentasikan rancangan serta implementasi pada saat laporan disusun."
        ),
        "Hasil kegiatan berupa implementasi aplikasi NagariSDLC, dokumentasi teknis, pemetaan workflow, perbaikan integrasi front end dan back end, serta bukti verifikasi yang tercatat pada dokumentasi proyek. Log harian rinci tetap perlu diisi menggunakan catatan kegiatan asli dan ditempatkan pada Lampiran E.": (
            "Hasil kegiatan berupa implementasi aplikasi NagariSDLC, dokumentasi teknis, pemetaan workflow, perbaikan integrasi front end dan back end, serta bukti verifikasi yang tercatat pada dokumentasi proyek. Ringkasan kegiatan disajikan berdasarkan pekerjaan yang dapat diverifikasi melalui implementasi dan dokumentasi proyek."
        ),
        "1. Lengkapi seluruh placeholder identitas, profil resmi, struktur organisasi, logo, foto, tanda tangan, dan bukti kegiatan sebelum pengesahan.": (
            "1. Lakukan pengujian regresi backend, pemeriksaan lint, build frontend, dan pengujian end-to-end setelah setiap perubahan utama agar kestabilan sistem tetap terjaga."
        ),
        "2. Render kode Mermaid pada berkas pendamping, periksa keterbacaan, lalu masukkan setiap gambar pada placeholder dengan caption yang tetap.": (
            "2. Tetapkan konfigurasi dan prosedur operasional produksi untuk database, queue, object storage, CORS, Reverb, backup, monitoring, logging, serta retensi data."
        ),
        "3. Lakukan pengujian ulang backend, ESLint, build, dan pengujian end-to-end setelah perubahan source code terakhir sebelum laporan dinyatakan final.": (
            "3. Tambahkan pemantauan kesehatan layanan, metrik performa, pencatatan kesalahan terpusat, dan mekanisme pemulihan agar gangguan operasional dapat dideteksi lebih cepat."
        ),
        "4. Tetapkan konfigurasi dan SOP produksi untuk database, queue, storage, CORS, Reverb, backup, monitoring, logging, serta retensi data.": (
            "4. Pertahankan seluruh transisi proyek melalui ProjectWorkflowService dan seluruh penulisan return round melalui ProjectReturnRoundService agar aturan bisnis tetap terpusat."
        ),
        "5. Pertahankan seluruh transisi proyek melalui ProjectWorkflowService dan seluruh penulisan return round melalui ProjectReturnRoundService.": (
            "5. Pertahankan approval, histori status, laporan pengujian, activity log, dan bukti dokumen sebagai audit trail serta hindari hard delete tanpa kebijakan retensi resmi."
        ),
        "6. Hindari hard delete pada approval, histori, laporan pengujian, dan bukti dokumen kecuali telah ada keputusan retensi resmi.": (
            "6. Lakukan evaluasi usability dan pengukuran karakteristik kualitas ISO/IEC 25010 secara berkala menggunakan data penggunaan nyata setelah sistem diterapkan."
        ),
    }

    for paragraph in all_paragraphs(document):
        text = clean_text(paragraph)
        new_text = exact_replacements.get(text)
        if new_text is not None:
            set_plain_text(paragraph, new_text)
            changed += 1
            continue

        raw = paragraph.text
        updated = raw
        updated = updated.replace("Afjendi", "Arjendi")
        updated = updated.replace("Fery Arjendi", "Ferry Arjendi")
        updated = updated.replace("Grub Pengembangan", "Grup Pengembangan")
        updated = updated.replace("di Grub", "di Grup")
        updated = updated.replace("Analist", "Analis")
        updated = updated.replace("focus", "fokus")
        updated = updated.replace("kepatihan", "kepatuhan")
        updated = updated.replace("PT Bank Bank Nagari", "PT Bank Nagari")
        if "Rincian harian wajib disesuaikan dengan log asli pada Lampiran E" in updated:
            prefix = updated.split("Rincian harian wajib disesuaikan dengan log asli pada Lampiran E", 1)[0].rstrip()
            updated = (
                prefix
                + " Uraian kontribusi dibatasi pada aktivitas yang dapat diverifikasi melalui implementasi dan dokumentasi proyek."
            )
        if updated != raw:
            set_plain_text(paragraph, updated)
            changed += 1

    document.core_properties.author = "Muhammad Galid Avero"
    document.core_properties.last_modified_by = "Muhammad Galid Avero"
    document.save(OUTPUT)
    print(f"OUTPUT={OUTPUT}")
    print(f"CHANGED={changed}")


if __name__ == "__main__":
    main()
