# Status pemeriksaan source SIGNAL v1.2

Paket v1.2 menambahkan menu Absensi Guru serta menggabungkan UI absensi dengan persistensi IndexedDB lokal. Status ini membedakan perubahan source dari pemeriksaan yang belum dijalankan.

## Perubahan yang diterapkan langsung pada source
- Menu `Absensi Guru` sudah terhubung pada navigasi utama.
- Input massal harian per tanggal untuk guru aktif dengan penyimpanan sekaligus.
- Input bulanan untuk semua guru aktif atau subset guru; memakai hari aktif, melewati hari libur, dan meminta konfirmasi ketika menimpa catatan.
- Input individual untuk guru/tanggal dengan catatan opsional.
- Rekap bulanan dengan pilihan bulan dan ceklis guru, hitungan Hadir/Sakit/Izin/Alpa/Dinas luar/Belum diisi, ekspor CSV, dan dialog cetak yang diformat untuk A4 landscape agar bisa disimpan sebagai PDF.
- Pengaturan daftar tanggal hari libur; perubahan pada hari libur tidak menghapus catatan absensi yang sudah ada.
- Domain helper untuk tanggal lokal, penentuan hari kerja, dan rekap. Catatan absensi tersimpan di IndexedDB terpisah dari data jadwal untuk menghindari migrasi/risiko merusak database yang ada.
- Versi package dinaikkan ke 1.2.0 dan spesifikasi fitur absensi ditambahkan.

## Keterbatasan yang diketahui
- Data absensi belum digabungkan ke backup/restore workspace jadwal; ekspor CSV atau PDF rekap sebagai salinan berkala.
- Data tersimpan lokal pada browser/perangkat saat ini dan tidak disinkronkan antar perangkat.
- “Cetak / Simpan PDF” menggunakan print dialog browser; pengguna perlu memilih “Simpan sebagai PDF”.
- Tipe slot aktivitas, Quick Validation Report, drag-and-drop tervalidasi, statistik beban guru khusus, serta ekspor PDF jadwal belum diklaim selesai hanya karena ada di prompt.

## Pemeriksaan build/test
Percobaan `npm install --no-audit --no-fund` pada lingkungan penyusunan ini mengalami timeout, jadi `npm test` dan `npm run build` belum berhasil dijalankan. Jangan menafsirkan hal ini sebagai tes lulus. Setelah dependensi tersedia, jalankan:

```bash
npm install
npm test
npm run build
```

Perbaiki semua error yang muncul; jangan melemahkan constraint generator/validator untuk meloloskan build.
