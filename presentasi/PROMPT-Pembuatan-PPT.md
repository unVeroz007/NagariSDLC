# Prompt Siap-Pakai — Pembuatan PPT NagariSDLC

Salin seluruh teks di dalam blok di bawah ini, lampirkan file **`NagariSDLC-Materi.pdf`**, lalu tempelkan ke AI pembuat presentasi pilihan Anda (Claude, ChatGPT dengan pembuat `.pptx`, Gamma, Canva Magic, atau Copilot di PowerPoint).

> **Catatan:** Jika AI yang Anda pakai tidak bisa membaca PDF, buka `NagariSDLC-Materi.pdf`, salin isi **Bagian C** (struktur 18 slide) dan **Bagian D** (lampiran data), lalu tempelkan bersama prompt ini.

---

```
Kamu adalah desainer presentasi profesional. Buatkan saya file presentasi (.pptx) berjudul
"NagariSDLC" berdasarkan dokumen PDF terlampir (NagariSDLC-Materi.pdf).

=== BAHASA ===
Seluruh teks slide WAJIB dalam Bahasa Indonesia. Pertahankan istilah teknis, nama status,
nama peran, dan nama endpoint persis seperti di dokumen (mis. IN_DEVELOPMENT, project_manager,
POST /qa-requests/submit) — jangan diterjemahkan.

=== ATURAN DATA (PALING PENTING) ===
- Gunakan HANYA data yang ada di dalam PDF terlampir. DILARANG mengarang angka, fitur, nama,
  atau alur apa pun. Jika sesuatu tidak ada di dokumen, jangan ditambahkan.
- Angka kunci yang harus akurat: 12 peran, 27 status proyek, 5 grup kerja, 2 jalur uji paralel
  (QA & Keamanan Siber), 4 langkah per jalur uji, 236 uji otomatis / 1467 assertions lulus.
- Fakta yang wajib benar: autentikasi memakai Laravel Sanctum Bearer token (BUKAN cookie
  HttpOnly, BUKAN JWT). TIDAK ADA UAT final setelah QA & Siber — setelah keduanya lulus,
  PM langsung mengajukan rilis (PENDING_GOLIVE) dan Head of IT menyetujui di Quality Gate
  (LIVE_PRODUCTION). Status READY_FOR_UAT dan UAT_PASSED bersifat legacy.

=== AUDIENS ===
Mentor magang dan manajemen Teknologi Informasi bank. Nada profesional, ringkas, teknis
namun mudah dipahami manajemen.

=== JUMLAH & STRUKTUR SLIDE ===
Buat tepat 18 slide mengikuti Bagian C dokumen, dalam 4 blok:
  Blok 1 (Slide 1–4): Sampul, Ringkasan Eksekutif, Latar Belakang & Tujuan, Ruang Lingkup
  Blok 2 (Slide 5–7): Arsitektur Teknis, Peran (RBAC) & Grup Kerja, Kontrol Akses & Keamanan
  Blok 3 (Slide 8–14): Peta Alur Swimlane, State Machine Status, Fase 1 & Kanban, SIT, QA & Siber,
                       UAT (Minor vs Mayor), Rilis & Quality Gate
  Blok 4 (Slide 15–18): Model Data (ERD), Tangkapan Layar (placeholder), Progres Saat Ini, Penutup
Setiap slide: pakai judul + isi persis seperti kartu slide di Bagian C. Sertakan catatan
pembicara (speaker notes) dari kartu tersebut pada bagian notes tiap slide.

=== DIAGRAM YANG HARUS DIBUAT (gambar sebagai bentuk/SmartArt, bukan gambar mentah) ===
1. Slide 5 — Arsitektur 3 lapisan: Browser (React 19 SPA) ⇄ REST API (Laravel 13, Sanctum) ⇄
   MySQL. Label panah: "REST JSON · Bearer token" dan "Eloquent ORM". Komponen samping:
   Laravel Reverb (realtime) dan Document Vault.
2. Slide 6 — Tabel 12 peran (kolom: Peran, Grup, Peran dalam Alur, Halaman Utama) dari Lampiran D1,
   sel grup diberi warna berbeda per grup kerja.
3. Slide 8 — Swimlane end-to-end: baris = pemilik peran (Pemohon, Perencanaan & QA, Pengembangan,
   Keamanan Siber, Manajemen TI), kolom = fase (Pengajuan, Analisis, Pengembangan, SIT, UAT, QA,
   Siber, Rilis→Live). QA & Siber ditandai paralel.
4. Slide 9 — State machine 4 pita fase memakai daftar transisi Bagian C Slide 9 (Fase 1 s/d Fase 4),
   dengan node revisi (SIT_REVISION, UAT_REVISION_SIT, UAT_REVISION_DEV) dan node terminal
   (REJECTED, ON_HOLD, CANCELLED).
5. Slide 12 — Dua jalur paralel (QA dan Siber), masing-masing 4 langkah: Pengajuan → Disposisi →
   Laporan → Sign-off, berujung PASSED/FAILED; FAILED membuka putaran pengembalian → RETURN_TO_DEV.
6. Slide 13 — Percabangan UAT: MINOR (perbaiki di tempat, tahan penutupan) vs MAYOR
   (UAT_REVISION_DEV → SIT ulang menyeluruh → UAT diulang dari Tahap 1).
7. Slide 15 — ERD hub-and-spoke: projects di tengah sebagai hub, entitas master di atas
   (users, roles, groups, divisions), entitas anak di bawah (project_tasks, test_reports,
   document_vaults, project_status_histories, release_requests, project_return_rounds,
   uat_approval_rounds, uat_approvers, chat_messages, activity_logs, notifications).

=== TANGKAPAN LAYAR ===
Slide 16 berisi 6 kotak PLACEHOLDER KOSONG berlabel (jangan mencari/menempel gambar): Dasbor SDLC,
Papan Kanban, Wizard SIT/UAT, My Tasks QA/Siber, Matriks Persetujuan UAT, Administrasi. Beri
bingkai putus-putus dan teks label agar pengguna memasukkan gambar sendiri nanti.

=== DESAIN VISUAL ===
- Warna merek utama: #00529C (biru Nagari). Variasi gelap: #003A73. Aksen: emas #B7791F.
  Netral: putih #FFFFFF, teks gelap #1F2A37, garis #C9D6E5, latar lembut #F4F7FB.
- Slide sampul (1) dan penutup (18): latar gelap #003A73 dengan teks putih. Slide isi: latar putih.
- Font aman: judul pakai serif (Cambria), isi pakai sans (Calibri atau Arial). Ukuran: judul 32–40pt,
  header seksi 20–24pt, isi 14–16pt, keterangan 10–12pt.
- Setiap slide punya elemen visual (diagram, ikon dalam lingkaran berwarna, kartu statistik, atau
  tabel). Untuk Slide 2 tampilkan 4 kartu statistik besar: 12 Peran, 27 Status, 2 Jalur Uji, 236 Uji.
- JANGAN memakai garis aksen di bawah judul atau strip warna dekoratif di tepi (kesan AI). Gunakan
  ruang kosong, tint latar lembut, atau ikon untuk memisahkan konten.
- Rata kiri untuk paragraf dan daftar; rata tengah hanya untuk judul. Margin minimal 1,25 cm.
- Jaga agar tidak ada teks meluber keluar kotak; jika terlalu panjang, kecilkan font atau pecah.

=== OUTPUT ===
Hasilkan satu file .pptx rasio 16:9 dengan 18 slide di atas, lengkap dengan catatan pembicara
per slide. Pastikan semua data cocok dengan PDF terlampir — tidak ada yang mengada-ada.
```

---

## Ringkasan cepat isi tiap slide (rujukan bila diperlukan)

| # | Judul | Inti |
|---|-------|------|
| 1 | Sampul | Judul + audiens + bulan/tahun (slide gelap) |
| 2 | Ringkasan Eksekutif | 4 kartu statistik: 12 / 27 / 2 / 236 |
| 3 | Latar Belakang & Tujuan | dua kolom: latar belakang vs tujuan |
| 4 | Ruang Lingkup | dalam lingkup vs belum ditetapkan |
| 5 | Arsitektur Teknis | diagram 3 lapisan + respons API seragam |
| 6 | Peran (RBAC) & Grup | tabel 12 peran, grup = tampilan saja |
| 7 | Kontrol Akses & Keamanan | isolasi data, Sanctum Bearer, registrasi aman, verifikasi UAT |
| 8 | Peta Alur Swimlane | peran × fase, QA & Siber paralel |
| 9 | State Machine Status | 4 pita fase + revisi + terminal |
| 10 | Fase 1 & Kanban | Fase 1 + 5 status task |
| 11 | SIT | gate → 3 tahap → sign-off wajib dokumen |
| 12 | QA & Siber | 2 jalur × 4 langkah, rilis butuh keduanya PASSED |
| 13 | UAT | minor vs mayor + persetujuan individual |
| 14 | Rilis & Quality Gate | pengajuan rilis → Head of IT → LIVE_PRODUCTION |
| 15 | Model Data (ERD) | hub projects + master + anak |
| 16 | Tangkapan Layar | 6 placeholder berlabel |
| 17 | Progres Saat Ini | selesai vs belum ditetapkan + snapshot kualitas |
| 18 | Penutup | 3 nilai utama + tanya jawab (slide gelap) |

Detail lengkap tiap slide dan seluruh tabel data ada di **`NagariSDLC-Materi.pdf`** (Bagian C dan Bagian D).
