# SIGNAL Design System — School Workspace (No Bento)

Status: arah storyboard terbaru menggantikan eksperimen Bento. Visual mengacu pada mockup storyboard terakhir dan ilustrasi bangunan sekolah konvensional.  
Bukan Atelier Luxury. Bukan Quiet Luxury lama. Bukan HTML prototype terdahulu.

## 1. Design thesis

**A calm, precise academic operations workspace.** SIGNAL harus terasa seperti ruang kerja operator sekolah: teratur, jelas, dan efisien. Ilustrasi kampus sekolah menjadi identitas pendukung; data jadwal tetap menjadi fokus.

Satu identitas, empat pengaruh yang dipakai selektif:

| Model | Penerapan | Tidak digunakan untuk |
|---|---|---|
| Neumorphism (soft) | Elevation halus pada segmented control, toggle, chip, input aktif tertentu | Tabel, teks, sel jadwal, seluruh kartu sekaligus |
| Flat design | Surface utama, navigasi, tabel, status, struktur konten | Membuat semua area datar tanpa hierarki |
| Minimalism | Microcopy, toolbar, spacing, pengurangan dekorasi | Menghilangkan informasi domain penting |
| Material Design | Hierarki tindakan, state, feedback, dialog, focus, elevation bertingkat | Menyalin komponen material generik mentah |
| Storyboard presentation | Frame bernomor untuk memperlihatkan perjalanan 11 layar pada satu lembar | Dipakai sebagai layout produk atau Bento Grid |

## 2. Visual direction

- Background aplikasi: pale mint / warm white; area kerja putih.
- Primary: teal/emerald yang segar, bukan hijau neon.
- Secondary: sage/mint untuk highlight lembut.
- Accent: muted amber/gold untuk aksi utama dan status khusus; digunakan hemat.
- Status: success hijau, warning amber, danger coral/red, info blue; selalu disertai teks/icon, tidak hanya warna.
- Border tipis dan jelas; shadow diffuse yang ringan, tidak seperti kaca/glassmorphism.
- Radius menengah konsisten (10–18px), jangan semua pill.
- Ilustrasi: SVG flat editorial berupa bangunan sekolah konvensional (gedung kelas bertingkat, jendela, pintu masuk, halaman, pepohonan, dan siswa). Tidak ada masjid, kubah, atau menara/minaret.
- Ornamen sidebar: motif lengkung/arch, daun/geometry, silhouette sekolah. Tidak menutup navigasi.
- Footer: compact, deep teal/muted green; identitas SIGNAL, local status/version, bantuan/dokumentasi/kontak jika target tersedia. Jangan membuat tautan palsu yang tidak berfungsi.

## 3. Typography

- Display/headings: Manrope (600–800), fallback system sans.
- Body/UI/data: DM Sans (400–700), fallback system sans.
- Body copy utama: 13–15px desktop; 14–16px mobile bila area memungkinkan.
- Label: minimum nyaman 10–11px; jangan jadikan label kecil sebagai satu-satunya informasi.
- Data table: 12–14px; metadata 10–12px.
- Schedule matrix: minimum 10–12px untuk konten yang penting; compact mode tetap memiliki zoom/scale dan detail aksesibel.
- Line height body 1.45–1.6; headings rapat tetapi tidak terjepit.
- Angka penting gunakan tabular numerals jika tersedia.

## 4. Iconography

- Gunakan lucide-react yang sudah menjadi dependency; jangan menambah icon pack kedua.
- Stroke 1.7–2.0, 16–20px untuk kontrol; 20–24px untuk ikon area.
- Ikon harus semantik dan konsisten; aksi berikon tanpa teks harus punya aria-label/title/tooltip.
- Jangan gunakan emoji sebagai pengganti ikon.
- Hindari ikon dekoratif tanpa makna dan kombinasi glyph acak.

## 5. Layout — standard workspace, no Bento Grid

- Dashboard: shell admin standar. Satu area kerja utama dengan greeting/hero yang ringkas, KPI seperlunya, agenda, dan tindakan prioritas. Jangan pecah seluruh informasi menjadi grid kartu.
- Jadwal: grid kronologis sebagai artefak utama; non-KBM muncul di urutan waktu; JP KBM diberi nomor terpisah.
- Matriks seluruh kelas: kelompokkan kelas per tingkat/paralel; tampilkan ringkasan per kelas; gunakan horizontal scroll hanya di viewport tabel, bukan body. Struktur matriks bukan kumpulan kartu.
- Presensi: date/period + action utama + status ringkas + tab; hindari paragraf instruksi panjang.
- Data Master: tabs/filter/search/table; responsive row detail/stacking untuk layar kecil.
- Generator: status pencarian, constraints, hasil/kandidat, action pilih kandidat; tidak menyisipkan AI assistant.
- Validasi: summary dan grouped issue list, setiap issue punya navigasi perbaikan yang jelas.
- Settings: pisahkan hari aktif, slot kegiatan, identitas, AI opt-in; hard rules tetap terlihat.
- Footer: kecil, sederhana, useful.

## 6. Illustration system

- Asset utama: `public/illustrations/madrasah-campus.svg`.
- Area: sidebar lower illustration, dashboard hero art, kebutuhan/alokasi card (crop), generator panel jika konteks sesuai.
- Hindari background ilustrasi penuh di belakang tabel/form.
- Pastikan SVG responsif, ringan, original, dan bisa dimuat lokal/offline.
- Ilustrasi harus dekoratif dan `aria-hidden` jika tidak membawa informasi.

## 7. Motion

- 120–200ms untuk hover/focus/press; 180–260ms untuk panel/transition bila perlu.
- Hindari parallax, loop animation, shimmer terus-menerus, bouncy spring berlebihan.
- Hormati `prefers-reduced-motion`.
- Loading state harus menyampaikan proses dan dapat dibaca screen reader.

## 8. Accessibility & responsive

- Target kontras WCAG 2.2 AA; status selalu pakai teks/ikon juga.
- Focus-visible jelas; seluruh action dapat dijalankan keyboard.
- Input punya label; icon-only control punya accessible name.
- Touch target nyaman (target praktis 40–44px).
- 320–375px: navigasi menjadi drawer/compact nav; konten satu kolom; tabel di-scroll secara lokal atau disusun ulang.
- 768px: dua kolom hanya jika cukup lebar; jangan memaksa 3 kolom rapat.
- Desktop: 3-column bento hanya untuk dashboard, jadwal tetap lebar.
- Tidak ada body-level horizontal overflow.

## 9. Anti-slop checklist

- Tidak menggunakan Bento Grid sebagai sistem layout produk; storyboard bernomor hanya media presentasi multi-layar.

- Tidak ada gradient/glow/glass/neumorphic emboss sebagai dekorasi massal.
- Tidak ada kartu untuk setiap elemen data.
- Tidak ada placeholder stats palsu pada production.
- Tidak ada teks marketing filler pada area kerja.
- Tidak ada font/icon dependency tambahan tanpa kebutuhan.
- Tidak ada warna status yang tidak konsisten.
- Tidak ada animasi yang tidak memberi feedback.
- Tidak ada ilustrasi yang menutupi kontrol/data.
- Tidak ada navigasi yang menyembunyikan fitur penting.
- Tidak ada visual simplification yang mengubah business logic.
