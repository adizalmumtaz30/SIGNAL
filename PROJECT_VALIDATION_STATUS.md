# Status pemeriksaan source SIGNAL v1.0

Tanggal pemeriksaan: 19 Oktober 2026.

## Pemeriksaan yang berhasil

- Semua file TypeScript/TSX diparse/transpile untuk memastikan tidak ada diagnostic sintaks.
- Modul domain (`types`, `time`, `seed`, `validator`, `generator`) lolos pemeriksaan TypeScript strict dengan compiler TypeScript tersedia di lingkungan kerja.
- Smoke test domain yang dijalankan langsung terhadap hasil kompilasi:
  - kasus kecil yang feasible menghasilkan kandidat valid;
  - dataset demo menghasilkan 160 penempatan dan lolos validator;
  - bentrok guru pada slot yang sama ditolak;
  - ID issue konsisten untuk input yang sama;
  - blok mapel 4 JP berturut-turut ditolak;
  - batas guru multimapel setelah istirahat diperiksa;
  - struktur waktu 8 JP dan 10 JP dengan banyak istirahat tidak memiliki sela/overlap waktu.
- Pemeriksaan statis tambahan mendeteksi dan memperbaiki beberapa kesalahan source sebelum paket disiapkan.

## Pemeriksaan yang belum dapat diselesaikan di lingkungan ini

`npm install` tidak selesai karena registry npm tidak dapat di-resolve (DNS `EAI_AGAIN`). Karena dependensi tidak berhasil dipasang, `npm run build` penuh menggunakan Vite dan `npm test` melalui Vitest **belum dapat dijalankan di lingkungan ini**. Project memiliki script untuk menjalankan kedua perintah tersebut setelah paket npm dapat diakses, misalnya setelah diimpor ke Google AI Studio atau di komputer dengan koneksi jaringan.

Karena itu, statusnya adalah **domain smoke tests lulus, full dependency build belum diverifikasi**; jangan menafsirkannya sebagai sertifikasi produksi. Jalankan `npm install`, `npm test`, dan `npm run build` setelah impor, serta lakukan uji penerimaan dengan data nyata yang telah disamarkan.
