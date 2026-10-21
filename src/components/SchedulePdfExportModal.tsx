import { useState } from 'react';
import { Download, FileSpreadsheet, GraduationCap, Users, X } from 'lucide-react';
import type { AppState } from '../domain/types';
import { exportScheduleClassPDF, exportScheduleMasterPDF, exportScheduleTeacherPDF } from '../utils/pdfExport';

interface SchedulePdfExportModalProps {
  state: AppState;
  selectedClassId: string;
  isOpen: boolean;
  onClose: () => void;
  onNotify: (message: string, kind?: 'success' | 'warning' | 'error' | 'info') => void;
}

type ExportType = 'school' | 'class' | 'teacher';

export function SchedulePdfExportModal({
  state,
  selectedClassId,
  isOpen,
  onClose,
  onNotify,
}: SchedulePdfExportModalProps) {
  const [exportType, setExportType] = useState<ExportType>('class');
  const [targetClassId, setTargetClassId] = useState<string>(() => selectedClassId || state.classes[0]?.id || '');
  const [targetTeacherId, setTargetTeacherId] = useState<string>(() => state.teachers[0]?.id || '');

  if (!isOpen) return null;

  const handleDownload = () => {
    try {
      if (exportType === 'school') {
        exportScheduleMasterPDF(state);
        onNotify('PDF Jadwal Sekolah Induk berhasil diunduh.', 'success');
      } else if (exportType === 'class') {
        const cls = state.classes.find((c) => c.id === targetClassId);
        exportScheduleClassPDF(state, targetClassId);
        onNotify(`PDF Jadwal Kelas ${cls?.name ?? ''} berhasil diunduh.`, 'success');
      } else {
        const tch = state.teachers.find((t) => t.id === targetTeacherId);
        exportScheduleTeacherPDF(state, targetTeacherId);
        onNotify(`PDF Jadwal Guru ${tch?.name ?? ''} berhasil diunduh.`, 'success');
      }
      onClose();
    } catch (err) {
      console.error('PDF export failed:', err);
      onNotify('Gagal membuat PDF. Periksa kelengkapan data jadwal.', 'error');
    }
  };

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: '520px', width: '92vw' }} role="dialog" aria-modal="true" aria-label="Ekspor PDF Jadwal">
        <div className="modal-head">
          <div className="modal-title-icon">
            <Download size={20} />
          </div>
          <div>
            <h2>Ekspor PDF Jadwal Pelajaran</h2>
            <p>Pilih format jadwal berstandar cetak A4 dengan kop madrasah resmi</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup dialog">
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Export Type Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
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
                border: exportType === 'class' ? '2px solid #24635e' : '1px solid #dcded3',
                background: exportType === 'class' ? '#f0f6f4' : '#fff',
                cursor: 'pointer',
              }}
            >
              <GraduationCap size={20} color={exportType === 'class' ? '#24635e' : '#758582'} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: exportType === 'class' ? '#24635e' : '#173637' }}>
                Per Kelas
              </span>
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
                border: exportType === 'school' ? '2px solid #24635e' : '1px solid #dcded3',
                background: exportType === 'school' ? '#f0f6f4' : '#fff',
                cursor: 'pointer',
              }}
            >
              <FileSpreadsheet size={20} color={exportType === 'school' ? '#24635e' : '#758582'} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: exportType === 'school' ? '#24635e' : '#173637' }}>
                Sekolah Induk
              </span>
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
                border: exportType === 'teacher' ? '2px solid #24635e' : '1px solid #dcded3',
                background: exportType === 'teacher' ? '#f0f6f4' : '#fff',
                cursor: 'pointer',
              }}
            >
              <Users size={20} color={exportType === 'teacher' ? '#24635e' : '#758582'} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: exportType === 'teacher' ? '#24635e' : '#173637' }}>
                Per Guru
              </span>
            </button>
          </div>

          {/* Sub-selector depending on choice */}
          {exportType === 'class' && (
            <div className="field-group" style={{ marginBottom: '16px' }}>
              <label>Pilih Kelas</label>
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
              >
                {state.classes.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name} (Tingkat {c.level})
                  </option>
                ))}
              </select>
            </div>
          )}

          {exportType === 'teacher' && (
            <div className="field-group" style={{ marginBottom: '16px' }}>
              <label>Pilih Guru</label>
              <select
                value={targetTeacherId}
                onChange={(e) => setTargetTeacherId(e.target.value)}
              >
                {state.teachers.filter((t) => t.isActive).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Details / Spec Preview */}
          <div style={{ background: '#f8faf7', padding: '12px 14px', borderRadius: '8px', border: '1px solid #dce4dc', fontSize: '11px', color: '#405a54', lineHeight: 1.5 }}>
            <strong>Format Cetak Resmi:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              <li>Kertas A4 standar siap cetak / arsip</li>
              <li>Memuat kop {state.settings.schoolName} & T.A. {state.settings.academicYear}</li>
              <li>Kolom tanda tangan Kepala Madrasah & Waka Kurikulum</li>
              <li>Penomoran halaman otomatis</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="button button-secondary" onClick={onClose}>
              Batal
            </button>
            <button type="button" className="button button-primary" onClick={handleDownload}>
              <Download size={15} /> Unduh PDF Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
