import { useMemo, useState } from 'react';
import {
  Download,
  X,
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

  // Signer data
  const [signerCity, setSignerCity] = useState<string>('Kota Madrasah');
  const [signerDate, setSignerDate] = useState<string>(() =>
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
  );
  const [principalName, setPrincipalName] = useState<string>('Drs. H. M. Zainuddin, M.Pd.I');
  const [principalNip, setPrincipalNip] = useState<string>('197405101999031003');
  const [officerName, setOfficerName] = useState<string>('Ahmad Fauzi, S.Pd.');
  const [officerNip, setOfficerNip] = useState<string>('198204122008011015');

  // Selected teachers list
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>(() =>
    activeTeachers.map((t) => t.id),
  );

  const [isExporting, setIsExporting] = useState<boolean>(false);

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
        signerCity: signerCity.trim(),
        signerDate: signerDate.trim(),
        principalName: principalName.trim(),
        principalNip: principalNip.trim(),
        officerTitle: 'Koordinator Akademik & Kurikulum',
        officerName: officerName.trim(),
        officerNip: officerNip.trim(),
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
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#31544d', letterSpacing: '0.05em' }}>
              KOMPONEN DOKUMEN RESMI
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

            {includeSignature && (
              <div
                style={{
                  marginTop: '6px',
                  paddingTop: '10px',
                  borderTop: '1px solid #edebe1',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                }}
              >
                <div className="field-group">
                  <label style={{ fontSize: '11px' }}>Kota &amp; Titimangsa Surat</label>
                  <input
                    type="text"
                    value={signerCity}
                    onChange={(e) => setSignerCity(e.target.value)}
                    placeholder="Kota Madrasah"
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

                <div className="field-group">
                  <label style={{ fontSize: '11px' }}>Kepala Madrasah &amp; NIP</label>
                  <input
                    type="text"
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    placeholder="Nama Kepala Madrasah"
                    style={{ height: '34px', fontSize: '11.5px', marginBottom: '4px' }}
                  />
                  <input
                    type="text"
                    value={principalNip}
                    onChange={(e) => setPrincipalNip(e.target.value)}
                    placeholder="NIP Kepala Madrasah"
                    style={{ height: '34px', fontSize: '11.5px' }}
                  />
                </div>

                <div className="field-group">
                  <label style={{ fontSize: '11px' }}>Koordinator / Petugas &amp; NIP</label>
                  <input
                    type="text"
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    placeholder="Nama Koordinator Kurikulum"
                    style={{ height: '34px', fontSize: '11.5px', marginBottom: '4px' }}
                  />
                  <input
                    type="text"
                    value={officerNip}
                    onChange={(e) => setOfficerNip(e.target.value)}
                    placeholder="NIP Koordinator"
                    style={{ height: '34px', fontSize: '11.5px' }}
                  />
                </div>
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
