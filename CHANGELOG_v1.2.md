# SIGNAL Project v1.2 — catatan perubahan

## Dikerjakan di paket ini
- Menambahkan menu **Absensi Guru** yang berfungsi: input massal per hari, penerapan status ke semua guru atau guru terpilih untuk satu bulan, input satu guru per tanggal beserta catatan, rekap bulanan dengan filter bulan dan ceklis guru, ekspor CSV, cetak / Simpan PDF, serta pengaturan hari libur.
- Menambahkan domain absensi untuk perhitungan hari kerja, label status, serta ringkasan rekap; dan penyimpanan IndexedDB lokal untuk catatan dan hari libur.
- Penyempurnaan UI ke arah quiet luxury: tenang, elegan, matang, profesional; mengurangi gradien, bayangan, dan ornamen.
- Model daftar hari kini memuat Senin–Sabtu; default demo masih Senin–Jumat.
- Prompt implementasi AI Studio diperbarui untuk fitur terbaru dan memerintahkan audit, implementasi, pengujian, serta pelaporan status yang jujur.
- Dokumen spesifikasi SIGNAL v1.2 disertakan di `docs/spec-v1.2/`.

## Pengujian dan batas penting
- `npm install` tidak selesai pada lingkungan penyusunan ini (timeout), jadi `npm test` dan `npm run build` belum berhasil dijalankan. Jalankan pemeriksaan tersebut setelah ZIP diekstrak di lingkungan yang dependensinya dapat dipasang.
- Cetak / Simpan PDF menggunakan dialog print browser, bukan file PDF yang dibuat langsung oleh library PDF.
- Data absensi tersimpan lokal di IndexedDB terpisah; data belum masuk ke file backup workspace jadwal. Ekspor rekap CSV/PDF secara berkala.
Tipe slot aktivitas, laporan validasi cepat, drag-and-drop dengan rollback, statistik beban guru, dan ekspor PDF jadwal masih perlu diimplementasikan dan diuji di AI Studio sesuai urutan pada `AI_STUDIO_IMPORT_PROMPT.md`. Fitur absensi di paket ini juga perlu menjalani build/test lengkap dan uji penerimaan operator.
