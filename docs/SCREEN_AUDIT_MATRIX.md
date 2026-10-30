# SIGNAL Screen-by-Screen Audit & Acceptance Matrix

Tujuan: memastikan redesign mencakup seluruh layar yang ada, bukan hanya dashboard. Seluruh nama fitur mengacu pada source code branch dasar dan spesifikasi v1.2.

| Screen ID | Area | Risiko/temuan utama | Keputusan UX visual | Acceptance checks |
|---|---|---|---|---|
| overview | Beranda/Ringkasan | Hero dan quick actions harus tetap mengutamakan tugas utama; status readiness tidak boleh jadi angka dekoratif | Hero madrasah berilustrasi, KPI ringkas, bento cards; jadwal/validasi menjadi konten data utama | Data berasal dari AppState; aksi generate/schedule/PDF/validation tetap bekerja |
| schedule | Jadwal Pelajaran | P0 JP vs order mapping; baris non-KBM; matriks padat; target drop/editor | Grid kronologis; non-KBM locked rows; JP KBM bernomor terpisah; editor dan DnD jelas | Non-KBM tidak bisa ditimpa; drag/drop target active TEACHING only; undo; validator; publish gating |
| workload | Beban Guru | Data harus dihitung dari jadwal aktual; tabel/grafik jangan dekoratif | Ringkasan distribusi + detail tabel, warna status dengan label | JP KBM, sesi, distribusi per hari, batas mingguan dan filter konsisten dengan jadwal |
| attendance | Presensi Guru | Lima tab; instruksi panjang dan kontrol bersaing | Tab tetap ada; tanggal/periode + aksi utama diprioritaskan; status compact | Input massal, bulanan, per guru, rekap/PDF, hari libur; persistensi lokal; konfirmasi overwrite |
| generator | Generator | Status pencarian perlu jelas; SEARCH_LIMIT_REACHED berbeda dari INFEASIBLE | Status progress + constraint/result/candidates, satu CTA utama | Semua status generator tampil berbeda; candidate dipilih menjadi draft; AI tidak menentukan validitas |
| master | Data Master | Tiga jenis data dan edit action; tabel responsif | Tabs Kelas/Guru/Mapel, search jelas, tabel dan modal terstruktur | Create/edit/delete sesuai aturan, filter, qualification; semua data tersimpan |
| requirements | Kebutuhan & Alokasi | Input dan tabel harus jelas; potensi bentrok kebutuhan/kapasitas | Form singkat dan tabel alokasi dengan ringkasan total JP | CRUD alokasi; guru berkualifikasi; generator/validator menggunakan data aktual |
| validation | Validasi & Konflik | Issue perlu grouped dan navigasi perbaikan | Summary counts + grouped issue list + action “Lihat/Perbaiki” | Periksa Jadwal, hard errors, warnings, navigate to slot/class, print/export jika tersedia |
| history | Riwayat Versi | Snapshot harus jelas; restore tidak boleh bypass validator | Timeline versi dan metadata singkat; restore action diberi konfirmasi | Publish snapshot; restore ke draft; revalidate sebelum publish |
| backup | Ekspor & Backup | Format, scope, dan dampak restore harus transparan | Pilih export/backup/restore dengan state dan konfirmasi jelas | JSON export/import/checksum; jangan klaim cloud sync; backup scope dijelaskan |
| settings | Pengaturan | Hari aktif/slot kegiatan/identitas/AI; hard rules harus tetap terlihat | Pengelompokan tab/panel; activity type dan waktu mudah dipindai | Jumat tersedia; slot time validated; max 10 JP KBM; Gemini OFF default; save persistence |

## Global shell

- Sidebar: identitas SIGNAL, workspace academic year, 11 destination IDs, active state, status local-first, ilustrasi madrasah di area bawah.
- Topbar: breadcrumb, pencarian yang labelnya sesuai perilaku Data Master, status/quick validation, operator menu.
- Footer: motto SIGNAL, versi/status lokal, tautan yang hanya ditampilkan bila benar-benar tersedia.
- Dialog: focus trap jika sudah tersedia, Escape close, keyboard navigation, label dan error state.
- Toast: ringkas, non-blocking, tidak menjadi satu-satunya cara membaca status.

## Responsive acceptance

- 320px: tidak ada horizontal overflow pada body; sidebar berubah menjadi drawer; tabel/kalender memakai local scroll atau row details.
- 375px: form tidak terlalu sempit; tombol utama tidak keluar viewport; data table tidak memotong label penting.
- 768px: layout dua kolom hanya bila konten cukup lebar.
- 1280px+: dashboard bento multi-column; jadwal mendapat ruang horizontal memadai.
- Test landscape tablet dan zoom 200%.

## State coverage per screen

Setiap layar diperiksa untuk state yang relevan: default, loading, empty, populated, disabled, error, success, warning, read-only, long text, many records, and narrow viewport.
