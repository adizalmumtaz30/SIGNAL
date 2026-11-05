# SIGNAL — Smart Islamic School Scheduler

Paket ini berisi dashboard frontend SIGNAL yang sudah diperbarui dengan sistem ilustrasi arsitektur sekolah khusus.

## Jalankan versi source
1. Ekstrak ZIP.
2. Buka folder `SIGNAL_AI_Studio_Premium`.
3. Buka `index.html` di browser, atau jalankan server lokal:
   ```bash
   python -m http.server 8000
   ```
4. Buka `http://localhost:8000`.

Struktur:
- `index.html` — markup dashboard.
- `styles.css` — desain responsif, tema, dan styling.
- `app.js` — interaksi demo (toast, navigasi aktif, tema, pencarian, filter presensi).
- `assets/` — aset lokal, termasuk ilustrasi SVG orisinal.
- `SIGNAL-Dashboard-Standalone.html` — satu file mandiri dengan CSS, JS, dan aset ter-embed.
- `mockup/SIGNAL-Premium-Dashboard-Mockup-Concept.png` — visual mockup konsep untuk arah desain (bukan screenshot hasil render browser).

## Ilustrasi yang diterapkan
- `signal-campus-premium.svg` — ilustrasi kampus utama; dipakai pada hero dashboard dan banner kampus.
- `signal-campus-sidebar.svg` — crop vertikal khusus untuk area sidebar.
- `signal-campus-detail.svg` — potongan fasad untuk kebutuhan dan alokasi.
- `signal-generator-workflow.svg` — ilustrasi proses operator menyusun jadwal untuk kartu generator.

Ilustrasi SVG dibuat khusus untuk SIGNAL: bangunan sekolah kontemporer bertingkat, fasad kaca, sirip arsitektural, kanopi, halaman, paving, pepohonan, dan figur manusia. Tidak menggunakan siluet masjid, kubah, atau menara.

## Status implementasi
Ini adalah dashboard frontend/prototype. Angka, nama, dan isi tabel adalah data contoh statis. Tombol dan menu memiliki interaksi demo, belum dihubungkan ke database, autentikasi, generator jadwal deterministik, validator domain, ataupun ekspor operasional SIGNAL. Jangan gunakan data contoh sebagai catatan sekolah nyata.

## Impor ke Google AI Studio

Paket ZIP ini adalah paket source yang sudah diekstrak/diterapkan dan siap dijadikan bahan proyek. Dokumentasi resmi AI Studio saat ini menjelaskan alur impor kode yang ada melalui GitHub (Build mode → menu Add files / `+` → Import from GitHub), bukan tombol impor ZIP langsung.

Cara yang paling pasti:
1. Ekstrak ZIP ini di komputer Anda.
2. Masukkan isi folder proyek ke repository GitHub.
3. Buka Google AI Studio → Build.
4. Pada kotak prompt, pilih menu `+` → `Import from GitHub`, lalu pilih repository tersebut.
5. Buka `AI_STUDIO_IMPORT_PROMPT.md` dan gunakan prompt itu sebagai instruksi integrasi.

Jika UI akun Anda menyediakan unggah file atau konteks file tambahan, Anda juga dapat melampirkan `SIGNAL-Dashboard-Standalone.html` dan `assets/` sebagai bahan referensi. Jangan menganggap paket ZIP ini sebagai aplikasi React/full-stack yang siap deploy; ini adalah frontend prototype vanilla HTML/CSS/JS.

Dokumentasi resmi: https://ai.google.dev/gemini-api/docs/aistudio-build-mode
