# Prompt integrasi SIGNAL untuk Google AI Studio

Gunakan file dalam paket ini sebagai **baseline visual dan frontend**, bukan sebagai pengganti aturan domain SIGNAL.

## Tujuan
Integrasikan bahasa visual SIGNAL ke aplikasi scheduler madrasah yang sudah ada. Pertahankan fungsi, data, struktur domain, alur kerja, dan perilaku fitur existing. Audit dahulu source code dan buat daftar komponen yang akan disentuh sebelum mengubahnya.

## Bahasa visual final
- Premium yang hemat implementasi: sederhana, mudah dirawat, ringan, konsisten.
- Warna utama forest/teal green, warm ivory, sage, dan aksen brass/gold yang sangat terbatas.
- Tipografi jelas dan lebih mudah dibaca; utamakan hierarki informasi, tabel, dan whitespace yang efisien.
- Panel datar dengan garis halus, radius terukur, dan shadow ringan.
- **Jangan gunakan Bento Grid sebagai bahasa layout.**
- Jangan gunakan glassmorphism, glow berlebihan, bevel, skeuomorphism, dekorasi ornamental berlebihan, atau pola AI-slop generik.
- Jangan menggunakan ikon emoji.

## Ilustrasi orisinal
Gunakan aset lokal di `assets/`:
- `signal-campus-premium.svg`: kampus sekolah kontemporer untuk hero dan banner.
- `signal-campus-sidebar.svg`: detail vertikal fasad sekolah untuk sidebar.
- `signal-campus-detail.svg`: crop arsitektur untuk area alokasi.
- `signal-generator-workflow.svg`: operator yang sedang menyusun jadwal untuk proses generator.

Ilustrasi menggambarkan bangunan sekolah/madrasah modern, bukan masjid. **Dilarang menambahkan kubah, menara, mihrab, atau menjadikan masjid sebagai bangunan utama.** Jangan mengganti aset ini dengan gambar stok atau SVG generik. Reuse secukupnya, jangan menempelkan ilustrasi yang sama di setiap kartu.

## Batasan fungsi dan domain
- Jangan menghapus atau mengubah aturan generator jadwal, validator deterministik, data model, penyimpanan, ekspor, atau versi.
- Jangan membangun fitur kehadiran/absensi baru. Hanya poles UI fitur Presensi Guru yang memang sudah ada.
- Jangan membuat AI assistant baru. Integrasi Gemini, bila sudah ada, tetap opsional dan tunduk pada validator/aturan keras.
- Bedakan dengan jelas data demo dari data operasional.
- Jangan menganggap mockup statis sebagai fungsi yang sudah berjalan. Jangan mengarang hasil, angka, status, atau sinkronisasi.
- Jangan mengklaim autentikasi, privasi, backup cloud, atau sinkronisasi lintas perangkat bila belum didukung.
- Pertahankan penggunaan hari Jumat dan seluruh hari aktif sesuai konfigurasi workspace.
- Jangan campur urutan aktivitas dengan nomor JP KBM. Aktivitas non-KBM tidak dihitung sebagai JP KBM.
- Drag/drop, edit manual, publish, restore, dan ekspor harus tetap menjalankan validasi domain yang sudah ada.

## Instruksi implementasi
1. Petakan source dan jalankan test/build yang tersedia sebelum mengubahnya.
2. Terapkan token, shell/sidebar, header, hero, dan ilustrasi ke komponen existing secara bertahap.
3. Terapkan visual baru pada jadwal, generator, validasi, master data, alokasi, beban guru, presensi, riwayat, ekspor/backup, dan pengaturan tanpa mengubah domain behavior.
4. Pastikan tabel tetap tabel (bukan kartu), body tidak horizontal-scroll, dan overflow bila perlu hanya lokal di tabel.
5. Pastikan navigasi, keyboard, focus state, responsif desktop/mobile, dan kontras cukup.
6. Jalankan test/build dan catat hasil apa adanya. Jangan menandai test sukses bila belum dijalankan.

## File yang perlu dijaga
- `index.html`, `styles.css`, `app.js` adalah prototype dashboard terpisah.
- `SIGNAL-Dashboard-Standalone.html` adalah versi satu file untuk preview cepat.
- `assets/` berisi gambar lokal dan SVG asli.
