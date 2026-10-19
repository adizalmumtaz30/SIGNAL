# SIGNAL — Google AI Studio Project v1.0

Aplikasi workspace penjadwalan pelajaran MTs berbahasa Indonesia. Project source code ini menggunakan React + TypeScript + Vite, penyimpanan lokal IndexedDB, generator pencarian deterministik, dan validator hard-constraint. UI dibuat khusus dengan gaya Deep Teal, warm ivory, dan aksen brass; bukan template dashboard default.

## Status

Ini adalah **implementasi MVP yang dapat dibangun**, bukan klaim bahwa seluruh skenario produksi telah diverifikasi oleh sekolah. Data awal adalah data DEMO sintetis. Ganti data demo sebelum dipakai untuk jadwal sebenarnya.

## Fitur yang tersedia

- Dashboard ringkasan, jadwal kelas per hari/JP, data master kelas/guru/mapel, kebutuhan JP.
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

## Batas implementasi MVP

- Demo data bukan data sekolah sebenarnya.
- Penyimpanan IndexedDB berlaku pada browser/perangkat itu saja; data tidak disinkronkan otomatis antar perangkat.
- Tidak ada autentikasi aplikasi; hosting tetap publik sesuai keputusan operator.
- Kualitas generator untuk dataset besar perlu diuji dengan master data nyata dan beberapa seeded schedules. `SEARCH_LIMIT_REACHED` bukan bukti jadwal mustahil.
- Uji build/unit membantu, tetapi belum menggantikan uji penerimaan operator, pemulihan backup, dan pemeriksaan akses deployment.
