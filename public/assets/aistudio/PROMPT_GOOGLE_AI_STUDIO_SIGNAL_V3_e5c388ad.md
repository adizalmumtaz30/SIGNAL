# MASTER PROMPT — REDESIGN SIGNAL V3 DI GOOGLE AI STUDIO

Anda bertindak sebagai **Principal Product Designer, Senior UX Engineer, dan Senior React/TypeScript Engineer**. Tugas Anda adalah melakukan redesign visual dan UX aplikasi SIGNAL yang sudah ada, berdasarkan repo dan dokumen referensi yang diberikan. Ini adalah **redesign aplikasi existing**, bukan membuat produk baru dari nol.

## 0. DOKUMEN DAN FILE YANG WAJIB DIBACA

Baca seluruh isi file berikut sebelum mengubah kode:
1. `design.md` — spesifikasi produk, aturan bisnis, design system V3, dan detail setiap fitur.
2. `SIGNAL_V3_Mockup_Atlas.html` — atlas 24 plate visual.
3. `RESEARCH_METHODS.md` — metode desain premium dan UX yang menjadi dasar arah visual.
4. `README_SIGNAL_V3.md` — petunjuk membaca paket.
5. Rekaman `Recording 2026-11-05 101258.mp4` — kondisi aplikasi existing dan alur nyata.
6. Referensi visual yang disediakan user (video inspirasi dashboard, pasangan font, dan file desain/referensi lainnya).
7. Seluruh source code repo SIGNAL, termasuk package scripts, routes/pages, components, hooks, services, IndexedDB schemas, data models, generator, validator, PDF export, backup/restore, dan tests.

Jika file tidak tersedia di environment, sebutkan dengan jelas. Jangan berpura-pura sudah membacanya.

## 1. PERINGATAN TERPENTING: ATLAS BUKAN BERANDA

Mockup HTML adalah **VISUAL REFERENCE ATLAS** dengan 24 plate yang berdiri sendiri. HANYA PLATE 01 berjudul `Beranda — Command Overview` yang merupakan Beranda aplikasi.

Pemetaan yang wajib diikuti:
- Plate 01: Beranda (route).
- Plate 02–04: Jadwal Pelajaran (mode matriks, mode per kelas, dialog/side panel edit slot).
- Plate 05: Kebutuhan & Alokasi JP (route).
- Plate 06: Schedule Generator (route).
- Plate 07: Validasi & Konflik (route).
- Plate 08: Beban Guru (route).
- Plate 09–11: tiga tab di dalam Data Master (Kelas/Rombel, Guru, Mata Pelajaran), bukan tiga route baru kecuali struktur source memang begitu.
- Plate 12–16: lima tab di dalam Presensi Guru (Harian, Massal Bulanan, Per Guru, Rekap & PDF, Hari Libur), bukan lima route baru.
- Plate 17: Riwayat / versi jadwal.
- Plate 18: dialog/flow ekspor PDF, bukan route dashboard.
- Plate 19: Backup & Restore Lokal (sesuaikan dengan struktur source existing).
- Plate 20–22: tiga tab Pengaturan Workspace (Hari & Jam, Identitas Madrasah, Integrasi Gemini).
- Plate 23: component/state library, dokumentasi visual saja, BUKAN halaman aplikasi.
- Plate 24: responsive adaptation reference, BUKAN halaman aplikasi.

**JANGAN** menaruh seluruh isi plate menjadi satu homepage. **JANGAN** menambahkan navigation menu `Plate 01–24` ke aplikasi produksi. Navigasi atlas hanya alat preview pada file mockup. Implementasikan plate pada route/tab/dialog/komponen yang benar-benar sesuai dengan source.

## 2. TUJUAN DAN SYARAT MUTLAK

Hasil akhir harus memenuhi ketiga tuntutan berikut secara bersamaan:

### A. Sederhana dan cepat digunakan
- Tidak rumit, bertele-tele, panjang, ribet, banyak klik, banyak scroll, sulit dipahami, lambat, atau tidak responsif.
- Setiap layar menjawab dalam 3–5 detik: pengguna sedang berada di bagian apa, status saat ini apa, dan tindakan berikutnya apa.
- Kurangi langkah, bukan kemampuan. Jangan menghapus fitur atau opsi demi menyederhanakan tampilan.
- Letakkan tindakan utama dalam jangkauan. Hindari modal bertingkat dan berpindah halaman tanpa alasan.
- Gunakan tabel/matriks untuk data yang memang berbentuk tabel/matriks, jangan mengubah semua data menjadi kartu.
- Minimalkan scroll halaman; tabel lebar boleh scroll di dalam container dengan header/kolom penting tetap terlihat.

### B. Bahasa untuk operator awam
- Gunakan Bahasa Indonesia yang pendek, lugas, konkret, dan familiar.
- Hindari paragraf panduan di layar. Tampilkan label, status, instruksi pendek, dan feedback yang cukup.
- Hindari jargon. Jika istilah teknis memang bagian dari produk (misalnya JP, Jam ke-, solver), pertahankan istilah domain dengan label yang konsisten.
- Contoh microcopy: `Jadwal belum terbit`, `Periksa 3 konflik`, `Pilih kelas`, `Simpan perubahan`, `Tidak ada data`, `Coba lagi`.
- Satu tombol satu kata kerja yang jelas. Hindari nama aksi yang panjang dan ambigu.

### C. Luxury premium wajib terlihat di seluruh aplikasi
- Arah desain bernama **EXPRESSIVE JEWEL LUXURY — THE GRAND ACADEMIC ATELIER**.
- BUKAN quiet luxury, bukan monokrom, bukan template dashboard SaaS generik.
- Kemewahan harus tampak di seluruh route, tab, dialog, modal, tabel, status, form, hover, focus, loading, empty state, toast, export preview, dan detail kecil.
- Gunakan warna permata yang kaya dan kontras terarah: Heritage Night/Emerald, Jade, Midnight Blue, Deep Plum, Muted Plum, Warm Ivory, Antique Gold.
- Gunakan Fraunces display yang terlihat kuat dan Inter untuk keterbacaan operasional.
- Pakai komposisi unik sesuai karakter setiap fitur. Jangan menyalin satu template ke semua halaman.
- Gunakan gold hairline, monogram SIGNAL, nomor/section marker editorial, inset surface, kontras dark-vs-paper, status premium, icon stroke konsisten, dan motion terukur.
- Jangan membuatnya norak: tidak ada neon, glow berlebihan, gradient di mana-mana, glassmorphism, bevel palsu, ornamen tanpa fungsi, emoji sebagai ikon, atau bento card berulang.
- Visual yang kaya tidak boleh mengurangi kontras, ukuran teks, kepadatan data yang wajar, atau kecepatan.

## 3. PALET DAN TOKENS YANG HARUS DIKUNCI

Gunakan nilai berikut dari `design.md` sebagai token global, bukan nilai acak per komponen:
- Heritage Night `#173D32`
- Heritage Green `#245748`
- Heritage Hover `#326B57`
- Emerald Jewel `#2D8066`
- Jade `#5F8D79`
- Midnight Blue `#334F70`
- Dusty Blue `#748DA6`
- Deep Plum `#4C3455`
- Muted Plum `#927D98`
- Antique Gold `#B39A68`
- Gold Light `#E5C97A` (hanya aksen di surface gelap)
- Warm Ivory `#F7F4ED`
- Paper `#FFFEFA`
- Warm Stone `#E9E4DC`
- Soft Sage `#E2EAE1`
- Ink `#26352F`
- Ink Muted `#41524A`
- Border `#DDDCD3`

Semantic status tetap:
- success `#286047` / `#E8F1EA`
- warning `#855820` / `#F5EEDD`
- danger `#8B403C` / `#F6E9E6`
- info `#365E79` / `#EAF0F5`
- neutral `#526057` / `#ECEEE9`

Jangan pakai gold untuk teks kecil di atas ivory. Pastikan warna foreground lolos contrast check. Status harus punya teks/icon, jangan hanya warna.

## 4. METODE DESAIN YANG WAJIB DITERAPKAN

1. Signature color architecture: emerald sebagai identitas, plum/blue/jade menjadi aksen fitur dengan semantik visual yang stabil.
2. Typographic hierarchy: Fraunces untuk display identity, Inter untuk seluruh task UI; gunakan skala tipografi yang konsisten.
3. Material contrast: dark jewel hero/shell + paper workspace + warm background. Kedalaman terbatas dan disengaja.
4. Art-directed composition: matriks untuk jadwal, comparison/table untuk workload, issue list untuk validasi, solver status panel untuk generator, segmented settings untuk konfigurasi.
5. Craft micro-detail: emblem, keyline, nomor plate, selected edge, focus ring, table alignment, state transitions, dan toast.
6. Purposeful motion: 120–180ms untuk hover/selection; 180–240ms untuk overlay/panel. Jangan animasikan angka/progress secara palsu.
7. Frictionless journey: kurangi context switching, simpan state filter yang relevan, gunakan bulk action yang aman, inline action bila cocok.
8. Performance: hindari blur berat, video background, 3D, efek besar, render seluruh data tabel tanpa kebutuhan, dan library animasi hanya untuk dekorasi.
9. Systemic consistency: grid, controls, labels, focus, status, dan icon konsisten; komposisi tiap route tetap dapat berbeda.
10. Readability first: hierarchy/kontras/keyboard/accessibility tidak dapat ditukar dengan ornamen.

## 5. FITUR DAN SCREEN COVERAGE — JANGAN ADA YANG TERLEWAT

Gunakan bab screen-by-screen di `design.md` dan mapping 24 plate. Minimal pastikan audit dan redesign untuk:
1. Beranda.
2. Jadwal Pelajaran: Matriks Seluruh Kelas, Editor Per Kelas, edit slot, zoom, filter, status draft/valid, pemeriksaan, publish, export, activity/non-KBM.
3. Kebutuhan & Alokasi JP.
4. Schedule Generator: proses, kandidat, status solver, hasil yang bisa dipilih sebagai draft.
5. Validasi & Konflik: hard errors dan warnings serta tautan ke lokasi sumber.
6. Beban Guru: data JP aktual, jam astronomis, batas mingguan, persentase, distribusi hari, total sesi, PDF per guru.
7. Data Master: Kelas/Rombel, Guru, Mata Pelajaran.
8. Presensi Guru: Harian, Massal Bulanan, Per Guru, Rekap & PDF, Hari Libur.
9. Riwayat dan versi jadwal.
10. Semua opsi ekspor PDF jadwal.
11. Backup dan Restore Lokal jika memang existing.
12. Pengaturan Hari Aktif & Jam Kegiatan, Identitas Madrasah, Integrasi Gemini.
13. Global states: loading, empty, error, success, warning, disabled, hover, active, focus, confirmation, responsive.

Sebelum implementasi, buat feature parity matrix: fitur/aksi existing → source file/service/handler → plate referensi → komponen UI baru → test. Jangan mengasumsikan bahwa screenshot/mockup mencakup semua field/data. Field yang tidak tampak harus diambil dari source code, bukan dikarang.

## 6. ATURAN BISNIS TIDAK BOLEH BERUBAH

- Penyimpanan local-first berbasis IndexedDB. Jangan menambahkan shared cloud database atau auto-sync.
- Gemini opsional/off secara default. Gemini tidak menggantikan validator atau solver deterministic, tidak mengesahkan atau menerbitkan jadwal.
- Hari aktif Senin–Sabtu. Jumat tetap hari belajar.
- Batas awal 10 JP KBM per hari, configurable per hari.
- `Jam ke-` tidak sama dengan jumlah `JP KBM`; istirahat/non-KBM tidak dihitung sebagai JP KBM.
- Maksimal 3 JP mapel sama berturut-turut per kelas/hari adalah hard constraint. Preferensi 2 JP blok adalah soft preference.
- Aturan pasca-istirahat guru multi-mapel: 1 JP sebelum istirahat → maksimal 3 JP setelah; 2 JP sebelum → maksimal 2 JP setelah; 3 JP sebelum → maksimal 1 JP setelah. Segmen pra-istirahat dari guru berbeda tidak boleh digabung.
- Slot KBM, Upacara, Istirahat, Religi/Dhuha, Kegiatan Lain tetap terbedakan. Blocking non-KBM tidak dapat ditimpa.
- Status generator `SEARCH_LIMIT_REACHED` tidak sama dengan `INFEASIBLE`.
- Kandidat terpilih hanya menjadi draft. Edit, publish dan restore harus revalidate.
- Publish membuat snapshot/version lokal dan memverifikasi versi aktif.
- Drag/drop wajib validate sebelum commit; aksi invalid ditolak. Sediakan cara alternatif keyboard/form.
- Beban guru dihitung dari jadwal aktual.
- PDF mempertahankan semua scope dan opsi existing, tanpa clipping.
- Backup/restore tetap lokal.
- Jangan membuat AI assistant baru. Jangan menambah fitur presensi/attendance baru. Redesign hanya UI/UX modul presensi yang ada.

## 7. PROSEDUR KERJA YANG WAJIB

### Tahap 1 — Audit source dan baseline
- Baca seluruh repo dan rekam route, page, component, store, service, IndexedDB, generator, validator, export, backup, tests.
- Catat seluruh aksi dan field yang benar-benar ada.
- Catat masalah UX saat ini dan potensi regression.
- Buat feature parity matrix sebelum mengubah file.

### Tahap 2 — Design system dan shell
- Buat tokens V3 terpusat.
- Bangun sidebar, header, content canvas, typography, buttons, forms, table, tabs, status, dialog, toast, empty/error/loading states.
- Verifikasi responsive awal.

### Tahap 3 — Core scheduling
- Implement plate 02–04: matrix, per-class editor, slot edit.
- Pastikan semua event/handlers tetap memakai service/domain function existing.
- Validasi target sebelum commit; keyboard alternative tetap ada.

### Tahap 4 — Planning and decision screens
- Implement plate 05–07: alokasi, generator, validasi.
- Jangan mengubah engine, status mapping, solver, atau hard/soft constraints.

### Tahap 5 — Overview, workload, master
- Implement plate 01 dan 08–11.
- Pastikan hanya plate 01 menjadi Beranda.

### Tahap 6 — Presensi Guru
- Implement plate 12–16 di dalam modul Presensi yang existing.
- Jangan menambah tipe/status/action di luar kontrak source.

### Tahap 7 — Riwayat, export, settings
- Implement plate 17–22 sebagai route/tab/dialog/flow yang sesuai existing.
- Pertahankan semua opsi PDF. Pastikan backup restore local-first.

### Tahap 8 — Responsive, polish, QA
- Terapkan plate 23–24 untuk konsistensi komponen dan layout.
- Jalankan semua tests, typecheck, lint, build, manual route test, keyboard test, resize test.
- Bandingkan semua fitur dengan parity matrix.

## 8. LARANGAN IMPLEMENTASI

- Jangan mengganti app dengan static HTML atau prototype.
- Jangan menaruh atlas preview/plate selector pada aplikasi produksi.
- Jangan menjadikan semua fitur satu homepage atau bento dashboard.
- Jangan menyederhanakan dengan menghilangkan fitur, field, menu, tab, opsi, atau export scope.
- Jangan mengubah perhitungan, schema, aturan generator/validator, status solver, IndexedDB, publish/restore, atau presensi.
- Jangan membuat data palsu di production. Data contoh hanya untuk mockup/test.
- Jangan hardcode data yang seharusnya dibaca dari IndexedDB.
- Jangan membuat link/tombol dekoratif tanpa handler.
- Jangan menyatakan fitur berhasil bila tidak diuji.

## 9. DEFINITION OF DONE

- 100% feature parity yang dapat dibuktikan lewat parity matrix. Gap dilaporkan, bukan disembunyikan.
- Semua 10 nav destinations existing tetap aktif dan seluruh sub-tab/aksi existing dapat dijalankan.
- UI premium terlihat di setiap modul, bukan hanya homepage.
- Navigasi, label, dan CTA pendek dan dimengerti operator non-teknis.
- Tugas inti tidak bertambah langkah tanpa alasan keselamatan/validasi.
- Jadwal/matriks dapat dipakai pada desktop dan tablet; layar kecil punya fallback yang usable.
- Semua status punya feedback; tombol punya loading/disabled state yang tepat.
- Typecheck, lint, test, build lulus; setiap kegagalan disebutkan jujur.
- Jalankan test regressi khusus: Jumat aktif; JP vs Jam ke; batas mapel berturut; aturan guru pasca-istirahat; blocking activity; SEARCH_LIMIT_REACHED vs INFEASIBLE; candidate→draft; edit/publish/restore revalidate; publish snapshot; attendance records; export PDF scope/options; backup/restore IndexedDB.
- Sertakan laporan semua file yang diubah, tests yang dijalankan, hasil, gap yang diketahui, dan screenshot halaman core.

**Prioritas tertinggi:** pertahankan sistem SIGNAL yang sudah bekerja, ubah seluruh pengalaman visual menjadi Expressive Jewel Luxury yang khas dan premium, serta buat setiap pekerjaan operator lebih ringkas dan mudah dipahami.
