import { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import type { AppState, AttendanceRecord, AttendanceStatus, Holiday } from '../domain/types';
import { AttendancePdfExportModal } from './AttendancePdfExportModal';
import { InfoNotice } from './InfoNotice';

interface AttendanceScreenProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onNotify: (message: string, kind?: 'success' | 'warning' | 'error' | 'info') => void;
}

type AttendanceTab = 'daily' | 'monthly' | 'teacher' | 'recap' | 'holidays';

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; short: string; color: string; bg: string; border: string }
> = {
  HADIR: { label: 'Hadir', short: 'H', color: '#1f6952', bg: '#e8f5ee', border: '#b8e3cd' },
  IZIN: { label: 'Izin', short: 'I', color: '#9c6f28', bg: '#fbf4e8', border: '#ebd8b6' },
  SAKIT: { label: 'Sakit', short: 'S', color: '#4b7596', bg: '#edf4f9', border: '#c3dbed' },
  ALPA: { label: 'Alpa', short: 'A', color: '#b24c3d', bg: '#fdf0ee', border: '#f7c8c1' },
  DINAS_LUAR: { label: 'Dinas Luar', short: 'DL', color: '#685094', bg: '#f3effa', border: '#d7c7ed' },
};

function formatLocalDate(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function AttendanceScreen({ state, onUpdateState, onNotify }: AttendanceScreenProps) {
  const [activeTab, setActiveTab] = useState<AttendanceTab>('daily');
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => state.teachers[0]?.id ?? '');
  const [recapSelectedTeachers, setRecapSelectedTeachers] = useState<string[]>(() =>
    state.teachers.filter((t) => t.isActive).map((t) => t.id),
  );
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Daily Mass Entry Working State
  const [dailyEntries, setDailyEntries] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({});
  const [dailyInitializedDate, setDailyInitializedDate] = useState<string>('');

  // Mass Monthly Entry Working State
  const [massMonthStatus, setMassMonthStatus] = useState<AttendanceStatus>('HADIR');
  const [massMonthTarget, setMassMonthTarget] = useState<'all' | 'selected'>('all');
  const [massMonthSelectedTeachers, setMassMonthSelectedTeachers] = useState<string[]>([]);
  const [massMonthStartDate, setMassMonthStartDate] = useState(`${new Date().toISOString().slice(0, 7)}-01`);
  const [massMonthEndDate, setMassMonthEndDate] = useState(`${new Date().toISOString().slice(0, 7)}-28`);

  // Holiday Form State
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);

  const activeTeachers = useMemo(() => state.teachers.filter((t) => t.isActive), [state.teachers]);
  const holidays = useMemo(() => state.holidays ?? [], [state.holidays]);
  const attendanceList = useMemo(() => state.attendance ?? [], [state.attendance]);

  // Sync daily entries whenever date changes
  if (dailyInitializedDate !== currentDate) {
    const existingForDate = attendanceList.filter((a) => a.date === currentDate);
    const map: Record<string, { status: AttendanceStatus; notes: string }> = {};
    for (const t of activeTeachers) {
      const match = existingForDate.find((e) => e.teacherId === t.id);
      map[t.id] = {
        status: match?.status ?? 'HADIR',
        notes: match?.notes ?? '',
      };
    }
    setDailyEntries(map);
    setDailyInitializedDate(currentDate);
  }

  // 1. Save Daily Mass Attendance
  const handleSaveDaily = () => {
    onUpdateState((prev) => {
      const currentList = prev.attendance ?? [];
      const withoutCurrentDate = currentList.filter((a) => a.date !== currentDate);
      const newRecords: AttendanceRecord[] = activeTeachers.map((teacher) => {
        const entry = dailyEntries[teacher.id] ?? { status: 'HADIR', notes: '' };
        return {
          id: `ATT-${currentDate}-${teacher.id}`,
          date: currentDate,
          teacherId: teacher.id,
          status: entry.status,
          notes: entry.notes,
          recordedAt: new Date().toISOString(),
        };
      });
      return {
        ...prev,
        attendance: [...withoutCurrentDate, ...newRecords],
      };
    });
    onNotify(`Presensi harian tanggal ${formatLocalDate(currentDate)} berhasil disimpan.`, 'success');
  };

  // 1-click Set All Present
  const handleSetAllPresent = () => {
    const updated = { ...dailyEntries };
    for (const t of activeTeachers) {
      updated[t.id] = { ...updated[t.id], status: 'HADIR' };
    }
    setDailyEntries(updated);
    onNotify('Seluruh guru disetel Hadir untuk tanggal ini.', 'info');
  };

  // 2. Save Mass Monthly Attendance
  const handleSaveMassMonthly = () => {
    if (!massMonthStartDate || !massMonthEndDate || massMonthStartDate > massMonthEndDate) {
      onNotify('Rentang tanggal tidak valid.', 'warning');
      return;
    }

    const targetTeachers = massMonthTarget === 'all'
      ? activeTeachers.map((t) => t.id)
      : massMonthSelectedTeachers;

    if (!targetTeachers.length) {
      onNotify('Pilih setidaknya satu guru untuk menerapkan presensi.', 'warning');
      return;
    }

    // Generate date array
    const dates: string[] = [];
    const cur = new Date(massMonthStartDate);
    const end = new Date(massMonthEndDate);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      // Skip if holiday or Sunday (0)
      const dayOfWeek = cur.getDay();
      const isSunday = dayOfWeek === 0;
      const isHoliday = holidays.some((h) => h.date === dateStr);
      if (!isSunday && !isHoliday) {
        dates.push(dateStr);
      }
      cur.setDate(cur.getDate() + 1);
    }

    onUpdateState((prev) => {
      let list = prev.attendance ?? [];
      for (const d of dates) {
        for (const tId of targetTeachers) {
          list = list.filter((a) => !(a.date === d && a.teacherId === tId));
          list.push({
            id: `ATT-${d}-${tId}`,
            date: d,
            teacherId: tId,
            status: massMonthStatus,
            notes: `Input massal ${massMonthStatus}`,
            recordedAt: new Date().toISOString(),
          });
        }
      }
      return { ...prev, attendance: list };
    });

    onNotify(`Presensi ${massMonthStatus} berhasil diterapkan untuk ${targetTeachers.length} guru pada ${dates.length} hari efektif.`, 'success');
  };

  // 3. Save Single Teacher Day
  const handleToggleSingleTeacherDay = (dateStr: string, currentStatus?: AttendanceStatus) => {
    const statuses: AttendanceStatus[] = ['HADIR', 'IZIN', 'SAKIT', 'DINAS_LUAR', 'ALPA'];
    const nextStatus = currentStatus ? statuses[(statuses.indexOf(currentStatus) + 1) % statuses.length] : 'HADIR';

    onUpdateState((prev) => {
      const list = (prev.attendance ?? []).filter((a) => !(a.date === dateStr && a.teacherId === selectedTeacherId));
      return {
        ...prev,
        attendance: [
          ...list,
          {
            id: `ATT-${dateStr}-${selectedTeacherId}`,
            date: dateStr,
            teacherId: selectedTeacherId,
            status: nextStatus,
            recordedAt: new Date().toISOString(),
          },
        ],
      };
    });
  };

  // 4. Monthly Recap Stats
  const recapData = useMemo(() => {
    return activeTeachers
      .filter((t) => recapSelectedTeachers.includes(t.id))
      .map((teacher, idx) => {
        const records = attendanceList.filter(
          (a) => a.teacherId === teacher.id && a.date.startsWith(currentMonth),
        );
        const hadir = records.filter((r) => r.status === 'HADIR').length;
        const izin = records.filter((r) => r.status === 'IZIN').length;
        const sakit = records.filter((r) => r.status === 'SAKIT').length;
        const alpa = records.filter((r) => r.status === 'ALPA').length;
        const dinas = records.filter((r) => r.status === 'DINAS_LUAR').length;
        const total = records.length;
        const rate = total > 0 ? Math.round(((hadir + dinas) / total) * 100) : 100;

        return {
          no: idx + 1,
          teacher,
          hadir,
          izin,
          sakit,
          alpa,
          dinas,
          total,
          rate,
        };
      });
  }, [activeTeachers, recapSelectedTeachers, attendanceList, currentMonth]);

  // 5. Add / Edit / Delete Holiday
  const handleSaveHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) {
      onNotify('Tanggal dan nama hari libur harus diisi.', 'warning');
      return;
    }
    if (editingHolidayId) {
      onUpdateState((prev) => ({
        ...prev,
        holidays: (prev.holidays ?? [])
          .map((h) =>
            h.id === editingHolidayId
              ? { ...h, date: newHolidayDate, name: newHolidayName.trim() }
              : h
          )
          .sort((a, b) => a.date.localeCompare(b.date)),
      }));
      setEditingHolidayId(null);
      setNewHolidayDate('');
      setNewHolidayName('');
      onNotify('Hari libur berhasil diperbarui.', 'success');
      return;
    }

    const holiday: Holiday = {
      id: `HOL-${Date.now().toString(36)}`,
      date: newHolidayDate,
      name: newHolidayName.trim(),
    };
    onUpdateState((prev) => ({
      ...prev,
      holidays: [...(prev.holidays ?? []), holiday].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setNewHolidayDate('');
    setNewHolidayName('');
    onNotify(`Hari libur "${holiday.name}" ditambahkan.`, 'success');
  };

  const handleStartEditHoliday = (hol: Holiday) => {
    setEditingHolidayId(hol.id);
    setNewHolidayDate(hol.date);
    setNewHolidayName(hol.name);
  };

  const handleCancelEditHoliday = () => {
    setEditingHolidayId(null);
    setNewHolidayDate('');
    setNewHolidayName('');
  };

  const handleDeleteHoliday = (id: string) => {
    if (editingHolidayId === id) {
      handleCancelEditHoliday();
    }
    onUpdateState((prev) => ({
      ...prev,
      holidays: (prev.holidays ?? []).filter((h) => h.id !== id),
    }));
    onNotify('Hari libur dihapus.', 'info');
  };

  const isCurrentDateHoliday = holidays.find((h) => h.date === currentDate);

  return (
    <div className="attendance-screen">
      {/* Screen Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            MODUL PRESENSI & KEHADIRAN
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h1 style={{ margin: 0 }}>Presensi & Absensi Guru</h1>
            <InfoNotice text="Kelola pencatatan kehadiran harian, massal bulanan, rekapitulasi kehadiran dengan persentase otomatis, ekspor PDF resmi, dan jadwal hari libur madrasah." />
          </div>
        </div>
        <div className="page-actions">
          <button className="button button-primary" onClick={() => setPdfModalOpen(true)}>
            <Download size={15} /> Ekspor PDF Rekap Bulanan (A4)
          </button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="segmented-tabs" style={{ marginBottom: '18px' }}>
        <button
          className={activeTab === 'daily' ? 'active' : ''}
          onClick={() => setActiveTab('daily')}
        >
          <CalendarDays size={14} style={{ marginRight: '6px' }} />
          1. Input Massal Harian
        </button>
        <button
          className={activeTab === 'monthly' ? 'active' : ''}
          onClick={() => setActiveTab('monthly')}
        >
          <Calendar size={14} style={{ marginRight: '6px' }} />
          2. Input Bulanan
        </button>
        <button
          className={activeTab === 'teacher' ? 'active' : ''}
          onClick={() => setActiveTab('teacher')}
        >
          <Users size={14} style={{ marginRight: '6px' }} />
          3. Input per Guru
        </button>
        <button
          className={activeTab === 'recap' ? 'active' : ''}
          onClick={() => setActiveTab('recap')}
        >
          <UserCheck size={14} style={{ marginRight: '6px' }} />
          4. Rekap Bulanan & PDF
        </button>
        <button
          className={activeTab === 'holidays' ? 'active' : ''}
          onClick={() => setActiveTab('holidays')}
        >
          <Clock size={14} style={{ marginRight: '6px' }} />
          5. Pengaturan Hari Libur ({holidays.length})
        </button>
      </div>

      {/* TAB 1: INPUT MASSAL SEMUA GURU PER HARI */}
      {activeTab === 'daily' && (
        <div className="surface-card">
          <div className="card-heading">
            <div>
              <div className="card-eyebrow">DAILY TEACHER ATTENDANCE</div>
              <h3>Pencatatan Presensi Harian Semua Guru</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="button button-secondary" onClick={handleSetAllPresent}>
                <CheckCircle2 size={15} /> Set Semua Hadir
              </button>
              <button className="button button-primary" onClick={handleSaveDaily}>
                <Save size={15} /> Simpan Presensi Hari Ini
              </button>
            </div>
          </div>

          {/* Date Picker Bar */}
          <div className="toolbar-card" style={{ marginBottom: '16px' }}>
            <div className="class-selector-wrap">
              <label htmlFor="daily-date">TANGGAL PRESENSI</label>
              <div className="select-with-icon">
                <CalendarDays size={16} />
                <input
                  id="daily-date"
                  type="date"
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600 }}
                />
              </div>
            </div>
            <div className="toolbar-divider" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#103f3e' }}>
                {formatLocalDate(currentDate)}
              </span>
              {isCurrentDateHoliday && (
                <span style={{ color: '#b24c3d', fontSize: '11px', fontWeight: 600 }}>
                  ⚠️ Tanggal ini tercatat sebagai: {isCurrentDateHoliday.name}
                </span>
              )}
            </div>
          </div>

          {/* Table of All Teachers for the Day */}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Kode</th>
                  <th>Nama Lengkap Guru</th>
                  <th>Status Kehadiran</th>
                  <th>Keterangan / Alasan</th>
                </tr>
              </thead>
              <tbody>
                {activeTeachers.map((teacher, index) => {
                  const entry = dailyEntries[teacher.id] ?? { status: 'HADIR', notes: '' };
                  const cfg = STATUS_CONFIG[entry.status];

                  return (
                    <tr key={teacher.id}>
                      <td style={{ width: '40px', textAlign: 'center', color: '#7a8a86' }}>{index + 1}</td>
                      <td style={{ width: '80px' }}>
                        <span className="code-pill">{teacher.code}</span>
                      </td>
                      <td>
                        <strong>{teacher.name}</strong>
                      </td>
                      <td style={{ width: '220px' }}>
                        <select
                          value={entry.status}
                          onChange={(e) =>
                            setDailyEntries({
                              ...dailyEntries,
                              [teacher.id]: { ...entry, status: e.target.value as AttendanceStatus },
                            })
                          }
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '11px',
                            border: `1px solid ${cfg.border}`,
                            background: cfg.bg,
                            color: cfg.color,
                          }}
                        >
                          <option value="HADIR">🟢 Hadir</option>
                          <option value="IZIN">🟡 Izin</option>
                          <option value="SAKIT">🔵 Sakit</option>
                          <option value="ALPA">🔴 Alpa</option>
                          <option value="DINAS_LUAR">🟣 Dinas Luar</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Catatan opsional..."
                          value={entry.notes}
                          onChange={(e) =>
                            setDailyEntries({
                              ...dailyEntries,
                              [teacher.id]: { ...entry, notes: e.target.value },
                            })
                          }
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            fontSize: '11px',
                            borderRadius: '6px',
                            border: '1px solid #dce2de',
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="button button-primary" onClick={handleSaveDaily}>
              <Save size={15} /> Simpan Presensi Hari Ini
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: INPUT ABSENSI PER BULAN (MASSAL) */}
      {activeTab === 'monthly' && (
        <div className="surface-card">
          <div className="card-heading">
            <div>
              <div className="card-eyebrow">MONTHLY BULK ASSIGNMENT</div>
              <h3>Input Presensi Massal Bulanan</h3>
            </div>
          </div>
          <p className="settings-card-intro">
            Terapkan status presensi (misal: set default Hadir, atau status Dinas Luar pada kegiatan madrasah) ke seluruh guru
            atau guru terpilih untuk rentang hari aktif dalam bulan tertentu. Hari libur nasional dan hari Minggu akan otomatis dilewati.
          </p>

          <div className="settings-form-grid" style={{ marginTop: '16px' }}>
            <div className="field-group">
              <label>Status yang Diterapkan</label>
              <select
                value={massMonthStatus}
                onChange={(e) => setMassMonthStatus(e.target.value as AttendanceStatus)}
              >
                <option value="HADIR">Hadir</option>
                <option value="DINAS_LUAR">Dinas Luar</option>
                <option value="IZIN">Izin</option>
                <option value="SAKIT">Sakit</option>
                <option value="ALPA">Alpa</option>
              </select>
            </div>

            <div className="field-group">
              <label>Target Guru</label>
              <select
                value={massMonthTarget}
                onChange={(e) => setMassMonthTarget(e.target.value as 'all' | 'selected')}
              >
                <option value="all">Terapkan ke Semua Guru Aktif ({activeTeachers.length})</option>
                <option value="selected">Pilih Guru Tertentu</option>
              </select>
            </div>

            <div className="field-group">
              <label>Mulai Tanggal</label>
              <input
                type="date"
                value={massMonthStartDate}
                onChange={(e) => setMassMonthStartDate(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>Sampai Tanggal</label>
              <input
                type="date"
                value={massMonthEndDate}
                onChange={(e) => setMassMonthEndDate(e.target.value)}
              />
            </div>
          </div>

          {massMonthTarget === 'selected' && (
            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#385c57', marginBottom: '8px', display: 'block' }}>
                PILIH GURU PENERIMA:
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '8px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid #dce2dc',
                  padding: '10px',
                  borderRadius: '8px',
                }}
              >
                {activeTeachers.map((teacher) => (
                  <label key={teacher.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px' }}>
                    <input
                      type="checkbox"
                      checked={massMonthSelectedTeachers.includes(teacher.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMassMonthSelectedTeachers([...massMonthSelectedTeachers, teacher.id]);
                        } else {
                          setMassMonthSelectedTeachers(massMonthSelectedTeachers.filter((id) => id !== teacher.id));
                        }
                      }}
                    />
                    <span>{teacher.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="button button-primary" onClick={handleSaveMassMonthly}>
              <Check size={15} /> Terapkan Presensi Bulanan
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: INPUT PER GURU */}
      {activeTab === 'teacher' && (
        <div className="surface-card">
          <div className="card-heading">
            <div>
              <div className="card-eyebrow">INDIVIDUAL TEACHER LOG</div>
              <h3>Pencatatan Presensi per Guru</h3>
            </div>
          </div>

          <div className="toolbar-card" style={{ marginBottom: '16px' }}>
            <div className="class-selector-wrap">
              <label htmlFor="teacher-picker">PILIH GURU</label>
              <div className="select-with-icon">
                <Users size={16} />
                <select
                  id="teacher-picker"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                >
                  {activeTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="toolbar-divider" />

            <div className="class-selector-wrap">
              <label htmlFor="month-picker">BULAN</label>
              <div className="select-with-icon">
                <Calendar size={16} />
                <input
                  id="month-picker"
                  type="month"
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600 }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Date Ledger */}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Hari</th>
                  <th>Status Hari Ini</th>
                  <th>Catatan</th>
                  <th>Aksi Cepat</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const [yStr, mStr] = currentMonth.split('-');
                  const year = Number(yStr);
                  const month = Number(mStr);
                  const daysInMonth = new Date(year, month, 0).getDate();
                  const rows = [];

                  for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const curDate = new Date(year, month - 1, d);
                    const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(curDate);
                    const isSunday = curDate.getDay() === 0;
                    const hol = holidays.find((h) => h.date === dateStr);
                    const record = attendanceList.find(
                      (a) => a.teacherId === selectedTeacherId && a.date === dateStr,
                    );
                    const cfg = record ? STATUS_CONFIG[record.status] : null;

                    rows.push(
                      <tr key={dateStr} style={{ background: isSunday ? '#faf7f5' : undefined }}>
                        <td>
                          <strong>{dateStr}</strong>
                        </td>
                        <td>
                          <span style={{ color: isSunday ? '#b24c3d' : '#274744', fontWeight: isSunday ? 700 : 500 }}>
                            {dayName}
                          </span>
                          {hol && (
                            <small style={{ display: 'block', color: '#b24c3d', fontWeight: 700 }}>
                              {hol.name}
                            </small>
                          )}
                        </td>
                        <td>
                          {record ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: cfg?.bg,
                                color: cfg?.color,
                                border: `1px solid ${cfg?.border}`,
                              }}
                            >
                              {cfg?.label}
                            </span>
                          ) : isSunday || hol ? (
                            <span style={{ fontSize: '11px', color: '#a0aaa5' }}>Libur</span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#a0aaa5' }}>Belum diisi</span>
                          )}
                        </td>
                        <td>
                          <small style={{ color: '#7a8a86' }}>{record?.notes || '—'}</small>
                        </td>
                        <td>
                          <button
                            className="button button-quiet"
                            style={{ padding: '4px 8px', fontSize: '10px' }}
                            onClick={() => handleToggleSingleTeacherDay(dateStr, record?.status)}
                            title="Klik untuk mengubah status bergantian"
                          >
                            <RefreshCw size={12} /> Ubah Status
                          </button>
                        </td>
                      </tr>,
                    );
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REKAP BULANAN & EKSPOR PDF */}
      {activeTab === 'recap' && (
        <div className="surface-card">
          <div className="card-heading">
            <div>
              <div className="card-eyebrow">MONTHLY RECAP & EXPORT</div>
              <h3>Rekapitulasi Presensi Bulanan</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="button button-primary"
                onClick={() => setPdfModalOpen(true)}
              >
                <Download size={15} /> Ekspor PDF Rekap Bulanan (A4)
              </button>
            </div>
          </div>

          {/* Month selector & Teacher Checkboxes */}
          <div className="toolbar-card" style={{ marginBottom: '16px' }}>
            <div className="class-selector-wrap">
              <label htmlFor="recap-month">PILIH BULAN REKAP</label>
              <div className="select-with-icon">
                <Calendar size={16} />
                <input
                  id="recap-month"
                  type="month"
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600 }}
                />
              </div>
            </div>

            <div className="toolbar-divider" />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="button button-quiet"
                style={{ fontSize: '11px', padding: '6px 10px' }}
                onClick={() => setRecapSelectedTeachers(activeTeachers.map((t) => t.id))}
              >
                Pilih Semua Guru
              </button>
              <button
                className="button button-quiet"
                style={{ fontSize: '11px', padding: '6px 10px' }}
                onClick={() => setRecapSelectedTeachers([])}
              >
                Hapus Centang
              </button>
            </div>
          </div>

          {/* Teacher Selection Strip */}
          <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fcfaf5', borderRadius: '8px', border: '1px solid #e8e2d4' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#6a7e78', marginBottom: '8px' }}>
              PILIH GURU YANG DIREKAP ({recapSelectedTeachers.length} TERPILIH):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {activeTeachers.map((teacher) => (
                <label
                  key={teacher.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    background: recapSelectedTeachers.includes(teacher.id) ? '#e9f2ee' : '#fff',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #d8e2dc',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={recapSelectedTeachers.includes(teacher.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setRecapSelectedTeachers([...recapSelectedTeachers, teacher.id]);
                      } else {
                        setRecapSelectedTeachers(recapSelectedTeachers.filter((id) => id !== teacher.id));
                      }
                    }}
                  />
                  <span>{teacher.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Recap Summary Table */}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Kode</th>
                  <th>Nama Lengkap Guru</th>
                  <th>Hadir (H)</th>
                  <th>Sakit (S)</th>
                  <th>Izin (I)</th>
                  <th>Alpa (A)</th>
                  <th>Dinas Luar (DL)</th>
                  <th>Total Hari</th>
                  <th>% Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {recapData.map((row) => (
                  <tr key={row.teacher.id}>
                    <td style={{ textAlign: 'center', color: '#7a8a86' }}>{row.no}</td>
                    <td>
                      <span className="code-pill">{row.teacher.code}</span>
                    </td>
                    <td>
                      <strong>{row.teacher.name}</strong>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#1f6952' }}>{row.hadir}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#4b7596' }}>{row.sakit}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#9c6f28' }}>{row.izin}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#b24c3d' }}>{row.alpa}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#685094' }}>{row.dinas}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.total}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '11px',
                          background: row.rate >= 85 ? '#e9f5ee' : '#fef2f0',
                          color: row.rate >= 85 ? '#1f6952' : '#b24c3d',
                        }}
                      >
                        {row.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {recapData.length === 0 && (
              <div className="empty-state">
                <Users size={28} />
                <h3>Belum ada guru yang dipilih</h3>
                <p>Pilih satu atau lebih guru pada daftar di atas untuk menampilkan rekap.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PENGATURAN HARI LIBUR */}
      {activeTab === 'holidays' && (
        <div className="surface-card">
          <div className="card-heading">
            <div>
              <div className="card-eyebrow">HOLIDAY & NON-EFFECTIVE DAYS</div>
              <h3>Pengaturan Hari Libur Madrasah</h3>
            </div>
          </div>
          <p className="settings-card-intro">
            Daftar hari libur nasional, libur cuti bersama, atau hari libur madrasah. Hari yang tercatat sebagai hari libur
            tidak dihitung sebagai alpa pada perhitungan kehadiran efektif.
          </p>

          {/* Add / Edit Holiday Form */}
          <form
            onSubmit={handleSaveHoliday}
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              background: editingHolidayId ? '#f0f7f4' : '#f8faf7',
              padding: '14px',
              borderRadius: '10px',
              border: editingHolidayId ? '1px solid #95d1c2' : '1px solid #dce4dc',
              marginBottom: '18px',
            }}
          >
            <div style={{ flex: '0 0 180px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#274744', display: 'block', marginBottom: '4px' }}>
                Tanggal Libur
              </label>
              <input
                type="date"
                required
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #c8d3cc' }}
              />
            </div>

            <div style={{ flex: '1 1 250px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#274744', display: 'block', marginBottom: '4px' }}>
                Nama Hari Libur / Keterangan
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Hari Kemerdekaan RI, Libur Semester..."
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #c8d3cc' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="button button-primary">
                {editingHolidayId ? (
                  <>
                    <Save size={15} /> Simpan Perubahan
                  </>
                ) : (
                  <>
                    <Plus size={15} /> Tambah Hari Libur
                  </>
                )}
              </button>
              {editingHolidayId && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleCancelEditHoliday}
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>

          {/* Holidays Table */}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tanggal</th>
                  <th>Hari</th>
                  <th>Nama Hari Libur</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((hol, idx) => (
                  <tr key={hol.id} style={{ background: editingHolidayId === hol.id ? '#f3fbf7' : undefined }}>
                    <td style={{ width: '50px', textAlign: 'center', color: '#7a8a86' }}>{idx + 1}</td>
                    <td style={{ width: '140px' }}>
                      <strong>{hol.date}</strong>
                    </td>
                    <td style={{ width: '120px' }}>
                      {formatLocalDate(hol.date).split(',')[0]}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#274744' }}>{hol.name}</span>
                    </td>
                    <td style={{ width: '90px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          className="icon-button table-row-action"
                          style={{ color: '#24635e' }}
                          onClick={() => handleStartEditHoliday(hol)}
                          title="Edit hari libur"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="icon-button table-row-action"
                          onClick={() => handleDeleteHoliday(hol.id)}
                          title="Hapus hari libur"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {holidays.length === 0 && (
              <div className="empty-state">
                <Clock size={28} />
                <h3>Belum ada hari libur yang tercatat</h3>
                <p>Tambahkan hari libur nasional atau cuti madrasah melalui form di atas.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Formal A4 Attendance PDF Export Modal */}
      <AttendancePdfExportModal
        state={state}
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        onNotify={onNotify}
        initialMonth={currentMonth}
      />
    </div>
  );
}
