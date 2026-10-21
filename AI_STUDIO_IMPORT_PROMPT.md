# Prompt untuk Google AI Studio Build — SIGNAL v1.2

Project ini adalah SIGNAL, aplikasi penjadwalan pelajaran MTs dengan menu Absensi Guru. Lakukan audit kode dan tes terlebih dahulu. Pertahankan fitur absensi yang sudah ditambahkan pada `src/features/AttendanceScreen.tsx`, `src/domain/attendance.ts`, dan `src/storage/attendance.ts`; perbaiki kekurangan yang ditemukan, jangan menghapus atau mengganti aplikasi dengan template baru.

## Fitur Absensi Guru — jaga dan verifikasi implementasi
1. Menu `Absensi Guru` terhubung dari navigasi utama.
2. `Input harian`: pilih tanggal, isi status masing-masing guru, dan simpan sekaligus untuk guru aktif.
3. `Input bulanan`: terapkan status pada seluruh hari kerja bulan terpilih dengan cakupan semua guru aktif atau guru yang dicentang. Wajib konfirmasi sebelum menimpa catatan lama. Abaikan tanggal libur dan hari di luar `activeDays`.
4. `Per guru`: ubah status satu guru pada tanggal tertentu dengan catatan opsional. Catatan pada hari libur hanya bisa diteruskan setelah konfirmasi.
5. `Rekap bulanan`: pilih bulan dan centang guru yang dirangkum; tampilkan Hadir, Sakit, Izin, Alpa, Dinas luar, Belum diisi, dan Hari kerja. Tambahkan ekspor CSV serta Cetak / Simpan PDF dengan format A4 landscape, header, kolom tidak terpotong, dan ruang tanda tangan.
6. `Hari libur`: tambah, ubah dengan tanggal yang sama, dan hapus tanggal libur dengan konfirmasi. Hari libur mengurangi hari kerja yang diharapkan; menghapus penandaan libur tidak boleh menghapus absensi yang sudah ada.
7. Data disimpan lokal di IndexedDB terpisah dari database jadwal agar migrasi tidak merusak data lama. Jelaskan bahwa data tidak disinkronkan. Jangan mengklaim absensi sudah termasuk backup workspace sebelum itu benar-benar diimplementasikan.
8. Status catatan: Hadir, Sakit, Izin, Alpa, Dinas luar. Catatan tanggal di luar hari aktif tidak dihitung di rekap, tapi jangan dihapus otomatis.

## Prioritas produk
1. **UI luxury, modern, elegant**: tenang, eksklusif, matang, profesional. Gunakan Deep Teal, Warm Ivory, dan aksen Champagne/Brass secukupnya. Hindari gradien mencolok, emoji dekoratif, border tebal, terlalu banyak warna, efek glassmorphism, dan kartu berlebihan. Animasi singkat, halus, dan tidak menghambat pekerjaan. Hormati `prefers-reduced-motion`.
2. **Alur operator ringkas**: tombol utama jelas, minim klik, sedikit scroll, bahasa Indonesia sehari-hari. Ringkasan dahulu; rincian melalui “Lihat detail”. Kelompokkan data serupa dan gunakan pencarian/filter/paginasi bila diperlukan. Jangan membuat bagian rekomendasi atau panel rekomendasi baru; fokus pada peningkatan UI dan alur kerja inti.
3. **Hari aktif**: Senin–Sabtu dapat dipilih dari Pengaturan. Sabtu tidak harus aktif secara default. Pastikan validator, generator, kapasitas, header jadwal, laporan, dan pengujian mengikuti hari aktif yang dipilih.
4. **Tipe slot waktu**: operator dapat menentukan tipe per slot/jam ke-: Belajar Mengajar, Upacara, Istirahat, Religi, atau Kegiatan Lain. Pisahkan nomor urut “Jam ke-” dari JP KBM. Hanya slot bertipe Belajar Mengajar yang dihitung sebagai JP kebutuhan/beban guru dan menjadi tempat penempatan mapel. Tipe lain harus punya label dan rentang waktu; perubahan skema perlu migrasi aman dan pengujian. Jangan mengubah data lama diam-diam.
5. **Laporan validasi cepat**: tampilkan status valid/belum valid, jumlah masalah wajib, peringatan, dan tindakan singkat. Rincian dibuka hanya saat diminta. Validator deterministik tetap satu-satunya penentu validitas.
6. **Editor jadwal**: tambahkan drag-and-drop hanya jika bisa divalidasi sebelum disimpan. Drop yang melanggar aturan harus ditolak, rollback ke posisi semula, dan menjelaskan sebabnya. Sediakan alternatif keyboard/form. Jangan mengubah draft secara permanen sebelum validasi lolos.
7. **Beban guru**: ringkasan dari jadwal nyata—JP KBM, sesi, distribusi per hari, batas mingguan. Jangan mengarang data atau menampilkan grafik dekoratif.
8. **Ekspor PDF**: sediakan ekspor/print-to-PDF untuk jadwal sekolah, kelas, dan guru. Pastikan A4, header periode, keterbacaan, dan tidak ada kolom terpotong. Jika implementasi menggunakan `window.print()`, sediakan stylesheet cetak khusus dan petunjuk cetak yang jelas.

## Batas teknis wajib
- Pertahankan React + TypeScript dan struktur `src/domain`.
- Generator dan validator tetap deterministik; Gemini tidak boleh menyatakan jadwal valid, mengubah data, menerbitkan jadwal, atau melewati hard constraint.
- IndexedDB local-first dan backup/restore JSON tetap berjalan. Jangan menambah database cloud berbayar sebagai dependensi wajib.
- Gemini opsional dan OFF secara default. Jangan pernah menaruh `GEMINI_API_KEY` di browser, `VITE_*`, localStorage, URL, atau source client.
- Aplikasi tetap tanpa login sesuai keputusan operator. Jangan menyebutnya khusus operator atau menjanjikan keamanan mutlak.
- Pertahankan status generator `SUCCESS`, `INVALID_INPUT`, `SEARCH_LIMIT_REACHED`, `INFEASIBLE`, `CANCELLED`, dan `FAILED` dengan makna berbeda. `SEARCH_LIMIT_REACHED` bukan bukti jadwal mustahil.
- Jangan menghapus data demo atau mengubah master/requirements tanpa tindakan operator yang eksplisit. Tambahkan migrasi skema yang aman dan backup sebelum perubahan struktur data.

## Urutan kerja
A. Audit kode dan status tes saat ini, khususnya semua jalur Absensi Guru.
B. Uji persistensi catatan dan hari libur setelah refresh, timpa data, pemilihan beberapa guru, batas bulan/tahun, bulan tanpa hari kerja, dan perubahan hari aktif.
C. Periksa rekap saat ada hari libur, status belum diisi, hari di luar kalender kerja, serta guru terpilih/tidak terpilih.
D. Periksa cetak / Simpan PDF di A4 landscape dan ekspor CSV.
E. Implementasikan tipe slot dan migrasi data, lalu perbarui generator/validator dan tes.
F. Implementasikan laporan validasi ringkas, ekspor PDF jadwal, statistik beban guru, dan editor drag-and-drop tervalidasi.
G. Selesaikan penyempurnaan visual, responsivitas, aksesibilitas, dan pengurangan scroll.
H. Jalankan `npm test` dan `npm run build` jika terminal tersedia. Laporkan tes yang benar-benar dijalankan, error yang ditemukan, serta fitur yang belum selesai. Jangan mengklaim fitur selesai jika baru berupa desain atau spesifikasi.
