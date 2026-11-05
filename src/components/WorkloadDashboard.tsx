import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  GraduationCap,
  Info,
  Search,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import type { AppState, Day } from '../domain/types';
import { jpToAstronomical } from '../domain/time';
import { exportScheduleTeacherPDF } from '../utils/pdfExport';

interface WorkloadDashboardProps {
  state: AppState;
  onNavigateToSchedule?: () => void;
  onNavigateToMaster?: () => void;
  onNavigateToRequirements?: () => void;
}

export function WorkloadDashboard({
  state,
  onNavigateToSchedule,
  onNavigateToMaster,
  onNavigateToRequirements: _onNavigateToRequirements,
}: WorkloadDashboardProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'jp' | 'max' | 'percentage'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const entries = useMemo(() => state.draft ?? state.activeSchedule ?? [], [state.draft, state.activeSchedule]);
  const activeTeachers = useMemo(() => state.teachers.filter((t) => t.isActive), [state.teachers]);
  const activeClasses = useMemo(() => state.classes.filter((c) => c.isActive), [state.classes]);
  const activeSubjects = useMemo(() => state.subjects.filter((s) => s.isActive), [state.subjects]);
  const activeDays = state.settings.activeDays;
  const periodMinutes = state.settings.periodMinutes ?? 40;

  // Filtered entries according to dropdown filters
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedTeacherId !== 'all' && e.teacherId !== selectedTeacherId) return false;
      if (selectedClassId !== 'all' && e.classId !== selectedClassId) return false;
      if (selectedSubjectId !== 'all' && e.subjectId !== selectedSubjectId) return false;
      return true;
    });
  }, [entries, selectedTeacherId, selectedClassId, selectedSubjectId]);

  // Statistics per teacher
  const teacherStats = useMemo(() => {
    return activeTeachers.map((teacher) => {
      const teacherEntries = filteredEntries.filter((e) => e.teacherId === teacher.id);
      const totalJP = teacherEntries.length;
      const astro = jpToAstronomical(totalJP, periodMinutes);

      // Daily distribution
      const dayDist: Record<Day, number> = {
        Senin: 0,
        Selasa: 0,
        Rabu: 0,
        Kamis: 0,
        Jumat: 0,
        Sabtu: 0,
      };
      for (const entry of teacherEntries) {
        if (dayDist[entry.day] !== undefined) {
          dayDist[entry.day] += 1;
        }
      }

      // Count sessions (continuous blocks)
      let singleBlocks = 0;
      let doubleBlocks = 0;
      let tripleBlocks = 0;

      for (const day of activeDays) {
        const daySlots = teacherEntries.filter((e) => e.day === day).sort((a, b) => a.jpNo - b.jpNo);
        let run = 1;
        for (let i = 0; i < daySlots.length; i++) {
          if (i + 1 < daySlots.length && daySlots[i + 1].jpNo === daySlots[i].jpNo + 1 && daySlots[i + 1].classId === daySlots[i].classId) {
            run += 1;
          } else {
            if (run === 1) singleBlocks += 1;
            else if (run === 2) doubleBlocks += 1;
            else if (run >= 3) tripleBlocks += 1;
            run = 1;
          }
        }
      }

      const classesTaught = [...new Set(teacherEntries.map((e) => e.classId))];
      const subjectsTaught = [...new Set(teacherEntries.map((e) => e.subjectId))];
      const isOverloaded = totalJP > teacher.maxWeeklyJP;
      const isUnderloaded = totalJP === 0;

      return {
        teacher,
        totalJP,
        astroHours: astro.hours,
        astroMinutes: astro.minutes,
        maxWeeklyJP: teacher.maxWeeklyJP,
        percentage: Math.round((totalJP / Math.max(1, teacher.maxWeeklyJP)) * 100),
        dayDist,
        singleBlocks,
        doubleBlocks,
        tripleBlocks,
        totalSessions: singleBlocks + doubleBlocks + tripleBlocks,
        classesTaught,
        subjectsTaught,
        isOverloaded,
        isUnderloaded,
      };
    });
  }, [activeTeachers, entries, periodMinutes, activeDays]);

  // Overall workspace stats
  const totalScheduledJP = useMemo(() => entries.length, [entries]);
  const totalAstroHours = useMemo(() => Math.round(((totalScheduledJP * periodMinutes) / 60) * 10) / 10, [totalScheduledJP, periodMinutes]);
  const avgJPPerTeacher = useMemo(() => {
    return activeTeachers.length > 0 ? Math.round((totalScheduledJP / activeTeachers.length) * 10) / 10 : 0;
  }, [totalScheduledJP, activeTeachers]);
  const overloadedTeachersCount = useMemo(() => teacherStats.filter((t) => t.isOverloaded).length, [teacherStats]);
  const unassignedTeachersCount = useMemo(() => teacherStats.filter((t) => t.isUnderloaded).length, [teacherStats]);

  // Filtered teachers for table view
  const displayTeachers = useMemo(() => {
    let rows = teacherStats.filter((stat) => {
      if (selectedTeacherId !== 'all' && stat.teacher.id !== selectedTeacherId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = stat.teacher.name.toLowerCase().includes(q);
        const matchesCode = stat.teacher.code.toLowerCase().includes(q);
        return matchesName || matchesCode;
      }
      return true;
    });
    rows.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'name') diff = a.teacher.name.localeCompare(b.teacher.name);
      else if (sortKey === 'jp') diff = a.totalJP - b.totalJP;
      else if (sortKey === 'max') diff = a.maxWeeklyJP - b.maxWeeklyJP;
      else if (sortKey === 'percentage') diff = a.percentage - b.percentage;
      return sortOrder === 'asc' ? diff : -diff;
    });
    return rows;
  }, [teacherStats, selectedTeacherId, searchQuery, sortKey, sortOrder]);

  const paginatedTeachers = useMemo(() => {
    if (pageSize <= 0) return displayTeachers;
    const start = (page - 1) * pageSize;
    return displayTeachers.slice(start, start + pageSize);
  }, [displayTeachers, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(displayTeachers.length / (pageSize || 1)));

  return (
    <div className="workload-dashboard-page">
      {/* Top Banner / Hero */}
      <div className="workload-hero">
        <div className="workload-hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            ANALISIS BEBAN MENGAJAR
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Statistik &amp; Distribusi Beban Guru</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5e7d83' }}>
              Distribusi jam tatap muka mingguan, konversi jam astronomis, dan pemenuhan batas kuota guru.
            </p>
          </div>
        </div>
        <div className="workload-hero-badges">
          <div className="stat-pill">
            <Clock size={15} />
            <span>1 JP = {periodMinutes} Menit Astronomis</span>
          </div>
          <div className="stat-pill">
            <CalendarDays size={15} />
            <span>{activeDays.length} Hari KBM Aktif</span>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="stat-grid">
        <div className="stat-card tone-teal">
          <div className="stat-top">
            <span>Total JP Terjadwal</span>
            <div className="stat-icon">
              <BookOpen size={17} />
            </div>
          </div>
          <div className="stat-value-row">
            <strong>{totalScheduledJP}</strong>
            <span className="stat-unit">JP</span>
          </div>
          <div className="stat-sub">Setara {totalAstroHours} jam dinding nyata</div>
          <div className="stat-accent" />
        </div>

        <div className="stat-card tone-sand">
          <div className="stat-top">
            <span>Rata-Rata per Guru</span>
            <div className="stat-icon">
              <TrendingUp size={17} />
            </div>
          </div>
          <div className="stat-value-row">
            <strong>{avgJPPerTeacher}</strong>
            <span className="stat-unit">JP / guru</span>
          </div>
          <div className="stat-sub">Dari {activeTeachers.length} guru pengampu aktif</div>
          <div className="stat-accent" />
        </div>

        <div className="stat-card tone-blue">
          <div className="stat-top">
            <span>Beban Standar (≥24 JP)</span>
            <div className="stat-icon">
              <GraduationCap size={17} />
            </div>
          </div>
          <div className="stat-value-row">
            <strong>{teacherStats.filter((t) => t.totalJP >= 24).length}</strong>
            <span className="stat-unit">/ {activeTeachers.length} guru</span>
          </div>
          <div className="stat-sub">
            {activeTeachers.length > 0
              ? `${Math.round((teacherStats.filter((t) => t.totalJP >= 24).length / activeTeachers.length) * 100)}% penuhi syarat TPG Kemenag`
              : 'Standar beban kerja guru'}
          </div>
          <div className="stat-accent" />
        </div>

        <div className={`stat-card ${overloadedTeachersCount > 0 ? 'tone-rose' : 'tone-teal'}`}>
          <div className="stat-top">
            <span>Kesesuaian Beban</span>
            <div className="stat-icon">
              {overloadedTeachersCount > 0 ? <AlertTriangle size={17} /> : <UserCheck size={17} />}
            </div>
          </div>
          <div className="stat-value-row">
            <strong>{overloadedTeachersCount === 0 ? 'Optimal' : `${overloadedTeachersCount} Overload`}</strong>
          </div>
          <div className="stat-sub">
            {unassignedTeachersCount > 0 ? `${unassignedTeachersCount} guru masih di bawah beban` : 'Seluruh guru dalam batas wajar'}
          </div>
          <div className="stat-accent" />
        </div>
      </div>

      {/* Context Notices if needed */}
      {entries.length === 0 && (
        <div className="demo-banner" style={{ background: '#fdf7eb', borderColor: '#e6c88b' }}>
          <div className="demo-banner-icon">
            <Info size={16} />
          </div>
          <div>
            <strong>Belum ada jadwal yang diterbitkan atau disimpan di draft.</strong>
            <span>Jalankan generator atau tempatkan pelajaran di Jadwal untuk melihat statistik beban aktual.</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="button button-sm button-secondary" onClick={onNavigateToMaster}>
              Data Guru
            </button>
            <button type="button" className="button button-sm button-primary" onClick={onNavigateToSchedule}>
              Buka Jadwal <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="toolbar-card" style={{ marginTop: '16px' }}>
        <div className="class-selector-wrap">
          <label htmlFor="filter-teacher">FILTER GURU</label>
          <div className="select-with-icon">
            <Users size={16} />
            <select id="filter-teacher" value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)}>
              <option value="all">Semua Guru ({activeTeachers.length})</option>
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
          <label htmlFor="filter-class">FILTER KELAS</label>
          <div className="select-with-icon">
            <GraduationCap size={16} />
            <select id="filter-class" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              <option value="all">Semua Kelas ({activeClasses.length})</option>
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="toolbar-divider" />

        <div className="class-selector-wrap">
          <label htmlFor="filter-subject">FILTER MAPEL</label>
          <div className="select-with-icon">
            <BookOpen size={16} />
            <select id="filter-subject" value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
              <option value="all">Semua Mapel ({activeSubjects.length})</option>
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="toolbar-spacer" />

        <div className="global-search" style={{ minWidth: '220px' }}>
          <Search size={15} />
          <input
            placeholder="Cari guru..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table: Teacher Workload Breakdown */}
      <div className="surface-card" style={{ marginTop: '16px' }}>
        <div className="card-heading">
          <div>
            <div className="card-eyebrow">TEACHER ALLOCATION & SESSIONS</div>
            <h3>Rincian Beban Mengajar per Guru</h3>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="status-pill status-neutral">
              Menampilkan {displayTeachers.length} dari {activeTeachers.length} Guru
            </span>
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th
                  onClick={() => {
                    if (sortKey === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortKey('name'); setSortOrder('asc'); }
                  }}
                  style={{ cursor: 'pointer' }}
                  title="Klik untuk mengurutkan nama guru"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Guru & Kode</span>
                    <ArrowUpDown size={12} style={{ opacity: sortKey === 'name' ? 1 : 0.4 }} />
                  </div>
                </th>
                <th
                  onClick={() => {
                    if (sortKey === 'jp') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortKey('jp'); setSortOrder('desc'); }
                  }}
                  style={{ cursor: 'pointer' }}
                  title="Klik untuk mengurutkan beban JP"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Beban &amp; Batas Mingguan</span>
                    <ArrowUpDown size={12} style={{ opacity: sortKey === 'jp' ? 1 : 0.4 }} />
                  </div>
                </th>
                <th
                  onClick={() => {
                    if (sortKey === 'percentage') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortKey('percentage'); setSortOrder('desc'); }
                  }}
                  style={{ cursor: 'pointer' }}
                  title="Klik untuk mengurutkan persentase kuota"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Persentase Kuota</span>
                    <ArrowUpDown size={12} style={{ opacity: sortKey === 'percentage' ? 1 : 0.4 }} />
                  </div>
                </th>
                <th>Distribusi Hari (Sen-Sab)</th>
                <th>Total Sesi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTeachers.map((stat) => {
                const isOver = stat.isOverloaded;
                return (
                  <tr key={stat.teacher.id}>
                    <td>
                      <div className="record-primary">
                        <div className="record-avatar teacher-record">
                          {stat.teacher.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}
                        </div>
                        <div>
                          <strong>{stat.teacher.name}</strong>
                          <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span className="code-pill">{stat.teacher.code}</span>
                            {stat.classesTaught.length > 0 && (
                              <small style={{ color: '#8b9b94' }}>
                                · {stat.classesTaught.length} Kelas
                              </small>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <strong style={{ fontSize: '14.5px', color: isOver ? '#b8685b' : '#173637' }}>
                            {stat.totalJP}
                          </strong>
                          <span style={{ fontSize: '11.5px', color: '#687a75' }}>/ {stat.maxWeeklyJP} JP</span>
                        </div>
                        <small style={{ color: '#687a75', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                          {stat.astroHours} Jam Efektif {stat.astroMinutes > 0 ? `(${stat.astroMinutes}m)` : ''}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div style={{ minWidth: '110px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 700, color: isOver ? '#b8685b' : '#335e58' }}>
                            {stat.percentage}%
                          </span>
                          {isOver && <span style={{ color: '#b8685b', fontSize: '10px', fontWeight: 800 }}>LEBIH</span>}
                        </div>
                        <div className="progress-track" style={{ height: '7px' }}>
                          <span
                            style={{
                              width: `${Math.min(100, stat.percentage)}%`,
                              background: isOver ? '#b8685b' : stat.percentage >= 80 ? '#387468' : '#bc945e',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                        {activeDays.map((day) => {
                          const count = stat.dayDist[day] || 0;
                          return (
                            <div
                              key={day}
                              title={`${day}: ${count} JP`}
                              style={{
                                width: '22px',
                                height: '24px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                background: count > 0 ? 'rgba(56, 116, 104, 0.12)' : 'rgba(0,0,0,0.03)',
                                border: count > 0 ? '1px solid rgba(56, 116, 104, 0.25)' : '1px solid transparent',
                              }}
                            >
                              <span style={{ fontSize: '7px', color: count > 0 ? '#275249' : '#a2aca5', fontWeight: 700 }}>
                                {day.slice(0, 1)}
                              </span>
                              <span style={{ fontSize: '9px', fontWeight: 800, color: count > 0 ? '#1b4139' : '#bbb' }}>
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#274744' }}>
                          {stat.totalSessions} sesi
                        </span>
                        <small style={{ fontSize: '9px', color: '#7a8a86' }}>
                          {stat.doubleBlocks} blok 2-JP · {stat.singleBlocks} tunggal
                        </small>
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="button button-sm button-quiet"
                        onClick={() => exportScheduleTeacherPDF(state, stat.teacher.id)}
                        title="Unduh Jadwal Guru PDF"
                      >
                        <Download size={13} /> PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {displayTeachers.length === 0 && (
            <div className="empty-state">
              <Users size={28} />
              <h3>Guru tidak ditemukan</h3>
              <p>Coba sesuaikan kata kunci pencarian atau filter yang dipilih.</p>
            </div>
          )}
        </div>

        {/* Table Pagination Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            borderTop: '1px solid #edf2ee',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '12px',
            color: '#5e756e',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d0dad4' }}
            >
              <option value={10}>10 Baris</option>
              <option value={20}>20 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={0}>Semua ({displayTeachers.length})</option>
            </select>
            <span>Total {displayTeachers.length} guru terdata</span>
          </div>

          {pageSize > 0 && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="button button-quiet"
                style={{ padding: '4px 8px' }}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Sebelumnya
              </button>
              <span>
                Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong>
              </span>
              <button
                type="button"
                className="button button-quiet"
                style={{ padding: '4px 8px' }}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fairness & Verification Explanatory Box */}
      <div className="inline-info" style={{ marginTop: '16px', padding: '12px 16px', background: '#f8faf7', borderRadius: '12px', border: '1px solid #dce4dc' }}>
        <CheckCircle2 size={16} style={{ color: '#387468', flexShrink: 0 }} />
        <div style={{ fontSize: '11px', color: '#405a54', lineHeight: 1.5 }}>
          <strong>Prinsip Verifikasi Beban Guru:</strong> Jumlah jam pelajaran (JP) mengacu pada kurikulum madrasah dan kualifikasi pendidik yang terverifikasi.
        </div>
      </div>
    </div>
  );
}
