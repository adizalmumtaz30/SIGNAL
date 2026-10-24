import { useMemo, useState } from 'react';
import {
  Download,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import type { AppState, Day } from '../domain/types';
import { exportAttendanceRecapPDF, type AttendanceRecapPdfOptions } from '../utils/pdfExport';

interface AttendancePdfExportModalProps {
  state: AppState;
  isOpen: boolean;
  onClose: () => void;
  onNotify: (message: string, kind?: 'success' | 'warning' | 'error' | 'info') => void;
  initialMonth?: string;
}

export function AttendancePdfExportModal({
  state,
  isOpen,
  onClose,
  onNotify,
  initialMonth,
}: AttendancePdfExportModalProps) {
  const activeTeachers = useMemo(() => state.teachers.filter((t) => t.isActive), [state.teachers]);

  const [monthYear, setMonthYear] = useState<string>(() => initialMonth || new Date().toISOString().slice(0, 7));
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [includeKop, setIncludeKop] = useState<boolean>(true);
  const [includeSignature, setIncludeSignature] = useState<boolean>(true);

  // Document Customization Overrides (initialized from Madrasah Profile settings)
  const [showTextEditor, setShowTextEditor] = useState<boolean>(false);
  const [editorSubTab, setEditorSubTab] = useState<'kop' | 'title' | 'signer'>('kop');

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
  const [documentTitle, setDocumentTitle] = useState<string>('LAPORAN REKAPITULASI KEHADIRAN GURU BULANAN');
  const [academicYear, setAcademicYear] = useState<string>(() => state.settings.academicYear || '2026/2027');
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>(() => state.settings.semester || 'Ganjil');

  // Signer data initialized from Madrasah Profile
  const [signerCity, setSignerCity] = useState<string>(() => state.settings.city || 'Kabupaten Malang');
  const [signerDate, setSignerDate] = useState<string>(() =>
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
  );
  const [principalTitle, setPrincipalTitle] = useState<string>(() => state.settings.headmasterTitle || 'Kepala Madrasah');
  const [principalName, setPrincipalName] = useState<string>(() => state.settings.headmasterName || 'H. Ahmad Fauzi, S.Ag., M.Pd.I.');
  const [principalNip, setPrincipalNip] = useState<string>(() => state.settings.headmasterNip || '19750812 200212 1 003');
  const [officerTitle, setOfficerTitle] = useState<string>(() => state.settings.curriculumLeaderTitle || 'Koordinator Akademik & Kurikulum');
  const [officerName, setOfficerName] = useState<string>(() => state.settings.curriculumLeaderName || 'Siti Aminah, S.Pd.I., M.Pd.');
  const [officerNip, setOfficerNip] = useState<string>(() => state.settings.curriculumLeaderNip || '19820315 200901 2 008');

  // Selected teachers list
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>(() =>
    activeTeachers.map((t) => t.id),
  );

  const [isExporting, setIsExporting] = useState<boolean>(false);

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
    setDocumentTitle('LAPORAN REKAPITULASI KEHADIRAN GURU BULANAN');
    setSignerCity(state.settings.city || 'Kabupaten Malang');
    setPrincipalTitle(state.settings.headmasterTitle || 'Kepala Madrasah');
    setPrincipalName(state.settings.headmasterName || 'H. Ahmad Fauzi, S.Ag., M.Pd.I.');
    setPrincipalNip(state.settings.headmasterNip || '19750812 200212 1 003');
    setOfficerTitle(state.settings.curriculumLeaderTitle || 'Koordinator Akademik & Kurikulum');
    setOfficerName(state.settings.curriculumLeaderName || 'Siti Aminah, S.Pd.I., M.Pd.');
    setOfficerNip(state.settings.curriculumLeaderNip || '19820315 200901 2 008');
    onNotify('Seluruh teks dokumen resmi dikembalikan sesuai Pengaturan Madrasah.', 'info');
  };

  // Compute live preview statistics
  const previewStats = useMemo(() => {
    const attendanceList = state.attendance ?? [];
    const [yearStr, monthStr] = monthYear.split('-');
    const yearNum = Number(yearStr);
    const monthNum = Number(monthStr);

    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
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

    let effectiveDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(yearNum, monthNum - 1, d);
      const dayOfWeek = dayMap[curDate.getDay()];
      const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isHoliday = holidays.some((h) => h.date === dateStr);
      if (dayOfWeek !== ('Minggu' as Day) && activeDays.includes(dayOfWeek) && !isHoliday) {
        effectiveDays++;
      }
    }
    if (effectiveDays === 0) effectiveDays = 24;

    const chosenTeachers = activeTeachers.filter((t) => selectedTeacherIds.includes(t.id));
    let totalPresentSum = 0;

    for (const t of chosenTeachers) {
      const records = attendanceList.filter((a) => a.teacherId === t.id && a.date.startsWith(monthYear));
      const hadir = records.filter((r) => r.status === 'HADIR').length;
      const dinas = records.filter((r) => r.status === 'DINAS_LUAR').length;
      const rate = Math.min(100, Math.round(((hadir + dinas) / effectiveDays) * 100));
      totalPresentSum += rate;
    }

    const avgRate = chosenTeachers.length > 0 ? Math.round(totalPresentSum / chosenTeachers.length) : 100;

    return {
      effectiveDays,
      teacherCount: chosenTeachers.length,
      avgRate,
    };
  }, [state, monthYear, selectedTeacherIds, activeTeachers]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (selectedTeacherIds.length === 0) {
      onNotify('Pilih setidaknya satu guru untuk diekspor.', 'warning');
      return;
    }

    try {
      setIsExporting(true);
      const options: AttendanceRecapPdfOptions = {
        orientation,
        kopSurat: includeKop,
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
        documentTitle: documentTitle.trim(),
        academicYear: academicYear.trim(),
        semester,
        signerCity: signerCity.trim(),
        signerDate: signerDate.trim(),
        principalTitle: principalTitle.trim(),
        principalName: principalName.trim(),
        principalNip: principalNip.trim(),
        officerTitle: officerTitle.trim(),
        officerName: officerName.trim(),
        officerNip: officerNip.trim(),
        leftTitle: officerTitle.trim(),
        leftName: officerName.trim(),
        leftNip: officerNip.trim(),
        rightTitle: `${principalTitle.trim()} ${schoolName.trim()}`,
        rightName: principalName.trim(),
        rightNip: principalNip.trim(),
      };

      exportAttendanceRecapPDF(state, monthYear, selectedTeacherIds, options);
      onNotify('Laporan Rekapitulasi Presensi Resmi (A4) berhasil diunduh.', 'success');
      onClose();
    } catch (err) {
      console.error('Attendance PDF export failed:', err);
      onNotify('Gagal mengekspor PDF presensi. Periksa format data.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((tId) => tId !== id) : [...prev, id],
    );
  };

  const selectAll = () => setSelectedTeacherIds(activeTeachers.map((t) => t.id));
  const deselectAll = () => setSelectedTeacherIds([]);

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
        style={{ maxWidth: '640px', width: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-modal="true"
        aria-label="Ekspor Rekapitulasi Presensi Bulanan Resmi (A4)"
      >
        {/* Header */}
        <div className="modal-head">
          <div className="modal-title-icon" style={{ background: '#e3efe8', color: '#1f6952' }}>
            <Download size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', margin: 0, color: '#173637' }}>
              Ekspor Rekapitulasi Presensi Guru (A4)
            </h2>
            <p style={{ margin: 0, fontSize: '11px', color: '#687a75' }}>
              Format cetak formal madrasah dengan kop resmi, persentase kehadiran otomatis, dan tanda tangan pejabat
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup dialog">
            <X size={17} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Live Metric Preview Card */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              padding: '12px 14px',
              background: '#f2f8f5',
              borderRadius: '10px',
              border: '1px solid #cce5d7',
            }}
          >
            <div>
              <span style={{ fontSize: '10px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                HARI EFEKTIF (HE)
              </span>
              <strong style={{ fontSize: '16px', color: '#173637', display: 'block', marginTop: '2px' }}>
                {previewStats.effectiveDays} Hari KBM
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '10px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                GURU DIREKAP
              </span>
              <strong style={{ fontSize: '16px', color: '#173637', display: 'block', marginTop: '2px' }}>
                {previewStats.teacherCount} Guru Terpilih
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '10px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                RATA-RATA OTOMATIS
              </span>
              <strong
                style={{
                  fontSize: '16px',
                  color: previewStats.avgRate >= 90 ? '#1f6952' : '#b24c3d',
                  display: 'block',
                  marginTop: '2px',
                }}
              >
                {previewStats.avgRate}% Kehadiran
              </strong>
            </div>
          </div>

          {/* Form Options Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="field-group">
              <label>Bulan &amp; Tahun Rekapitulasi</label>
              <input
                type="month"
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value)}
                style={{ height: '38px', fontSize: '12.5px' }}
              />
            </div>

            <div className="field-group">
              <label>Tata Letak &amp; Orientasi Kertas (A4)</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'landscape' | 'portrait')}
                style={{ height: '38px', fontSize: '12.5px' }}
              >
                <option value="landscape">A4 Landscape (Tabel Lebar &amp; Lengkap - Rekomendasi)</option>
                <option value="portrait">A4 Portrait (Vertikal Standar)</option>
              </select>
            </div>
          </div>

          {/* Formal Letterhead & Signature Settings Checkboxes */}
          <div
            style={{
              padding: '12px 14px',
              background: '#fffdf8',
              borderRadius: '9px',
              border: '1px solid #e5e3d7',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#31544d', letterSpacing: '0.05em' }}>
                KOMPONEN DOKUMEN RESMI
              </span>
              <button
                type="button"
                onClick={() => setShowTextEditor(!showTextEditor)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: showTextEditor ? '#e5f3eb' : '#f0ede6',
                  color: showTextEditor ? '#1f6952' : '#4a5b56',
                  border: '1px solid #d4cfc5',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>✏️ Sesuaikan Teks Dokumen Resmi</span>
                {showTextEditor ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#173637', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeKop}
                  onChange={(e) => setIncludeKop(e.target.checked)}
                />
                <strong>Sertakan Kop Surat Resmi Madrasah (Kemenag)</strong>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#173637', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                />
                <strong>Sertakan Blok Tanda Tangan &amp; Pengesahan</strong>
              </label>
            </div>

            {/* Collapsible Document Text Customizer */}
            {showTextEditor && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '12px',
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #dcd9cf',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eae7dd', paddingBottom: '8px' }}>
                  {/* Sub-tabs */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setEditorSubTab('kop')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '5px',
                        border: '1px solid',
                        borderColor: editorSubTab === 'kop' ? '#1f6952' : '#dedcd3',
                        background: editorSubTab === 'kop' ? '#e9f5ee' : '#faf9f5',
                        color: editorSubTab === 'kop' ? '#1f6952' : '#5a6b65',
                        fontWeight: editorSubTab === 'kop' ? 700 : 500,
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      1. Kop Surat &amp; Instansi
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorSubTab('title')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '5px',
                        border: '1px solid',
                        borderColor: editorSubTab === 'title' ? '#1f6952' : '#dedcd3',
                        background: editorSubTab === 'title' ? '#e9f5ee' : '#faf9f5',
                        color: editorSubTab === 'title' ? '#1f6952' : '#5a6b65',
                        fontWeight: editorSubTab === 'title' ? 700 : 500,
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      2. Judul &amp; Periode
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorSubTab('signer')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '5px',
                        border: '1px solid',
                        borderColor: editorSubTab === 'signer' ? '#1f6952' : '#dedcd3',
                        background: editorSubTab === 'signer' ? '#e9f5ee' : '#faf9f5',
                        color: editorSubTab === 'signer' ? '#1f6952' : '#5a6b65',
                        fontWeight: editorSubTab === 'signer' ? 700 : 500,
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      3. Titimangsa &amp; Penandatangan
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetToSettings}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'transparent',
                      border: 'none',
                      color: '#b24c3d',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Kembalikan semua teks ke nilai default Profil Madrasah"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Default</span>
                  </button>
                </div>

                {/* SubTab 1: Kop Surat & Instansi */}
                {editorSubTab === 'kop' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '10.5px' }}>Kementerian Pembina / Naungan</label>
                      <input
                        type="text"
                        value={ministry}
                        onChange={(e) => setMinistry(e.target.value)}
                        placeholder="KEMENTERIAN AGAMA REPUBLIK INDONESIA"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '10.5px' }}>Kantor Wilayah / Kantor Kemenag Kabupaten</label>
                      <input
                        type="text"
                        value={regionalOffice}
                        onChange={(e) => setRegionalOffice(e.target.value)}
                        placeholder="KANTOR KEMENTERIAN AGAMA KABUPATEN..."
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '10.5px' }}>Nama Resmi Madrasah</label>
                      <input
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="MTs Cendekia Nusantara"
                        style={{ height: '32px', fontSize: '11px', fontWeight: 600 }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Nomor Statistik Madrasah (NSM)</label>
                      <input
                        type="text"
                        value={nsm}
                        onChange={(e) => setNsm(e.target.value)}
                        placeholder="121235..."
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>NPSN</label>
                      <input
                        type="text"
                        value={npsn}
                        onChange={(e) => setNpsn(e.target.value)}
                        placeholder="20580..."
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '10.5px' }}>Alamat Lengkap</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Jl. Raya..."
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Kota / Kabupaten</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Kabupaten Malang"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Kode Pos</label>
                      <input
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="65165"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Telepon / Kontak</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(0341)..."
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Email Resmi</label>
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="info@madrasah.sch.id"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                  </div>
                )}

                {/* SubTab 2: Judul & Periode */}
                {editorSubTab === 'title' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '10.5px' }}>Judul Utama Dokumen</label>
                      <input
                        type="text"
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        placeholder="LAPORAN REKAPITULASI KEHADIRAN GURU BULANAN"
                        style={{ height: '32px', fontSize: '11px', fontWeight: 600 }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Tahun Ajaran</label>
                      <input
                        type="text"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        placeholder="2026/2027"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Semester</label>
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value as 'Ganjil' | 'Genap')}
                        style={{ height: '32px', fontSize: '11px' }}
                      >
                        <option value="Ganjil">Semester Ganjil</option>
                        <option value="Genap">Semester Genap</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* SubTab 3: Titimangsa & Penandatangan */}
                {editorSubTab === 'signer' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Kota Titimangsa Surat</label>
                      <input
                        type="text"
                        value={signerCity}
                        onChange={(e) => setSignerCity(e.target.value)}
                        placeholder="Kabupaten Malang"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Tanggal Pengesahan Surat</label>
                      <input
                        type="text"
                        value={signerDate}
                        onChange={(e) => setSignerDate(e.target.value)}
                        placeholder="24 Oktober 2026"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2', height: '1px', background: '#eee', margin: '4px 0' }} />

                    {/* Left signatory: Curriculum Coordinator / Officer */}
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#31544d' }}>Penandatangan Kiri (Pemeriksa / Koordinator)</span>
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Jabatan</label>
                      <input
                        type="text"
                        value={officerTitle}
                        onChange={(e) => setOfficerTitle(e.target.value)}
                        placeholder="Koordinator Akademik & Kurikulum"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Nama Lengkap &amp; Gelar</label>
                      <input
                        type="text"
                        value={officerName}
                        onChange={(e) => setOfficerName(e.target.value)}
                        placeholder="Siti Aminah, S.Pd.I., M.Pd."
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '10.5px' }}>NIP / NUPTK</label>
                      <input
                        type="text"
                        value={officerNip}
                        onChange={(e) => setOfficerNip(e.target.value)}
                        placeholder="19820315 200901 2 008"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2', height: '1px', background: '#eee', margin: '4px 0' }} />

                    {/* Right signatory: Headmaster */}
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#31544d' }}>Penandatangan Kanan (Pengesah / Kepala Madrasah)</span>
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Jabatan</label>
                      <input
                        type="text"
                        value={principalTitle}
                        onChange={(e) => setPrincipalTitle(e.target.value)}
                        placeholder="Kepala Madrasah"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group">
                      <label style={{ fontSize: '10.5px' }}>Nama Lengkap &amp; Gelar</label>
                      <input
                        type="text"
                        value={principalName}
                        onChange={(e) => setPrincipalName(e.target.value)}
                        placeholder="H. Ahmad Fauzi, S.Ag., M.Pd.I."
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '10.5px' }}>NIP / NUPTK</label>
                      <input
                        type="text"
                        value={principalNip}
                        onChange={(e) => setPrincipalNip(e.target.value)}
                        placeholder="19750812 200212 1 003"
                        style={{ height: '32px', fontSize: '11px' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Teacher Selection Strip */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#31544d', letterSpacing: '0.04em' }}>
                PILIH GURU UNTUK DIREKAP ({selectedTeacherIds.length} DARI {activeTeachers.length} GURU)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{ border: 0, background: 'transparent', color: '#1f6952', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Pilih Semua
                </button>
                <span style={{ color: '#ccc' }}>·</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  style={{ border: 0, background: 'transparent', color: '#b24c3d', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hapus Pilihan
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '6px',
                maxHeight: '160px',
                overflowY: 'auto',
                padding: '8px',
                background: '#faf9f5',
                borderRadius: '8px',
                border: '1px solid #e2ded5',
              }}
            >
              {activeTeachers.map((teacher) => {
                const isChecked = selectedTeacherIds.includes(teacher.id);
                return (
                  <label
                    key={teacher.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      background: isChecked ? '#e9f4ee' : '#ffffff',
                      border: `1px solid ${isChecked ? '#b2ddc7' : '#dedcd3'}`,
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTeacher(teacher.id)}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#173637' }}>
                      {teacher.name}
                    </span>
                  </label>
                );
              })}
            </div>
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
            Ukuran Kertas: <strong>A4 ({orientation === 'landscape' ? '297 × 210 mm' : '210 × 297 mm'})</strong>
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
              disabled={isExporting || selectedTeacherIds.length === 0}
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
