# Daftar Referensi Desain dan Kegunaannya untuk SIGNAL

Referensi SIGNAL dibagi menjadi enam kelompok: inspirasi antarmuka, design system, komponen UI, motion, visualisasi data, serta aksesibilitas. Setiap referensi memiliki fungsi yang berbeda. Tidak semuanya perlu dipasang sebagai dependency aplikasi.

## 1. Inspirasi UI/UX dan pola halaman

Digunakan untuk mempelajari bagaimana produk nyata menyusun dashboard, navigasi, form, tabel, dan alur interaksi.

| Referensi | Kegunaan untuk SIGNAL |
|---|---|
| [Mobbin](https://mobbin.com/) | Melihat contoh layar dan alur produk nyata. Berguna untuk mencari inspirasi dashboard, pengaturan, halaman data, dan navigasi. |
| [Refero](https://refero.design/) | Mempelajari pola UX seperti dashboard, filter, pencarian, tabel, modal, tab, dan alur pengguna. |
| [Appllama](https://appllama.io/) | Melihat desain aplikasi nyata, terutama pola onboarding, halaman utama, dan pengaturan. |
| [Appshots](https://appshots.design/) | Referensi screenshot aplikasi untuk membandingkan struktur layar dan hierarki informasi. |
| [ScreensDesign](https://screensdesign.com/) | Inspirasi tampilan aplikasi dan pola desain per halaman. |
| [Lazyweb](https://www.lazyweb.com/) | Referensi eksplorasi website dan komposisi antarmuka. |
| [Behance](https://www.behance.net/) | Mempelajari studi kasus desain, identitas visual, tipografi, dan presentasi design system. |
| [Dribbble](https://dribbble.com/) | Eksplorasi alternatif visual, komposisi, warna, dan detail komponen. |
| [Godly](https://godly.website/) | Inspirasi desain website modern, komposisi editorial, dan presentasi visual. |
| [Navbar Gallery](https://www.navbar.gallery/) | Referensi desain navigasi, sidebar, menu, dan dropdown. |
| [CTA Gallery](https://www.cta.gallery/) | Referensi penempatan tombol tindakan dan hierarki call-to-action. |
| [SupaHero](https://supahero.io/) | Referensi desain hero section, banner, dan area pengenalan produk. |
| [Footer Design](https://www.footer.design/) | Inspirasi penyusunan footer dan informasi pendukung. |
| [Bento Grids](https://bentogrids.com/) | Arsip inspirasi komposisi modular. **Hanya referensi historis, bukan arah desain SIGNAL. Bento Grid tidak digunakan sebagai pola layout utama.** |

## 2. Design system dan pedoman komponen

Kelompok ini menjadi acuan untuk konsistensi tampilan, warna, tipografi, komponen, dan perilaku antarmuka.

| Referensi | Kegunaan untuk SIGNAL |
|---|---|
| [Microsoft Fluent 2](https://fluent2.microsoft.design/) | Referensi utama tambahan untuk konsistensi design system, komponen, hierarki, navigasi, dan aksesibilitas. Pelajari pedoman keyboard, focus, kontras, serta responsive layout. |
| [GOV.UK Design System](https://design-system.service.gov.uk/) | Referensi desain form, label, pesan kesalahan, helper text, dan alur input yang jelas. |
| [Microsoft Inclusive Design](https://inclusive.microsoft.design/) | Panduan untuk membuat antarmuka yang mempertimbangkan kebutuhan pengguna dengan kemampuan dan konteks yang beragam. |
| [Lucide](https://lucide.dev/) | Referensi sistem ikon yang konsisten. SIGNAL sudah menggunakan Lucide React sehingga sebaiknya tidak menambah library ikon lain tanpa kebutuhan. |
| [Beautiful UI](https://beautifului.com/) | Eksplorasi pola komponen dan pendekatan visual UI. |
| [Uiverse](https://uiverse.io/) | Referensi eksperimen komponen CSS, seperti tombol, input, dan kontrol. Gunakan secara selektif agar tidak terlalu dekoratif. |

**Peran Fluent 2 untuk SIGNAL:** menjadi rujukan prinsip dan perilaku komponen, bukan template yang harus ditiru. Identitas warna dan visual SIGNAL tetap menggunakan deep forest green, muted emerald, sage, warm ivory, dan warm gray.

## 3. Komponen React dan implementasi UI

Digunakan untuk mencari inspirasi atau kode komponen yang bisa diadaptasi ke aplikasi React.

| Referensi | Kegunaan untuk SIGNAL |
|---|---|
| [React Vibe](https://reactvibe.com/) | Referensi komponen React, UI blocks, dashboard, dan interaksi berbasis animasi. Komponen dapat dipelajari dan disesuaikan dengan kebutuhan SIGNAL. |
| [Rare UI](https://rareuikit.com/) | Inspirasi komponen React animatif yang lebih unik, misalnya elemen interaktif atau feedback. |
| [Lucian UX/UI Prompt](https://www.lucianux.com/) | Referensi elemen antarmuka siap dicoba dan prompt/kode untuk membantu proses porting komponen ke proyek. |
| [Morphin](https://www.morphinui.com/) | Referensi eksplorasi komponen dan interaksi UI. |
| [SmoothUI](https://smoothui.dev/) | Referensi komponen React dan interaksi antarmuka. |
| [Sileo](https://sileo.design/) | Referensi komponen dan pola interaksi untuk inspirasi implementasi. |

Penerapan untuk SIGNAL: gunakan komponen yang benar-benar membantu pekerjaan operator, seperti dialog konfirmasi, dropdown, date picker, filter, tabel, status proses, dan feedback penyimpanan. Jangan mengambil komponen hanya karena efek visualnya menarik.

## 4. Motion dan micro-interaction

Digunakan untuk menentukan cara komponen bergerak dan merespons tindakan pengguna. Tujuannya memberikan feedback, bukan membuat aplikasi terlihat ramai.

| Referensi | Kegunaan untuk SIGNAL |
|---|---|
| [React Vibe](https://reactvibe.com/) | Inspirasi motion components untuk React, termasuk animasi interaktif dan visualisasi alur. Gunakan secukupnya. |
| [Motion Primitives](https://motion-primitives.com/) | Referensi komponen animasi yang dapat disesuaikan dengan sistem desain. |
| [Transitions.dev](https://transitions.dev/) | Referensi transisi UI dan konsistensi token durasi serta easing. |
| [60fps](https://60fps.design/) | Inspirasi animasi antarmuka dan micro-interaction yang terasa responsif. |
| [Emil Kowalski — Animations](https://emilkowal.ski/animations) | Mempelajari timing, easing, dan detail gerakan agar interaksi terasa natural. |
| [Agents with Taste](https://agentswithtaste.com/) | Referensi cara menerjemahkan standar kualitas visual dan motion menjadi instruksi yang bisa diikuti coding agent. |
| [Apple Human Interface Guidelines — Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Pedoman penggunaan motion untuk membantu orientasi dan feedback tanpa mengganggu pengguna. |

**Contoh penggunaan motion di SIGNAL:**
- Transisi ringan saat membuka dialog edit jadwal.
- Feedback ketika slot jadwal berhasil dipindahkan.
- Indikator proses generator.
- Perubahan status validasi.
- Animasi kecil saat membuka sidebar atau dropdown.

Hindari parallax, animasi looping, partikel, dan gerakan dekoratif yang tidak membantu operator.

## 5. Tabel, data, dan visualisasi

Kelompok ini sangat penting karena SIGNAL menangani banyak data jadwal, guru, kelas, alokasi, dan beban mengajar.

| Referensi | Kegunaan untuk SIGNAL |
|---|---|
| [Carbon Data Table](https://carbondesignsystem.com/components/data-table/usage/) | Referensi tabel kompleks: sorting, filter, pemilihan baris, toolbar, dan detail data. |
| [Nivo](https://nivo.rocks/) | Referensi visualisasi data, grafik, dan dashboard analitik. |
| [Refero](https://refero.design/) | Mencari contoh tampilan tabel dan filter dari produk nyata. |

Contoh penerapan:
- Tabel Data Master Guru.
- Matriks jadwal seluruh kelas.
- Tabel kebutuhan dan alokasi jam.
- Rekap beban kerja guru.
- Grafik ringkasan distribusi JP.
- Tabel laporan konflik dan validasi.

Prinsip penting: **jadwal dan data operasional tetap mengutamakan tabel atau matriks yang mudah dibaca**, bukan diubah menjadi kumpulan kartu dekoratif.

## 6. Aksesibilitas dan usability

Digunakan untuk memastikan aplikasi bisa digunakan dengan nyaman, terbaca, dan dapat dioperasikan melalui berbagai cara.

| Referensi | Kegunaan untuk SIGNAL |
|---|---|
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Standar acuan aksesibilitas untuk kontras, keyboard, fokus, struktur konten, dan interaksi. |
| [GOV.UK Design System](https://design-system.service.gov.uk/) | Referensi form, label, validasi, error message, dan instruksi yang mudah dimengerti. |
| [Microsoft Fluent 2](https://fluent2.microsoft.design/) | Referensi focus order, kontras warna, navigasi, responsive layout, dan struktur konten. |
| [Microsoft Inclusive Design](https://inclusive.microsoft.design/) | Perspektif desain inklusif untuk berbagai kondisi dan kemampuan pengguna. |
| [Nielsen Norman Group](https://www.nngroup.com/) | Referensi usability, terutama tooltip, navigasi, feedback, dan kemudahan memahami antarmuka. |

Penerapan untuk SIGNAL:
- Semua tombol penting dapat diakses melalui keyboard.
- Focus state terlihat jelas.
- Form memiliki label dan pesan validasi yang jelas.
- Warna bukan satu-satunya penanda status.
- Kontras teks memadai.
- Ukuran teks nyaman dibaca.
- Tabel tetap dapat digunakan pada layar lebih kecil.
- Pertimbangkan preferensi `reduced motion`.

## 7. Diskusi dan pengalaman praktisi

Digunakan sebagai masukan tambahan untuk memahami masalah desain yang sering ditemui, bukan sebagai standar resmi.

| Referensi | Kegunaan untuk SIGNAL |
|---|---|
| [Reddit — r/UXDesign](https://www.reddit.com/r/UXDesign/) | Diskusi pengalaman praktisi UI/UX dan proses desain produk. |
| [Reddit — Dashboard UX](https://www.reddit.com/search/?q=dashboard%20UX) | Mencari diskusi tentang kepadatan data, navigasi, dashboard, dan masalah usability. |

---

## Prioritas penggunaan referensi untuk SIGNAL

Tidak semua referensi perlu diterapkan sekaligus. Urutan prioritas yang disarankan:

| Prioritas | Referensi | Fokus penerapan |
|---|---|---|
| 1 | **Microsoft Fluent 2** | Konsistensi komponen, interaksi, dan aksesibilitas. |
| 2 | **Mobbin + Refero** | Struktur halaman, pola UX, dan alur pengguna. |
| 3 | **Carbon Data Table** | Tabel dan matriks data operasional. |
| 4 | **Lucide** | Konsistensi ikon. |
| 5 | **GOV.UK + WCAG 2.2** | Form, validasi, aksesibilitas, dan usability. |
| 6 | **React Vibe + Motion Primitives + Transitions.dev** | Motion dan micro-interaction yang diperlukan. |
| 7 | **Nivo** | Grafik analitik bila memang membantu memahami data. |
| 8 | **Behance + Dribbble + Godly** | Eksplorasi visual dan identitas antarmuka. |

## Arah desain akhir

Referensi-referensi tersebut membantu meningkatkan kualitas SIGNAL, tetapi bukan untuk menggabungkan semua gaya menjadi satu. Identitas final tetap **Contemporary School Editorial Interface**: modern, premium, ringkas, data-first, berkarakter arsitektur sekolah kontemporer, tanpa Bento Grid, tanpa glassmorphism, dan tanpa dekorasi berlebihan.

Referensi adalah bahan pembelajaran dan pertimbangan. Jangan memasang semua library atau menyalin desain secara mentah. Periksa kecocokan dengan stack React/TypeScript, performa, aksesibilitas, lisensi, dan kemudahan pemeliharaan sebelum mengadopsi komponen.
