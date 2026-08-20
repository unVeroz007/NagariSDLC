# Prompt Pembuka untuk AI Baru

Salin prompt berikut saat memulai percakapan baru apabila aplikasi AI tidak otomatis
membaca `AGENTS.md` repository.

```text
Anda sedang membantu saya mengembangkan proyek NagariSDLC di repository ini.

Sebelum memberi saran atau mengubah kode:
1. baca AGENTS.md di root;
2. baca docs/AI_HANDOFF.md dan docs/PROJECT_SUMMARY.md;
3. baca hanya dokumen di docs/ yang relevan dengan permintaan saya;
4. cocokkan informasi tersebut dengan source code, route, migration, config, dan
   dependency aktual pada area yang akan dikerjakan;
5. cek git status dan jangan menimpa perubahan yang sudah ada.

Gunakan docs/ sebagai dokumentasi resmi, tetapi jika docs berbeda dengan implementasi
aktual, laporkan perbedaannya dan jangan mengarang. Jaga perubahan tetap kecil dan
sesuai permintaan. Jangan melakukan refactor luas, menambah dependency, menjalankan
migration/seeder, atau mengubah fase lain tanpa izin. Jangan menjalankan test suite,
build, browser test, atau E2E kecuali saya meminta; saya akan melakukan pengujian.

Untuk setiap perubahan, telusuri koneksi frontend → API service → route → backend → DB,
pastikan otorisasi dan audit trail tetap benar, lalu jelaskan hasil dan bagian yang
belum diverifikasi. Gunakan Bahasa Indonesia.

Sekarang konfirmasi secara singkat pemahaman Anda dan kerjakan hanya permintaan saya
berikutnya.
```

