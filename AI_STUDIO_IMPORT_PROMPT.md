# Prompt untuk Google AI Studio Build

Project ini adalah SIGNAL, aplikasi penjadwalan pelajaran MTs berbahasa Indonesia. Pertahankan gaya visual custom premium Deep Teal + warm ivory + brass, tipografi, spacing, dashboard, grid jadwal, dan komponen yang sudah ada. Jangan ganti menjadi template dashboard default.

Aturan wajib:
1. Pertahankan React + TypeScript dan struktur domain `src/domain`.
2. Generator dan validator harus deterministik dan menjadi sumber keputusan final. Gemini tidak boleh menyatakan jadwal valid, mengubah data, menerbitkan jadwal, atau melewati hard constraint.
3. Pertahankan IndexedDB local-first dan backup/restore JSON. Jangan tambahkan Firebase/database berbayar sebagai dependensi wajib.
4. Gemini assistant opsional dan OFF secara default. Jangan menaruh GEMINI_API_KEY di browser, `VITE_*`, localStorage, URL, atau source yang dikirim ke klien.
5. Endpoint AI hanya boleh di server, harus memvalidasi input, membatasi request, menangani error, serta mengembalikan penjelasan saja.
6. Deployment sengaja publik tanpa login sesuai keputusan operator. Beri peringatan jelas bahwa siapa pun yang mengetahui URL dapat membuka app; jika Gemini dimatikan, tidak ada risiko penyalahgunaan kuota Gemini dari endpoint aplikasi.
7. Pertahankan status generator `SUCCESS`, `INVALID_INPUT`, `SEARCH_LIMIT_REACHED`, `INFEASIBLE`, dan `FAILED` dengan arti berbeda. `SEARCH_LIMIT_REACHED` tidak boleh disebut jadwal mustahil.
8. Jangan menghapus data demo sebelum operator memilih reset atau impor. Jangan mengubah master/requirements saat generator berjalan tanpa revalidasi.
9. Setelah perubahan, jalankan test dan build bila fasilitas terminal tersedia. Perbaiki error yang ditemukan tanpa mengurangi hard constraints.

Tugas pertama: audit project, build dan jalankan aplikasi. Laporkan semua error yang benar-benar ditemukan, lalu perbaiki dengan patch minimal. Jangan mengklaim test lulus jika tidak dijalankan.
