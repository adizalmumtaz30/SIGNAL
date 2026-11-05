import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  Info,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { AppState, AttendanceRecord, AttendanceStatus, Day, Holiday } from '../domain/types';
import { AttendancePdfExportModal } from './AttendancePdfExportModal';

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
  const [dailySearch, setDailySearch] = useState('');
  const [dailyStatusFilter, setDailyStatusFilter] = useState<string>('all');
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize, setDailyPageSize] = useState<number>(10);

  // Mass Monthly Entry Working State
  const [massMonthStatus, setMassMonthStatus] = useState<AttendanceStatus>('HADIR');
  const [massMonthTarget, setMassMonthTarget] = useState<'all' | 'selected'>('all');
  const [massMonthSelectedTeachers, setMassMonthSelectedTeachers] = useState<string[]>([]);
  const [massMonthStartDate, setMassMonthStartDate] = useState(`${new Date().toISOString().slice(0, 7)}-01`);
  const [massMonthEndDate, setMassMonthEndDate] = useState(`${new Date().toISOString().slice(0, 7)}-28`);
  const [showMonthlyHelp, setShowMonthlyHelp] = useState(false);

  // Teacher Ledger Working State
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState<number>(15);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'workdays' | 'leaves'>('all');

  // Recap Working State
  const [recapSearch, setRecapSearch] = useState('');
  const [recapSortKey, setRecapSortKey] = useState<'no' | 'name' | 'rate' | 'hadir'>('no');
  const [recapSortOrder, setRecapSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleToggleRecapSort = (key: 'no' | 'name' | 'rate' | 'hadir') => {
    if (recapSortKey === key) {
      setRecapSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setRecapSortKey(key);
      setRecapSortOrder('asc');
    }
  };
  const [recapPage, setRecapPage] = useState(1);
  const [recapPageSize, setRecapPageSize] = useState<number>(10);

  // Holiday Form State
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidaySearch, setHolidaySearch] = useState('');
  const [holidayPage, setHolidayPage] = useState(1);
  const [holidayPageSize, setHolidayPageSize] = useState<number>(10);

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

    const dates: string[] = [];
    const cur = new Date(massMonthStartDate);
    const end = new Date(massMonthEndDate);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
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

  // 4. Monthly Statistics Calculation
  const [currentYearNum, currentMonthNum] = useMemo(() => {
    const [yStr, mStr] = currentMonth.split('-');
    return [Number(yStr), Number(mStr)];
  }, [currentMonth]);

  const daysInCurrentMonth = useMemo(() => {
    return new Date(currentYearNum, currentMonthNum, 0).getDate();
  }, [currentYearNum, currentMonthNum]);

  const effectiveDaysInMonth = useMemo(() => {
    let count = 0;
    const activeDays = state.settings.activeDays;
    const dayNames: Day[] = ['Minggu' as Day, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const curDate = new Date(currentYearNum, currentMonthNum - 1, d);
      const dayName = dayNames[curDate.getDay()];
      const dateStr = `${currentYearNum}-${String(currentMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isHol = holidays.some((h) => h.date === dateStr);
      if (curDate.getDay() !== 0 && activeDays.includes(dayName) && !isHol) {
        count++;
      }
    }
    return count > 0 ? count : 24;
  }, [currentYearNum, currentMonthNum, daysInCurrentMonth, holidays, state.settings.activeDays]);

  const holidaysInMonth = useMemo(() => {
    return holidays.filter((h) => h.date.startsWith(currentMonth));
  }, [holidays, currentMonth]);

  // Recap Data Calculation
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
        const rate = effectiveDaysInMonth > 0 ? Math.min(100, Math.round(((hadir + dinas) / effectiveDaysInMonth) * 100)) : 100;
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
  }, [activeTeachers, recapSelectedTeachers, attendanceList, currentMonth, effectiveDaysInMonth]);

  const overallAvgRate = useMemo(() => {
    if (recapData.length === 0) return 100;
    const sum = recapData.reduce((acc, r) => acc + r.rate, 0);
    return Math.round(sum / recapData.length);
  }, [recapData]);

  // Contextual Daily Statistics
  const dailyPresentCount = useMemo(() => {
    return activeTeachers.filter((t) => (dailyEntries[t.id]?.status ?? 'HADIR') === 'HADIR').length;
  }, [activeTeachers, dailyEntries]);

  const dailyPermitCount = useMemo(() => {
    return activeTeachers.filter((t) => ['IZIN', 'SAKIT', 'DINAS_LUAR'].includes(dailyEntries[t.id]?.status)).length;
  }, [activeTeachers, dailyEntries]);

  const dailyAbsentCount = useMemo(() => {
    return activeTeachers.filter((t) => dailyEntries[t.id]?.status === 'ALPA').length;
  }, [activeTeachers, dailyEntries]);

  const dailyAttendanceRate = useMemo(() => {
    return activeTeachers.length > 0 ? Math.round((dailyPresentCount / activeTeachers.length) * 100) : 100;
  }, [dailyPresentCount, activeTeachers]);

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
              : h,
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
  const isDateRecorded = useMemo(() => attendanceList.some((a) => a.date === currentDate), [attendanceList, currentDate]);

  // Filtered & Paginated Daily Teachers
  const filteredDailyTeachers = useMemo(() => {
    return activeTeachers.filter((t) => {
      if (dailySearch.trim()) {
        const query = dailySearch.toLowerCase();
        const matchName = t.name.toLowerCase().includes(query);
        const matchCode = t.code.toLowerCase().includes(query);
        if (!matchName && !matchCode) return false;
      }
      if (dailyStatusFilter !== 'all') {
        const entry = dailyEntries[t.id] ?? { status: 'HADIR' };
        if (entry.status !== dailyStatusFilter) return false;
      }
      return true;
    });
  }, [activeTeachers, dailySearch, dailyStatusFilter, dailyEntries]);

  const paginatedDailyTeachers = useMemo(() => {
    if (dailyPageSize <= 0) return filteredDailyTeachers;
    const start = (dailyPage - 1) * dailyPageSize;
    return filteredDailyTeachers.slice(start, start + dailyPageSize);
  }, [filteredDailyTeachers, dailyPage, dailyPageSize]);

  const totalDailyPages = Math.max(1, Math.ceil(filteredDailyTeachers.length / (dailyPageSize || 1)));

  // Filtered & Paginated Recap Rows
  const sortedRecapRows = useMemo(() => {
    let rows = [...recapData];
    if (recapSearch.trim()) {
      const q = recapSearch.toLowerCase();
      rows = rows.filter((r) => r.teacher.name.toLowerCase().includes(q) || r.teacher.code.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      let diff = 0;
      if (recapSortKey === 'no') diff = a.no - b.no;
      else if (recapSortKey === 'name') diff = a.teacher.name.localeCompare(b.teacher.name);
      else if (recapSortKey === 'rate') diff = a.rate - b.rate;
      else if (recapSortKey === 'hadir') diff = a.hadir - b.hadir;
      return recapSortOrder === 'asc' ? diff : -diff;
    });
    return rows;
  }, [recapData, recapSearch, recapSortKey, recapSortOrder]);

  const paginatedRecapRows = useMemo(() => {
    if (recapPageSize <= 0) return sortedRecapRows;
    const start = (recapPage - 1) * recapPageSize;
    return sortedRecapRows.slice(start, start + recapPageSize);
  }, [sortedRecapRows, recapPage, recapPageSize]);

  const totalRecapPages = Math.max(1, Math.ceil(sortedRecapRows.length / (recapPageSize || 1)));

  // Filtered & Paginated Holidays
  const filteredHolidays = useMemo(() => {
    if (!holidaySearch.trim()) return holidays;
    const q = holidaySearch.toLowerCase();
    return holidays.filter((h) => h.name.toLowerCase().includes(q) || h.date.includes(q));
  }, [holidays, holidaySearch]);

  const paginatedHolidays = useMemo(() => {
    if (holidayPageSize <= 0) return filteredHolidays;
    const start = (holidayPage - 1) * holidayPageSize;
    return filteredHolidays.slice(start, start + holidayPageSize);
  }, [filteredHolidays, holidayPage, holidayPageSize]);

  const totalHolidayPages = Math.max(1, Math.ceil(filteredHolidays.length / (holidayPageSize || 1)));

  return (
    <div className="attendance-screen" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* A. Header */}
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div className="eyebrow" style={{ fontSize: '10px', fontWeight: 800, color: '#38635c', letterSpacing: '0.1em' }}>
            <span className="eyebrow-line" />
            MODUL PRESENSI & KEHADIRAN GURU
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0b3435' }}>Presensi Guru</h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5b756e', lineHeight: 1.4 }}>
            Pencatatan presensi harian, massal bulanan, rekapitulasi kehadiran, dan hari libur madrasah.
          </p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setPdfModalOpen(true)}
            style={{ height: '38px', gap: '8px', fontSize: '12.5px' }}
          >
            <Download size={15} /> Ekspor PDF Rekap Bulanan (A4)
          </button>
        </div>
      </div>

      {/* B. Dynamic Data-Backed Summary Statistics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        {activeTab === 'daily' ? (
          <>
            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                GURU HADIR HARI INI
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong style={{ fontSize: '22px', color: '#1f6952', fontWeight: 800 }}>{dailyPresentCount}</strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>/ {activeTeachers.length} Guru</span>
              </div>
            </div>

            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TINGKAT KEHADIRAN
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: dailyAttendanceRate >= 90 ? '#1f6952' : dailyAttendanceRate >= 75 ? '#c98a2c' : '#b24c3d',
                  }}
                >
                  {dailyAttendanceRate}%
                </strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>Tingkat Presensi</span>
              </div>
            </div>

            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                DISPENSASI / IJIN / SAKIT
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong style={{ fontSize: '22px', color: '#bc945e', fontWeight: 800 }}>{dailyPermitCount}</strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>Pendidik Tercatat</span>
              </div>
            </div>

            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ALPA / TANPA KETERANGAN
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: dailyAbsentCount > 0 ? '#b24c3d' : '#1f6952',
                  }}
                >
                  {dailyAbsentCount}
                </strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>
                  {dailyAbsentCount === 0 ? 'Nihil (Tertib)' : 'Perlu Konfirmasi'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TOTAL GURU AKTIF
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong style={{ fontSize: '22px', color: '#173637', fontWeight: 800 }}>{activeTeachers.length}</strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>Pendidik Terdaftar</span>
              </div>
            </div>

            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                HARI EFEKTIF BULAN INI
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong style={{ fontSize: '22px', color: '#1f6952', fontWeight: 800 }}>{effectiveDaysInMonth}</strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>Hari KBM Aktif</span>
              </div>
            </div>

            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                RATA-RATA KEHADIRAN BULANAN
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: overallAvgRate >= 90 ? '#1f6952' : overallAvgRate >= 75 ? '#c98a2c' : '#b24c3d',
                  }}
                >
                  {overallAvgRate}%
                </strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>Bulan {currentMonth}</span>
              </div>
            </div>

            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                HARI LIBUR BULAN INI
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong style={{ fontSize: '22px', color: '#bc945e', fontWeight: 800 }}>{holidaysInMonth.length}</strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>Tanggal Libur Terjadwal</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* C. Sub-navigasi Tugas (Segmented Navigation) */}
      <div className="segmented-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', background: '#eef3ef', padding: '4px', borderRadius: '10px' }}>
        <button
          type="button"
          className={`view-switch-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => { setActiveTab('daily'); setDailyPage(1); }}
        >
          <CalendarDays size={14} style={{ marginRight: '6px' }} />
          Harian
        </button>
        <button
          type="button"
          className={`view-switch-btn ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          <Calendar size={14} style={{ marginRight: '6px' }} />
          Massal Bulanan
        </button>
        <button
          type="button"
          className={`view-switch-btn ${activeTab === 'teacher' ? 'active' : ''}`}
          onClick={() => { setActiveTab('teacher'); setLedgerPage(1); }}
        >
          <Users size={14} style={{ marginRight: '6px' }} />
          Per Guru
        </button>
        <button
          type="button"
          className={`view-switch-btn ${activeTab === 'recap' ? 'active' : ''}`}
          onClick={() => { setActiveTab('recap'); setRecapPage(1); }}
        >
          <UserCheck size={14} style={{ marginRight: '6px' }} />
          Rekap & PDF
        </button>
        <button
          type="button"
          className={`view-switch-btn ${activeTab === 'holidays' ? 'active' : ''}`}
          onClick={() => { setActiveTab('holidays'); setHolidayPage(1); }}
        >
          <Clock size={14} style={{ marginRight: '6px' }} />
          Hari Libur ({holidays.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INPUT MASSAL SEMUA GURU PER HARI (HARIAN)                           */}
      {/* ========================================================================= */}
      {activeTab === 'daily' && (
        <div className="surface-card" style={{ padding: '16px 20px' }}>
          <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-eyebrow" style={{ fontSize: '10px', color: '#55726b', fontWeight: 800 }}>
                PRESENSI HARIAN
              </div>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: '#103f3e', fontWeight: 700 }}>
                Pencatatan Kehadiran Guru Harian
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button type="button" className="button button-secondary" onClick={handleSetAllPresent} title="Setel status seluruh guru aktif menjadi Hadir">
                <CheckCircle2 size={14} /> Set Semua Hadir
              </button>
              <button type="button" className="button button-primary" onClick={handleSaveDaily}>
                <Save size={14} /> Simpan Presensi Hari Ini
              </button>
            </div>
          </div>

          {/* Contextual Filter & Date Toolbar */}
          <div className="toolbar-card" style={{ marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="class-selector-wrap">
              <label htmlFor="daily-date">TANGGAL PRESENSI</label>
              <div className="select-with-icon">
                <CalendarDays size={15} />
                <input
                  id="daily-date"
                  type="date"
                  value={currentDate}
                  onChange={(e) => { setCurrentDate(e.target.value); setDailyPage(1); }}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, fontSize: '12px' }}
                />
              </div>
            </div>

            <div className="toolbar-divider" />

            {/* Quick Status / Teacher Filter */}
            <div className="class-selector-wrap">
              <label htmlFor="daily-search">CARI GURU</label>
              <div className="select-with-icon" style={{ minWidth: '160px' }}>
                <Search size={14} />
                <input
                  id="daily-search"
                  type="text"
                  placeholder="Ketik nama / kode guru…"
                  value={dailySearch}
                  onChange={(e) => { setDailySearch(e.target.value); setDailyPage(1); }}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '100%' }}
                />
              </div>
            </div>

            <div className="class-selector-wrap">
              <label htmlFor="daily-filter">STATUS</label>
              <select
                id="daily-filter"
                value={dailyStatusFilter}
                onChange={(e) => { setDailyStatusFilter(e.target.value); setDailyPage(1); }}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d8e2dc', fontSize: '12px', fontWeight: 600 }}
              >
                <option value="all">Semua Status</option>
                <option value="HADIR">Hadir</option>
                <option value="DINAS_LUAR">Dinas Luar</option>
                <option value="IZIN">Izin</option>
                <option value="SAKIT">Sakit</option>
                <option value="ALPA">Alpa</option>
              </select>
            </div>

            <div className="toolbar-spacer" />

            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#103f3e' }}>
                {formatLocalDate(currentDate)}
              </span>
              {isCurrentDateHoliday ? (
                <span style={{ color: '#b24c3d', fontSize: '11px', fontWeight: 700 }}>
                  ⚠️ Libur: {isCurrentDateHoliday.name}
                </span>
              ) : (
                <span style={{ fontSize: '10.5px', color: '#5e756e' }}>
                  Menampilkan {filteredDailyTeachers.length} dari {activeTeachers.length} guru
                </span>
              )}
            </div>
          </div>

          {/* Inviting Empty State Prompt for Dates with No Saved Records */}
          {!isDateRecorded && (
            <div
              style={{
                padding: '14px 18px',
                background: '#f4fbf7',
                border: '1.5px dashed #86efac',
                borderRadius: '10px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#dcfce7',
                    color: '#15803d',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CalendarDays size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '13px', color: '#14532d', display: 'block' }}>
                    Belum ada presensi tersimpan untuk {formatLocalDate(currentDate)}
                  </strong>
                  <span style={{ fontSize: '11.5px', color: '#166534' }}>
                    Anda dapat menetapkan seluruh guru berstatus Hadir secara instan, atau sesuaikan status pendidik pada tabel di bawah lalu simpan.
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    handleSetAllPresent();
                    handleSaveDaily();
                  }}
                  style={{ height: '32px', fontSize: '11.5px', gap: '6px' }}
                >
                  <CheckCircle2 size={14} /> Tandai Semua Hadir &amp; Simpan
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="data-table-wrap" style={{ overflowX: 'auto', border: '1px solid #e1e7e3', borderRadius: '10px' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5faf7', borderBottom: '1px solid #dce5df' }}>
                  <th style={{ width: '45px', textAlign: 'center', padding: '10px' }}>No</th>
                  <th style={{ width: '85px', textAlign: 'center', padding: '10px' }}>Kode</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Nama Lengkap & NIP Pendidik</th>
                  <th style={{ width: '180px', textAlign: 'center', padding: '10px' }}>Status Kehadiran</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Keterangan / Catatan</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDailyTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#687a75' }}>
                      Tidak ada guru yang sesuai dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  paginatedDailyTeachers.map((teacher, index) => {
                    const entry = dailyEntries[teacher.id] ?? { status: 'HADIR', notes: '' };
                    const cfg = STATUS_CONFIG[entry.status];
                    const globalIdx = (dailyPage - 1) * (dailyPageSize || filteredDailyTeachers.length) + index + 1;
                    return (
                      <tr key={teacher.id} style={{ borderBottom: '1px solid #edf2ee' }}>
                        <td style={{ textAlign: 'center', color: '#7a8a86', fontSize: '11.5px' }}>{globalIdx}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#274b45' }}>{teacher.code}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ fontSize: '12.5px', color: '#123735' }}>{teacher.name}</strong>
                            <span style={{ fontSize: '10.5px', color: '#6c827d' }}>
                              {teacher.roleTitle || 'Guru Mapel'}{teacher.nip ? ` · NIP. ${teacher.nip}` : ''}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <select
                            value={entry.status}
                            onChange={(e) =>
                              setDailyEntries({
                                ...dailyEntries,
                                [teacher.id]: { ...entry, status: e.target.value as AttendanceStatus },
                              })
                            }
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '11.5px',
                              border: `1px solid ${cfg.border}`,
                              background: cfg.bg,
                              color: cfg.color,
                              cursor: 'pointer',
                              width: '100%',
                              maxWidth: '140px',
                            }}
                          >
                            <option value="HADIR">Hadir (H)</option>
                            <option value="DINAS_LUAR">Dinas Luar (DL)</option>
                            <option value="IZIN">Izin (I)</option>
                            <option value="SAKIT">Sakit (S)</option>
                            <option value="ALPA">Alpa (A)</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="Catatan opsional…"
                            value={entry.notes}
                            onChange={(e) =>
                              setDailyEntries({
                                ...dailyEntries,
                                [teacher.id]: { ...entry, notes: e.target.value },
                              })
                            }
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              fontSize: '11.5px',
                              borderRadius: '6px',
                              border: '1px solid #dce2de',
                              background: '#fff',
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
              color: '#5e756e',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Tampilkan per halaman:</span>
              <select
                value={dailyPageSize}
                onChange={(e) => { setDailyPageSize(Number(e.target.value)); setDailyPage(1); }}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d0dad4' }}
              >
                <option value={10}>10 Baris</option>
                <option value={20}>20 Baris</option>
                <option value={25}>25 Baris</option>
                <option value={0}>Semua ({filteredDailyTeachers.length})</option>
              </select>
              <span>Total {filteredDailyTeachers.length} guru</span>
            </div>

            {dailyPageSize > 0 && totalDailyPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ padding: '4px 8px' }}
                  disabled={dailyPage <= 1}
                  onClick={() => setDailyPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Sebelumnya
                </button>
                <span>
                  Halaman <strong>{dailyPage}</strong> dari <strong>{totalDailyPages}</strong>
                </span>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ padding: '4px 8px' }}
                  disabled={dailyPage >= totalDailyPages}
                  onClick={() => setDailyPage((p) => Math.min(totalDailyPages, p + 1))}
                >
                  Berikutnya <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INPUT ABSENSI PER BULAN (MASSAL BULANAN)                           */}
      {/* ========================================================================= */}
      {activeTab === 'monthly' && (
        <div className="surface-card" style={{ padding: '16px 20px' }}>
          <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-eyebrow" style={{ fontSize: '10px', color: '#55726b', fontWeight: 800 }}>
                PRESENSI MASSAL BULANAN
              </div>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: '#103f3e', fontWeight: 700 }}>
                Penerapan Status Presensi Massal dalam Rentang Tanggal
              </h3>
            </div>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => setShowMonthlyHelp(!showMonthlyHelp)}
              style={{ fontSize: '11.5px', gap: '5px' }}
            >
              <Info size={14} /> {showMonthlyHelp ? 'Sembunyikan Petunjuk' : 'Petunjuk Penggunaan'}
            </button>
          </div>

          {/* Collapsible Info Panel */}
          {showMonthlyHelp && (
            <div
              style={{
                padding: '12px 14px',
                background: '#f4faf7',
                border: '1px solid #c9e0d5',
                borderRadius: '8px',
                marginBottom: '14px',
                fontSize: '12px',
                color: '#2a544c',
                lineHeight: 1.5,
              }}
            >
              <strong>Petunjuk Operasional:</strong> Gunakan fitur ini untuk mengatur status kehadiran default (misal: setel seluruh guru <em>Hadir</em>, atau menandai <em>Dinas Luar</em> pada agenda rapat kerja madrasah) ke seluruh atau sebagian guru. Hari libur terjadwal dan hari Minggu secara otomatis dilewati dan tidak akan tertimpa.
            </div>
          )}

          {/* Form Controls */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '14px',
              background: '#fcfbf8',
              border: '1px solid #e7e4d8',
              borderRadius: '10px',
              marginBottom: '14px',
            }}
          >
            <div className="field-group">
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#31544e' }}>Status yang Diterapkan</label>
              <select
                value={massMonthStatus}
                onChange={(e) => setMassMonthStatus(e.target.value as AttendanceStatus)}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #d2ded7', fontSize: '12.5px', fontWeight: 600 }}
              >
                <option value="HADIR">Hadir (H)</option>
                <option value="DINAS_LUAR">Dinas Luar (DL)</option>
                <option value="IZIN">Izin (I)</option>
                <option value="SAKIT">Sakit (S)</option>
                <option value="ALPA">Alpa (A)</option>
              </select>
            </div>

            <div className="field-group">
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#31544e' }}>Sasaran Pendidik</label>
              <select
                value={massMonthTarget}
                onChange={(e) => setMassMonthTarget(e.target.value as 'all' | 'selected')}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #d2ded7', fontSize: '12.5px', fontWeight: 600 }}
              >
                <option value="all">Terapkan ke Seluruh Guru ({activeTeachers.length})</option>
                <option value="selected">Pilih Guru Tertentu ({massMonthSelectedTeachers.length})</option>
              </select>
            </div>

            <div className="field-group">
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#31544e' }}>Mulai Tanggal</label>
              <input
                type="date"
                value={massMonthStartDate}
                onChange={(e) => setMassMonthStartDate(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #d2ded7', fontSize: '12.5px' }}
              />
            </div>

            <div className="field-group">
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#31544e' }}>Sampai Tanggal</label>
              <input
                type="date"
                value={massMonthEndDate}
                onChange={(e) => setMassMonthEndDate(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #d2ded7', fontSize: '12.5px' }}
              />
            </div>
          </div>

          {/* Teacher Checklist when target is 'selected' */}
          {massMonthTarget === 'selected' && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#385c57' }}>
                  CENTANG GURU SASARAN ({massMonthSelectedTeachers.length} TERPILIH):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="button button-quiet"
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                    onClick={() => setMassMonthSelectedTeachers(activeTeachers.map((t) => t.id))}
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    className="button button-quiet"
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                    onClick={() => setMassMonthSelectedTeachers([])}
                  >
                    Hapus Pilihan
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '6px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid #dce2dc',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#fff',
                }}
              >
                {activeTeachers.map((teacher) => (
                  <label key={teacher.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11.5px', cursor: 'pointer' }}>
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
                    <span>{teacher.name} ({teacher.code})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              className="button button-primary"
              onClick={handleSaveMassMonthly}
              style={{ gap: '6px' }}
            >
              <Check size={14} /> Terapkan Presensi Massal
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INPUT PRESENSI PER GURU (INDIVIDUAL LEDGER)                         */}
      {/* ========================================================================= */}
      {activeTab === 'teacher' && (
        <div className="surface-card" style={{ padding: '16px 20px' }}>
          <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-eyebrow" style={{ fontSize: '10px', color: '#55726b', fontWeight: 800 }}>
                LEDGER INDIVIDUAL
              </div>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: '#103f3e', fontWeight: 700 }}>
                Pencatatan Presensi Kalender per Guru
              </h3>
            </div>
          </div>

          {/* Contextual Toolbar */}
          <div className="toolbar-card" style={{ marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="class-selector-wrap">
              <label htmlFor="teacher-picker">PILIH GURU</label>
              <div className="select-with-icon">
                <Users size={15} />
                <select
                  id="teacher-picker"
                  value={selectedTeacherId}
                  onChange={(e) => { setSelectedTeacherId(e.target.value); setLedgerPage(1); }}
                  style={{ fontSize: '12px', fontWeight: 600 }}
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
              <label htmlFor="month-picker">BULAN & TAHUN</label>
              <div className="select-with-icon">
                <Calendar size={15} />
                <input
                  id="month-picker"
                  type="month"
                  value={currentMonth}
                  onChange={(e) => { setCurrentMonth(e.target.value); setLedgerPage(1); }}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, fontSize: '12px' }}
                />
              </div>
            </div>

            <div className="class-selector-wrap">
              <label htmlFor="ledger-filter">FILTER TAMPILAN</label>
              <select
                id="ledger-filter"
                value={ledgerFilter}
                onChange={(e) => { setLedgerFilter(e.target.value as any); setLedgerPage(1); }}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d8e2dc', fontSize: '12px', fontWeight: 600 }}
              >
                <option value="all">Semua Tanggal Bulan Ini</option>
                <option value="workdays">Hanya Hari Efektif (KBM)</option>
                <option value="leaves">Hanya Hari Libur / Minggu</option>
              </select>
            </div>
          </div>

          {/* Interactive Date Ledger Table */}
          <div className="data-table-wrap" style={{ overflowX: 'auto', border: '1px solid #e1e7e3', borderRadius: '10px' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5faf7', borderBottom: '1px solid #dce5df' }}>
                  <th style={{ width: '120px', textAlign: 'left', padding: '10px' }}>Tanggal</th>
                  <th style={{ width: '110px', textAlign: 'left', padding: '10px' }}>Hari</th>
                  <th style={{ width: '150px', textAlign: 'center', padding: '10px' }}>Status Hari Ini</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Catatan</th>
                  <th style={{ width: '130px', textAlign: 'center', padding: '10px' }}>Aksi Cepat</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows = [];
                  for (let d = 1; d <= daysInCurrentMonth; d++) {
                    const dateStr = `${currentYearNum}-${String(currentMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const curDate = new Date(currentYearNum, currentMonthNum - 1, d);
                    const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(curDate);
                    const isSunday = curDate.getDay() === 0;
                    const hol = holidays.find((h) => h.date === dateStr);

                    if (ledgerFilter === 'workdays' && (isSunday || hol)) continue;
                    if (ledgerFilter === 'leaves' && (!isSunday && !hol)) continue;

                    const record = attendanceList.find(
                      (a) => a.teacherId === selectedTeacherId && a.date === dateStr,
                    );
                    const cfg = record ? STATUS_CONFIG[record.status] : null;

                    rows.push({
                      dateStr,
                      dayName,
                      isSunday,
                      hol,
                      record,
                      cfg,
                    });
                  }

                  const start = (ledgerPage - 1) * ledgerPageSize;
                  const paginatedRows = ledgerPageSize > 0 ? rows.slice(start, start + ledgerPageSize) : rows;

                  if (paginatedRows.length === 0) {
                    return (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#687a75' }}>
                          Tidak ada catatan untuk filter yang dipilih.
                        </td>
                      </tr>
                    );
                  }

                  return paginatedRows.map((item) => (
                    <tr key={item.dateStr} style={{ borderBottom: '1px solid #edf2ee', background: item.isSunday ? '#faf8f5' : undefined }}>
                      <td style={{ fontSize: '12px', fontWeight: 600, color: '#173637' }}>{item.dateStr}</td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: item.isSunday ? '#b24c3d' : '#274744', fontWeight: item.isSunday ? 700 : 500 }}>
                          {item.dayName}
                        </span>
                        {item.hol && (
                          <small style={{ display: 'block', color: '#b24c3d', fontWeight: 700 }}>
                            {item.hol.name}
                          </small>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.record ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: item.cfg?.bg,
                              color: item.cfg?.color,
                              border: `1px solid ${item.cfg?.border}`,
                            }}
                          >
                            {item.cfg?.label}
                          </span>
                        ) : item.isSunday || item.hol ? (
                          <span style={{ fontSize: '11px', color: '#97a39e', fontStyle: 'italic' }}>Libur</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#97a39e' }}>Belum diisi</span>
                        )}
                      </td>
                      <td style={{ fontSize: '11.5px', color: '#6b807b' }}>
                        {item.record?.notes || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="button button-quiet"
                          style={{ padding: '3px 8px', fontSize: '10.5px', gap: '4px' }}
                          onClick={() => handleToggleSingleTeacherDay(item.dateStr, item.record?.status)}
                          title="Klik untuk mengubah status secara berurutan"
                        >
                          <RefreshCw size={11} /> Ubah
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Ledger Pagination */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
              color: '#5e756e',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Tampilkan per halaman:</span>
              <select
                value={ledgerPageSize}
                onChange={(e) => { setLedgerPageSize(Number(e.target.value)); setLedgerPage(1); }}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d0dad4' }}
              >
                <option value={10}>10 Baris</option>
                <option value={15}>15 Baris</option>
                <option value={0}>Semua Hari ({daysInCurrentMonth})</option>
              </select>
            </div>

            {ledgerPageSize > 0 && Math.ceil(daysInCurrentMonth / ledgerPageSize) > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ padding: '4px 8px' }}
                  disabled={ledgerPage <= 1}
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Sebelumnya
                </button>
                <span>
                  Halaman <strong>{ledgerPage}</strong> dari <strong>{Math.ceil(daysInCurrentMonth / ledgerPageSize)}</strong>
                </span>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ padding: '4px 8px' }}
                  disabled={ledgerPage >= Math.ceil(daysInCurrentMonth / ledgerPageSize)}
                  onClick={() => setLedgerPage((p) => Math.min(Math.ceil(daysInCurrentMonth / ledgerPageSize), p + 1))}
                >
                  Berikutnya <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: REKAP BULANAN & EKSPOR PDF RESMI                                    */}
      {/* ========================================================================= */}
      {activeTab === 'recap' && (
        <div className="surface-card" style={{ padding: '16px 20px' }}>
          <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-eyebrow" style={{ fontSize: '10px', color: '#55726b', fontWeight: 800 }}>
                REKAPITULASI & LAPORAN RESMI
              </div>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: '#103f3e', fontWeight: 700 }}>
                Rekapitulasi Persentase Kehadiran Bulanan
              </h3>
            </div>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setPdfModalOpen(true)}
              style={{ gap: '6px' }}
            >
              <Download size={14} /> Ekspor Dokumen PDF Resmi
            </button>
          </div>

          {/* Contextual Month & Teacher Filter Toolbar */}
          <div className="toolbar-card" style={{ marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="class-selector-wrap">
              <label htmlFor="recap-month">PILIH BULAN REKAP</label>
              <div className="select-with-icon">
                <Calendar size={15} />
                <input
                  id="recap-month"
                  type="month"
                  value={currentMonth}
                  onChange={(e) => { setCurrentMonth(e.target.value); setRecapPage(1); }}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, fontSize: '12px' }}
                />
              </div>
            </div>

            <div className="toolbar-divider" />

            <div className="class-selector-wrap">
              <label htmlFor="recap-search">CARI GURU</label>
              <div className="select-with-icon" style={{ minWidth: '160px' }}>
                <Search size={14} />
                <input
                  id="recap-search"
                  type="text"
                  placeholder="Ketik nama guru…"
                  value={recapSearch}
                  onChange={(e) => { setRecapSearch(e.target.value); setRecapPage(1); }}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '100%' }}
                />
              </div>
            </div>

            <div className="toolbar-spacer" />

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                className="button button-quiet"
                style={{ fontSize: '11px', padding: '4px 8px' }}
                onClick={() => setRecapSelectedTeachers(activeTeachers.map((t) => t.id))}
              >
                Pilih Semua ({activeTeachers.length})
              </button>
              <button
                type="button"
                className="button button-quiet"
                style={{ fontSize: '11px', padding: '4px 8px' }}
                onClick={() => setRecapSelectedTeachers([])}
              >
                Hapus Pilihan
              </button>
            </div>
          </div>

          {/* Teacher Selection Strip */}
          <div style={{ marginBottom: '14px', padding: '8px 12px', background: '#fcfaf5', borderRadius: '8px', border: '1px solid #e8e2d4' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#6a7e78', marginBottom: '6px' }}>
              GURU TERPILIH UNTUK REKAP ({recapSelectedTeachers.length} DARI {activeTeachers.length}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '70px', overflowY: 'auto' }}>
              {activeTeachers.map((teacher) => (
                <label
                  key={teacher.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    background: recapSelectedTeachers.includes(teacher.id) ? '#e9f2ee' : '#fff',
                    padding: '2px 6px',
                    borderRadius: '5px',
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
          <div className="data-table-wrap" style={{ overflowX: 'auto', border: '1px solid #e1e7e3', borderRadius: '10px' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5faf7', borderBottom: '1px solid #dce5df' }}>
                  <th onClick={() => handleToggleRecapSort('no')} style={{ width: '45px', textAlign: 'center', padding: '9px', cursor: 'pointer' }} title="Klik untuk mengurutkan">No {recapSortKey === 'no' ? (recapSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                  <th style={{ width: '80px', textAlign: 'center', padding: '9px' }}>Kode</th>
                  <th onClick={() => handleToggleRecapSort('name')} style={{ textAlign: 'left', padding: '9px', cursor: 'pointer' }} title="Klik untuk mengurutkan">Nama Lengkap & NIP Pendidik {recapSortKey === 'name' ? (recapSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                  <th onClick={() => handleToggleRecapSort('hadir')} style={{ width: '70px', textAlign: 'center', padding: '9px', cursor: 'pointer' }} title="Klik untuk mengurutkan">Hadir (H) {recapSortKey === 'hadir' ? (recapSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                  <th style={{ width: '70px', textAlign: 'center', padding: '9px' }}>Dinas (DL)</th>
                  <th style={{ width: '65px', textAlign: 'center', padding: '9px' }}>Sakit (S)</th>
                  <th style={{ width: '65px', textAlign: 'center', padding: '9px' }}>Izin (I)</th>
                  <th style={{ width: '65px', textAlign: 'center', padding: '9px' }}>Alpa (A)</th>
                  <th style={{ width: '90px', textAlign: 'center', padding: '9px' }}>Total (H+DL)</th>
                  <th style={{ width: '80px', textAlign: 'center', padding: '9px' }}>Target (HE)</th>
                  <th onClick={() => handleToggleRecapSort('rate')} style={{ width: '85px', textAlign: 'center', padding: '9px', cursor: 'pointer' }} title="Klik untuk mengurutkan">% Hadir {recapSortKey === 'rate' ? (recapSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                  <th style={{ width: '120px', textAlign: 'center', padding: '9px' }}>Predikat</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecapRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '24px', color: '#687a75' }}>
                      Tidak ada data guru untuk rekapitulasi.
                    </td>
                  </tr>
                ) : (
                  paginatedRecapRows.map((r) => {
                    const totalPresent = r.hadir + r.dinas;
                    let predikat = 'Sangat Baik';
                    let predikatColor = '#1f6952';
                    if (r.rate < 75) {
                      predikat = 'Perlu Pembinaan';
                      predikatColor = '#b24c3d';
                    } else if (r.rate < 85) {
                      predikat = 'Cukup';
                      predikatColor = '#9c6f28';
                    } else if (r.rate < 95) {
                      predikat = 'Baik';
                      predikatColor = '#2f7771';
                    }
                    return (
                      <tr key={r.teacher.id} style={{ borderBottom: '1px solid #edf2ee' }}>
                        <td style={{ textAlign: 'center', color: '#7a8a86', fontSize: '11px' }}>{r.no}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#274b45' }}>{r.teacher.code}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ fontSize: '12px', color: '#123735' }}>{r.teacher.name}</strong>
                            <span style={{ fontSize: '10px', color: '#6c827d' }}>
                              {r.teacher.roleTitle || 'Guru Mapel'}{r.teacher.nip ? ` · NIP. ${r.teacher.nip}` : ''}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#1f6952' }}>{r.hadir}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#685094' }}>{r.dinas}</td>
                        <td style={{ textAlign: 'center', color: '#4b7596' }}>{r.sakit}</td>
                        <td style={{ textAlign: 'center', color: '#9c6f28' }}>{r.izin}</td>
                        <td style={{ textAlign: 'center', color: r.alpa > 0 ? '#b24c3d' : '#8a9b95', fontWeight: r.alpa > 0 ? 700 : 400 }}>
                          {r.alpa}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#0b3435' }}>{totalPresent}</td>
                        <td style={{ textAlign: 'center', color: '#687a75' }}>{effectiveDaysInMonth}</td>
                        <td style={{ textAlign: 'center' }}>
                          <strong style={{ fontSize: '12px', color: predikatColor }}>{r.rate}%</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: predikatColor }}>{predikat}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Recap Pagination Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
              color: '#5e756e',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Tampilkan per halaman:</span>
              <select
                value={recapPageSize}
                onChange={(e) => { setRecapPageSize(Number(e.target.value)); setRecapPage(1); }}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d0dad4' }}
              >
                <option value={10}>10 Baris</option>
                <option value={20}>20 Baris</option>
                <option value={25}>25 Baris</option>
                <option value={0}>Semua ({sortedRecapRows.length})</option>
              </select>
              <span>Total {sortedRecapRows.length} guru</span>
            </div>

            {recapPageSize > 0 && totalRecapPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ padding: '4px 8px' }}
                  disabled={recapPage <= 1}
                  onClick={() => setRecapPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Sebelumnya
                </button>
                <span>
                  Halaman <strong>{recapPage}</strong> dari <strong>{totalRecapPages}</strong>
                </span>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ padding: '4px 8px' }}
                  disabled={recapPage >= totalRecapPages}
                  onClick={() => setRecapPage((p) => Math.min(totalRecapPages, p + 1))}
                >
                  Berikutnya <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PENGATURAN HARI LIBUR & KALENDER MADRASAH                           */}
      {/* ========================================================================= */}
      {activeTab === 'holidays' && (
        <div className="surface-card" style={{ padding: '16px 20px' }}>
          <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-eyebrow" style={{ fontSize: '10px', color: '#55726b', fontWeight: 800 }}>
                KALENDER LIBUR MADRASAH
              </div>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: '#103f3e', fontWeight: 700 }}>
                Daftar Hari Libur Nasional & Khusus Madrasah
              </h3>
            </div>
          </div>

          {/* Form Tambah/Edit Hari Libur */}
          <form
            onSubmit={handleSaveHoliday}
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              padding: '12px 14px',
              background: '#f9fcfa',
              border: '1px solid #d8e5df',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#31544e' }}>Tanggal Libur</label>
              <input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #c9d8d1', fontSize: '12px' }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#31544e' }}>Nama Hari Libur / Keterangan</label>
              <input
                type="text"
                placeholder="Contoh: Libur Awal Ramadhan, Hari Santri…"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #c9d8d1', fontSize: '12px' }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="submit" className="button button-primary" style={{ gap: '6px', height: '34px' }}>
                {editingHolidayId ? <Save size={13} /> : <Plus size={13} />}
                {editingHolidayId ? 'Simpan Perubahan' : 'Tambah Hari Libur'}
              </button>
              {editingHolidayId && (
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={handleCancelEditHoliday}
                  style={{ height: '34px' }}
                >
                  <X size={13} /> Batal
                </button>
              )}
            </div>
          </form>

          {/* Holiday Search */}
          <div className="toolbar-card" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div className="class-selector-wrap" style={{ flex: 1, maxWidth: '280px' }}>
              <label htmlFor="hol-search">CARI HARI LIBUR</label>
              <div className="select-with-icon">
                <Search size={14} />
                <input
                  id="hol-search"
                  type="text"
                  placeholder="Ketik nama atau tanggal libur…"
                  value={holidaySearch}
                  onChange={(e) => { setHolidaySearch(e.target.value); setHolidayPage(1); }}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '100%' }}
                />
              </div>
            </div>
            <div className="toolbar-spacer" />
            <span style={{ fontSize: '11.5px', color: '#687a75' }}>
              Total {filteredHolidays.length} hari libur terdaftar
            </span>
          </div>

          {/* Holiday Table */}
          <div className="data-table-wrap" style={{ overflowX: 'auto', border: '1px solid #e1e7e3', borderRadius: '10px' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5faf7', borderBottom: '1px solid #dce5df' }}>
                  <th style={{ width: '45px', textAlign: 'center', padding: '9px' }}>No</th>
                  <th style={{ width: '130px', textAlign: 'left', padding: '9px' }}>Tanggal</th>
                  <th style={{ textAlign: 'left', padding: '9px' }}>Nama Hari Libur</th>
                  <th style={{ width: '100px', textAlign: 'center', padding: '9px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#687a75' }}>
                      Belum ada hari libur yang terdaftar.
                    </td>
                  </tr>
                ) : (
                  paginatedHolidays.map((hol, idx) => {
                    const globalIdx = (holidayPage - 1) * (holidayPageSize || filteredHolidays.length) + idx + 1;
                    return (
                      <tr key={hol.id} style={{ borderBottom: '1px solid #edf2ee' }}>
                        <td style={{ textAlign: 'center', color: '#7a8a86', fontSize: '11px' }}>{globalIdx}</td>
                        <td style={{ fontSize: '12px', fontWeight: 600, color: '#103f3e' }}>{hol.date}</td>
                        <td style={{ fontSize: '12px', color: '#274744', fontWeight: 600 }}>{hol.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => handleStartEditHoliday(hol)}
                              title="Edit hari libur"
                              style={{ width: '28px', height: '28px' }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => handleDeleteHoliday(hol.id)}
                              title="Hapus hari libur"
                              style={{ width: '28px', height: '28px', color: '#b24c3d' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Holiday Pagination */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
              color: '#5e756e',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Tampilkan:</span>
              <select
                value={holidayPageSize}
                onChange={(e) => { setHolidayPageSize(Number(e.target.value)); setHolidayPage(1); }}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d0dad4' }}
              >
                <option value={10}>10 Baris</option>
                <option value={20}>20 Baris</option>
                <option value={0}>Semua ({filteredHolidays.length})</option>
              </select>
            </div>

            {holidayPageSize > 0 && totalHolidayPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ padding: '4px 8px' }}
                  disabled={holidayPage <= 1}
                  onClick={() => setHolidayPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Sebelumnya
                </button>
                <span>
                  Halaman <strong>{holidayPage}</strong> dari <strong>{totalHolidayPages}</strong>
                </span>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ padding: '4px 8px' }}
                  disabled={holidayPage >= totalHolidayPages}
                  onClick={() => setHolidayPage((p) => Math.min(totalHolidayPages, p + 1))}
                >
                  Berikutnya <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ekspor PDF Modal */}
      {pdfModalOpen && (
        <AttendancePdfExportModal
          state={state}
          isOpen={pdfModalOpen}
          initialMonth={currentMonth}
          onClose={() => setPdfModalOpen(false)}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}
