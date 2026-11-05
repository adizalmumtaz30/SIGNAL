# SIGNAL — Design System & Product Redesign Specification

**Versi:** 3.0 · Expressive Jewel Luxury — The Grand Academic Atelier  
**Status:** Arah visual disetujui; spesifikasi desain dan mockup interaktif  
**Tanggal dokumentasi:** 5 November 2026  
**Basis utama:** rekaman `Recording 2026-11-05 101258.mp4` (156,3 detik), aturan domain SIGNAL yang telah diberikan, serta referensi desain `SIGNAL_Daftar_Referensi_Desain.md` dan aset visual yang diunggah.

> Dokumen ini adalah spesifikasi UI/UX dan handoff implementasi. Ini bukan audit source code dan bukan bukti bahwa semua perilaku produksi sudah berjalan di mockup. Semua data di HTML adalah data demonstrasi. Integrasi harus dipetakan ke fungsi, service, state, dan skema IndexedDB yang sudah ada.

---

## 0. Ringkasan arah produk

SIGNAL adalah aplikasi penjadwalan sekolah/madrasah yang mengelola data master, kebutuhan dan alokasi JP, penyusunan jadwal, validasi konflik, beban guru, presensi guru, riwayat, ekspor, dan konfigurasi waktu sekolah. Antarmuka harus membantu operator menyelesaikan pekerjaan administratif dengan cepat dan percaya diri—bukan menjadi dashboard promosi atau kumpulan kartu statistik.

### Arah desain final

**Expressive Jewel Luxury — The Grand Academic Atelier.** SIGNAL harus langsung terasa premium, kaya warna, berkelas, berani, dan modern—bukan quiet luxury. Karakter hadir lewat emerald dalam, plum, midnight blue, jade, ivory hangat, dan aksen antique gold; lewat tipografi editorial yang tegas; komposisi layar yang khas; material visual yang terasa berlapis; dan detail mikro yang konsisten. Kekayaan visual tidak boleh mengganggu pembacaan jadwal, angka, atau tugas operator.

- **Heritage Night / Heritage Green** memberi jangkar identitas, shell premium, navigasi, dan tindakan utama.
- **Emerald Jewel / Jade** memberi energi, progress, pilihan aktif, serta highlight visual yang kuat.
- **Midnight Blue / Dusty Blue** membedakan kelompok informasi, analitik, atau state yang sesuai.
- **Deep Plum / Muted Plum** menjadi aksen karakter pada panel fitur tertentu, bukan ornamen acak.
- **Antique Gold** menjadi detail craft: keyline, nomor plate, emblem, separator, ikon kecil, dan fokus momen penting. Bukan teks kecil pada latar terang.
- **Warm Ivory / Paper / Warm Stone / Soft Sage** menyeimbangkan warna permata dan menjaga ruang kerja lama tetap nyaman.

### Prinsip keputusan

1. **Fungsi sebelum ornamen.** Setiap warna, garis, label, dan gerakan harus membantu pengguna memahami data atau melakukan tindakan.
2. **Data-first, bukan card-first.** Jadwal, alokasi, master data, dan beban guru memakai tabel atau matriks sebagai format utama.
3. **Luxury yang berguna.** Setiap layar punya karakter premium yang terlihat; ornamen tidak menghalangi tugas dan tidak menambah langkah.
4. **Satu sumber kebenaran.** Validasi detail berada pada satu modul otoritatif; ringkasan lain hanya tautan/konteks ke laporan yang sama.
5. **Tidak mengubah domain.** Tampilan baru tidak boleh mengubah generator, validator, aturan jadwal, perhitungan, penyimpanan, publikasi, presensi, atau ekspor.
6. **Tidak ada AI slop.** Tidak ada hero besar yang kosong, gradient berlebihan, glassmorphism, ikon acak, bento berulang, grafik dekoratif, atau label yang ramai.

---

## 1. Inventaris sumber dan tingkat kepastian

### 1.1 Yang terlihat langsung pada rekaman

Rekaman SIGNAL terbaru berdurasi **156,3 detik** pada tampilan desktop 1918 × 900. Pengamatan frame mencakup:

- Sidebar dengan 10 tujuan: Beranda, Jadwal Pelajaran, Kebutuhan & Alokasi, Schedule Generator, Validasi & Konflik, Beban Guru, Data Master, Presensi Guru, Riwayat & Ekspor, Pengaturan.
- Header global yang menampilkan Tahun Ajaran, Semester, notifikasi, dan profil operator.
- Beranda berisi status jadwal, statistik alokasi KBM, status keterisian per rombel, dan pintasan generator.
- Pengaturan Workspace dengan tab Hari Aktif & Jam Kegiatan, Identitas Madrasah, Integrasi AI (Gemini); ringkasan hari belajar, total JP KBM mingguan, durasi standar JP, waktu astronomis, hari aktif Senin–Sabtu, serta daftar slot kegiatan.
- Dialog ekspor PDF yang menampilkan empat cakupan: Semua Kelas (1 Halaman A4), Per Rombel Kelas, Matriks Master, dan Jadwal Guru.
- Pilihan ukuran A4/F4, opsi tata letak, target kelas/guru sesuai cakupan, warna sel kode mapel, pemadatan nama, kop surat resmi, rekapitulasi JP dan kolom TTD, serta kustomisasi teks dokumen.
- Workspace Jadwal dengan dua mode Matriks Seluruh Kelas dan Editor Per-Kelas, status draft/valid, pemeriksaan jadwal, terbitkan jadwal, ringkasan metrik, filter, opsi warna mapel/nama singkat, zoom, dan matriks Senin–Sabtu berisi slot KBM dan non-KBM.
- Kebutuhan & Alokasi dengan ringkasan kebutuhan, kapasitas KBM, keseimbangan, status rombel, peringatan real-time, monitor kapasitas kelas, pencarian, tabel alokasi, serta aksi baris.
- Schedule Generator dengan ringkasan target alokasi, kapasitas slot, rombel aktif, kandidat tersimpan, status solver, hasil penyusunan, dan daftar kandidat untuk diterapkan.
- Validasi & Konflik dengan ringkasan kepatuhan, konflik keras, peringatan lemah, status kelayakan, dan daftar masalah.
- Beban Guru dengan filter guru/kelas/mapel, pencarian, serta kolom beban JP, jam astronomis, batas mingguan, persentase, distribusi hari Senin–Sabtu, total sesi, dan aksi PDF per guru.
- Presensi Guru dengan ringkasan kehadiran dan lima tab: Harian, Massal Bulanan, Per Guru, Rekap & PDF, Hari Libur. Tab Harian berisi tanggal, cari guru, filter status, set semua hadir, simpan presensi, status kehadiran, dan catatan; Hari Libur berisi tanggal, nama/keterangan, pencarian dan tabel.

### 1.2 Aturan domain yang harus diperlakukan sebagai kontrak

Aturan berikut berasal dari konteks dan spesifikasi SIGNAL yang telah diberikan, bukan kesimpulan dari tampilan visual:

- Penyimpanan bersifat **local-first menggunakan IndexedDB**. Tidak boleh mengasumsikan sinkronisasi cloud otomatis atau database bersama.
- Gemini bersifat opsional dan nonaktif secara default. AI tidak boleh menggantikan validator deterministik atau mengesahkan/menerbitkan jadwal.
- Hari belajar aktif Senin–Sabtu; **Jumat tetap hari belajar**.
- Maksimal awal 10 JP KBM per hari dan dapat dikonfigurasi per hari.
- Nomor urut jam kegiatan tidak selalu sama dengan nomor JP KBM. Istirahat/non-KBM tidak dihitung sebagai JP KBM.
- Maksimum 3 JP berturut-turut mapel yang sama pada kelas/hari adalah aturan keras; preferensi blok 2 JP adalah aturan lunak.
- Aturan guru multi-mapel setelah istirahat harus dipertahankan: 1 JP sebelum istirahat → maksimal 3 JP setelah; 2 JP sebelum → maksimal 2 JP setelah; 3 JP sebelum → maksimal 1 JP setelah. Urutan pra-istirahat dari guru berbeda tidak boleh digabung sebagai satu konteks.
- Jenis slot: KBM/Belajar Mengajar, Upacara, Istirahat, Religi/Dhuha, Kegiatan Lain. Slot non-KBM yang bersifat blocking tidak boleh ditimpa.
- Status generator mencakup `QUEUED`, `RUNNING`, `SUCCESS`, `INFEASIBLE`, `SEARCH_LIMIT_REACHED`, `INVALID_INPUT`, `CANCELLED`, `FAILED`. `SEARCH_LIMIT_REACHED` bukan `INFEASIBLE`.
- Kandidat yang dipilih menjadi draft; perubahan, publikasi, dan restore harus divalidasi ulang.
- Publish membuat snapshot/versi lokal dan memverifikasi versi aktif.
- Validator deterministik tetap otoritatif. Drag/drop memvalidasi target sebelum commit; aksi yang tidak valid ditolak dan harus tersedia alternatif keyboard/form.
- Beban guru dihitung dari jadwal yang benar-benar terisi, bukan angka dekoratif.
- Ekspor profesional mempertahankan cakupan sekolah/kelas/guru, A4, F4 jika sudah tersedia, dan semua opsi dokumen produksi.
- Backup/restore tetap lokal. Tidak boleh memberi kesan ada sinkronisasi otomatis.
- Tidak menambah asisten AI, fitur absensi baru, atau modul yang tidak diminta.

### 1.3 Belum dapat dibuktikan dari rekaman

Rekaman tidak membuktikan perilaku keyboard/screen reader, fokus modal, tampilan ponsel, kecepatan, jumlah klik aktual, kualitas pagination PDF, integritas data, akurasi generator, isi skema IndexedDB, atau keseluruhan field Data Master/Riwayat yang ada di source. Bagian yang tidak terbaca harus diaudit pada repository sebelum implementasi. Mockup menggunakan pola representatif untuk layar yang tidak terlihat utuh.

---

## 2. Design tokens — V3 Expressive Jewel Luxury

### 2.1 Palet warna utama

| Token | Hex | Fungsi |
|---|---|---|
| `heritage-night` | `#173D32` | Sidebar, header gelap, hero utama |
| `heritage-green` | `#245748` | Brand utama, navigasi, tombol primer |
| `heritage-hover` | `#326B57` | Hover, focus action |
| `emerald-jewel` | `#2D8066` | Hero aksen, selected state, visual penting |
| `jade` | `#5F8D79` | Aksen sekunder, progres, data aktif |
| `midnight-blue` | `#334F70` | Panel analitik / informasi khusus |
| `dusty-blue` | `#748DA6` | Aksen kelompok informasi |
| `deep-plum` | `#4C3455` | Panel editorial, generator, state khusus |
| `muted-plum` | `#927D98` | Aksen plum lembut, kategori |
| `antique-gold` | `#B39A68` | Keyline, emblem, angka kecil di bidang gelap, penanda premium |
| `gold-light` | `#E5C97A` | Aksen gold di bidang gelap saja |
| `warm-ivory` | `#F7F4ED` | Latar kerja |
| `paper` | `#FFFEFA` | Panel tabel / form |
| `warm-stone` | `#E9E4DC` | Surface sekunder |
| `soft-sage` | `#E2EAE1` | Surface terpilih, background halus |
| `ink` | `#26352F` | Teks utama di bidang terang |
| `ink-muted` | `#41524A` | Teks sekunder |
| `line` | `#DDDCD3` | Border halus |

### 2.2 Penggunaan warna dan kontras

- Dark jewel surfaces dipakai pada sidebar, top band, hero panel, generator status, dan panel sorotan—bukan di seluruh halaman sekaligus.
- Tiap modul memiliki satu warna karakter utama (lihat peta plate). Warna modul tidak mengubah arti status sistem.
- Gold adalah detail craft, bukan warna teks isi. Hindari gold pada teks kecil berlatar ivory karena kontrasnya rendah.
- Jade, dusty blue, dan muted plum di atas ivory dipakai sebagai bidang aksen atau border; teks di atasnya harus memakai foreground gelap yang terbukti terbaca.
- Status warna tetap semantik: success `#286047/#E8F1EA`; warning `#855820/#F5EEDD`; danger `#8B403C/#F6E9E6`; info `#365E79/#EAF0F5`; neutral `#526057/#ECEEE9`.
- Jangan memakai pelangi kategori. Warna mapel boleh berbeda sesuai data, tetapi label/abbr dan pattern tetap dibutuhkan agar warna bukan satu-satunya pembeda.

### 2.3 Tipografi

- Fraunces menjadi display serif utama: judul halaman, angka hero, nama modul, dan editorial micro-heading. Gunakan berat 500–700.
- Inter digunakan untuk seluruh antarmuka operasional: navigasi, label, tabel, filter, input, tombol, helper, toast, dan status.
- Judul halaman 30–36 px; angka hero 34–44 px; heading bagian 17–20 px; isi 14–15 px; tabel 13–14 px; label 12–13 px. Jangan mengorbankan ukuran tabel demi memaksakan kolom.
- Gunakan angka tabular untuk jam, JP, jumlah, rasio, dan persentase. Hindari ALL CAPS pada kalimat panjang.

### 2.4 Bentuk, material, dan detail premium

- Corner system: 8 px controls, 12 px panels, 16 px dialog, 20–24 px hero feature panel. Tidak semua komponen harus berbentuk card.
- Border: 1 px neutral; 1 px antique-gold hanya untuk keyline, focus moment, atau separator yang sengaja ditandai.
- Elevation: 3 tingkat saja—flat content, raised surface (tabel/dialog), hero/elevated popover. Tidak ada shadow besar untuk tiap card.
- Motif visual khas SIGNAL: monogram/emblem “S” geometris, nomor bagian editorial, garis gold tipis, corner tab, inset surface, dan jewel color-block. Semua motif harus membantu navigasi/identitas, tidak jadi wallpaper.
- Hindari glassmorphism, neon glow, gradient berlapis, bevel palsu, tekstur berat, icon emoji, serta bento card berulang.

### 2.5 Grid, ukuran, dan elevasi

| Properti | Default |
|---|---|
| Base spacing | 4 px |
| Content inset desktop | 24–28 px |
| Content inset tablet | 18–24 px |
| Content inset mobile | 14–16 px |
| Sidebar desktop | 248 px, dapat collapse |
| Main max width | 1660 px |
| Gaps | 8 / 12 / 16 / 20 / 24 / 32 px |
| Control height | 40–44 px |
| Table row | 44–52 px, sesuai density |
| Minimum hit target | minimal 24×24 px; target utama 40–44 px |

## 3. Arsitektur aplikasi dan shell global

### 3.1 Navigasi

Pertahankan semua sepuluh tujuan yang terlihat pada rekaman. Pengelompokan baru hanya memperjelas mental model—bukan menyembunyikan menu:

| Grup | Menu | Tujuan |
|---|---|---|
| Ringkasan | Beranda | Status operasional dan tindakan berikutnya |
| Perencanaan | Data Master | Data Kelas, Guru, Mata Pelajaran |
| Perencanaan | Kebutuhan & Alokasi | Kebutuhan JP, kapasitas, distribusi alokasi |
| Perencanaan | Schedule Generator | Proses penyusunan dan kandidat |
| Operasional | Jadwal Pelajaran | Matriks seluruh kelas dan editor per kelas |
| Operasional | Validasi & Konflik | Laporan validasi resmi |
| Guru | Beban Guru | Distribusi beban mengajar aktual |
| Guru | Presensi Guru | Lima tab presensi yang sudah ada |
| Kontrol & Sistem | Riwayat & Ekspor | Riwayat versi, ekspor, backup, restore |
| Kontrol & Sistem | Pengaturan | Hari aktif, slot jam, identitas, Gemini, preferensi |

**Tampilan sidebar:** Heritage Green sebagai bidang utama, menu aktif memakai bidang jade/ivory yang kontras dan jelas. Ikon satu keluarga (Lucide React yang sudah ada), stroke seragam 1.75–2 px. Label lengkap harus tetap terbaca; sidebar dapat collapse dengan tooltip dan nama aksesibel.

### 3.2 Header global

- Kiri: breadcrumb/identitas layar atau judul ringkas. Tidak menampilkan judul halaman dua kali.
- Kanan: Tahun Ajaran, Semester, indikator lokal (IndexedDB/local), notifikasi jika memang ada, profil operator.
- Tahun ajaran dan semester ditampilkan di shell saja; halaman tidak mengulang selector yang sama.
- Indikator penyimpanan lokal harus jujur: contoh `Tersimpan di perangkat ini`, bukan `Cloud synced`.

### 3.3 Struktur halaman

Setiap modul memakai pola yang konsisten:

1. Eyebrow/kicker opsional dengan fungsi konteks, bukan dekorasi.
2. Judul satu kali dan deskripsi yang menjelaskan tugas halaman.
3. Primary action maksimal satu dalam konteks lokal; aksi sekunder berupa outline/ghost.
4. Kontrol filter dan view dalam satu toolbar yang terkelompok.
5. Konten utama data-first.
6. State (loading, empty, error, saved, draft, warning) dekat dengan konten yang berkaitan.

### 3.4 Aturan pengulangan

- Validator detail: hanya di Validasi & Konflik. Dashboard/Jadwal/Alokasi hanya ringkasan dan link ke laporan yang sama.
- Generator run: tindakan utama di Schedule Generator. Akses dari Jadwal atau Alokasi hanya pintasan kontekstual menuju generator kanonis.
- PDF/CSV/Print: gunakan satu komponen flow ekspor bersama, context-aware; jangan buat implementasi berbeda.
- Ringkasan kapasitas: angka berasal dari query/state yang sama dengan tabel alokasi.
- Save: satu mekanisme simpan per kelompok konfigurasi yang logis dengan status unsaved/saving/saved/error yang jelas.

---

## 4. Spesifikasi komponen bersama

### 4.1 Buttons

- Primary: Heritage Green, teks putih, tinggi 40 px; untuk tindakan utama.
- Secondary: surface putih/ivory, border, teks ink.
- Outline: border jelas, untuk tindakan alternatif.
- Ghost: tanpa fill, untuk navigasi sekunder.
- Destructive: semantic danger dan konfirmasi bila berdampak luas.
- Icon-only: ukuran target minimum 36–40 px, accessible name dan tooltip.
- Konsistensi: satu ukuran tinggi per konteks, ikon rata baseline, tidak ada label terpotong.

### 4.2 Inputs, select, search, date picker

- Label selalu terlihat, tidak hanya placeholder.
- Helper text dan error berada dekat dengan field yang bersangkutan.
- Focus ring jelas, error bukan cuma border merah.
- Search dilengkapi kata kerja/objek, mis. `Cari kelas, mapel, atau guru…`.
- Filter menampilkan nilai aktif dan dapat di-reset tanpa menghilangkan konteks lain.

### 4.3 Badges dan status

Hanya status/categori bermakna. Jangan membuat badge untuk label biasa atau metadata yang bisa menjadi teks. Badge memiliki tinggi/padding sesuai teks dan tidak boleh memotong status penting.

### 4.4 Tables

- Header tetap terbaca; angka rata kanan atau disejajarkan konsisten.
- Hover halus, selected row jelas, action column terletak konsisten.
- Sorting memiliki penanda arah; filter terkait ditempatkan di toolbar.
- Scroll horizontal berada di dalam kontainer, bukan body.
- Empty state menjelaskan data yang belum ada dan satu tindakan berikutnya.

### 4.5 Dialog, drawer, toast

- Dialog untuk tugas fokus (edit slot, ekspor, konfirmasi publish/restore), bukan untuk seluruh aplikasi.
- Dialog memiliki judul, tujuan, aksi utama, batal, dan perilaku Escape/focus restore.
- Drawer untuk detail validasi atau informasi kontekstual tanpa kehilangan konteks jadwal.
- Toast hanya untuk feedback singkat; error penting tetap berada di halaman atau ringkasan form.

### 4.6 Motion

- Hover/focus feedback: 120–160 ms.
- Modal/drawer: 180–220 ms ease-out.
- Update slot/status: 140–180 ms.
- Tidak ada looping decoration, bounce, parallax, confetti, atau glow.
- Hormati `prefers-reduced-motion`.

---

## 5. Redesign detail: Beranda

### 5.1 Tujuan pengguna

Operator perlu menjawab cepat: jadwal saat ini berstatus apa, bagian mana yang membutuhkan perhatian, dan langkah berikutnya apa.

### 5.2 Susunan baru

1. **Header ringkas:** `Beranda` + konteks tahun ajaran/semester dari shell.
2. **Focal panel “Status jadwal”:** status draft/valid/siap terbit; satu kalimat ringkasan dan satu aksi paling relevan (`Buka jadwal`, `Lanjutkan validasi`, atau `Periksa draft`). Jangan selalu tampilkan tombol generate jika proses belum relevan.
3. **Metric strip ringkas:** Total JP terisi, Target JP, rasio/coverage, konflik keras. Semua angka berasal dari data yang sama dengan Alokasi/Validasi.
4. **Status rombel:** tabel kompak berisi rombel, tingkat, alokasi/kebutuhan, status, aksi. Jangan ubah menjadi enam kartu rombel.
5. **Next action:** satu panel daftar tindakan terurut (mis. rombel belum punya kebutuhan JP, ada peringatan distribusi, draft belum diterbitkan). Tiap item membuka sumber data terkait.
6. **Konteks sistem:** indikator tersimpan lokal di shell atau footer kecil; jangan ulangi disclaimer panjang di tiap halaman.

### 5.3 Yang berubah dari video

- Status jadwal tetap menjadi fokus, tetapi tidak tampil sebagai banner promosi besar.
- Statistik sisi kanan disederhanakan menjadi satu strip metrik dan tabel rombel yang lebih terbaca.
- Panel generator besar diganti tindakan kontekstual; tidak ada duplikasi tombol generate yang mengarah ke implementasi berbeda.
- Hapus pengulangan informasi yang sama antara status jadwal, statistik kepatuhan, dan halaman Validasi. Angka utama boleh terlihat, tetapi sumber rinci tetap satu.

### 5.4 State wajib

Belum ada data, jadwal kosong, draft, valid tapi belum diterbitkan, siap terbit, warning, error penyimpanan, dan data lokal belum tersedia. Empty state harus memberi langkah konkret (mis. lengkapi data master) tanpa mengarang data.

---

## 6. Redesign detail: Jadwal Pelajaran — layar utama

**Prioritas implementasi tertinggi.** Ini area paling padat dan paling menentukan keberhasilan SIGNAL.

### 6.1 Struktur baru

1. Judul `Jadwal Pelajaran` dengan deskripsi satu baris.
2. Toolbar utama satu baris: `Per kelas` / `Matriks paralel`, pemilih kelas bila mode per kelas, filter guru, filter mapel, filter tingkat/kelompok jika ada di source.
3. Status jadwal yang ringkas: Draft, Valid, Ada peringatan, Siap Terbit. Aksi `Periksa jadwal` membuka validator kanonis.
4. Tombol `Ekspor` membuka flow yang sama; `Susun otomatis` menavigasi ke Schedule Generator.
5. Ringkasan metrik hanya bila membantu (kelas aktif, JP terjadwal/total, konflik, durasi standar). Batasi menjadi satu strip pendek yang bisa diringkas.
6. Opsi tampilan sekunder dikelompokkan: Warna mapel, Singkat nama, zoom, reset zoom, pilihan sort, tampilkan kelompok. Jangan membuang kontrol yang ada di source.
7. Matriks tampil sedekat mungkin dengan bagian atas viewport.

### 6.2 Matriks jadwal

- Header hari Senin–Sabtu sticky; kolom waktu/slot sticky.
- Per kelas menampilkan satu kelas pada satu waktu; jangan menumpuk seluruh rombel secara vertikal.
- Matriks paralel tetap tersedia dan menggunakan komponen/visual yang konsisten, bukan tampilan terpisah yang terasa aplikasi lain.
- Sel KBM: nama mapel paling menonjol; guru satu baris sekunder; kode atau nama singkat hanya bila diperlukan.
- Sel kosong: netral, rapi, dan tidak mengulang `+ Isi` di setiap sel. Pada hover/focus muncul affordance tambah. Tetap bisa dibuka via keyboard/form.
- Sel non-KBM: label kegiatan dan waktunya jelas, tidak menyerupai slot kosong; tampilkan lock/context bila tidak dapat ditimpa.
- Gunakan penanda kategori yang terbatas (mis. garis kiri, tint tipis, atau kode warna konsisten). Warna mapel opsional yang sudah ada tetap menjadi opsi pengguna/ekspor; default antarmuka tidak menjadi rainbow grid.
- Warna tidak menjadi satu-satunya pembeda: selalu tampilkan teks mapel/guru/kegiatan.
- Zoom memengaruhi matriks, bukan keseluruhan halaman.

### 6.3 Pemetaan langsung dari video: kontrol yang wajib dipertahankan

| Elemen lama yang tampak | Redesign presentasi | Batas aman |
|---|---|---|
| Matriks Seluruh Kelas | Tab segmented `Matriks paralel` | Tetap menggunakan data dan perilaku asli |
| Editor Per-Kelas | Tab segmented `Per kelas` + selector rombel | Tidak menghapus editor lama |
| Status Draft Valid | Status satu baris dengan teks jelas | Tidak mengganti status validator |
| Periksa Jadwal | Secondary action dekat status | Memanggil validator yang sama |
| Terbitkan Jadwal | Primary action saat syarat terpenuhi | Publikasi dan snapshot tetap sesuai source |
| Statistik 5 kartu | Ringkasan 3–4 metrik dalam satu strip | Tidak mengubah nilai atau rumus |
| Filter tingkat/kelompok/guru/mapel | Toolbar terkelompok dan responsif | Semua filter existing tersedia |
| Warna Mapel, Singkat Nama | Menu `Tampilan`/toolbar kompak | Preferensi tetap dihormati |
| Zoom in/out/reset | Control group kecil dengan label/tooltip | Zoom matriks saja |
| Cetak PDF / CSV / Generate | Satu `Ekspor` + pintasan generator | Tidak menghapus output/type apa pun |
| `+ Isi` pada tiap sel | Add action saat hover/focus; empty cell tetap bisa dipilih | Tidak menonaktifkan keyboard |
| Warna pastel setiap sel | Tints/marker terukur + legend | Kode warna existing untuk ekspor tetap tersedia |

### 6.4 Editor slot

Klik/fokus sel membuka dialog/drawer berisi konteks hari, jam kegiatan, JP KBM bila berlaku, kelas, mapel, guru, durasi, dan catatan jika tersedia. Form harus mengikuti skema produksi. Saat simpan:

1. Validasi input;
2. Validasi aturan jadwal dan target slot;
3. Jika tidak valid, tampilkan alasan spesifik dan jangan commit;
4. Jika valid, commit melalui service existing;
5. Refresh matriks, ringkasan, dan status;
6. Tawarkan undo bila mekanisme tersebut tersedia di source.

Drag/drop bukan satu-satunya cara. Invalid target tidak boleh menerima perubahan parsial.

---

## 7. Redesign detail: Kebutuhan & Alokasi JP

### 7.1 Tujuan

Mengetahui kebutuhan JP per rombel/mapel, kapasitas KBM, alokasi aktual, distribusi, dan kekurangan yang harus dibereskan sebelum generate.

### 7.2 Susunan baru

1. Judul dan tindakan: `Susun jadwal otomatis` (link ke generator) dan `Tambah alokasi` jika sudah ada.
2. Summary strip: Total kebutuhan JP, Kapasitas KBM, Keseimbangan alokasi, Rombel tuntas.
3. **Issue summary**: warning ringkas dengan jumlah critical/warning dan tombol fokuskan isu; detail mengikuti data sumber yang sama.
4. **Monitor kapasitas rombel**: daftar baris horizontal/tabel kompak dengan nilai terisi/kapasitas dan progress, bukan kartu lebar untuk setiap kelas.
5. Search + filter rombel/mapel/guru bila tersedia.
6. Tabel alokasi: Kelas & kapasitas, Mapel, Guru pengampu & status beban, Alokasi JP per minggu, Aksi edit/hapus.

### 7.3 Perubahan dari video

- Empat kartu utama menjadi satu strip; angka dan label tetap ada.
- Area validasi real-time dibuat lebih ringkas, dengan satu warning yang bisa dibuka dan difokuskan ke baris relevan.
- Monitor kapasitas tidak memakai kartu per kelas; gunakan baris kompak dan status `x/y JP`.
- Table menjadi pusat layar, dengan pencarian di atasnya dan header yang jelas.
- Tombol susun otomatis menjadi shortcut ke generator kanonis, bukan solver kedua.

### 7.4 State dan interaksi

- Tambah/edit/hapus alokasi memakai form existing.
- Hapus menampilkan konfirmasi dan konsekuensi.
- Kekurangan JP harus menyebut rombel/mapel yang terdampak.
- Validasi kapasitas dan beban guru tetap dihitung oleh aturan/source existing.
- Ringkasan tidak boleh menghitung ulang rumus di sisi UI.

---

## 8. Redesign detail: Schedule Generator

### 8.1 Tujuan

Menyusun kandidat jadwal menggunakan engine deterministik dan membantu operator memilih kandidat yang sesuai.

### 8.2 Struktur baru

1. Heading `Schedule Generator` dan ringkasan target/ketersediaan data.
2. Status proses (Idle/Queued/Running/Success/Infeasible/Search limit/Invalid/Cancelled/Failed) sebagai timeline/status panel yang eksplisit.
3. Primary action tunggal `Jalankan generator` atau `Batalkan` saat berjalan.
4. Panel `Hasil penyusunan` menampilkan state saat ini, waktu/progres jika source menyediakan, ringkasan coverage dan informasi hasil.
5. Tabel `Kandidat tersimpan`: nama kandidat, status/coverage, skor, waktu, aksi `Bandingkan`/`Terapkan sebagai draft` bila tersedia.
6. Kandidat dapat dibandingkan tanpa mengaplikasikan perubahan.
7. Pemilihan kandidat membuat draft; tidak menerbitkan langsung.

### 8.3 Perubahan dari video

- Metrik target, kapasitas slot, rombel, kandidat, status engine disusun dalam satu status block, bukan teks yang saling menempel.
- Area hasil memiliki empty state yang menjelaskan belum ada pencarian baru.
- Kandidat dibaca sebagai tabel dengan kolom yang konsisten; bukan kumpulan tombol Terapkan tanpa konteks.
- Nama kandidat, coverage, score, waktu, dan aksi dirapikan.
- Satu jalur run canonical; pintasan dari halaman lain mengarah ke sini.

### 8.4 Status khusus

`SEARCH_LIMIT_REACHED` harus dijelaskan sebagai pencarian mencapai batas tanpa kesimpulan infeasible. Jangan tampilkan sebagai kegagalan total atau samakan dengan `INFEASIBLE`. Status harus mempertahankan kode/source asli dan copy penjelas UI boleh diterjemahkan tanpa mengubah makna.

---

## 9. Redesign detail: Validasi & Konflik

### 9.1 Struktur baru

1. Judul dan tindakan `Uji ulang jadwal`.
2. Summary state: validasi lolos/tidak lolos, jumlah hard error, jumlah warning.
3. Kartu ringkasan kecil: Skor kepatuhan (jika ada), Konflik keras, Peringatan lemah, Kelayakan.
4. Issue list dikelompokkan berdasarkan tingkat severity dan kode/area.
5. Setiap item memuat ringkasan, alasan, entity terkait (kelas/guru/mapel/hari/slot), langkah koreksi, tombol fokuskan/buka konteks.
6. No issues: tampilkan keadaan berhasil yang proporsional, jangan biarkan halaman kosong dengan empat card besar.

### 9.2 Perubahan dari video

- Banner lebar `memenuhi seluruh aturan` menjadi ringkasan status yang lebih kecil dan bisa dibaca.
- Empat metrik digabung menjadi baris informatif.
- Warning/issue menggunakan panel issue list dengan severity dan aksi.
- Teks kode error teknis tetap tersedia di detail/expand, bukan menjadi headline mentah yang menakutkan.
- Tidak menghapus laporan lengkap atau tombol uji ulang.

### 9.3 Kontrak

Ini satu-satunya sumber validasi detail. Semua ringkasan di dashboard, alokasi dan jadwal harus membuka laporan yang sama. Validator deterministic dan semua aturan hard/soft tetap sama.

---

## 10. Redesign detail: Beban Guru

### 10.1 Data yang harus dipertahankan

Semua kolom yang terlihat di video:

- Guru & kode
- Beban mengajar (JP)
- Jam astronomis (waktu nyata)
- Batas mingguan
- Persentase terhadap batas
- Distribusi hari Senin–Sabtu
- Total sesi
- Aksi PDF

Filter Guru, Kelas, Mapel, search guru, page size, dan catatan/prinsip verifikasi tetap tersedia bila ada di source.

### 10.2 Presentasi baru

- Tabel lebar penuh sebagai pusat; jangan diganti kartu profil guru.
- Kolom Guru/Kode tetap sticky jika perlu; angka tabular.
- Persentase dapat memiliki progress bar tipis tetapi angka wajib ada.
- Distribusi hari ditampilkan sebagai mini-matrix berlabel Senin–Sabtu, bukan ikon tanpa konteks.
- `Jam astronomis` dan `Batas mingguan` tidak boleh digabung tanpa pemeriksaan semantik source.
- Action PDF berada pada kolom kanan; ekspor multi-guru dapat menggunakan shared export.
- Filter di satu baris; search dipisah secara logis dari selector jika terlalu padat.

### 10.3 Perubahan dari video

- Header table dan helper lebih kontras serta konsisten.
- Progress bar tidak menjadi satu-satunya indikator; angka tetap jelas.
- Hari distribusi menggunakan label pendek konsisten dengan tooltip/detail hari lengkap.
- Hindari kolom yang terlalu sempit sehingga JP/jam/status saling menempel.

---

## 11. Redesign detail: Data Master

### 11.1 Cakupan yang wajib tetap

Data Master tetap memuat domain Kelas, Guru, dan Mata Pelajaran (Mapel). Field, relasi, aturan unik, kode, impor/ekspor, dan tindakan per baris harus diverifikasi ke source sebelum diimplementasikan ulang. Jangan menambah field hanya untuk mengisi ruang.

### 11.2 Struktur tampilan

1. Heading `Data Master` dengan deskripsi singkat.
2. Tab domain `Kelas` / `Guru` / `Mata pelajaran`.
3. Toolbar kontekstual: search, filter yang relevan, jumlah data, tombol tambah/import/export jika tersedia di source.
4. Tabel utama sesuai domain; header dan aksi konsisten.
5. Form tambah/edit pada drawer/dialog sesuai kompleksitas.
6. Empty state menjelaskan entitas yang belum tersedia dan aksi berikutnya.

### 11.3 Perubahan yang ditargetkan

- Satukan struktur toolbar dan tabel di semua tab.
- Label field tetap dan pesan validasi jelas.
- Jangan memaksakan dashboard metric/chart jika yang dibutuhkan adalah CRUD.
- Gunakan detail view hanya bila jumlah field/relasi memang memerlukannya.
- Hapus hanya duplikasi presentasi, bukan aksi yang ada.

---

## 12. Redesign detail: Presensi Guru

**Fungsionalitas presensi tidak ditambah atau dikurangi.** Redesign hanya presentasi, navigasi tab, keterbacaan tabel, dan empty state.

### 12.1 Ringkasan

- Guru hadir hari ini / total guru
- Tingkat kehadiran
- Dispensasi / izin / sakit
- Alpa / tanpa keterangan

Metrik ringkas; data dan rumus tetap mengikuti source.

### 12.2 Tab wajib

1. **Harian** — tanggal presensi, pencarian guru, filter status, `Set Semua Hadir`, `Simpan Presensi Hari Ini`, tabel nomor/kode/nama lengkap & NIP (jika ada)/status kehadiran/catatan.
2. **Massal Bulanan** — alur input massal bulanan yang ada; field, aturan, dan bulk action harus diaudit source. Mockup harus menunjukkan tab ini tetapi tidak mengarang proses produksi.
3. **Per Guru** — rekap detail per individu sesuai implementasi existing.
4. **Rekap & PDF** — filter periode/rekap dan ekspor PDF yang sudah ada.
5. **Hari Libur** — tanggal, nama/keterangan hari libur, tambah, cari, daftar dan aksi data. Tidak dipindah/dihapus dalam redesign tanpa audit dan persetujuan.

### 12.3 Perubahan dari video

- Empat kartu ringkasan ditata dalam satu strip yang lebih rapat.
- Tab aktif memakai Soft Sage dengan teks Heritage Green; semua lima tab tetap terlihat.
- Tanggal, cari, dan filter status sejajar; tombol set semua hadir/simpan berada dekat judul tugas.
- Nama guru, status, dan catatan ditata dalam baris yang lebih bersih.
- Empty state Hari Libur memberi instruksi yang jelas dan form tambah tetap terlihat.
- Export PDF bulanan tetap ada.

### 12.4 Aksesibilitas dan safety

- Tidak mengisi status hadir secara otomatis tanpa tindakan operator yang ada di source.
- `Set Semua Hadir` harus punya feedback dan konfirmasi sesuai aturan source.
- Catatan opsional tidak boleh menutupi status.
- Simpan memberikan state saving/success/error yang jelas; jangan menganggap berhasil sebelum penyimpanan berhasil.

---

## 13. Redesign detail: Riwayat & Ekspor

### 13.1 Kelompok tugas

Satu halaman tetap dapat menyajikan tiga area, tetapi dipisah secara jelas:

1. **Riwayat versi** — daftar versi/snapshot, waktu, status aktif, detail, restore jika tersedia.
2. **Ekspor** — PDF jadwal, CSV, cetak, rekap sesuai semua scope dan opsi existing.
3. **Backup & Restore** — backup lokal, pilih file restore, validasi file, konfirmasi risiko, hasil restore.

Jangan membuat istilah `sync` jika sebenarnya hanya backup file lokal.

### 13.2 Aturan presentasi

- Riwayat memiliki timeline atau tabel dengan versi aktif yang jelas.
- Restore bersifat destructive/impactful: jelaskan apa yang akan berubah dan minta konfirmasi.
- Ekspor memakai shared modal; preselect scope berdasarkan konteks pemanggil.
- Backup/restore mengkomunikasikan file lokal, lokasi unduhan/pemilihan file, dan timestamp jika tersedia.
- Semua data/snapshot harus melewati validator ulang sesuai aturan sebelum aktif.

---

## 14. Redesign detail: Flow Ekspor PDF/Jadwal

Dialog pada video adalah salah satu bagian dengan opsi paling banyak. Opsi harus ditata lebih baik tetapi **seluruh pilihan harus tetap ada**.

### 14.1 Scope (empat mode)

- Semua Kelas — 1 Halaman A4 / landscape / rekap JP & TTD sesuai implementasi.
- Per Rombel Kelas — pilihan kelas/rombel dan estimasi halaman.
- Matriks Master — format multi-hari sesuai implementasi.
- Jadwal Guru — pilihan tenaga pendidik/guru.

### 14.2 Opsi format dan layout

- Kertas A4 (210 × 297 mm).
- Kertas F4/Folio (210 × 330 mm) jika supported.
- Orientasi dan tata letak sesuai scope, termasuk 1 halaman terpadu vs 2 halaman lengkap jika tersedia.
- Estimasi halaman dihitung dari konfigurasi/source dan ditampilkan sebagai informasi, bukan angka statis.

### 14.3 Opsi lanjutan yang terlihat

- Pewarnaan sel kode hex mapel.
- Pemadatan nama mapel dan guru otomatis.
- Kop surat resmi madrasah (logo/identitas/NSM/NPSN/alamat bila didukung).
- Halaman 2: rekapitulasi JP dan kolom TTD/beban guru sesuai implementasi.
- Penyesuaian teks dokumen resmi: Kop Surat & Instansi, Judul & Periode, Titikmangsa & Penandatanganan.
- Reset default jika ada.

### 14.4 Perubahan UX

- Common path: pilih scope → format → target (jika perlu) → unduh.
- Opsi lanjutan berada dalam disclosure `Pengaturan lanjutan`; default checkbox mengikuti source, bukan dibuat ulang berdasarkan desain.
- Kustomisasi teks tetap bisa dibuka dan diedit; tiga kelompoknya ditata sebagai subtab/step kecil.
- Dialog tidak horizontal overflow pada 1366/1024/768/390 px; pada layar sempit gunakan full-screen sheet dengan sticky footer.
- Tombol utama `Unduh PDF` hanya memulai ekspor; UI menampilkan progress/error aktual.
- Tes dokumen aktual: clipping, pagination, font, kop, orientasi, scope, A4/F4, nama file, dan halaman rekap.

---

## 15. Redesign detail: Pengaturan Workspace

### 15.1 Tab yang terlihat

1. **Hari Aktif & Jam Kegiatan (WAJIB)**
2. **Identitas Madrasah**
3. **Integrasi AI (Gemini)**

### 15.2 Hari Aktif & Jam Kegiatan

Konten ditata sebagai dua kolom fleksibel:

- Kolom utama: hari aktif, template susunan slot, standar JP, daftar jam kegiatan.
- Kolom samping: konversi durasi dan ringkasan kapasitas, sinkronisasi jam, reset workspace bila ada.

Elemen yang tampak pada video:

- Ringkasan Hari Belajar Aktif, Total JP KBM Pekanan, Durasi Standar 1 JP, Waktu Astronomis Nyata.
- Toggle/pilihan Senin, Selasa, Rabu, Kamis, Jumat, Sabtu.
- Template Standar (8 JP), Template Full Day, Sisipkan Istirahat, Tambah Jam KBM.
- Durasi standar JP (field dan preset 35, 40, 45 menit bila source mendukung).
- Aksi Sinkronkan Jam Berurutan (Cascade).
- Jenis slot: Belajar Mengajar (KBM), Istirahat, Upacara Bendera, Religi/Dhuha, Kegiatan Lain.
- Tabel slot: Urutan, Mulai, Durasi, Selesai, Kategori/Jenis Kegiatan, Hari Berlaku, Nama Kegiatan/Keterangan, Aksi.
- Panel konversi: durasi standard JP, jam KBM per hari, non-KBM per hari, hari aktif, kapasitas kelas/minggu.
- Reset Workspace/Demo dengan konfirmasi konsekuensi.

Perubahan desain:
- KPI tetap ada sebagai satu strip tipis.
- Day selector dibuat lebih jelas; hari aktif/inaktif memiliki state, bukan hanya border.
- Slot table menjadi fokus setelah kontrol template; baris kategori memiliki ikon/label/status terstruktur.
- Side summary tidak mengulang seluruh konten tabel; tampilkan konversi dan kapasitas saja.
- Aksi cascade dan template dipisah: template = menerapkan preset; cascade = menyelaraskan waktu urutan.
- Reset dipisah secara visual sebagai destructive action di bagian bawah.

### 15.3 Identitas Madrasah

Pertahankan semua field yang ada di source untuk nama, alamat, identitas kelembagaan, logo, kop surat, dan detail dokumen. Rekaman memperlihatkan tab tetapi tidak semua fieldnya; jangan mengarang nama field, format validasi, atau kewajiban. Layout berupa form dua kolom responsif dengan preview dokumen bila tersedia.

### 15.4 Integrasi AI (Gemini)

Pertahankan pengaturan Gemini existing. Gemini opsional dan off by default. Tampilkan status, enable/disable, batas/konfigurasi yang sudah ada, dan peringatan privasi/data hanya berdasarkan perilaku source. Jangan buat fitur AI baru atau menjadikannya validator, solver, penentu kelayakan, ataupun publisher.

---

## 16. Responsif, aksesibilitas, dan empty states

### Breakpoints target

- 1920 / 1600 / 1440 / 1366 px: desktop penuh.
- 1024 px: sidebar dapat diringkas; tabel tetap menjadi konten utama.
- 768 px: sidebar drawer, filter wrap, dua kolom menjadi satu.
- 390 / 360 px: kontrol penting tetap terlihat, toolbar stack rapi, tabel memiliki scroll lokal atau mode ringkas yang tetap mempertahankan data.

### Aksesibilitas

- Semua menu/action utama dapat dijalankan dengan keyboard.
- Focus ring terlihat di light/dark surface.
- Dialog mempunyai focus trap dan focus restoration.
- Status disampaikan dengan teks/ikon, bukan hanya warna.
- Semua input memiliki label.
- Tabel memiliki header semantik dan urutan fokus yang masuk akal.
- Slot kosong jadwal dapat dipilih dengan keyboard/form.
- Drag/drop memiliki alternatif.
- Hormati reduced motion.
- Target klik/tap cukup besar dan tidak terlalu rapat.

### Empty state

Setiap state kosong menjawab: apa yang belum ada, mengapa pengguna melihat layar ini, dan satu tindakan paling relevan. Hindari ilustrasi besar dekoratif dan empty-state yang hanya berbunyi `Tidak ada data`.

---

## 17. Peta perubahan ringkas dari video

| Area | Masalah presentasi yang tampak | Perubahan desain utama | Fitur yang tidak boleh hilang |
|---|---|---|---|
| Shell + sidebar | Menu tampil satu level; banyak ruang sidebar tidak produktif | Group nav, heritage green shell, state aktif jelas, logo/brand lebih rapi | 10 rute lengkap, profil, tahun ajaran, semester |
| Beranda | Banyak metrik dan panel bersaing | Fokus pada status dan next action; metrik strip; tabel rombel | Status, statistik, keterisian, pintasan |
| Jadwal | Kontrol bertumpuk; banyak `+ Isi`; warna mapel terlalu ramai; matriks memanjang | Toolbar padat, mode konsisten, matriks di atas, empty cell neutral, semantic activity row | Dua mode, semua filter, edit, zoom, warna, nama singkat, export, generator link, validasi, publish |
| Ekspor | Modal padat, lebar, banyak opsi | Flow bertahap + advanced disclosure + sticky footer | 4 scope, A4/F4, layout, target, semua checkbox, custom document text |
| Alokasi | Summary, warning, monitor kapasitas dan table sama-sama menuntut fokus | Summary strip, issue strip, monitor kompak, table utama | Total kebutuhan, kapasitas, keseimbangan, status rombel, search, semua CRUD |
| Generator | Status dan hasil terlalu rapat; halaman terasa kosong sebelum run | Status panel terstruktur, empty state, candidate table | Semua status, kandidat, skor, coverage, terapkan draft, cancel |
| Validasi | White space besar ketika warning sedikit; error code terlalu menonjol | Compliance summary kompak dan issue list yang kontekstual | Hard errors, warning, status kelayakan, uji ulang, detail report |
| Beban Guru | Data tabel padat, progress hari kecil | Tabel dengan kolom konsisten, angka tabular, distribusi hari jelas | Semua kolom/filter/search/aksi PDF |
| Data Master | Perlu standardisasi antar entitas | Tab domain seragam, toolbar, form dan table jelas | Kelas, Guru, Mapel, semua source actions |
| Presensi | Lima tab dan banyak input; empty state Hari Libur perlu konteks | Tab konsisten, filter sejajar, action dekat tugas, table lebih bersih | Harian, Massal Bulanan, Per Guru, Rekap & PDF, Hari Libur |
| Riwayat & Ekspor | Area terpisah tetapi hubungan versi/ekspor/backup perlu jelas | Tiga kelompok kerja terpisah, flow ekspor bersama | Versi, ekspor, backup, restore, semua source options |
| Pengaturan | Form panjang, beberapa blok, save/reset perlu jelas | Subtab, dua kolom, grouped controls, save state tunggal per bagian | Hari aktif, jam, aktivitas, identitas, Gemini, reset, semua field source |

---

## 18. Kontrak implementasi: UI baru, engine lama

### Jangan disentuh tanpa audit dan persetujuan

- Model data dan relasi.
- IndexedDB store, versioning, migration, dan persist semantics.
- Algoritme generator dan status internal.
- Deterministic validator dan rule definitions.
- Publish/snapshot/restore process.
- Formula perhitungan kebutuhan, alokasi, workload, astronomical hours.
- Aturan KBM/non-KBM, hari belajar, durasi, slot blocking.
- Ekspor PDF/CSV/print dan opsi dokumen.
- Presensi dan perhitungan rekap.
- Backup/restore lokal.
- Gemini server-side safety and secrets.

### Pola integrasi yang direkomendasikan

1. Audit repository: routes, page components, shared components, state/store/service, hooks, types, schema, tests.
2. Buat feature-to-source map untuk setiap menu, aksi, modal, filter, tombol, state, dan export option.
3. Screenshot baseline dan catat task journey existing.
4. Implement token dan shell baru.
5. Migrasi **Jadwal** lebih dahulu, kemudian Beranda, Alokasi/Generator/Validasi, Beban Guru/Data Master/Presensi, Riwayat/Ekspor/Pengaturan.
6. UI memanggil handler/service existing; hindari logika domain kedua di komponen presentasi.
7. Tes parity dan regression setiap tahap.
8. Uji PDF, restore, publish, generator, validator, attendance, keyboard, responsive.
9. Bandingkan klik/scroll/latency hanya setelah diukur di runtime; jangan mengklaim persentase peningkatan tanpa data.

---

## 19. Definition of Done / quality gates

### Visual

- Semua halaman memakai token V3 dan tidak ada campuran theme lama.
- Fraunces tampil tegas pada display heading dan angka utama; Inter pada semua elemen operasional.
- Warna jewel dipakai secara semantik/terukur; tidak menjadi rainbow UI.
- No clipped labels, buttons, badges, icons, dialog, dropdown or table header.
- No accidental body horizontal overflow.
- Jadwal tetap terbaca pada viewport desktop dan tablet.

### UX

- Semua 10 menu tetap mudah ditemukan.
- Jadwal terlihat tanpa harus melewati tumpukan control panels.
- Empty cells neutral namun keyboard-accessible.
- Semua aksi memiliki feedback loading/success/error/cancel.
- Validator hanya satu sumber kebenaran.
- Generator hanya satu jalur run kanonis.
- Export shared flow tidak kehilangan opsi.
- Presensi lima tab tetap utuh.

### Domain/regression

- Semua aturan hari, JP, istirahat, urutan slot, guru, mapel, kelas, aktivitas, blocking, generator status, candidate draft, publish, restore, validator, workload, export, backup dan attendance lulus regression.
- `SEARCH_LIMIT_REACHED` tidak pernah ditampilkan sebagai `INFEASIBLE`.
- Slot non-KBM tidak dihitung sebagai JP KBM dan tidak dapat ditimpa bila blocking.
- Friday tetap aktif sesuai konfigurasi sekolah.
- Publish/restore melakukan validasi ulang dan mengelola snapshot/active version dengan benar.

### Test matrix minimal

- Browser: Chrome, Edge, Firefox (sesuai target deployment).
- Width: 1920, 1600, 1440, 1366, 1024, 768, 390, 360.
- States: empty, loading, valid, warning, invalid, saving, saved, failure, cancel, disabled, modal open, drawer open.
- Flows: edit slot, invalid slot rejection, generate, candidate comparison/apply, validation, publish, export all scopes, A4/F4, backup, restore, attendance, master CRUD, setting save/reset.

---

## 20. Artefak mockup

`SIGNAL_V3_Mockup_Atlas.html` adalah atlas prototype 24 plate dengan navigasi antarmodul, contoh matriks jadwal, tab, modal edit slot, modal ekspor, dan state interaksi presentasional.

- Prototype **bukan** aplikasi produksi.
- Semua angka, nama, status, dan contoh jadwal pada mockup bersifat ilustratif.
- Simulasi tombol tidak terhubung ke IndexedDB, generator, validator, ekspor PDF, presensi, atau backup/restore.
- Sebelum dipakai sebagai acuan implementasi final, developer harus mengganti semua data demo dengan data binding dan action dari repository SIGNAL.


---

# SIGNAL V3 — Addendum wajib yang mengikat seluruh spesifikasi

Dokumen di atas tetap menjadi inventaris fitur dan observasi rinci dari rekaman. Addendum ini **menggantikan arah visual V2 yang terlalu tenang**. Untuk implementasi, gunakan V3 sebagai acuan tertinggi bila ada konflik antara arahan visual V2 dan arahan di bawah. Aturan bisnis, fitur, field, dan perilaku yang telah ada tetap tidak berubah.

## A. Audit UI/UX versi sebelumnya

### A1. Temuan yang perlu diperbaiki

1. **Premium belum terasa kuat.** Warna hijau dipakai sebagai jangkar, tetapi sebagian besar permukaan tetap tampak generik dan datar. Warna jewel belum hadir pada momen fitur utama.
2. **Komponen terlalu seragam.** Dashboard, daftar, form, dan pengaturan cenderung memakai panel/card dengan struktur mirip. Hierarki antarfitur tidak terasa.
3. **Display typography terlalu kecil perannya.** Fraunces belum cukup membangun karakter. Font display harus terlihat pada judul dan angka utama, sementara Inter menjaga operasional tetap cepat dibaca.
4. **Aksen emas kurang memiliki sistem.** Gold harus muncul konsisten sebagai craft detail kecil—bukan sesekali dan bukan berlebihan.
5. **Beberapa informasi dapat menjadi lebih padat.** Filter, status, dan aksi berulang sebaiknya dikelompokkan agar layar utama tidak memanjang.
6. **Prototype bukan aplikasi produksi.** Kontrol contoh hanya mendemonstrasikan interaksi lokal; generator, validator, IndexedDB, publish, PDF, dan backup produksi tidak boleh diklaim berjalan.

### A2. Prinsip UX yang tidak boleh dilanggar

- Setiap layar menjawab tiga hal dalam 3–5 detik: *sedang di bagian apa, statusnya apa, tindakan berikutnya apa*.
- Satu tindakan primer per konteks. Aksi sekunder masuk menu ringkas atau toolbar sekunder.
- Hilangkan kalimat promosi, paragraf penjelasan berulang, dan istilah teknis yang tidak membantu tindakan.
- Pakai bahasa antarmuka Indonesia yang pendek: “Jadwal belum terbit”, “Periksa 3 konflik”, “Simpan perubahan”, “Pilih kelas”.
- Jangan memaksa pengguna membuka banyak modal bertingkat. Gunakan inline edit atau side panel untuk tugas singkat; dialog hanya untuk fokus singkat/konfirmasi.
- Minimalkan scroll halaman. Untuk data lebar gunakan tabel dengan header sticky dan scroll di dalam tabel, bukan membuat seluruh halaman melebar.
- Fitur lanjutan boleh berada di “Opsi lainnya” jika tidak dibutuhkan setiap kali. Jangan sembunyikan field yang harus dipahami sebelum pengguna menjalankan tugas.
- Beri feedback langsung: loading, tersimpan, gagal, batal, dan undo. Jangan tampilkan animasi lama.
- Jangan pernah menghapus opsi produksi untuk membuat layar tampak bersih.

## B. Metode membangun kesan luxury premium tanpa mengorbankan UX

Metode berikut adalah gabungan prinsip desain visual, temuan studi premium digital, dan rekomendasi desain SIGNAL. Ini bukan formula universal; penerapannya harus diuji dengan operator sekolah.

1. **Signature color architecture.** Pakai emerald gelap sebagai identitas, lalu 2–3 jewel accent (plum, midnight blue, jade) yang punya peran modul. Palet kaya memberi karakter; tata letak dan semantik menjaga keteraturan.
2. **Confident typographic hierarchy.** Fraunces menandai identitas/heading; Inter menangani detail kerja. Perbedaan ukuran/berat yang tegas menghasilkan rasa editorial tanpa memperpanjang tulisan.
3. **Material contrast.** Kontraskan dark hero / bright work surface / warm ivory canvas. Gunakan inset surface, hairline border, dan kedalaman bertingkat seperlunya agar tampak crafted.
4. **Art-directed composition per module.** Jangan salin satu template dashboard ke semua fitur. Beranda memakai overview, jadwal memakai matrix, generator memakai progress/status panel, validasi memakai issue list, workload memakai comparison table, pengaturan memakai segmented workspace.
5. **Craft micro-details.** Monogram, nomor plate kecil, gold keyline, tab aktif, icon stroke seragam, alignment angka, focus state, hover state, empty state, serta export preview harus dirancang sama seriusnya dengan hero.
6. **Meaningful motion.** Gunakan transisi cepat 120–180 ms untuk hover/selection; 180–240 ms untuk panel/overlay. Animasi hanya menandai state, bukan dekorasi. Sediakan reduced-motion.
7. **Frictionless task flow.** Kurangi bolak-balik, pertahankan state filter, gunakan inline action yang aman, bulk action untuk tugas banyak, serta konfirmasi khusus tindakan destruktif/publish/restore.
8. **Performance as luxury.** Hindari blur berat, video background, 3D, library animasi besar, icon-font besar, dan render tabel seluruhnya tanpa virtualisasi bila data tumbuh. Premium harus terasa cepat.
9. **Consistency with controlled variation.** Konsisten pada grid, font, control height, feedback, dan icon; variasikan komposisi/warna utama antarfitur secara sengaja.
10. **Readability beats ornament.** Kontras teks, label, struktur data, keyboard focus, dan responsif tidak boleh kalah demi visual.

## C. Peta warna karakter untuk setiap core

| ID / Core | Karakter visual | Aplikasi |
|---|---|---|
| 01 Beranda | Heritage Night + Emerald | Ringkasan status dan langkah selanjutnya |
| 02–04 Jadwal | Emerald + Jade + Gold detail | Matrix, editor kelas, edit slot |
| 05 Alokasi | Midnight Blue + Jade | Kebutuhan, kapasitas, distribusi |
| 06 Generator | Deep Plum + Gold | Proses, kandidat, status pencarian |
| 07 Validasi | Heritage Green + status semantic | Konflik keras, peringatan, lolos |
| 08 Beban Guru | Midnight Blue + Jade | Beban aktual dan distribusi |
| 09 Kelas | Heritage Green | Data rombel/kelas |
| 10 Guru | Deep Plum | Data guru |
| 11 Mapel | Jade/Emerald | Data mata pelajaran |
| 12–16 Presensi | Heritage Green + status semantic | Harian, bulanan, per guru, rekap, libur |
| 17–19 Riwayat/Ekspor/Backup | Midnight Blue + Gold | Versi lokal, PDF, backup lokal |
| 20–22 Pengaturan | Warm Ivory + Emerald/Plum accent | Jam, identitas, Gemini |
| 23 Component system | Semua token dengan aturan | Referensi komponen, bukan halaman aplikasi |
| 24 Responsive system | Adaptasi seluruh layar | Referensi layout, bukan route baru |

## D. Atlas mockup — 24 plate terpisah

**PENTING UNTUK AI STUDIO:** Atlas berisi 24 referensi tampilan yang berbeda. HANYA plate 01 adalah Beranda. Plate 02–22 adalah layar, tab, dialog, atau alur fitur lain. Plate 23 adalah referensi komponen. Plate 24 adalah referensi perilaku responsif. Jangan gabungkan isi atlas menjadi satu dashboard/homepage. Jangan tampilkan seluruh 24 plate di dalam aplikasi produksi.

| No. | Judul plate | Jenis | Yang harus dibangun/ditunjukkan |
|---:|---|---|---|
| 01 | Beranda — Command Overview | Route | Status jadwal, indikator inti, tindak lanjut dan shortcut |
| 02 | Jadwal — Matriks Seluruh Kelas | Route/mode | Matriks multi-rombel, toolbar, filter, status, aksi |
| 03 | Jadwal — Editor Per Kelas | Route/mode | Pilih kelas, fokus satu matriks, navigasi cepat |
| 04 | Jadwal — Edit Slot | Dialog/side panel | Form edit slot dan feedback validasi |
| 05 | Kebutuhan & Alokasi JP | Route | Demand vs capacity, per kelas, distribusi dan alert |
| 06 | Schedule Generator | Route | Konfigurasi run, status solver, kandidat, apply draft |
| 07 | Validasi & Konflik | Route | Hard error, warning, detail masalah, tautan ke sumber |
| 08 | Beban Guru | Route | Beban aktual, persentase, distribusi hari, PDF per guru |
| 09 | Data Master — Kelas/Rombel | Tab | Daftar kelas, pencarian, CRUD sesuai source |
| 10 | Data Master — Guru | Tab | Daftar guru, pencarian, CRUD sesuai source |
| 11 | Data Master — Mata Pelajaran | Tab | Daftar mapel, pencarian, CRUD sesuai source |
| 12 | Presensi Guru — Harian | Tab | Tanggal, status kehadiran, mass set, simpan, catatan |
| 13 | Presensi Guru — Massal Bulanan | Tab | Input/lihat bulanan dan rekap per hari |
| 14 | Presensi Guru — Per Guru | Tab | Rincian satu guru dan riwayat |
| 15 | Presensi Guru — Rekap & PDF | Tab | Ringkasan dan opsi cetak/ekspor |
| 16 | Presensi Guru — Hari Libur | Tab | Daftar libur, tambah, edit, pencarian |
| 17 | Riwayat — Versi Jadwal | Route/section | Snapshot lokal, versi aktif, restore tervalidasi |
| 18 | Flow Ekspor PDF | Dialog/flow | Empat cakupan, A4/F4, semua opsi lanjutan |
| 19 | Backup & Restore Lokal | Route/section | Export file backup, pilih file, validasi sebelum restore |
| 20 | Pengaturan — Hari & Jam Kegiatan | Tab | Hari aktif, JP, jam astronomis, slot KBM/non-KBM |
| 21 | Pengaturan — Identitas Madrasah | Tab | Identitas sesuai field yang benar-benar ada di source |
| 22 | Pengaturan — Integrasi Gemini | Tab | Integrasi opsional, status, konfigurasi yang tersedia |
| 23 | Component & State Library | Design reference | Buttons, tables, tabs, badges, modal, empty/error/loading states |
| 24 | Responsive Adaptation | Design reference | Desktop, tablet, mobile behavior; bukan page baru |

### D1. Penomoran yang wajib tampil di HTML

Tiap plate harus menampilkan secara visual: nomor besar `01 / 24`, judul plate, tipe (ROUTE / TAB / DIALOG / DESIGN REFERENCE), dan deskripsi singkat satu baris. Beri header atlas yang jelas: **“24 LAYAR & BAGIAN REFERENSI — BUKAN SATU BERANDA”**. Navigasi atlas hanya alat untuk berpindah preview, bukan sidebar produksi.

### D2. Cara membaca mockup

- Plate 01 saja = Beranda.
- Plate 02–04 = tiga variasi layar/interaksi Jadwal.
- Plate 09–11 = tab Data Master, bukan tiga modul baru.
- Plate 12–16 = lima tab Presensi Guru, bukan lima beranda.
- Plate 18 = dialog alur ekspor, bukan dashboard.
- Plate 23–24 = pedoman visual/layout, bukan fitur navigasi.

## E. Spesifikasi screen-by-screen yang wajib dipenuhi

Rincian pada bab fitur 5–15 tetap berlaku. Tambahan kriteria khusus:

### E1. Shell global
- Sidebar dark emerald/heritage night dengan brand mark SIGNAL, label nav jelas, active item memiliki fill emerald dan hairline gold di sisi.
- Header memuat tahun ajaran, semester, notifikasi, profil. Hindari menambah search global bila tidak ada di produk.
- Halaman tidak dipaksa memakai hero besar. Untuk jadwal dan tabel, toolbar dan data utama muncul dekat bagian atas viewport.
- Breadcrumb hanya untuk hierarki yang nyata; tidak semua halaman memerlukan breadcrumb.

### E2. Beranda
- Hero gelap dengan salam/judul pendek dan status jadwal. Tidak ada copywriting panjang.
- Maksimal 3–4 metrik yang benar-benar berguna; angka besar, label jelas.
- Tampilkan tugas mendesak atau kondisi data, bukan grafik dekoratif.
- Shortcut menuju Jadwal, Generator, Validasi, Presensi jika ada dasar pada source.

### E3. Jadwal
- Area toolbar maksimal 2 baris pada desktop. Pilih kelas/mode/tanggal/filter tetap mudah dijangkau.
- Matrix tetap dominan; baris hari Senin–Sabtu dan slot; jam ke-/JP KBM dibedakan dengan benar.
- Aktivitas non-KBM diberi treatment berbeda dan tidak dapat ditimpa bila blocking.
- Sel kosong tidak dibanjiri tombol. Click/keyboard membuka edit satu kali.
- Warna mapel konsisten dan disertai singkatan/teks. Gunakan gold hanya untuk selected/focus/marker.
- Zoom dan horizontal scroll berada pada container matriks. Sticky header/kolom bila memungkinkan.

### E4. Alokasi, generator, validasi
- Alokasi menampilkan angka kapasitas dan demand dengan satuan jelas, status per kelas, dan tindakan per baris.
- Generator menampilkan langkah yang sedang dijalankan, bukan animasi progress palsu. Tombol jalankan satu primary. Batalkan hanya jika solver mendukung.
- Kandidat ditampilkan berdampingan secara ringkas; aksi pilih kandidat tidak otomatis publish.
- Validasi memprioritaskan konflik keras, lalu peringatan. Setiap issue menyebut kelas/guru/hari/jam dan jalan menuju sumber.

### E5. Beban Guru
- Tampilkan total beban aktual, ambang/batas yang relevan, rasio dan distribusi hari.
- Gunakan table-first. Hindari kartu per guru yang menumpuk panjang.
- Ekspor per guru tidak boleh memotong layout atau mengganti data aktual.

### E6. Data Master
- Tab Kelas, Guru, Mapel merupakan view berbeda pada modul Data Master.
- Setiap tab punya search, filter hanya jika dibutuhkan, aksi tambah, tabel, empty/loading/error state.
- Field, validasi, dan relasi harus dicocokkan dari source code; jangan membuat field fiktif dari mockup.

### E7. Presensi Guru
- Pertahankan kelima tab persis seperti modul yang sudah ada.
- Harian: date, search, filter, set all hadir, status H/I/S/A sesuai source, catatan, simpan. Aksi massal harus aman dan memiliki feedback.
- Massal Bulanan: jangan dipadatkan sampai tanggal/kolom sulit dibaca; pertahankan navigasi bulan dan ringkasan.
- Per Guru: identitas, ringkasan dan catatan/riwayat sesuai fitur source.
- Rekap & PDF: opsi laporan yang ada dan preview sebelum ekspor.
- Hari Libur: daftar dan CRUD sesuai existing behavior.
- Ini redesign UI modul presensi yang ada, bukan penambahan fitur attendance baru.

### E8. Riwayat, PDF, Backup
- Riwayat menonjolkan versi aktif dan kronologi. Restore butuh confirmation dan revalidasi.
- Dialog PDF menampilkan scope terlebih dulu, baru opsi format, baru opsi lanjut. Pertahankan empat scope: Semua Kelas, Per Rombel Kelas, Matriks Master, Jadwal Guru.
- Pertahankan A4/F4 bila tersedia, layout, target, warna sel kode mapel, pemadatan nama, kop resmi, rekap JP, kolom TTD, dan custom text dokumen.
- Opsi lanjutan dapat collapse, namun nilainya tidak dihapus.
- Backup/restore lokal harus eksplisit menyebut file lokal. Jangan memberi label “sync”.

### E9. Pengaturan
- Hari aktif dan jam kegiatan berupa pengaturan yang mudah dipindai, bukan wall of controls.
- Jumat tetap hari belajar; Senin–Sabtu aktif sesuai konfigurasi yang diatur.
- Max awal 10 JP KBM per hari, configurable; bedakan slot `Jam ke-` dari `JP KBM`.
- Gemini opsional/off secara default, tidak mengambil alih validasi atau publish.

## F. Responsive behavior

- Desktop 1440+: sidebar penuh, data matrix dan table luas.
- Laptop 1024–1439: sidebar dapat collapse; toolbar wrap satu baris tambahan; table di-scroll secara internal.
- Tablet 768–1023: sidebar drawer; filter jadi toolbar ringkas; matrix horizontal scroll dengan sticky first column bila mampu.
- Mobile <768: sidebar drawer, header pendek, filter dalam sheet, table jadi list hanya jika konteks data mengizinkan. Jangan memecah grid jadwal menjadi kartu tanpa menjaga konteks hari/jam.
- Tidak boleh ada horizontal overflow pada body; bila matriks butuh scroll horizontal, hanya panel matriks yang overflow.

## G. Definisi keberhasilan desain V3

- Pengguna baru memahami judul/status/tindakan inti tanpa membaca paragraf panduan.
- Tugas harian umum selesai dengan lebih sedikit navigasi, tanpa menghilangkan langkah validasi yang memang wajib.
- Tabel dan matriks tetap terbaca pada ukuran laptop.
- Setiap core memiliki karakter premium yang jelas, bukan sekadar sidebar hijau dan card putih.
- Semua fungsi existing, opsi, tab, state, dan aturan domain dipertahankan.
- Transisi responsif; tidak ada animasi panjang atau efek berat.
- Semua tombol/focus state bisa diakses keyboard, semua tindakan punya feedback.
- Tidak ada klaim kualitas atau skor 9.5+ tanpa uji pengguna dan audit implementasi.

## H. Sumber metode / referensi eksternal

- Bonhomme, “The 10 codes of premium digital 2026” — typography, intentional motion, performance, systemic consistency, frictionless journey, immersion/key moments. Studi studio premium digital, bukan standar netral universal: https://bonhommeparis.com/en/knowledge-center/studies/the-10-codes-of-premium-digital-2026
- Nielsen Norman Group, “5 Principles of Visual Design in UX” — scale, visual hierarchy, balance, contrast, Gestalt: https://www.nngroup.com/articles/principles-visual-design/
- Nielsen Norman Group, “Visual Hierarchy in UX” — atur fokus lewat kontras dan hierarki; hindari memaksa pengguna memindai clutter: https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- GOV.UK Content Design — mulai dari kebutuhan pengguna, ringkas dan jelas, hindari duplikasi: https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/plan-manage-content/understand-content-design/
- UK Department for Education Plain Language — gunakan bahasa pengguna dan kalimat pendek: https://design.education.gov.uk/content-design/plain-language
- W3C WCAG 2.2 — ukuran target minimum, akses keyboard/focus, drag alternative dan aksesibilitas: https://www.w3.org/TR/WCAG22/

