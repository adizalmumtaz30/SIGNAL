# SIGNAL — Audit, Diskusi, Keputusan Produk & Redesign UI/UX

Tanggal konsolidasi: 30 Oktober 2026  
Repo: `adizalmumtaz30/SIGNAL`  
Basis kode: `ui/quiet-luxury-refresh`  
Branch redesign: `redesign/islamic-bento-2026`

Dokumen ini menggabungkan hasil diskusi, rekaman aplikasi, pemeriksaan PDF, audit source code, spesifikasi SIGNAL v1.2, arah visual terbaru, serta keputusan implementasi. Dokumen membedakan **observasi**, **risiko kode**, **keputusan**, dan **pekerjaan verifikasi** agar dugaan tidak berubah menjadi fakta.

## 1. Ringkasan keputusan yang mengikat

1. Arah visual aktif adalah **mockup gambar dashboard madrasah terbaru** yang menampilkan sidebar hijau, ilustrasi kampus/madrasah Islam, hero landscape, permukaan putih-mint, teal, aksen hangat, jadwal mingguan, ringkasan, dan kartu-kartu fungsional. Mockup ini menggantikan arah visual sebelumnya.
2. Kombinasi gaya: **Neumorphism + Flat Design + Minimalism + Material Design + Bento UI 2026**, diterapkan secara selektif per komponen, bukan dicampur rata.
3. **Bukan Atelier Luxury**, bukan Quiet Luxury lama, dan bukan HTML prototype sebelumnya sebagai acuan visual.
4. HTML prototype 5-in-1 hanya artefak eksplorasi interaksi; bukan sumber kebenaran visual.
5. Visual dan layout boleh berubah drastis (target perubahan visual sekitar 95%), tetapi fitur, aturan domain, data, dan perilaku bisnis yang ada harus dipertahankan kecuali ada bug yang sengaja diperbaiki dan diuji.
6. Larangan keras AI slop: tidak memakai layout template generik tanpa alasan, copy dekoratif, kartu berulang tanpa hierarki, chart palsu, metrik palsu, ikon acak, efek animasi yang tidak bermakna, atau teks filler.
7. Larangan skeuomorphism tetap berlaku. Permintaan neumorphism terbaru ditafsirkan sebagai **soft neumorphic accent yang sangat terbatas** (elevation ringan pada kontrol/surface tertentu), bukan skeuomorphic imitation, bevel, inset berlebihan, atau kontrol yang tampak seperti objek fisik.
8. Font utama: DM Sans untuk UI/data dan Manrope untuk heading/angka penting. Font harus punya fallback sistem; jangan menjadikan font eksternal sebagai syarat aplikasi bekerja.
9. Ikon: Lucide React yang sudah terpasang. Gunakan stroke konsisten, ukuran dan baseline seragam, ikon semantik; jangan gunakan emoji sebagai ikon UI.
10. Ilustrasi madrasah/sekolah Islam harus memperkaya beberapa area inti: sidebar bawah, hero dashboard, dan panel alokasi/generator bila relevan. Ilustrasi tidak boleh menutupi data atau mengganggu jadwal.
11. UI harus hemat dependensi, murah dioperasikan, mudah dirawat, responsif, accessible, dan data-first.
12. Jangan mengklaim skor 9+/10 sebelum pengujian visual, fungsional, responsive, keyboard, dan task usability dilakukan.

## 2. Sumber diskusi dan artefak yang digabungkan

- Rekaman aplikasi 26 Oktober 2026: `Recording 2026-10-26 101458.mp4`, sekitar 149 detik, bersama contact sheet dan frame audit.
- Rekaman aplikasi 30 Oktober 2026: `Recording 2026-10-30 105058.mp4`, sekitar 200 detik, bersama `audit_20261030_contact.jpg` dan frame-frame hasil ekstraksi.
- Backup data: `SIGNAL-backup-2026-10-23.json`.
- PDF jadwal: `SIGNAL_Jadwal_Semua_Kelas_F4_2026_2027 (2).pdf`.
- Dokumen kebutuhan: `SIGNAL_16_Dokumen_Google_AI_Studio_v1_2.zip` (dokumen lebih baru daripada paket MD v2.0 sebelumnya; bertanggal 20 Oktober 2026).
- Mockup gambar dashboard madrasah terbaru: referensi visual otoritatif untuk implementasi ini.
- Mockup HTML terdahulu: dipertahankan sebagai riwayat eksplorasi, bukan acuan desain aktif.
- Repo dan branch dasar: `https://github.com/adizalmumtaz30/SIGNAL/tree/ui/quiet-luxury-refresh`.

## 3. Rekaman aplikasi — observasi lintas sesi

### 3.1 Rekaman 30 Oktober 2026

Contact sheet memperlihatkan operator melalui alur:
- Ringkasan penyusunan jadwal dan presensi.
- Pengaturan workspace.
- Dialog konfigurasi.
- Jadwal Pelajaran dan kontrol kelas.
- Matriks seluruh kelas dan editor per kelas.
- Tampilan distribusi paralel per kelompok/tingkat.
- Data guru/master.
- Kebutuhan dan alokasi.
- Validasi dan konflik.
- Ekspor dan backup.

Frame sekitar 54 detik memperlihatkan matriks satu kelas: kolom Senin–Sabtu, baris aktivitas non-KBM (Upacara Bendera, Istirahat) serta baris JP KBM. Kartu aktivitas terkunci, sementara slot KBM kosong/terisi memiliki kontrol edit. Frame sekitar 96 detik memperlihatkan matriks seluruh kelas yang dikelompokkan paralel; tiap kelas memiliki grid kecil dan ringkasan alokasi. Frame sekitar 132–186 detik menunjukkan alur data master, kebutuhan/alokasi, validasi, dan ekspor/backup.

**Implikasi UX:** jadwal adalah area kerja utama, bukan sekadar tabel laporan. Informasi aktivitas non-KBM harus terbaca sebagai bagian urutan waktu; JP KBM harus tetap dibedakan dari urutan aktivitas/jam ke-. Matriks seluruh kelas memiliki kepadatan tinggi sehingga butuh hierarki visual, zoom/scroll terkontrol, serta ringkasan yang tetap terbaca.

### 3.2 Rekaman 26 Oktober 2026

Rekaman sebelumnya digunakan sebagai konteks pemeriksaan halaman, tindakan operator, dan alur PDF/ekspor. Temuan yang didokumentasikan dari sesi itu:
- Sidebar memiliki 11 destinasi utama yang berpotensi membebani navigasi.
- Presensi Guru memuat banyak tab dan informasi bersaing.
- Ukuran teks pada label, tabel, dan sel jadwal terlalu kecil.
- Tabel responsif berpotensi memaksa horizontal scroll.
- Global search berlabel pencarian lintas entitas, tetapi perilakunya mengarahkan ke Data Master.
- PDF preview menunjukkan halaman lanjutan yang secara visual tampak memuat konten laporan ritel yang tidak berkaitan. **Belum terbukti berasal dari output SIGNAL**; wajib direproduksi dengan file unik sebelum menetapkan penyebab.

## 4. Audit source code — temuan dan prioritas

### P0 — risiko integritas jadwal

**P0.1 Mapping target Drag & Drop**
Lokasi: `src/App.tsx`, sekitar baris 312 pada snapshot yang diaudit.

Kode lama mencocokkan `s.order === target.jpNo` atau `s.kind === 'TEACHING' && s.jpNo === target.jpNo`. Ini mencampur urutan semua aktivitas (`order`) dengan nomor JP KBM (`jpNo`). Ketika Upacara/Istirahat/non-KBM hadir, indeks bisa tidak sepadan.

Keputusan: resolusi target wajib berdasarkan hari, slot aktif, `kind === 'TEACHING'`, dan `jpNo` yang tepat. Jika target tidak ditemukan atau bukan slot KBM aktif, drop ditolak tanpa mutasi.

**P0.2 Validasi target editor manual**
Lokasi: `openSlotEditor` / `saveSlotEditor` sekitar baris 386–410.

Keputusan: sebelum menyimpan, editor harus memastikan slot hari/JP memang slot KBM aktif. Validator tetap menjadi otoritas akhir untuk draft/publish; guard UI bukan pengganti validator.

**P0.3 Baris aktivitas non-KBM di matriks jadwal**
Lokasi: `ScheduleScreen` sekitar baris 1480–1600.

Risiko: baris matriks dibangun dari jumlah `teachingPeriodsPerDay`; aktivitas Upacara/Religi/Istirahat/Kegiatan Lain tidak selalu tampil sebagai baris kronologis yang tepat. Pemeriksaan blocked terhadap slot yang sudah TEACHING tidak cukup untuk merepresentasikan aktivitas non-KBM.

Keputusan: tampilkan seluruh slot kegiatan sesuai urutan waktu; bedakan label jam-ke, nomor JP KBM, waktu, jenis aktivitas, dan status terkunci. Non-KBM tidak dihitung sebagai JP KBM dan tidak dapat ditimpa pelajaran.

### P1 — alur dan keterbacaan

**P1.1 Navigasi 11 destinasi**
Saat ini ada Beranda, Jadwal, Beban Guru, Absensi Guru, Generator, Data Master, Kebutuhan & Alokasi, Validasi & Konflik, Riwayat Versi, Ekspor & Backup, Pengaturan.

Keputusan: kelompokkan navigasi dengan hierarki yang lebih jelas, tetapi jangan menghilangkan layar, fitur, atau kemampuan mencapai halaman. Navigasi dapat memakai section labels dan pengelompokan:
- Beranda
- Jadwal: Matriks/Editor, Generator, Validasi, Riwayat
- Presensi Guru
- Data Akademik: Kelas, Guru, Mapel
- Alokasi & Beban
- Data & Ekspor
- Pengaturan

Implementasi harus tetap mempertahankan deep navigation ke semua 11 screen ID.

**P1.2 Pencarian global**
Placeholder lama “Cari kelas, guru, atau mapel…” tetapi Enter hanya mengatur `masterSearch` lalu membuka Data Master.

Keputusan: untuk perubahan visual awal, label harus jujur: “Cari di Data Master: kelas, guru, mapel…”. Implementasi pencarian lintas aplikasi hanya boleh dilakukan jika benar-benar menambahkan perilaku yang lengkap dan diuji.

**P1.3 Presensi Guru**
`AttendanceScreen.tsx` memiliki lima tab: Input Massal Harian, Input Bulanan, Input per Guru, Rekap Bulanan & PDF, Pengaturan Hari Libur. Intro panjang dan banyak kontrol bersaing.

Keputusan: rapikan hierarki, ringkas instruksi, prioritaskan tanggal/periode dan aksi utama, kelompokkan ringkasan/status/catatan. Pertahankan kelima tab dan seluruh fungsi. Jangan menambahkan fitur absensi baru.

**P1.4 Tabel dan responsivitas**
CSS lama memberi `min-width:720px` pada data table dan `790px` pada schedule table; wrapper bisa memicu horizontal overflow.

Keputusan: prioritaskan kolom inti, gunakan detail baris/stacking bila sesuai, dan scroll horizontal hanya pada area tabel yang memang memerlukan grid. Tidak boleh membuat seluruh halaman ikut melebar.

**P1.5 Ukuran teks**
Audit lama menemukan label sidebar 8px, nav 11px, KPI/secondary 7–9px, sel jadwal 7–8px, header tabel 7px, body 9px.

Keputusan: target teks data utama 12–14px, kontrol 12–13px, tabel umum 12–14px; label sekunder jangan menjadi informasi satu-satunya. Sel matriks boleh padat, tetapi tetap harus terbaca pada resolusi penggunaan yang ditargetkan.

### P2 — konsistensi visual

- Kurangi inline style fragmentation secara bertahap; gunakan design tokens dan shared styles.
- Hindari emoji di opsi aktivitas dan status presensi; gunakan teks dan indikator/badge. Jangan menaruh Lucide component dalam native `<option>`.
- Standarkan action button ukuran, tooltip, aria-label, hover, focus, dan destructive states.
- Microcopy: judul + instruksi ringkas; jangan menghapus hard constraint, konsekuensi destruktif, atau alasan error.
- Animasi singkat, fungsional, dan menghormati `prefers-reduced-motion`.

## 5. Audit PDF dan data

PDF jadwal yang diperiksa berformat F4 dan empat halaman. Catatan audit sebelumnya:
- Judul menyebut “SATU HALAMAN A4” padahal dokumen F4 empat halaman.
- Halaman pertama sebagian besar kosong dengan judul/footer.
- Halaman 2–3 berisi jadwal; halaman 4 rekap.
- Ada catatan halaman 3 yang menyebut rekap di halaman 2.
- Dataset PDF yang terlihat berisi 166 JP dengan IX-A 6 dan IX-B 0; backup JSON berikutnya memuat 4 kelas/160 JP. Ini mungkin perbedaan dataset atau versi; belum boleh disimpulkan sebagai bug tanpa menyamakan snapshot.
- Preview halaman lanjutan pada rekaman tampak menampilkan teks laporan ritel yang tidak relevan. Ini temuan visual yang harus direproduksi, bukan bukti final sumber kesalahan.

Keputusan:
1. Uji PDF dari snapshot data yang diketahui dan unik.
2. Periksa seluruh halaman, ukuran kertas, judul, footer, nomor halaman, tabel terpotong, halaman kosong, dan konsistensi total.
3. Jangan klaim “satu halaman” jika hasilnya multipage.
4. Filename dan metadata ekspor harus membantu mengidentifikasi workspace, jenis laporan, kelas/guru, dan tanggal.
5. Pastikan PDF sekolah/kelas/guru tetap tersedia dan hasil A4 profesional tanpa clipping sesuai kebutuhan.

## 6. Produk dan domain rules yang tidak boleh berubah

- Aplikasi publik tanpa autentikasi; operator menerima risiko dan bertanggung jawab atas data/perangkat/backup. Jangan mengklaim aplikasi private/operator-only atau keamanan terjamin.
- Local-first: data utama berada di IndexedDB browser/perangkat operator; baseline gratis tidak memiliki database cloud bersama atau sinkronisasi lintas perangkat otomatis.
- Gemini opsional dan OFF secara default. Aplikasi harus berfungsi penuh saat AI OFF.
- Jika Gemini diaktifkan: panggilan server-side, secret store, minimal data, timeout/rate limit, emergency OFF switch. Endpoint publik memiliki risiko penyalahgunaan dan kuota.
- Generator dan validator deterministik. Gemini tidak boleh memutuskan validitas, mengubah hard constraint, atau menandai jadwal valid.
- Hari Jumat adalah hari belajar. Hari aktif dapat dipilih Senin–Sabtu; Jumat tidak boleh hilang dari setup, jadwal, generator, validasi, atau ekspor.
- Maksimal awal 10 JP KBM/hari, dapat dikonfigurasi per hari.
- “Jam ke-” berbeda dari JP KBM; jeda/aktivitas non-KBM tidak dihitung sebagai JP KBM.
- Maksimal satu blok mapel 3 JP berturut-turut per kelas per hari adalah hard constraint.
- Preferensi 2 blok JP pada hari aktif adalah soft preference.
- Aturan multi-mapel guru setelah istirahat: 1 JP sebelum istirahat → maksimal 3 JP sesudahnya; 2 JP sebelum → maksimal 2 JP sesudahnya; 3 JP sebelum → maksimal 1 JP sesudahnya. Urutan sebelum istirahat tidak digabung lintas guru.
- Jenis aktivitas slot: Belajar Mengajar, Upacara, Istirahat, Religi, Kegiatan Lain. Aktivitas non-KBM tidak otomatis dihitung JP KBM; aktivitas blocking tidak dapat ditimpa pelajaran. Jam mulai/selesai harus tervalidasi.
- Status generator: `QUEUED`, `RUNNING`, `SUCCESS`, `INFEASIBLE`, `SEARCH_LIMIT_REACHED`, `INVALID_INPUT`, `CANCELLED`, `FAILED`.
- Kandidat terpilih menjadi draft. Edit/publish/restore harus revalidate. Publish membuat versi/snapshot lokal dan memverifikasi versi aktif.
- Quick Validation Report: tombol “Periksa Jadwal”, ringkasan/status/jumlah, konflik terkelompok, aksi lihat/perbaiki, print/export; validator deterministik otoritatif.
- Drag & Drop: validasi target sebelum commit; drop invalid ditolak; tersedia alternatif keyboard/form; undo jika memungkinkan.
- Statistik beban guru dari jadwal aktual: JP KBM, sesi, distribusi per hari, perbandingan, filter sederhana.
- PDF sekolah/kelas/guru: profesional A4, tidak clipping, filename jelas.
- Tidak menambahkan fitur presensi baru; hanya meredesain UI fitur yang sudah ada.
- Tidak menambahkan fitur AI Assistant baru; bantuan Gemini tetap terbatas pada penjelasan konflik/saran untuk fungsi yang sudah didukung.

## 7. Kriteria keberhasilan redesign

- 100% screen ID/fungsi saat ini tetap dapat dicapai.
- Tidak ada perubahan business/domain rules hanya karena visual.
- Build TypeScript/Vite lulus.
- Unit tests generator, time, validator, workload/PDF lulus.
- Manual regression untuk generate → draft → edit → validate → publish → history → restore.
- Manual regression untuk semua tab presensi, data master, alokasi, pengaturan hari/aktivitas, backup/restore, dan PDF.
- Keyboard navigation, focus-visible, reduced motion, contrast, responsive 320px/375px/768px/1280px+ diuji.
- Tabel dan matriks tidak membuat body overflow horizontal.
- Scorecard 9+/10 hanya setelah evidence dan task-based testing; jika belum diuji, tulis “belum dinilai”.

## 8. Hal yang belum boleh dianggap selesai

- Asal konten ritel yang tampak pada preview PDF.
- Apakah perbedaan 160 vs 166 JP berasal dari dataset atau perhitungan.
- Apakah semua kombinasi aktivitas non-KBM sudah diuji di seluruh alur DnD dan editor.
- Apakah semua layar lolos aksesibilitas dan responsive testing.
- Skor usability/visual 9+.
