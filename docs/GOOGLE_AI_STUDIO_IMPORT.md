# SIGNAL — Google AI Studio Import & Handoff

## 1. Tujuan

Paket ini ditujukan sebagai source project React + TypeScript + Vite yang dapat diunduh, diekstrak, lalu diimpor/dibuka di Google AI Studio Build mode atau lingkungan Node/Vite yang kompatibel.

## 2. Yang harus dibawa

- Source code aplikasi utuh.
- `package.json` dan lockfile yang ada.
- `src/domain`, `src/storage`, `src/components`, `src/utils`.
- `public/illustrations/madrasah-campus.svg`.
- Design system dan audit docs.
- `AI_STUDIO_IMPORT_PROMPT.md`.
- `.env.example` tanpa secret.
- Test suite.

## 3. Import workflow

1. Unduh ZIP branch redesign dari GitHub:  
   `https://github.com/adizalmumtaz30/SIGNAL/archive/refs/heads/redesign/islamic-bento-2026.zip`
2. Ekstrak arsip.
3. Buka Google AI Studio → Build mode dan pilih opsi import/upload project ZIP bila tersedia pada UI akun saat digunakan. Jika UI berubah atau upload ZIP tidak tersedia, gunakan source folder melalui workflow GitHub/import yang disediakan AI Studio.
4. Minta AI Studio mempertahankan project structure dan domain code. Jangan meminta scaffold ulang dari nol.
5. Install dependencies sesuai package manager/lockfile. Gunakan Node 20+ sesuai engines.
6. Jalankan build dan tests sebelum melakukan perubahan lanjutan.

## 4. Prompt untuk AI Studio

Baca `README.md`, `docs/REDESIGN_AUDIT_AND_DECISIONS.md`, `docs/DESIGN_SYSTEM.md`, `docs/REFERENCE_TRACEABILITY.md`, `docs/IMPLEMENTATION_STATUS.md`, dan `AI_STUDIO_IMPORT_PROMPT.md` terlebih dahulu.

Instruksi:
- Jangan menghapus fitur, domain rules, IndexedDB schema, validator, generator, PDF export, backup/restore, presensi, history, atau data master.
- Visual reference utama adalah mockup gambar dashboard madrasah terbaru yang ditetapkan dalam docs; bukan Atelier Luxury, bukan Quiet Luxury, bukan HTML prototype lama.
- Jangan melakukan rewrite domain engine kecuali memperbaiki bug dengan test yang membuktikan.
- Jalankan `npm test` dan `npm run build`; perbaiki error tanpa mengurangi coverage.
- Gemini tetap OFF default dan aplikasi harus berjalan saat AI OFF.
- Jangan menambahkan autentikasi, cloud sync, attendance features baru, atau AI assistant baru.
- Laporkan file yang berubah, hasil build/test, dan risiko yang belum diuji.

## 5. Batasan

- Baseline local-first berarti data disimpan pada browser/perangkat; tidak ada sync otomatis lintas perangkat.
- Jangan menaruh Gemini API key pada frontend atau commit secret.
- Google AI Studio availability, import affordances, runtime, dan quota dapat berubah; ikuti UI dan dokumentasi resmi yang tersedia pada saat import.
- Jangan menganggap hosting atau kuota layanan gratis tidak terbatas.
