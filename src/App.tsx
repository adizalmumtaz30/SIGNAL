import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, Archive, ArrowDownToLine, ArrowRight, ArrowUpRight,
  BarChart3, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown,
  ChevronRight, CircleHelp, Clock3, Command, Download, FileCheck2, FileSpreadsheet, Filter,
  GraduationCap, History, LayoutDashboard, LoaderCircle, LockKeyhole, Menu, MoreHorizontal,
  Plus, RefreshCw, Save, Search, Settings2, ShieldCheck, Sparkles, SquarePen, Trash2,
  Upload, Users, WandSparkles, X, XCircle, type LucideIcon,
} from 'lucide-react';
import type { AppState, Day, GeneratorStatus, Requirement, ScheduleVersion, Subject, Teacher, ValidationIssue } from './domain/types';
import { DAYS } from './domain/types';
import { buildTimeSlots, teachingPeriodsForDay } from './domain/time';
import { createDemoState } from './domain/seed';
import { generateSchedule } from './domain/generator';
import { buildScheduleFingerprint, validateMasterData, validateSchedule } from './domain/validator';
import { exportAppState, loadAppState, parseBackupFile, saveAppState } from './storage/db';

const navItems: Array<{ id: ScreenId; label: string; icon: LucideIcon; section?: string }> = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard, section: 'WORKSPACE' },
  { id: 'schedule', label: 'Jadwal Pelajaran', icon: CalendarDays },
  { id: 'generator', label: 'Generator', icon: WandSparkles },
  { id: 'master', label: 'Data Master', icon: DatabaseIcon },
  { id: 'requirements', label: 'Kebutuhan & Alokasi', icon: BookOpen },
  { id: 'validation', label: 'Validasi & Konflik', icon: ShieldCheck, section: 'GOVERNANCE' },
  { id: 'history', label: 'Riwayat Versi', icon: History },
  { id: 'backup', label: 'Ekspor & Backup', icon: Archive, section: 'DATA CONTROL' },
  { id: 'settings', label: 'Pengaturan', icon: Settings2 },
];

function DatabaseIcon(props: React.ComponentProps<typeof BookOpen>) {
  return <Activity {...props} />;
}

type ScreenId = 'overview' | 'schedule' | 'generator' | 'master' | 'requirements' | 'validation' | 'history' | 'backup' | 'settings';
type MasterTab = 'classes' | 'teachers' | 'subjects';
type AddType = 'class' | 'teacher' | 'subject' | null;
interface EditSlotContext { classId: string; day: Day; jpNo: number }
interface ToastData { message: string; kind: 'success' | 'warning' | 'error' | 'info' }

const emptyMasterForm = { name: '', level: 'VII', code: '', maxWeeklyJP: '24', selectedSubjectIds: [] as string[], color: '#2f7771' };
const emptyRequirementForm = { classId: '', subjectId: '', teacherId: '', requiredJP: '4' };

function titleForScreen(screen: ScreenId) {
  const titles: Record<ScreenId, string> = {
    overview: 'Ringkasan workspace', schedule: 'Jadwal pelajaran', generator: 'Schedule generator', master: 'Data master',
    requirements: 'Kebutuhan & alokasi JP', validation: 'Validasi & konflik', history: 'Riwayat versi', backup: 'Ekspor & backup', settings: 'Pengaturan workspace',
  };
  return titles[screen];
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
function formatShortDate(dateString: string) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
}
function getEntry(state: AppState, classId: string, day: Day, jpNo: number) {
  const entries = state.draft ?? state.activeSchedule ?? [];
  return entries.find((entry) => entry.classId === classId && entry.day === day && entry.jpNo === jpNo);
}
function getSubject(state: AppState, id: string) { return state.subjects.find((subject) => subject.id === id); }
function getTeacher(state: AppState, id: string) { return state.teachers.find((teacher) => teacher.id === id); }
function getClass(state: AppState, id: string) { return state.classes.find((schoolClass) => schoolClass.id === id); }
function downloadTextFile(text: string, fileName: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }

export default function App() {
  const [workspace, setWorkspace] = useState<AppState | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<ScreenId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [masterTab, setMasterTab] = useState<MasterTab>('classes');
  const [addType, setAddType] = useState<AddType>(null);
  const [masterForm, setMasterForm] = useState(emptyMasterForm);
  const [masterSearch, setMasterSearch] = useState('');
  const [reqFormOpen, setReqFormOpen] = useState(false);
  const [reqForm, setReqForm] = useState(emptyRequirementForm);
  const [editingSlot, setEditingSlot] = useState<EditSlotContext | null>(null);
  const [editingSubject, setEditingSubject] = useState('');
  const [editingTeacher, setEditingTeacher] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratorResult, setLastGeneratorResult] = useState<{ status: GeneratorStatus; message: string; nodes: number } | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadAppState().then((loaded) => {
      if (!mounted) return;
      setWorkspace(loaded);
      setSelectedClass(loaded.classes.find((item) => item.isActive)?.id ?? '');
      setReqForm((prev) => ({ ...prev, classId: loaded.classes.find((item) => item.isActive)?.id ?? '', subjectId: loaded.subjects[0]?.id ?? '', teacherId: loaded.teachers[0]?.id ?? '' }));
      setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready || !workspace) return;
    saveAppState(workspace).catch((error) => {
      console.error('Could not persist SIGNAL data:', error);
      setToast({ message: 'Penyimpanan browser tidak tersedia. Segera ekspor backup sebelum menutup halaman.', kind: 'warning' });
    });
  }, [workspace, ready]);

  const notify = useCallback((message: string, kind: ToastData['kind'] = 'success') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 4400);
  }, []);

  const updateWorkspace = useCallback((updater: (current: AppState) => AppState, markCustom = false) => {
    setWorkspace((current) => {
      if (!current) return current;
      const updated = updater(current);
      return markCustom ? { ...updated, dataMode: 'custom' } : updated;
    });
  }, []);

  const currentEntries = workspace?.draft ?? workspace?.activeSchedule ?? [];
  const report = useMemo(() => workspace ? validateSchedule(workspace, currentEntries, { strictCoverage: true, includeSoftWarnings: true }) : null, [workspace, currentEntries]);
  const masterIssues = useMemo(() => workspace ? validateMasterData(workspace) : [], [workspace]);
  const activeClassCount = workspace?.classes.filter((item) => item.isActive).length ?? 0;
  const occupiedSlots = currentEntries.length;
  const totalWeeklyCapacity = workspace ? workspace.settings.activeDays.reduce((sum, day) => sum + teachingPeriodsForDay(workspace.slots, day).length, 0) * activeClassCount : 0;
  const subjectCounts = workspace?.subjects.filter((item) => item.isActive).length ?? 0;
  const activeTeachersCount = workspace?.teachers.filter((item) => item.isActive).length ?? 0;
  const readiness = workspace && activeClassCount > 0 && activeTeachersCount > 0 && subjectCounts > 0 && workspace.requirements.length > 0
    ? Math.max(0, Math.min(100, Math.round(100 - masterIssues.filter((item) => item.severity === 'error').length * 12 - (report?.hardErrorCount ?? 0) * 2))) : 0;

  const navigate = (next: ScreenId) => {
    setScreen(next); setSidebarOpen(false); setAddType(null); setReqFormOpen(false);
  };

  const setPeriodConfig = (changes: Partial<AppState['settings']>) => {
    updateWorkspace((current) => {
      const settings = { ...current.settings, ...changes };
      return { ...current, settings, slots: buildTimeSlots(settings) };
    }, true);
    setSettingsSaved(false);
  };

  const handleGenerate = () => {
    if (!workspace) return;
    setIsGenerating(true);
    setLastGeneratorResult({ status: 'RUNNING', message: 'Menyiapkan constraint dan mencari susunan kandidat…', nodes: 0 });
    window.setTimeout(() => {
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xffff)) >>> 0;
      const result = generateSchedule(workspace, seed);
      setLastGeneratorResult({ status: result.status, message: result.message, nodes: result.nodes });
      setIsGenerating(false);
      if (result.status === 'SUCCESS' && result.candidate) {
        updateWorkspace((current) => ({
          ...current,
          candidates: [result.candidate!, ...current.candidates.filter((item) => item.seed !== result.candidate!.seed)].slice(0, 5),
          draft: result.candidate!.entries,
          dataMode: 'custom',
        }));
        notify('Kandidat terbentuk dan lolos seluruh hard constraint.', 'success');
        setScreen('generator');
      } else {
        notify(result.message, result.status === 'INVALID_INPUT' ? 'warning' : 'error');
      }
    }, 80);
  };

  const chooseCandidate = (candidateId: string) => {
    if (!workspace) return;
    const candidate = workspace.candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    const check = validateSchedule(workspace, candidate.entries, { strictCoverage: true, includeSoftWarnings: true });
    if (!check.valid) { notify('Kandidat tidak lolos validasi terbaru; tidak diterapkan.', 'error'); return; }
    updateWorkspace((current) => ({ ...current, draft: candidate.entries, dataMode: 'custom' }));
    notify('Kandidat diterapkan sebagai draft. Jadwal aktif belum berubah.', 'success');
    setScreen('schedule');
  };

  const openSlotEditor = (classId: string, day: Day, jpNo: number) => {
    if (!workspace) return;
    const entry = getEntry(workspace, classId, day, jpNo);
    setEditingSlot({ classId, day, jpNo });
    setEditingSubject(entry?.subjectId ?? '');
    setEditingTeacher(entry?.teacherId ?? '');
  };

  const saveSlotEditor = (event: FormEvent) => {
    event.preventDefault();
    if (!workspace || !editingSlot) return;
    const { classId, day, jpNo } = editingSlot;
    updateWorkspace((current) => {
      const previous = current.draft ?? current.activeSchedule ?? [];
      const without = previous.filter((entry) => !(entry.classId === classId && entry.day === day && entry.jpNo === jpNo));
      const next = editingSubject && editingTeacher ? [...without, {
        id: `MAN-${Date.now().toString(36)}`, classId, day, jpNo, subjectId: editingSubject, teacherId: editingTeacher,
      }] : without;
      return { ...current, draft: next, dataMode: 'custom' };
    }, true);
    setEditingSlot(null);
    notify('Perubahan disimpan sebagai draft. Jalankan validasi sebelum menerbitkan.', 'info');
  };

  const publishDraft = () => {
    if (!workspace) return;
    const entries = workspace.draft ?? workspace.activeSchedule ?? [];
    const check = validateSchedule(workspace, entries, { strictCoverage: true, includeSoftWarnings: true });
    if (!check.valid) {
      notify(`Publikasi diblokir: ${check.hardErrorCount} pelanggaran wajib masih ditemukan.`, 'error');
      setScreen('validation');
      return;
    }
    const nextVersion = (workspace.history[0]?.version ?? 0) + 1;
    const version: ScheduleVersion = {
      id: `VER-${Date.now().toString(36)}`,
      version: nextVersion,
      createdAt: new Date().toISOString(),
      label: `Jadwal ${workspace.settings.academicYear} · ${workspace.settings.semester} · v${nextVersion}`,
      entryCount: entries.length,
      entries: entries.map((entry) => ({ ...entry })),
      fingerprint: buildScheduleFingerprint(entries),
      validatorVersion: 'SIGNAL-validator/1.0.0',
    };
    updateWorkspace((current) => ({ ...current, activeSchedule: entries.map((entry) => ({ ...entry })), draft: null, history: [version, ...current.history] }));
    notify(`Jadwal diterbitkan sebagai versi ${nextVersion}. Snapshot tersimpan di browser ini.`, 'success');
    setScreen('history');
  };

  const restoreVersion = (version: ScheduleVersion) => {
    if (!workspace) return;
    updateWorkspace((current) => ({ ...current, draft: version.entries.map((entry) => ({ ...entry })), dataMode: 'custom' }));
    const check = validateSchedule(workspace, version.entries, { strictCoverage: true, includeSoftWarnings: false });
    notify(check.valid ? `Versi ${version.version} dipulihkan sebagai draft.` : `Versi ${version.version} dimuat ke draft, tetapi perlu validasi ulang.`, check.valid ? 'success' : 'warning');
    setScreen('schedule');
  };

  const saveMasterForm = (event: FormEvent) => {
    event.preventDefault();
    if (!workspace || !addType) return;
    if (!masterForm.name.trim()) { notify('Nama tidak boleh kosong.', 'warning'); return; }
    if (addType === 'class') {
      const name = masterForm.name.trim();
      if (workspace.classes.some((item) => item.name.toLowerCase() === name.toLowerCase())) { notify('Nama kelas tersebut sudah ada.', 'warning'); return; }
      const newClass = { id: `CLS-${Date.now().toString(36)}`, name, level: masterForm.level, isActive: true };
      updateWorkspace((current) => ({ ...current, classes: [...current.classes, newClass] }), true);
      setSelectedClass(newClass.id);
      notify(`Kelas ${name} ditambahkan.`);
    } else if (addType === 'teacher') {
      if (!masterForm.selectedSubjectIds.length) { notify('Pilih setidaknya satu kualifikasi mapel.', 'warning'); return; }
      const teacher: Teacher = { id: `TCH-${Date.now().toString(36)}`, code: masterForm.code.trim() || `T-${workspace.teachers.length + 1}`, name: masterForm.name.trim(), subjectIds: masterForm.selectedSubjectIds, maxWeeklyJP: Math.max(1, Number(masterForm.maxWeeklyJP) || 24), isActive: true };
      updateWorkspace((current) => ({ ...current, teachers: [...current.teachers, teacher] }), true);
      notify(`Guru ${teacher.name} ditambahkan.`);
    } else {
      const name = masterForm.name.trim();
      if (workspace.subjects.some((item) => item.name.toLowerCase() === name.toLowerCase())) { notify('Nama mapel tersebut sudah ada.', 'warning'); return; }
      const subject: Subject = { id: `SUB-${Date.now().toString(36)}`, code: masterForm.code.trim() || `MAP-${workspace.subjects.length + 1}`, name, color: masterForm.color, isActive: true };
      updateWorkspace((current) => ({ ...current, subjects: [...current.subjects, subject] }), true);
      notify(`Mapel ${name} ditambahkan.`);
    }
    setAddType(null); setMasterForm(emptyMasterForm);
  };

  const deleteMaster = (kind: MasterTab, id: string) => {
    if (!workspace) return;
    if (!window.confirm('Hapus item ini? Penempatan atau alokasi terkait juga akan dihapus.')) return;
    updateWorkspace((current) => {
      if (kind === 'classes') {
        return { ...current, classes: current.classes.filter((item) => item.id !== id), requirements: current.requirements.filter((item) => item.classId !== id), draft: (current.draft ?? []).filter((item) => item.classId !== id), activeSchedule: (current.activeSchedule ?? []).filter((item) => item.classId !== id) };
      }
      if (kind === 'teachers') {
        return { ...current, teachers: current.teachers.filter((item) => item.id !== id), requirements: current.requirements.filter((item) => item.teacherId !== id), draft: (current.draft ?? []).filter((item) => item.teacherId !== id), activeSchedule: (current.activeSchedule ?? []).filter((item) => item.teacherId !== id) };
      }
      return { ...current, subjects: current.subjects.filter((item) => item.id !== id), teachers: current.teachers.map((item) => ({ ...item, subjectIds: item.subjectIds.filter((subjectId) => subjectId !== id) })), requirements: current.requirements.filter((item) => item.subjectId !== id), draft: (current.draft ?? []).filter((item) => item.subjectId !== id), activeSchedule: (current.activeSchedule ?? []).filter((item) => item.subjectId !== id) };
    }, true);
    notify('Data dan referensi terkait telah diperbarui.', 'info');
  };

  const saveRequirement = (event: FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    const requiredJP = Number(reqForm.requiredJP);
    if (!reqForm.classId || !reqForm.subjectId || !reqForm.teacherId || !Number.isInteger(requiredJP) || requiredJP < 1) {
      notify('Kelas, mapel, guru dan alokasi JP wajib diisi dengan benar.', 'warning'); return;
    }
    const teacher = workspace.teachers.find((item) => item.id === reqForm.teacherId);
    if (!teacher?.subjectIds.includes(reqForm.subjectId)) { notify('Guru belum mempunyai kualifikasi untuk mapel ini. Perbarui data kualifikasi guru terlebih dahulu.', 'warning'); return; }
    updateWorkspace((current) => {
      const existing = current.requirements.find((item) => item.classId === reqForm.classId && item.subjectId === reqForm.subjectId && item.teacherId === reqForm.teacherId);
      const requirements = existing
        ? current.requirements.map((item) => item.id === existing.id ? { ...item, requiredJP } : item)
        : [...current.requirements, { id: `REQ-${Date.now().toString(36)}`, classId: reqForm.classId, subjectId: reqForm.subjectId, teacherId: reqForm.teacherId, requiredJP }];
      return { ...current, requirements, draft: null };
    }, true);
    setReqFormOpen(false);
    notify('Kebutuhan dan alokasi JP tersimpan. Kandidat lama perlu dibuat ulang.', 'success');
  };

  const deleteRequirement = (requirement: Requirement) => {
    if (!workspace) return;
    updateWorkspace((current) => ({ ...current, requirements: current.requirements.filter((item) => item.id !== requirement.id), draft: null }), true);
    notify('Alokasi dihapus. Buat ulang jadwal agar sesuai data terbaru.', 'info');
  };

  const backupNow = async () => {
    if (!workspace) return;
    try {
      await exportAppState(workspace);
      updateWorkspace((current) => ({ ...current, lastBackupAt: new Date().toISOString() }));
      notify('File backup JSON dibuat. Simpan di lokasi yang aman.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Backup gagal dibuat.', 'error');
    }
  };

  const importBackup = async (file?: File) => {
    if (!workspace || !file) return;
    try {
      const restored = await parseBackupFile(file);
      if (!window.confirm(`Impor backup ini? Data lokal saat ini akan diganti. Ditemukan ${restored.classes.length} kelas, ${restored.teachers.length} guru, dan ${restored.subjects.length} mapel.`)) return;
      const check = validateMasterData(restored);
      const fatal = check.filter((item) => item.severity === 'error');
      if (fatal.length) { notify(`Backup tidak diterapkan: ${fatal[0].title}.`, 'error'); return; }
      setWorkspace({ ...restored, dataMode: 'custom' });
      notify('Backup berhasil dipulihkan ke browser ini.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'File backup tidak dapat dibaca.', 'error');
    }
  };

  const exportScheduleCSV = () => {
    if (!workspace) return;
    const rows = [['Kelas', 'Hari', 'JP KBM', 'Jam Mulai', 'Jam Selesai', 'Mata Pelajaran', 'Guru']];
    for (const entry of currentEntries) {
      const slot = workspace.slots.find((item) => item.day === entry.day && item.kind === 'TEACHING' && item.jpNo === entry.jpNo);
      rows.push([
        getClass(workspace, entry.classId)?.name ?? entry.classId, entry.day, String(entry.jpNo), slot?.start ?? '', slot?.end ?? '',
        getSubject(workspace, entry.subjectId)?.name ?? entry.subjectId, getTeacher(workspace, entry.teacherId)?.name ?? entry.teacherId,
      ]);
    }
    downloadTextFile(rows.map((row) => row.map((cell) => csvCell(cell)).join(',')).join('\r\n'), `SIGNAL-jadwal-${workspace.settings.academicYear.replace('/', '-')}.csv`);
    notify('CSV jadwal berhasil disiapkan.', 'success');
  };

  const exportJSONSchedule = () => {
    if (!workspace) return;
    const content = JSON.stringify({ format: 'SIGNAL-SCHEDULE', exportedAt: new Date().toISOString(), settings: workspace.settings, classes: workspace.classes, teachers: workspace.teachers, subjects: workspace.subjects, entries: currentEntries, validation: report }, null, 2);
    downloadTextFile(content, `SIGNAL-jadwal-${workspace.settings.academicYear.replace('/', '-')}.json`, 'application/json');
    notify('Ekspor jadwal JSON siap.', 'success');
  };

  const resetWorkspace = () => {
    if (!window.confirm('Reset data browser ke dataset demo? Semua perubahan lokal yang belum dibackup akan hilang.')) return;
    const fresh = createDemoState();
    setWorkspace(fresh); setSelectedClass(fresh.classes[0]?.id ?? ''); setScreen('overview');
    notify('Workspace dikembalikan ke dataset demo.', 'success');
  };

  if (!workspace || !ready) return <LoadingScreen />;

  const currentTitle = titleForScreen(screen);
  const selectedClassObj = getClass(workspace, selectedClass) ?? workspace.classes[0];

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${sidebarOpen ? 'is-visible' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span>S</span><i /></div>
          <div className="brand-text"><strong>SIGNAL</strong><span>ACADEMIC STUDIO</span></div>
          <button className="icon-button sidebar-close" aria-label="Tutup menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <div className="workspace-chip"><div className="workspace-seal"><GraduationCap size={18} /></div><div><small>WORKSPACE</small><strong>{workspace.settings.academicYear}</strong></div><ChevronDown size={14} /></div>
        <nav className="side-nav" aria-label="Navigasi utama">
          {navItems.map((item) => (
            <div key={item.id}>
              {item.section && <div className="nav-section-label">{item.section}</div>}
              <button className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)} aria-current={screen === item.id ? 'page' : undefined}>
                <item.icon size={18} strokeWidth={screen === item.id ? 2.2 : 1.8} /><span>{item.label}</span>
                {item.id === 'validation' && report && report.hardErrorCount > 0 && <span className="nav-count">{report.hardErrorCount}</span>}
                {item.id === 'schedule' && workspace.draft && <span className="nav-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-bottom-card">
          <div className="sidebar-orbit orbit-one" /><div className="sidebar-orbit orbit-two" />
          <div className="sidebar-bottom-icon"><Sparkles size={17} /></div>
          <div className="sidebar-bottom-kicker">SIGNAL INTELLIGENCE</div>
          <strong>Thoughtful schedules.<br />Confident decisions.</strong>
          <span>Validator deterministik · local-first</span>
          <button onClick={() => navigate('settings')}>Lihat pengaturan <ArrowRight size={14} /></button>
        </div>
        <div className="sidebar-profile">
          <div className="profile-avatar">OP</div><div className="profile-copy"><strong>Operator</strong><span>Workspace owner</span></div><MoreHorizontal size={18} className="profile-more" />
        </div>
        <div className="sidebar-footnote"><span className="tiny-status-dot" /> LOCAL WORKSPACE <span>·</span> v1.0.0</div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-trigger" aria-label="Buka menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{currentTitle}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="global-search"><Search size={16} /><input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setMasterSearch(globalSearch); navigate('master'); } }} placeholder="Cari di workspace…" /><kbd><Command size={10} /> K</kbd></div>
            <button className="icon-button notification-button" aria-label="Status sistem" onClick={() => navigate('validation')}><Bell size={18} /><span className={report?.hardErrorCount ? 'notification-dot danger' : 'notification-dot'} /></button>
            <div className="topbar-divider" />
            <button className="topbar-profile" onClick={() => navigate('settings')}><div className="profile-avatar small-avatar">OP</div><div className="topbar-profile-copy"><strong>Operator</strong><span>Administrator</span></div><ChevronDown size={14} /></button>
          </div>
        </header>
        <div className="content-scroll">
          <div className="page-frame">
            {workspace.dataMode === 'demo' && <div className="demo-banner"><div className="demo-banner-icon"><Sparkles size={15} /></div><div><strong>Anda sedang melihat dataset demonstrasi.</strong><span>Gunakan untuk mencoba alur SIGNAL. Ganti nama/data sesuai madrasah Anda sebelum publikasi.</span></div><button onClick={() => navigate('master')}>Mulai sesuaikan <ArrowRight size={14} /></button><button className="banner-close" onClick={() => updateWorkspace((current) => ({ ...current, dataMode: 'custom' }))} aria-label="Sembunyikan banner"><X size={14} /></button></div>}
            {screen === 'overview' && <DashboardScreen state={workspace} report={report!} masterIssues={masterIssues} readiness={readiness} occupiedSlots={occupiedSlots} totalWeeklyCapacity={totalWeeklyCapacity} onNavigate={navigate} onGenerate={handleGenerate} isGenerating={isGenerating} onPublish={publishDraft} onExport={backupNow} />}
            {screen === 'schedule' && <ScheduleScreen state={workspace} selectedClass={selectedClassObj?.id ?? ''} onSelectClass={setSelectedClass} onEditSlot={openSlotEditor} onGenerate={handleGenerate} isGenerating={isGenerating} onPublish={publishDraft} onExportCSV={exportScheduleCSV} onValidate={() => navigate('validation')} onNavigate={navigate} report={report!} />}
            {screen === 'generator' && <GeneratorScreen state={workspace} isGenerating={isGenerating} result={lastGeneratorResult} onGenerate={handleGenerate} onChoose={chooseCandidate} onNavigate={navigate} />}
            {screen === 'master' && <MasterScreen state={workspace} activeTab={masterTab} onTabChange={(tab) => { setMasterTab(tab); setAddType(null); }} search={masterSearch} onSearch={setMasterSearch} onAdd={(type) => { setAddType(type); setMasterForm(emptyMasterForm); }} addType={addType} form={masterForm} setForm={setMasterForm} onSave={saveMasterForm} onCancelAdd={() => setAddType(null)} onDelete={deleteMaster} />}
            {screen === 'requirements' && <RequirementsScreen state={workspace} formOpen={reqFormOpen} setFormOpen={setReqFormOpen} form={reqForm} setForm={setReqForm} onSave={saveRequirement} onDelete={deleteRequirement} onGenerate={handleGenerate} onNavigate={navigate} />}
            {screen === 'validation' && <ValidationScreen state={workspace} report={report!} masterIssues={masterIssues} expandedIssue={expandedIssue} setExpandedIssue={setExpandedIssue} onNavigate={navigate} onValidate={() => { const newReport = validateSchedule(workspace, workspace.draft ?? workspace.activeSchedule ?? [], { strictCoverage: true, includeSoftWarnings: true }); notify(newReport.valid ? 'Validasi selesai: tidak ada pelanggaran hard constraint.' : `Validasi selesai: ${newReport.hardErrorCount} pelanggaran wajib ditemukan.`, newReport.valid ? 'success' : 'warning'); }} />}
            {screen === 'history' && <HistoryScreen state={workspace} onRestore={restoreVersion} onNavigate={navigate} />}
            {screen === 'backup' && <BackupScreen state={workspace} onBackup={backupNow} onImport={importBackup} onExportCSV={exportScheduleCSV} onExportJSON={exportJSONSchedule} />}
            {screen === 'settings' && <SettingsScreen state={workspace} onSettingsChange={setPeriodConfig} onReset={resetWorkspace} onNavigate={navigate} onSave={() => { setSettingsSaved(true); notify('Pengaturan tersimpan pada workspace lokal.', 'success'); }} saved={settingsSaved} />}
          </div>
          <footer className="app-footer"><span>© 2026 SIGNAL Academic Studio</span><span><span className="tiny-status-dot" /> Data tersimpan lokal di browser ini</span><span>Built for clarity, designed for calm.</span></footer>
        </div>
      </main>

      {editingSlot && <Modal title="Edit penempatan jadwal" subtitle={`${getClass(workspace, editingSlot.classId)?.name ?? ''} · ${editingSlot.day} · JP ${editingSlot.jpNo}`} onClose={() => setEditingSlot(null)} icon={CalendarDays}>
        <form className="modal-form" onSubmit={saveSlotEditor}>
          <div className="field-group"><label>Mata pelajaran</label><select value={editingSubject} onChange={(e) => { setEditingSubject(e.target.value); const firstTeacher = workspace.teachers.find((teacher) => teacher.isActive && teacher.subjectIds.includes(e.target.value)); setEditingTeacher(firstTeacher?.id ?? ''); }}><option value="">— Kosongkan slot —</option>{workspace.subjects.filter((subject) => subject.isActive).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><small>Slot kosong boleh digunakan untuk mengisi pelajaran secara manual.</small></div>
          <div className="field-group"><label>Guru pengampu</label><select value={editingTeacher} onChange={(e) => setEditingTeacher(e.target.value)} disabled={!editingSubject}><option value="">Pilih guru</option>{workspace.teachers.filter((teacher) => teacher.isActive && editingSubject && teacher.subjectIds.includes(editingSubject)).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select>{editingSubject && !workspace.teachers.some((teacher) => teacher.isActive && teacher.subjectIds.includes(editingSubject)) && <small className="field-error">Belum ada guru berkualifikasi untuk mapel ini.</small>}</div>
          <div className="modal-note"><ShieldCheck size={16} /><span>Perubahan ditaruh ke draft. Validator akan memeriksa konflik guru, blok JP, kualifikasi, dan pemenuhan alokasi sebelum publikasi.</span></div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setEditingSlot(null)}>Batal</button><button className="button button-primary" type="submit"><Save size={15} /> Simpan draft</button></div>
        </form>
      </Modal>}

      {toast && <div className={`toast toast-${toast.kind}`} role="status"><div className="toast-icon">{toast.kind === 'success' ? <CheckCircle2 size={18} /> : toast.kind === 'error' ? <XCircle size={18} /> : toast.kind === 'warning' ? <AlertTriangle size={18} /> : <Activity size={18} />}</div><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Tutup notifikasi"><X size={14} /></button></div>}
    </div>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="loading-emblem">S</div><div className="loading-line" /><h1>SIGNAL</h1><p>Preparing your academic workspace…</p></div>;
}

function PageHeading({ kicker, title, description, actions }: { kicker: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />{kicker}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-heading-actions">{actions}</div>}</div>;
}
function Button({ children, variant = 'primary', icon: Icon, onClick, disabled, type = 'button', className = '' }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'hero-ghost'; icon?: LucideIcon; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; className?: string }) {
  return <button type={type} disabled={disabled} className={`button button-${variant} ${className}`} onClick={onClick}>{Icon && <Icon size={15} />}{children}</button>;
}
function Card({ children, className = '', title, eyebrow, action }: { children: ReactNode; className?: string; title?: string; eyebrow?: string; action?: ReactNode }) {
  return <section className={`surface-card ${className}`}>{(title || eyebrow || action) && <div className="card-heading"><div>{eyebrow && <div className="card-eyebrow">{eyebrow}</div>}{title && <h3>{title}</h3>}</div>{action}</div>}{children}</section>;
}
function StatCard({ label, value, sub, icon: Icon, trend, tone = 'teal' }: { label: string; value: string | number; sub: string; icon: LucideIcon; trend?: string; tone?: 'teal' | 'sand' | 'blue' | 'rose' }) {
  return <div className={`stat-card tone-${tone}`}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={17} /></div></div><div className="stat-value-row"><strong>{value}</strong>{trend && <span className="stat-trend"><ArrowUpRight size={12} />{trend}</span>}</div><div className="stat-sub">{sub}</div><div className="stat-accent" /></div>;
}
function StatusPill({ status, children }: { status: 'success' | 'warning' | 'danger' | 'neutral' | 'info'; children: ReactNode }) {
  return <span className={`status-pill status-${status}`}><i />{children}</span>;
}
function EmptyState({ icon: Icon = CircleHelp, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={25} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
function Modal({ title, subtitle, icon: Icon, children, onClose }: { title: string; subtitle: string; icon: LucideIcon; children: ReactNode; onClose: () => void }) {
  return <div className="modal-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-panel" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div className="modal-title-icon"><Icon size={20} /></div><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Tutup dialog"><X size={17} /></button></div>{children}</div></div>;
}

function DashboardScreen({ state, report, masterIssues, readiness, occupiedSlots, totalWeeklyCapacity, onNavigate, onGenerate, isGenerating, onPublish, onExport }: {
  state: AppState; report: ReturnType<typeof validateSchedule>; masterIssues: ValidationIssue[]; readiness: number; occupiedSlots: number; totalWeeklyCapacity: number;
  onNavigate: (screen: ScreenId) => void; onGenerate: () => void; isGenerating: boolean; onPublish: () => void; onExport: () => void;
}) {
  const hasSchedule = !!(state.draft?.length || state.activeSchedule?.length);
  const errors = masterIssues.filter((item) => item.severity === 'error').length + report.hardErrorCount;
  const classCounts = state.classes.filter((item) => item.isActive).length;
  const reqJP = state.requirements.reduce((sum, item) => sum + item.requiredJP, 0);
  const activeEntries = state.draft ?? state.activeSchedule ?? [];
  const loadByTeacher = state.teachers.filter((item) => item.isActive).map((teacher) => ({ teacher, load: state.requirements.filter((item) => item.teacherId === teacher.id).reduce((sum, item) => sum + item.requiredJP, 0) })).sort((a, b) => b.load - a.load).slice(0, 5);
  const daysCount = state.settings.activeDays.length;
  const weekDistribution = state.settings.activeDays.map((day) => ({ day: day.slice(0, 3), count: activeEntries.filter((entry) => entry.day === day).length, max: classCounts * teachingPeriodsForDay(state.slots, day).length }));

  return <>
    <div className="welcome-line"><div><span className="welcome-greeting">SELAMAT DATANG KEMBALI, OPERATOR <span className="welcome-sparkle">✦</span></span><div className="welcome-date">{formatDate()}</div></div><div className="welcome-meta"><div className="privacy-chip"><LockKeyhole size={13} /> PUBLIC · TANPA LOGIN</div><div className="workspace-badge"><span className="tiny-status-dot" /> WORKSPACE AKTIF</div></div></div>
    <div className="hero-panel">
      <div className="hero-text"><div className="hero-label"><span className="hero-label-dot" /> ACADEMIC PLANNING · {state.settings.semester.toUpperCase()}</div><h1>Make every period<br /><em>count.</em></h1><p>Satu ruang kerja untuk menyusun jadwal yang presisi, seimbang, dan siap dijalankan.</p><div className="hero-actions"><Button icon={WandSparkles} onClick={onGenerate} disabled={isGenerating}>{isGenerating ? 'Sedang mencari…' : hasSchedule ? 'Buat kandidat baru' : 'Mulai menyusun jadwal'}</Button><Button variant="hero-ghost" icon={CalendarDays} onClick={() => onNavigate('schedule')}>Buka jadwal</Button></div><div className="hero-footnotes"><span><ShieldCheck size={14} /> Validator deterministik</span><span><Activity size={14} /> Local-first</span><span><Sparkles size={14} /> AI opsional</span></div></div>
      <div className="hero-art" aria-hidden="true"><div className="hero-orbit hero-orbit-a" /><div className="hero-orbit hero-orbit-b" /><div className="hero-glow" /><div className="hero-art-top"><span>WEEKLY OVERVIEW</span><span className="art-live-dot" />LIVE DATA</div><div className="hero-art-grid"><div className="art-weekday">MON<span>08</span></div><div className="art-weekday">TUE<span>08</span></div><div className="art-weekday">WED<span>08</span></div><div className="art-weekday">THU<span>08</span></div><div className="art-weekday">FRI<span>08</span></div><div className="art-schedule-line wide" /><div className="art-schedule-line" /><div className="art-schedule-line medium" /><div className="art-schedule-line" /><div className="art-schedule-line small" /><div className="art-schedule-line" /><div className="art-schedule-line wide" /><div className="art-schedule-line medium" /><div className="art-schedule-line small" /><div className="art-schedule-line wide" /></div><div className="hero-art-foot"><span><i /> {hasSchedule ? 'DRAFT / ACTIVE' : 'READY TO GENERATE'}</span><span>0{daysCount} DAYS</span></div></div>
      <div className="hero-decoration hero-decoration-one" /><div className="hero-decoration hero-decoration-two" />
    </div>

    <div className="section-intro-row"><div><div className="eyebrow"><span className="eyebrow-line" />AT A GLANCE</div><h2>Workspace intelligence</h2></div><div className="section-intro-note"><span className="tiny-status-dot" /> Diperbarui otomatis saat data berubah</div></div>
    <div className="stat-grid">
      <StatCard label="Kelas aktif" value={classCounts.toString().padStart(2, '0')} sub="Target lingkup: maks. 10 kelas" icon={GraduationCap} trend="ready" tone="teal" />
      <StatCard label="Guru aktif" value={state.teachers.filter((item) => item.isActive).length.toString().padStart(2, '0')} sub="Kualifikasi mapel tercatat" icon={Users} trend={`${state.teachers.filter((item) => item.isActive && item.subjectIds.length > 1).length} multimapel`} tone="sand" />
      <StatCard label="Mata pelajaran" value={state.subjects.filter((item) => item.isActive).length.toString().padStart(2, '0')} sub="Mapel aktif dalam workspace" icon={BookOpen} tone="blue" />
      <StatCard label="Kesiapan jadwal" value={`${readiness}%`} sub={errors ? `${errors} hal wajib perlu ditinjau` : 'Data inti terisi'} icon={ShieldCheck} trend={errors ? 'review' : 'on track'} tone={errors ? 'rose' : 'teal'} />
    </div>

    <div className="dashboard-grid dashboard-grid-main">
      <Card className="schedule-health-card" eyebrow="SCHEDULE HEALTH" title="Status penyusunan" action={<button className="text-link" onClick={() => onNavigate('validation')}>Lihat detail <ArrowRight size={14} /></button>}>
        <div className="health-content"><div className="health-ring" style={{ '--ring-value': `${hasSchedule && report.valid ? 100 : readiness}%` } as React.CSSProperties}><div className="health-ring-inner"><strong>{hasSchedule && report.valid ? '100%' : `${readiness}%`}</strong><span>READINESS</span></div></div><div className="health-copy"><h4>{hasSchedule ? (report.valid ? 'Jadwal siap ditinjau' : 'Perlu pemeriksaan') : 'Siap untuk mulai'}</h4><p>{hasSchedule ? (report.valid ? 'Seluruh aturan keras lolos pada susunan saat ini.' : 'Beberapa aturan atau kebutuhan JP belum terpenuhi.') : 'Lengkapi data master dan kebutuhan JP, lalu jalankan generator.'}</p><div className="health-metrics"><div><span className="metric-bullet green" /><span>Alokasi JP</span><strong>{reqJP} JP</strong></div><div><span className="metric-bullet gold" /><span>Penempatan</span><strong>{occupiedSlots}</strong></div><div><span className="metric-bullet coral" /><span>Konflik wajib</span><strong>{report.hardErrorCount}</strong></div></div></div></div>
        <div className="health-progress"><div><span>Coverage slot minggu ini</span><strong>{totalWeeklyCapacity ? Math.round(occupiedSlots / totalWeeklyCapacity * 100) : 0}%</strong></div><div className="progress-track"><span style={{ width: `${totalWeeklyCapacity ? Math.min(100, occupiedSlots / totalWeeklyCapacity * 100) : 0}%` }} /></div><small>{occupiedSlots} penempatan dari kapasitas {totalWeeklyCapacity} slot kelas</small></div>
      </Card>
      <Card className="latest-card" eyebrow="RECENT ACTIVITY" title="Aktivitas terbaru" action={<button className="icon-button card-more" aria-label="Riwayat lengkap" onClick={() => onNavigate('history')}><MoreHorizontal size={18} /></button>}>
        <div className="activity-list">
          {state.history.length > 0 && <div className="activity-item"><div className="activity-icon activity-icon-green"><CheckCircle2 size={16} /></div><div className="activity-detail"><strong>{state.history[0].label}</strong><span>Jadwal dipublikasikan · {state.history[0].entryCount} penempatan</span></div><time>{formatShortDate(state.history[0].createdAt)}</time></div>}
          {state.draft?.length ? <div className="activity-item"><div className="activity-icon activity-icon-gold"><SquarePen size={16} /></div><div className="activity-detail"><strong>Draft jadwal diperbarui</strong><span>{state.draft.length} penempatan · perlu dipublikasikan</span></div><time>Draft</time></div> : null}
          <div className="activity-item"><div className="activity-icon activity-icon-blue"><DatabaseIcon size={16} /></div><div className="activity-detail"><strong>Workspace local-first</strong><span>{state.classes.length} kelas · {state.requirements.length} alokasi kebutuhan JP</span></div><time>Aktif</time></div>
          <div className="activity-item"><div className="activity-icon activity-icon-violet"><ShieldCheck size={16} /></div><div className="activity-detail"><strong>Validator deterministik</strong><span>{report.hardErrorCount ? `${report.hardErrorCount} hard conflict terdeteksi` : 'Pemeriksaan siap dijalankan kapan saja'}</span></div><time>Realtime</time></div>
        </div>
        <button className="activity-footer" onClick={() => onNavigate('history')}>Buka riwayat lengkap <ArrowRight size={14} /></button>
      </Card>
    </div>

    <div className="dashboard-grid dashboard-grid-lower">
      <Card className="weekly-card" eyebrow="WEEKLY LOAD" title="Distribusi penempatan" action={<span className="mini-legend"><i /> JP terisi</span>}>
        <div className="weekly-chart">{weekDistribution.map((item) => <div className="bar-column" key={item.day}><div className="bar-value">{item.count}</div><div className="bar-track"><span style={{ height: `${item.max ? Math.max(3, item.count / item.max * 100) : 0}%` }} /></div><span className="bar-label">{item.day}</span></div>)}</div><div className="chart-footnote"><span><i /> Distribusi dari draft / jadwal aktif</span><span>Slot aktif: {state.settings.teachingPeriodsPerDay} JP/hari</span></div>
      </Card>
      <Card className="teacher-load-card" eyebrow="TEACHER ALLOCATION" title="Beban guru tertinggi" action={<button className="text-link" onClick={() => onNavigate('master')}>Lihat semua <ArrowRight size={14} /></button>}>
        <div className="teacher-load-list">{loadByTeacher.map(({ teacher, load }, index) => <div className="teacher-load-row" key={teacher.id}><div className={`teacher-initial initial-${index}`}>{teacher.name.split(' ').slice(0, 2).map((chunk) => chunk[0]).join('')}</div><div className="teacher-load-name"><strong>{teacher.name}</strong><span>{teacher.subjectIds.map((id) => getSubject(state, id)?.code ?? id).join(' · ')}</span></div><div className="teacher-load-meter"><div><strong>{load}</strong><small>/{teacher.maxWeeklyJP} JP</small></div><div className="progress-track"><span style={{ width: `${Math.min(100, load / Math.max(1, teacher.maxWeeklyJP) * 100)}%` }} /></div></div></div>)}</div>
      </Card>
    </div>

    <div className="quick-action-row"><div className="quick-action-copy"><div className="quick-action-icon"><Sparkles size={17} /></div><div><strong>Siap menghasilkan susunan baru?</strong><span>Generator mencari kandidat; hanya hasil yang lolos validator deterministik dapat dipublikasikan.</span></div></div><div className="quick-action-buttons"><Button variant="secondary" icon={ArrowDownToLine} onClick={onExport}>Backup data</Button>{state.draft && <Button icon={FileCheck2} onClick={onPublish} disabled={!report.valid}>Terbitkan draft</Button>}<Button icon={WandSparkles} onClick={onGenerate} disabled={isGenerating}>{isGenerating ? 'Memproses…' : 'Jalankan generator'}</Button></div></div>
  </>;
}

function ScheduleScreen({ state, selectedClass, onSelectClass, onEditSlot, onGenerate, isGenerating, onPublish, onExportCSV, onValidate, onNavigate, report }: {
  state: AppState; selectedClass: string; onSelectClass: (value: string) => void; onEditSlot: (classId: string, day: Day, jpNo: number) => void;
  onGenerate: () => void; isGenerating: boolean; onPublish: () => void; onExportCSV: () => void; onValidate: () => void; onNavigate: (screen: ScreenId) => void; report: ReturnType<typeof validateSchedule>;
}) {
  const hasEntries = !!(state.draft?.length || state.activeSchedule?.length);
  const activeDays = state.settings.activeDays;
  const periods = Array.from({ length: state.settings.teachingPeriodsPerDay }, (_, i) => i + 1);
  const published = !state.draft && !!state.activeSchedule?.length;
  return <>
    <PageHeading kicker="SCHEDULE WORKSPACE" title="Jadwal pelajaran" description="Atur, tinjau, dan validasi jadwal dalam grid mingguan yang dirancang untuk kerja operator." actions={<><Button variant="secondary" icon={FileSpreadsheet} onClick={onExportCSV}>Ekspor CSV</Button><Button icon={WandSparkles} onClick={onGenerate} disabled={isGenerating}>{isGenerating ? 'Memproses…' : 'Generate kandidat'}</Button></>} />
    <div className="toolbar-card"><div className="class-selector-wrap"><label htmlFor="schedule-class">TAMPILAN KELAS</label><div className="select-with-icon"><GraduationCap size={16} /><select id="schedule-class" value={selectedClass} onChange={(e) => onSelectClass(e.target.value)}><option value="">Pilih kelas</option>{state.classes.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14} /></div></div><div className="toolbar-divider" /><div className="schedule-status"><span className="toolbar-label">STATUS SCHEDULE</span>{state.draft ? <StatusPill status={report.valid ? 'success' : 'warning'}>{report.valid ? 'Draft valid' : 'Draft perlu perbaikan'}</StatusPill> : published ? <StatusPill status="success">Published · v{state.history[0]?.version ?? '—'}</StatusPill> : <StatusPill status="neutral">Belum dibuat</StatusPill>}</div><div className="toolbar-spacer" /><div className="schedule-toolbar-actions"><Button variant="quiet" icon={ShieldCheck} onClick={onValidate}>Validasi</Button><Button onClick={onPublish} disabled={!hasEntries || !report.valid}><Check size={15} /> Terbitkan</Button></div></div>
    {!selectedClass ? <EmptyState icon={GraduationCap} title="Belum ada kelas" description="Tambahkan kelas aktif pada Data Master untuk mulai membuat jadwal." action={<Button onClick={() => onNavigate('master')}>Buka data master</Button>} /> : <>
      <div className="schedule-summary-row"><div className="schedule-selected-class"><div className="class-monogram">{getClass(state, selectedClass)?.name.slice(0, 2)}</div><div><strong>Kelas {getClass(state, selectedClass)?.name}</strong><span>{state.settings.schoolName} · Tahun ajaran {state.settings.academicYear}</span></div></div><div className="schedule-summary-metric"><span>Alokasi terisi</span><strong>{(state.draft ?? state.activeSchedule ?? []).filter((entry) => entry.classId === selectedClass).length} <small>JP</small></strong></div><div className="schedule-summary-metric"><span>Target kebutuhan</span><strong>{state.requirements.filter((item) => item.classId === selectedClass).reduce((sum, item) => sum + item.requiredJP, 0)} <small>JP</small></strong></div><div className="schedule-summary-metric"><span>Hari aktif</span><strong>{activeDays.length} <small>hari</small></strong></div></div>
      <div className="schedule-table-wrap"><table className="schedule-table"><thead><tr><th className="schedule-time-column">JAM / JP KBM</th>{activeDays.map((day) => <th key={day}><span>{day}</span><small>{day === 'Jumat' ? 'FRI · MADRASAH' : ['MON','TUE','WED','THU'][activeDays.indexOf(day)]}</small></th>)}</tr></thead><tbody>{periods.map((jpNo) => <tr key={jpNo}><th className="period-heading"><span>JP {String(jpNo).padStart(2, '0')}</span><small>{state.slots.find((slot) => slot.kind === 'TEACHING' && slot.day === activeDays[0] && slot.jpNo === jpNo)?.start ?? '—'}</small></th>{activeDays.map((day) => {
        const entry = getEntry(state, selectedClass, day, jpNo);
        const subject = entry ? getSubject(state, entry.subjectId) : undefined;
        const teacher = entry ? getTeacher(state, entry.teacherId) : undefined;
        return <td key={`${day}-${jpNo}`}><button className={`schedule-cell ${entry ? 'has-entry' : 'is-empty'}`} style={entry && subject ? { '--subject-color': subject.color } as React.CSSProperties : undefined} onClick={() => onEditSlot(selectedClass, day, jpNo)} title={entry ? `Edit ${subject?.name} · ${teacher?.name}` : `Tambah pelajaran pada ${day}, JP ${jpNo}`}><span className="cell-time">{entry ? subject?.code ?? 'MAPEL' : '+ ADD'}</span>{entry ? <><strong>{subject?.name ?? 'Mapel'}</strong><small>{teacher?.name ?? 'Guru belum tersedia'}</small><span className="cell-foot"><i /> {teacher?.code ?? '—'}</span></> : <span className="empty-cell-hint">Tambah pelajaran</span>}</button></td>;
      })}</tr>)}</tbody></table></div>
      <div className="schedule-legend-row"><span><i className="legend-dot dot-teal" /> Mapel sudah ditempatkan</span><span><i className="legend-dot dot-ivory" /> Slot kosong / dapat diedit</span><span><ShieldCheck size={14} /> Klik sel untuk mengedit</span><span className="legend-spacer" /><button className="text-link" onClick={onValidate}>Lihat laporan validasi <ArrowRight size={13} /></button></div>
      {!hasEntries && <div className="inline-info"><Sparkles size={16} /><span>Belum ada jadwal. Gunakan <strong>Generate kandidat</strong>, atau klik slot kosong untuk memasukkan penempatan manual.</span></div>}
    </>}
  </>;
}

function GeneratorScreen({ state, isGenerating, result, onGenerate, onChoose, onNavigate }: { state: AppState; isGenerating: boolean; result: { status: GeneratorStatus; message: string; nodes: number } | null; onGenerate: () => void; onChoose: (id: string) => void; onNavigate: (screen: ScreenId) => void }) {
  const statuses: Record<GeneratorStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
    QUEUED: { label: 'Menunggu', tone: 'neutral' }, RUNNING: { label: 'Mencari kandidat', tone: 'info' }, SUCCESS: { label: 'Berhasil', tone: 'success' },
    INFEASIBLE: { label: 'Tidak feasible', tone: 'danger' }, SEARCH_LIMIT_REACHED: { label: 'Batas pencarian', tone: 'warning' }, INVALID_INPUT: { label: 'Input belum valid', tone: 'warning' }, CANCELLED: { label: 'Dibatalkan', tone: 'neutral' }, FAILED: { label: 'Gagal', tone: 'danger' },
  };
  const allJP = state.requirements.reduce((sum, item) => sum + item.requiredJP, 0);
  const masterIssues = validateMasterData(state);
  const classJP = state.classes.filter((item) => item.isActive).map((schoolClass) => ({ schoolClass, jp: state.requirements.filter((item) => item.classId === schoolClass.id).reduce((sum, item) => sum + item.requiredJP, 0), cap: state.settings.activeDays.reduce((sum, day) => sum + teachingPeriodsForDay(state.slots, day).length, 0) }));
  return <>
    <PageHeading kicker="DETERMINISTIC ENGINE" title="Schedule generator" description="Susun kandidat berdasarkan alokasi JP, ketersediaan guru, dan seluruh hard constraint yang dikunci." actions={<Button icon={WandSparkles} onClick={onGenerate} disabled={isGenerating}>{isGenerating ? 'Sedang mencari…' : 'Jalankan generator'}</Button>} />
    <div className="generator-hero"><div className="generator-hero-content"><div className="generator-hero-kicker"><Sparkles size={14} /> CONSTRAINT-AWARE SEARCH</div><h2>Find the right rhythm<br /><em>for every class.</em></h2><p>Mesin pencarian bekerja dengan kebutuhan JP dan kualifikasi guru. Gemini tidak digunakan untuk menentukan validitas.</p><div className="generator-hero-steps"><span><i>01</i> Read constraints</span><span><i>02</i> Search placement</span><span><i>03</i> Validate result</span></div></div><div className="generator-visual"><div className="gen-ring gen-ring-one" /><div className="gen-ring gen-ring-two" /><div className="gen-core"><WandSparkles size={27} /><span>SIGNAL</span></div><div className="gen-floating gen-floating-top"><CheckCircle2 size={14} /> HARD RULES</div><div className="gen-floating gen-floating-bottom"><Activity size={14} /> SEARCH ENGINE</div></div></div>
    <div className="generator-metrics"><div><span>Total kebutuhan</span><strong>{allJP} <small>JP/minggu</small></strong></div><div><span>Kelas aktif</span><strong>{state.classes.filter((item) => item.isActive).length} <small>kelas</small></strong></div><div><span>Slot pencarian</span><strong>{state.settings.searchLimit.toLocaleString('id-ID')} <small>nodes maks.</small></strong></div><div><span>Riwayat kandidat</span><strong>{state.candidates.length.toString().padStart(2, '0')} <small>candidate</small></strong></div></div>
    <div className="dashboard-grid generator-main-grid"><Card className="generator-config-card" eyebrow="BEFORE YOU GENERATE" title="Kesiapan constraint"><div className="readiness-check-list"><div className="readiness-check-row"><div className={`check-round ${state.classes.length ? 'checked' : ''}`}>{state.classes.length ? <Check size={13} /> : '1'}</div><div><strong>Data kelas</strong><span>{state.classes.filter((item) => item.isActive).length} kelas aktif</span></div><StatusPill status={state.classes.some((item) => item.isActive) ? 'success' : 'warning'}>{state.classes.some((item) => item.isActive) ? 'Ready' : 'Missing'}</StatusPill></div><div className="readiness-check-row"><div className={`check-round ${state.teachers.length ? 'checked' : ''}`}>{state.teachers.length ? <Check size={13} /> : '2'}</div><div><strong>Guru & kualifikasi</strong><span>{state.teachers.filter((item) => item.isActive).length} guru · kualifikasi mapel</span></div><StatusPill status={state.teachers.length ? 'success' : 'warning'}>{state.teachers.length ? 'Ready' : 'Missing'}</StatusPill></div><div className="readiness-check-row"><div className={`check-round ${state.requirements.length ? 'checked' : ''}`}>{state.requirements.length ? <Check size={13} /> : '3'}</div><div><strong>Kebutuhan & alokasi JP</strong><span>{state.requirements.length} baris alokasi</span></div><StatusPill status={state.requirements.length ? 'success' : 'warning'}>{state.requirements.length ? 'Ready' : 'Missing'}</StatusPill></div><div className="readiness-check-row"><div className={`check-round ${!masterIssues.some((item) => item.severity === 'error') ? 'checked' : ''}`}>{!masterIssues.some((item) => item.severity === 'error') ? <Check size={13} /> : '4'}</div><div><strong>Pre-flight validation</strong><span>{masterIssues.filter((item) => item.severity === 'error').length} masalah wajib sebelum pencarian</span></div><StatusPill status={masterIssues.some((item) => item.severity === 'error') ? 'warning' : 'success'}>{masterIssues.some((item) => item.severity === 'error') ? 'Review' : 'Ready'}</StatusPill></div></div><div className="generator-settings-strip"><div><span>Search strategy</span><strong>Constraint-aware backtracking</strong></div><div><span>Validator</span><strong>Deterministic · v1.0</strong></div></div></Card>
      <Card className="generator-result-card" eyebrow="SEARCH RESULT" title="Hasil pencarian"><div className="result-status-top"><div className="result-status-icon">{isGenerating ? <LoaderCircle className="spinning" size={22} /> : result?.status === 'SUCCESS' ? <CheckCircle2 size={22} /> : result?.status && ['INFEASIBLE','FAILED'].includes(result.status) ? <XCircle size={22} /> : <WandSparkles size={22} />}</div><div><strong>{isGenerating ? 'Searching candidates…' : result ? statuses[result.status].label : 'Belum ada pencarian'}</strong><span>{isGenerating ? 'Memeriksa slot, alokasi, dan bentrok lintas kelas.' : result?.message ?? 'Jalankan generator untuk membuat kandidat pertama.'}</span></div></div>{result && <div className="result-stats"><div><span>Search nodes</span><strong>{result.nodes.toLocaleString('id-ID')}</strong></div><div><span>Status</span><StatusPill status={statuses[result.status].tone}>{statuses[result.status].label}</StatusPill></div></div>}<div className="result-disclaimer"><ShieldCheck size={16} /><span>Status <strong>SUCCESS</strong> berarti kandidat lolos validator deterministic pada saat dibuat. Kandidat tetap berstatus draft sampai operator menerbitkannya.</span></div>{result && result.status !== 'SUCCESS' && <Button variant="secondary" icon={RefreshCw} onClick={onGenerate} disabled={isGenerating}>Coba seed baru</Button>}</Card></div>
    <Card className="candidate-list-card" eyebrow="CANDIDATE MANAGEMENT" title="Kandidat tersimpan" action={<span className="candidate-count">{state.candidates.length} candidate{state.candidates.length === 1 ? '' : 's'}</span>}>
      {!state.candidates.length ? <EmptyState icon={WandSparkles} title="Belum ada kandidat" description="Kandidat valid akan muncul di sini dengan skor kualitas dan hasil validator." action={<Button icon={WandSparkles} onClick={onGenerate} disabled={isGenerating}>Buat kandidat pertama</Button>} /> : <div className="candidate-table-wrap"><table className="data-table candidate-table"><thead><tr><th>Kandidat</th><th>Coverage</th><th>Skor kualitas</th><th>Validator</th><th>Waktu</th><th /></tr></thead><tbody>{state.candidates.map((candidate, index) => <tr key={candidate.id}><td><div className="candidate-name"><div className={`candidate-number ${index === 0 ? 'candidate-number-first' : ''}`}>{String(index + 1).padStart(2, '0')}</div><div><strong>{candidate.label}</strong><span>{candidate.entries.length} placement · {candidate.searchNodes.toLocaleString('id-ID')} nodes</span></div>{index === 0 && <span className="best-chip">LATEST</span>}</div></td><td><div className="coverage-cell"><strong>{candidate.report.valid ? '100%' : '—'}</strong><div className="progress-track"><span style={{ width: candidate.report.valid ? '100%' : '0%' }} /></div></div></td><td><span className="score-value">{candidate.score}</span><span className="score-caption">quality score</span></td><td><StatusPill status={candidate.report.valid ? 'success' : 'danger'}>{candidate.report.valid ? 'All hard rules pass' : `${candidate.report.hardErrorCount} issue(s)`}</StatusPill></td><td className="muted-cell">{formatShortDate(candidate.createdAt)}</td><td><Button variant="secondary" icon={ArrowRight} onClick={() => onChoose(candidate.id)}>Gunakan</Button></td></tr>)}</tbody></table></div>}
      <div className="candidate-bottom-note"><AlertCircle size={14} /><span>Jika pencarian mencapai batas iterasi, statusnya <code>SEARCH_LIMIT_REACHED</code> — bukan bukti bahwa jadwal mustahil dibuat.</span><button className="text-link" onClick={() => onNavigate('validation')}>Aturan validasi <ArrowRight size={12} /></button></div>
    </Card>
    <div className="generator-class-capacity"><h3>Kapasitas per kelas</h3><div className="capacity-grid">{classJP.map(({ schoolClass, jp, cap }) => <div className="capacity-card" key={schoolClass.id}><div><strong>{schoolClass.name}</strong><span>{jp} dari {cap} JP tersedia</span></div><div className="progress-track"><span style={{ width: `${Math.min(100, cap ? jp / cap * 100 : 0)}%` }} /></div><b>{cap ? Math.round(jp / cap * 100) : 0}%</b></div>)}</div></div>
  </>;
}

function MasterScreen({ state, activeTab, onTabChange, search, onSearch, onAdd, addType, form, setForm, onSave, onCancelAdd, onDelete }: {
  state: AppState; activeTab: MasterTab; onTabChange: (tab: MasterTab) => void; search: string; onSearch: (value: string) => void;
  onAdd: (type: Exclude<AddType, null>) => void; addType: AddType; form: typeof emptyMasterForm; setForm: (value: typeof emptyMasterForm) => void; onSave: (event: FormEvent) => void; onCancelAdd: () => void; onDelete: (kind: MasterTab, id: string) => void;
}) {
  const filteredClasses = state.classes.filter((item) => `${item.name} ${item.level}`.toLowerCase().includes(search.toLowerCase()));
  const filteredTeachers = state.teachers.filter((item) => `${item.name} ${item.code} ${item.subjectIds.map((id) => getSubject(state, id)?.name ?? '').join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const filteredSubjects = state.subjects.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <PageHeading kicker="MASTER DATA REPOSITORY" title="Data master" description="Kelola referensi inti untuk menjaga konsistensi kebutuhan JP, alokasi guru, dan penempatan jadwal." actions={<Button icon={Plus} onClick={() => onAdd(activeTab === 'classes' ? 'class' : activeTab === 'teachers' ? 'teacher' : 'subject')}>Tambah {activeTab === 'classes' ? 'kelas' : activeTab === 'teachers' ? 'guru' : 'mapel'}</Button>} />
    <div className="master-summary-strip"><div className="master-summary-item"><div className="master-summary-icon"><GraduationCap size={17} /></div><div><strong>{state.classes.length.toString().padStart(2, '0')}</strong><span>Kelas terdaftar</span></div></div><div className="master-summary-item"><div className="master-summary-icon gold"><Users size={17} /></div><div><strong>{state.teachers.length.toString().padStart(2, '0')}</strong><span>Guru terdaftar</span></div></div><div className="master-summary-item"><div className="master-summary-icon blue"><BookOpen size={17} /></div><div><strong>{state.subjects.length.toString().padStart(2, '0')}</strong><span>Mapel terdaftar</span></div></div><div className="master-summary-item"><div className="master-summary-icon violet"><ShieldCheck size={17} /></div><div><strong>{state.teachers.filter((item) => item.subjectIds.length > 1).length.toString().padStart(2, '0')}</strong><span>Guru multimapel</span></div></div></div>
    <Card className="master-repository-card" title="Master records" eyebrow="DATA GOVERNANCE" action={<div className="table-toolbar"><div className="table-search"><Search size={15} /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Cari nama atau kode…" /></div><button className="filter-button"><Filter size={14} /> Filter</button></div>}>
      <div className="segmented-tabs"><button className={activeTab === 'classes' ? 'active' : ''} onClick={() => onTabChange('classes')}>Kelas <span>{state.classes.length}</span></button><button className={activeTab === 'teachers' ? 'active' : ''} onClick={() => onTabChange('teachers')}>Guru <span>{state.teachers.length}</span></button><button className={activeTab === 'subjects' ? 'active' : ''} onClick={() => onTabChange('subjects')}>Mata pelajaran <span>{state.subjects.length}</span></button></div>
      {addType && <form className="inline-create-form" onSubmit={onSave}><div className="inline-create-title"><div className="inline-create-icon"><Plus size={17} /></div><div><strong>Tambah {addType === 'class' ? 'kelas baru' : addType === 'teacher' ? 'guru baru' : 'mata pelajaran baru'}</strong><span>Data akan disimpan di browser ini.</span></div><button className="icon-button" type="button" onClick={onCancelAdd}><X size={16} /></button></div><div className="form-grid-two"><div className="field-group"><label>{addType === 'class' ? 'Nama kelas' : addType === 'teacher' ? 'Nama lengkap guru' : 'Nama mata pelajaran'}</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={addType === 'class' ? 'Contoh: IX-A' : addType === 'teacher' ? 'Contoh: Nur Aisyah, S.Pd.' : 'Contoh: Informatika'} /></div>{addType === 'class' ? <div className="field-group"><label>Tingkat</label><select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}><option>VII</option><option>VIII</option><option>IX</option></select></div> : <div className="field-group"><label>Kode</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={addType === 'teacher' ? 'Contoh: T-10' : 'Contoh: INF'} /></div>}</div>{addType === 'teacher' && <><div className="field-group"><label>Kualifikasi mata pelajaran</label><div className="qualification-check-grid">{state.subjects.map((subject) => <label key={subject.id} className={`qualification-check ${form.selectedSubjectIds.includes(subject.id) ? 'checked' : ''}`}><input type="checkbox" checked={form.selectedSubjectIds.includes(subject.id)} onChange={(e) => setForm({ ...form, selectedSubjectIds: e.target.checked ? [...form.selectedSubjectIds, subject.id] : form.selectedSubjectIds.filter((id) => id !== subject.id) })} /><span className="tiny-subject-dot" style={{ background: subject.color }} />{subject.name}</label>)}</div></div><div className="field-group narrow-field"><label>Batas beban mingguan (JP)</label><input type="number" min="1" max="50" value={form.maxWeeklyJP} onChange={(e) => setForm({ ...form, maxWeeklyJP: e.target.value })} /></div></>}{addType === 'subject' && <div className="field-group narrow-field"><label>Warna identitas</label><div className="color-picker-row"><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /><span>Accent digunakan pada sel jadwal mapel.</span></div></div>}<div className="inline-form-actions"><Button variant="secondary" onClick={onCancelAdd}>Batal</Button><Button type="submit" icon={Save}>Simpan data</Button></div></form>}
      {activeTab === 'classes' && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Kelas</th><th>Tingkat</th><th>Kebutuhan JP</th><th>Alokasi</th><th>Status</th><th /></tr></thead><tbody>{filteredClasses.map((schoolClass) => { const requirements = state.requirements.filter((item) => item.classId === schoolClass.id); const jp = requirements.reduce((sum, item) => sum + item.requiredJP, 0); return <tr key={schoolClass.id}><td><div className="record-primary"><div className="record-avatar class-record">{schoolClass.name.slice(0, 2)}</div><div><strong>{schoolClass.name}</strong><span>{schoolClass.id}</span></div></div></td><td><span className="level-pill">{schoolClass.level}</span></td><td><strong>{jp} JP</strong></td><td><span className="muted-cell">{requirements.length} baris kebutuhan</span></td><td><StatusPill status={schoolClass.isActive ? 'success' : 'neutral'}>{schoolClass.isActive ? 'Aktif' : 'Nonaktif'}</StatusPill></td><td><button className="icon-button table-row-action" onClick={() => onDelete('classes', schoolClass.id)} title="Hapus kelas"><Trash2 size={15} /></button></td></tr>; })}</tbody></table>{!filteredClasses.length && <EmptyState title="Kelas tidak ditemukan" description="Coba kata kunci lain atau tambahkan kelas baru." />}</div>}
      {activeTab === 'teachers' && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Guru</th><th>Kualifikasi mapel</th><th>Alokasi mingguan</th><th>Batas JP</th><th>Status</th><th /></tr></thead><tbody>{filteredTeachers.map((teacher) => { const load = state.requirements.filter((item) => item.teacherId === teacher.id).reduce((sum, item) => sum + item.requiredJP, 0); return <tr key={teacher.id}><td><div className="record-primary"><div className="record-avatar teacher-record">{teacher.name.split(' ').slice(0, 2).map((part) => part[0]).join('')}</div><div><strong>{teacher.name}</strong><span>{teacher.code}</span></div></div></td><td><div className="tag-list">{teacher.subjectIds.map((subjectId) => { const subject = getSubject(state, subjectId); return subject ? <span className="subject-tag" key={subjectId}><i style={{ background: subject.color }} />{subject.code}</span> : null; })}</div></td><td><div className="load-with-bar"><strong>{load} JP</strong><div className="progress-track"><span style={{ width: `${Math.min(100, load / Math.max(1, teacher.maxWeeklyJP) * 100)}%` }} /></div></div></td><td>{teacher.maxWeeklyJP} JP</td><td><StatusPill status={teacher.isActive ? 'success' : 'neutral'}>{teacher.isActive ? 'Aktif' : 'Nonaktif'}</StatusPill></td><td><button className="icon-button table-row-action" onClick={() => onDelete('teachers', teacher.id)} title="Hapus guru"><Trash2 size={15} /></button></td></tr>; })}</tbody></table>{!filteredTeachers.length && <EmptyState title="Guru tidak ditemukan" description="Coba kata kunci lain atau tambahkan guru baru." />}</div>}
      {activeTab === 'subjects' && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Mata pelajaran</th><th>Guru berkualifikasi</th><th>Total alokasi mingguan</th><th>Kode</th><th>Status</th><th /></tr></thead><tbody>{filteredSubjects.map((subject) => { const teachers = state.teachers.filter((teacher) => teacher.isActive && teacher.subjectIds.includes(subject.id)); const jp = state.requirements.filter((item) => item.subjectId === subject.id).reduce((sum, item) => sum + item.requiredJP, 0); return <tr key={subject.id}><td><div className="record-primary"><span className="subject-color-swatch" style={{ background: subject.color }} /><div><strong>{subject.name}</strong><span>{subject.id}</span></div></div></td><td>{teachers.length} guru</td><td><strong>{jp} JP</strong></td><td><span className="code-pill">{subject.code}</span></td><td><StatusPill status={subject.isActive ? 'success' : 'neutral'}>{subject.isActive ? 'Aktif' : 'Nonaktif'}</StatusPill></td><td><button className="icon-button table-row-action" onClick={() => onDelete('subjects', subject.id)} title="Hapus mapel"><Trash2 size={15} /></button></td></tr>; })}</tbody></table>{!filteredSubjects.length && <EmptyState title="Mapel tidak ditemukan" description="Coba kata kunci lain atau tambahkan mata pelajaran baru." />}</div>}
      <div className="table-footer"><span>Menampilkan <strong>{activeTab === 'classes' ? filteredClasses.length : activeTab === 'teachers' ? filteredTeachers.length : filteredSubjects.length}</strong> dari {activeTab === 'classes' ? state.classes.length : activeTab === 'teachers' ? state.teachers.length : state.subjects.length} record</span><span><LockKeyhole size={12} /> Data disimpan pada perangkat ini</span></div>
    </Card>
  </>;
}

function RequirementsScreen({ state, formOpen, setFormOpen, form, setForm, onSave, onDelete, onGenerate, onNavigate }: {
  state: AppState; formOpen: boolean; setFormOpen: (value: boolean) => void; form: typeof emptyRequirementForm; setForm: (value: typeof emptyRequirementForm) => void; onSave: (event: FormEvent) => void; onDelete: (requirement: Requirement) => void; onGenerate: () => void; onNavigate: (screen: ScreenId) => void;
}) {
  const totalJP = state.requirements.reduce((sum, item) => sum + item.requiredJP, 0);
  const grouped = state.classes.filter((item) => item.isActive).map((schoolClass) => {
    const rows = state.requirements.filter((item) => item.classId === schoolClass.id);
    return { schoolClass, rows, total: rows.reduce((sum, item) => sum + item.requiredJP, 0) };
  });
  return <>
    <PageHeading kicker="CURRICULUM PLANNING" title="Kebutuhan & alokasi JP" description="Tetapkan jumlah JP setiap mapel untuk tiap kelas, lalu pasangkan dengan guru yang berkualifikasi." actions={<><Button variant="secondary" icon={ShieldCheck} onClick={() => onNavigate('validation')}>Validasi data</Button><Button icon={Plus} onClick={() => { setForm({ ...emptyRequirementForm, classId: state.classes.find((item) => item.isActive)?.id ?? '', subjectId: state.subjects.find((item) => item.isActive)?.id ?? '', teacherId: state.teachers.find((item) => item.isActive)?.id ?? '' }); setFormOpen(!formOpen); }}>Tambah alokasi</Button></>} />
    <div className="requirements-metric-grid"><div className="req-metric"><span>Total alokasi</span><strong>{totalJP} <small>JP / minggu</small></strong><div className="req-metric-mark"><BookOpen size={17} /></div></div><div className="req-metric"><span>Baris alokasi</span><strong>{state.requirements.length.toString().padStart(2, '0')} <small>entri</small></strong><div className="req-metric-mark amber"><LayersIcon size={17} /></div></div><div className="req-metric"><span>Rata-rata kelas</span><strong>{grouped.length ? Math.round(totalJP / grouped.length) : 0} <small>JP</small></strong><div className="req-metric-mark blue"><BarChart3 size={17} /></div></div><div className="req-metric"><span>Guru terlibat</span><strong>{new Set(state.requirements.map((item) => item.teacherId)).size.toString().padStart(2, '0')} <small>guru</small></strong><div className="req-metric-mark violet"><Users size={17} /></div></div></div>
    {formOpen && <Card className="requirement-form-card" eyebrow="NEW ALLOCATION" title="Tambah / perbarui alokasi JP" action={<button className="icon-button" onClick={() => setFormOpen(false)} aria-label="Tutup form"><X size={16} /></button>}><form className="requirement-form-grid" onSubmit={onSave}><div className="field-group"><label>Kelas</label><select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}><option value="">Pilih kelas</option>{state.classes.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="field-group"><label>Mata pelajaran</label><select required value={form.subjectId} onChange={(e) => { const subjectId = e.target.value; const teacher = state.teachers.find((item) => item.isActive && item.subjectIds.includes(subjectId)); setForm({ ...form, subjectId, teacherId: teacher?.id ?? '' }); }}><option value="">Pilih mapel</option>{state.subjects.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="field-group"><label>Guru pengampu</label><select required value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}><option value="">Pilih guru</option>{state.teachers.filter((item) => item.isActive && item.subjectIds.includes(form.subjectId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="field-group"><label>Alokasi (JP/minggu)</label><input required type="number" min="1" max="50" value={form.requiredJP} onChange={(e) => setForm({ ...form, requiredJP: e.target.value })} /></div><div className="requirement-form-actions"><Button type="submit" icon={Save}>Simpan alokasi</Button></div></form><div className="inline-info"><AlertCircle size={15} /><span>Jumlah alokasi per guru dijumlahkan lintas seluruh mata pelajaran dan dibandingkan dengan batas beban mingguan yang tercatat.</span></div></Card>}
    <div className="requirements-layout"><div className="requirements-class-list">{grouped.map(({ schoolClass, rows, total }) => { const cap = state.settings.activeDays.reduce((sum, day) => sum + teachingPeriodsForDay(state.slots, day).length, 0); return <div className="requirement-class-card" key={schoolClass.id}><div className="requirement-class-head"><div className="requirement-class-avatar">{schoolClass.name.slice(0, 2)}</div><div className="requirement-class-copy"><h3>{schoolClass.name}</h3><span>{rows.length} alokasi mata pelajaran</span></div><div className="requirement-total"><strong>{total}</strong><span>/ {cap} JP</span></div></div><div className="progress-track class-demand-bar"><span style={{ width: `${Math.min(100, cap ? total / cap * 100 : 0)}%` }} /></div><div className="requirement-row-list">{rows.map((req) => { const subject = getSubject(state, req.subjectId); const teacher = getTeacher(state, req.teacherId); return <div className="requirement-row" key={req.id}><span className="requirement-subject-mark" style={{ background: subject?.color }} /><div className="requirement-row-main"><strong>{subject?.name ?? 'Mapel dihapus'}</strong><span>{teacher?.name ?? 'Guru belum tersedia'}</span></div><div className="requirement-row-jp"><strong>{req.requiredJP}</strong><small>JP</small></div><button className="icon-button table-row-action" onClick={() => onDelete(req)} aria-label="Hapus alokasi"><Trash2 size={14} /></button></div>; })}{!rows.length && <div className="requirement-empty-row">Belum ada alokasi. Tambahkan mapel dan kebutuhan JP.</div>}</div></div>; })}</div><aside className="requirements-aside"><Card className="allocation-guidance-card" eyebrow="ALLOCATION GUIDE" title="Cek sebelum generate"><div className="guide-item"><div className="guide-item-icon"><CheckCircle2 size={15} /></div><div><strong>JP tidak melebihi kapasitas</strong><span>Setiap kelas tidak dapat melebihi slot KBM aktif dalam satu minggu.</span></div></div><div className="guide-item"><div className="guide-item-icon"><Users size={15} /></div><div><strong>Kualifikasi guru sesuai</strong><span>Guru hanya dapat dialokasikan pada mapel yang tercatat sebagai kualifikasinya.</span></div></div><div className="guide-item"><div className="guide-item-icon"><Clock3 size={15} /></div><div><strong>Beban kerja guru</strong><span>Total JP guru harus di bawah batas mingguan, lintas seluruh mapel.</span></div></div><div className="guide-item"><div className="guide-item-icon"><ShieldCheck size={15} /></div><div><strong>Validator final</strong><span>Hard constraint diperiksa ulang setelah generate, edit, restore, dan publish.</span></div></div><Button className="guide-full-button" onClick={onGenerate} icon={WandSparkles}>Buat kandidat jadwal</Button></Card><div className="requirements-note"><Sparkles size={16} /><div><strong>Quality over guesswork</strong><span>Soft preference seperti blok 2 JP meningkatkan mutu kandidat, tetapi tidak boleh melonggarkan aturan keras.</span></div></div></aside></div>
  </>;
}
function LayersIcon(props: React.ComponentProps<typeof BookOpen>) { return <BookOpen {...props} />; }

function ValidationScreen({ state, report, masterIssues, expandedIssue, setExpandedIssue, onNavigate, onValidate }: {
  state: AppState; report: ReturnType<typeof validateSchedule>; masterIssues: ValidationIssue[]; expandedIssue: string | null; setExpandedIssue: (id: string | null) => void; onNavigate: (screen: ScreenId) => void; onValidate: () => void;
}) {
  const combinedIssues = [...masterIssues, ...report.issues];
  const hardErrors = combinedIssues.filter((item) => item.severity === 'error');
  const warnings = combinedIssues.filter((item) => item.severity === 'warning');
  const info = combinedIssues.filter((item) => item.severity === 'info');
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiError, setAiError] = useState('');
  const visible = combinedIssues.filter((item) => filter === 'all' || item.severity === filter);
  const explainWithGemini = async () => {
    setAiBusy(true); setAiAnswer(''); setAiError('');
    // Only send static issue codes/titles/actions; do not send class, teacher, or school names.
    const selectedIssues = (hardErrors.length ? hardErrors : warnings).slice(0, 5);
    const issueSummary = selectedIssues.length
      ? selectedIssues.map((issue) => `${issue.code}: ${issue.title}. Tindakan umum: ${issue.action ?? 'Periksa input dan jalankan ulang validator.'}`).join('\n')
      : 'Tidak ada hard error yang tercatat pada pemeriksaan ini.';
    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue: issueSummary, question: 'Jelaskan arti temuan secara sederhana dan urutkan langkah perbaikan. Jangan mengesahkan jadwal; validator deterministik tetap menentukan validitas.' }),
      });
      const payload = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || `Permintaan AI gagal (HTTP ${response.status}).`);
      setAiAnswer(payload.answer || 'Tidak ada jawaban dari layanan AI.');
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Asisten AI tidak tersedia. Fungsi validator tetap berjalan.');
    } finally {
      setAiBusy(false);
    }
  };
  return <>
    <PageHeading kicker="RULE COMPLIANCE CENTER" title="Validasi & konflik" description="Setiap status valid berasal dari pemeriksaan kode deterministik. Gemini tidak dapat mengesahkan jadwal." actions={<><Button variant="secondary" icon={DatabaseIcon} onClick={() => onNavigate('requirements')}>Periksa alokasi</Button><Button icon={RefreshCw} onClick={onValidate}>Jalankan validasi</Button></>} />
    <div className={`validation-banner ${hardErrors.length ? 'validation-banner-warning' : 'validation-banner-good'}`}><div className="validation-banner-mark">{hardErrors.length ? <AlertTriangle size={25} /> : <ShieldCheck size={25} />}</div><div><div className="validation-banner-kicker">VALIDATOR RESULT · LOCAL RULE ENGINE</div><h2>{hardErrors.length ? 'Jadwal belum memenuhi semua aturan wajib.' : 'Tidak ditemukan pelanggaran hard constraint.'}</h2><p>{hardErrors.length ? 'Perbaiki semua masalah yang ditandai sebelum membuat versi publikasi.' : 'Pemeriksaan aturan wajib lolos pada snapshot data saat ini. Periksa juga soft warning dan kelengkapan kebutuhan JP.'}</p></div><div className="validation-banner-count"><strong>{hardErrors.length.toString().padStart(2, '0')}</strong><span>HARD ERRORS</span></div></div>
    <div className="validation-summary-grid"><div><div className="validation-summary-icon error"><XCircle size={18} /></div><div><strong>{hardErrors.length}</strong><span>Hard violations</span></div></div><div><div className="validation-summary-icon warning"><AlertTriangle size={18} /></div><div><strong>{warnings.length}</strong><span>Soft warnings</span></div></div><div><div className="validation-summary-icon info"><CircleHelp size={18} /></div><div><strong>{info.length}</strong><span>Informational</span></div></div><div><div className="validation-summary-icon teal"><FileCheck2 size={18} /></div><div><strong>{state.requirements.length}</strong><span>Alokasi yang diperiksa</span></div></div></div>
    {state.settings.geminiEnabled && <Card className="ai-explanation-card" eyebrow="OPTIONAL AI EXPLANATION" title="Bantuan penjelasan Gemini" action={<Button icon={Sparkles} onClick={() => { void explainWithGemini(); }} disabled={aiBusy}>{aiBusy ? 'Meminta penjelasan…' : 'Jelaskan temuan'}</Button>}><p className="settings-card-intro">Gemini hanya menerima kode, judul temuan, dan tindakan umum—bukan nama sekolah, kelas, atau guru. Jawaban AI adalah penjelasan, bukan keputusan validasi.</p>{aiError && <div className="ai-response-error"><AlertTriangle size={15} /><span>{aiError}</span></div>}{aiAnswer && <div className="ai-response-output"><Sparkles size={16} /><p>{aiAnswer}</p></div>}</Card>}
    <Card className="validation-issues-card" eyebrow="ISSUE REGISTER" title="Daftar temuan" action={<div className="validation-filter"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Semua <span>{combinedIssues.length}</span></button><button className={filter === 'error' ? 'active' : ''} onClick={() => setFilter('error')}>Error <span>{hardErrors.length}</span></button><button className={filter === 'warning' ? 'active' : ''} onClick={() => setFilter('warning')}>Warning <span>{warnings.length}</span></button></div>}>
      {!visible.length ? <EmptyState icon={ShieldCheck} title="Tidak ada temuan pada filter ini" description="Semua pemeriksaan yang tersedia sudah bersih atau belum ada jadwal untuk diperiksa." /> : <div className="issue-list">{visible.map((issue) => <div className={`issue-item issue-${issue.severity}`} key={`${issue.code}-${issue.id}`}><button className="issue-item-main" onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}><div className="issue-severity-icon">{issue.severity === 'error' ? <XCircle size={18} /> : issue.severity === 'warning' ? <AlertTriangle size={18} /> : <CircleHelp size={18} />}</div><div className="issue-copy"><div className="issue-title-row"><strong>{issue.title}</strong><span className="issue-code">{issue.code}</span></div><p>{issue.message}</p>{issue.context && <span className="issue-context">{issue.context}</span>}</div><ChevronDown className={`issue-chevron ${expandedIssue === issue.id ? 'is-open' : ''}`} size={17} /></button>{expandedIssue === issue.id && <div className="issue-expanded"><div><span>Rekomendasi tindakan</span><p>{issue.action ?? 'Periksa data terkait dan jalankan validasi ulang.'}</p></div><Button variant="secondary" icon={ArrowRight} onClick={() => onNavigate(issue.code.startsWith('DATA-') ? 'master' : issue.code.includes('REQUIREMENT') || issue.code.includes('ALLOCATION') ? 'requirements' : 'schedule')}>Buka area terkait</Button></div>}</div>)}</div>}
      <div className="validation-footnote"><ShieldCheck size={14} /><span>Validator versi <strong>SIGNAL-validator/1.0.0</strong> · validasi ulang diwajibkan setelah edit, import, restore, dan sebelum publikasi.</span></div>
    </Card>
  </>;
}

function HistoryScreen({ state, onRestore, onNavigate }: { state: AppState; onRestore: (version: ScheduleVersion) => void; onNavigate: (screen: ScreenId) => void }) {
  return <>
    <PageHeading kicker="VERSION CONTROL" title="Riwayat versi" description="Snapshot publikasi disimpan pada browser ini. Restore membuat draft baru dan harus divalidasi kembali." actions={<Button variant="secondary" icon={CalendarDays} onClick={() => onNavigate('schedule')}>Buka jadwal</Button>} />
    <div className="history-overview-strip"><div><span>VERSI AKTIF</span><strong>{state.history[0] ? `v${state.history[0].version}` : 'Belum ada'}</strong><small>{state.history[0]?.label ?? 'Publikasikan draft valid untuk membuat snapshot pertama.'}</small></div><div><span>TOTAL SNAPSHOT</span><strong>{state.history.length.toString().padStart(2, '0')}</strong><small>Versi yang tersimpan secara lokal</small></div><div><span>DATA MODE</span><strong>Local-first</strong><small>Backup manual tetap diperlukan</small></div></div>
    <Card className="history-timeline-card" eyebrow="VERSION TIMELINE" title="Snapshot publikasi">{!state.history.length ? <EmptyState icon={History} title="Belum ada versi publikasi" description="Setelah draft lolos seluruh hard constraint, terbitkan jadwal untuk menyimpan snapshot pertama." action={<Button icon={CalendarDays} onClick={() => onNavigate('schedule')}>Buka workspace jadwal</Button>} /> : <div className="version-timeline">{state.history.map((version, index) => <div className="version-row" key={version.id}><div className="timeline-track"><div className={`timeline-dot ${index === 0 ? 'current' : ''}`}>{index === 0 ? <Check size={13} /> : <span />}</div>{index !== state.history.length - 1 && <div className="timeline-line" />}</div><div className="version-main"><div className="version-title-row"><div><div className="version-kicker">{index === 0 ? 'ACTIVE VERSION' : `ARCHIVE · VERSION ${version.version}`}</div><h3>{version.label}</h3></div><div className="version-actions">{index === 0 && <StatusPill status="success">Current</StatusPill>}<Button variant="secondary" icon={RefreshCw} onClick={() => onRestore(version)}>Restore ke draft</Button></div></div><div className="version-meta"><span><Clock3 size={13} /> {formatShortDate(version.createdAt)}</span><span><CalendarDays size={13} /> {version.entryCount} penempatan</span><span><ShieldCheck size={13} /> {version.validatorVersion}</span><span><FileCheck2 size={13} /> Fingerprint {version.fingerprint}</span></div></div></div>)}</div>}</Card>
    <div className="history-warning"><AlertTriangle size={17} /><div><strong>Perhatian tentang penyimpanan lokal</strong><span>Snapshot hanya berada di browser/perangkat ini. Menghapus site data dapat menghapus seluruh riwayat; ekspor backup JSON secara berkala.</span></div><Button variant="secondary" icon={Archive} onClick={() => onNavigate('backup')}>Buka backup</Button></div>
  </>;
}

function BackupScreen({ state, onBackup, onImport, onExportCSV, onExportJSON }: { state: AppState; onBackup: () => void; onImport: (file?: File) => void; onExportCSV: () => void; onExportJSON: () => void }) {
  return <>
    <PageHeading kicker="PORTABILITY & RECOVERY" title="Ekspor & backup" description="Data disimpan lokal. Buat backup sebelum mengganti perangkat atau membersihkan browser." actions={<Button icon={Download} onClick={onBackup}>Buat backup penuh</Button>} />
    <div className="backup-status-panel"><div className="backup-status-icon"><Archive size={23} /></div><div className="backup-status-copy"><div className="backup-status-label">LOCAL DATA · INDEXEDDB</div><h2>Data tersimpan pada browser ini.</h2><p>Workspace tidak otomatis tersinkron ke cloud atau perangkat lain. Backup adalah tanggung jawab operator.</p></div><div className="backup-last"><span>BACKUP TERAKHIR</span><strong>{state.lastBackupAt ? formatShortDate(state.lastBackupAt) : 'Belum pernah'}</strong><StatusPill status={state.lastBackupAt ? 'success' : 'warning'}>{state.lastBackupAt ? 'Backup tersedia' : 'Perlu backup'}</StatusPill></div></div>
    <div className="backup-actions-grid"><div className="backup-action-card"><div className="backup-action-icon json"><FileCheck2 size={21} /></div><div className="backup-action-copy"><div className="backup-action-kicker">RECOMMENDED · FULL SNAPSHOT</div><h3>Backup penuh</h3><p>Ekspor data master, kebutuhan JP, struktur waktu, draft, versi, dan pengaturan ke file JSON.</p><ul><li>Berisi seluruh workspace</li><li>Format versioned + checksum</li><li>Untuk pemulihan lintas browser</li></ul><Button icon={Download} onClick={onBackup}>Download backup JSON</Button></div></div><div className="backup-action-card"><div className="backup-action-icon csv"><FileSpreadsheet size={21} /></div><div className="backup-action-copy"><div className="backup-action-kicker">SHAREABLE SCHEDULE</div><h3>Ekspor jadwal</h3><p>Ekspor daftar penempatan sebagai CSV/JSON untuk analisis, pencetakan, atau pemrosesan lanjutan.</p><ul><li>CSV bisa dibuka di spreadsheet</li><li>JSON cocok untuk integrasi</li><li>Hanya mengekspor jadwal saat ini</li></ul><div className="backup-button-row"><Button variant="secondary" icon={FileSpreadsheet} onClick={onExportCSV}>Ekspor CSV</Button><Button variant="secondary" icon={Download} onClick={onExportJSON}>Ekspor JSON</Button></div></div></div></div>
    <Card className="restore-card" eyebrow="RESTORE WORKSPACE" title="Pulihkan dari backup"><div className="restore-dropzone"><div className="restore-icon"><Upload size={21} /></div><h3>Impor file backup SIGNAL</h3><p>Pilih file JSON hasil ekspor dari SIGNAL. Data lokal saat ini akan diganti setelah preview dan konfirmasi.</p><label className="button button-secondary file-pick-button"><Upload size={15} /> Pilih file JSON<input type="file" accept="application/json,.json" onChange={(e) => { const file = e.target.files?.[0]; if (file) onImport(file); e.currentTarget.value = ''; }} /></label><div className="restore-guardrail"><ShieldCheck size={15} /><span>Format dan versi skema diperiksa sebelum data diterapkan. Checksum bukan enkripsi.</span></div></div></Card>
    <div className="privacy-note"><LockKeyhole size={17} /><div><strong>Kerahasiaan data</strong><span>Aplikasi ini publik tanpa login dan tidak memiliki sinkronisasi cloud bersama. Gunakan data seminimal mungkin, kunci perangkat, dan simpan backup di lokasi yang operator kendalikan. Siapa pun yang mendapatkan URL publik tetap dapat membuka aplikasi.</span></div></div>
  </>;
}

function SettingsScreen({ state, onSettingsChange, onReset, onNavigate, onSave, saved }: { state: AppState; onSettingsChange: (changes: Partial<AppState['settings']>) => void; onReset: () => void; onNavigate: (screen: ScreenId) => void; onSave: () => void; saved: boolean }) {
  const [schoolName, setSchoolName] = useState(state.settings.schoolName);
  const [academicYear, setAcademicYear] = useState(state.settings.academicYear);
  const [semester, setSemester] = useState(state.settings.semester);
  const [periods, setPeriods] = useState(String(state.settings.teachingPeriodsPerDay));
  const [maxDailyJP, setMaxDailyJP] = useState(String(state.settings.maxDailyJP));
  const [searchLimit, setSearchLimit] = useState(String(state.settings.searchLimit));
  const [activeDays, setActiveDays] = useState<Day[]>(state.settings.activeDays);
  const [breaks, setBreaks] = useState<number[]>(state.settings.breakAfterJP);
  const [geminiEnabled, setGeminiEnabled] = useState(state.settings.geminiEnabled);
  const saveSettings = () => {
    const next = {
      schoolName: schoolName.trim() || 'SIGNAL Academic Studio', academicYear: academicYear.trim() || '2026/2027', semester,
      teachingPeriodsPerDay: Math.min(Number(maxDailyJP), Math.max(1, Number(periods))), maxDailyJP: Math.min(10, Math.max(1, Number(maxDailyJP))),
      searchLimit: Math.min(100000, Math.max(1500, Number(searchLimit) || 65000)), activeDays, breakAfterJP: breaks.filter((value) => value < Number(periods)), geminiEnabled,
    };
    onSettingsChange(next); onSave();
  };
  return <>
    <PageHeading kicker="WORKSPACE PREFERENCES" title="Pengaturan workspace" description="Identitas akademik, struktur KBM, batas generator, dan perilaku AI opsional." actions={<Button icon={Save} onClick={saveSettings}>{saved ? 'Tersimpan' : 'Simpan pengaturan'}</Button>} />
    <div className="settings-layout"><div className="settings-main-column">
      <Card className="settings-card" eyebrow="SCHOOL IDENTITY" title="Identitas akademik"><div className="settings-form-grid"><div className="field-group field-span-two"><label>Nama sekolah / madrasah</label><input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Nama sekolah" /></div><div className="field-group"><label>Tahun ajaran</label><input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026/2027" /></div><div className="field-group"><label>Semester aktif</label><select value={semester} onChange={(e) => setSemester(e.target.value as 'Ganjil' | 'Genap')}><option>Ganjil</option><option>Genap</option></select></div></div></Card>
      <Card className="settings-card" eyebrow="TIME STRUCTURE" title="Struktur waktu KBM"><p className="settings-card-intro">`Jam ke-` adalah urutan slot; JP KBM hanya dihitung untuk slot belajar. Istirahat bukan JP KBM.</p><div className="settings-form-grid"><div className="field-group"><label>Maksimum JP KBM per hari</label><select value={maxDailyJP} onChange={(e) => { setMaxDailyJP(e.target.value); if (Number(periods) > Number(e.target.value)) setPeriods(e.target.value); }}><option value="6">6 JP / hari</option><option value="7">7 JP / hari</option><option value="8">8 JP / hari</option><option value="9">9 JP / hari</option><option value="10">10 JP / hari</option></select></div><div className="field-group"><label>Slot belajar pada template</label><select value={periods} onChange={(e) => setPeriods(e.target.value)}>{Array.from({ length: Math.max(1, Number(maxDailyJP)) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} JP per hari</option>)}</select></div></div><div className="field-group"><label>Hari KBM aktif</label><div className="day-toggle-grid">{DAYS.map((day) => <label key={day} className={`day-toggle ${activeDays.includes(day) ? 'selected' : ''}`}><input type="checkbox" checked={activeDays.includes(day)} onChange={(e) => setActiveDays(e.target.checked ? [...activeDays, day] : activeDays.filter((item) => item !== day))} /><span>{day.slice(0, 3).toUpperCase()}</span><strong>{day}</strong><i>{activeDays.includes(day) ? <Check size={13} /> : <Plus size={13} />}</i></label>)}</div></div><div className="field-group"><label>Letak istirahat setelah JP KBM</label><div className="break-toggle-row">{[2, 3, 4, 5, 6, 7].map((jp) => <button key={jp} type="button" className={breaks.includes(jp) ? 'selected' : ''} onClick={() => setBreaks(breaks.includes(jp) ? breaks.filter((item) => item !== jp) : [...breaks, jp].sort((a, b) => a - b))}>JP {jp}{breaks.includes(jp) && <Check size={12} />}</button>)}</div><small>Istirahat hanya ditampilkan pada struktur waktu; tidak dihitung sebagai JP KBM.</small></div></Card>
      <Card className="settings-card" eyebrow="GENERATOR CONTROL" title="Batas pencarian"><div className="settings-form-grid"><div className="field-group"><label>Search node limit</label><select value={searchLimit} onChange={(e) => setSearchLimit(e.target.value)}><option value="15000">15.000 · cepat</option><option value="35000">35.000 · seimbang</option><option value="65000">65.000 · detail</option><option value="100000">100.000 · maksimum</option></select><small>Batas tinggi bisa memerlukan waktu lebih lama; kegagalan pada batas tidak membuktikan infeasibility.</small></div><div className="settings-stat-tile"><div><Activity size={17} /><span>ENGINE</span></div><strong>Deterministic backtracking</strong><small>Local compute · tidak ada biaya AI untuk generate</small></div></div></Card>
      <Card className="settings-card" eyebrow="AI ASSISTANT · OPTIONAL" title="Gemini API"><div className="ai-setting-row"><div className="ai-setting-icon"><Sparkles size={20} /></div><div className="ai-setting-copy"><strong>Asisten penjelasan Gemini</strong><p>Fitur AI dapat membantu menjelaskan konflik atau error dalam bahasa alami. Validator tetap menjadi satu-satunya sumber validitas jadwal.</p><div className="ai-setting-state"><StatusPill status={geminiEnabled ? 'warning' : 'neutral'}>{geminiEnabled ? 'Permintaan aktivasi tersimpan' : 'OFF secara default'}</StatusPill><span>Server-side secret diperlukan; jangan menaruh API key di browser.</span></div></div><button className={`toggle-switch ${geminiEnabled ? 'is-on' : ''}`} role="switch" aria-checked={geminiEnabled} onClick={() => setGeminiEnabled(!geminiEnabled)}><span /></button></div><div className="ai-warning"><AlertTriangle size={15} /><span>Aplikasi publik tanpa login memungkinkan pihak lain memanggil endpoint AI jika diaktifkan. Pengaturan UI ini tidak mengaktifkan server dengan sendirinya; server juga membutuhkan <code>ENABLE_GEMINI_ASSISTANT=true</code>. Periksa kuota dan risiko penyalahgunaan sebelum mengaktifkannya.</span></div><div className="settings-external-links"><a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer">Kuota & billing Gemini <ArrowUpRight size={12} /></a><a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Ketentuan Gemini API <ArrowUpRight size={12} /></a></div></Card>
    </div><aside className="settings-side-column"><div className="settings-glance-card"><div className="settings-glance-head"><div className="settings-glance-seal"><Settings2 size={19} /></div><div><span>CONFIGURATION</span><h3>System snapshot</h3></div></div><div className="settings-glance-row"><span>Storage</span><strong>IndexedDB · Local</strong></div><div className="settings-glance-row"><span>Auth model</span><strong>Public · No login</strong></div><div className="settings-glance-row"><span>Validator</span><strong>Deterministic</strong></div><div className="settings-glance-row"><span>AI status</span><StatusPill status={geminiEnabled ? 'warning' : 'neutral'}>{geminiEnabled ? 'Requested ON' : 'OFF'}</StatusPill></div><div className="settings-glance-row"><span>Dataset</span><strong>{state.dataMode === 'demo' ? 'Demo' : 'Custom'}</strong></div><div className="settings-glance-bottom"><ShieldCheck size={15} /><span>Perubahan konfigurasi memengaruhi generator berikutnya. Jadwal yang ada harus divalidasi ulang.</span></div></div><div className="settings-danger-card"><div className="settings-danger-icon"><RefreshCw size={18} /></div><h3>Reset workspace</h3><p>Ganti kembali seluruh data lokal ke dataset demo awal. Tindakan ini menghapus perubahan yang belum dibackup.</p><Button variant="danger" icon={RefreshCw} onClick={onReset}>Reset ke dataset demo</Button></div><div className="settings-help-card"><CircleHelp size={19} /><div><strong>Perlu meninjau data?</strong><span>Jalankan validasi master dan jadwal untuk mengetahui masalah sebelum publikasi.</span><button onClick={() => onNavigate('validation')}>Buka validation center <ArrowRight size={13} /></button></div></div></aside></div>
  </>;
}
