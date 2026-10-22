import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppState, Day, SchoolClass } from '../domain/types';
import { jpToAstronomical } from '../domain/time';

// Color palette matching SIGNAL branding
const TEAL = [11, 52, 53] as [number, number, number]; // #0b3435
const TEAL_LIGHT = [235, 244, 240] as [number, number, number];
const GOLD = [188, 148, 94] as [number, number, number]; // #bc945e
const INK = [23, 54, 55] as [number, number, number];
const MUTED = [117, 133, 130] as [number, number, number];

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

function addSignatureBlock(doc: jsPDF, schoolName: string, startY: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = startY + 15;
  if (y + 35 > pageHeight - 20) {
    doc.addPage();
    y = 35;
  }

  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);

  // Left signature (Waka Kurikulum)
  const leftX = 25;
  doc.text(`Mengetahui,`, leftX, y);
  doc.text(`Waka Bidang Kurikulum`, leftX, y + 5);
  doc.text(`( .................................................... )`, leftX, y + 26);
  doc.text(`NIP. ...............................................`, leftX, y + 31);

  // Right signature (Kepala Madrasah)
  const rightX = pageWidth - 80;
  doc.text(`${schoolName}, ${dateStr}`, rightX, y);
  doc.text(`Kepala Madrasah`, rightX, y + 5);
  doc.text(`( .................................................... )`, rightX, y + 26);
  doc.text(`NIP. ...............................................`, rightX, y + 31);
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

  addDocHeader(
    doc,
    'JADWAL PELAJARAN INDUK (MASTER)',
    `Menampilkan seluruh kelas (${classes.map((c) => c.name).join(', ')})`,
    state.settings.schoolName,
    state.settings.academicYear,
    state.settings.semester,
  );

  let currentY = 50;

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

  addSignatureBlock(doc, state.settings.schoolName, currentY);
  addDocFooter(doc, state.settings.schoolName);

  const cleanYear = state.settings.academicYear.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`SIGNAL_Jadwal_Sekolah_${cleanYear}.pdf`);
}

export interface WeeklyClassSchedulePdfOptions {
  orientation?: 'landscape' | 'portrait';
  kopSurat?: boolean;
  signerCity?: string;
  signerDate?: string;
  principalName?: string;
  principalNip?: string;
  coordinatorTitle?: string;
  coordinatorName?: string;
  coordinatorNip?: string;
  includeTeacherRecapPage?: boolean;
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

  const teacherIdsInClass = [...new Set(classEntries.map((e) => e.teacherId))];
  const subjectIdsInClass = [...new Set(classEntries.map((e) => e.subjectId))];

  // ==========================================
  // HALAMAN 1: MATRIKS JADWAL MINGGUAN KELAS
  // ==========================================
  let currentY = 12;

  if (options?.kopSurat !== false) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 35, 33);
    doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', pageWidth / 2, currentY, { align: 'center' });

    currentY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(25, 45, 43);
    doc.text('KANTOR KEMENTERIAN AGAMA KABUPATEN / KOTA', pageWidth / 2, currentY, { align: 'center' });

    currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(11, 52, 53);
    doc.text(`MADRASAH TSANAWIYAH ${state.settings.schoolName.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });

    currentY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 95, 90);
    doc.text(
      `Alamat: Kampus Pendidikan Terpadu · T.A. ${state.settings.academicYear} · Semester ${state.settings.semester}`,
      pageWidth / 2,
      currentY,
      { align: 'center' },
    );

    currentY += 3;
    doc.setDrawColor(11, 52, 53);
    doc.setLineWidth(1.2);
    doc.line(14, currentY, pageWidth - 14, currentY);

    currentY += 1.2;
    doc.setLineWidth(0.4);
    doc.line(14, currentY, pageWidth - 14, currentY);

    currentY += 4.5;
  } else {
    currentY = 16;
  }

  // Document Title & Class Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 45, 42);
  doc.text(`JADWAL PELAJARAN MINGGUAN — KELAS ${cls.name}`, pageWidth / 2, currentY, { align: 'center' });

  currentY += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 95, 90);
  doc.text(
    `Tingkat ${cls.level} · Tahun Ajaran ${state.settings.academicYear} · Semester ${state.settings.semester}`,
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

  for (const jp of periods) {
    const slot = state.slots.find((s) => s.day === activeDays[0] && s.kind === 'TEACHING' && s.jpNo === jp);
    const timeLabel = slot ? `JP ${jp}\n${slot.start} - ${slot.end}` : `JP ${jp}`;
    const row = [timeLabel];

    for (const day of activeDays) {
      const entry = classEntries.find((e) => e.day === day && e.jpNo === jp);
      if (entry) {
        const sub = state.subjects.find((s) => s.id === entry.subjectId);
        const tch = state.teachers.find((t) => t.id === entry.teacherId);
        const subName = sub?.name ?? 'Mapel';
        const tchInfo = tch ? (tch.code ? `[${tch.code}] ${tch.name}` : tch.name) : '—';
        row.push(`${subName}\n${tchInfo}`);
      } else {
        row.push('—');
      }
    }
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
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 35, 33);
      doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', pageWidth / 2, p2Y, { align: 'center' });

      p2Y += 4.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(25, 45, 43);
      doc.text('KANTOR KEMENTERIAN AGAMA KABUPATEN / KOTA', pageWidth / 2, p2Y, { align: 'center' });

      p2Y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(11, 52, 53);
      doc.text(`MADRASAH TSANAWIYAH ${state.settings.schoolName.toUpperCase()}`, pageWidth / 2, p2Y, { align: 'center' });

      p2Y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80, 95, 90);
      doc.text(
        `Alamat: Kampus Pendidikan Terpadu · T.A. ${state.settings.academicYear} · Semester ${state.settings.semester}`,
        pageWidth / 2,
        p2Y,
        { align: 'center' },
      );

      p2Y += 3;
      doc.setDrawColor(11, 52, 53);
      doc.setLineWidth(1.2);
      doc.line(14, p2Y, pageWidth - 14, p2Y);

      p2Y += 1.2;
      doc.setLineWidth(0.4);
      doc.line(14, p2Y, pageWidth - 14, p2Y);

      p2Y += 4.5;
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
      `Lampiran Resmi Jadwal Mingguan Kelas ${cls.name} (Tingkat ${cls.level}) · Semester ${state.settings.semester} T.A. ${state.settings.academicYear}`,
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

    // Build Teacher Recap Breakdown Data
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

      const tAstro = jpToAstronomical(tEntries.length, periodMinutes);
      const totalSchoolJp = allEntries.filter((e) => e.teacherId === teacher.id).length;

      let status = 'Sesuai Kuota';
      if (totalSchoolJp > teacher.maxWeeklyJP) status = 'Melebihi Batas';
      else if (totalSchoolJp === teacher.maxWeeklyJP) status = 'Maksimal';

      teacherDataRows.push([
        idx + 1,
        teacher.code,
        teacher.name,
        taughtSubjectNames,
        daysStr,
        `${tEntries.length} JP`,
        `${tAstro.hours}j (${tAstro.minutes}m)`,
        `${totalSchoolJp} / ${teacher.maxWeeklyJP} JP`,
        status,
      ]);
    });

    // Summary Total Row
    teacherDataRows.push([
      '',
      '',
      `TOTAL & RATA-RATA KELAS ${cls.name}`,
      `${subjectIdsInClass.length} Mata Pelajaran`,
      `${activeDays.length} Hari KBM`,
      `${classEntries.length} JP`,
      `${astro.hours}j (${astro.minutes}m)`,
      '—',
      '100% Terpenuhi',
    ]);

    const p2Headers = [
      'No',
      'Kode',
      'Nama Lengkap Guru / Pendidik',
      'Mata Pelajaran yang Diampu',
      'Hari Mengajar',
      'Beban Kelas',
      'Waktu Astronomis',
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
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 2.8,
      },
      bodyStyles: {
        fontSize: 8,
        halign: 'center',
        cellPadding: 2.3,
        textColor: [20, 35, 33],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 15 },
        2: { halign: 'left', cellWidth: orientation === 'landscape' ? 52 : 38, fontStyle: 'bold' },
        3: { halign: 'left', cellWidth: orientation === 'landscape' ? 50 : 36 },
        4: { halign: 'center', cellWidth: orientation === 'landscape' ? 32 : 24 },
        5: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
        6: { halign: 'center', cellWidth: orientation === 'landscape' ? 30 : 24 },
        7: { halign: 'center', cellWidth: orientation === 'landscape' ? 28 : 22 },
        8: { halign: 'center', cellWidth: orientation === 'landscape' ? 32 : 20 },
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

    // Official Signature Block on Page 2
    let sigY = nextP2Y + 6;
    if (sigY + 34 > pageHeight - 14) {
      doc.addPage('a4', orientation);
      sigY = 22;
    }

    const signerCity = options?.signerCity || 'Kota Madrasah';
    const signerDate =
      options?.signerDate ||
      new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    const principalName = options?.principalName || 'Drs. H. M. Zainuddin, M.Pd.I';
    const principalNip = options?.principalNip || '197405101999031003';
    const coordinatorTitle = options?.coordinatorTitle || `Wali Kelas ${cls.name} / Koordinator Kurikulum`;
    const coordinatorName = options?.coordinatorName || 'Ahmad Fauzi, S.Pd.';
    const coordinatorNip = options?.coordinatorNip || '198204122008011015';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(23, 54, 55);

    // Left Signer
    const leftX = 20;
    doc.text('Mengetahui / Memeriksa,', leftX, sigY);
    doc.setFont('helvetica', 'bold');
    doc.text(coordinatorTitle, leftX, sigY + 4.5);
    doc.setFont('helvetica', 'normal');

    doc.setFont('helvetica', 'bold');
    doc.text(coordinatorName, leftX, sigY + 23);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`NIP. ${coordinatorNip}`, leftX, sigY + 27);

    // Right Signer
    const rightX = pageWidth - (orientation === 'landscape' ? 85 : 75);
    doc.setFontSize(8.5);
    doc.text(`${signerCity}, ${signerDate}`, rightX, sigY);
    doc.setFont('helvetica', 'bold');
    doc.text(`Kepala Madrasah ${state.settings.schoolName}`, rightX, sigY + 4.5);
    doc.setFont('helvetica', 'normal');

    doc.setFont('helvetica', 'bold');
    doc.text(principalName, rightX, sigY + 23);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`NIP. ${principalNip}`, rightX, sigY + 27);
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

  addDocFooter(doc, state.settings.schoolName);

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

  addDocFooter(doc, state.settings.schoolName);

  const cleanYear = state.settings.academicYear.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`SIGNAL_Jadwal_Mingguan_Semua_Kelas_${cleanYear}.pdf`);
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

  addDocHeader(
    doc,
    `JADWAL MENGAJAR GURU: ${teacher.name}`,
    `Kode: ${teacher.code} · Total Beban: ${entries.length} JP (${astro.hours} Jam Astronomis) · Batas: ${teacher.maxWeeklyJP} JP`,
    state.settings.schoolName,
    state.settings.academicYear,
    state.settings.semester,
  );

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
    startY: 50,
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
  addSignatureBlock(doc, state.settings.schoolName, finalTable.finalY);
  addDocFooter(doc, state.settings.schoolName);

  const cleanName = teacher.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`SIGNAL_Jadwal_Guru_${cleanName}.pdf`);
}

export interface AttendanceRecapPdfOptions {
  orientation?: 'landscape' | 'portrait';
  kopSurat?: boolean;
  signerCity?: string;
  signerDate?: string;
  principalName?: string;
  principalNip?: string;
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
 * 4. Export Monthly Teacher Attendance Recap PDF (Formal A4 Layout with Auto Percentage)
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
  const pageHeight = doc.internal.pageSize.getHeight();

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
    // Instansi Pemerintah / Kementerian
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 35, 33);
    doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', pageWidth / 2, currentY, { align: 'center' });

    currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 45, 43);
    doc.text('KANTOR KEMENTERIAN AGAMA KABUPATEN / KOTA', pageWidth / 2, currentY, { align: 'center' });

    currentY += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(11, 52, 53); // Teal Signature
    doc.text(`MADRASAH TSANAWIYAH ${state.settings.schoolName.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });

    currentY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 95, 90);
    doc.text(
      `Alamat: Kampus Pendidikan Madrasah Terpadu No. 01 · NPSN: 20580001 · NSM: 1212350001 · T.A. ${state.settings.academicYear}`,
      pageWidth / 2,
      currentY,
      { align: 'center' },
    );

    currentY += 3.5;
    // Official Double Line
    doc.setDrawColor(11, 52, 53);
    doc.setLineWidth(1.2);
    doc.line(14, currentY, pageWidth - 14, currentY);

    currentY += 1.2;
    doc.setLineWidth(0.4);
    doc.line(14, currentY, pageWidth - 14, currentY);

    currentY += 5;
  } else {
    // Simple Banner Header if Kop Surat disabled
    addDocHeader(
      doc,
      `REKAPITULASI PRESENSI GURU · BULAN ${monthName.toUpperCase()}`,
      `Daftar kehadiran dan persentase kehadiran otomatis untuk ${allTeachers.length} guru terdaftar`,
      state.settings.schoolName,
      state.settings.academicYear,
      state.settings.semester,
    );
    currentY = 48;
  }

  // 2. DOCUMENT TITLE & PERIODE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 45, 42);
  doc.text('LAPORAN REKAPITULASI KEHADIRAN GURU BULANAN', pageWidth / 2, currentY, { align: 'center' });

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 95, 90);
  doc.text(
    `Bulan: ${monthName.toUpperCase()} · Semester ${state.settings.semester.toUpperCase()} Tahun Ajaran ${state.settings.academicYear}`,
    pageWidth / 2,
    currentY,
    { align: 'center' },
  );

  currentY += 6;

  // 3. STATISTICAL PERFORMANCE SUMMARY BAR (KPI BOX)
  // Pre-calculate sums for the KPI summary
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

    // Effective present days = Hadir + Dinas Luar
    const totalPresent = hadir + dinas;
    // Percentage calculated automatically against official effective school days (HE)
    const rate = Math.min(100, Math.round((totalPresent / (effectiveSchoolDays || 1)) * 100));
    totalPercentSum += rate;

    // Official rating predicate
    let predikat = 'Sangat Baik';
    if (rate < 75) predikat = 'Perlu Pembinaan';
    else if (rate < 85) predikat = 'Cukup';
    else if (rate < 95) predikat = 'Baik';

    tableData.push([
      idx + 1,
      teacher.code,
      teacher.name,
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

  // 4. FORMAL TABLE WITH AUTOMATIC PERCENTAGE AND RECAP
  const headers = [
    'No',
    'Kode',
    'Nama Lengkap Guru / Pendidik',
    'Hadir (H)',
    'Dinas (DL)',
    'Sakit (S)',
    'Izin (I)',
    'Alpa (A)',
    'Total (H+DL)',
    'Target (HE)',
    '% Kehadiran',
    'Predikat',
  ];

  // Append summary row
  tableData.push([
    '',
    '',
    'TOTAL & RATA-RATA MADRASAH',
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
      fillColor: [11, 52, 53], // Formal deep teal
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.8,
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      cellPadding: 2.2,
      textColor: [20, 35, 33],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 16 },
      2: { halign: 'left', cellWidth: orientation === 'landscape' ? 64 : 45 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 14 },
      7: { halign: 'center', cellWidth: 14 },
      8: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
      9: { halign: 'center', cellWidth: 18 },
      10: { halign: 'center', cellWidth: 22, fontStyle: 'bold', fillColor: [240, 248, 243] },
      11: { halign: 'center', cellWidth: orientation === 'landscape' ? 28 : 22 },
    },
    didParseCell: (data) => {
      // Highlight bottom summary row
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

  // 5. OFFICIAL NOTES & CALCULATION BASIS
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

  // 6. FORMAL SIGNATURE BLOCK (PENGESAHAN)
  let sigY = nextY + 7;
  if (sigY + 36 > pageHeight - 15) {
    doc.addPage();
    sigY = 22;
  }

  const signerCity = options?.signerCity || 'Madrasah';
  const signerDate =
    options?.signerDate ||
    new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const principalName = options?.principalName || 'Drs. H. M. Zainuddin, M.Pd.I';
  const principalNip = options?.principalNip || '197405101999031003';
  const officerTitle = options?.officerTitle || 'Koordinator Akademik & Kurikulum';
  const officerName = options?.officerName || 'Ahmad Fauzi, S.Pd.';
  const officerNip = options?.officerNip || '198204122008011015';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(23, 54, 55);

  // Left Signer (Koordinator Kurikulum)
  const leftX = 20;
  doc.text('Mengetahui / Memeriksa,', leftX, sigY);
  doc.setFont('helvetica', 'bold');
  doc.text(officerTitle, leftX, sigY + 4.5);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'bold');
  doc.text(officerName, leftX, sigY + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${officerNip}`, leftX, sigY + 28);

  // Right Signer (Kepala Madrasah)
  const rightX = pageWidth - (orientation === 'landscape' ? 85 : 75);
  doc.setFontSize(8.5);
  doc.text(`${signerCity}, ${signerDate}`, rightX, sigY);
  doc.setFont('helvetica', 'bold');
  doc.text(`Kepala Madrasah ${state.settings.schoolName}`, rightX, sigY + 4.5);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'bold');
  doc.text(principalName, rightX, sigY + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${principalNip}`, rightX, sigY + 28);

  // 7. OFFICIAL FOOTER ON ALL PAGES
  addDocFooter(doc, state.settings.schoolName);

  const cleanMonth = monthName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`SIGNAL_Rekap_Presensi_Guru_${cleanMonth}.pdf`);
}
