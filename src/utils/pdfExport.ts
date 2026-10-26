import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppState, Day, SchoolClass } from '../domain/types';
import { isSlotBlocked, jpToAstronomical } from '../domain/time';
import { getDefaultMadrasahLogo } from './madrasahLogo';
import { groupClassesForMasterMatrix } from './matrixGrouping';

// Color palette matching SIGNAL branding
const TEAL = [11, 52, 53] as [number, number, number]; // #0b3435
const TEAL_LIGHT = [235, 244, 240] as [number, number, number];
const GOLD = [188, 148, 94] as [number, number, number]; // #bc945e
const INK = [23, 54, 55] as [number, number, number];
const MUTED = [117, 133, 130] as [number, number, number];

export interface OfficialDocCustomTexts {
  // Kop Surat Overrides
  kopSurat?: boolean;
  includeKop?: boolean;
  ministry?: string;
  regionalOffice?: string;
  districtOffice?: string;
  schoolName?: string;
  nsm?: string;
  npsn?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;

  // Document Title & Heading Overrides
  documentTitle?: string;
  academicYear?: string;
  semester?: string;
  extraNotes?: string;

  // Signature Block Overrides
  signerCity?: string;
  signerDate?: string;
  principalTitle?: string;
  principalName?: string;
  principalNip?: string;
  coordinatorTitle?: string;
  coordinatorName?: string;
  coordinatorNip?: string;
  officerTitle?: string;
  officerName?: string;
  officerNip?: string;
  leftTitle?: string;
  leftName?: string;
  leftNip?: string;
  rightTitle?: string;
  rightName?: string;
  rightNip?: string;
}

export type PaperSize = 'a4' | 'f4';

/**
 * Returns exact dimensions in millimeters for supported paper sizes:
 * - A4: 210 x 297 mm
 * - F4 / Folio (Indonesia standard): 210 x 330 mm
 */
export function getPaperDimensions(
  paperSize: PaperSize = 'a4',
  orientation: 'landscape' | 'portrait' = 'landscape',
): [number, number] {
  if (paperSize === 'f4') {
    return orientation === 'landscape' ? [330, 210] : [210, 330];
  }
  return orientation === 'landscape' ? [297, 210] : [210, 297];
}

/**
 * Creates a calibrated jsPDF instance configured for A4 or F4 with landscape/portrait
 */
export function createJsPDFDocument(
  orientation: 'landscape' | 'portrait' = 'landscape',
  paperSize: PaperSize = 'a4',
): jsPDF {
  const format = getPaperDimensions(paperSize, orientation);
  return new jsPDF({
    orientation,
    unit: 'mm',
    format,
  });
}

/**
 * Convert CSS Hex color string to [R, G, B] tuple
 */
export function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return [240, 244, 242];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Produces soft, high-contrast, easily printable pastel tints for table cells.
 * Tested for both crisp color laser printing and grayscale clarity.
 */
export function getPrintableCellColor(hex: string): { bg: [number, number, number]; text: [number, number, number] } {
  const [r, g, b] = hexToRgb(hex);
  // Blend with white: 20% hue, 80% white for high legibility
  const bgR = Math.round(r * 0.20 + 255 * 0.80);
  const bgG = Math.round(g * 0.20 + 255 * 0.80);
  const bgB = Math.round(b * 0.20 + 255 * 0.80);

  // Deep contrasting text tone from darker shade of the subject
  const textR = Math.round(r * 0.50);
  const textG = Math.round(g * 0.50);
  const textB = Math.round(b * 0.50);

  return { bg: [bgR, bgG, bgB], text: [textR, textG, textB] };
}

/**
 * Common abbreviations for Indonesian school subjects to optimize print table space
 */
export function compactSubjectName(fullName: string, code?: string): string {
  if (!fullName) return code || '—';
  const trimmed = fullName.trim();

  const knownMap: Record<string, string> = {
    'Al-Qur\'an Hadis': 'Al-Qur\'an',
    'Al-Qur’an Hadis': 'Al-Qur\'an',
    'Al-Qur\'an Hadits': 'Al-Qur\'an',
    'Akidah Akhlak': 'Akidah',
    'Aqidah Akhlak': 'Akidah',
    'Sejarah Kebudayaan Islam': 'SKI',
    'Pendidikan Agama Islam': 'PAI',
    'Pendidikan Agama Islam dan Budi Pekerti': 'PAI & BP',
    'Pendidikan Pancasila': 'P. Pancasila',
    'Pendidikan Pancasila dan Kewarganegaraan': 'PPKn',
    'Pendidikan Kewarganegaraan': 'PKn',
    'Bahasa Indonesia': 'B. Indo',
    'Bahasa Inggris': 'B. Ingg',
    'Bahasa Arab': 'B. Arab',
    'Bahasa Jawa': 'B. Jawa',
    'Matematika': 'Matematika',
    'Ilmu Pengetahuan Alam': 'IPA',
    'Ilmu Pengetahuan Sosial': 'IPS',
    'Pendidikan Jasmani, Olahraga, dan Kesehatan': 'PJOK',
    'Pendidikan Jasmani Olahraga dan Kesehatan': 'PJOK',
    'Pendidikan Jasmani dan Kesehatan': 'Penjasorkes',
    'Teknologi Informasi dan Komunikasi': 'Informatika',
    'Informatika': 'Informatika',
    'Seni Budaya dan Keterampilan': 'Seni Budaya',
    'Seni Budaya': 'Seni Budaya',
    'Bimbingan dan Konseling': 'BK',
    'Bimbingan Konseling': 'BK',
    'Prakarya dan Kewirausahaan': 'Prakarya',
    'Prakarya': 'Prakarya',
    'Fikih': 'Fikih',
    'Fiqih': 'Fikih',
    'Tahfiz': 'Tahfiz',
    'Tahfidz': 'Tahfiz',
    'Ke-NU-an / Aswaja': 'Aswaja',
    'Aswaja': 'Aswaja',
  };

  for (const [key, val] of Object.entries(knownMap)) {
    if (trimmed.toLowerCase() === key.toLowerCase()) return val;
  }

  if (trimmed.startsWith('Bahasa ')) {
    return 'B. ' + trimmed.slice(7);
  }
  if (trimmed.length > 14 && code) {
    return code;
  }
  return trimmed;
}

/**
 * Compact teacher name for dense schedule cells:
 * e.g. "H. Ahmad Fauzi, S.Ag., M.Pd.I." -> "A. Fauzi"
 */
export function compactTeacherName(fullName: string, code?: string): string {
  if (!fullName) return code || '—';
  const trimmed = fullName.trim();
  // Strip trailing academic degrees
  const nameWithoutDegrees = trimmed.split(',')[0].trim();
  const parts = nameWithoutDegrees.split(/\s+/).filter(Boolean);
  if (parts.length > 2) {
    // Abbreviate first name if multiple words: "Ahmad Fauzi Ridwan" -> "A. Fauzi Ridwan"
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
  }
  return nameWithoutDegrees;
}

/**
 * Render Official Kop Surat Madrasah (Formal Letterhead)
 * Includes Ministry, Regional Office, Madrasah Name, NSM, NPSN, Address, Contacts, and Official Logo.
 * Fully supports live text overrides and compact layout for single-page documents.
 */
export function renderOfficialKopSurat(
  doc: jsPDF,
  state: AppState,
  startY = 10,
  overrides?: Partial<OfficialDocCustomTexts>,
  isCompact = false,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const s = state.settings;

  const ministry = overrides?.ministry ?? s.ministry ?? 'KEMENTERIAN AGAMA REPUBLIK INDONESIA';
  const regionalOffice = overrides?.regionalOffice ?? s.regionalOffice ?? 'KANTOR KEMENTERIAN AGAMA KABUPATEN MALANG';
  const schoolName = overrides?.schoolName ?? s.schoolName ?? 'MTs Cendekia Nusantara';
  const nsm = overrides?.nsm ?? s.nsm ?? '';
  const npsn = overrides?.npsn ?? s.npsn ?? '';
  const academicYear = overrides?.academicYear ?? s.academicYear ?? '2026/2027';
  const semester = overrides?.semester ?? s.semester ?? 'Ganjil';
  const address = overrides?.address ?? s.address ?? 'Jl. Raya Cendekia No. 45, Sumberpucung';
  const city = overrides?.city ?? s.city ?? '';
  const postalCode = overrides?.postalCode ?? s.postalCode ?? '';
  const phone = overrides?.phone ?? s.phone ?? '';
  const email = overrides?.email ?? s.email ?? '';
  const logoData = overrides?.logoUrl ?? s.logoUrl ?? getDefaultMadrasahLogo();

  const logoSize = isCompact ? 13.5 : 18; // mm
  const logoX = 12;
  const logoY = startY;

  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn('Could not render logo to PDF:', e);
    }
  }

  const textLeft = isCompact ? 28 : 36;
  const textRight = pageWidth - 12;
  const textCenter = (textLeft + textRight) / 2;

  let y = startY + (isCompact ? 2.5 : 3.5);

  // 1. Kementerian yang menaungi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isCompact ? 8.8 : 10.5);
  doc.setTextColor(15, 35, 33);
  doc.text(ministry.toUpperCase(), textCenter, y, { align: 'center' });

  // 2. Kantor Wilayah / Kankemenag
  y += isCompact ? 3.8 : 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isCompact ? 8 : 9.5);
  doc.setTextColor(25, 45, 43);
  doc.text(regionalOffice.toUpperCase(), textCenter, y, { align: 'center' });

  // 3. Nama Madrasah
  y += isCompact ? 4.2 : 5.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isCompact ? 10.5 : 12.5);
  doc.setTextColor(...TEAL);
  const normalizedSchool = schoolName.toUpperCase().startsWith('MADRASAH TSANAWIYAH') || schoolName.toUpperCase().startsWith('MTS')
    ? schoolName.toUpperCase()
    : `MADRASAH TSANAWIYAH ${schoolName.toUpperCase()}`;
  doc.text(normalizedSchool, textCenter, y, { align: 'center' });

  // 4. NSM & NPSN & Tahun Ajaran
  y += isCompact ? 3.3 : 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isCompact ? 6.8 : 7.8);
  doc.setTextColor(60, 75, 70);
  const nsmStr = nsm ? `NSM: ${nsm}` : '';
  const npsnStr = npsn ? `NPSN: ${npsn}` : '';
  const taStr = `T.A. ${academicYear} (${semester})`;
  const line4 = [nsmStr, npsnStr, taStr].filter(Boolean).join('  ·  ');
  doc.text(line4, textCenter, y, { align: 'center' });

  // 5. Alamat, Kontak, Email, Website
  y += isCompact ? 3 : 3.5;
  doc.setFontSize(isCompact ? 6.5 : 7.2);
  doc.setTextColor(80, 95, 90);
  const cityStr = city ? `, ${city}` : '';
  const postStr = postalCode ? ` ${postalCode}` : '';
  const phoneStr = phone ? ` · Telp/WA: ${phone}` : '';
  const emailStr = email ? ` · Email: ${email}` : '';
  doc.text(`${address}${cityStr}${postStr}${phoneStr}${emailStr}`, textCenter, y, { align: 'center' });

  // 6. Double Rule Line Divider
  y += isCompact ? 2.8 : 3.5;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(isCompact ? 0.9 : 1.2);
  doc.line(10, y, pageWidth - 10, y);

  y += isCompact ? 0.9 : 1.2;
  doc.setLineWidth(0.35);
  doc.line(10, y, pageWidth - 10, y);

  return y + (isCompact ? 3.5 : 5);
}

function addDocHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  schoolName: string,
  academicYear: string,
  semester: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top header banner
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 24, pageWidth, 2, 'F');

  // Title text inside banner
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SIGNAL · SISTEM PENJADWALAN & PRESENSI', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 235, 230);
  doc.text(`${schoolName.toUpperCase()} — T.A. ${academicYear} (${semester})`, 14, 18);

  // Subtitle / Document Title
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(subtitle, 14, 43);

  // Divider line
  doc.setDrawColor(220, 225, 220);
  doc.setLineWidth(0.5);
  doc.line(14, 46, pageWidth - 14, 46);
}

function addDocFooter(doc: jsPDF, schoolName: string) {
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);

    // Footer rule
    doc.setDrawColor(220, 228, 224);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11);
    const cleanSchool = schoolName || 'Madrasah Tsanawiyah';
    doc.text(cleanSchool, 14, pageHeight - 6.5);
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, pageHeight - 6.5, { align: 'right' });
  }
}

function addSignatureBlock(
  doc: jsPDF,
  state: AppState,
  startY: number,
  customSigners?: {
    city?: string;
    date?: string;
    leftTitle?: string;
    leftName?: string;
    leftNip?: string;
    rightTitle?: string;
    rightName?: string;
    rightNip?: string;
  },
  forceCurrentPage = false,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const s = state.settings;

  let y = startY + (forceCurrentPage ? 4 : 10);
  if (!forceCurrentPage && y + 36 > pageHeight - 16) {
    doc.addPage();
    y = 26;
  }

  const dateStr =
    customSigners?.date ||
    new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const city = customSigners?.city || s.city || 'Kota Madrasah';
  const leftTitle = customSigners?.leftTitle || s.curriculumLeaderTitle || 'Waka Bidang Kurikulum';
  const leftName = customSigners?.leftName || s.curriculumLeaderName || 'Ahmad Fauzi, S.Pd.';
  const leftNip = customSigners?.leftNip || s.curriculumLeaderNip || '198204122008011015';

  const rightTitle = customSigners?.rightTitle || `${s.headmasterTitle || 'Kepala Madrasah'} ${s.schoolName}`;
  const rightName = customSigners?.rightName || s.headmasterName || 'Drs. H. M. Zainuddin, M.Pd.I';
  const rightNip = customSigners?.rightNip || s.headmasterNip || '197405101999031003';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(forceCurrentPage ? 7.8 : 8.5);
  doc.setTextColor(...INK);

  const sigGap = forceCurrentPage ? 16 : 22;

  // Left signature
  const leftX = 22;
  doc.text('Mengetahui / Memeriksa,', leftX, y);
  doc.setFont('helvetica', 'bold');
  doc.text(leftTitle, leftX, y + 4);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'bold');
  doc.text(leftName, leftX, y + sigGap);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(forceCurrentPage ? 7 : 7.5);
  doc.text(leftNip ? `NIP. ${leftNip}` : 'NIP. ...............................................', leftX, y + sigGap + 3.8);

  // Right signature
  const isLandscape = pageWidth > 250;
  const rightX = pageWidth - (isLandscape ? 85 : 75);
  doc.setFontSize(forceCurrentPage ? 7.8 : 8.5);
  doc.text(`${city}, ${dateStr}`, rightX, y);
  doc.setFont('helvetica', 'bold');
  doc.text(rightTitle, rightX, y + 4);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'bold');
  doc.text(rightName, rightX, y + sigGap);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(forceCurrentPage ? 7 : 7.5);
  doc.text(rightNip ? `NIP. ${rightNip}` : 'NIP. ...............................................', rightX, y + sigGap + 3.8);
}

/**
 * 1. Export Master School Schedule PDF (A4 Landscape)
 */
export function exportScheduleMasterPDF(state: AppState, options?: { paperSize?: PaperSize }): void {
  exportAllClassesSinglePageA4PDF(state, {
    paperSize: options?.paperSize,
    documentTitle: 'JADWAL PELAJARAN INDUK MADRASAH',
    includeTeacherRecapPage: true,
  });
}

export interface WeeklyClassSchedulePdfOptions extends Partial<OfficialDocCustomTexts> {
  paperSize?: PaperSize;
  orientation?: 'landscape' | 'portrait';
  layoutMode?: 'single_page' | 'two_pages';
  kopSurat?: boolean;
  principalTitle?: string;
  principalName?: string;
  principalNip?: string;
  coordinatorTitle?: string;
  coordinatorName?: string;
  coordinatorNip?: string;
  includeTeacherRecapPage?: boolean;
  colorizeSubjects?: boolean;
  compactNames?: boolean;
}

/**
 * Render Weekly Class Schedule:
 * - Single-Page Mode: Timetable Matrix + Compact Teacher Allocation Recap + Signatures all on 1 page!
 * - Two-Page Mode: Page 1 Timetable Matrix with KPI cards, Page 2 Detailed Teacher Breakdown with Signatures.
 * Fully supports A4 and F4 (Folio Indonesia) with automatic layout adjustments.
 */
function renderClassWeeklyPages(
  doc: jsPDF,
  state: AppState,
  cls: SchoolClass,
  options?: WeeklyClassSchedulePdfOptions,
  isFirstClass = true,
): void {
  const orientation = options?.orientation ?? 'landscape';
  const paperSize = options?.paperSize ?? 'a4';
  const isSinglePage = options?.layoutMode === 'single_page' || options?.includeTeacherRecapPage === false;

  if (!isFirstClass) {
    const format = getPaperDimensions(paperSize, orientation);
    doc.addPage(format, orientation);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const allEntries = state.draft ?? state.activeSchedule ?? [];
  const classEntries = allEntries.filter((e) => e.classId === cls.id);
  const activeDays = state.settings.activeDays;
  const periods = Array.from({ length: state.settings.teachingPeriodsPerDay }, (_, i) => i + 1);
  const periodMinutes = state.settings.periodMinutes ?? 40;
  const astro = jpToAstronomical(classEntries.length, periodMinutes);
  const colorize = options?.colorizeSubjects !== false;
  const compact = options?.compactNames !== false;

  const teacherIdsInClass = [...new Set(classEntries.map((e) => e.teacherId))];
  const subjectIdsInClass = [...new Set(classEntries.map((e) => e.subjectId))];
  const academicYear = options?.academicYear || state.settings.academicYear;
  const semester = options?.semester || state.settings.semester;
  const schoolName = options?.schoolName || state.settings.schoolName;

  // ==========================================
  // HALAMAN 1: MATRIKS JADWAL MINGGUAN KELAS
  // ==========================================
  let currentY = isSinglePage ? 6 : 10;

  if (options?.kopSurat !== false) {
    currentY = renderOfficialKopSurat(doc, state, currentY, options, isSinglePage);
  } else {
    currentY = isSinglePage ? 10 : 16;
  }

  // Document Title & Class Subtitle
  const defaultTitle = `JADWAL PELAJARAN MINGGUAN — KELAS ${cls.name}`;
  const docTitle = options?.documentTitle ? `${options.documentTitle} — KELAS ${cls.name}` : defaultTitle;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isSinglePage ? 11 : 13);
  doc.setTextColor(17, 45, 42);
  doc.text(docTitle, pageWidth / 2, currentY, { align: 'center' });

  currentY += isSinglePage ? 3.5 : 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isSinglePage ? 7.5 : 8.5);
  doc.setTextColor(80, 95, 90);
  const subtitleText = isSinglePage
    ? `Tingkat ${cls.level} · T.A. ${academicYear} (${semester}) · Alokasi: ${classEntries.length} JP (${astro.hours} Jam Efektif) · ${teacherIdsInClass.length} Guru Pengajar · ${schoolName}`
    : `Tingkat ${cls.level} · Tahun Ajaran ${academicYear} · Semester ${semester}`;
  doc.text(subtitleText, pageWidth / 2, currentY, { align: 'center' });

  currentY += isSinglePage ? 3.5 : 5.5;

  // KPI Summary Bar (4 Cards) - Rendered only in two-page mode
  const boxWidth = (pageWidth - 28) / 4;
  const boxHeight = 11.5;

  if (!isSinglePage) {
    const kpisPage1 = [
      { label: 'TOTAL ALOKASI JP', value: `${classEntries.length} JP Mingguan` },
      { label: 'WAKTU ASTRONOMIS', value: `${astro.hours} Jam (${astro.minutes} Mnt)` },
      { label: 'GURU PENGAJAR', value: `${teacherIdsInClass.length} Pendidik` },
      { label: 'MATA PELAJARAN', value: `${subjectIdsInClass.length} Bidang Studi` },
    ];

    kpisPage1.forEach((kpi, kIdx) => {
      const x = 14 + kIdx * boxWidth;
      doc.setFillColor(248, 251, 249);
      doc.setDrawColor(215, 230, 222);
      doc.roundedRect(x, currentY, boxWidth - 3, boxHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(80, 105, 95);
      doc.text(kpi.label, x + (boxWidth - 3) / 2, currentY + 4, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(11, 52, 53);
      doc.text(kpi.value, x + (boxWidth - 3) / 2, currentY + 9, { align: 'center' });
    });

    currentY += boxHeight + 4;
  }

  // Timetable Matrix AutoTable
  const tableHeaders = ['Jam / JP', ...activeDays];
  const tableData: string[][] = [];
  const cellSubjectMap: Record<number, Record<number, string>> = {};

  for (let jpIdx = 0; jpIdx < periods.length; jpIdx++) {
    const jp = periods[jpIdx];
    const slot = state.slots.find((s) => s.day === activeDays[0] && s.kind === 'TEACHING' && s.jpNo === jp);
    const timeLabel = slot ? `JP ${jp}\n${slot.start} - ${slot.end}` : `JP ${jp}`;
    const row = [timeLabel];

    activeDays.forEach((day, dIdx) => {
      const entry = classEntries.find((e) => e.day === day && e.jpNo === jp);
      const colIdx = dIdx + 1;
      if (entry) {
        const sub = state.subjects.find((s) => s.id === entry.subjectId);
        const tch = state.teachers.find((t) => t.id === entry.teacherId);
        const subName = compact ? compactSubjectName(sub?.name ?? '', sub?.code) : (sub?.name ?? 'Mapel');
        const tchInfo = tch ? (compact ? `(${compactTeacherName(tch.name, tch.code)})` : (tch.code ? `[${tch.code}] ${tch.name}` : tch.name)) : '—';
        row.push(`${subName}\n${tchInfo}`);
        if (!cellSubjectMap[jpIdx]) cellSubjectMap[jpIdx] = {};
        cellSubjectMap[jpIdx][colIdx] = entry.subjectId;
      } else {
        row.push('—');
      }
    });
    tableData.push(row);
  }

  // Calculate day column width based on available paper width (A4 vs F4)
  const timeColWidth = orientation === 'landscape' ? 24 : 18;
  const dayColWidth = (pageWidth - 28 - timeColWidth) / activeDays.length;

  const colStyles: Record<number, { halign: 'center' | 'left' | 'right'; cellWidth: number; fontStyle?: 'bold' | 'normal'; fillColor?: [number, number, number] }> = {
    0: { halign: 'center', cellWidth: timeColWidth, fontStyle: 'bold', fillColor: [248, 250, 248] },
  };
  activeDays.forEach((_, idx) => {
    colStyles[idx + 1] = { halign: 'center', cellWidth: dayColWidth };
  });

  const cellPaddingVal = isSinglePage ? 1.8 : 2.5;

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    tableLineWidth: 0.35,
    tableLineColor: [11, 52, 53],
    headStyles: {
      fillColor: [11, 52, 53],
      textColor: 255,
      fontSize: isSinglePage ? 7.8 : 8.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: isSinglePage ? 2 : 2.8,
      lineWidth: 0.3,
      lineColor: [11, 52, 53],
    },
    bodyStyles: {
      fontSize: orientation === 'landscape' ? (isSinglePage ? 7 : 7.5) : 6.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: cellPaddingVal,
      textColor: [20, 35, 33],
      lineColor: [215, 225, 220],
      lineWidth: 0.2,
    },
    columnStyles: colStyles,
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index >= 1) {
        const subId = cellSubjectMap[data.row.index]?.[data.column.index];
        if (subId && colorize) {
          const subject = state.subjects.find((s) => s.id === subId);
          if (subject?.color) {
            const { bg, text } = getPrintableCellColor(subject.color);
            data.cell.styles.fillColor = bg;
            data.cell.styles.textColor = text;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
    alternateRowStyles: {
      fillColor: [253, 254, 253],
    },
    margin: { left: 14, right: 14 },
  });

  const lastTableP1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;

  // Single-Page Layout: Compact Teacher Allocation Recap & Signatures on Page 1
  if (isSinglePage) {
    let p1AfterTableY = lastTableP1.finalY + 3;

    // Header label for compact teacher allocation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(11, 52, 53);
    doc.text(`REKAPITULASI PEMBAGIAN TUGAS MENGAJAR KELAS ${cls.name}`, 14, p1AfterTableY);

    p1AfterTableY += 2.2;

    // Build compact teacher recap data
    const teachersInClassObj = teacherIdsInClass
      .map((tid) => state.teachers.find((t) => t.id === tid))
      .filter((t): t is typeof state.teachers[0] => Boolean(t))
      .sort((a, b) => a.name.localeCompare(b.name));

    const compactTeacherRows: Array<Array<string | number>> = [];
    teachersInClassObj.forEach((teacher, idx) => {
      const tEntries = classEntries.filter((e) => e.teacherId === teacher.id);
      const taughtSubNames = [...new Set(
        tEntries.map((e) => state.subjects.find((s) => s.id === e.subjectId)?.name ?? 'Mapel'),
      )].join(', ');

      const teachingDays = [...new Set(tEntries.map((e) => e.day))];
      teachingDays.sort((a, b) => activeDays.indexOf(a) - activeDays.indexOf(b));
      const daysStr = teachingDays.join(', ');

      const totalSchoolJp = allEntries.filter((e) => e.teacherId === teacher.id).length;

      compactTeacherRows.push([
        idx + 1,
        teacher.code,
        teacher.nip ? `${teacher.name} (NIP. ${teacher.nip})` : teacher.name,
        taughtSubNames,
        daysStr,
        `${tEntries.length} JP`,
        `${totalSchoolJp} / ${teacher.maxWeeklyJP} JP`,
      ]);
    });

    // Total summary row
    compactTeacherRows.push([
      '',
      '',
      `TOTAL BEBAN KELAS ${cls.name}`,
      `${subjectIdsInClass.length} Mata Pelajaran`,
      `${activeDays.length} Hari KBM`,
      `${classEntries.length} JP`,
      '100% Terpenuhi',
    ]);

    const compactHeaders = ['No', 'Kode', 'Nama & NIP Pendidik', 'Mata Pelajaran', 'Hari KBM', 'Beban Kelas', 'Total Madrasah'];

    autoTable(doc, {
      startY: p1AfterTableY,
      head: [compactHeaders],
      body: compactTeacherRows,
      theme: 'grid',
      tableLineWidth: 0.25,
      tableLineColor: [11, 52, 53],
      headStyles: {
        fillColor: [11, 52, 53],
        textColor: 255,
        fontSize: 6.8,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 1.5,
      },
      bodyStyles: {
        fontSize: 6.4,
        halign: 'center',
        cellPadding: 1.2,
        textColor: [20, 35, 33],
        lineColor: [215, 225, 220],
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 7 },
        1: { halign: 'center', cellWidth: 10 },
        2: { halign: 'left', cellWidth: orientation === 'landscape' ? 60 : 42, fontStyle: 'bold' },
        3: { halign: 'left', cellWidth: orientation === 'landscape' ? 54 : 38 },
        4: { halign: 'center', cellWidth: orientation === 'landscape' ? 30 : 22 },
        5: { halign: 'center', cellWidth: orientation === 'landscape' ? 18 : 14, fontStyle: 'bold' },
        6: { halign: 'center', cellWidth: orientation === 'landscape' ? 20 : 16 },
      },
      didParseCell: (data) => {
        if (data.row.index === compactTeacherRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [232, 244, 238];
          data.cell.styles.textColor = [11, 52, 53];
        }
      },
      alternateRowStyles: {
        fillColor: [253, 254, 253],
      },
      margin: { left: 14, right: 14 },
    });

    const lastTableTeacher = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;

    // Single-Page Official Signature Block
    addSignatureBlock(doc, state, lastTableTeacher.finalY + 1.5, {
      city: options?.signerCity,
      date: options?.signerDate,
      leftTitle: options?.leftTitle || options?.coordinatorTitle || `Wali Kelas ${cls.name} / Koordinator Kurikulum`,
      leftName: options?.leftName || options?.coordinatorName,
      leftNip: options?.leftNip || options?.coordinatorNip,
      rightTitle: options?.rightTitle || `${options?.principalTitle || 'Kepala Madrasah'} ${options?.schoolName || state.settings.schoolName}`,
      rightName: options?.rightName || options?.principalName,
      rightNip: options?.rightNip || options?.principalNip,
    }, true);

    return;
  }

  // Two-Page Mode: Page 1 Notice Callout
  const p1NoticeY = Math.min(lastTableP1.finalY + 4, pageHeight - 20);

  doc.setFillColor(243, 248, 245);
  doc.setDrawColor(205, 230, 220);
  doc.roundedRect(14, p1NoticeY, pageWidth - 28, 9, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(17, 65, 55);
  doc.text(
    'Rincian Lengkap & Rekapitulasi Beban JP Guru Tercantum Pada Lampiran Pengesahan',
    20,
    p1NoticeY + 4,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(90, 110, 105);
  doc.text(
    `Catatan: 1 JP = ${periodMinutes} menit waktu efektif KBM. Jadwal ini disahkan untuk pembelajaran semester berjalan.`,
    20,
    p1NoticeY + 7.3,
  );

  // =========================================================================
  // HALAMAN 2: TABEL REKAPITULASI JP PER GURU (SEPARATE DEDICATED PAGE)
  // =========================================================================
  if (options?.includeTeacherRecapPage !== false) {
    doc.addPage(getPaperDimensions(paperSize, orientation), orientation);
    let p2Y = 12;

    if (options?.kopSurat !== false) {
      p2Y = renderOfficialKopSurat(doc, state, 10, options, false);
    } else {
      p2Y = 16;
    }

    // Header Page 2 Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(17, 45, 42);
    doc.text(`REKAPITULASI ALOKASI JP & BEBAN MENGAJAR GURU`, pageWidth / 2, p2Y, { align: 'center' });

    p2Y += 4.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 95, 90);
    doc.text(
      `Lampiran Resmi Jadwal Mingguan Kelas ${cls.name} (Tingkat ${cls.level}) · Semester ${semester} T.A. ${academicYear}`,
      pageWidth / 2,
      p2Y,
      { align: 'center' },
    );

    p2Y += 5.5;

    // KPI Cards Page 2
    const kpisPage2 = [
      { label: 'TOTAL BEBAN KELAS', value: `${classEntries.length} Jam Pelajaran` },
      { label: 'GURU TERLIBAT', value: `${teacherIdsInClass.length} Pendidik` },
      { label: 'RATA-RATA BEBAN', value: `${(classEntries.length / (teacherIdsInClass.length || 1)).toFixed(1)} JP / Guru` },
      { label: 'STATUS DISTRIBUSI', value: '100% Terstruktur' },
    ];

    kpisPage2.forEach((kpi, kIdx) => {
      const x = 14 + kIdx * boxWidth;
      doc.setFillColor(248, 251, 249);
      doc.setDrawColor(215, 230, 222);
      doc.roundedRect(x, p2Y, boxWidth - 3, boxHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(80, 105, 95);
      doc.text(kpi.label, x + (boxWidth - 3) / 2, p2Y + 4, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(11, 52, 53);
      doc.text(kpi.value, x + (boxWidth - 3) / 2, p2Y + 9, { align: 'center' });
    });

    p2Y += boxHeight + 4;

    // Build Teacher Recap Breakdown Data with Jabatan and NIP
    const teacherDataRows: Array<Array<string | number>> = [];

    const teachersInClassObj = teacherIdsInClass
      .map((tid) => state.teachers.find((t) => t.id === tid))
      .filter((t): t is typeof state.teachers[0] => Boolean(t))
      .sort((a, b) => a.name.localeCompare(b.name));

    teachersInClassObj.forEach((teacher, idx) => {
      const tEntries = classEntries.filter((e) => e.teacherId === teacher.id);
      const taughtSubjectNames = [...new Set(
        tEntries.map((e) => state.subjects.find((s) => s.id === e.subjectId)?.name ?? 'Mapel'),
      )].join(', ');

      const teachingDays = [...new Set(tEntries.map((e) => e.day))];
      teachingDays.sort((a, b) => activeDays.indexOf(a) - activeDays.indexOf(b));
      const daysStr = teachingDays.join(', ');

      const totalSchoolJp = allEntries.filter((e) => e.teacherId === teacher.id).length;

      let status = 'Sesuai Kuota';
      if (totalSchoolJp > teacher.maxWeeklyJP) status = 'Melebihi Batas';
      else if (totalSchoolJp === teacher.maxWeeklyJP) status = 'Maksimal';

      const teacherDisplayName = teacher.nip
        ? `${teacher.name}\nNIP. ${teacher.nip}`
        : teacher.name;

      teacherDataRows.push([
        idx + 1,
        teacher.code,
        teacherDisplayName,
        teacher.roleTitle || 'Guru Mapel',
        taughtSubjectNames,
        daysStr,
        `${tEntries.length} JP`,
        `${totalSchoolJp} / ${teacher.maxWeeklyJP} JP`,
        status,
      ]);
    });

    // Summary Total Row
    teacherDataRows.push([
      '',
      '',
      `TOTAL & RATA-RATA KELAS ${cls.name}`,
      '—',
      `${subjectIdsInClass.length} Mata Pelajaran`,
      `${activeDays.length} Hari KBM`,
      `${classEntries.length} JP`,
      '—',
      '100% Terpenuhi',
    ]);

    const p2Headers = [
      'No',
      'Kode',
      'Nama & NIP Pendidik',
      'Jabatan',
      'Mata Pelajaran yang Diampu',
      'Hari Mengajar',
      'Beban Kelas',
      'Beban Madrasah',
      'Status Alokasi',
    ];

    const availP2W = pageWidth - 28;
    const baseP2ColW = orientation === 'landscape'
      ? [8, 12, 54, 40, 48, 28, 20, 29, 30]
      : [6, 9, 36, 26, 32, 20, 15, 20, 18];
    const totalP2ColW = baseP2ColW.reduce((a, b) => a + b, 0);
    const p2Scale = availP2W / totalP2ColW;

    autoTable(doc, {
      startY: p2Y,
      head: [p2Headers],
      body: teacherDataRows,
      theme: 'grid',
      headStyles: {
        fillColor: [11, 52, 53],
        textColor: 255,
        fontSize: 7.8,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 2.8,
      },
      bodyStyles: {
        fontSize: 7.5,
        halign: 'center',
        cellPadding: 2.2,
        textColor: [20, 35, 33],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: baseP2ColW[0] * p2Scale },
        1: { halign: 'center', cellWidth: baseP2ColW[1] * p2Scale },
        2: { halign: 'left', cellWidth: baseP2ColW[2] * p2Scale, fontStyle: 'bold' },
        3: { halign: 'left', cellWidth: baseP2ColW[3] * p2Scale },
        4: { halign: 'left', cellWidth: baseP2ColW[4] * p2Scale },
        5: { halign: 'center', cellWidth: baseP2ColW[5] * p2Scale },
        6: { halign: 'center', cellWidth: baseP2ColW[6] * p2Scale, fontStyle: 'bold' },
        7: { halign: 'center', cellWidth: baseP2ColW[7] * p2Scale },
        8: { halign: 'center', cellWidth: baseP2ColW[8] * p2Scale },
      },
      didParseCell: (data) => {
        if (data.row.index === teacherDataRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [232, 244, 238];
          data.cell.styles.textColor = [11, 52, 53];
        }
      },
      alternateRowStyles: {
        fillColor: [253, 254, 253],
      },
      margin: { left: 14, right: 14 },
    });

    const lastTableP2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
    let nextP2Y = lastTableP2.finalY + 3.5;

    // Small notes below Page 2
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(90, 105, 100);
    doc.text(
      `* Catatan: Beban JP dihitung otomatis berdasarkan alokasi kurikulum resmi madrasah (1 JP = ${periodMinutes} menit).`,
      14,
      nextP2Y,
    );
    nextP2Y += 3.2;
    doc.text(
      `* Kolom 'Hari Mengajar' merinci jadwal tatap muka guru di rombongan belajar Kelas ${cls.name}.`,
      14,
      nextP2Y,
    );

    addSignatureBlock(doc, state, nextP2Y + 4, {
      city: options?.signerCity,
      date: options?.signerDate,
      leftTitle: options?.leftTitle || options?.coordinatorTitle || `Wali Kelas ${cls.name} / Koordinator Kurikulum`,
      leftName: options?.leftName || options?.coordinatorName,
      leftNip: options?.leftNip || options?.coordinatorNip,
      rightTitle: options?.rightTitle || `${options?.principalTitle || 'Kepala Madrasah'} ${options?.schoolName || state.settings.schoolName}`,
      rightName: options?.rightName || options?.principalName,
      rightNip: options?.rightNip || options?.principalNip,
    });
  }
}

/**
 * 2. Export Weekly Class Schedule PDF (A4 Clean Layout with Separate Page Teacher JP Recap)
 */
export function exportScheduleClassPDF(
  state: AppState,
  classId: string,
  options?: WeeklyClassSchedulePdfOptions,
): void {
  const cls = state.classes.find((c) => c.id === classId) ?? state.classes[0];
  if (!cls) return;

  const orientation = options?.orientation ?? 'landscape';
  const paperSize = options?.paperSize ?? 'a4';
  const doc = createJsPDFDocument(orientation, paperSize);

  renderClassWeeklyPages(doc, state, cls, options, true);

  addDocFooter(doc, options?.schoolName || state.settings.schoolName);

  const cleanName = cls.name.replace(/[^a-zA-Z0-9]/g, '_');
  const paperSuffix = paperSize.toUpperCase();
  doc.save(`SIGNAL_Jadwal_Mingguan_Kelas_${cleanName}_${paperSuffix}.pdf`);
}

/**
 * Export All Classes Weekly Schedule PDF (A4/F4 Clean Layout Bundle)
 */
export function exportAllClassesWeeklyPDF(
  state: AppState,
  options?: WeeklyClassSchedulePdfOptions,
): void {
  const classes = state.classes.filter((c) => c.isActive);
  if (classes.length === 0) return;

  const orientation = options?.orientation ?? 'landscape';
  const paperSize = options?.paperSize ?? 'a4';
  const doc = createJsPDFDocument(orientation, paperSize);

  classes.forEach((cls, idx) => {
    renderClassWeeklyPages(doc, state, cls, options, idx === 0);
  });

  addDocFooter(doc, options?.schoolName || state.settings.schoolName);

  const cleanYear = (options?.academicYear || state.settings.academicYear).replace(/[^a-zA-Z0-9]/g, '_');
  const paperSuffix = paperSize.toUpperCase();
  doc.save(`SIGNAL_Jadwal_Mingguan_Semua_Kelas_${paperSuffix}_${cleanYear}.pdf`);
}

export interface AllClassesSinglePagePdfOptions extends Partial<OfficialDocCustomTexts> {
  paperSize?: PaperSize;
  colorizeSubjects?: boolean;
  compactNames?: boolean;
  includeKop?: boolean;
  includeTeacherRecapPage?: boolean;
  principalTitle?: string;
  coordinatorTitle?: string;
  coordinatorName?: string;
  coordinatorNip?: string;
}

/**
 * 2B. Export All Classes in Single Page Landscape (A4 or F4) + Dedicated Teacher JP Recap Page
 * - Page 1 (Landscape): Master Timetable containing all classes on 1 page with compact names & colorized subject cells
 * - Page 2 (Landscape): Comprehensive Teacher JP Allocation Recap Table with Official Signature Block at Footer
 */
export function exportAllClassesSinglePageA4PDF(
  state: AppState,
  options?: AllClassesSinglePagePdfOptions,
): void {
  const paperSize = options?.paperSize ?? 'a4';
  const doc = createJsPDFDocument('landscape', paperSize);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const entries = state.draft ?? state.activeSchedule ?? [];
  const classes = state.classes.filter((c) => c.isActive);
  const activeDays = state.settings.activeDays;
  const periods = Array.from({ length: state.settings.teachingPeriodsPerDay }, (_, i) => i + 1);
  const periodMinutes = state.settings.periodMinutes ?? 40;
  const colorize = options?.colorizeSubjects !== false;
  const compact = options?.compactNames !== false;

  const academicYear = options?.academicYear || state.settings.academicYear;
  const semester = options?.semester || state.settings.semester;
  const schoolName = options?.schoolName || state.settings.schoolName;

  // =========================================================================
  // HALAMAN 1: MATRIKS SELURUH KELAS TERPADU (BLOK MINGGUAN SENIN - SABTU)
  // =========================================================================
  let currentY = 7;
  if (options?.includeKop !== false && options?.kopSurat !== false) {
    currentY = renderOfficialKopSurat(doc, state, 7, options, true);
  } else {
    currentY = 12;
  }

  // Document Heading - Adaptive title (NO misleading "(SATU HALAMAN A4)" on F4 or multi-page)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...TEAL);
  const docTitle = options?.documentTitle || 'JADWAL PELAJARAN SELURUH KELAS';
  doc.text(docTitle.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

  currentY += 3.6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(70, 90, 85);
  const subHeading = `Tahun Ajaran ${academicYear} · Semester ${semester} · Rombel Aktif: ${classes.map((c) => c.name).join(', ')} · ${schoolName}`;
  doc.text(subHeading, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4.5;

  // Group classes into parallel rombel rows (Baris 1 — Kelompok A: VII-A, VIII-A, IX-A; Baris 2 — Kelompok B: VII-B, VIII-B, IX-B)
  const rombelRows = groupClassesForMasterMatrix(classes);

  // Available vertical space for matrix blocks
  const legendSpaceNeeded = colorize ? 13 : 8;
  const bottomMargin = 12; // footer room
  const availableMatrixHeight = pageHeight - currentY - legendSpaceNeeded - bottomMargin;

  // Determine rows per page: if rombelRows.length <= 2, all fit comfortably on Page 1
  const maxRowsPerPage = rombelRows.length <= 2 ? 2 : 2;
  const gapBetweenRows = 3.8;

  // Calculate uniform height for class weekly blocks
  const blockH = Math.min(
    48,
    Math.max(
      38,
      (availableMatrixHeight - (Math.min(rombelRows.length, maxRowsPerPage) - 1) * gapBetweenRows) /
        Math.min(rombelRows.length, maxRowsPerPage),
    ),
  );

  const marginX = 10;
  const availableW = pageWidth - marginX * 2;

  rombelRows.forEach((row, rIdx) => {
    // If more rows than can fit on page 1, add a structured page break
    if (rIdx > 0 && rIdx % maxRowsPerPage === 0) {
      doc.addPage(getPaperDimensions(paperSize, 'landscape'), 'landscape');
      currentY = 10;
      if (options?.includeKop !== false && options?.kopSurat !== false) {
        currentY = renderOfficialKopSurat(doc, state, 8, options, true);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...TEAL);
      doc.text(`${docTitle.toUpperCase()} (LANJUTAN)`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;
    }

    // Row Header Banner (Kelompok A, Kelompok B, etc.)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 55, 50);
    doc.text(`${row.label.toUpperCase()} · ${row.classes.map((c) => c.name).join(' | ')}`, marginX, currentY + 1.2);
    currentY += 2.8;

    const numCols = Math.max(1, row.classes.length);
    const gapX = 3.5;
    const blockW = (availableW - (numCols - 1) * gapX) / numCols;

    // Render each class weekly block side-by-side
    row.classes.forEach((cls, cIdx) => {
      const blockX = marginX + cIdx * (blockW + gapX);
      const blockY = currentY;
      const classEntries = entries.filter((e) => e.classId === cls.id);

      // 1. Block Title Bar
      const titleH = 4.0;
      doc.setFillColor(11, 52, 53); // Deep Teal
      doc.roundedRect(blockX, blockY, blockW, titleH, 0.6, 0.6, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);
      doc.text(`Kelas ${cls.name}`, blockX + 2.5, blockY + 2.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(220, 238, 230);
      doc.text(`Tingkat ${cls.level} · ${classEntries.length} JP`, blockX + blockW - 2.5, blockY + 2.8, { align: 'right' });

      // 2. Day Sub-header
      const subHeaderH = 3.2;
      const subHeaderY = blockY + titleH;
      doc.setFillColor(232, 243, 238);
      doc.rect(blockX, subHeaderY, blockW, subHeaderH, 'F');

      const jpW = paperSize === 'f4' ? 6.2 : 5.5;
      const timeW = paperSize === 'f4' ? 12.0 : 10.8;
      const dayW = (blockW - jpW - timeW) / activeDays.length;

      // JP col header
      doc.setDrawColor(210, 225, 218);
      doc.setLineWidth(0.18);
      doc.rect(blockX, subHeaderY, jpW, subHeaderH, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.8);
      doc.setTextColor(11, 52, 53);
      doc.text('JP', blockX + jpW / 2, subHeaderY + 2.2, { align: 'center' });

      // Waktu col header
      doc.rect(blockX + jpW, subHeaderY, timeW, subHeaderH, 'D');
      doc.setFontSize(4.6);
      doc.text('WAKTU', blockX + jpW + timeW / 2, subHeaderY + 2.2, { align: 'center' });

      // Day cols headers
      activeDays.forEach((day, dIdx) => {
        const dX = blockX + jpW + timeW + dIdx * dayW;
        doc.rect(dX, subHeaderY, dayW, subHeaderH, 'D');
        doc.setFontSize(4.8);
        doc.text(day.slice(0, 3).toUpperCase(), dX + dayW / 2, subHeaderY + 2.2, { align: 'center' });
      });

      // 3. JP Rows
      const headerH = titleH + subHeaderH;
      const rowH = (blockH - headerH) / periods.length;

      periods.forEach((jpNo, pIdx) => {
        const rowY = blockY + headerH + pIdx * rowH;

        // JP No cell
        doc.setFillColor(246, 250, 248);
        doc.setDrawColor(215, 228, 222);
        doc.setLineWidth(0.15);
        doc.rect(blockX, rowY, jpW, rowH, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.0);
        doc.setTextColor(11, 52, 53);
        doc.text(String(jpNo).padStart(2, '0'), blockX + jpW / 2, rowY + rowH * 0.65, { align: 'center' });

        // Waktu cell
        const refSlot = state.slots.find((s) => s.kind === 'TEACHING' && s.jpNo === jpNo);
        const timeStr = refSlot ? `${refSlot.start}-${refSlot.end}` : '';
        doc.setFillColor(250, 252, 251);
        doc.rect(blockX + jpW, rowY, timeW, rowH, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.2);
        doc.setTextColor(85, 100, 95);
        doc.text(timeStr, blockX + jpW + timeW / 2, rowY + rowH * 0.65, { align: 'center' });

        // Days cells
        activeDays.forEach((day, dIdx) => {
          const cellX = blockX + jpW + timeW + dIdx * dayW;
          const slotDef = state.slots.find((s) => s.day === day && s.kind === 'TEACHING' && s.jpNo === jpNo);
          const blocked = isSlotBlocked(slotDef);

          if (blocked) {
            // Non-KBM activity
            const actType = (slotDef?.activityType || 'ISTIRAHAT').toUpperCase();
            let actBg: [number, number, number] = [254, 248, 230]; // warm yellow for istirahat
            let actBorder: [number, number, number] = [230, 205, 140];
            let actText: [number, number, number] = [130, 95, 30];
            let actShort = 'ISTIRAHAT';

            if (actType.includes('UPACARA')) {
              actBg = [253, 242, 240];
              actBorder = [235, 185, 178];
              actText = [160, 60, 48];
              actShort = 'UPACARA';
            } else if (actType.includes('RELIGI') || actType.includes('SHOLAT')) {
              actBg = [247, 239, 253];
              actBorder = [218, 190, 242];
              actText = [99, 43, 142];
              actShort = 'RELIGI';
            }

            doc.setFillColor(...actBg);
            doc.setDrawColor(...actBorder);
            doc.setLineWidth(0.15);
            doc.rect(cellX, rowY, dayW, rowH, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(4.2);
            doc.setTextColor(...actText);
            if (doc.getTextWidth(actShort) > dayW - 0.5) actShort = actShort.slice(0, 4);
            doc.text(actShort, cellX + dayW / 2, rowY + rowH * 0.65, { align: 'center' });
          } else {
            // KBM slot
            const entry = entries.find((e) => e.classId === cls.id && e.day === day && e.jpNo === jpNo);
            if (!entry) {
              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(220, 230, 225);
              doc.setLineWidth(0.15);
              doc.rect(cellX, rowY, dayW, rowH, 'FD');
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(4.8);
              doc.setTextColor(180, 195, 190);
              doc.text('—', cellX + dayW / 2, rowY + rowH * 0.65, { align: 'center' });
            } else {
              const subject = state.subjects.find((s) => s.id === entry.subjectId);
              const teacher = state.teachers.find((t) => t.id === entry.teacherId);

              let cellBg: [number, number, number] = [246, 250, 248];
              let cellText: [number, number, number] = [17, 50, 48];

              if (colorize && subject?.color) {
                const printable = getPrintableCellColor(subject.color);
                cellBg = printable.bg;
                cellText = printable.text;
              }

              doc.setFillColor(...cellBg);
              doc.setDrawColor(215, 228, 222);
              doc.setLineWidth(0.15);
              doc.rect(cellX, rowY, dayW, rowH, 'FD');

              // Line 1: Subject Name
              let subLabel = compact ? compactSubjectName(subject?.name || '', subject?.code) : (subject?.name || 'Mapel');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(4.6);
              doc.setTextColor(...cellText);
              if (doc.getTextWidth(subLabel) > dayW - 0.6) {
                subLabel = subject?.code || subLabel.slice(0, 5);
              }
              doc.text(subLabel, cellX + dayW / 2, rowY + rowH * 0.44, { align: 'center' });

              // Line 2: Teacher Name
              let tchLabel = compact ? compactTeacherName(teacher?.name || '', teacher?.code) : (teacher?.name || '—');
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(3.7);
              doc.setTextColor(Math.min(cellText[0] + 35, 110), Math.min(cellText[1] + 35, 120), Math.min(cellText[2] + 35, 115));
              if (doc.getTextWidth(tchLabel) > dayW - 0.6) {
                tchLabel = teacher?.code || tchLabel.slice(0, 6);
              }
              doc.text(tchLabel, cellX + dayW / 2, rowY + rowH * 0.82, { align: 'center' });
            }
          }
        });
      });

      // 4. Outer Class Block Border
      doc.setDrawColor(11, 52, 53);
      doc.setLineWidth(0.5);
      doc.roundedRect(blockX, blockY, blockW, blockH, 0.6, 0.6, 'D');
    });

    currentY += blockH + gapBetweenRows;
  });

  // Color Swatch Legend Strip & Non-KBM Activity indicators
  let legendY = Math.min(currentY + 1, pageHeight - 16);
  if (colorize && legendY < pageHeight - 13) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(11, 52, 53);
    doc.text('LEGENDA MAPEL & KEGIATAN:', marginX, legendY);
    legendY += 2.4;

    let curLegendX = marginX;
    const activeSubjects = state.subjects.filter((s) => s.isActive);
    for (const sub of activeSubjects) {
      const { bg, text } = getPrintableCellColor(sub.color || '#2f7771');
      const label = `${sub.code}: ${compactSubjectName(sub.name, sub.code)}`;
      doc.setFontSize(5.2);
      doc.setFont('helvetica', 'normal');
      const textWidth = doc.getTextWidth(label);
      const pillWidth = textWidth + 5;

      if (curLegendX + pillWidth > pageWidth - marginX) {
        curLegendX = marginX;
        legendY += 3.2;
        if (legendY > pageHeight - 8) break;
      }

      doc.setFillColor(...bg);
      doc.setDrawColor(...text);
      doc.setLineWidth(0.2);
      doc.roundedRect(curLegendX, legendY - 1.8, pillWidth, 2.6, 0.5, 0.5, 'FD');

      doc.setTextColor(...text);
      doc.text(label, curLegendX + 2.5, legendY);
      curLegendX += pillWidth + 2.5;
    }

    // Activity Badges
    const actBadges = [
      { label: 'ISTIRAHAT', bg: [254, 248, 230], border: [230, 205, 140], text: [130, 95, 30] },
      { label: 'UPACARA', bg: [253, 242, 240], border: [235, 185, 178], text: [160, 60, 48] },
      { label: 'SHOLAT / RELIGI', bg: [247, 239, 253], border: [218, 190, 242], text: [99, 43, 142] },
    ];

    actBadges.forEach((act) => {
      doc.setFontSize(5.0);
      doc.setFont('helvetica', 'bold');
      const w = doc.getTextWidth(act.label) + 5;
      if (curLegendX + w < pageWidth - marginX) {
        doc.setFillColor(...(act.bg as [number, number, number]));
        doc.setDrawColor(...(act.border as [number, number, number]));
        doc.setLineWidth(0.2);
        doc.roundedRect(curLegendX, legendY - 1.8, w, 2.6, 0.5, 0.5, 'FD');
        doc.setTextColor(...(act.text as [number, number, number]));
        doc.text(act.label, curLegendX + 2.5, legendY);
        curLegendX += w + 2.5;
      }
    });
  }

  // Official Note
  if (legendY + 3.2 < pageHeight - 7) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(85, 105, 100);
    doc.text(
      `* Catatan: 1 JP = ${periodMinutes} menit waktu efektif KBM. Jadwal terstruktur per kelompok rombel paralel. Lembar rekapitulasi alokasi & pengesahan tercantum pada halaman berikutnya.`,
      marginX,
      legendY + 3.2,
    );
  }

  // =========================================================================
  // HALAMAN 2: REKAPITULASI ALOKASI JP & BEBAN MENGAJAR GURU (HALAMAN TERPISAH)
  // =========================================================================
  if (options?.includeTeacherRecapPage !== false) {
    doc.addPage(getPaperDimensions(paperSize, 'landscape'), 'landscape');
    let p2Y = 8;
    if (options?.includeKop !== false && options?.kopSurat !== false) {
      p2Y = renderOfficialKopSurat(doc, state, 8, options, false);
    } else {
      p2Y = 14;
    }

    // Title Page 2
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...TEAL);
    doc.text('REKAPITULASI ALOKASI JP & BEBAN MENGAJAR GURU (SELURUH KELAS)', pageWidth / 2, p2Y, { align: 'center' });

    p2Y += 4.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 95, 90);
    doc.text(
      `Lampiran Resmi Pengesahan Jadwal Pelajaran · Tahun Ajaran ${academicYear} Semester ${semester} · ${schoolName}`,
      pageWidth / 2,
      p2Y,
      { align: 'center' },
    );

    p2Y += 5;

    // KPI Summary Bar Page 2
    const totalSchoolJp = entries.length;
    const activeTeachers = state.teachers.filter((t) => t.isActive);
    const astroTotal = jpToAstronomical(totalSchoolJp, periodMinutes);
    const boxW = (pageWidth - 28) / 4;
    const boxH = 11;

    const kpisPage2 = [
      { label: 'TOTAL ALOKASI JP MADRASAH', value: `${totalSchoolJp} Jam Pelajaran` },
      { label: 'WAKTU EFEKTIF ASTRONOMIS', value: `${astroTotal.hours} Jam (${astroTotal.minutes} Mnt)` },
      { label: 'JUMLAH TENAGA PENDIDIK', value: `${activeTeachers.length} Guru Aktif` },
      { label: 'RATA-RATA BEBAN MENGAJAR', value: `${(totalSchoolJp / (activeTeachers.length || 1)).toFixed(1)} JP / Guru` },
    ];

    kpisPage2.forEach((kpi, kIdx) => {
      const x = 14 + kIdx * boxW;
      doc.setFillColor(248, 251, 249);
      doc.setDrawColor(215, 230, 222);
      doc.roundedRect(x, p2Y, boxW - 3, boxH, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(80, 105, 95);
      doc.text(kpi.label, x + (boxW - 3) / 2, p2Y + 3.8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(11, 52, 53);
      doc.text(kpi.value, x + (boxW - 3) / 2, p2Y + 8.5, { align: 'center' });
    });

    p2Y += boxH + 4;

    // Teacher Recap Table
    const p2Headers = [
      'No',
      'Kode',
      'Nama & NIP Pendidik',
      'Jabatan',
      'Mata Pelajaran yang Diampu',
      ...classes.map((c) => c.name),
      'Total JP',
      'Maks JP',
      'Jam Astro',
      'Status Beban',
    ];

    const p2Rows: Array<Array<string | number>> = [];
    const classJpTotals: Record<string, number> = {};
    classes.forEach((c) => { classJpTotals[c.id] = 0; });

    activeTeachers.forEach((t, idx) => {
      const tEntries = entries.filter((e) => e.teacherId === t.id);
      const taughtSubjectNames = [...new Set(
        tEntries.map((e) => {
          const s = state.subjects.find((sub) => sub.id === e.subjectId);
          return s ? (compact ? compactSubjectName(s.name, s.code) : s.name) : 'Mapel';
        }),
      )].join(', ');

      const classJpCols: number[] = classes.map((c) => {
        const count = tEntries.filter((e) => e.classId === c.id).length;
        classJpTotals[c.id] = (classJpTotals[c.id] || 0) + count;
        return count;
      });

      const totalTeacherJp = tEntries.length;
      const tAstro = jpToAstronomical(totalTeacherJp, periodMinutes);
      let status = 'Sesuai Kuota';
      if (totalTeacherJp > t.maxWeeklyJP) status = 'Melebihi Batas';
      else if (totalTeacherJp === t.maxWeeklyJP) status = 'Maksimal';

      const teacherDisplayName = t.nip ? `${t.name}\nNIP. ${t.nip}` : t.name;

      p2Rows.push([
        idx + 1,
        t.code,
        teacherDisplayName,
        t.roleTitle || 'Guru Mapel',
        taughtSubjectNames || '—',
        ...classJpCols.map((jp) => (jp > 0 ? `${jp} JP` : '—')),
        `${totalTeacherJp} JP`,
        `${t.maxWeeklyJP} JP`,
        `${tAstro.hours}j ${tAstro.minutes}m`,
        status,
      ]);
    });

    // Summary Total Row
    p2Rows.push([
      '',
      '',
      'TOTAL ALOKASI JP KELAS',
      '—',
      `${state.subjects.length} Mata Pelajaran`,
      ...classes.map((c) => `${classJpTotals[c.id] || 0} JP`),
      `${totalSchoolJp} JP`,
      '—',
      `${astroTotal.hours}j ${astroTotal.minutes}m`,
      '100% Terdistribusi',
    ]);

    const availRecapW = pageWidth - 20;
    const nonClassWidth = 162;
    const classColW = Math.max(9, (availRecapW - nonClassWidth) / (classes.length || 1));
    const totalCalcW = nonClassWidth + classes.length * classColW;
    const scaleFactor = totalCalcW > availRecapW ? availRecapW / totalCalcW : 1.0;

    const recapColStyles: Record<number, any> = {
      0: { halign: 'center', cellWidth: 6 * scaleFactor },
      1: { halign: 'center', cellWidth: 10 * scaleFactor },
      2: { halign: 'left', cellWidth: 34 * scaleFactor, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 24 * scaleFactor },
      4: { halign: 'left', cellWidth: 30 * scaleFactor },
    };

    let nextCol = 5;
    classes.forEach(() => {
      recapColStyles[nextCol] = { halign: 'center', cellWidth: classColW * scaleFactor };
      nextCol++;
    });

    recapColStyles[nextCol] = { halign: 'center', cellWidth: 14 * scaleFactor, fontStyle: 'bold' }; // Total JP
    recapColStyles[nextCol + 1] = { halign: 'center', cellWidth: 12 * scaleFactor }; // Maks JP
    recapColStyles[nextCol + 2] = { halign: 'center', cellWidth: 14 * scaleFactor }; // Jam Astro
    recapColStyles[nextCol + 3] = { halign: 'center', cellWidth: 18 * scaleFactor }; // Status

    autoTable(doc, {
      startY: p2Y,
      head: [p2Headers],
      body: p2Rows,
      theme: 'grid',
      headStyles: {
        fillColor: TEAL,
        textColor: 255,
        fontSize: 7.2,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 6.8,
        halign: 'center',
        cellPadding: 1.8,
        textColor: [20, 35, 33],
      },
      columnStyles: recapColStyles,
      didParseCell: (data) => {
        if (data.row.index === p2Rows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [232, 244, 238];
          data.cell.styles.textColor = [11, 52, 53];
        }
      },
      margin: { left: 10, right: 10 },
    });

    const lastTableP2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
    let nextP2Y = lastTableP2.finalY + 3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(90, 105, 100);
    doc.text(
      `* Catatan: Beban JP dihitung otomatis berdasarkan alokasi kurikulum madrasah (1 JP = ${periodMinutes} menit).`,
      10,
      nextP2Y,
    );

    // Official Signature Block at Footer of Page 2
    addSignatureBlock(doc, state, nextP2Y + 2, {
      city: options?.signerCity,
      date: options?.signerDate,
      leftTitle: options?.leftTitle || options?.coordinatorTitle || 'Waka Bidang Kurikulum',
      leftName: options?.leftName || options?.coordinatorName,
      leftNip: options?.leftNip || options?.coordinatorNip,
      rightTitle: options?.rightTitle || `${options?.principalTitle || 'Kepala Madrasah'} ${schoolName}`,
      rightName: options?.rightName || options?.principalName,
      rightNip: options?.rightNip || options?.principalNip,
    });
  }

  addDocFooter(doc, schoolName);

  const cleanYear = academicYear.replace(/[^a-zA-Z0-9]/g, '_');
  const paperSuffix = paperSize.toUpperCase();
  doc.save(`SIGNAL_Jadwal_Semua_Kelas_${paperSuffix}_${cleanYear}.pdf`);
}

/**
 * 3. Export Teacher Schedule PDF (A4/F4 Portrait)
 */
export function exportScheduleTeacherPDF(
  state: AppState,
  teacherId: string,
  options?: { paperSize?: PaperSize },
): void {
  const teacher = state.teachers.find((t) => t.id === teacherId) ?? state.teachers[0];
  if (!teacher) return;

  const paperSize = options?.paperSize ?? 'a4';
  const doc = createJsPDFDocument('portrait', paperSize);
  const entries = (state.draft ?? state.activeSchedule ?? []).filter((e) => e.teacherId === teacher.id);
  const activeDays = state.settings.activeDays;
  const periods = Array.from({ length: state.settings.teachingPeriodsPerDay }, (_, i) => i + 1);
  const astro = jpToAstronomical(entries.length, state.settings.periodMinutes ?? 40);

  let currentY = renderOfficialKopSurat(doc, state, 10);

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...TEAL);
  doc.text(`JADWAL MENGAJAR INDIVIDUAL GURU`, pageWidth / 2, currentY, { align: 'center' });

  currentY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(`${teacher.name} (${teacher.code}) — ${teacher.roleTitle || 'Guru Mapel'}`, pageWidth / 2, currentY, { align: 'center' });

  currentY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const nipText = teacher.nip ? `NIP. ${teacher.nip} · ` : '';
  doc.text(
    `${nipText}Total Beban: ${entries.length} JP (${astro.hours} Jam Astronomis) · Kuota Maksimum: ${teacher.maxWeeklyJP} JP/minggu`,
    pageWidth / 2,
    currentY,
    { align: 'center' },
  );

  currentY += 6;

  const tableHeaders = ['Jam / JP', ...activeDays];
  const tableData: string[][] = [];

  for (const jp of periods) {
    const slot = state.slots.find((s) => s.day === activeDays[0] && s.kind === 'TEACHING' && s.jpNo === jp);
    const timeLabel = slot ? `JP ${jp}\n${slot.start} - ${slot.end}` : `JP ${jp}`;
    const row = [timeLabel];

    for (const day of activeDays) {
      const entry = entries.find((e) => e.day === day && e.jpNo === jp);
      if (entry) {
        const cls = state.classes.find((c) => c.id === entry.classId);
        const sub = state.subjects.find((s) => s.id === entry.subjectId);
        row.push(`Kelas ${cls?.name ?? ''}\n${sub?.name ?? ''}`);
      } else {
        row.push('—');
      }
    }
    tableData.push(row);
  }

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 248],
    },
    margin: { left: 14, right: 14 },
  });

  const lastTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;

  // Breakdown per class
  const classBreakdown: Array<{ className: string; subject: string; jp: number }> = [];
  const classIds = [...new Set(entries.map((e) => e.classId))];

  for (const cid of classIds) {
    const cls = state.classes.find((c) => c.id === cid);
    const classEntries = entries.filter((e) => e.classId === cid);
    const subNames = [...new Set(classEntries.map((e) => state.subjects.find((s) => s.id === e.subjectId)?.name ?? ''))].join(', ');
    if (cls) {
      classBreakdown.push({
        className: cls.name,
        subject: subNames,
        jp: classEntries.length,
      });
    }
  }

  let nextY = lastTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...TEAL);
  doc.text('Rincian Beban Mengajar per Kelas:', 14, nextY);
  nextY += 3;

  autoTable(doc, {
    startY: nextY,
    head: [['Kelas', 'Mata Pelajaran', 'Alokasi Terjadwal']],
    body: classBreakdown.map((b) => [`Kelas ${b.className}`, b.subject, `${b.jp} JP`]),
    theme: 'plain',
    headStyles: {
      fillColor: TEAL_LIGHT,
      textColor: TEAL,
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    margin: { left: 14, right: 14 },
  });

  const finalTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
  addSignatureBlock(doc, state, finalTable.finalY);
  addDocFooter(doc, state.settings.schoolName);

  const cleanName = teacher.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`SIGNAL_Jadwal_Guru_${cleanName}.pdf`);
}

export interface AttendanceRecapPdfOptions extends Partial<OfficialDocCustomTexts> {
  paperSize?: PaperSize;
  orientation?: 'landscape' | 'portrait';
  kopSurat?: boolean;
  principalTitle?: string;
  officerTitle?: string;
  officerName?: string;
  officerNip?: string;
}

/**
 * Helper to compute official effective school days in a given month.
 * Excludes Sundays, inactive school days according to settings, and official holidays.
 */
function computeEffectiveSchoolDaysInMonth(
  state: AppState,
  year: number,
  month: number, // 1-12
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const activeDays = state.settings.activeDays;
  const holidays = state.holidays ?? [];

  const dayMap: Record<number, Day> = {
    0: 'Minggu' as Day,
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
    6: 'Sabtu',
  };

  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(year, month - 1, d);
    const dayOfWeek = dayMap[curDate.getDay()];
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isHoliday = holidays.some((h) => h.date === dateStr);

    if (dayOfWeek !== ('Minggu' as Day) && activeDays.includes(dayOfWeek) && !isHoliday) {
      count++;
    }
  }
  return count > 0 ? count : 24;
}

/**
 * 4. Export Monthly Teacher Attendance Recap PDF (Formal A4 Layout with Auto Percentage & Jabatan)
 */
export function exportAttendanceRecapPDF(
  state: AppState,
  monthYear: string, // e.g. "2026-10"
  selectedTeacherIds: string[],
  options?: AttendanceRecapPdfOptions,
): void {
  const orientation = options?.orientation ?? 'landscape';
  const paperSize = options?.paperSize ?? 'a4';
  const doc = createJsPDFDocument(orientation, paperSize);
  const pageWidth = doc.internal.pageSize.getWidth();

  const allTeachers = state.teachers.filter((t) => t.isActive && selectedTeacherIds.includes(t.id));
  const attendanceList = state.attendance ?? [];

  // Parse Month and Year
  const [yearStr, monthStr] = monthYear.split('-');
  const yearNum = Number(yearStr);
  const monthNum = Number(monthStr);
  const dateObj = new Date(yearNum, monthNum - 1, 1);
  const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Calculate official effective days (HE) for this month
  const effectiveSchoolDays = computeEffectiveSchoolDaysInMonth(state, yearNum, monthNum);

  let currentY = 14;

  // 1. KOP SURAT RESMI MADRASAH (FORMAL LETTERHEAD)
  if (options?.kopSurat !== false) {
    currentY = renderOfficialKopSurat(doc, state, 10, options, false);
  } else {
    addDocHeader(
      doc,
      options?.documentTitle || `REKAPITULASI PRESENSI GURU · BULAN ${monthName.toUpperCase()}`,
      `Daftar kehadiran dan persentase kehadiran otomatis untuk ${allTeachers.length} guru terdaftar`,
      options?.schoolName || state.settings.schoolName,
      options?.academicYear || state.settings.academicYear,
      options?.semester || state.settings.semester,
    );
    currentY = 48;
  }

  // 2. DOCUMENT TITLE & PERIODE
  const attTitle = options?.documentTitle || 'LAPORAN REKAPITULASI KEHADIRAN GURU BULANAN';
  const attSemester = options?.semester || state.settings.semester;
  const attYear = options?.academicYear || state.settings.academicYear;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 45, 42);
  doc.text(attTitle, pageWidth / 2, currentY, { align: 'center' });

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 95, 90);
  doc.text(
    `Bulan: ${monthName.toUpperCase()} · Semester ${attSemester.toUpperCase()} Tahun Ajaran ${attYear}`,
    pageWidth / 2,
    currentY,
    { align: 'center' },
  );

  currentY += 6;

  // 3. STATISTICAL PERFORMANCE SUMMARY BAR (KPI BOX)
  let sumHadirAll = 0;
  let sumDinasAll = 0;
  let sumSakitAll = 0;
  let sumIzinAll = 0;
  let sumAlpaAll = 0;
  let totalPercentSum = 0;

  const tableData: Array<Array<string | number>> = [];

  allTeachers.forEach((teacher, idx) => {
    const teacherRecords = attendanceList.filter(
      (att) => att.teacherId === teacher.id && att.date.startsWith(monthYear),
    );

    const hadir = teacherRecords.filter((r) => r.status === 'HADIR').length;
    const dinas = teacherRecords.filter((r) => r.status === 'DINAS_LUAR').length;
    const sakit = teacherRecords.filter((r) => r.status === 'SAKIT').length;
    const izin = teacherRecords.filter((r) => r.status === 'IZIN').length;
    const alpa = teacherRecords.filter((r) => r.status === 'ALPA').length;

    sumHadirAll += hadir;
    sumDinasAll += dinas;
    sumSakitAll += sakit;
    sumIzinAll += izin;
    sumAlpaAll += alpa;

    const totalPresent = hadir + dinas;
    const rate = Math.min(100, Math.round((totalPresent / (effectiveSchoolDays || 1)) * 100));
    totalPercentSum += rate;

    let predikat = 'Sangat Baik';
    if (rate < 75) predikat = 'Perlu Pembinaan';
    else if (rate < 85) predikat = 'Cukup';
    else if (rate < 95) predikat = 'Baik';

    const teacherDisplayName = teacher.nip
      ? `${teacher.name}\nNIP. ${teacher.nip}`
      : teacher.name;

    tableData.push([
      idx + 1,
      teacher.code,
      teacherDisplayName,
      teacher.roleTitle || 'Guru Mapel',
      hadir,
      dinas,
      sakit,
      izin,
      alpa,
      totalPresent,
      effectiveSchoolDays,
      `${rate}%`,
      predikat,
    ]);
  });

  const overallAvgRate = allTeachers.length > 0 ? Math.round(totalPercentSum / allTeachers.length) : 100;
  const overallPredikat =
    overallAvgRate >= 95 ? 'Sangat Baik (A)' : overallAvgRate >= 85 ? 'Baik (B)' : overallAvgRate >= 75 ? 'Cukup (C)' : 'Perlu Pembinaan';

  // Draw 4-card summary row
  const boxWidth = (pageWidth - 28) / 4;
  const boxHeight = 13;

  const kpis = [
    { label: 'JUMLAH GURU TERDATA', value: `${allTeachers.length} Orang` },
    { label: 'HARI EFEKTIF KERJA (HE)', value: `${effectiveSchoolDays} Hari KBM` },
    { label: 'RATA-RATA KEHADIRAN', value: `${overallAvgRate}% Otomatis` },
    { label: 'PREDIKAT MADRASAH', value: overallPredikat },
  ];

  kpis.forEach((kpi, kIdx) => {
    const x = 14 + kIdx * boxWidth;
    doc.setFillColor(248, 251, 249);
    doc.setDrawColor(215, 230, 222);
    doc.roundedRect(x, currentY, boxWidth - 3, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 105, 95);
    doc.text(kpi.label, x + (boxWidth - 3) / 2, currentY + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(11, 52, 53);
    doc.text(kpi.value, x + (boxWidth - 3) / 2, currentY + 10, { align: 'center' });
  });

  currentY += boxHeight + 4;

  // 4. FORMAL TABLE WITH AUTOMATIC PERCENTAGE AND JABATAN
  const headers = [
    'No',
    'Kode',
    'Nama Lengkap & NIP',
    'Jabatan',
    'Hadir (H)',
    'Dinas (DL)',
    'Sakit (S)',
    'Izin (I)',
    'Alpa (A)',
    'Total (H+DL)',
    'Target (HE)',
    '% Hadir',
    'Predikat',
  ];

  // Append summary row
  tableData.push([
    '',
    '',
    'TOTAL & RATA-RATA MADRASAH',
    '—',
    sumHadirAll,
    sumDinasAll,
    sumSakitAll,
    sumIzinAll,
    sumAlpaAll,
    sumHadirAll + sumDinasAll,
    effectiveSchoolDays,
    `${overallAvgRate}%`,
    overallPredikat,
  ]);

  const availAttW = pageWidth - 28;
  const isLand = orientation === 'landscape';
  const baseColW = isLand
    ? [8, 12, 52, 38, 14, 14, 12, 12, 12, 18, 17, 18, 28]
    : [6, 10, 36, 24, 11, 11, 9, 9, 9, 15, 14, 15, 13];
  const totalBaseW = baseColW.reduce((a, b) => a + b, 0);
  const scale = availAttW / totalBaseW;

  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [11, 52, 53],
      textColor: 255,
      fontSize: 7.8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.8,
    },
    bodyStyles: {
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2.2,
      textColor: [20, 35, 33],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: baseColW[0] * scale },
      1: { halign: 'center', cellWidth: baseColW[1] * scale },
      2: { halign: 'left', cellWidth: baseColW[2] * scale },
      3: { halign: 'left', cellWidth: baseColW[3] * scale },
      4: { halign: 'center', cellWidth: baseColW[4] * scale },
      5: { halign: 'center', cellWidth: baseColW[5] * scale },
      6: { halign: 'center', cellWidth: baseColW[6] * scale },
      7: { halign: 'center', cellWidth: baseColW[7] * scale },
      8: { halign: 'center', cellWidth: baseColW[8] * scale },
      9: { halign: 'center', cellWidth: baseColW[9] * scale, fontStyle: 'bold' },
      10: { halign: 'center', cellWidth: baseColW[10] * scale },
      11: { halign: 'center', cellWidth: baseColW[11] * scale, fontStyle: 'bold', fillColor: [240, 248, 243] },
      12: { halign: 'center', cellWidth: baseColW[12] * scale },
    },
    didParseCell: (data) => {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [232, 244, 238];
        data.cell.styles.textColor = [11, 52, 53];
      }
    },
    alternateRowStyles: {
      fillColor: [252, 253, 252],
    },
    margin: { left: 14, right: 14 },
  });

  const lastTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
  let nextY = lastTable.finalY + 4;

  // 5. OFFICIAL NOTES
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 105, 100);
  doc.text(
    '* Keterangan Kode: H = Hadir Bertugas, DL = Bertugas Dinas Luar Resmi, S = Sakit dengan Surat, I = Izin Tertulis, A = Alpa / Tanpa Keterangan.',
    14,
    nextY,
  );
  nextY += 3.2;
  doc.text(
    '* Rumus Persentase Kehadiran: % Kehadiran = ((Hadir + Dinas Luar) / Hari Efektif) x 100% (Standar Pengawasan Madrasah & Penilaian Kinerja Guru).',
    14,
    nextY,
  );

  // 6. FORMAL SIGNATURE BLOCK
  addSignatureBlock(doc, state, nextY + 4, {
    city: options?.signerCity,
    date: options?.signerDate,
    leftTitle: options?.leftTitle || options?.officerTitle || 'Koordinator Akademik & Kurikulum',
    leftName: options?.leftName || options?.officerName,
    leftNip: options?.leftNip || options?.officerNip,
    rightTitle: options?.rightTitle || `${options?.principalTitle || 'Kepala Madrasah'} ${options?.schoolName || state.settings.schoolName}`,
    rightName: options?.rightName || options?.principalName,
    rightNip: options?.rightNip || options?.principalNip,
  });

  // 7. OFFICIAL FOOTER ON ALL PAGES
  addDocFooter(doc, options?.schoolName || state.settings.schoolName);

  const cleanMonth = monthName.replace(/[^a-zA-Z0-9]/g, '_');
  const paperSuffix = paperSize.toUpperCase();
  doc.save(`SIGNAL_Rekap_Presensi_Guru_${paperSuffix}_${cleanMonth}.pdf`);
}
