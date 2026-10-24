import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppState, Day, SchoolClass } from '../domain/types';
import { jpToAstronomical } from '../domain/time';
import { getDefaultMadrasahLogo } from './madrasahLogo';

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
    doc.setDrawColor(225, 230, 225);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    const dateStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    doc.text(`Dicetak dari SIGNAL · ${schoolName} · ${dateStr}`, 14, pageHeight - 7);
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
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
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const s = state.settings;

  let y = startY + 12;
  if (y + 36 > pageHeight - 16) {
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
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);

  // Left signature
  const leftX = 22;
  doc.text('Mengetahui / Memeriksa,', leftX, y);
  doc.setFont('helvetica', 'bold');
  doc.text(leftTitle, leftX, y + 4.5);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'bold');
  doc.text(leftName, leftX, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(leftNip ? `NIP. ${leftNip}` : 'NIP. ...............................................', leftX, y + 28);

  // Right signature
  const isLandscape = pageWidth > 250;
  const rightX = pageWidth - (isLandscape ? 85 : 75);
  doc.setFontSize(8.5);
  doc.text(`${city}, ${dateStr}`, rightX, y);
  doc.setFont('helvetica', 'bold');
  doc.text(rightTitle, rightX, y + 4.5);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'bold');
  doc.text(rightName, rightX, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(rightNip ? `NIP. ${rightNip}` : 'NIP. ...............................................', rightX, y + 28);
}

/**
 * 1. Export Master School Schedule PDF (A4 Landscape)
 */
export function exportScheduleMasterPDF(state: AppState): void {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const entries = state.draft ?? state.activeSchedule ?? [];
  const classes = state.classes.filter((c) => c.isActive);
  const activeDays = state.settings.activeDays;
  const periods = Array.from({ length: state.settings.teachingPeriodsPerDay }, (_, i) => i + 1);

  let currentY = renderOfficialKopSurat(doc, state, 10);

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...TEAL);
  doc.text('JADWAL PELAJARAN INDUK MADRASAH (MASTER SCHEDULE)', pageWidth / 2, currentY, { align: 'center' });

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Matriks Seluruh Rombel (${classes.map((c) => c.name).join(', ')}) · T.A. ${state.settings.academicYear} Semester ${state.settings.semester}`,
    pageWidth / 2,
    currentY,
    { align: 'center' },
  );

  currentY += 6;

  for (const day of activeDays) {
    const dayEntries = entries.filter((e) => e.day === day);

    // Day Header label
    if (currentY > 165) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text(`HARI: ${day.toUpperCase()}`, 14, currentY);
    currentY += 4;

    const tableHeaders = ['JP / Waktu', ...classes.map((c) => `Kelas ${c.name}`)];
    const tableData: string[][] = [];

    for (const jp of periods) {
      const slot = state.slots.find((s) => s.day === day && s.kind === 'TEACHING' && s.jpNo === jp);
      const timeLabel = slot ? `JP ${jp}\n${slot.start}-${slot.end}` : `JP ${jp}`;

      const rowCells = [timeLabel];
      for (const cls of classes) {
        const entry = dayEntries.find((e) => e.classId === cls.id && e.jpNo === jp);
        if (entry) {
          const subject = state.subjects.find((s) => s.id === entry.subjectId);
          const teacher = state.teachers.find((t) => t.id === entry.teacherId);
          rowCells.push(`${subject?.code ?? entry.subjectId}\n(${teacher?.code ?? teacher?.name ?? '—'})`);
        } else {
          rowCells.push('—');
        }
      }
      tableData.push(rowCells);
    }

    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: TEAL,
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [250, 252, 250],
      },
      margin: { left: 14, right: 14 },
    });

    const lastAutoTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
    currentY = lastAutoTable.finalY + 10;
  }

  addSignatureBlock(doc, state, currentY);
  addDocFooter(doc, state.settings.schoolName);

  const cleanYear = state.settings.academicYear.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`SIGNAL_Jadwal_Sekolah_${cleanYear}.pdf`);
}

export interface WeeklyClassSchedulePdfOptions extends Partial<OfficialDocCustomTexts> {
  orientation?: 'landscape' | 'portrait';
  kopSurat?: boolean;
  principalTitle?: string;
  coordinatorTitle?: string;
  coordinatorName?: string;
  coordinatorNip?: string;
  includeTeacherRecapPage?: boolean;
  colorizeSubjects?: boolean;
  compactNames?: boolean;
}

/**
 * Render 2-page Weekly Class Schedule:
 * - Page 1: Clean Timetable Matrix with comfortable typography & KPI cards
 * - Page 2: Dedicated Teacher JP Breakdown & Allocation Recap table with signatures
 */
function renderClassWeeklyPages(
  doc: jsPDF,
  state: AppState,
  cls: SchoolClass,
  options?: WeeklyClassSchedulePdfOptions,
  isFirstClass = true,
): void {
  const orientation = options?.orientation ?? 'landscape';
  if (!isFirstClass) {
    doc.addPage('a4', orientation);
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

  // ==========================================
  // HALAMAN 1: MATRIKS JADWAL MINGGUAN KELAS
  // ==========================================
  let currentY = 12;

  if (options?.kopSurat !== false) {
    currentY = renderOfficialKopSurat(doc, state, 10, options, false);
  } else {
    currentY = 16;
  }

  // Document Title & Class Subtitle
  const academicYear = options?.academicYear || state.settings.academicYear;
  const semester = options?.semester || state.settings.semester;
  const defaultTitle = `JADWAL PELAJARAN MINGGUAN — KELAS ${cls.name}`;
  const docTitle = options?.documentTitle ? `${options.documentTitle} — KELAS ${cls.name}` : defaultTitle;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 45, 42);
  doc.text(docTitle, pageWidth / 2, currentY, { align: 'center' });

  currentY += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 95, 90);
  doc.text(
    `Tingkat ${cls.level} · Tahun Ajaran ${academicYear} · Semester ${semester}`,
    pageWidth / 2,
    currentY,
    { align: 'center' },
  );

  currentY += 5.5;

  // KPI Summary Bar (4 Cards)
  const boxWidth = (pageWidth - 28) / 4;
  const boxHeight = 11.5;

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

  // Calculate day column width
  const timeColWidth = orientation === 'landscape' ? 26 : 20;
  const dayColWidth = (pageWidth - 28 - timeColWidth) / activeDays.length;

  const colStyles: Record<number, { halign: 'center' | 'left' | 'right'; cellWidth: number; fontStyle?: 'bold' | 'normal'; fillColor?: [number, number, number] }> = {
    0: { halign: 'center', cellWidth: timeColWidth, fontStyle: 'bold', fillColor: [248, 250, 248] },
  };
  activeDays.forEach((_, idx) => {
    colStyles[idx + 1] = { halign: 'center', cellWidth: dayColWidth };
  });

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [11, 52, 53],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.8,
    },
    bodyStyles: {
      fontSize: orientation === 'landscape' ? 7.5 : 6.8,
      halign: 'center',
      valign: 'middle',
      cellPadding: orientation === 'landscape' ? 2.5 : 1.8,
      textColor: [20, 35, 33],
      lineColor: [215, 225, 220],
      lineWidth: 0.25,
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
  const p1NoticeY = Math.min(lastTableP1.finalY + 4, pageHeight - 20);

  // Clean Notification Callout at Bottom of Page 1
  doc.setFillColor(243, 248, 245);
  doc.setDrawColor(205, 230, 220);
  doc.roundedRect(14, p1NoticeY, pageWidth - 28, 9, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(17, 65, 55);
  doc.text(
    '👉 Rincian Lengkap & Rekapitulasi Beban JP Per Guru Tercantum Pada Halaman 2 (Lembar Rekapitulasi)',
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
    doc.addPage('a4', orientation);
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
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 14 },
        2: { halign: 'left', cellWidth: orientation === 'landscape' ? 46 : 34, fontStyle: 'bold' },
        3: { halign: 'left', cellWidth: orientation === 'landscape' ? 36 : 26 },
        4: { halign: 'left', cellWidth: orientation === 'landscape' ? 44 : 32 },
        5: { halign: 'center', cellWidth: orientation === 'landscape' ? 26 : 20 },
        6: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
        7: { halign: 'center', cellWidth: orientation === 'landscape' ? 26 : 20 },
        8: { halign: 'center', cellWidth: orientation === 'landscape' ? 26 : 18 },
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
  const doc = new jsPDF({ orientation, format: 'a4' });

  renderClassWeeklyPages(doc, state, cls, options, true);

  addDocFooter(doc, options?.schoolName || state.settings.schoolName);

  const cleanName = cls.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`SIGNAL_Jadwal_Mingguan_Kelas_${cleanName}.pdf`);
}

/**
 * Export All Classes Weekly Schedule PDF (A4 Clean Layout Bundle)
 */
export function exportAllClassesWeeklyPDF(
  state: AppState,
  options?: WeeklyClassSchedulePdfOptions,
): void {
  const classes = state.classes.filter((c) => c.isActive);
  if (classes.length === 0) return;

  const orientation = options?.orientation ?? 'landscape';
  const doc = new jsPDF({ orientation, format: 'a4' });

  classes.forEach((cls, idx) => {
    renderClassWeeklyPages(doc, state, cls, options, idx === 0);
  });

  addDocFooter(doc, options?.schoolName || state.settings.schoolName);

  const cleanYear = (options?.academicYear || state.settings.academicYear).replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`SIGNAL_Jadwal_Mingguan_Semua_Kelas_${cleanYear}.pdf`);
}

export interface AllClassesSinglePagePdfOptions extends Partial<OfficialDocCustomTexts> {
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
 * 2B. Export All Classes in Single Page A4 Landscape + Dedicated Teacher JP Recap Page
 * - Page 1 (A4 Landscape): Master Timetable containing all classes on 1 page with compact names & colorized subject cells
 * - Page 2 (A4 Landscape): Comprehensive Teacher JP Allocation Recap Table with Official Signature Block at Footer
 */
export function exportAllClassesSinglePageA4PDF(
  state: AppState,
  options?: AllClassesSinglePagePdfOptions,
): void {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
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

  // ==========================================
  // HALAMAN 1: SEMUA KELAS DALAM 1 HALAMAN A4
  // ==========================================
  let currentY = 7;
  if (options?.includeKop !== false && options?.kopSurat !== false) {
    currentY = renderOfficialKopSurat(doc, state, 7, options, true);
  } else {
    currentY = 12;
  }

  // Document Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...TEAL);
  const docTitle = options?.documentTitle || 'JADWAL PELAJARAN SELURUH KELAS (SATU HALAMAN A4)';
  doc.text(docTitle.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

  currentY += 3.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(70, 90, 85);
  const subHeading = `Tahun Ajaran ${academicYear} · Semester ${semester} · Seluruh Rombel: ${classes.map((c) => c.name).join(', ')} · ${schoolName}`;
  doc.text(subHeading, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;

  // Build the unified table
  const tableHeaders = ['Hari', 'JP', 'Waktu', ...classes.map((c) => `Kelas ${c.name}`)];
  const tableData: Array<Array<string | number>> = [];
  const cellSubjectMap: Record<number, Record<number, string>> = {};

  let currentRowIdx = 0;
  for (const day of activeDays) {
    for (const jp of periods) {
      const slot = state.slots.find((s) => s.day === day && s.kind === 'TEACHING' && s.jpNo === jp);
      const timeStr = slot ? `${slot.start}-${slot.end}` : '';

      const rowCells: Array<string | number> = [
        day.toUpperCase(),
        jp,
        timeStr,
      ];

      classes.forEach((cls, cIdx) => {
        const colIdx = 3 + cIdx;
        const entry = entries.find((e) => e.classId === cls.id && e.day === day && e.jpNo === jp);
        if (entry) {
          const sub = state.subjects.find((s) => s.id === entry.subjectId);
          const tch = state.teachers.find((t) => t.id === entry.teacherId);
          const sName = compact ? compactSubjectName(sub?.name ?? '', sub?.code) : (sub?.code ?? sub?.name ?? 'Mapel');
          const tName = compact ? compactTeacherName(tch?.name ?? '', tch?.code) : (tch?.code ?? tch?.name ?? '—');
          rowCells.push(`${sName}\n(${tName})`);
          if (!cellSubjectMap[currentRowIdx]) cellSubjectMap[currentRowIdx] = {};
          cellSubjectMap[currentRowIdx][colIdx] = entry.subjectId;
        } else {
          rowCells.push('—');
        }
      });

      tableData.push(rowCells);
      currentRowIdx++;
    }
  }

  // Column width calculations for 297mm width (margin 10mm left, 10mm right = 277mm available)
  const hariWidth = 16;
  const jpWidth = 7;
  const waktuWidth = 17;
  const fixedWidth = hariWidth + jpWidth + waktuWidth; // 40mm
  const classColWidth = Math.max(16, (277 - fixedWidth) / (classes.length || 1));

  const colStyles: Record<number, any> = {
    0: { halign: 'center', cellWidth: hariWidth, fontStyle: 'bold', fillColor: [244, 248, 246] },
    1: { halign: 'center', cellWidth: jpWidth, fontStyle: 'bold', fillColor: [248, 250, 249] },
    2: { halign: 'center', cellWidth: waktuWidth, fillColor: [250, 251, 250] },
  };

  classes.forEach((_, idx) => {
    colStyles[3 + idx] = { halign: 'center', cellWidth: classColWidth };
  });

  // Calculate dynamic compact sizing to guarantee 1 page
  const totalRows = tableData.length;
  const dynamicFontSize = totalRows > 44 ? 5.8 : totalRows > 36 ? 6.2 : 6.6;
  const dynamicPadding = totalRows > 44 ? 0.6 : 0.8;

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    pageBreak: 'avoid',
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.5,
      lineWidth: 0.2,
      lineColor: [200, 215, 210],
    },
    bodyStyles: {
      fontSize: dynamicFontSize,
      halign: 'center',
      valign: 'middle',
      cellPadding: dynamicPadding,
      textColor: [20, 35, 33],
      lineWidth: 0.2,
      lineColor: [215, 225, 220],
    },
    columnStyles: colStyles,
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index >= 3) {
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
    margin: { left: 10, right: 10 },
  });

  const lastTableP1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
  let p1BottomY = Math.min(lastTableP1.finalY + 3, pageHeight - 16);

  // Color Swatch Legend Strip
  if (colorize && p1BottomY < pageHeight - 12) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(11, 52, 53);
    doc.text('LEGENDA WARNA MAPEL:', 10, p1BottomY);
    p1BottomY += 2.2;

    let curLegendX = 10;
    const activeSubjects = state.subjects.filter((s) => s.isActive);
    for (const sub of activeSubjects) {
      const { bg, text } = getPrintableCellColor(sub.color || '#2f7771');
      const label = `${sub.code}: ${compactSubjectName(sub.name, sub.code)}`;
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      const textWidth = doc.getTextWidth(label);
      const pillWidth = textWidth + 5;

      if (curLegendX + pillWidth > pageWidth - 10) {
        curLegendX = 10;
        p1BottomY += 3;
        if (p1BottomY > pageHeight - 6) break;
      }

      doc.setFillColor(...bg);
      doc.setDrawColor(...text);
      doc.setLineWidth(0.2);
      doc.roundedRect(curLegendX, p1BottomY - 1.8, pillWidth, 2.6, 0.6, 0.6, 'FD');

      doc.setTextColor(...text);
      doc.text(label, curLegendX + 2.5, p1BottomY);
      curLegendX += pillWidth + 2.5;
    }
  }

  // Notice about Page 2
  if (p1BottomY + 3.5 < pageHeight - 5) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(90, 110, 105);
    doc.text(
      `* Catatan: 1 JP = ${periodMinutes} menit waktu efektif KBM. Lembar rekapitulasi beban mengajar guru & pengesahan resmi tercantum pada Halaman 2.`,
      10,
      p1BottomY + 3.5,
    );
  }

  // =========================================================================
  // HALAMAN 2: REKAPITULASI ALOKASI JP & BEBAN MENGAJAR GURU (HALAMAN TERPISAH)
  // =========================================================================
  if (options?.includeTeacherRecapPage !== false) {
    doc.addPage('a4', 'landscape');
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

    const recapColStyles: Record<number, any> = {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 12 },
      2: { halign: 'left', cellWidth: 42, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 32 },
      4: { halign: 'left', cellWidth: 38 },
    };

    let nextCol = 5;
    classes.forEach(() => {
      recapColStyles[nextCol] = { halign: 'center', cellWidth: 13 };
      nextCol++;
    });

    recapColStyles[nextCol] = { halign: 'center', cellWidth: 16, fontStyle: 'bold' }; // Total JP
    recapColStyles[nextCol + 1] = { halign: 'center', cellWidth: 14 }; // Maks JP
    recapColStyles[nextCol + 2] = { halign: 'center', cellWidth: 16 }; // Jam Astro
    recapColStyles[nextCol + 3] = { halign: 'center', cellWidth: 20 }; // Status

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
  doc.save(`SIGNAL_Jadwal_Semua_Kelas_Satu_Halaman_${cleanYear}.pdf`);
}

/**
 * 3. Export Teacher Schedule PDF (A4 Portrait)
 */
export function exportScheduleTeacherPDF(state: AppState, teacherId: string): void {
  const teacher = state.teachers.find((t) => t.id === teacherId) ?? state.teachers[0];
  if (!teacher) return;

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
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
  const doc = new jsPDF({ orientation, format: 'a4' });
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
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'left', cellWidth: orientation === 'landscape' ? 50 : 36 },
      3: { halign: 'left', cellWidth: orientation === 'landscape' ? 38 : 28 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', cellWidth: 12 },
      9: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      10: { halign: 'center', cellWidth: 16 },
      11: { halign: 'center', cellWidth: 18, fontStyle: 'bold', fillColor: [240, 248, 243] },
      12: { halign: 'center', cellWidth: orientation === 'landscape' ? 26 : 20 },
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
  doc.save(`SIGNAL_Rekap_Presensi_Guru_${cleanMonth}.pdf`);
}
