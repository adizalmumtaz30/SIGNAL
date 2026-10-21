import { useState, useEffect, type FormEvent } from 'react';
import {
  X,
  Save,
  GraduationCap,
  Users,
  BookOpen,
  CalendarCheck,
  Check,
} from 'lucide-react';
import type {
  AppState,
  SchoolClass,
  Teacher,
  Subject,
  Requirement,
} from '../domain/types';

export type EntityKind = 'class' | 'teacher' | 'subject' | 'requirement';

export interface EntityEditTarget {
  kind: EntityKind;
  isNew: boolean;
  item?: SchoolClass | Teacher | Subject | Requirement;
}

interface EntityEditModalProps {
  isOpen: boolean;
  target: EntityEditTarget | null;
  state: AppState;
  onClose: () => void;
  onSaveClass: (cls: SchoolClass, isNew: boolean) => void;
  onSaveTeacher: (tch: Teacher, isNew: boolean) => void;
  onSaveSubject: (sub: Subject, isNew: boolean) => void;
  onSaveRequirement: (req: Requirement, isNew: boolean) => void;
}

const PALETTE = [
  '#2f7771', // Deep Teal
  '#24635e', // Dark Teal
  '#3d8b7a', // Jade Teal
  '#b38b3f', // Brass Gold
  '#4a7b9d', // Slate Blue
  '#845ec2', // Purple
  '#d65db1', // Rose
  '#ff6f91', // Coral
  '#d97736', // Terracotta
  '#596e79', // Ash
];

export function EntityEditModal({
  isOpen,
  target,
  state,
  onClose,
  onSaveClass,
  onSaveTeacher,
  onSaveSubject,
  onSaveRequirement,
}: EntityEditModalProps) {
  // Class state
  const [className, setClassName] = useState('');
  const [classLevel, setClassLevel] = useState('VII');
  const [classIsActive, setClassIsActive] = useState(true);

  // Teacher state
  const [teacherName, setTeacherName] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [teacherSubjectIds, setTeacherSubjectIds] = useState<string[]>([]);
  const [teacherMaxJP, setTeacherMaxJP] = useState('24');
  const [teacherIsActive, setTeacherIsActive] = useState(true);

  // Subject state
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectColor, setSubjectColor] = useState('#2f7771');
  const [subjectIsActive, setSubjectIsActive] = useState(true);

  // Requirement state
  const [reqClassId, setReqClassId] = useState('');
  const [reqSubjectId, setReqSubjectId] = useState('');
  const [reqTeacherId, setReqTeacherId] = useState('');
  const [reqJP, setReqJP] = useState('4');

  const [error, setError] = useState<string | null>(null);

  // Sync state whenever target opens/changes
  useEffect(() => {
    if (!target) return;
    setError(null);

    if (target.kind === 'class') {
      const item = target.item as SchoolClass | undefined;
      setClassName(item?.name ?? '');
      setClassLevel(item?.level ?? 'VII');
      setClassIsActive(item?.isActive ?? true);
    } else if (target.kind === 'teacher') {
      const item = target.item as Teacher | undefined;
      setTeacherName(item?.name ?? '');
      setTeacherCode(item?.code ?? '');
      setTeacherSubjectIds(item?.subjectIds ?? []);
      setTeacherMaxJP(String(item?.maxWeeklyJP ?? 24));
      setTeacherIsActive(item?.isActive ?? true);
    } else if (target.kind === 'subject') {
      const item = target.item as Subject | undefined;
      setSubjectName(item?.name ?? '');
      setSubjectCode(item?.code ?? '');
      setSubjectColor(item?.color ?? '#2f7771');
      setSubjectIsActive(item?.isActive ?? true);
    } else if (target.kind === 'requirement') {
      const item = target.item as Requirement | undefined;
      const initialClass = item?.classId ?? state.classes.find((c) => c.isActive)?.id ?? '';
      const initialSub = item?.subjectId ?? state.subjects.find((s) => s.isActive)?.id ?? '';
      const initialTeacher =
        item?.teacherId ??
        state.teachers.find((t) => t.isActive && t.subjectIds.includes(initialSub))?.id ??
        '';

      setReqClassId(initialClass);
      setReqSubjectId(initialSub);
      setReqTeacherId(initialTeacher);
      setReqJP(String(item?.requiredJP ?? 4));
    }
  }, [target, state]);

  if (!isOpen || !target) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (target.kind === 'class') {
      const trimmed = className.trim();
      if (!trimmed) {
        setError('Nama kelas wajib diisi.');
        return;
      }
      // Check duplicate name
      const duplicate = state.classes.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() && (!target.item || c.id !== target.item.id)
      );
      if (duplicate) {
        setError(`Kelas dengan nama "${trimmed}" sudah ada.`);
        return;
      }

      const item: SchoolClass = {
        id: target.item?.id ?? `CLS-${Date.now().toString(36)}`,
        name: trimmed,
        level: classLevel,
        isActive: classIsActive,
      };
      onSaveClass(item, target.isNew);
      onClose();
    } else if (target.kind === 'teacher') {
      const trimmed = teacherName.trim();
      if (!trimmed) {
        setError('Nama guru wajib diisi.');
        return;
      }
      if (teacherSubjectIds.length === 0) {
        setError('Pilih minimal satu kualifikasi mata pelajaran.');
        return;
      }
      const maxJP = Math.max(1, Math.min(60, Number(teacherMaxJP) || 24));
      const code =
        teacherCode.trim() ||
        (target.item as Teacher)?.code ||
        `T-${state.teachers.length + 1}`;

      const item: Teacher = {
        id: target.item?.id ?? `TCH-${Date.now().toString(36)}`,
        name: trimmed,
        code,
        subjectIds: teacherSubjectIds,
        maxWeeklyJP: maxJP,
        isActive: teacherIsActive,
      };
      onSaveTeacher(item, target.isNew);
      onClose();
    } else if (target.kind === 'subject') {
      const trimmed = subjectName.trim();
      if (!trimmed) {
        setError('Nama mata pelajaran wajib diisi.');
        return;
      }
      const duplicate = state.subjects.some(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase() && (!target.item || s.id !== target.item.id)
      );
      if (duplicate) {
        setError(`Mata pelajaran "${trimmed}" sudah terdaftar.`);
        return;
      }
      const code =
        subjectCode.trim() ||
        (target.item as Subject)?.code ||
        `MAP-${state.subjects.length + 1}`;

      const item: Subject = {
        id: target.item?.id ?? `SUB-${Date.now().toString(36)}`,
        name: trimmed,
        code,
        color: subjectColor,
        isActive: subjectIsActive,
      };
      onSaveSubject(item, target.isNew);
      onClose();
    } else if (target.kind === 'requirement') {
      if (!reqClassId || !reqSubjectId || !reqTeacherId) {
        setError('Kelas, mata pelajaran, dan guru pengampu wajib dipilih.');
        return;
      }
      const jp = Number(reqJP);
      if (!Number.isInteger(jp) || jp < 1 || jp > 50) {
        setError('Alokasi JP harus berupa bilangan bulat antara 1 sampai 50.');
        return;
      }
      // Check teacher qualification
      const tch = state.teachers.find((t) => t.id === reqTeacherId);
      if (!tch?.subjectIds.includes(reqSubjectId)) {
        setError('Guru yang dipilih belum memiliki kualifikasi untuk mata pelajaran ini.');
        return;
      }

      const item: Requirement = {
        id: target.item?.id ?? `REQ-${Date.now().toString(36)}`,
        classId: reqClassId,
        subjectId: reqSubjectId,
        teacherId: reqTeacherId,
        requiredJP: jp,
      };
      onSaveRequirement(item, target.isNew);
      onClose();
    }
  };

  const getTitle = () => {
    const action = target.isNew ? 'Tambah' : 'Edit';
    switch (target.kind) {
      case 'class':
        return `${action} Data Kelas`;
      case 'teacher':
        return `${action} Data Guru`;
      case 'subject':
        return `${action} Mata Pelajaran`;
      case 'requirement':
        return `${action} Alokasi JP & Kurikulum`;
    }
  };

  const getIcon = () => {
    switch (target.kind) {
      case 'class':
        return <GraduationCap size={20} color="#24635e" />;
      case 'teacher':
        return <Users size={20} color="#24635e" />;
      case 'subject':
        return <BookOpen size={20} color="#24635e" />;
      case 'requirement':
        return <CalendarCheck size={20} color="#24635e" />;
    }
  };

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-panel"
        style={{ maxWidth: '560px', width: '92vw' }}
        role="dialog"
        aria-modal="true"
        aria-label={getTitle()}
      >
        {/* Header */}
        <div className="modal-head">
          <div className="modal-title-icon" style={{ background: '#eef5f2' }}>
            {getIcon()}
          </div>
          <div>
            <h2>{getTitle()}</h2>
            <p>
              {target.isNew
                ? 'Item baru akan disimpan ke dalam basis data browser.'
                : 'Perubahan akan otomatis disinkronkan ke jadwal dan validator.'}
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Tutup">
            <X size={17} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fdf0ee',
                border: '1px solid #f7c8c1',
                color: '#9e3223',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* 1. CLASS FORM */}
          {target.kind === 'class' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field-group">
                <label>Nama Kelas</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: VII-A, VIII-1, atau IX Unggulan"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field-group">
                  <label>Tingkat</label>
                  <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
                    <option value="VII">VII (Tujuh)</option>
                    <option value="VIII">VIII (Delapan)</option>
                    <option value="IX">IX (Sembilan)</option>
                  </select>
                </div>

                <div className="field-group">
                  <label>Status Operasional</label>
                  <select
                    value={classIsActive ? 'active' : 'inactive'}
                    onChange={(e) => setClassIsActive(e.target.value === 'active')}
                  >
                    <option value="active">Aktif (Masuk Jadwal)</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 2. TEACHER FORM */}
          {target.kind === 'teacher' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="field-group">
                  <label>Nama Lengkap & Gelar Guru</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="field-group">
                  <label>Kode Singkat</label>
                  <input
                    type="text"
                    placeholder="Contoh: AF atau T-01"
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="field-group">
                <label>Kualifikasi Mata Pelajaran yang Diampu</label>
                <div
                  className="qualification-check-grid"
                  style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    padding: '8px',
                    border: '1px solid #dfe7db',
                    borderRadius: '8px',
                    background: '#fafaf6',
                  }}
                >
                  {state.subjects.map((sub) => {
                    const isChecked = teacherSubjectIds.includes(sub.id);
                    return (
                      <label
                        key={sub.id}
                        className={`qualification-check ${isChecked ? 'checked' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTeacherSubjectIds([...teacherSubjectIds, sub.id]);
                            } else {
                              setTeacherSubjectIds(teacherSubjectIds.filter((id) => id !== sub.id));
                            }
                          }}
                        />
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: sub.color,
                            display: 'inline-block',
                          }}
                        />
                        <span>{sub.name}</span>
                        <small style={{ color: '#888', marginLeft: 'auto' }}>({sub.code})</small>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field-group">
                  <label>Batas Maksimum Beban (JP/minggu)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={teacherMaxJP}
                    onChange={(e) => setTeacherMaxJP(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label>Status Guru</label>
                  <select
                    value={teacherIsActive ? 'active' : 'inactive'}
                    onChange={(e) => setTeacherIsActive(e.target.value === 'active')}
                  >
                    <option value="active">Aktif Mengajar</option>
                    <option value="inactive">Nonaktif / Cuti</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 3. SUBJECT FORM */}
          {target.kind === 'subject' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="field-group">
                  <label>Nama Mata Pelajaran</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Matematika, Bahasa Arab"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="field-group">
                  <label>Kode Mapel</label>
                  <input
                    type="text"
                    placeholder="Contoh: MAT, ARB"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="field-group">
                <label>Warna Aksen di Jadwal</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSubjectColor(c)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: c,
                        border: subjectColor === c ? '2px solid #173637' : '1px solid transparent',
                        outline: subjectColor === c ? '2px solid #b38b3f' : 'none',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {subjectColor === c && <Check size={14} color="#fff" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={subjectColor}
                    onChange={(e) => setSubjectColor(e.target.value)}
                    title="Pilih warna kustom"
                    style={{
                      width: '32px',
                      height: '28px',
                      padding: 0,
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              <div className="field-group">
                <label>Status Mapel</label>
                <select
                  value={subjectIsActive ? 'active' : 'inactive'}
                  onChange={(e) => setSubjectIsActive(e.target.value === 'active')}
                >
                  <option value="active">Aktif di Kurikulum</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>
            </div>
          )}

          {/* 4. REQUIREMENT FORM */}
          {target.kind === 'requirement' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field-group">
                <label>Kelas Target</label>
                <select
                  required
                  value={reqClassId}
                  onChange={(e) => setReqClassId(e.target.value)}
                >
                  <option value="">Pilih Kelas</option>
                  {state.classes
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Kelas {c.name} ({c.level})
                      </option>
                    ))}
                </select>
              </div>

              <div className="field-group">
                <label>Mata Pelajaran</label>
                <select
                  required
                  value={reqSubjectId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setReqSubjectId(sid);
                    // auto select teacher if available
                    const tch = state.teachers.find(
                      (t) => t.isActive && t.subjectIds.includes(sid)
                    );
                    setReqTeacherId(tch?.id ?? '');
                  }}
                >
                  <option value="">Pilih Mapel</option>
                  {state.subjects
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="field-group">
                <label>Guru Pengampu Berkualifikasi</label>
                <select
                  required
                  value={reqTeacherId}
                  onChange={(e) => setReqTeacherId(e.target.value)}
                >
                  <option value="">Pilih Guru Pengampu</option>
                  {state.teachers
                    .filter(
                      (t) =>
                        t.isActive &&
                        (!reqSubjectId || t.subjectIds.includes(reqSubjectId))
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code}) - maks {t.maxWeeklyJP} JP
                      </option>
                    ))}
                </select>
              </div>

              <div className="field-group">
                <label>Alokasi Jam Pelajaran (JP/minggu)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={reqJP}
                  onChange={(e) => setReqJP(e.target.value)}
                />
                <small style={{ color: '#7a887b' }}>
                  Jumlah JP mingguan yang akan dialokasikan oleh generator ke kelas ini.
                </small>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '22px',
              borderTop: '1px solid #efede5',
              paddingTop: '14px',
            }}
          >
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              Batal
            </button>
            <button type="submit" className="button button-primary">
              <Save size={15} /> Simpan Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
