import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  GraduationCap,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { AppState, ValidationIssue, ValidationReport } from '../domain/types';
import { AiConflictHelper } from './AiConflictHelper';

interface QuickValidationModalProps {
  state: AppState;
  report: ValidationReport;
  masterIssues: ValidationIssue[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSlot?: (classId: string, day: string, jpNo: number) => void;
  onNavigateToScreen: (screen: 'schedule' | 'master' | 'requirements' | 'settings') => void;
  onRevalidate: () => void;
}

type IssueCategory = 'all' | 'teacher_clash' | 'class_clash' | 'time_activity' | 'coverage';

export function QuickValidationModal({
  state,
  report,
  masterIssues,
  isOpen,
  onClose,
  onNavigateToSlot: _onNavigateToSlot,
  onNavigateToScreen,
  onRevalidate,
}: QuickValidationModalProps) {
  const [activeCategory, setActiveCategory] = useState<IssueCategory>('all');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  const allIssues = useMemo(() => {
    return [...masterIssues, ...report.issues];
  }, [masterIssues, report.issues]);

  const hardErrors = useMemo(() => allIssues.filter((i) => i.severity === 'error'), [allIssues]);
  const warnings = useMemo(() => allIssues.filter((i) => i.severity === 'warning'), [allIssues]);

  const categorized = useMemo(() => {
    const teacherClash = allIssues.filter(
      (i) =>
        i.code.includes('TEACHER-COLLISION') ||
        i.code.includes('TEACHER-WEEKLY-LIMIT') ||
        i.code.includes('TEACHER-LOAD') ||
        i.code.includes('MULTISUBJECT'),
    );

    const classClash = allIssues.filter(
      (i) =>
        i.code.includes('CLASS-COLLISION') ||
        i.code.includes('SUBJECT-BLOCK') ||
        i.code.includes('THREE-JP-BLOCK') ||
        i.code.includes('NO-DOUBLE-BLOCK'),
    );

    const timeActivity = allIssues.filter(
      (i) =>
        i.code.includes('INVALID-SLOT') ||
        i.code.includes('DAILY-LIMIT') ||
        i.code.includes('BLOCKED-ACTIVITY') ||
        i.code.includes('NO-DAYS'),
    );

    const coverage = allIssues.filter(
      (i) =>
        i.code.includes('REQUIREMENT') ||
        i.code.includes('COVERAGE') ||
        i.code.includes('UNALLOCATED') ||
        i.code.includes('QUALIFICATION') ||
        i.code.includes('CLASS-DEMAND') ||
        i.code.startsWith('DATA-'),
    );

    return {
      all: allIssues,
      teacher_clash: teacherClash,
      class_clash: classClash,
      time_activity: timeActivity,
      coverage,
    };
  }, [allIssues]);

  const currentList = categorized[activeCategory] || allIssues;

  // Quick report status

  // Quick report status
  const statusType: 'PASS' | 'ISSUES' | 'FAIL' =
    hardErrors.length === 0 && warnings.length === 0
      ? 'PASS'
      : hardErrors.length === 0
      ? 'ISSUES'
      : 'FAIL';

  if (!isOpen) return null;

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal-panel"
        style={{ maxWidth: '820px', width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-modal="true"
        aria-label="Laporan Pemeriksaan Cepat Jadwal"
      >
        {/* Modal Head */}
        <div className="modal-head" style={{ borderBottom: '1px solid #e7e5da', paddingBottom: '14px' }}>
          <div className="modal-title-icon" style={{ background: statusType === 'PASS' ? '#e9f5ee' : statusType === 'FAIL' ? '#fdf0ee' : '#fdf8ec' }}>
            {statusType === 'PASS' ? (
              <ShieldCheck size={22} color="#1f6952" />
            ) : statusType === 'FAIL' ? (
              <ShieldAlert size={22} color="#b24c3d" />
            ) : (
              <AlertTriangle size={22} color="#a1752b" />
            )}
          </div>
          <div>
            <h2 style={{ fontSize: '18px', margin: 0, color: '#173637' }}>Quick Validation Report</h2>
            <p style={{ margin: 0, fontSize: '11px', color: '#758582' }}>
              Hasil audit otomatis seluruh aturan keras (hard constraints) dan preferensi jadwal
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup dialog">
            <X size={18} />
          </button>
        </div>

        {/* Status Highlight Banner */}
        <div
          style={{
            margin: '16px 20px 0',
            padding: '14px 18px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: statusType === 'PASS' ? '#eff7f2' : statusType === 'FAIL' ? '#fdf2f0' : '#fdfaf2',
            border: `1px solid ${statusType === 'PASS' ? '#c3e5d0' : statusType === 'FAIL' ? '#f8d0c8' : '#f4e3c1'}`,
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: statusType === 'PASS' ? '#1f6952' : statusType === 'FAIL' ? '#b24c3d' : '#a1752b' }}>
              {statusType === 'PASS' ? 'STATUS: LOLOS PEMERIKSAAN' : statusType === 'FAIL' ? 'STATUS: PERLU TINDAKAN SEGERA' : 'STATUS: LOLOS DENGAN CATATAN'}
            </div>
            <strong style={{ fontSize: '15px', color: '#173637' }}>
              {statusType === 'PASS'
                ? 'Semua aturan validasi terpenuhi. Jadwal siap diterbitkan.'
                : statusType === 'FAIL'
                ? `Ditemukan ${hardErrors.length} pelanggaran aturan wajib yang harus diperbaiki.`
                : `Tidak ada bentrok keras. Terdapat ${warnings.length} preferensi yang bisa dioptimalkan.`}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="button button-secondary" onClick={onRevalidate} style={{ height: '32px', fontSize: '11px' }}>
              <RefreshCw size={13} /> Uji Ulang
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', padding: '14px 20px 0', overflowX: 'auto' }}>
          <button
            className={`status-pill ${activeCategory === 'all' ? 'status-success' : 'status-neutral'}`}
            style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '11px' }}
            onClick={() => setActiveCategory('all')}
          >
            Semua ({allIssues.length})
          </button>
          <button
            className={`status-pill ${activeCategory === 'teacher_clash' ? 'status-warning' : 'status-neutral'}`}
            style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '11px' }}
            onClick={() => setActiveCategory('teacher_clash')}
          >
            <Users size={12} style={{ marginRight: '4px' }} />
            Bentrok Guru ({categorized.teacher_clash.length})
          </button>
          <button
            className={`status-pill ${activeCategory === 'class_clash' ? 'status-warning' : 'status-neutral'}`}
            style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '11px' }}
            onClick={() => setActiveCategory('class_clash')}
          >
            <GraduationCap size={12} style={{ marginRight: '4px' }} />
            Bentrok Kelas ({categorized.class_clash.length})
          </button>
          <button
            className={`status-pill ${activeCategory === 'time_activity' ? 'status-warning' : 'status-neutral'}`}
            style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '11px' }}
            onClick={() => setActiveCategory('time_activity')}
          >
            Waktu & Kegiatan ({categorized.time_activity.length})
          </button>
          <button
            className={`status-pill ${activeCategory === 'coverage' ? 'status-warning' : 'status-neutral'}`}
            style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '11px' }}
            onClick={() => setActiveCategory('coverage')}
          >
            Alokasi & Kualifikasi ({categorized.coverage.length})
          </button>
        </div>

        {/* AI Explainer Box (Optional) */}
        {state.settings.geminiEnabled && (
          <div style={{ margin: '0 20px' }}>
            <AiConflictHelper
              issues={allIssues}
              geminiEnabledInSettings={state.settings.geminiEnabled}
              onNavigateToScreen={onNavigateToScreen}
              compact
            />
          </div>
        )}

        {/* Scrollable Issue List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', minHeight: '180px' }}>
          {currentList.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <CheckCircle2 size={32} color="#1f6952" />
              <h3>Kategori ini bersih dari masalah</h3>
              <p>Tidak ada konflik atau peringatan yang ditemukan pada kelompok ini.</p>
            </div>
          ) : (
            <div className="issue-list">
              {currentList.map((issue) => {
                const isExpanded = expandedIssueId === issue.id;
                const isError = issue.severity === 'error';

                return (
                  <div key={issue.id} className={`issue-item issue-${issue.severity}`}>
                    <div
                      className="issue-item-main"
                      onClick={() => setExpandedIssueId(isExpanded ? null : issue.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="issue-severity-icon">
                        {isError ? <XCircle size={18} /> : <AlertTriangle size={18} />}
                      </div>
                      <div className="issue-copy">
                        <div className="issue-title-row">
                          <strong>{issue.title}</strong>
                          <span className="issue-code">{issue.code}</span>
                        </div>
                        <p>{issue.message}</p>
                        {issue.context && <span className="issue-context">{issue.context}</span>}
                      </div>
                      <ChevronDown
                        className={`issue-chevron ${isExpanded ? 'is-open' : ''}`}
                        size={17}
                      />
                    </div>

                    {isExpanded && (
                      <div className="issue-expanded" style={{ borderTop: '1px solid #f0eee6', padding: '12px 16px' }}>
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#7a8a86' }}>
                            REKOMENDASI PENYELESAIAN
                          </span>
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#274744' }}>
                            {issue.action || 'Periksa data terkait dan lakukan validasi ulang.'}
                          </p>
                        </div>
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                          <button
                            className="button button-secondary"
                            style={{ height: '30px', fontSize: '11px', padding: '4px 10px' }}
                            onClick={() => {
                              onClose();
                              if (issue.code.includes('COLLISION') || issue.code.includes('SLOT')) {
                                onNavigateToScreen('schedule');
                              } else if (issue.code.includes('REQUIREMENT') || issue.code.includes('ALLOCATION')) {
                                onNavigateToScreen('requirements');
                              } else {
                                onNavigateToScreen('master');
                              }
                            }}
                          >
                            Buka Area Terkait <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Foot Actions */}
        <div
          style={{
            borderTop: '1px solid #e7e5da',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#faf8f2',
            borderRadius: '0 0 14px 14px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#7a8a86', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FileCheck2 size={14} /> Validator Deterministik v1.0 · Single source of truth
          </span>
          <button className="button button-primary" onClick={onClose}>
            Tutup Laporan
          </button>
        </div>
      </div>
    </div>
  );
}
