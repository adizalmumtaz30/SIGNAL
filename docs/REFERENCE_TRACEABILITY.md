# SIGNAL Reference Traceability Matrix

Daftar induk sumber yang dikumpulkan selama diskusi. Tautan dipertahankan seluruhnya; tidak berarti semua library harus dipasang. Sumber galeri adalah inspirasi, bukan standar normatif. Implementasi wajib memeriksa lisensi, aksesibilitas, performa, dan relevansi.

## A. Product UI galleries & visual inspiration

| Source | URL | Peran / adaptasi untuk SIGNAL |
|---|---|---|
| Mobbin | https://mobbin.com/ | Pola layar dan flow aplikasi nyata; pelajari hierarki, bukan salin |
| Refero | https://refero.design/ | Referensi layar dan alur produk |
| Appllama | https://appllama.io/ | Contoh layar/flow aplikasi |
| Appshots | https://appshots.design/ | Galeri screenshot aplikasi |
| ScreensDesign | https://screensdesign.com/ | Referensi layar aplikasi |
| Lazyweb | https://www.lazyweb.com/inspiration | Inspirasi website dan komposisi |
| Behance | https://www.behance.net/ | Studi kasus dan detail visual |
| Dribbble | https://dribbble.com/ | Eksplorasi visual; bukan usability authority |
| Dribbble UI Design | https://dribbble.com/search/UI-design | Pencarian visual UI |
| Dribbble Dashboard | https://dribbble.com/tags/dashboard | Inspirasi dashboard |
| Dribbble Collapsible Sidebar | https://dribbble.com/tags/collapsible_sidebar | Sidebar compact/expand |
| Behance Collapsible Side Navigation | https://www.behance.net/gallery/195398661/Collapsible-Side-Navigation-Bar-for-Dashboard | Contoh side navigation |
| Godly | https://godly.website/ | Galeri website |
| Navbar Gallery | https://navbar.gallery/ | Pola navbar |
| CTA Gallery | https://cta.gallery/ | CTA/action placement |
| SupaHero | https://www.supahero.io/ | Hero composition |
| Footer Design | https://footer.design/ | Pola footer |
| Bento Grids | https://bentogrids.com/ | Bento composition |
| 404s Design | https://www.404s.design/ | Error-page patterns |

## B. UI components & React

| Source | URL | Peran / adaptasi |
|---|---|---|
| Rare UI | https://rareui.com/ | Komponen/inspirasi UI |
| Beautiful UI | https://beautiful-ui.dev/components | Komponen UI |
| Uiverse | https://uiverse.io/ | Eksplorasi komponen; seleksi ketat |
| Lucian UX/UI Prompt | https://github.com/Seokwoooo/lucian-uxui-prompt | Snippet elemen interaktif; audit lisensi dan aksesibilitas |
| Lucian UX/UI Prompt intro | https://lucianlabs.dev/en/uxui-prompt/introducing/ | Konteks koleksi prompt/elemen |
| Morphin | https://morphin.dev/ | Komponen React, pola interaksi |
| Morphin Docs | https://morphin.dev/docs | Dokumentasi implementasi |
| SmoothUI | https://smoothui.dev/ | Komponen React dengan motion |
| SmoothUI Docs | https://smoothui.dev/docs | Dokumentasi komponen |
| SmoothUI AI integration | https://smoothui.dev/docs/guides/ai-integration | Referensi workflow agent |
| Sileo | https://sileo.aaryan.design/ | Toast/notifikasi |
| Lucide | https://github.com/lucide-icons/lucide | Ikon; SIGNAL sudah memakai lucide-react |
| Lucide Icon Guide | https://github.com/lucide-icons/lucide/blob/main/docs/how-to/icon-guide.md | Konsistensi ikon |

## C. Motion & interaction

| Source | URL | Peran / adaptasi |
|---|---|---|
| Motion Primitives | https://motion-primitives.com/ | Motion patterns; hanya yang fungsional |
| Transitions.dev | https://transitions.dev/ | Transisi |
| 60fps | https://60fps.design/ | Interaksi dan motion |
| Emil Kowalski Skills | https://github.com/emilkowalski/skills | Design engineering, motion detail |
| Emil — Agents with Taste | https://emilkowal.ski/ui/agents-with-taste | Design judgment untuk agent |
| Apple HIG Motion | https://developer.apple.com/design/human-interface-guidelines/motion | Prinsip motion, feedback, reduced motion |

## D. Data visualization & tables

| Source | URL | Peran / adaptasi |
|---|---|---|
| Nivo | https://nivo.rocks/ | Referensi visualisasi data; tidak wajib dipasang |
| Carbon Data Table | https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines | Tabel data dan interaksi |
| Reddit UXDesign — Data Tables | https://www.reddit.com/r/UXDesign/comments/1sav1qw/designing_data_tables_is_still_way_harder_than_it/ | Pengalaman komunitas; bukan standar |

## E. Accessibility & usability

| Source | URL | Peran / adaptasi |
|---|---|---|
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | Target aksesibilitas AA |
| GOV.UK Design System | https://design-system.service.gov.uk/ | Pola UI berbasis kebutuhan pengguna |
| GOV.UK Pagination | https://design-system.service.gov.uk/components/pagination/ | Navigasi data |
| NN/g Tooltip Guidelines | https://www.nngroup.com/articles/tooltip-guidelines/ | Tooltip yang berguna |
| Reddit UXDesign — Dashboard research | https://www.reddit.com/r/UXDesign/comments/1ptvrnb/my_research_process_for_saas_dashboard_design/ | Pengalaman riset dashboard |
| Reddit webdev — Horizontal tables | https://www.reddit.com/r/webdev/comments/1o5dps5/ | Diskusi tabel horizontal |

## F. Cara sumber diterapkan

- Dashboard visual/layout: Mobbin, Refero, Dribbble Dashboard, Bento Grids, Godly.
- Sidebar: Navbar Gallery, Dribbble Collapsible Sidebar, Behance navigation.
- Hero/ilustrasi/footer: SupaHero, Behance, Footer Design, Lazyweb.
- Interaksi: Morphin, SmoothUI, Lucian, Rare UI, Beautiful UI, Uiverse.
- Toast: Sileo.
- Motion: Emil, Motion Primitives, Transitions.dev, 60fps, Apple HIG.
- Icon: Lucide.
- Chart/table: Nivo dan Carbon Data Table.
- Accessibility/usability: WCAG, GOV.UK, NN/g.
- Dribbble/Behance/Reddit diperlakukan sebagai inspirasi atau diskusi komunitas, bukan aturan resmi.

## G. Sumber yang tidak menjadi dependency otomatis

SIGNAL sudah memiliki React, lucide-react, jsPDF, idb, dan stack yang diperlukan. Jangan memasang semua library hanya karena tercantum. Tambahkan dependency hanya bila ada kebutuhan terukur dan manfaatnya lebih besar dari biaya maintenance.
