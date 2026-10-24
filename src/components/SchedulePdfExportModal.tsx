import { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  GraduationCap,
  Users,
  X,
  Palette,
  AlignLeft,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Award,
} from 'lucide-react';
import type { AppState } from '../domain/types';
import {
  exportScheduleClassPDF,
  exportAllClassesWeeklyPDF,
  exportScheduleMasterPDF,
  exportScheduleTeacherPDF,
  exportAllClassesSinglePageA4PDF,
  type WeeklyClassSchedulePdfOptions,
} from '../utils/pdfExport';
import { jpToAstronomical } from '../domain/time';

interface SchedulePdfExportModalProps {
  state: AppState;
  selectedClassId: string;
  isOpen: boolean;
  onClose: () => void;
  onNotify: (message: string, kind?: 'success' | 'warning' | 'error' | 'info') => void;
}

type ExportType = 'all_single_page' | 'class' | 'school' | 'teacher';

export function SchedulePdfExportModal({
  state,
  selectedClassId,
  isOpen,
  onClose,
  onNotify,
}: SchedulePdfExportModalProps) {
  // Main export format selection - defaults to 'all_single_page' (A4 landscape master + recap page)
  const [exportType, setExportType] = useState<ExportType>('all_single_page');
  const [targetClassId, setTargetClassId] = useState<string>(() => selectedClassId || state.classes[0]?.id || 'all');
  const [targetTeacherId, setTargetTeacherId] = useState<string>(() => state.teachers[0]?.id || '');

  // Options for layout & printing
  const [classOrientation, setClassOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [colorizeSubjects, setColorizeSubjects] = useState<boolean>(true);
  const [compactNames, setCompactNames] = useState<boolean>(true);
  const [includeKop, setIncludeKop] = useState<boolean>(true);
  const [includeRecapPage, setIncludeRecapPage] = useState<boolean>(true);

  // Accordion state for editing document components
  const [showTextEditor, setShowTextEditor] = useState<boolean>(false);
  const [editorSubTab, setEditorSubTab] = useState<'kop' | 'title' | 'signer'>('kop');

  // Editable Document Components (initialized from Madrasah Profile settings)
  const [ministry, setMinistry] = useState<string>(() => state.settings.ministry || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA');
  const [regionalOffice, setRegionalOffice] = useState<string>(() => state.settings.regionalOffice || 'KANTOR KEMENTERIAN AGAMA KABUPATEN MALANG');
  const [schoolName, setSchoolName] = useState<string>(() => state.settings.schoolName || 'MTs Cendekia Nusantara');
  const [nsm, setNsm] = useState<string>(() => state.settings.nsm || '121235070001');
  const [npsn, setNpsn] = useState<string>(() => state.settings.npsn || '20580001');
  const [address, setAddress] = useState<string>(() => state.settings.address || 'Jl. Raya Cendekia No. 45, Sumberpucung');
  const [city, setCity] = useState<string>(() => state.settings.city || 'Kabupaten Malang');
  const [postalCode, setPostalCode] = useState<string>(() => state.settings.postalCode || '65165');
  const [phone, setPhone] = useState<string>(() => state.settings.phone || '(0341) 395882 / 0812-3456-7890');
  const [email, setEmail] = useState<string>(() => state.settings.email || 'mts.cendekia@kemenag.go.id');
  const [website, setWebsite] = useState<string>(() => state.settings.website || 'www.mtscendekia.sch.id');

  // Document Title & Periods
  const [documentTitle, setDocumentTitle] = useState<string>('JADWAL PELAJARAN SELURUH KELAS (SATU HALAMAN A4)');
  const [academicYear, setAcademicYear] = useState<string>(() => state.settings.academicYear || '2026/2027');
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>(() => state.settings.semester || 'Ganjil');
  const [extraNotes, setExtraNotes] = useState<string>('');

  // Signatory Overrides
  const [signerCity, setSignerCity] = useState<string>(() => state.settings.city || 'Kabupaten Malang');
  const [signerDate, setSignerDate] = useState<string>(() =>
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
  );
  const [principalTitle, setPrincipalTitle] = useState<string>(() => state.settings.headmasterTitle || 'Kepala Madrasah');
  const [principalName, setPrincipalName] = useState<string>(() => state.settings.headmasterName || 'H. Ahmad Fauzi, S.Ag., M.Pd.I.');
  const [principalNip, setPrincipalNip] = useState<string>(() => state.settings.headmasterNip || '19750812 200212 1 003');
  const [coordinatorTitle, setCoordinatorTitle] = useState<string>(() => state.settings.curriculumLeaderTitle || 'Waka Bidang Kurikulum');
  const [coordinatorName, setCoordinatorName] = useState<string>(() => state.settings.curriculumLeaderName || 'Siti Aminah, S.Pd.I., M.Pd.');
  const [coordinatorNip, setCoordinatorNip] = useState<string>(() => state.settings.curriculumLeaderNip || '19820315 200901 2 008');

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const activeClasses = useMemo(() => state.classes.filter((c) => c.isActive), [state.classes]);
  const activeTeachers = useMemo(() => state.teachers.filter((t) => t.isActive), [state.teachers]);

  const selectedClassObj = useMemo(
    () => (targetClassId === 'all' ? null : state.classes.find((c) => c.id === targetClassId)),
    [state.classes, targetClassId],
  );

  const handleResetToSettings = () => {
    setMinistry(state.settings.ministry || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA');
    setRegionalOffice(state.settings.regionalOffice || 'KANTOR KEMENTERIAN AGAMA KABUPATEN MALANG');
    setSchoolName(state.settings.schoolName || 'MTs Cendekia Nusantara');
    setNsm(state.settings.nsm || '121235070001');
    setNpsn(state.settings.npsn || '20580001');
    setAddress(state.settings.address || 'Jl. Raya Cendekia No. 45, Sumberpucung');
    setCity(state.settings.city || 'Kabupaten Malang');
    setPostalCode(state.settings.postalCode || '65165');
    setPhone(state.settings.phone || '(0341) 395882 / 0812-3456-7890');
    setEmail(state.settings.email || 'mts.cendekia@kemenag.go.id');
    setWebsite(state.settings.website || 'www.mtscendekia.sch.id');
    setAcademicYear(state.settings.academicYear || '2026/2027');
    setSemester(state.settings.semester || 'Ganjil');
    setSignerCity(state.settings.city || 'Kabupaten Malang');
    setPrincipalTitle(state.settings.headmasterTitle || 'Kepala Madrasah');
    setPrincipalName(state.settings.headmasterName || 'H. Ahmad Fauzi, S.Ag., M.Pd.I.');
    setPrincipalNip(state.settings.headmasterNip || '19750812 200212 1 003');
    setCoordinatorTitle(state.settings.curriculumLeaderTitle || 'Waka Bidang Kurikulum');
    setCoordinatorName(state.settings.curriculumLeaderName || 'Siti Aminah, S.Pd.I., M.Pd.');
    setCoordinatorNip(state.settings.curriculumLeaderNip || '19820315 200901 2 008');
    setDocumentTitle(
      exportType === 'all_single_page'
        ? 'JADWAL PELAJARAN SELURUH KELAS (SATU HALAMAN A4)'
        : 'JADWAL PELAJARAN MINGGUAN',
    );
    onNotify('Seluruh isian teks dikembalikan ke data Pengaturan Madrasah.', 'info');
  };

  const classPreviewStats = useMemo(() => {
    const entries = state.draft ?? state.activeSchedule ?? [];
    const periodMinutes = state.settings.periodMinutes ?? 40;

    if (exportType === 'all_single_page' || targetClassId === 'all') {
      const activeClassIds = new Set(activeClasses.map((c) => c.id));
      const relevant = entries.filter((e) => activeClassIds.has(e.classId));
      const uniqueTeachers = new Set(relevant.map((e) => e.teacherId));
      const uniqueSubjects = new Set(relevant.map((e) => e.subjectId));
      const astro = jpToAstronomical(relevant.length, periodMinutes);
      return {
        totalJp: relevant.length,
        astroFormatted: `${astro.hours} Jam (${astro.minutes} Mnt)`,
        teacherCount: uniqueTeachers.size,
        subjectCount: uniqueSubjects.size,
        pageEstimate: exportType === 'all_single_page' ? 2 : activeClasses.length * 2,
      };
    }

    const classEntries = entries.filter((e) => e.classId === targetClassId);
    const uniqueTeachers = new Set(classEntries.map((e) => e.teacherId));
    const uniqueSubjects = new Set(classEntries.map((e) => e.subjectId));
    const astro = jpToAstronomical(classEntries.length, periodMinutes);

    return {
      totalJp: classEntries.length,
      astroFormatted: `${astro.hours} Jam (${astro.minutes} Mnt)`,
      teacherCount: uniqueTeachers.size,
      subjectCount: uniqueSubjects.size,
      pageEstimate: 2,
    };
  }, [state, exportType, targetClassId, activeClasses]);

  if (!isOpen) return null;

  const handleDownload = () => {
    try {
      setIsExporting(true);

      const commonOverrides = {
        ministry: ministry.trim(),
        regionalOffice: regionalOffice.trim(),
        schoolName: schoolName.trim(),
        nsm: nsm.trim(),
        npsn: npsn.trim(),
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        phone: phone.trim(),
        email: email.trim(),
        website: website.trim(),
        academicYear: academicYear.trim(),
        semester,
        extraNotes: extraNotes.trim(),
        signerCity: signerCity.trim(),
        signerDate: signerDate.trim(),
        principalTitle: principalTitle.trim(),
        principalName: principalName.trim(),
        principalNip: principalNip.trim(),
        coordinatorTitle: coordinatorTitle.trim(),
        coordinatorName: coordinatorName.trim(),
        coordinatorNip: coordinatorNip.trim(),
      };

      if (exportType === 'all_single_page') {
        // ⭐ Mode Rekomendasi Utama: Semua Kelas dalam Satu Halaman A4 Landscape + Halaman Rekap Guru & TTD
        exportAllClassesSinglePageA4PDF(state, {
          ...commonOverrides,
          documentTitle: documentTitle.trim() || 'JADWAL PELAJARAN SELURUH KELAS (SATU HALAMAN A4)',
          colorizeSubjects,
          compactNames,
          includeKop,
          includeTeacherRecapPage: includeRecapPage,
        });
        onNotify('PDF Jadwal Semua Kelas (1 Halaman A4 Landscape + Halaman Rekapitulasi Guru & TTD) berhasil diunduh.', 'success');
      } else if (exportType === 'class') {
        const options: WeeklyClassSchedulePdfOptions = {
          ...commonOverrides,
          documentTitle: documentTitle.trim() || undefined,
          orientation: classOrientation,
          kopSurat: includeKop,
          includeTeacherRecapPage: includeRecapPage,
          colorizeSubjects,
          compactNames,
          coordinatorTitle:
            targetClassId === 'all'
              ? coordinatorTitle.trim() || 'Koordinator Kurikulum & Akademik'
              : coordinatorTitle.trim() || `Wali Kelas ${selectedClassObj?.name ?? ''} / Waka Kurikulum`,
        };

        if (targetClassId === 'all') {
          exportAllClassesWeeklyPDF(state, options);
          onNotify(
            `PDF Bundel Jadwal Seluruh Kelas (${activeClasses.length * 2} Halaman: Jadwal + Rekap Guru) berhasil diunduh.`,
            'success',
          );
        } else {
          exportScheduleClassPDF(state, targetClassId, options);
          onNotify(
            `PDF Jadwal Mingguan Kelas ${selectedClassObj?.name ?? ''} (2 Halaman: Jadwal + Rekap Guru Terpisah) berhasil diunduh.`,
            'success',
          );
        }
      } else if (exportType === 'school') {
        exportScheduleMasterPDF(state);
        onNotify('PDF Jadwal Sekolah Induk berhasil diunduh.', 'success');
      } else {
        const tch = state.teachers.find((t) => t.id === targetTeacherId);
        exportScheduleTeacherPDF(state, targetTeacherId);
        onNotify(`PDF Jadwal Guru ${tch?.name ?? ''} berhasil diunduh.`, 'success');
      }
      onClose();
    } catch (err) {
      console.error('PDF export failed:', err);
      onNotify('Gagal membuat PDF. Periksa kelengkapan data jadwal.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-panel"
        style={{ maxWidth: '720px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-modal="true"
        aria-label="Ekspor PDF Jadwal Pelajaran"
      >
        {/* Modal Header */}
        <div className="modal-head">
          <div className="modal-title-icon" style={{ background: '#e3efe8', color: '#1f6952' }}>
            <Download size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', margin: 0, color: '#173637' }}>
              Ekspor Dokumen PDF Jadwal Pelajaran Resmi (A4)
            </h2>
            <p style={{ margin: 0, fontSize: '11px', color: '#687a75' }}>
              Format standar madrasah: Pewarnaan sel kode hex, nama padat otomatis, 1 halaman A4 &amp; rekap guru ber-TTD
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup dialog">
            <X size={17} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Main Document Mode Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '8px' }}>
            {/* Primary Recommended Option: All classes in 1 page A4 */}
            <button
              type="button"
              onClick={() => {
                setExportType('all_single_page');
                setDocumentTitle('JADWAL PELAJARAN SELURUH KELAS (SATU HALAMAN A4)');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '5px',
                padding: '11px 8px',
                borderRadius: '10px',
                border: exportType === 'all_single_page' ? '2px solid #16483f' : '1px solid #dcded3',
                background: exportType === 'all_single_page' ? '#e7f2ed' : '#fff',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={16} color={exportType === 'all_single_page' ? '#16483f' : '#758582'} />
                <span style={{ fontSize: '11px', fontWeight: 800, color: exportType === 'all_single_page' ? '#0b3435' : '#173637' }}>
                  Semua Kelas (1 Halaman A4)
                </span>
              </div>
              <small style={{ fontSize: '9px', color: '#357c72', fontWeight: 600 }}>Landscape + Rekap JP &amp; TTD</small>
            </button>

            {/* Option 2: Class Weekly */}
            <button
              type="button"
              onClick={() => {
                setExportType('class');
                setDocumentTitle('JADWAL PELAJARAN MINGGUAN');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '5px',
                padding: '11px 8px',
                borderRadius: '10px',
                border: exportType === 'class' ? '2px solid #16483f' : '1px solid #dcded3',
                background: exportType === 'class' ? '#e7f2ed' : '#fff',
                cursor: 'pointer',
              }}
            >
              <GraduationCap size={16} color={exportType === 'class' ? '#16483f' : '#758582'} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: exportType === 'class' ? '#0b3435' : '#173637' }}>
                Per Rombel Kelas
              </span>
              <small style={{ fontSize: '9px', color: '#758582' }}>2 Halaman per Rombel</small>
            </button>

            {/* Option 3: School Master Schedule */}
            <button
              type="button"
              onClick={() => setExportType('school')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '5px',
                padding: '11px 8px',
                borderRadius: '10px',
                border: exportType === 'school' ? '2px solid #16483f' : '1px solid #dcded3',
                background: exportType === 'school' ? '#e7f2ed' : '#fff',
                cursor: 'pointer',
              }}
            >
              <FileSpreadsheet size={16} color={exportType === 'school' ? '#16483f' : '#758582'} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: exportType === 'school' ? '#0b3435' : '#173637' }}>
                Matriks Master
              </span>
              <small style={{ fontSize: '9px', color: '#758582' }}>Format Multi-Hari</small>
            </button>

            {/* Option 4: Teacher Individual */}
            <button
              type="button"
              onClick={() => setExportType('teacher')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '5px',
                padding: '11px 8px',
                borderRadius: '10px',
                border: exportType === 'teacher' ? '2px solid #16483f' : '1px solid #dcded3',
                background: exportType === 'teacher' ? '#e7f2ed' : '#fff',
                cursor: 'pointer',
              }}
            >
              <Users size={16} color={exportType === 'teacher' ? '#16483f' : '#758582'} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: exportType === 'teacher' ? '#0b3435' : '#173637' }}>
                Jadwal Guru
              </span>
              <small style={{ fontSize: '9px', color: '#758582' }}>Per Tenaga Pendidik</small>
            </button>
          </div>

          {/* KPI Statistics Card */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              padding: '11px 14px',
              background: '#f2f8f5',
              borderRadius: '10px',
              border: '1px solid #cce5d7',
            }}
          >
            <div>
              <span style={{ fontSize: '9px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                TOTAL ALOKASI JP
              </span>
              <strong style={{ fontSize: '14.5px', color: '#173637', display: 'block', marginTop: '2px' }}>
                {classPreviewStats.totalJp} JP
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '9px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                WAKTU ASTRONOMIS
              </span>
              <strong style={{ fontSize: '13px', color: '#173637', display: 'block', marginTop: '2px' }}>
                {classPreviewStats.astroFormatted}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '9px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                GURU PENGAJAR
              </span>
              <strong style={{ fontSize: '14.5px', color: '#173637', display: 'block', marginTop: '2px' }}>
                {classPreviewStats.teacherCount} Pendidik
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '9px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                ESTIMASI DOKUMEN
              </span>
              <strong style={{ fontSize: '14px', color: '#1f6952', display: 'block', marginTop: '2px' }}>
                {classPreviewStats.pageEstimate} Halaman (A4)
              </strong>
            </div>
          </div>

          {/* Mode 1 & 2 Specific Controls */}
          {exportType === 'all_single_page' && (
            <div style={{ padding: '12px 14px', background: '#fcfdfb', border: '1px solid #dbe6e0', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Sparkles size={16} style={{ color: '#2f7771' }} />
                <strong style={{ fontSize: '12.5px', color: '#0b3435' }}>
                  Struktur Dokumen Cetak 1 Halaman A4 Landscape + Rekapitulasi Guru:
                </strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11.5px', color: '#435e58', lineHeight: 1.55 }}>
                <li>
                  <strong>Halaman 1 (A4 Landscape):</strong> Seluruh kelas paralel ({activeClasses.map((c) => c.name).join(', ')}) disusun dalam 1 halaman utuh dengan pewarnaan sel sesuai warna mapel dan singkatan nama otomatis agar muat presisi.
                </li>
                <li>
                  <strong>Halaman 2 (Lembar Terpisah):</strong> Tabel rekapitulasi beban JP seluruh guru madrasah beserta rincian per rombel dan <strong>kolom tanda tangan resmi di footer</strong>.
                </li>
              </ul>
            </div>
          )}

          {exportType === 'class' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div className="field-group">
                <label>Pilih Kelas Sasaran</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  style={{ height: '38px', fontSize: '12.5px' }}
                >
                  <option value="all">⭐ Cetak Seluruh Kelas Sekaligus (Bundel Dokumen Lengkap)</option>
                  {activeClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name} (Tingkat {c.level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label>Orientasi Kertas (A4)</label>
                <select
                  value={classOrientation}
                  onChange={(e) => setClassOrientation(e.target.value as 'landscape' | 'portrait')}
                  style={{ height: '38px', fontSize: '12.5px' }}
                >
                  <option value="landscape">A4 Landscape (Rekomendasi - Matriks Lega &amp; Nyaman)</option>
                  <option value="portrait">A4 Portrait (Format Vertikal)</option>
                </select>
              </div>
            </div>
          )}

          {exportType === 'teacher' && (
            <div className="field-group">
              <label>Pilih Tenaga Pendidik / Guru</label>
              <select
                value={targetTeacherId}
                onChange={(e) => setTargetTeacherId(e.target.value)}
                style={{ height: '38px', fontSize: '12.5px' }}
              >
                {activeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code}) — {t.roleTitle || 'Guru Mapel'} (Maksimal {t.maxWeeklyJP} JP)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Typography & Visual Print Enhancement Switches */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '12px 14px',
              background: '#fffdf8',
              borderRadius: '9px',
              border: '1px solid #e5e3d7',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#173637', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={colorizeSubjects}
                onChange={(e) => setColorizeSubjects(e.target.checked)}
              />
              <Palette size={15} style={{ color: '#2f7771' }} />
              <div>
                <strong>Pewarnaan Sel Kode Hex Mapel</strong>
                <div style={{ fontSize: '10.5px', color: '#657874' }}>Pastel lembut &amp; teks kontras untuk cetak</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#173637', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={compactNames}
                onChange={(e) => setCompactNames(e.target.checked)}
              />
              <AlignLeft size={15} style={{ color: '#2f7771' }} />
              <div>
                <strong>Padatkan Nama Mapel &amp; Guru Otomatis</strong>
                <div style={{ fontSize: '10.5px', color: '#657874' }}>Optimasi ruang tabel agar muat 1 lembar A4</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#173637', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeKop}
                onChange={(e) => setIncludeKop(e.target.checked)}
              />
              <Award size={15} style={{ color: '#2f7771' }} />
              <div>
                <strong>Sertakan Kop Surat Resmi Madrasah</strong>
                <div style={{ fontSize: '10.5px', color: '#657874' }}>Kemenag, logo, NSM/NPSN, alamat lengkap</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#173637', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeRecapPage}
                onChange={(e) => setIncludeRecapPage(e.target.checked)}
              />
              <Users size={15} style={{ color: '#2f7771' }} />
              <div>
                <strong>Halaman 2: Rekapitulasi JP &amp; Kolom TTD</strong>
                <div style={{ fontSize: '10.5px', color: '#657874' }}>Tabel beban guru dan blok tanda tangan footer</div>
              </div>
            </label>
          </div>

          {/* Full Official Document Component Text Editor Section */}
          <div
            style={{
              border: '1px solid #d4d7cc',
              borderRadius: '10px',
              background: '#ffffff',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setShowTextEditor((prev) => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: showTextEditor ? '#f2f8f5' : '#fafbf8',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <strong style={{ fontSize: '12.5px', color: '#0b3435' }}>
                  ✏️ Sesuaikan Teks Dokumen Resmi (Kop Surat, Judul, Titimangsa &amp; Tanda Tangan)
                </strong>
                <p style={{ margin: 0, fontSize: '11px', color: '#657874' }}>
                  Bisa edit langsung seluruh isi teks komponen dokumen sebelum diunduh
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2f7771' }}>
                <span style={{ fontSize: '11px', fontWeight: 600 }}>{showTextEditor ? 'Tutup Form' : 'Buka Form'}</span>
                {showTextEditor ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {showTextEditor && (
              <div style={{ padding: '16px', borderTop: '1px solid #e2e5db' }}>
                {/* Sub-tabs inside text editor */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div className="segmented-tabs" style={{ marginBottom: 0 }}>
                    <button
                      type="button"
                      className={editorSubTab === 'kop' ? 'active' : ''}
                      onClick={() => setEditorSubTab('kop')}
                    >
                      1. Kop Surat &amp; Instansi
                    </button>
                    <button
                      type="button"
                      className={editorSubTab === 'title' ? 'active' : ''}
                      onClick={() => setEditorSubTab('title')}
                    >
                      2. Judul &amp; Periode
                    </button>
                    <button
                      type="button"
                      className={editorSubTab === 'signer' ? 'active' : ''}
                      onClick={() => setEditorSubTab('signer')}
                    >
                      3. Titimangsa &amp; Penandatangan
                    </button>
                  </div>

                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={handleResetToSettings}
                    style={{ fontSize: '11px', height: '30px' }}
                    title="Kembalikan semua teks ke isian pengaturan madrasah"
                  >
                    <RotateCcw size={12} /> Reset Default
                  </button>
                </div>

                {/* SubTab 1: Kop Surat */}
                {editorSubTab === 'kop' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="field-group">
                      <label style={{ fontSize: '11px' }}>Kementerian yang Menaungi</label>
                      <input
                        value={ministry}
                        onChange={(e) => setMinistry(e.target.value)}
                        placeholder="KEMENTERIAN AGAMA REPUBLIK INDONESIA"
                        style={{ height: '34px', fontSize: '11.5px' }}
                      />
                    </div>

                    <div className="field-group">
                      <label style={{ fontSize: '11px' }}>Kantor Wilayah / Kankemenag Daerah</label>
                      <input
                        value={regionalOffice}
                        onChange={(e) => setRegionalOffice(e.target.value)}
                        placeholder="KANTOR KEMENTERIAN AGAMA KABUPATEN MALANG"
                        style={{ height: '34px', fontSize: '11.5px' }}
                      />
                    </div>

                    <div className="field-group">
                      <label style={{ fontSize: '11px' }}>Nama Satuan Pendidikan / Madrasah</label>
                      <input
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="MTs Cendekia Nusantara"
                        style={{ height: '34px', fontSize: '11.5px' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>Nomor Statistik Madrasah (NSM)</label>
                        <input
                          value={nsm}
                          onChange={(e) => setNsm(e.target.value)}
                          placeholder="121235070001"
                          style={{ height: '34px', fontSize: '11.5px' }}
                        />
                      </div>
                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>NPSN</label>
                        <input
                          value={npsn}
                          onChange={(e) => setNpsn(e.target.value)}
                          placeholder="20580001"
                          style={{ height: '34px', fontSize: '11.5px' }}
                        />
                      </div>
                    </div>

                    <div className="field-group">
                      <label style={{ fontSize: '11px' }}>Alamat Lengkap</label>
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Jl. Raya Cendekia No. 45, Sumberpucung"
                        style={{ height: '34px', fontSize: '11.5px' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>Kota / Kabupaten</label>
                        <input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Kabupaten Malang"
                          style={{ height: '34px', fontSize: '11.5px' }}
                        />
                      </div>
                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>Kode Pos</label>
                        <input
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          placeholder="65165"
                          style={{ height: '34px', fontSize: '11.5px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>No. Telepon / WhatsApp</label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(0341) 395882"
                          style={{ height: '34px', fontSize: '11.5px' }}
                        />
                      </div>
                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>Email Madrasah</label>
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="mts.cendekia@kemenag.go.id"
                          style={{ height: '34px', fontSize: '11.5px' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SubTab 2: Judul & Periode */}
                {editorSubTab === 'title' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="field-group">
                      <label style={{ fontSize: '11px' }}>Judul Utama Dokumen</label>
                      <input
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        placeholder="JADWAL PELAJARAN SELURUH KELAS"
                        style={{ height: '34px', fontSize: '11.5px' }}
                      />
                      <small style={{ fontSize: '10px', color: '#657874' }}>
                        Tercetak tebal di bawah Kop Surat resmi.
                      </small>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>Tahun Ajaran</label>
                        <input
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          placeholder="2026/2027"
                          style={{ height: '34px', fontSize: '11.5px' }}
                        />
                      </div>

                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>Semester</label>
                        <select
                          value={semester}
                          onChange={(e) => setSemester(e.target.value as 'Ganjil' | 'Genap')}
                          style={{ height: '34px', fontSize: '11.5px' }}
                        >
                          <option value="Ganjil">Semester Ganjil</option>
                          <option value="Genap">Semester Genap</option>
                        </select>
                      </div>
                    </div>

                    <div className="field-group">
                      <label style={{ fontSize: '11px' }}>Catatan Tambahan (Opsional)</label>
                      <input
                        value={extraNotes}
                        onChange={(e) => setExtraNotes(e.target.value)}
                        placeholder="Contoh: Berlaku efektif mulai tanggal 20 Juli 2026"
                        style={{ height: '34px', fontSize: '11.5px' }}
                      />
                    </div>
                  </div>
                )}

                {/* SubTab 3: Titimangsa & Penandatangan */}
                {editorSubTab === 'signer' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>Kota Titimangsa Surat</label>
                        <input
                          type="text"
                          value={signerCity}
                          onChange={(e) => setSignerCity(e.target.value)}
                          placeholder="Kabupaten Malang"
                          style={{ height: '34px', fontSize: '11.5px' }}
                        />
                      </div>

                      <div className="field-group">
                        <label style={{ fontSize: '11px' }}>Tanggal Pengesahan</label>
                        <input
                          type="text"
                          value={signerDate}
                          onChange={(e) => setSignerDate(e.target.value)}
                          style={{ height: '34px', fontSize: '11.5px' }}
                        />
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8faf9', borderRadius: '8px', border: '1px solid #dce5e0' }}>
                      <strong style={{ fontSize: '11.5px', color: '#16483f', display: 'block', marginBottom: '8px' }}>
                        Pejabat 1: Kepala Madrasah (Penandatangan Kanan)
                      </strong>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '8px' }}>
                        <div className="field-group">
                          <label style={{ fontSize: '10px' }}>Nomenklatur Jabatan</label>
                          <input
                            type="text"
                            value={principalTitle}
                            onChange={(e) => setPrincipalTitle(e.target.value)}
                            placeholder="Kepala Madrasah"
                            style={{ height: '32px', fontSize: '11px' }}
                          />
                        </div>
                        <div className="field-group">
                          <label style={{ fontSize: '10px' }}>Nama Lengkap &amp; Gelar</label>
                          <input
                            type="text"
                            value={principalName}
                            onChange={(e) => setPrincipalName(e.target.value)}
                            placeholder="H. Ahmad Fauzi, S.Ag., M.Pd.I."
                            style={{ height: '32px', fontSize: '11px' }}
                          />
                        </div>
                        <div className="field-group">
                          <label style={{ fontSize: '10px' }}>NIP / NPK</label>
                          <input
                            type="text"
                            value={principalNip}
                            onChange={(e) => setPrincipalNip(e.target.value)}
                            placeholder="19750812 200212 1 003"
                            style={{ height: '32px', fontSize: '11px' }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8faf9', borderRadius: '8px', border: '1px solid #dce5e0' }}>
                      <strong style={{ fontSize: '11.5px', color: '#16483f', display: 'block', marginBottom: '8px' }}>
                        Pejabat 2: Waka Kurikulum / Wali Kelas (Penandatangan Kiri)
                      </strong>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '8px' }}>
                        <div className="field-group">
                          <label style={{ fontSize: '10px' }}>Nomenklatur Jabatan</label>
                          <input
                            type="text"
                            value={coordinatorTitle}
                            onChange={(e) => setCoordinatorTitle(e.target.value)}
                            placeholder="Waka Bidang Kurikulum"
                            style={{ height: '32px', fontSize: '11px' }}
                          />
                        </div>
                        <div className="field-group">
                          <label style={{ fontSize: '10px' }}>Nama Lengkap &amp; Gelar</label>
                          <input
                            type="text"
                            value={coordinatorName}
                            onChange={(e) => setCoordinatorName(e.target.value)}
                            placeholder="Siti Aminah, S.Pd.I., M.Pd."
                            style={{ height: '32px', fontSize: '11px' }}
                          />
                        </div>
                        <div className="field-group">
                          <label style={{ fontSize: '10px' }}>NIP / NPK</label>
                          <input
                            type="text"
                            value={coordinatorNip}
                            onChange={(e) => setCoordinatorNip(e.target.value)}
                            placeholder="19820315 200901 2 008"
                            style={{ height: '32px', fontSize: '11px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #edebe1',
            background: '#faf9f4',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '11px', color: '#687a75' }}>
            Ukuran Kertas: <strong>A4 ({exportType === 'all_single_page' || classOrientation === 'landscape' ? '297 × 210 mm (Landscape)' : '210 × 297 mm (Portrait)'})</strong>
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              style={{ height: '36px', fontSize: '12px' }}
            >
              Batal
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleDownload}
              disabled={isExporting}
              style={{ height: '36px', fontSize: '12px' }}
            >
              <Download size={15} />
              {isExporting ? 'Memproses PDF…' : 'Unduh Dokumen PDF Resmi (A4)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
