# Research & Design Methods — SIGNAL V3

## Tujuan
Membangun kesan luxury yang jelas di semua bagian SIGNAL tanpa membuat aplikasi rumit, lambat, terlalu dekoratif, atau sulit dipahami. Referensi eksternal digunakan sebagai metode, bukan template visual yang disalin mentah.

## 1. Prinsip yang diambil dari riset

### Premium digital
Studi Bonhomme tentang 10 kode premium digital 2026 mengidentifikasi tipografi sebagai keputusan awal, motion yang disengaja, performa, konsistensi sistem, perjalanan tanpa friksi, momen imersif, storytelling, dan readability sebagai karakter pengalaman premium. Studi itu juga memasukkan restraint, tetapi SIGNAL tidak mengadopsi quiet luxury sebagai arah visual. Yang diambil adalah craft, typography, motion, system, performance, dan frictionless journey; bukan membatasi ekspresi visual menjadi pucat atau minimal.
Sumber: https://bonhommeparis.com/en/knowledge-center/studies/the-10-codes-of-premium-digital-2026

### Visual hierarchy
NN/g merangkum lima prinsip desain visual: scale, visual hierarchy, balance, contrast, dan Gestalt. Untuk SIGNAL, ini diterapkan melalui perbedaan ukuran yang jelas, panel gelap dan terang, garis grid, alignment angka, dan fokus yang mengarahkan mata pada tugas. Kontras tidak boleh dipakai secara acak.
Sumber: https://www.nngroup.com/articles/principles-visual-design/

NN/g juga menjelaskan bahwa hierarki visual membantu mata memahami urutan informasi dan bahwa contrast/color menjadi salah satu alat untuk mengarahkan perhatian. SIGNAL memakai warna jewel untuk menciptakan identitas, tetapi menjaga agar elemen sekunder tetap terbaca dan layar tidak penuh sinyal yang saling bersaing.
Sumber: https://www.nngroup.com/articles/visual-hierarchy-ux-definition/

### Plain language dan content design
GOV.UK menekankan mulai dari kebutuhan pengguna, mengurangi duplikasi, memilih format yang sesuai, serta memakai konten yang jelas. Panduan plain language dari UK Department for Education menyarankan memakai bahasa yang digunakan pengguna dan kalimat pendek. Di SIGNAL, ini menjadi microcopy singkat, label konkret, dan penjelasan hanya saat dibutuhkan.
Sumber: https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/plan-manage-content/understand-content-design/
Sumber: https://design.education.gov.uk/content-design/plain-language

### Aksesibilitas
WCAG 2.2 menetapkan target minimum 24×24 CSS px dengan kondisi pengecualian, serta kriteria focus appearance dan alternatif untuk operasi drag. SIGNAL menargetkan kontrol utama 40–44 px agar lebih mudah disentuh, indikator focus terlihat, dan drag/drop punya cara alternatif lewat keyboard atau form.
Sumber: https://www.w3.org/TR/WCAG22/

## 2. Metode visual Expressive Jewel Luxury

1. **Signature palette** — emerald sebagai DNA; plum, midnight blue, jade menjadi aksen fitur; ivory memberi ruang kerja. Kaya warna bukan berarti semua warna tampil bersamaan.
2. **Typographic authority** — Fraunces untuk judul dan angka utama; Inter untuk detail operasional. Serif memberi identitas, sans menjaga kecepatan pemindaian.
3. **Strong material contrast** — dark hero, bright work surface, warm neutral canvas; gold hairline sebagai craft detail.
4. **Feature-specific art direction** — tiap core punya komposisi yang mencerminkan tugasnya. Jadwal = matrix, generator = process/status, validasi = issue hierarchy, workload = comparison table, settings = structured controls.
5. **Micro-detail consistency** — emblem, plate markers, active edge, keyline, hover/focus, table rhythm, numeric alignment, empty/error state.
6. **Motion with purpose** — 120–180 ms untuk interaksi kecil; 180–240 ms untuk panel/modal; tidak memakai animasi untuk menutupi proses berat.
7. **Friction reduction** — kurangi perpindahan konteks, pertahankan filter, inline edit jika aman, bulk action dengan feedback, konfirmasi hanya untuk aksi penting.
8. **Performance as luxury** — tidak ada background video/3D/blur berat, animasi berat, atau layout shift. Responsif dan cepat adalah bagian dari kesan mahal.
9. **Controlled consistency** — sistem grid dan komponen konsisten, komposisi antarhalaman berbeda secara sengaja.
10. **Legibility over ornament** — tidak ada ornamen yang mengganggu data, kontras, focus, atau fungsi.

## 3. Cara menguji hasil

- First-glance test: pengguna dapat menyebut nama layar, status, dan tindakan utama dalam 3–5 detik.
- Task walkthrough: catat jumlah klik, perpindahan halaman, scroll, salah klik, dan waktu untuk tugas nyata. Jangan mengklaim jumlah langkah turun sebelum diuji.
- Readability check: periksa ukuran font tabel/form, kontras teks, label status, dan scanability.
- Device check: 1440px, 1280px, 1024px, 768px, 390px; cek body overflow dan matriks scroll internal.
- Keyboard check: tab order, visible focus, modal behavior, alternative action for drag.
- Performance check: build size, render table besar, animation cost, layout shifts.
- Contrast check: validasi text/background pasangan warna, khususnya gold/jade/plum pada ivory.
- Feature parity: setiap aksi existing dan state diuji terhadap source sebelum dan sesudah redesign.

## 4. Batasan dan interpretasi

- Studi premium digital dari studio desain bersifat insight/benchmark, bukan standar aksesibilitas atau jaminan hasil.
- Prinsip visual NN/g, GOV.UK, dan W3C adalah guidance; implementasi SIGNAL perlu diuji dengan operator sekolah.
- Tidak ada klaim skor luxury, usability, conversion, performance, atau pengurangan langkah tanpa evaluasi nyata.
- Referensi video dashboard user menjadi inspirasi cara menampilkan panel status, calendar/analytics, transisi state, dan pasangan warna. Referensi itu bukan alasan untuk menyalin dashboard metrik ke seluruh fitur SIGNAL.
