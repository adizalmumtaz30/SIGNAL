# SIGNAL — Decision Log & Evolution

## Evolusi arah desain (tidak ada artefak lama yang dihapus)

| Urutan | Artefak/arah | Status | Keputusan |
|---|---|---|---|
| 1 | SIGNAL Scheduling Stack / dashboard exploration | Arsip eksplorasi | Menjadi masukan struktur dan prioritas data |
| 2 | Dashboard Desktop-First / Budget Simple | Arsip eksplorasi | Menjadi pembanding density dan layout |
| 3 | Workspace Redesign v3/v4 + all references | Arsip riset dan iterasi | Sumber catatan pola dan referensi |
| 4 | No-Slop Luxury Compact | Ditolak sebagai arah visual aktif | Prinsip anti-slop dipertahankan, tetapi bukan look yang dipakai |
| 5 | Quiet Luxury refresh branch | Baseline kode yang diwarisi | Tidak menjadi acuan visual akhir |
| 6 | Atelier Luxury | Secara eksplisit ditolak untuk redesign ini | Jangan gunakan palette/identity Atelier |
| 7 | Mockup gambar dashboard madrasah terbaru | **Visual source of truth** | Diikuti untuk warna, ilustrasi, layout, dan mood |
| 8 | Prototype HTML 5-in-1 | Artefak interaksi eksploratif | Bukan visual source of truth |
| 9 | Storyboard sekolah (tanpa Bento) | **Arah visual terbaru** | 11 frame adalah presentasi storyboard; layout produk tetap shell workspace standar dan ilustrasi harus berupa bangunan sekolah, bukan masjid |

## Keputusan pengguna yang mengikat

- Ubah visual secara besar, tetapi jangan buang fitur dan logika aplikasi.
- Desain harus terasa premium, murah dibangun/dirawat, simple, usable, dan berbeda jauh dari mockup terdahulu.
- Arah visual terbaru: soft surface depth terbatas, flat design, minimalism, dan hierarki interaksi Material; **Bento Grid dihapus dari layout produk**. Frame storyboard hanya media presentasi.
- Ikon premium dan font premium diminta; gunakan Lucide yang sudah ada dan DM Sans/Manrope tanpa dependency baru.
- Ilustrasi bangunan sekolah konvensional pada area inti seperti sidebar dan hero; tidak boleh ada masjid, kubah, atau minaret.
- Sidebar jangan polos; tambahkan ilustrasi/ornamen yang tidak mengganggu nav.
- Footer sederhana, compact, dan fungsional.
- Larangan keras AI slop dan skeuomorphism. Neumorphism terbaru hanya aksen permukaan halus, bukan skeuomorphism.
- Semua referensi yang terkumpul dipertahankan di traceability matrix; tidak semua wajib dipasang sebagai library.
- Jangan menambahkan fitur absensi baru atau AI assistant baru.
- Target 9+ adalah aspirasi; skor hanya diberikan setelah pengujian.

## Keputusan implementasi teknis

- Branch aktif: `redesign/islamic-school-bento`, dibuat langsung dari `main` agar seluruh perubahan terbaru repo ikut terbawa. Branch percobaan `redesign/islamic-bento-2026` berbasis branch lama dan bukan branch final.
- Domain engine, validator, generator, storage, PDF export, attendance, and data models dipertahankan.
- Tambah visual layer terpisah agar desain bisa diiterasi tanpa mengubah domain.
- SVG ilustrasi lokal agar tidak butuh request eksternal.
- CSS tokens dan import terpisah untuk memudahkan rollback/maintenance.
- P0 mapping target DnD/editor pada branch final diperbaiki dengan helper yang mencari active TEACHING slot berdasarkan JP number, bukan activity order.
- Tambah regression test untuk slot non-KBM di antara slot KBM.
- Build/test belum dinyatakan lulus sampai dijalankan di lingkungan project.
