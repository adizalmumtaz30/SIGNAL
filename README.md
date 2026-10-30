# SIGNAL — Google AI Studio Project v1.2

Aplikasi workspace penjadwalan pelajaran MTs berbahasa Indonesia. Project source code ini menggunakan React + TypeScript + Vite, penyimpanan lokal IndexedDB, generator pencarian deterministik, dan validator hard-constraint. Arah visual aktif: Islamic School Bento berdasarkan mockup gambar dashboard madrasah terbaru — pale mint, teal/emerald, ilustrasi sekolah Islam, dan komposisi bento selektif. Bukan Atelier Luxury atau Quiet Luxury. Lihat dokumen di `docs/`.

## Status

Ini adalah **implementasi MVP yang dapat dibangun**, bukan klaim bahwa seluruh skenario produksi telah diverifikasi oleh sekolah. Data awal adalah data DEMO sintetis. Ganti data demo sebelum dipakai untuk jadwal sebenarnya.

## Pembaruan v1.2

- Menambahkan menu Absensi Guru dengan input harian massal, input status bulanan untuk semua guru atau guru yang dipilih, input individual, rekap dengan pilihan bulan dan guru, ekspor CSV, dan cetak / Simpan PDF melalui dialog print browser.
- Menambahkan pengaturan tanggal hari libur; tanggal libur dikecualikan dari input massal bulanan dan hitungan hari kerja pada rekap. Catatan individual khusus pada hari libur tetap dapat disimpan setelah konfirmasi.
- Catatan absensi dan daftar hari libur disimpan pada IndexedDB lokal terpisah agar perubahan tidak mengganggu penyimpanan jadwal lama. Data tidak tersinkron antar perangkat. Detail alur dan uji penerimaan: `docs/FEATURE_ABSENSI_GURU.md`.

## Riwayat arah visual v1.1

- Quiet Luxury adalah eksplorasi visual sebelumnya. Arah aktif kini digantikan Islamic School Bento berdasarkan mockup gambar madrasah terbaru; histori sebelumnya tetap dipertahankan.
- Pilihan hari di UI kini mencakup Senin–Sabtu; default demo tetap Senin–Jumat.
- Prompt implementasi bertahap untuk tipe slot aktivitas, laporan validasi cepat, drag-and-drop tervalidasi, statistik beban guru, dan ekspor PDF disertakan. Fitur-fitur tersebut harus diaudit dan diimplementasikan serta diuji di Google AI Studio; keberadaannya dalam prompt bukan bukti bahwa semuanya sudah tersedia di kode.

## Fitur yang tersedia

- Dashboard ringkasan, jadwal kelas per hari/JP, data master kelas/guru/mapel, kebutuhan JP.
- Absensi guru: input massal per tanggal, penerapan status bulanan untuk semua atau guru tertentu (dengan konfirmasi saat menimpa), catatan per guru, rekap guru/bulan yang dapat dipilih, ekspor CSV, cetak / Simpan PDF, serta kalender hari libur.
- Generator kandidat deterministic-seeded dengan status eksplisit `INVALID_INPUT`, `SEARCH_LIMIT_REACHED`, `INFEASIBLE`, `SUCCESS`, atau `FAILED`.
- Validator deterministik untuk bentrok kelas/guru, kualifikasi guru, batas beban mingguan, alokasi JP, blok mapel, dan aturan guru multi-mapel setelah jeda.
- Draft dan penerbitan versi jadwal, riwayat snapshot, edit sel, ekspor CSV, dan backup/restore JSON dengan checksum.
- IndexedDB local-first; tidak ada database cloud bersama yang diwajibkan.
- Gemini endpoint opsional di server, nonaktif secara default. Fitur inti tidak memerlukan Gemini API.

## Mulai secara lokal

Memerlukan Node.js 20+ dan npm.

```bash
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite (biasanya `http://localhost:5173`). Server opsional berjalan di port 8788. Tanpa API key, endpoint Gemini akan tetap nonaktif dan fitur penjadwalan tetap bisa digunakan.

Perintah pemeriksaan:

```bash
npm test
npm run build
```

## Impor ke Google AI Studio Build

Google AI Studio Build secara resmi mendokumentasikan impor project yang sudah ada melalui GitHub. Impor ZIP langsung tidak saya asumsikan tersedia pada UI semua akun.

1. Ekstrak ZIP ini ke folder lokal.
2. Buat repository baru di GitHub. Karena aplikasi menyimpan data secara lokal tetapi URL hasil deployment tetap publik, pertimbangkan repository Private jika alur impor akun Anda mendukungnya. Jangan unggah `.env`, API key, data jadwal asli, atau backup berisi data sekolah.
3. Dari folder project, jalankan:

   ```bash
   git init
   git add .
   git commit -m "Initial SIGNAL Google AI Studio project"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPOSITORY.git
   git push -u origin main
   ```

4. Buka Google AI Studio → Build → Add files (+) → Import from GitHub → pilih repository → impor project.
5. Minta AI Studio mempertahankan aturan domain dan validator. Jalankan build/test setelah setiap perubahan AI-generated.

Dokumentasi resmi: https://ai.google.dev/gemini-api/docs/aistudio-build-mode

## Gemini API dan keamanan

- Default `ENABLE_GEMINI_ASSISTANT=false`. Jangan aktifkan hanya demi membuat aplikasi terlihat canggih; assistant bukan komponen penting generator.
- Jika ingin mengaktifkan, simpan `GEMINI_API_KEY` sebagai **server-side secret** melalui fasilitas secrets/environment variables yang sesuai. Jangan pernah menaruh API key pada `VITE_*`, source React, localStorage, URL, atau repositori.
- Endpoint `/api/ai/explain` hanya menjelaskan konflik/pertanyaan; ia tidak mengubah jadwal atau menentukan validitas.
- Throttling pada server adalah pertahanan dasar, bukan jaminan anti-abuse. Project yang dipublikasikan tanpa autentikasi tetap dapat diakses siapa pun yang mengetahui URL; mereka berpotensi menghabiskan kuota jika Gemini diaktifkan. Untuk baseline gratis publik, biarkan Gemini OFF.
- Kuota gratis dan kelayakan deploy tanpa billing mengikuti kebijakan serta kelayakan akun Google yang berlaku. Jangan aktifkan billing/langganan tanpa persetujuan operator.

## Cara kerja validator

Generator mencari kandidat. Validator memeriksa kandidat terhadap aturan kode. Saran AI tidak pernah dianggap sebagai bukti bahwa jadwal valid. Kandidat hanya boleh diterbitkan setelah validasi final berhasil.

## Catatan absensi guru

- Rekap menghitung hanya hari kerja berdasarkan hari aktif di Pengaturan jadwal, dikurangi tanggal yang dicatat sebagai hari libur. Hari Minggu tidak termasuk hari aktif yang tersedia di model.
- Penerapan status bulanan mengisi satu status pada seluruh hari kerja di bulan terpilih untuk cakupan guru yang dipilih. Gunakan input harian atau per guru untuk mengoreksi pengecualian. Data lama yang akan ditimpa memerlukan konfirmasi.
- Cetak / Simpan PDF memakai dialog cetak browser. Pilih “Save as PDF” / “Simpan sebagai PDF” pada tujuan printer untuk membuat berkas PDF.
- Penyimpanan absensi terpisah dari backup workspace jadwal saat ini. Ekspor rekap CSV atau PDF secara berkala untuk menyimpan salinan di luar browser. Menghapus data situs/browser dapat menghilangkan data lokal.

## Batas implementasi MVP

- Demo data bukan data sekolah sebenarnya.
- Penyimpanan IndexedDB berlaku pada browser/perangkat itu saja; data tidak disinkronkan otomatis antar perangkat.
- Tidak ada autentikasi aplikasi; hosting tetap publik sesuai keputusan operator.
- Kualitas generator untuk dataset besar perlu diuji dengan master data nyata dan beberapa seeded schedules. `SEARCH_LIMIT_REACHED` bukan bukti jadwal mustahil.
- Uji build/unit membantu, tetapi belum menggantikan uji penerimaan operator, pemulihan backup, dan pemeriksaan akses deployment.
