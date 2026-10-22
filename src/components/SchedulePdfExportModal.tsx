import { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  GraduationCap,
  Users,
  X,
} from 'lucide-react';
import type { AppState } from '../domain/types';
import {
  exportScheduleClassPDF,
  exportAllClassesWeeklyPDF,
  exportScheduleMasterPDF,
  exportScheduleTeacherPDF,
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

type ExportType = 'class' | 'school' | 'teacher';

export function SchedulePdfExportModal({
  state,
  selectedClassId,
  isOpen,
  onClose,
  onNotify,
}: SchedulePdfExportModalProps) {
  const [exportType, setExportType] = useState<ExportType>('class');
  const [targetClassId, setTargetClassId] = useState<string>(() => selectedClassId || state.classes[0]?.id || 'all');
  const [targetTeacherId, setTargetTeacherId] = useState<string>(() => state.teachers[0]?.id || '');

  // Options for Weekly Class Schedule
  const [classOrientation, setClassOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [includeKop, setIncludeKop] = useState<boolean>(true);
  const [includeRecapPage, setIncludeRecapPage] = useState<boolean>(true);

  // Signer data
  const [signerCity, setSignerCity] = useState<string>('Kota Madrasah');
  const [signerDate, setSignerDate] = useState<string>(() =>
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
  );
  const [principalName, setPrincipalName] = useState<string>('Drs. H. M. Zainuddin, M.Pd.I');
  const [principalNip, setPrincipalNip] = useState<string>('197405101999031003');
  const [coordinatorName, setCoordinatorName] = useState<string>('Ahmad Fauzi, S.Pd.');
  const [coordinatorNip, setCoordinatorNip] = useState<string>('198204122008011015');

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const activeClasses = useMemo(() => state.classes.filter((c) => c.isActive), [state.classes]);
  const activeTeachers = useMemo(() => state.teachers.filter((t) => t.isActive), [state.teachers]);

  const selectedClassObj = useMemo(
    () => (targetClassId === 'all' ? null : state.classes.find((c) => c.id === targetClassId)),
    [state.classes, targetClassId],
  );

  const classPreviewStats = useMemo(() => {
    const entries = state.draft ?? state.activeSchedule ?? [];
    const periodMinutes = state.settings.periodMinutes ?? 40;

    if (targetClassId === 'all') {
      const activeClassIds = new Set(activeClasses.map((c) => c.id));
      const relevant = entries.filter((e) => activeClassIds.has(e.classId));
      const uniqueTeachers = new Set(relevant.map((e) => e.teacherId));
      const uniqueSubjects = new Set(relevant.map((e) => e.subjectId));
      const astro = jpToAstronomical(relevant.length, periodMinutes);
      return {
        isAll: true,
        totalJp: relevant.length,
        astroFormatted: `${astro.hours} Jam (${astro.minutes} Mnt)`,
        teacherCount: uniqueTeachers.size,
        subjectCount: uniqueSubjects.size,
        pageEstimate: activeClasses.length * 2,
      };
    }

    const classEntries = entries.filter((e) => e.classId === targetClassId);
    const uniqueTeachers = new Set(classEntries.map((e) => e.teacherId));
    const uniqueSubjects = new Set(classEntries.map((e) => e.subjectId));
    const astro = jpToAstronomical(classEntries.length, periodMinutes);

    return {
      isAll: false,
      totalJp: classEntries.length,
      astroFormatted: `${astro.hours} Jam (${astro.minutes} Mnt)`,
      teacherCount: uniqueTeachers.size,
      subjectCount: uniqueSubjects.size,
      pageEstimate: 2,
    };
  }, [state, targetClassId, activeClasses]);

  if (!isOpen) return null;

  const handleDownload = () => {
    try {
      setIsExporting(true);

      if (exportType === 'school') {
        exportScheduleMasterPDF(state);
        onNotify('PDF Jadwal Sekolah Induk berhasil diunduh.', 'success');
      } else if (exportType === 'class') {
        const options: WeeklyClassSchedulePdfOptions = {
          orientation: classOrientation,
          kopSurat: includeKop,
          includeTeacherRecapPage: includeRecapPage,
          signerCity: signerCity.trim(),
          signerDate: signerDate.trim(),
          principalName: principalName.trim(),
          principalNip: principalNip.trim(),
          coordinatorTitle:
            targetClassId === 'all'
              ? 'Koordinator Kurikulum & Akademik'
              : `Wali Kelas ${selectedClassObj?.name ?? ''} / Waka Kurikulum`,
          coordinatorName: coordinatorName.trim(),
          coordinatorNip: coordinatorNip.trim(),
        };

        if (targetClassId === 'all') {
          exportAllClassesWeeklyPDF(state, options);
          onNotify(
            `PDF Ringkasan Jadwal Mingguan Seluruh Kelas (${activeClasses.length * 2} Halaman: Jadwal + Rekap Guru) berhasil diunduh.`,
            'success',
          );
        } else {
          exportScheduleClassPDF(state, targetClassId, options);
          onNotify(
            `PDF Ringkasan Jadwal Mingguan Kelas ${selectedClassObj?.name ?? ''} (2 Halaman: Jadwal + Rekap Guru Terpisah) berhasil diunduh.`,
            'success',
          );
        }
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
        style={{ maxWidth: '640px', width: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
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
              Ekspor Dokumen PDF Jadwal Pelajaran (A4)
            </h2>
            <p style={{ margin: 0, fontSize: '11px', color: '#687a75' }}>
              Format standar cetak madrasah dengan layout bersih, tipografi proporsional, dan rekapitulasi beban JP guru
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup dialog">
            <X size={17} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Main Document Mode Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setExportType('class')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 8px',
                borderRadius: '10px',
                border: exportType === 'class' ? '2px solid #1f6952' : '1px solid #dcded3',
                background: exportType === 'class' ? '#eef7f2' : '#fff',
                cursor: 'pointer',
              }}
            >
              <GraduationCap size={20} color={exportType === 'class' ? '#1f6952' : '#758582'} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: exportType === 'class' ? '#1f6952' : '#173637' }}>
                Jadwal Mingguan Kelas
              </span>
              <small style={{ fontSize: '9.5px', color: '#56756d' }}>+ Rekap JP Halaman Terpisah</small>
            </button>

            <button
              type="button"
              onClick={() => setExportType('school')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 8px',
                borderRadius: '10px',
                border: exportType === 'school' ? '2px solid #1f6952' : '1px solid #dcded3',
                background: exportType === 'school' ? '#eef7f2' : '#fff',
                cursor: 'pointer',
              }}
            >
              <FileSpreadsheet size={20} color={exportType === 'school' ? '#1f6952' : '#758582'} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: exportType === 'school' ? '#1f6952' : '#173637' }}>
                Jadwal Induk Madrasah
              </span>
              <small style={{ fontSize: '9.5px', color: '#758582' }}>Matriks Seluruh Kelas</small>
            </button>

            <button
              type="button"
              onClick={() => setExportType('teacher')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 8px',
                borderRadius: '10px',
                border: exportType === 'teacher' ? '2px solid #1f6952' : '1px solid #dcded3',
                background: exportType === 'teacher' ? '#eef7f2' : '#fff',
                cursor: 'pointer',
              }}
            >
              <Users size={20} color={exportType === 'teacher' ? '#1f6952' : '#758582'} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: exportType === 'teacher' ? '#1f6952' : '#173637' }}>
                Jadwal Pribadi Guru
              </span>
              <small style={{ fontSize: '9.5px', color: '#758582' }}>Per Tenaga Pendidik</small>
            </button>
          </div>

          {/* MODE 1: JADWAL MINGGUAN KELAS CONFIGURATION */}
          {exportType === 'class' && (
            <>
              {/* Live Metric Preview Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  padding: '12px 14px',
                  background: '#f2f8f5',
                  borderRadius: '10px',
                  border: '1px solid #cce5d7',
                }}
              >
                <div>
                  <span style={{ fontSize: '9.5px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                    TOTAL ALOKASI JP
                  </span>
                  <strong style={{ fontSize: '15px', color: '#173637', display: 'block', marginTop: '2px' }}>
                    {classPreviewStats.totalJp} JP
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '9.5px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                    WAKTU BELAJAR
                  </span>
                  <strong style={{ fontSize: '13px', color: '#173637', display: 'block', marginTop: '3px' }}>
                    {classPreviewStats.astroFormatted}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '9.5px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                    GURU PENGAJAR
                  </span>
                  <strong style={{ fontSize: '15px', color: '#173637', display: 'block', marginTop: '2px' }}>
                    {classPreviewStats.teacherCount} Guru
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '9.5px', color: '#52776d', fontWeight: 800, letterSpacing: '0.04em' }}>
                    ESTIMASI DOKUMEN
                  </span>
                  <strong style={{ fontSize: '14px', color: '#1f6952', display: 'block', marginTop: '2px' }}>
                    {classPreviewStats.pageEstimate} Halaman (A4)
                  </strong>
                </div>
              </div>

              {/* Class Selection & Layout Grid */}
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

              {/* Document Architecture Feature Explainer */}
              <div
                style={{
                  padding: '12px 14px',
                  background: '#fffdf8',
                  borderRadius: '9px',
                  border: '1px solid #e5e3d7',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#31544d', letterSpacing: '0.04em' }}>
                  STRUKTUR DOKUMEN CETAK RESMI (2 HALAMAN PER KELAS)
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#173637', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeKop}
                      onChange={(e) => setIncludeKop(e.target.checked)}
                    />
                    <span>Sertakan Kop Surat Resmi Madrasah (Kemenag)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#173637', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeRecapPage}
                      onChange={(e) => setIncludeRecapPage(e.target.checked)}
                    />
                    <strong>Sertakan Halaman 2: Tabel Rekapitulasi Beban JP Per Guru</strong>
                  </label>
                </div>

                {includeRecapPage && (
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
                      <label style={{ fontSize: '11px' }}>Wali Kelas / Koordinator &amp; NIP</label>
                      <input
                        type="text"
                        value={coordinatorName}
                        onChange={(e) => setCoordinatorName(e.target.value)}
                        placeholder="Nama Wali Kelas / Koordinator"
                        style={{ height: '34px', fontSize: '11.5px', marginBottom: '4px' }}
                      />
                      <input
                        type="text"
                        value={coordinatorNip}
                        onChange={(e) => setCoordinatorNip(e.target.value)}
                        placeholder="NIP Wali Kelas / Koordinator"
                        style={{ height: '34px', fontSize: '11.5px' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* MODE 2: JADWAL INDUK SEKOLAH */}
          {exportType === 'school' && (
            <div style={{ background: '#f8faf7', padding: '14px', borderRadius: '10px', border: '1px solid #dce4dc', fontSize: '11.5px', color: '#405a54', lineHeight: 1.6 }}>
              <strong style={{ color: '#173637', display: 'block', marginBottom: '4px' }}>
                Format Jadwal Induk Sekolah (Master Schedule):
              </strong>
              <p style={{ margin: 0 }}>
                Dokumen komprehensif A4 Landscape yang menampilkan seluruh kelas paralel ({activeClasses.map((c) => c.name).join(', ')})
                per hari aktif KBM, jam pelajaran astronomis, penomoran halaman otomatis, dan blok pengesahan.
              </p>
            </div>
          )}

          {/* MODE 3: JADWAL GURU */}
          {exportType === 'teacher' && (
            <div>
              <div className="field-group" style={{ marginBottom: '12px' }}>
                <label>Pilih Tenaga Pendidik / Guru</label>
                <select
                  value={targetTeacherId}
                  onChange={(e) => setTargetTeacherId(e.target.value)}
                  style={{ height: '38px', fontSize: '12.5px' }}
                >
                  {activeTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}) — Maksimal {t.maxWeeklyJP} JP
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ background: '#f8faf7', padding: '12px 14px', borderRadius: '8px', border: '1px solid #dce4dc', fontSize: '11px', color: '#405a54', lineHeight: 1.5 }}>
                Memuat rincian matriks jadwal mengajar mingguan guru, jam astronomis riil, dan rincian alokasi per kelas.
              </div>
            </div>
          )}
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
            Ukuran Kertas: <strong>A4 ({classOrientation === 'landscape' ? '297 × 210 mm' : '210 × 297 mm'})</strong>
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
