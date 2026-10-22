import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock,
  Clock3,
  Command,
  Download,
  Edit2,
  FileCheck2,
  FileSpreadsheet,
  GraduationCap,
  History,
  Info,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Undo2,
  Upload,
  UserCheck,
  Users,
  WandSparkles,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type {
  ActivityType,
  AppState,
  Day,
  GeneratorStatus,
  PeriodDefinition,
  Requirement,
  ScheduleEntry,
  ScheduleVersion,
  SchoolClass,
  Subject,
  Teacher,
  ValidationIssue,
} from './domain/types';
import { DAYS } from './domain/types';
import {
  buildTimeSlots,
  clockToMinutes,
  createDefaultPeriodDefinitions,
  isSlotBlocked,
  teachingPeriodsForDay,
  toClock,
} from './domain/time';
import { createDemoState } from './domain/seed';
import { generateSchedule } from './domain/generator';
import { buildScheduleFingerprint, validateMasterData, validateSchedule } from './domain/validator';
import { exportAppState, loadAppState, parseBackupFile, saveAppState } from './storage/db';
import { WorkloadDashboard } from './components/WorkloadDashboard';
import { AttendanceScreen } from './components/AttendanceScreen';
import { QuickValidationModal } from './components/QuickValidationModal';
import { SchedulePdfExportModal } from './components/SchedulePdfExportModal';
import { EntityEditModal, type EntityEditTarget } from './components/EntityEditModal';
import { AiConflictHelper } from './components/AiConflictHelper';
import { InfoNotice } from './components/InfoNotice';

type ScreenId =
  | 'overview'
  | 'schedule'
  | 'workload'
  | 'attendance'
  | 'generator'
  | 'master'
  | 'requirements'
  | 'validation'
  | 'history'
  | 'backup'
  | 'settings';

const DatabaseIcon: LucideIcon = Activity;

const navItems: Array<{ id: ScreenId; label: string; icon: LucideIcon; section?: string }> = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard, section: 'WORKSPACE' },
  { id: 'schedule', label: 'Jadwal Pelajaran', icon: CalendarDays },
  { id: 'workload', label: 'Beban Guru', icon: BarChart3 },
  { id: 'attendance', label: 'Absensi Guru', icon: UserCheck },
  { id: 'generator', label: 'Generator', icon: WandSparkles },
  { id: 'master', label: 'Data Master', icon: DatabaseIcon },
  { id: 'requirements', label: 'Kebutuhan & Alokasi', icon: BookOpen },
  { id: 'validation', label: 'Validasi & Konflik', icon: ShieldCheck, section: 'GOVERNANCE' },
  { id: 'history', label: 'Riwayat Versi', icon: History },
  { id: 'backup', label: 'Ekspor & Backup', icon: Archive, section: 'DATA CONTROL' },
  { id: 'settings', label: 'Pengaturan', icon: Settings2 },
];

type MasterTab = 'classes' | 'teachers' | 'subjects';
type AddType = 'class' | 'teacher' | 'subject' | null;
interface EditSlotContext { classId: string; day: Day; jpNo: number }
interface ToastData { message: string; kind: 'success' | 'warning' | 'error' | 'info' }

const emptyMasterForm = { name: '', level: 'VII', code: '', maxWeeklyJP: '24', selectedSubjectIds: [] as string[], color: '#2f7771' };
const emptyRequirementForm = { classId: '', subjectId: '', teacherId: '', requiredJP: '4' };

function titleForScreen(screen: ScreenId) {
  const titles: Record<ScreenId, string> = {
    overview: 'Beranda kerja operator',
    schedule: 'Jadwal pelajaran',
    workload: 'Statistik beban guru',
    attendance: 'Presensi & absensi guru',
    generator: 'Schedule generator',
    master: 'Data master',
    requirements: 'Kebutuhan & alokasi JP',
    validation: 'Validasi & konflik',
    history: 'Riwayat versi',
    backup: 'Ekspor & backup',
    settings: 'Pengaturan workspace',
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
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  const [customTeacherName, setCustomTeacherName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratorResult, setLastGeneratorResult] = useState<{ status: GeneratorStatus; message: string; nodes: number } | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Quick Validation Modal state
  const [quickValidationOpen, setQuickValidationOpen] = useState(false);

  // PDF Export Modal state
  const [pdfExportOpen, setPdfExportOpen] = useState(false);

  // Entity Edit / Create Modal state
  const [entityModalTarget, setEntityModalTarget] = useState<EntityEditTarget | null>(null);

  // Undo last schedule change
  const [lastMoveHistory, setLastMoveHistory] = useState<{ entries: ScheduleEntry[]; description: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    loadAppState().then((loaded) => {
      if (!mounted) return;
      setWorkspace(loaded);
      setSelectedClass(loaded.classes.find((item) => item.isActive)?.id ?? '');
      setReqForm((prev) => ({
        ...prev,
        classId: loaded.classes.find((item) => item.isActive)?.id ?? '',
        subjectId: loaded.subjects[0]?.id ?? '',
        teacherId: loaded.teachers[0]?.id ?? '',
      }));
      setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready || !workspace) return;
    saveAppState(workspace).catch((error) => {
      console.error('Could not persist SIGNAL data:', error);
      setToast({ message: 'Penyimpanan lokal tidak tersedia. Segera ekspor backup sebelum menutup.', kind: 'warning' });
    });
  }, [workspace, ready]);

  const notify = useCallback((message: string, kind: ToastData['kind'] = 'success') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 4500);
  }, []);

  const updateWorkspace = useCallback((updater: (current: AppState) => AppState, markCustom = false) => {
    setWorkspace((current) => {
      if (!current) return current;
      const updated = updater(current);
      return markCustom ? { ...updated, dataMode: 'custom' } : updated;
    });
  }, []);

  const currentEntries = workspace?.draft ?? workspace?.activeSchedule ?? [];
  const report = useMemo(() => (workspace ? validateSchedule(workspace, currentEntries, { strictCoverage: true, includeSoftWarnings: true }) : null), [workspace, currentEntries]);
  const masterIssues = useMemo(() => (workspace ? validateMasterData(workspace) : []), [workspace]);
  const activeClassCount = workspace?.classes.filter((item) => item.isActive).length ?? 0;
  const occupiedSlots = currentEntries.length;
  const totalWeeklyCapacity = workspace
    ? workspace.settings.activeDays.reduce((sum, day) => sum + teachingPeriodsForDay(workspace.slots, day).length, 0) * activeClassCount
    : 0;
  const subjectCounts = workspace?.subjects.filter((item) => item.isActive).length ?? 0;
  const activeTeachersCount = workspace?.teachers.filter((item) => item.isActive).length ?? 0;
  const readiness =
    workspace && activeClassCount > 0 && activeTeachersCount > 0 && subjectCounts > 0 && workspace.requirements.length > 0
      ? Math.max(0, Math.min(100, Math.round(100 - masterIssues.filter((item) => item.severity === 'error').length * 12 - (report?.hardErrorCount ?? 0) * 2)))
      : 0;

  const navigate = (next: ScreenId) => {
    setScreen(next);
    setSidebarOpen(false);
    setAddType(null);
    setReqFormOpen(false);
  };

  const handlePeriodConfig = (changes: Partial<AppState['settings']>) => {
    updateWorkspace((current) => {
      const settings = { ...current.settings, ...changes };
      return { ...current, settings, slots: buildTimeSlots(settings) };
    }, true);
    setSettingsSaved(true);
    notify('Struktur waktu dan kegiatan KBM diperbarui.', 'success');
  };

  // Primary Action: Buat Jadwal in 1-Click
  const handleGenerate = () => {
    if (!workspace) return;
    setIsGenerating(true);
    setLastGeneratorResult({ status: 'RUNNING', message: 'Menyiapkan constraint dan mencari susunan jadwal optimal…', nodes: 0 });

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
        notify('Jadwal berhasil disusun dan lolos seluruh hard constraint.', 'success');
        setScreen('schedule');
      } else {
        notify(result.message, result.status === 'INVALID_INPUT' ? 'warning' : 'error');
        if (result.status === 'INVALID_INPUT') {
          setQuickValidationOpen(true);
        }
      }
    }, 80);
  };

  const chooseCandidate = (candidateId: string) => {
    if (!workspace) return;
    const candidate = workspace.candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    const check = validateSchedule(workspace, candidate.entries, { strictCoverage: true, includeSoftWarnings: true });
    if (!check.valid) {
      notify('Kandidat tidak lolos validasi terbaru; tidak diterapkan.', 'error');
      return;
    }
    updateWorkspace((current) => ({ ...current, draft: candidate.entries, dataMode: 'custom' }));
    notify('Kandidat diterapkan sebagai draft. Jadwal aktif belum berubah.', 'success');
    setScreen('schedule');
  };

  // Drag and Drop Placement with Deterministic Collision Guard
  const handleDropSlot = (source: { classId: string; day: Day; jpNo: number }, target: { day: Day; jpNo: number }) => {
    if (!workspace) return;
    if (source.day === target.day && source.jpNo === target.jpNo) return;

    // 1. Check if target slot is a blocked activity (Upacara, Istirahat, Religi, Kegiatan Lain)
    const targetSlotDef = workspace.slots.find(
      (s) => s.day === target.day && (s.order === target.jpNo || (s.kind === 'TEACHING' && s.jpNo === target.jpNo)),
    );
    if (isSlotBlocked(targetSlotDef)) {
      notify(`Tidak dapat dipindahkan: Jam tersebut diblokir oleh kegiatan ${targetSlotDef?.label || 'non-KBM'}.`, 'error');
      return;
    }

    const currentList = workspace.draft ?? workspace.activeSchedule ?? [];
    const sourceEntry = currentList.find((e) => e.classId === source.classId && e.day === source.day && e.jpNo === source.jpNo);
    if (!sourceEntry) return;

    // 2. Check if moving sourceEntry's teacher to target slot conflicts with another class
    const teacherClash = currentList.find(
      (e) => e.day === target.day && e.jpNo === target.jpNo && e.teacherId === sourceEntry.teacherId && e.classId !== source.classId,
    );
    if (teacherClash) {
      const clashClass = getClass(workspace, teacherClash.classId)?.name || teacherClash.classId;
      const teacherName = getTeacher(workspace, sourceEntry.teacherId)?.name || 'Guru';
      notify(`Bentrok jadwal: ${teacherName} sedang mengajar di Kelas ${clashClass} pada ${target.day} JP ${target.jpNo}.`, 'error');
      return;
    }

    // 3. Check if target slot has an existing entry in the SAME class (SWAP)
    const targetEntry = currentList.find(
      (e) => e.classId === source.classId && e.day === target.day && e.jpNo === target.jpNo,
    );

    if (targetEntry) {
      // Reverse clash check for swapped teacher
      const reverseClash = currentList.find(
        (e) => e.day === source.day && e.jpNo === source.jpNo && e.teacherId === targetEntry.teacherId && e.classId !== source.classId,
      );
      if (reverseClash) {
        const reverseClass = getClass(workspace, reverseClash.classId)?.name || reverseClash.classId;
        const targetTeacherName = getTeacher(workspace, targetEntry.teacherId)?.name || 'Guru';
        notify(`Tidak dapat menukar: ${targetTeacherName} bentrok di Kelas ${reverseClass} pada ${source.day} JP ${source.jpNo}.`, 'error');
        return;
      }

      // Save for Undo
      setLastMoveHistory({ entries: [...currentList], description: `Menukar pelajaran JP ${source.jpNo} dan JP ${target.jpNo}` });

      // Apply swap
      const updated = currentList.map((e) => {
        if (e.id === sourceEntry.id) return { ...e, day: target.day, jpNo: target.jpNo };
        if (e.id === targetEntry.id) return { ...e, day: source.day, jpNo: source.jpNo };
        return e;
      });

      updateWorkspace((current) => ({ ...current, draft: updated }), true);
      notify(`Pelajaran ditukar ke ${target.day} JP ${target.jpNo}. Tersimpan.`, 'success');
      return;
    }

    // Move to empty target slot
    setLastMoveHistory({ entries: [...currentList], description: `Memindahkan pelajaran ke ${target.day} JP ${target.jpNo}` });
    const updated = currentList.map((e) => (e.id === sourceEntry.id ? { ...e, day: target.day, jpNo: target.jpNo } : e));
    updateWorkspace((current) => ({ ...current, draft: updated }), true);
    notify(`Pelajaran dipindahkan ke ${target.day} JP ${target.jpNo}. Tersimpan.`, 'success');
  };

  const handleUndoMove = () => {
    if (!lastMoveHistory || !workspace) return;
    updateWorkspace((current) => ({ ...current, draft: lastMoveHistory.entries }), true);
    notify(`Perubahan dibatalkan: ${lastMoveHistory.description}.`, 'info');
    setLastMoveHistory(null);
  };

  const openSlotEditor = (classId: string, day: Day, jpNo: number) => {
    if (!workspace) return;
    const entry = getEntry(workspace, classId, day, jpNo);
    setEditingSlot({ classId, day, jpNo });
    setEditingSubject(entry?.subjectId ?? '');
    setEditingTeacher(entry?.teacherId ?? '');
    setCustomTeacherName('');
  };

  const saveSlotEditor = (event: FormEvent) => {
    event.preventDefault();
    if (!workspace || !editingSlot) return;
    const { classId, day, jpNo } = editingSlot;

    let targetTeacherId = editingTeacher;
    let nextTeachers = [...workspace.teachers];

    if (editingTeacher === '__NEW_CUSTOM__') {
      if (!customTeacherName.trim()) {
        notify('Mohon masukkan nama guru baru atau guru tamu.', 'warning');
        return;
      }
      const newTeacherId = `TCH-EXT-${Date.now().toString(36)}`;
      const initials = customTeacherName
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 4)
        .toUpperCase();

      const newTeacher: Teacher = {
        id: newTeacherId,
        name: customTeacherName.trim(),
        code: initials || 'GT',
        subjectIds: editingSubject ? [editingSubject] : [],
        maxWeeklyJP: 30,
        isActive: true,
      };
      nextTeachers.push(newTeacher);
      targetTeacherId = newTeacherId;
    } else if (editingTeacher && editingSubject) {
      const tIdx = nextTeachers.findIndex((t) => t.id === editingTeacher);
      if (tIdx >= 0 && !nextTeachers[tIdx].subjectIds.includes(editingSubject)) {
        nextTeachers[tIdx] = {
          ...nextTeachers[tIdx],
          subjectIds: [...nextTeachers[tIdx].subjectIds, editingSubject],
        };
      }
    }

    updateWorkspace((current) => {
      const previous = current.draft ?? current.activeSchedule ?? [];
      const without = previous.filter((entry) => !(entry.classId === classId && entry.day === day && entry.jpNo === jpNo));
      const next = editingSubject && targetTeacherId ? [...without, {
        id: `MAN-${Date.now().toString(36)}`, classId, day, jpNo, subjectId: editingSubject, teacherId: targetTeacherId,
      }] : without;
      return {
        ...current,
        teachers: nextTeachers,
        draft: next,
        dataMode: 'custom',
      };
    }, true);
    setEditingSlot(null);
    setCustomTeacherName('');
    notify('Perubahan jadwal disimpan sebagai draft. Berhasil.', 'success');
  };

  const publishDraft = () => {
    if (!workspace) return;
    const entries = workspace.draft ?? workspace.activeSchedule ?? [];
    const check = validateSchedule(workspace, entries, { strictCoverage: true, includeSoftWarnings: true });
    if (!check.valid) {
      notify(`Publikasi diblokir: ${check.hardErrorCount} pelanggaran aturan wajib masih ditemukan.`, 'error');
      setQuickValidationOpen(true);
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
    updateWorkspace((current) => ({
      ...current,
      activeSchedule: entries.map((entry) => ({ ...entry })),
      draft: null,
      history: [version, ...current.history],
    }));
    notify(`Jadwal diterbitkan sebagai Versi ${nextVersion}. Snapshot tersimpan.`, 'success');
    setScreen('history');
  };

  const restoreVersion = (version: ScheduleVersion) => {
    if (!workspace) return;
    updateWorkspace((current) => ({ ...current, draft: version.entries.map((entry) => ({ ...entry })), dataMode: 'custom' }));
    const check = validateSchedule(workspace, version.entries, { strictCoverage: true, includeSoftWarnings: false });
    notify(check.valid ? `Versi ${version.version} dipulihkan sebagai draft.` : `Versi ${version.version} dimuat ke draft, perlu validasi ulang.`, check.valid ? 'success' : 'warning');
    setScreen('schedule');
  };

  const saveMasterForm = (event: FormEvent) => {
    event.preventDefault();
    if (!workspace || !addType) return;
    if (!masterForm.name.trim()) { notify('Nama tidak boleh kosong.', 'warning'); return; }
    if (addType === 'class') {
      const name = masterForm.name.trim();
      if (workspace.classes.some((item) => item.name.toLowerCase() === name.toLowerCase())) { notify('Nama kelas sudah ada.', 'warning'); return; }
      const newClass = { id: `CLS-${Date.now().toString(36)}`, name, level: masterForm.level, isActive: true };
      updateWorkspace((current) => ({ ...current, classes: [...current.classes, newClass] }), true);
      setSelectedClass(newClass.id);
      notify(`Kelas ${name} ditambahkan.`);
    } else if (addType === 'teacher') {
      if (!masterForm.selectedSubjectIds.length) { notify('Pilih minimal satu kualifikasi mapel.', 'warning'); return; }
      const teacher: Teacher = { id: `TCH-${Date.now().toString(36)}`, code: masterForm.code.trim() || `T-${workspace.teachers.length + 1}`, name: masterForm.name.trim(), subjectIds: masterForm.selectedSubjectIds, maxWeeklyJP: Math.max(1, Number(masterForm.maxWeeklyJP) || 24), isActive: true };
      updateWorkspace((current) => ({ ...current, teachers: [...current.teachers, teacher] }), true);
      notify(`Guru ${teacher.name} ditambahkan.`);
    } else {
      const name = masterForm.name.trim();
      if (workspace.subjects.some((item) => item.name.toLowerCase() === name.toLowerCase())) { notify('Nama mapel sudah ada.', 'warning'); return; }
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
        return {
          ...current,
          classes: current.classes.filter((item) => item.id !== id),
          requirements: current.requirements.filter((item) => item.classId !== id),
          draft: (current.draft ?? []).filter((item) => item.classId !== id),
          activeSchedule: (current.activeSchedule ?? []).filter((item) => item.classId !== id),
        };
      }
      if (kind === 'teachers') {
        return {
          ...current,
          teachers: current.teachers.filter((item) => item.id !== id),
          requirements: current.requirements.filter((item) => item.teacherId !== id),
          draft: (current.draft ?? []).filter((item) => item.teacherId !== id),
          activeSchedule: (current.activeSchedule ?? []).filter((item) => item.teacherId !== id),
        };
      }
      return {
        ...current,
        subjects: current.subjects.filter((item) => item.id !== id),
        teachers: current.teachers.map((item) => ({ ...item, subjectIds: item.subjectIds.filter((subjectId) => subjectId !== id) })),
        requirements: current.requirements.filter((item) => item.subjectId !== id),
        draft: (current.draft ?? []).filter((item) => item.subjectId !== id),
        activeSchedule: (current.activeSchedule ?? []).filter((item) => item.subjectId !== id),
      };
    }, true);
    notify('Data dan referensi terkait telah diperbarui.', 'info');
  };

  const saveRequirement = (event: FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    const requiredJP = Number(reqForm.requiredJP);
    if (!reqForm.classId || !reqForm.subjectId || !reqForm.teacherId || !Number.isInteger(requiredJP) || requiredJP < 1) {
      notify('Kelas, mapel, guru dan alokasi JP wajib diisi dengan benar.', 'warning');
      return;
    }
    const teacher = workspace.teachers.find((item) => item.id === reqForm.teacherId);
    if (!teacher) {
      notify('Pilih guru pengampu yang terdaftar.', 'warning');
      return;
    }
    updateWorkspace((current) => {
      const nextTeachers = current.teachers.map((t) => {
        if (t.id === reqForm.teacherId && !t.subjectIds.includes(reqForm.subjectId)) {
          return { ...t, subjectIds: [...t.subjectIds, reqForm.subjectId] };
        }
        return t;
      });
      const existing = current.requirements.find((item) => item.classId === reqForm.classId && item.subjectId === reqForm.subjectId && item.teacherId === reqForm.teacherId);
      const requirements = existing
        ? current.requirements.map((item) => item.id === existing.id ? { ...item, requiredJP } : item)
        : [...current.requirements, { id: `REQ-${Date.now().toString(36)}`, classId: reqForm.classId, subjectId: reqForm.subjectId, teacherId: reqForm.teacherId, requiredJP }];
      return { ...current, teachers: nextTeachers, requirements, draft: null };
    }, true);
    setReqFormOpen(false);
    notify('Alokasi JP tersimpan. Kualifikasi guru disesuaikan.', 'success');
  };

  const deleteRequirement = (requirement: Requirement) => {
    if (!workspace) return;
    updateWorkspace((current) => ({ ...current, requirements: current.requirements.filter((item) => item.id !== requirement.id), draft: null }), true);
    notify('Alokasi dihapus.', 'info');
  };

  const handleSaveClass = (cls: SchoolClass, isNew: boolean) => {
    if (!workspace) return;
    updateWorkspace((curr) => {
      const classes = isNew
        ? [...curr.classes, cls]
        : curr.classes.map((c) => (c.id === cls.id ? cls : c));
      return { ...curr, classes };
    }, true);
    if (isNew) setSelectedClass(cls.id);
    notify(isNew ? `Kelas ${cls.name} ditambahkan.` : `Data Kelas ${cls.name} diperbarui.`, 'success');
  };

  const handleSaveTeacher = (tch: Teacher, isNew: boolean) => {
    if (!workspace) return;
    updateWorkspace((curr) => {
      const teachers = isNew
        ? [...curr.teachers, tch]
        : curr.teachers.map((t) => (t.id === tch.id ? tch : t));
      return { ...curr, teachers };
    }, true);
    notify(isNew ? `Guru ${tch.name} ditambahkan.` : `Data Guru ${tch.name} diperbarui.`, 'success');
  };

  const handleSaveSubject = (sub: Subject, isNew: boolean) => {
    if (!workspace) return;
    updateWorkspace((curr) => {
      const subjects = isNew
        ? [...curr.subjects, sub]
        : curr.subjects.map((s) => (s.id === sub.id ? sub : s));
      return { ...curr, subjects };
    }, true);
    notify(isNew ? `Mapel ${sub.name} ditambahkan.` : `Data Mapel ${sub.name} diperbarui.`, 'success');
  };

  const handleSaveRequirementFromModal = (req: Requirement, isNew: boolean) => {
    if (!workspace) return;
    updateWorkspace((curr) => {
      const requirements = isNew
        ? [...curr.requirements, req]
        : curr.requirements.map((r) => (r.id === req.id ? req : r));
      return { ...curr, requirements, draft: null };
    }, true);
    notify(isNew ? 'Alokasi kebutuhan JP ditambahkan.' : 'Alokasi kebutuhan JP diperbarui.', 'success');
  };

  const backupNow = async () => {
    if (!workspace) return;
    try {
      await exportAppState(workspace);
      updateWorkspace((current) => ({ ...current, lastBackupAt: new Date().toISOString() }));
      notify('File backup JSON berhasil dibuat.', 'success');
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
      notify('Backup berhasil dipulihkan.', 'success');
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
    notify('CSV jadwal berhasil diunduh.', 'success');
  };

  const exportJSONSchedule = () => {
    if (!workspace) return;
    const content = JSON.stringify({
      format: 'SIGNAL-SCHEDULE',
      exportedAt: new Date().toISOString(),
      settings: workspace.settings,
      classes: workspace.classes,
      teachers: workspace.teachers,
      subjects: workspace.subjects,
      entries: currentEntries,
      validation: report,
    }, null, 2);
    downloadTextFile(content, `SIGNAL-jadwal-${workspace.settings.academicYear.replace('/', '-')}.json`, 'application/json');
    notify('Ekspor jadwal JSON siap.', 'success');
  };

  const resetWorkspace = () => {
    if (!window.confirm('Reset data browser ke dataset demo? Semua perubahan lokal akan dikembalikan ke data awal.')) return;
    const fresh = createDemoState();
    setWorkspace(fresh);
    setSelectedClass(fresh.classes[0]?.id ?? '');
    setScreen('overview');
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
        <div className="workspace-chip">
          <div className="workspace-seal"><GraduationCap size={18} /></div>
          <div><small>WORKSPACE</small><strong>{workspace.settings.academicYear}</strong></div>
          <ChevronDown size={14} />
        </div>
        <nav className="side-nav" aria-label="Navigasi utama">
          {navItems.map((item) => (
            <div key={item.id}>
              {item.section && <div className="nav-section-label">{item.section}</div>}
              <button
                className={`nav-item ${screen === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
                aria-current={screen === item.id ? 'page' : undefined}
              >
                <item.icon size={18} strokeWidth={screen === item.id ? 2.2 : 1.8} />
                <span>{item.label}</span>
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
          <div className="profile-avatar">OP</div>
          <div className="profile-copy"><strong>Operator Madrasah</strong><span>Kurikulum & Presensi</span></div>
          <MoreHorizontal size={18} className="profile-more" />
        </div>
        <div className="sidebar-footnote"><span className="tiny-status-dot" /> LOCAL WORKSPACE <span>·</span> v1.2.0</div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-trigger" aria-label="Buka menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{currentTitle}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setMasterSearch(globalSearch); navigate('master'); } }}
                placeholder="Cari kelas, guru, atau mapel…"
              />
              <kbd><Command size={10} /> K</kbd>
            </div>
            <button
              className="icon-button notification-button"
              aria-label="Status sistem"
              onClick={() => setQuickValidationOpen(true)}
              title="Periksa Jadwal (Quick Validation Report)"
            >
              <Bell size={18} />
              <span className={report?.hardErrorCount ? 'notification-dot danger' : 'notification-dot'} />
            </button>
            <div className="topbar-divider" />
            <button className="topbar-profile" onClick={() => navigate('settings')}>
              <div className="profile-avatar small-avatar">OP</div>
              <div className="topbar-profile-copy"><strong>Operator</strong><span>Administrator</span></div>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        <div className="content-scroll">
          <div className="page-frame">
            {workspace.dataMode === 'demo' && (
              <div className="demo-banner">
                <div className="demo-banner-icon"><Sparkles size={15} /></div>
                <div>
                  <strong>Anda sedang melihat dataset demonstrasi aktif.</strong>
                  <span>Jadwal dan presensi sudah terverifikasi. Sesuaikan data madrasah Anda sebelum mencetak.</span>
                </div>
                <button onClick={() => navigate('master')}>Sesuaikan Data <ArrowRight size={14} /></button>
                <button className="banner-close" onClick={() => updateWorkspace((current) => ({ ...current, dataMode: 'custom' }))} aria-label="Sembunyikan banner"><X size={14} /></button>
              </div>
            )}

            {/* SCREEN 1: BERANDA RINGKAS (OPERATOR WORKSPACE) */}
            {screen === 'overview' && (
              <OperatorOverviewScreen
                state={workspace}
                report={report!}
                masterIssues={masterIssues}
                readiness={readiness}
                occupiedSlots={occupiedSlots}
                totalWeeklyCapacity={totalWeeklyCapacity}
                onNavigate={navigate}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                onOpenPdfModal={() => setPdfExportOpen(true)}
                onOpenValidationModal={() => setQuickValidationOpen(true)}
              />
            )}

            {/* SCREEN 2: JADWAL PELAJARAN (WITH DRAG & DROP & QUICK VALIDATION) */}
            {screen === 'schedule' && (
              <ScheduleScreen
                state={workspace}
                selectedClass={selectedClassObj?.id ?? ''}
                onSelectClass={setSelectedClass}
                onEditSlot={openSlotEditor}
                onDropSlot={handleDropSlot}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                onPublish={publishDraft}
                onExportCSV={exportScheduleCSV}
                onOpenPdfModal={() => setPdfExportOpen(true)}
                onOpenValidationModal={() => setQuickValidationOpen(true)}
                onNavigate={navigate}
                report={report!}
                lastMove={lastMoveHistory}
                onUndoMove={handleUndoMove}
              />
            )}

            {/* SCREEN 3: STATISTIK BEBAN GURU (NEW) */}
            {screen === 'workload' && (
              <WorkloadDashboard
                state={workspace}
                onNavigateToSchedule={() => navigate('schedule')}
                onNavigateToMaster={() => navigate('master')}
                onNavigateToRequirements={() => navigate('requirements')}
              />
            )}

            {/* SCREEN 4: PRESENSI & ABSENSI GURU (NEW) */}
            {screen === 'attendance' && (
              <AttendanceScreen
                state={workspace}
                onUpdateState={updateWorkspace}
                onNotify={notify}
              />
            )}

            {/* SCREEN 5: GENERATOR SCREEN */}
            {screen === 'generator' && (
              <GeneratorScreen
                state={workspace}
                isGenerating={isGenerating}
                result={lastGeneratorResult}
                onGenerate={handleGenerate}
                onChoose={chooseCandidate}
                onNavigate={navigate}
              />
            )}

            {/* SCREEN 6: DATA MASTER */}
            {screen === 'master' && (
              <MasterScreen
                state={workspace}
                activeTab={masterTab}
                onTabChange={(tab) => { setMasterTab(tab); setAddType(null); }}
                search={masterSearch}
                onSearch={setMasterSearch}
                onAdd={(type) => { setAddType(type); setMasterForm(emptyMasterForm); }}
                addType={addType}
                form={masterForm}
                setForm={setMasterForm}
                onSave={saveMasterForm}
                onCancelAdd={() => setAddType(null)}
                onDelete={deleteMaster}
                onEditClass={(c) => setEntityModalTarget({ kind: 'class', isNew: false, item: c })}
                onEditTeacher={(t) => setEntityModalTarget({ kind: 'teacher', isNew: false, item: t })}
                onEditSubject={(s) => setEntityModalTarget({ kind: 'subject', isNew: false, item: s })}
                onOpenAddModal={(kind) => setEntityModalTarget({ kind, isNew: true })}
                onNavigate={navigate}
              />
            )}

            {/* SCREEN 7: KEBUTUHAN & ALOKASI JP */}
            {screen === 'requirements' && (
              <RequirementsScreen
                state={workspace}
                masterIssues={masterIssues}
                formOpen={reqFormOpen}
                setFormOpen={setReqFormOpen}
                form={reqForm}
                setForm={setReqForm}
                onSave={saveRequirement}
                onDelete={deleteRequirement}
                onGenerate={handleGenerate}
                onNavigate={navigate}
                onEdit={(r) => setEntityModalTarget({ kind: 'requirement', isNew: false, item: r })}
                onOpenAddModal={() => setEntityModalTarget({ kind: 'requirement', isNew: true })}
              />
            )}

            {/* SCREEN 8: VALIDASI & KONFLIK */}
            {screen === 'validation' && (
              <ValidationScreen
                state={workspace}
                report={report!}
                masterIssues={masterIssues}
                expandedIssue={expandedIssue}
                setExpandedIssue={setExpandedIssue}
                onNavigate={navigate}
                onValidate={() => {
                  const newReport = validateSchedule(workspace, workspace.draft ?? workspace.activeSchedule ?? [], { strictCoverage: true, includeSoftWarnings: true });
                  notify(newReport.valid ? 'Validasi selesai: jadwal bebas pelanggaran.' : `Validasi selesai: ditemukan ${newReport.hardErrorCount} pelanggaran wajib.`, newReport.valid ? 'success' : 'warning');
                }}
              />
            )}

            {/* SCREEN 9: RIWAYAT VERSI */}
            {screen === 'history' && (
              <HistoryScreen
                state={workspace}
                onRestore={restoreVersion}
                onNavigate={navigate}
              />
            )}

            {/* SCREEN 10: EKSPOR & BACKUP */}
            {screen === 'backup' && (
              <BackupScreen
                state={workspace}
                onBackup={backupNow}
                onImport={importBackup}
                onExportCSV={exportScheduleCSV}
                onExportJSON={exportJSONSchedule}
              />
            )}

            {/* SCREEN 11: PENGATURAN HARI AKTIF & JAM KEGIATAN */}
            {screen === 'settings' && (
              <SettingsScreen
                state={workspace}
                onSettingsChange={handlePeriodConfig}
                onReset={resetWorkspace}
                onNavigate={navigate}
                saved={settingsSaved}
              />
            )}
          </div>

          <footer className="app-footer">
            <span>© 2026 SIGNAL Academic Studio · Sistem Informasi Generasi Aturan & Logika</span>
            <span><span className="tiny-status-dot" /> Data tersimpan lokal di browser ini</span>
            <span>Built for clarity, designed for calm.</span>
          </footer>
        </div>
      </main>

      {/* Manual Slot Editor Modal */}
      {editingSlot && (
        <Modal
          title="Edit Penempatan Pelajaran"
          subtitle={`${getClass(workspace, editingSlot.classId)?.name ?? ''} · ${editingSlot.day} · JP ${editingSlot.jpNo}`}
          onClose={() => setEditingSlot(null)}
          icon={CalendarDays}
        >
          <form className="modal-form" onSubmit={saveSlotEditor}>
            <div className="field-group">
              <label>Mata pelajaran</label>
              <select
                value={editingSubject}
                onChange={(e) => {
                  setEditingSubject(e.target.value);
                  const firstTeacher = workspace.teachers.find((teacher) => teacher.isActive && teacher.subjectIds.includes(e.target.value));
                  setEditingTeacher(firstTeacher?.id ?? '');
                }}
              >
                <option value="">— Kosongkan slot —</option>
                {workspace.subjects.filter((subject) => subject.isActive).map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Guru pengampu</label>
              <select
                value={editingTeacher}
                onChange={(e) => setEditingTeacher(e.target.value)}
                disabled={!editingSubject}
              >
                <option value="">Pilih guru</option>
                <option value="__NEW_CUSTOM__">+ Input Guru Baru / Tamu / Pengganti (Luar Master)</option>
                {workspace.teachers.filter((teacher) => teacher.isActive && editingSubject && teacher.subjectIds.includes(editingSubject)).length > 0 && (
                  <optgroup label="Guru Sesuai Kualifikasi Mapel">
                    {workspace.teachers
                      .filter((teacher) => teacher.isActive && editingSubject && teacher.subjectIds.includes(editingSubject))
                      .map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.code})</option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Semua Guru Terdaftar Lainnya (Lintas Mapel)">
                  {workspace.teachers
                    .filter((teacher) => !editingSubject || !teacher.subjectIds.includes(editingSubject))
                    .map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.code})</option>
                    ))}
                </optgroup>
              </select>
            </div>

            {editingTeacher === '__NEW_CUSTOM__' && (
              <div className="field-group" style={{ background: '#f3f8f5', padding: '12px', borderRadius: '8px', border: '1px solid #bed6c7', marginTop: '6px' }}>
                <label style={{ color: '#16483f' }}>Nama Guru Baru / Tamu / Pengganti</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Ustadz M. Syamsul Huda, S.Pd.I (Guru Tamu)"
                  value={customTeacherName}
                  onChange={(e) => setCustomTeacherName(e.target.value)}
                  autoFocus
                />
                <small style={{ color: '#27594e' }}>
                  Guru ini akan otomatis didaftarkan dan dapat langsung dijadwalkan.
                </small>
              </div>
            )}
            <div className="modal-note">
              <ShieldCheck size={16} />
              <span>Perubahan ditaruh ke draft. Validator deterministik langsung memeriksa bentrok dan kelengkapan.</span>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setEditingSlot(null)}>Batal</button>
              <button className="button button-primary" type="submit"><Save size={15} /> Simpan Draft</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Validation Report Modal */}
      <QuickValidationModal
        state={workspace}
        report={report!}
        masterIssues={masterIssues}
        isOpen={quickValidationOpen}
        onClose={() => setQuickValidationOpen(false)}
        onNavigateToSlot={(classId) => {
          setSelectedClass(classId);
          navigate('schedule');
        }}
        onNavigateToScreen={(s) => navigate(s as ScreenId)}
        onRevalidate={() => {
          notify('Validasi jadwal selesai diperiksa.', 'info');
        }}
      />

      {/* PDF Export Modal */}
      <SchedulePdfExportModal
        state={workspace}
        selectedClassId={selectedClass}
        isOpen={pdfExportOpen}
        onClose={() => setPdfExportOpen(false)}
        onNotify={notify}
      />

      {/* Consolidated Entity Edit Modal (Every deletable entity is editable) */}
      <EntityEditModal
        isOpen={Boolean(entityModalTarget)}
        target={entityModalTarget}
        state={workspace}
        onClose={() => setEntityModalTarget(null)}
        onSaveClass={handleSaveClass}
        onSaveTeacher={handleSaveTeacher}
        onSaveSubject={handleSaveSubject}
        onSaveRequirement={handleSaveRequirementFromModal}
      />

      {/* Global Toast */}
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          <div className="toast-icon">
            {toast.kind === 'success' ? <CheckCircle2 size={18} /> : toast.kind === 'error' ? <XCircle size={18} /> : toast.kind === 'warning' ? <AlertTriangle size={18} /> : <Activity size={18} />}
          </div>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Tutup notifikasi"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-emblem">S</div>
      <div className="loading-line" />
      <h1>SIGNAL</h1>
      <p>Menyiapkan ruang kerja madrasah Anda…</p>
    </div>
  );
}

function PageHeading({ kicker, title, description, actions }: { kicker: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" />{kicker}</div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h1 style={{ margin: 0 }}>{title}</h1>
          {description && <InfoNotice text={description} />}
        </div>
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </div>
  );
}

function Button({ children, variant = 'primary', icon: Icon, onClick, disabled, type = 'button', className = '', title }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'hero-ghost'; icon?: LucideIcon; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; className?: string; title?: string }) {
  return <button type={type} disabled={disabled} title={title} className={`button button-${variant} ${className}`} onClick={onClick}>{Icon && <Icon size={15} />}{children}</button>;
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
  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div className="modal-title-icon"><Icon size={20} /></div>
          <div><h2>{title}</h2><p>{subtitle}</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup dialog"><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * SECTION B: BERANDA RINGKAS (OPERATOR CENTER)
 */
function OperatorOverviewScreen({
  state,
  report,
  masterIssues,
  readiness,
  occupiedSlots,
  totalWeeklyCapacity,
  onNavigate,
  onGenerate,
  isGenerating,
  onOpenPdfModal,
  onOpenValidationModal,
}: {
  state: AppState;
  report: ReturnType<typeof validateSchedule>;
  masterIssues: ValidationIssue[];
  readiness: number;
  occupiedSlots: number;
  totalWeeklyCapacity: number;
  onNavigate: (screen: ScreenId) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onOpenPdfModal: () => void;
  onOpenValidationModal: () => void;
}) {
  const hasSchedule = !!(state.draft?.length || state.activeSchedule?.length);
  const totalErrors = masterIssues.filter((i) => i.severity === 'error').length + report.hardErrorCount;
  const classCount = state.classes.filter((c) => c.isActive).length;
  const teacherCount = state.teachers.filter((t) => t.isActive).length;
  const subjectCount = state.subjects.filter((s) => s.isActive).length;

  return (
    <>
      {/* Welcome line */}
      <div className="welcome-line">
        <div>
          <span className="welcome-greeting">PUSAT KERJA OPERATOR <span className="welcome-sparkle">✦</span></span>
          <div className="welcome-date">{formatDate()}</div>
        </div>
        <div className="welcome-meta">
          <div className="privacy-chip"><LockKeyhole size={13} /> LOCAL-FIRST · PRIVAT</div>
          <div className="workspace-badge"><span className="tiny-status-dot" /> T.A. {state.settings.academicYear}</div>
        </div>
      </div>

      {/* Hero Panel with Primary "Buat Jadwal" Button */}
      <div className="hero-panel">
        <div className="hero-text">
          <div className="hero-label">
            <span className="hero-label-dot" /> SEMESTER {state.settings.semester.toUpperCase()} · {state.settings.schoolName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', margin: '16px 0 10px' }}>
            <h1 style={{ margin: 0 }}>Penyusunan Jadwal &amp; Presensi.</h1>
            <InfoNotice text="Satu klik untuk membuat jadwal pelajaran otomatis yang bebas bentrok guru dan kelas. Validator deterministik menguji seluruh aturan secara ketat." />
          </div>

          <div className="hero-actions">
            <Button
              icon={WandSparkles}
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Sedang Menyusun Jadwal…' : 'Buat Jadwal'}
            </Button>
            <Button
              variant="hero-ghost"
              icon={CalendarDays}
              onClick={() => onNavigate('schedule')}
            >
              Lihat Jadwal
            </Button>
            <Button
              variant="hero-ghost"
              icon={Download}
              onClick={onOpenPdfModal}
            >
              Ekspor PDF
            </Button>
          </div>

          <div className="hero-footnotes">
            <span><ShieldCheck size={14} /> Validator Otomatis</span>
            <span><Clock size={14} /> {state.settings.periodMinutes} Menit/JP</span>
            <span><Sparkles size={14} /> AI Opsional</span>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit hero-orbit-a" />
          <div className="hero-orbit hero-orbit-b" />
          <div className="hero-glow" />
          <div className="hero-art-top">
            <span>STATUS KESIAPAN</span>
            <span className="art-live-dot" />AKTIF
          </div>
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbf7e8' }}>
              {hasSchedule && report.valid ? 'Siap Ditinjau' : totalErrors > 0 ? 'Perlu Tindakan' : 'Data Siap'}
            </div>
            <span style={{ fontSize: '10px', color: '#a9c3b7' }}>
              {totalErrors > 0
                ? `${totalErrors} masalah perlu diperbaiki sebelum publikasi.`
                : 'Tidak ada konflik keras terdeteksi pada jadwal.'}
            </span>
          </div>
          <div className="hero-art-foot">
            <span><i /> {hasSchedule ? 'DRAFT AKTIF' : 'BELUM ADA JADWAL'}</span>
            <span>{state.settings.activeDays.length} HARI · {occupiedSlots}/{totalWeeklyCapacity} JP</span>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '16px' }}>
        <button
          className="button button-secondary"
          style={{ height: '48px', justifyContent: 'flex-start', padding: '0 16px' }}
          onClick={() => onNavigate('master')}
        >
          <DatabaseIcon size={17} style={{ color: '#2f7771' }} />
          <span style={{ fontWeight: 700 }}>Data Sekolah</span>
        </button>

        <button
          className="button button-secondary"
          style={{ height: '48px', justifyContent: 'flex-start', padding: '0 16px' }}
          onClick={() => onNavigate('schedule')}
        >
          <CalendarDays size={17} style={{ color: '#bc945e' }} />
          <span style={{ fontWeight: 700 }}>Lihat Jadwal</span>
        </button>

        <button
          className="button button-secondary"
          style={{ height: '48px', justifyContent: 'flex-start', padding: '0 16px' }}
          onClick={() => onNavigate('workload')}
        >
          <BarChart3 size={17} style={{ color: '#678ba6' }} />
          <span style={{ fontWeight: 700 }}>Beban Guru</span>
        </button>

        <button
          className="button button-secondary"
          style={{ height: '48px', justifyContent: 'flex-start', padding: '0 16px' }}
          onClick={() => onNavigate('attendance')}
        >
          <UserCheck size={17} style={{ color: '#49886d' }} />
          <span style={{ fontWeight: 700 }}>Absensi Guru</span>
        </button>

        <button
          className="button button-secondary"
          style={{ height: '48px', justifyContent: 'flex-start', padding: '0 16px' }}
          onClick={onOpenPdfModal}
        >
          <Download size={17} style={{ color: '#c8766a' }} />
          <span style={{ fontWeight: 700 }}>Ekspor PDF</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="stat-grid" style={{ marginTop: '16px' }}>
        <StatCard
          label="Kelas Terdaftar"
          value={String(classCount).padStart(2, '0')}
          sub="Kelas KBM aktif"
          icon={GraduationCap}
          tone="teal"
        />
        <StatCard
          label="Guru Pengampu"
          value={String(teacherCount).padStart(2, '0')}
          sub="Kualifikasi mapel tercatat"
          icon={Users}
          tone="sand"
        />
        <StatCard
          label="Mata Pelajaran"
          value={String(subjectCount).padStart(2, '0')}
          sub="Mapel kurikulum MTs"
          icon={BookOpen}
          tone="blue"
        />
        <StatCard
          label="Kesiapan Jadwal"
          value={`${readiness}%`}
          sub={totalErrors > 0 ? `${totalErrors} hal wajib perlu ditinjau` : 'Seluruh data siap'}
          icon={ShieldCheck}
          tone={totalErrors > 0 ? 'rose' : 'teal'}
        />
      </div>

      {/* Only Actionable Issues List */}
      {totalErrors > 0 && (
        <div className="surface-card" style={{ marginTop: '16px', borderLeft: '4px solid #c8766a' }}>
          <div className="card-heading">
            <div>
              <div className="card-eyebrow">ACTION REQUIRED</div>
              <h3 style={{ color: '#b24c3d' }}>{totalErrors} Masalah Membutuhkan Tindakan</h3>
            </div>
            <button className="button button-secondary" onClick={onOpenValidationModal} style={{ fontSize: '11px', height: '32px' }}>
              Buka Quick Report <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...masterIssues, ...report.issues]
              .filter((i) => i.severity === 'error')
              .slice(0, 3)
              .map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#fdf3f2',
                    border: '1px solid #f9d8d3',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <XCircle size={16} color="#b24c3d" />
                    <div>
                      <strong style={{ fontSize: '12px', color: '#173637' }}>{issue.title}</strong>
                      <span style={{ fontSize: '11px', color: '#7a8a86', marginLeft: '6px' }}>{issue.message}</span>
                    </div>
                  </div>
                  <button
                    className="button button-quiet"
                    style={{ fontSize: '10px', height: '26px' }}
                    onClick={() => {
                      if (issue.code.includes('COLLISION') || issue.code.includes('SLOT')) {
                        onNavigate('schedule');
                      } else {
                        onNavigate('requirements');
                      }
                    }}
                  >
                    Perbaiki
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * SCHEDULE SCREEN (WITH DRAG & DROP AND BUTTONS)
 */
function ScheduleScreen({
  state,
  selectedClass,
  onSelectClass,
  onEditSlot,
  onDropSlot,
  onGenerate,
  isGenerating,
  onPublish,
  onExportCSV,
  onOpenPdfModal,
  onOpenValidationModal,
  onNavigate,
  report,
  lastMove,
  onUndoMove,
}: {
  state: AppState;
  selectedClass: string;
  onSelectClass: (value: string) => void;
  onEditSlot: (classId: string, day: Day, jpNo: number) => void;
  onDropSlot: (source: { classId: string; day: Day; jpNo: number }, target: { day: Day; jpNo: number }) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onPublish: () => void;
  onExportCSV: () => void;
  onOpenPdfModal: () => void;
  onOpenValidationModal: () => void;
  onNavigate: (screen: ScreenId) => void;
  report: ReturnType<typeof validateSchedule>;
  lastMove: { entries: ScheduleEntry[]; description: string } | null;
  onUndoMove: () => void;
}) {
  const [draggedSlot, setDraggedSlot] = useState<{ classId: string; day: Day; jpNo: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ day: Day; jpNo: number } | null>(null);

  const hasEntries = !!(state.draft?.length || state.activeSchedule?.length);
  const activeDays = state.settings.activeDays;
  const periods = Array.from({ length: state.settings.teachingPeriodsPerDay }, (_, i) => i + 1);
  const published = !state.draft && !!state.activeSchedule?.length;

  return (
    <>
      <PageHeading
        kicker="SCHEDULE WORKSPACE"
        title="Jadwal Pelajaran"
        description="Geser dan letakkan (Drag & Drop) pelajaran antar-slot. Validator deterministik otomatis memeriksa bentrok."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {lastMove && (
              <Button variant="secondary" icon={Undo2} onClick={onUndoMove} title="Batalkan perpindahan terakhir">
                Urungkan
              </Button>
            )}
            <Button variant="secondary" icon={Download} onClick={onOpenPdfModal}>
              Ekspor PDF (A4)
            </Button>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={onExportCSV}>
              CSV
            </Button>
            <Button icon={WandSparkles} onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? 'Menyusun…' : 'Generate Jadwal'}
            </Button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="toolbar-card">
        <div className="class-selector-wrap">
          <label htmlFor="schedule-class">PILIH KELAS</label>
          <div className="select-with-icon">
            <GraduationCap size={16} />
            <select
              id="schedule-class"
              value={selectedClass}
              onChange={(e) => onSelectClass(e.target.value)}
            >
              <option value="">Pilih kelas</option>
              {state.classes.filter((item) => item.isActive).map((item) => (
                <option key={item.id} value={item.id}>
                  Kelas {item.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="toolbar-divider" />

        <div className="schedule-status">
          <span className="toolbar-label">STATUS JADWAL</span>
          {state.draft ? (
            <StatusPill status={report.valid ? 'success' : 'warning'}>
              {report.valid ? 'Draft Valid' : 'Draft Perlu Diperbaiki'}
            </StatusPill>
          ) : published ? (
            <StatusPill status="success">
              Published · v{state.history[0]?.version ?? '1'}
            </StatusPill>
          ) : (
            <StatusPill status="neutral">Belum dibuat</StatusPill>
          )}
        </div>

        <div className="toolbar-spacer" />

        <div className="schedule-toolbar-actions">
          <Button variant="quiet" icon={ShieldCheck} onClick={onOpenValidationModal}>
            Periksa Jadwal
          </Button>
          <Button onClick={onPublish} disabled={!hasEntries || !report.valid}>
            <Check size={15} /> Terbitkan Jadwal
          </Button>
        </div>
      </div>

      {!selectedClass ? (
        <EmptyState
          icon={GraduationCap}
          title="Pilih kelas untuk melihat jadwal"
          description="Pilih kelas melalui dropdown di atas atau tambahkan kelas baru pada Data Master."
          action={<Button onClick={() => onNavigate('master')}>Buka Data Master</Button>}
        />
      ) : (
        <>
          <div className="schedule-summary-row">
            <div className="schedule-selected-class">
              <div className="class-monogram">{getClass(state, selectedClass)?.name.slice(0, 2)}</div>
              <div>
                <strong>Kelas {getClass(state, selectedClass)?.name}</strong>
                <span>{state.settings.schoolName} · T.A. {state.settings.academicYear} ({state.settings.semester})</span>
              </div>
            </div>
            <div className="schedule-summary-metric">
              <span>Alokasi terisi</span>
              <strong>
                {(state.draft ?? state.activeSchedule ?? []).filter((e) => e.classId === selectedClass).length} <small>JP</small>
              </strong>
            </div>
            <div className="schedule-summary-metric">
              <span>Target Kebutuhan</span>
              <strong>
                {state.requirements.filter((item) => item.classId === selectedClass).reduce((sum, item) => sum + item.requiredJP, 0)} <small>JP</small>
              </strong>
            </div>
            <div className="schedule-summary-metric">
              <span>Hari Aktif</span>
              <strong>{activeDays.length} <small>hari</small></strong>
            </div>
          </div>

          {/* Interactive Drag-and-Drop Schedule Table */}
          <div className="schedule-table-wrap">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th className="schedule-time-column">JAM / JP KBM</th>
                  {activeDays.map((day) => (
                    <th key={day}>
                      <span>{day}</span>
                      <small>{day === 'Jumat' ? 'JUMAT BERKAH' : day.slice(0, 3).toUpperCase()}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((jpNo) => (
                  <tr key={jpNo}>
                    <th className="period-heading">
                      <span>JP {String(jpNo).padStart(2, '0')}</span>
                      <small>
                        {state.slots.find((slot) => slot.kind === 'TEACHING' && slot.day === activeDays[0] && slot.jpNo === jpNo)?.start ?? '—'}
                      </small>
                    </th>
                    {activeDays.map((day) => {
                      const entry = getEntry(state, selectedClass, day, jpNo);
                      const subject = entry ? getSubject(state, entry.subjectId) : undefined;
                      const teacher = entry ? getTeacher(state, entry.teacherId) : undefined;

                      // Check if slot is blocked by non-KBM activity
                      const slotDef = state.slots.find((s) => s.day === day && s.kind === 'TEACHING' && s.jpNo === jpNo);
                      const blocked = isSlotBlocked(slotDef);
                      const isOver = dragOverTarget?.day === day && dragOverTarget?.jpNo === jpNo;

                      return (
                        <td
                          key={`${day}-${jpNo}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverTarget({ day, jpNo });
                          }}
                          onDragLeave={() => {
                            if (dragOverTarget?.day === day && dragOverTarget?.jpNo === jpNo) {
                              setDragOverTarget(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverTarget(null);
                            if (draggedSlot) {
                              onDropSlot(draggedSlot, { day, jpNo });
                              setDraggedSlot(null);
                            }
                          }}
                          style={{
                            background: isOver ? 'rgba(36, 99, 94, 0.12)' : undefined,
                            outline: isOver ? '2px dashed #24635e' : undefined,
                          }}
                        >
                          <button
                            draggable={!!entry}
                            onDragStart={() => {
                              if (entry) {
                                setDraggedSlot({ classId: selectedClass, day, jpNo });
                              }
                            }}
                            className={`schedule-cell ${entry ? 'has-entry' : 'is-empty'} ${blocked ? 'is-blocked' : ''}`}
                            style={entry && subject ? ({ '--subject-color': subject.color } as React.CSSProperties) : undefined}
                            onClick={() => onEditSlot(selectedClass, day, jpNo)}
                            title={
                              blocked
                                ? 'Slot diblokir untuk kegiatan non-KBM'
                                : entry
                                ? `Tarik untuk memindahkan: ${subject?.name} (${teacher?.name})`
                                : `Klik untuk menambah pelajaran pada ${day}, JP ${jpNo}`
                            }
                          >
                            <span className="cell-time">{entry ? subject?.code ?? 'MAPEL' : blocked ? 'BLOCKED' : '+ ADD'}</span>
                            {entry ? (
                              <>
                                <strong>{subject?.name ?? 'Mapel'}</strong>
                                <small>{teacher?.name ?? 'Guru belum tersedia'}</small>
                                <span className="cell-foot">
                                  <i /> {teacher?.code ?? '—'}
                                </span>
                              </>
                            ) : (
                              <span className="empty-cell-hint">
                                {blocked ? 'Kegiatan Terjadwal' : 'Tambah pelajaran'}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="schedule-legend-row">
            <span><i className="legend-dot dot-teal" /> Mapel terisi (Dapat digeser/drag)</span>
            <span><i className="legend-dot dot-ivory" /> Slot KBM kosong</span>
            <span><ShieldCheck size={14} /> Klik untuk edit manual</span>
            <span className="legend-spacer" />
            <button className="text-link" onClick={onOpenValidationModal}>
              Laporan Validasi Lengkap <ArrowRight size={13} />
            </button>
          </div>
        </>
      )}
    </>
  );
}

/**
 * SECTION C: PENGATURAN HARI AKTIF & JAM KEGIATAN
 */
function SettingsScreen({
  state,
  onSettingsChange,
  onReset,
  onNavigate: _onNavigate,
  saved,
}: {
  state: AppState;
  onSettingsChange: (changes: Partial<AppState['settings']>) => void;
  onReset: () => void;
  onNavigate?: (screen: ScreenId) => void;
  saved: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'time' | 'general' | 'ai'>('time');
  const [schoolName, setSchoolName] = useState(state.settings.schoolName);
  const [academicYear, setAcademicYear] = useState(state.settings.academicYear);
  const [semester, setSemester] = useState(state.settings.semester);
  const [periodMinutes, setPeriodMinutes] = useState(String(state.settings.periodMinutes ?? 40));
  const [activeDays, setActiveDays] = useState<Day[]>(state.settings.activeDays);
  const [geminiEnabled, setGeminiEnabled] = useState(state.settings.geminiEnabled);
  const [previewDay, setPreviewDay] = useState<Day>(state.settings.activeDays[0] || 'Senin');

  // Period Definitions List
  const [definitions, setDefinitions] = useState<PeriodDefinition[]>(() => {
    return (
      state.settings.periodDefinitions ??
      createDefaultPeriodDefinitions(
        state.settings.teachingPeriodsPerDay ?? 8,
        state.settings.breakAfterJP ?? [2, 5],
        state.settings.periodMinutes ?? 40,
      )
    );
  });

  const handleToggleDay = (day: Day) => {
    if (activeDays.includes(day)) {
      if (activeDays.length <= 1) return; // Keep at least one
      setActiveDays(activeDays.filter((d) => d !== day));
    } else {
      setActiveDays([...activeDays, day]);
    }
  };

  const handleUpdateDef = (index: number, changes: Partial<PeriodDefinition>) => {
    const updated = [...definitions];
    updated[index] = { ...updated[index], ...changes };
    setDefinitions(updated);
  };

  const handleAddSlot = () => {
    const last = definitions[definitions.length - 1];
    const order = definitions.length + 1;
    const startMins = last ? clockToMinutes(last.end) : 7 * 60;
    const endMins = startMins + Number(periodMinutes);

    setDefinitions([
      ...definitions,
      {
        order,
        start: toClock(startMins),
        end: toClock(endMins),
        activityType: 'KBM',
      },
    ]);
  };

  const handleDeleteSlot = (index: number) => {
    if (definitions.length <= 1) return;
    const updated = definitions.filter((_, i) => i !== index).map((def, idx) => ({ ...def, order: idx + 1 }));
    setDefinitions(updated);
  };

  const handleSave = () => {
    const kbmCount = definitions.filter((d) => d.activityType === 'KBM').length;
    onSettingsChange({
      schoolName: schoolName.trim() || 'MTs Cendekia Nusantara',
      academicYear: academicYear.trim() || '2026/2027',
      semester,
      periodMinutes: Number(periodMinutes) || 40,
      activeDays,
      teachingPeriodsPerDay: Math.max(1, kbmCount),
      periodDefinitions: definitions,
      geminiEnabled,
    });
  };

  return (
    <>
      <PageHeading
        kicker="WORKSPACE CONFIGURATION"
        title="Pengaturan Workspace"
        description="Kelola hari aktif KBM (Senin–Sabtu), slot jam kegiatan madrasah, durasi JP, dan integrasi AI opsional."
        actions={
          <Button icon={Save} onClick={handleSave}>
            {saved ? 'Tersimpan' : 'Simpan Pengaturan'}
          </Button>
        }
      />

      <div className="segmented-tabs" style={{ marginBottom: '18px' }}>
        <button className={activeTab === 'time' ? 'active' : ''} onClick={() => setActiveTab('time')}>
          <Clock size={14} style={{ marginRight: '6px' }} />
          Hari Aktif &amp; Jam Kegiatan (WAJIB)
        </button>
        <button className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>
          <Settings2 size={14} style={{ marginRight: '6px' }} />
          Identitas Madrasah
        </button>
        <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>
          <Sparkles size={14} style={{ marginRight: '6px' }} />
          Integrasi AI (Gemini)
        </button>
      </div>

      {activeTab === 'time' && (
        <div className="settings-layout">
          <div className="settings-main-column">
            {/* 1. Active Days (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu) */}
            <Card eyebrow="ACTIVE SCHOOL DAYS" title="Hari KBM Aktif (Senin — Sabtu)">
              <p className="settings-card-intro">
                Aktifkan atau nonaktifkan hari belajar madrasah. Jadwal hanya akan ditempatkan pada hari yang dicentang.
              </p>
              <div className="day-toggle-grid">
                {DAYS.map((day) => {
                  const selected = activeDays.includes(day);
                  return (
                    <label key={day} className={`day-toggle ${selected ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => handleToggleDay(day)}
                      />
                      <span>{day.slice(0, 3).toUpperCase()}</span>
                      <strong>{day}</strong>
                      <i>{selected ? <Check size={13} /> : <Plus size={13} />}</i>
                    </label>
                  );
                })}
              </div>
            </Card>

            {/* 2. Period Definitions (Jam ke-1..N with Activity Types) */}
            <Card
              eyebrow="PERIOD SLOTS & ACTIVITIES"
              title="Pengaturan Jam ke-1 sampai Selesai"
              action={
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="button button-quiet"
                    style={{ fontSize: '11px', height: '32px' }}
                    onClick={() => {
                      setDefinitions(createDefaultPeriodDefinitions(8, [2, 5], Number(periodMinutes) || 40));
                    }}
                    title="Muat susunan standar 8 JP KBM dengan 2 istirahat"
                  >
                    Template Standar (8 JP)
                  </button>
                  <button className="button button-secondary" style={{ fontSize: '11px', height: '32px' }} onClick={handleAddSlot}>
                    <Plus size={14} /> Tambah Jam
                  </button>
                </div>
              }
            >
              <p className="settings-card-intro">
                Tentukan urutan jam madrasah dari jam ke-1 sampai selesai. Slot berjenis <strong>Belajar Mengajar (KBM)</strong> dialokasikan untuk jadwal mapel, sedangkan slot <strong>Upacara, Istirahat, Religi,</strong> dan <strong>Kegiatan Lain</strong> diblokir dari KBM.
              </p>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '55px' }}>Jam</th>
                      <th style={{ width: '105px' }}>Mulai</th>
                      <th style={{ width: '105px' }}>Selesai</th>
                      <th style={{ width: '170px' }}>Jenis Kegiatan</th>
                      <th style={{ width: '140px' }}>Hari Berlaku</th>
                      <th>Nama Kegiatan / Keterangan</th>
                      <th style={{ width: '45px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {definitions.map((def, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>#{def.order}</td>
                        <td>
                          <input
                            type="time"
                            value={def.start}
                            onChange={(e) => handleUpdateDef(idx, { start: e.target.value })}
                            style={{ padding: '6px', borderRadius: '6px', border: '1px solid #c8d3cc', width: '100%', fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            value={def.end}
                            onChange={(e) => handleUpdateDef(idx, { end: e.target.value })}
                            style={{ padding: '6px', borderRadius: '6px', border: '1px solid #c8d3cc', width: '100%', fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <select
                            value={def.activityType}
                            onChange={(e) => handleUpdateDef(idx, { activityType: e.target.value as ActivityType })}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '11px',
                              border: '1px solid #c8d3cc',
                              width: '100%',
                            }}
                          >
                            <option value="KBM">🟢 Belajar Mengajar (KBM)</option>
                            <option value="UPACARA">🔴 Upacara Bendera</option>
                            <option value="ISTIRAHAT">🟡 Istirahat</option>
                            <option value="RELIGI">🟣 Religi / Dhuha</option>
                            <option value="LAINNYA">⚪ Kegiatan Lain</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={
                              !def.applicableDays || def.applicableDays.length === 0
                                ? 'ALL'
                                : def.applicableDays.length === 1 && def.applicableDays[0] === 'Senin'
                                ? 'SENIN'
                                : def.applicableDays.length === 1 && def.applicableDays[0] === 'Jumat'
                                ? 'JUMAT'
                                : def.applicableDays.length === 1 && def.applicableDays[0] === 'Sabtu'
                                ? 'SABTU'
                                : def.applicableDays.length === 4 && def.applicableDays.includes('Senin') && def.applicableDays.includes('Kamis')
                                ? 'SENIN_KAMIS'
                                : 'ALL'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              let days: Day[] | undefined = undefined;
                              if (val === 'SENIN') days = ['Senin'];
                              else if (val === 'JUMAT') days = ['Jumat'];
                              else if (val === 'SABTU') days = ['Sabtu'];
                              else if (val === 'SENIN_KAMIS') days = ['Senin', 'Selasa', 'Rabu', 'Kamis'];
                              handleUpdateDef(idx, { applicableDays: days });
                            }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              border: '1px solid #c8d3cc',
                              width: '100%',
                            }}
                          >
                            <option value="ALL">Semua Hari Aktif</option>
                            <option value="SENIN">Hanya Senin</option>
                            <option value="JUMAT">Hanya Jumat</option>
                            <option value="SENIN_KAMIS">Senin — Kamis</option>
                            <option value="SABTU">Hanya Sabtu</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder={
                              def.activityType === 'KBM'
                                ? 'Jam Pelajaran KBM'
                                : def.activityType === 'UPACARA'
                                ? 'Upacara Bendera'
                                : def.activityType === 'ISTIRAHAT'
                                ? 'Istirahat'
                                : def.activityType === 'RELIGI'
                                ? 'Sholat Dhuha / Tadarus'
                                : 'Nama kegiatan...'
                            }
                            value={def.activityName || ''}
                            onChange={(e) => handleUpdateDef(idx, { activityName: e.target.value })}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #c8d3cc', width: '100%', fontSize: '11px' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="icon-button table-row-action"
                            onClick={() => handleDeleteSlot(idx)}
                            title="Hapus jam kegiatan ini"
                            disabled={definitions.length <= 1}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#556663' }}>
                  Total {definitions.filter((d) => d.activityType === 'KBM').length} Jam Pelajaran (KBM) · {definitions.filter((d) => d.activityType !== 'KBM').length} Jam Non-KBM Terjadwal
                </span>
                <button className="button button-primary" onClick={handleSave}>
                  <Save size={15} /> Simpan Pengaturan Jam
                </button>
              </div>
            </Card>

            {/* 3. Real-Time Daily Period Preview (Pratinjau Struktur Jam per Hari) */}
            <Card eyebrow="LIVE PREVIEW" title="Pratinjau Struktur Jam per Hari (Senin — Sabtu)">
              <p className="settings-card-intro">
                Struktur jam harian di bawah ini mengikuti pengaturan jam dan hari aktif yang dipilih. Klik hari untuk memeriksa urutan kegiatan harian madrasah.
              </p>

              {/* Day Selector Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {DAYS.map((day) => {
                  const isActive = activeDays.includes(day);
                  const isSelected = previewDay === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setPreviewDay(day)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: isSelected
                          ? '2px solid #24635e'
                          : isActive
                          ? '1px solid #c8d3cc'
                          : '1px dashed #dcded3',
                        background: isSelected
                          ? '#24635e'
                          : isActive
                          ? '#fffdf8'
                          : '#f5f5f0',
                        color: isSelected ? '#fff' : isActive ? '#173637' : '#9ca69e',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{day}</span>
                      {!isActive && <span style={{ fontSize: '9px', fontWeight: 400 }}>(Libur)</span>}
                    </button>
                  );
                })}
              </div>

              {!activeDays.includes(previewDay) ? (
                <div style={{ padding: '24px', textAlign: 'center', background: '#f8faf7', borderRadius: '10px', border: '1px dashed #d5dbd3' }}>
                  <Info size={20} color="#7a8a86" style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#173637' }}>
                    Hari {previewDay} Tidak Aktif untuk KBM
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#7a8a86' }}>
                    Centang hari {previewDay} pada kotak Hari KBM Aktif di atas jika madrasah menyelenggarakan pembelajaran pada hari ini.
                  </p>
                </div>
              ) : (
                (() => {
                  const daySlots = definitions.filter(
                    (d) => !d.applicableDays || d.applicableDays.length === 0 || d.applicableDays.includes(previewDay),
                  );
                  let runningJp = 0;

                  return (
                    <div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '10px',
                        }}
                      >
                        {daySlots.map((slot, sIdx) => {
                          const isKbm = slot.activityType === 'KBM';
                          if (isKbm) runningJp += 1;
                          const currentJpNo = runningJp;

                          const badgeBg =
                            slot.activityType === 'KBM'
                              ? '#eef7f4'
                              : slot.activityType === 'UPACARA'
                              ? '#fdf2f0'
                              : slot.activityType === 'ISTIRAHAT'
                              ? '#fef8ec'
                              : slot.activityType === 'RELIGI'
                              ? '#f6f0fa'
                              : '#f4f6f5';

                          const badgeBorder =
                            slot.activityType === 'KBM'
                              ? '#b6dfd5'
                              : slot.activityType === 'UPACARA'
                              ? '#f8c8c2'
                              : slot.activityType === 'ISTIRAHAT'
                              ? '#f5e3b5'
                              : slot.activityType === 'RELIGI'
                              ? '#e5d0f5'
                              : '#d2dad6';

                          const badgeColor =
                            slot.activityType === 'KBM'
                              ? '#1b5b52'
                              : slot.activityType === 'UPACARA'
                              ? '#a6392a'
                              : slot.activityType === 'ISTIRAHAT'
                              ? '#8f681a'
                              : slot.activityType === 'RELIGI'
                              ? '#6a2f96'
                              : '#4c5c58';

                          return (
                            <div
                              key={sIdx}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background: badgeBg,
                                border: `1px solid ${badgeBorder}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: badgeColor, letterSpacing: '0.05em' }}>
                                  JAM #{sIdx + 1}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#173637' }}>
                                  {slot.start} – {slot.end}
                                </span>
                              </div>

                              <div style={{ fontWeight: 700, fontSize: '12px', color: badgeColor }}>
                                {isKbm
                                  ? `JP ${currentJpNo} · Belajar Mengajar`
                                  : slot.activityName ||
                                    (slot.activityType === 'UPACARA'
                                      ? 'Upacara Bendera'
                                      : slot.activityType === 'ISTIRAHAT'
                                      ? 'Istirahat'
                                      : slot.activityType === 'RELIGI'
                                      ? 'Religi / Dhuha'
                                      : 'Kegiatan Lain')}
                              </div>

                              <div style={{ fontSize: '10px', color: '#7a8a86' }}>
                                {isKbm ? 'Dapat diisi mapel' : 'Diblokir dari jadwal'}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          marginTop: '12px',
                          padding: '10px 14px',
                          background: '#f4f8f6',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '11px',
                          color: '#2a5a52',
                        }}
                      >
                        <span>
                          <strong>Ringkasan Hari {previewDay}:</strong> {daySlots.filter((d) => d.activityType === 'KBM').length} Jam Pelajaran (KBM) dan {daySlots.filter((d) => d.activityType !== 'KBM').length} Jam Kegiatan Non-KBM.
                        </span>
                        <span style={{ fontWeight: 700 }}>
                          {daySlots[0]?.start ?? '07:00'} – {daySlots[daySlots.length - 1]?.end ?? '13:00'}
                        </span>
                      </div>
                    </div>
                  );
                })()
              )}
            </Card>
          </div>

          <aside className="settings-side-column">
            <Card eyebrow="DURATION STANDARD" title="Konversi Astronomis">
              <div className="field-group">
                <label>Durasi 1 JP (Menit)</label>
                <select value={periodMinutes} onChange={(e) => setPeriodMinutes(e.target.value)}>
                  <option value="35">35 Menit (SD/MI)</option>
                  <option value="40">40 Menit (MTs / Standar)</option>
                  <option value="45">45 Menit (MA / SMA)</option>
                </select>
                <small>Digunakan untuk menghitung jam astronomis pada dashboard Beban Guru.</small>
              </div>
            </Card>

            <div className="settings-danger-card">
              <div className="settings-danger-icon"><RefreshCw size={18} /></div>
              <h3>Reset Workspace</h3>
              <p>Kembalikan seluruh data ke dataset demo awal madrasah.</p>
              <Button variant="danger" icon={RefreshCw} onClick={onReset}>
                Reset ke Demo
              </Button>
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="settings-layout">
          <div className="settings-main-column">
            <Card eyebrow="SCHOOL IDENTITY" title="Identitas Madrasah">
              <div className="settings-form-grid">
                <div className="field-group field-span-two">
                  <label>Nama Madrasah / Sekolah</label>
                  <input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Nama sekolah"
                  />
                </div>
                <div className="field-group">
                  <label>Tahun Ajaran</label>
                  <input
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2026/2027"
                  />
                </div>
                <div className="field-group">
                  <label>Semester</label>
                  <select value={semester} onChange={(e) => setSemester(e.target.value as 'Ganjil' | 'Genap')}>
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button icon={Save} onClick={handleSave}>Simpan Identitas</Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="settings-layout">
          <div className="settings-main-column">
            <Card eyebrow="OPTIONAL AI ASSISTANT" title="Integrasi Gemini AI">
              <div className="ai-setting-row">
                <div className="ai-setting-icon"><Sparkles size={20} /></div>
                <div className="ai-setting-copy">
                  <strong>Asisten Penjelasan Konflik Jadwal (Gemini)</strong>
                  <p>
                    AI memberikan saran dan langkah perbaikan atas konflik jadwal dalam bahasa alami.
                    Validator deterministik tetap menjadi sumber kebenaran tunggal; AI tidak dapat mengesahkan jadwal.
                  </p>
                  <div className="ai-setting-state">
                    <StatusPill status={geminiEnabled ? 'warning' : 'neutral'}>
                      {geminiEnabled ? 'Status: AKTIF' : 'Status: NONAKTIF (Default)'}
                    </StatusPill>
                    <span>Tidak memerlukan input API key di antarmuka web.</span>
                  </div>
                </div>
                <button
                  className={`toggle-switch ${geminiEnabled ? 'is-on' : ''}`}
                  role="switch"
                  aria-checked={geminiEnabled}
                  onClick={() => setGeminiEnabled(!geminiEnabled)}
                >
                  <span />
                </button>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button icon={Save} onClick={handleSave}>Simpan Preferensi AI</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * GENERATOR SCREEN
 */
function GeneratorScreen({
  state,
  isGenerating,
  result,
  onGenerate,
  onChoose,
  onNavigate: _onNavigate,
}: {
  state: AppState;
  isGenerating: boolean;
  result: { status: GeneratorStatus; message: string; nodes: number } | null;
  onGenerate: () => void;
  onChoose: (id: string) => void;
  onNavigate?: (screen: ScreenId) => void;
}) {
  const statuses: Record<GeneratorStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
    QUEUED: { label: 'Menunggu', tone: 'neutral' },
    RUNNING: { label: 'Mencari kandidat', tone: 'info' },
    SUCCESS: { label: 'Berhasil', tone: 'success' },
    INFEASIBLE: { label: 'Tidak feasible', tone: 'danger' },
    SEARCH_LIMIT_REACHED: { label: 'Batas pencarian tercapai', tone: 'warning' },
    INVALID_INPUT: { label: 'Data belum lengkap', tone: 'warning' },
    CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
    FAILED: { label: 'Gagal', tone: 'danger' },
  };

  const allJP = state.requirements.reduce((sum, item) => sum + item.requiredJP, 0);

  return (
    <>
      <PageHeading
        kicker="DETERMINISTIC ENGINE"
        title="Schedule Generator"
        description={`Mesin pencarian otomatis yang mematuhi seluruh hard constraint alokasi (${allJP} JP total kebutuhan) dan ketersediaan guru.`}
        actions={
          <Button icon={WandSparkles} onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? 'Sedang mencari…' : 'Jalankan Generator'}
          </Button>
        }
      />

      <div className="dashboard-grid generator-main-grid">
        <Card eyebrow="CONSTRAINT SEARCH" title="Hasil Penyusunan Jadwal">
          <div className="result-status-top">
            <div className="result-status-icon">
              {isGenerating ? (
                <LoaderCircle className="spinning" size={22} />
              ) : result?.status === 'SUCCESS' ? (
                <CheckCircle2 size={22} />
              ) : result?.status && ['INFEASIBLE', 'FAILED'].includes(result.status) ? (
                <XCircle size={22} />
              ) : (
                <WandSparkles size={22} />
              )}
            </div>
            <div>
              <strong>{isGenerating ? 'Searching candidates…' : result ? statuses[result.status].label : 'Belum ada pencarian baru'}</strong>
              <span>{isGenerating ? 'Memeriksa slot, alokasi, dan bentrok lintas kelas.' : result?.message ?? 'Klik tombol di atas untuk menyusun jadwal.'}</span>
            </div>
          </div>

          {result && (
            <div className="result-stats">
              <div><span>Search nodes</span><strong>{result.nodes.toLocaleString('id-ID')}</strong></div>
              <div><span>Status</span><StatusPill status={statuses[result.status].tone}>{statuses[result.status].label}</StatusPill></div>
            </div>
          )}

          <div className="result-disclaimer">
            <ShieldCheck size={16} />
            <span>Hasil berstatus <strong>SUCCESS</strong> lolos seluruh aturan validasi keras sebelum disimpan ke draft.</span>
          </div>
        </Card>

        <Card eyebrow="CANDIDATE HISTORY" title="Kandidat Tersimpan">
          {!state.candidates.length ? (
            <EmptyState icon={WandSparkles} title="Belum ada kandidat" description="Kandidat valid akan muncul di sini." />
          ) : (
            <div className="candidate-table-wrap">
              <table className="data-table candidate-table">
                <thead>
                  <tr>
                    <th>Kandidat</th>
                    <th>Coverage</th>
                    <th>Skor</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {state.candidates.map((cand) => (
                    <tr key={cand.id}>
                      <td>
                        <strong>{cand.label}</strong>
                        <small style={{ display: 'block', color: '#7a8a86' }}>{cand.entries.length} penempatan</small>
                      </td>
                      <td>
                        <StatusPill status={cand.report.valid ? 'success' : 'danger'}>
                          {cand.report.valid ? '100% Lolos' : `${cand.report.hardErrorCount} Isu`}
                        </StatusPill>
                      </td>
                      <td><strong>{cand.score}</strong></td>
                      <td>
                        <Button variant="secondary" onClick={() => onChoose(cand.id)}>Terapkan</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/**
 * MASTER DATA SCREEN
 */
function MasterScreen({
  state,
  activeTab,
  onTabChange,
  search,
  onSearch,
  onAdd,
  addType,
  form,
  setForm,
  onSave,
  onCancelAdd,
  onDelete,
  onEditClass,
  onEditTeacher,
  onEditSubject,
  onOpenAddModal,
  onNavigate,
}: {
  state: AppState;
  activeTab: MasterTab;
  onTabChange: (tab: MasterTab) => void;
  search: string;
  onSearch: (value: string) => void;
  onAdd: (type: Exclude<AddType, null>) => void;
  addType: AddType;
  form: typeof emptyMasterForm;
  setForm: (value: typeof emptyMasterForm) => void;
  onSave: (event: FormEvent) => void;
  onCancelAdd: () => void;
  onDelete: (kind: MasterTab, id: string) => void;
  onEditClass: (c: SchoolClass) => void;
  onEditTeacher: (t: Teacher) => void;
  onEditSubject: (s: Subject) => void;
  onOpenAddModal?: (kind: 'class' | 'teacher' | 'subject') => void;
  onNavigate?: (screen: ScreenId) => void;
}) {
  const filteredClasses = state.classes.filter((item) => `${item.name} ${item.level}`.toLowerCase().includes(search.toLowerCase()));
  const filteredTeachers = state.teachers.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(search.toLowerCase()));
  const filteredSubjects = state.subjects.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      {/* Consolidated Academic Hub Switcher */}
      {onNavigate && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button className="button button-primary" style={{ padding: '8px 14px', fontSize: '12.5px', borderRadius: '8px' }}>
            Data Master (Kelas, Guru, Mapel)
          </button>
          <button
            className="button button-secondary"
            onClick={() => onNavigate('requirements')}
            style={{ padding: '8px 14px', fontSize: '12.5px', borderRadius: '8px' }}
          >
            Alokasi Kebutuhan JP
          </button>
          <button
            className="button button-secondary"
            onClick={() => onNavigate('workload')}
            style={{ padding: '8px 14px', fontSize: '12.5px', borderRadius: '8px' }}
          >
            Analisis Beban Guru
          </button>
        </div>
      )}

      <PageHeading
        kicker="DATA MASTER REPOSITORY"
        title="Data Master Madrasah"
        description="Kelola kelas, guru pengampu beserta kualifikasi mapel, dan mata pelajaran kurikulum."
        actions={
          <Button
            icon={Plus}
            onClick={() =>
              onOpenAddModal
                ? onOpenAddModal(activeTab === 'classes' ? 'class' : activeTab === 'teachers' ? 'teacher' : 'subject')
                : onAdd(activeTab === 'classes' ? 'class' : activeTab === 'teachers' ? 'teacher' : 'subject')
            }
          >
            Tambah {activeTab === 'classes' ? 'Kelas' : activeTab === 'teachers' ? 'Guru' : 'Mapel'}
          </Button>
        }
      />

      <Card title="Master Records" eyebrow="DATA GOVERNANCE" action={
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={15} />
            <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Cari nama atau kode…" />
          </div>
        </div>
      }>
        <div className="segmented-tabs">
          <button className={activeTab === 'classes' ? 'active' : ''} onClick={() => onTabChange('classes')}>
            Kelas <span>{state.classes.length}</span>
          </button>
          <button className={activeTab === 'teachers' ? 'active' : ''} onClick={() => onTabChange('teachers')}>
            Guru <span>{state.teachers.length}</span>
          </button>
          <button className={activeTab === 'subjects' ? 'active' : ''} onClick={() => onTabChange('subjects')}>
            Mata Pelajaran <span>{state.subjects.length}</span>
          </button>
        </div>

        {addType && (
          <form className="inline-create-form" onSubmit={onSave}>
            <div className="inline-create-title">
              <div className="inline-create-icon"><Plus size={17} /></div>
              <div>
                <strong>Tambah {addType === 'class' ? 'Kelas Baru' : addType === 'teacher' ? 'Guru Baru' : 'Mapel Baru'}</strong>
                <span>Tersimpan secara lokal di browser Anda.</span>
              </div>
              <button className="icon-button" type="button" onClick={onCancelAdd}><X size={16} /></button>
            </div>
            <div className="form-grid-two">
              <div className="field-group">
                <label>{addType === 'class' ? 'Nama Kelas' : addType === 'teacher' ? 'Nama Guru' : 'Nama Mapel'}</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masukkan nama..." />
              </div>
              {addType === 'class' ? (
                <div className="field-group">
                  <label>Tingkat</label>
                  <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                    <option>VII</option><option>VIII</option><option>IX</option>
                  </select>
                </div>
              ) : (
                <div className="field-group">
                  <label>Kode</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Contoh: T-10 atau MAT" />
                </div>
              )}
            </div>
            {addType === 'teacher' && (
              <>
                <div className="field-group">
                  <label>Kualifikasi Mapel yang Diampu</label>
                  <div className="qualification-check-grid">
                    {state.subjects.map((sub) => (
                      <label key={sub.id} className={`qualification-check ${form.selectedSubjectIds.includes(sub.id) ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={form.selectedSubjectIds.includes(sub.id)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              selectedSubjectIds: e.target.checked
                                ? [...form.selectedSubjectIds, sub.id]
                                : form.selectedSubjectIds.filter((id) => id !== sub.id),
                            })
                          }
                        />
                        <span className="tiny-subject-dot" style={{ background: sub.color }} />
                        {sub.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field-group narrow-field">
                  <label>Batas Maksimum Mengajar (JP/minggu)</label>
                  <input type="number" min="1" max="50" value={form.maxWeeklyJP} onChange={(e) => setForm({ ...form, maxWeeklyJP: e.target.value })} />
                </div>
              </>
            )}
            <div className="inline-form-actions">
              <Button variant="secondary" onClick={onCancelAdd}>Batal</Button>
              <Button type="submit" icon={Save}>Simpan</Button>
            </div>
          </form>
        )}

        {/* Classes Table */}
        {activeTab === 'classes' && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Tingkat</th>
                  <th>Alokasi Kebutuhan</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((c) => {
                  const reqs = state.requirements.filter((r) => r.classId === c.id);
                  const total = reqs.reduce((sum, r) => sum + r.requiredJP, 0);
                  return (
                    <tr key={c.id}>
                      <td><strong>Kelas {c.name}</strong></td>
                      <td><span className="level-pill">{c.level}</span></td>
                      <td><strong>{total} JP</strong> ({reqs.length} mapel)</td>
                      <td><StatusPill status={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Aktif' : 'Nonaktif'}</StatusPill></td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-row-actions-group">
                          <button
                            className="icon-button table-row-action edit-action"
                            onClick={() => onEditClass(c)}
                            title="Edit data kelas"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="icon-button table-row-action"
                            onClick={() => onDelete('classes', c.id)}
                            title="Hapus kelas"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Teachers Table */}
        {activeTab === 'teachers' && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Guru</th>
                  <th>Kode</th>
                  <th>Kualifikasi Mapel</th>
                  <th>Beban Kebutuhan (JP)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((t) => {
                  const teacherReqs = state.requirements.filter((r) => r.teacherId === t.id);
                  const totalAssignedJP = teacherReqs.reduce((sum, r) => sum + r.requiredJP, 0);
                  const maxJP = t.maxWeeklyJP || 24;
                  const pct = Math.round((totalAssignedJP / maxJP) * 100);
                  const isOverload = totalAssignedJP > maxJP;
                  const isFull = totalAssignedJP === maxJP;

                  return (
                    <tr key={t.id}>
                      <td><strong>{t.name}</strong></td>
                      <td><span className="code-pill">{t.code}</span></td>
                      <td>
                        <div className="tag-list">
                          {t.subjectIds.map((sid) => {
                            const sub = getSubject(state, sid);
                            return sub ? <span key={sid} className="subject-tag"><i style={{ background: sub.color }} />{sub.code}</span> : null;
                          })}
                        </div>
                      </td>
                      <td style={{ minWidth: '150px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 600 }}>
                            <span style={{ color: isOverload ? '#b24c3d' : '#173637' }}>
                              {totalAssignedJP} / {maxJP} JP
                            </span>
                            <span style={{ color: isOverload ? '#b24c3d' : '#7a8a86', fontSize: '11px' }}>
                              {pct}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '5px', background: '#e1e9e5', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                height: '100%',
                                background: isOverload ? '#b24c3d' : isFull ? '#2f7771' : '#49886d',
                                borderRadius: '3px',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td><StatusPill status={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Aktif' : 'Nonaktif'}</StatusPill></td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-row-actions-group">
                          {onNavigate && (
                            <button
                              className="icon-button table-row-action"
                              onClick={() => onNavigate('workload')}
                              title="Buka Analisis Beban Guru ini"
                              style={{ color: '#2f7771' }}
                            >
                              <TrendingUp size={15} />
                            </button>
                          )}
                          <button
                            className="icon-button table-row-action edit-action"
                            onClick={() => onEditTeacher(t)}
                            title="Edit data guru"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="icon-button table-row-action"
                            onClick={() => onDelete('teachers', t.id)}
                            title="Hapus guru"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Subjects Table */}
        {activeTab === 'subjects' && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mata Pelajaran</th>
                  <th>Kode</th>
                  <th>Guru Berkualifikasi</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((s) => {
                  const teachers = state.teachers.filter((t) => t.isActive && t.subjectIds.includes(s.id));
                  return (
                    <tr key={s.id}>
                      <td>
                        <span className="subject-color-swatch" style={{ background: s.color, marginRight: '8px' }} />
                        <strong>{s.name}</strong>
                      </td>
                      <td><span className="code-pill">{s.code}</span></td>
                      <td>{teachers.length} guru</td>
                      <td><StatusPill status={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Aktif' : 'Nonaktif'}</StatusPill></td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-row-actions-group">
                          <button
                            className="icon-button table-row-action edit-action"
                            onClick={() => onEditSubject(s)}
                            title="Edit mata pelajaran"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="icon-button table-row-action"
                            onClick={() => onDelete('subjects', s.id)}
                            title="Hapus mapel"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/**
 * REQUIREMENTS & ALLOCATIONS SCREEN
 */
function RequirementsScreen({
  state,
  masterIssues,
  formOpen,
  setFormOpen,
  form,
  setForm,
  onSave,
  onDelete,
  onGenerate,
  onNavigate: _onNavigate,
  onEdit,
  onOpenAddModal,
}: {
  state: AppState;
  masterIssues?: ValidationIssue[];
  formOpen: boolean;
  setFormOpen: (value: boolean) => void;
  form: typeof emptyRequirementForm;
  setForm: (value: typeof emptyRequirementForm) => void;
  onSave: (event: FormEvent) => void;
  onDelete: (requirement: Requirement) => void;
  onGenerate: () => void;
  onNavigate?: (screen: ScreenId) => void;
  onEdit?: (r: Requirement) => void;
  onOpenAddModal?: () => void;
}) {
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [onlyIssuesFilter, setOnlyIssuesFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [validationExpanded, setValidationExpanded] = useState<boolean>(true);

  // 1. Calculate Total Weekly Slots per Class
  const totalWeeklySlots = useMemo(() => {
    return state.settings.activeDays.reduce(
      (sum, day) => sum + teachingPeriodsForDay(state.slots, day).length,
      0
    );
  }, [state.settings.activeDays, state.slots]);

  const totalJP = state.requirements.reduce((sum, item) => sum + item.requiredJP, 0);

  // 2. Real-Time Class Capacity Metrics
  const classCapacityStats = useMemo(() => {
    return state.classes
      .filter((c) => c.isActive)
      .map((cls) => {
        const classReqs = state.requirements.filter((r) => r.classId === cls.id);
        const allocatedJP = classReqs.reduce((sum, r) => sum + r.requiredJP, 0);
        const diff = allocatedJP - totalWeeklySlots;
        const isExact = diff === 0;
        const isOver = diff > 0;
        const isUnder = diff < 0;
        return {
          cls,
          allocatedJP,
          diff,
          isExact,
          isOver,
          isUnder,
          reqCount: classReqs.length,
        };
      });
  }, [state.classes, state.requirements, totalWeeklySlots]);

  // 3. Real-Time Teacher Workload Metrics
  const teacherWorkloadStats = useMemo(() => {
    const map = new Map<string, { totalJP: number; maxJP: number; isOver: boolean; isFull: boolean; pct: number }>();
    for (const t of state.teachers) {
      const reqs = state.requirements.filter((r) => r.teacherId === t.id);
      const teacherTotalJP = reqs.reduce((sum, r) => sum + r.requiredJP, 0);
      const maxJP = t.maxWeeklyJP || 24;
      map.set(t.id, {
        totalJP: teacherTotalJP,
        maxJP,
        isOver: teacherTotalJP > maxJP,
        isFull: teacherTotalJP === maxJP,
        pct: Math.round((teacherTotalJP / maxJP) * 100),
      });
    }
    return map;
  }, [state.teachers, state.requirements]);

  // 4. Real-Time Data Master Issues
  const liveIssues = useMemo(() => {
    return masterIssues ?? validateMasterData(state);
  }, [masterIssues, state]);

  const criticalIssues = useMemo(() => liveIssues.filter((i) => i.severity === 'error'), [liveIssues]);
  const warningIssues = useMemo(() => liveIssues.filter((i) => i.severity === 'warning'), [liveIssues]);

  // Filtered Requirements
  const filteredRequirements = useMemo(() => {
    return state.requirements.filter((r) => {
      if (selectedClassFilter !== 'ALL' && r.classId !== selectedClassFilter) return false;

      const tStat = teacherWorkloadStats.get(r.teacherId);
      const cStat = classCapacityStats.find((c) => c.cls.id === r.classId);

      if (onlyIssuesFilter) {
        const hasIssue = tStat?.isOver || cStat?.isOver || cStat?.isUnder;
        if (!hasIssue) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clsName = getClass(state, r.classId)?.name.toLowerCase() ?? '';
        const subName = getSubject(state, r.subjectId)?.name.toLowerCase() ?? '';
        const tchName = getTeacher(state, r.teacherId)?.name.toLowerCase() ?? '';
        if (!clsName.includes(q) && !subName.includes(q) && !tchName.includes(q)) return false;
      }

      return true;
    });
  }, [state, selectedClassFilter, onlyIssuesFilter, searchQuery, teacherWorkloadStats, classCapacityStats]);

  // Inline Form Simulation Calculations
  const simTeacher = state.teachers.find((t) => t.id === form.teacherId);
  const simClass = state.classes.find((c) => c.id === form.classId);
  const simSubject = state.subjects.find((s) => s.id === form.subjectId);
  const simJP = Number(form.requiredJP) || 0;

  const currentTeacherJP = state.requirements
    .filter((r) => r.teacherId === form.teacherId)
    .reduce((sum, r) => sum + r.requiredJP, 0);
  const nextTeacherJP = currentTeacherJP + simJP;
  const simTeacherMax = simTeacher?.maxWeeklyJP || 24;
  const isSimTeacherOver = nextTeacherJP > simTeacherMax;

  const currentClassJP = state.requirements
    .filter((r) => r.classId === form.classId)
    .reduce((sum, r) => sum + r.requiredJP, 0);
  const nextClassJP = currentClassJP + simJP;
  const isSimClassOver = nextClassJP > totalWeeklySlots;
  const isSimClassExact = nextClassJP === totalWeeklySlots;

  const isFormTeacherQualified = simTeacher && form.subjectId ? simTeacher.subjectIds.includes(form.subjectId) : false;

  return (
    <>
      {/* Consolidated Academic Hub Switcher */}
      {_onNavigate && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button
            className="button button-secondary"
            onClick={() => _onNavigate('master')}
            style={{ padding: '8px 14px', fontSize: '12.5px', borderRadius: '8px' }}
          >
            Data Master (Kelas, Guru, Mapel)
          </button>
          <button className="button button-primary" style={{ padding: '8px 14px', fontSize: '12.5px', borderRadius: '8px' }}>
            Alokasi Kebutuhan JP
          </button>
          <button
            className="button button-secondary"
            onClick={() => _onNavigate('workload')}
            style={{ padding: '8px 14px', fontSize: '12.5px', borderRadius: '8px' }}
          >
            Analisis Beban Guru
          </button>
        </div>
      )}

      <PageHeading
        kicker="CURRICULUM PLANNING & MASTER VALIDATION"
        title="Kebutuhan &amp; Alokasi JP"
        description={`Tetapkan alokasi jam pelajaran mingguan untuk tiap kelas (${totalJP} JP terdaftar) dan pantau kepatuhan data master secara langsung.`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant={criticalIssues.length > 0 ? 'secondary' : 'primary'}
              icon={WandSparkles}
              onClick={onGenerate}
            >
              Susun Jadwal Otomatis
            </Button>
            <Button
              icon={Plus}
              onClick={() => (onOpenAddModal ? onOpenAddModal() : setFormOpen(!formOpen))}
            >
              Tambah Alokasi
            </Button>
          </div>
        }
      />

      {/* 1. REAL-TIME DATA MASTER VALIDATION HUB */}
      {liveIssues.length > 0 ? (
        <div
          style={{
            background: criticalIssues.length > 0 ? '#fff8f7' : '#fffcf5',
            border: `1.5px solid ${criticalIssues.length > 0 ? '#f5c6cb' : '#faebcc'}`,
            borderRadius: '12px',
            padding: '16px 18px',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: criticalIssues.length > 0 ? '#fde8e8' : '#fef3c7',
                  color: criticalIssues.length > 0 ? '#c81e1e' : '#b45309',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '13.5px', color: '#173637', display: 'block' }}>
                  Validasi Real-Time Data Master: {criticalIssues.length} Isu Kritis &amp; {warningIssues.length} Peringatan
                </strong>
                <span style={{ fontSize: '11px', color: '#556663' }}>
                  Perubahan alokasi langsung divalidasi dengan aturan kapasitas kelas dan beban maksimum guru tanpa perlu berpindah layar.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="button button-secondary"
                onClick={() => setOnlyIssuesFilter(!onlyIssuesFilter)}
                style={{
                  fontSize: '11.5px',
                  height: '32px',
                  background: onlyIssuesFilter ? '#173637' : '#ffffff',
                  color: onlyIssuesFilter ? '#ffffff' : '#173637',
                }}
              >
                {onlyIssuesFilter ? 'Tampilkan Semua Alokasi' : 'Fokuskan Isu Alokasi'}
              </button>
              <button
                className="icon-button"
                onClick={() => setValidationExpanded(!validationExpanded)}
                title={validationExpanded ? 'Sembunyikan rincian isu' : 'Tampilkan rincian isu'}
                style={{ height: '32px', width: '32px' }}
              >
                <ChevronDown size={16} style={{ transform: validationExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            </div>
          </div>

          {validationExpanded && (
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {liveIssues.slice(0, 5).map((issue) => {
                const isError = issue.severity === 'error';
                return (
                  <div
                    key={issue.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ffffff',
                      border: `1px solid ${isError ? '#f8d0c8' : '#faebcc'}`,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isError ? '#fde8e8' : '#fef3c7',
                          color: isError ? '#9b1c1c' : '#92400e',
                        }}
                      >
                        {isError ? 'KRITIS' : 'PERINGATAN'}
                      </span>
                      <strong style={{ color: '#173637' }}>{issue.title}:</strong>
                      <span style={{ color: '#556663' }}>{issue.message}</span>
                    </div>

                    {/* Interactive Context Action */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {issue.code === 'DATA-TEACHER-LOAD-OVER' && (
                        <button
                          className="button button-quiet"
                          style={{ fontSize: '10.5px', height: '26px' }}
                          onClick={() => {
                            const tch = state.teachers.find((t) => issue.message.includes(t.name));
                            if (tch) setSearchQuery(tch.name);
                          }}
                        >
                          Tinjau Alokasi Guru
                        </button>
                      )}
                      {(issue.code === 'DATA-CLASS-DEMAND-CAPACITY' || issue.code === 'DATA-CLASS-NO-DEMAND') && (
                        <button
                          className="button button-quiet"
                          style={{ fontSize: '10.5px', height: '26px' }}
                          onClick={() => {
                            const cls = state.classes.find((c) => issue.message.includes(c.name) || issue.title.includes(c.name));
                            if (cls) setSelectedClassFilter(cls.id);
                          }}
                        >
                          Fokuskan Kelas
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: '#eef8f2',
            border: '1.5px solid #b7e3ca',
            borderRadius: '12px',
            padding: '12px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#d1fae5', color: '#065f46', display: 'grid', placeItems: 'center' }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <strong style={{ fontSize: '13px', color: '#065f46', display: 'block' }}>
                Data Master &amp; Alokasi 100% Selaras
              </strong>
              <span style={{ fontSize: '11px', color: '#16483f' }}>
                Semua {classCapacityStats.length} kelas aktif telah memenuhi kapasitas {totalWeeklySlots} JP/minggu dan tidak ada guru yang melebihi batas beban.
              </span>
            </div>
          </div>
          <button
            className="button button-primary"
            onClick={onGenerate}
            style={{ fontSize: '11.5px', height: '32px' }}
          >
            <WandSparkles size={14} /> Buat Jadwal Sekarang
          </button>
        </div>
      )}

      {/* 2. REAL-TIME CLASS CAPACITY & DEMAND TRACKER (INTERACTIVE CHIPS) */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#31544d', letterSpacing: '0.06em' }}>
            MONITOR KAPASITAS KELAS ({totalWeeklySlots} JP/MINGGU PER KELAS)
          </span>
          {selectedClassFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedClassFilter('ALL')}
              style={{ border: 0, background: 'none', color: '#24635e', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
            >
              ✕ Tampilkan Semua Kelas
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <button
            onClick={() => setSelectedClassFilter('ALL')}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1.5px solid ${selectedClassFilter === 'ALL' ? '#24635e' : '#e0e7e3'}`,
              background: selectedClassFilter === 'ALL' ? '#eaf4ee' : '#fffdf8',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '12.5px', color: '#173637' }}>Semua Kelas</strong>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#556663' }}>{state.requirements.length} Mapel</span>
            </div>
            <span style={{ fontSize: '11px', color: '#556663' }}>
              Total {totalJP} JP dialokasikan
            </span>
          </button>

          {classCapacityStats.map((c) => {
            const isSelected = selectedClassFilter === c.cls.id;
            const statusColor = c.isOver ? '#b24c3d' : c.isExact ? '#1f6952' : '#9c6f28';
            const statusBg = c.isOver ? '#fdf0ee' : c.isExact ? '#e8f5ee' : '#fbf4e8';

            return (
              <button
                key={c.cls.id}
                onClick={() => setSelectedClassFilter(isSelected ? 'ALL' : c.cls.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: `1.5px solid ${isSelected ? statusColor : '#e0e7e3'}`,
                  background: isSelected ? statusBg : '#fffdf8',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '12.5px', color: '#173637' }}>Kelas {c.cls.name}</strong>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '4px',
                      background: statusBg,
                      color: statusColor,
                    }}
                  >
                    {c.isExact ? '100% Pas' : c.isOver ? `+${c.diff} JP` : `${c.diff} JP`}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4b6660' }}>
                  <span>Alokasi:</span>
                  <strong style={{ color: statusColor }}>{c.allocatedJP} / {totalWeeklySlots} JP</strong>
                </div>

                <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (c.allocatedJP / (totalWeeklySlots || 1)) * 100)}%`,
                      height: '100%',
                      background: statusColor,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. INLINE FORM WITH REAL-TIME SIMULATION */}
      {formOpen && (
        <Card eyebrow="NEW ALLOCATION" title="Tambah Alokasi JP">
          <form className="requirement-form-grid" onSubmit={onSave}>
            <div className="field-group">
              <label>Kelas</label>
              <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">Pilih kelas</option>
                {state.classes.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>Kelas {c.name}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Mata Pelajaran</label>
              <select
                required
                value={form.subjectId}
                onChange={(e) => {
                  const sid = e.target.value;
                  const t = state.teachers.find((tch) => tch.isActive && tch.subjectIds.includes(sid));
                  setForm({ ...form, subjectId: sid, teacherId: t?.id ?? '' });
                }}
              >
                <option value="">Pilih mapel</option>
                {state.subjects.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Guru Pengampu</label>
              <select required value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">Pilih guru</option>
                {state.teachers.filter((t) => t.isActive && form.subjectId && t.subjectIds.includes(form.subjectId)).length > 0 && (
                  <optgroup label="Guru Sesuai Kualifikasi Mapel">
                    {state.teachers
                      .filter((t) => t.isActive && form.subjectId && t.subjectIds.includes(form.subjectId))
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Semua Guru Terdaftar Lainnya (Lintas Mapel)">
                  {state.teachers
                    .filter((t) => !form.subjectId || !t.subjectIds.includes(form.subjectId))
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                </optgroup>
              </select>
            </div>
            <div className="field-group">
              <label>Alokasi (JP/minggu)</label>
              <input required type="number" min="1" max="50" value={form.requiredJP} onChange={(e) => setForm({ ...form, requiredJP: e.target.value })} />
            </div>
            <div className="requirement-form-actions">
              <Button type="submit" icon={Save}>Simpan Alokasi</Button>
            </div>
          </form>

          {/* Real-Time Live Form Simulation Card */}
          {form.classId && form.teacherId && (
            <div
              style={{
                marginTop: '14px',
                padding: '12px 14px',
                background: '#f4f8f5',
                borderRadius: '9px',
                border: '1px solid #c9ded2',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: '#274b43' }}>Simulasi Kapasitas Kelas {simClass?.name}:</span>
                  <strong style={{ color: isSimClassOver ? '#b24c3d' : isSimClassExact ? '#1f6952' : '#173637' }}>
                    {nextClassJP} / {totalWeeklySlots} JP
                  </strong>
                </div>
                <div style={{ height: '5px', background: '#e0e7e3', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (nextClassJP / (totalWeeklySlots || 1)) * 100)}%`,
                      height: '100%',
                      background: isSimClassOver ? '#b24c3d' : isSimClassExact ? '#1f6952' : '#2563eb',
                    }}
                  />
                </div>
                <small style={{ color: isSimClassOver ? '#b24c3d' : '#556663', marginTop: '3px', display: 'block' }}>
                  {isSimClassOver
                    ? `⚠️ Alokasi melebihi kapasitas kelas (${nextClassJP - totalWeeklySlots} JP kelebihan)`
                    : isSimClassExact
                    ? '✓ Tepat memenuhi kapasitas mingguan'
                    : `Sisa ${totalWeeklySlots - nextClassJP} slot JP`}
                </small>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: '#274b43' }}>Simulasi Beban Guru {simTeacher?.name}:</span>
                  <strong style={{ color: isSimTeacherOver ? '#b24c3d' : '#173637' }}>
                    {nextTeacherJP} / {simTeacherMax} JP
                  </strong>
                </div>
                <div style={{ height: '5px', background: '#e0e7e3', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (nextTeacherJP / (simTeacherMax || 1)) * 100)}%`,
                      height: '100%',
                      background: isSimTeacherOver ? '#b24c3d' : nextTeacherJP === simTeacherMax ? '#1f6952' : '#2563eb',
                    }}
                  />
                </div>
                <small style={{ color: isSimTeacherOver ? '#b24c3d' : '#556663', marginTop: '3px', display: 'block' }}>
                  {isSimTeacherOver
                    ? `⚠️ Beban guru melebihi batas maksimum (+${nextTeacherJP - simTeacherMax} JP)`
                    : `${Math.round((nextTeacherJP / simTeacherMax) * 100)}% dari batas maksimum guru`}
                </small>
              </div>

              {!isFormTeacherQualified && simSubject && (
                <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#16483f' }}>
                  ℹ Guru {simTeacher?.name} belum memiliki kualifikasi {simSubject.name}; sistem akan otomatis menyinkronkannya ke Data Master saat disimpan.
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* 4. TOOLBAR & FILTER CONTROLS */}
      <div className="toolbar-card" style={{ marginTop: '16px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ color: '#556663' }} />
          <input
            type="text"
            placeholder="Cari kelas, mapel, atau guru..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 0, outline: 'none', background: 'transparent', width: '100%', fontSize: '12.5px' }}
          />
          {searchQuery && (
            <button className="icon-button" onClick={() => setSearchQuery('')} style={{ height: '24px', width: '24px' }}>
              <X size={13} />
            </button>
          )}
        </div>

        <div className="toolbar-divider" />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#556663', fontWeight: 700 }}>
            Menampilkan {filteredRequirements.length} dari {state.requirements.length} Alokasi
          </span>
          {onlyIssuesFilter && (
            <span style={{ fontSize: '10.5px', background: '#fdf0ee', color: '#b24c3d', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
              Filter Isu Aktif
            </span>
          )}
        </div>
      </div>

      {/* 5. REQUIREMENTS TABLE WITH LIVE DATA MASTER STATUS */}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kelas &amp; Kapasitas</th>
              <th>Mata Pelajaran</th>
              <th>Guru Pengampu &amp; Status Beban</th>
              <th>Alokasi JP</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!filteredRequirements.length ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 16px', color: '#7a8a86' }}>
                  Tidak ada data alokasi yang sesuai dengan filter yang dipilih.
                </td>
              </tr>
            ) : (
              filteredRequirements.map((r) => {
                const cls = getClass(state, r.classId);
                const sub = getSubject(state, r.subjectId);
                const tch = getTeacher(state, r.teacherId);
                const tStat = tch ? teacherWorkloadStats.get(tch.id) : undefined;
                const cStat = classCapacityStats.find((c) => c.cls.id === r.classId);
                const isTchOver = tStat?.isOver ?? false;
                const isClsOver = cStat?.isOver ?? false;
                const isClsUnder = cStat?.isUnder ?? false;

                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong>Kelas {cls?.name}</strong>
                        <span style={{ fontSize: '11px', color: isClsOver ? '#b24c3d' : isClsUnder ? '#9c6f28' : '#1f6952', fontWeight: 600 }}>
                          {cStat?.allocatedJP ?? 0} / {totalWeeklySlots} JP
                          {isClsOver && ' (Kelebihan)'}
                          {isClsUnder && ` (Kurang ${Math.abs(cStat?.diff ?? 0)} JP)`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span className="subject-color-swatch" style={{ background: sub?.color, width: '6px', height: '24px', borderRadius: '3px' }} />
                        <div>
                          <strong style={{ fontSize: '13px' }}>{sub?.name}</strong>
                          <span style={{ fontSize: '10.5px', color: '#6b7280', display: 'block' }}>Kode: {sub?.code}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <strong style={{ fontSize: '13px' }}>{tch?.name}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isTchOver ? '#fdf0ee' : tStat?.isFull ? '#e8f5ee' : '#f0f4f8',
                              color: isTchOver ? '#b24c3d' : tStat?.isFull ? '#1f6952' : '#2563eb',
                            }}
                          >
                            Beban: {tStat?.totalJP ?? 0} / {tStat?.maxJP ?? 24} JP
                            {isTchOver && ` ⚠️ Overload (+${(tStat?.totalJP ?? 0) - (tStat?.maxJP ?? 24)} JP)`}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <strong style={{ fontSize: '14px', color: '#173637' }}>{r.requiredJP}</strong>
                        <span style={{ fontSize: '11px', color: '#556663' }}>JP/minggu</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-row-actions-group">
                        {onEdit && (
                          <button
                            className="icon-button table-row-action edit-action"
                            onClick={() => onEdit(r)}
                            title="Edit alokasi kebutuhan"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        <button
                          className="icon-button table-row-action"
                          onClick={() => onDelete(r)}
                          title="Hapus alokasi"
                        >
                          <Trash2 size={14} />
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
    </>
  );
}

/**
 * VALIDATION SCREEN
 */
function ValidationScreen({
  state,
  report,
  masterIssues,
  expandedIssue,
  setExpandedIssue,
  onNavigate,
  onValidate,
}: {
  state: AppState;
  report: ReturnType<typeof validateSchedule>;
  masterIssues: ValidationIssue[];
  expandedIssue: string | null;
  setExpandedIssue: (id: string | null) => void;
  onNavigate?: (screen: ScreenId) => void;
  onValidate: () => void;
}) {
  const combined = [...masterIssues, ...report.issues];
  const hardErrors = combined.filter((i) => i.severity === 'error');

  return (
    <>
      <PageHeading
        kicker="RULE COMPLIANCE"
        title="Validasi &amp; Konflik Jadwal"
        description="Validator deterministik memastikan jadwal 100% mematuhi aturan keras sebelum diterbitkan."
        actions={
          <Button icon={RefreshCw} onClick={onValidate}>
            Uji Ulang Jadwal
          </Button>
        }
      />

      <div className={`validation-banner ${hardErrors.length ? 'validation-banner-warning' : 'validation-banner-good'}`}>
        <div className="validation-banner-mark">
          {hardErrors.length ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
        </div>
        <div>
          <h2>{hardErrors.length ? 'Terdapat Pelanggaran Aturan Wajib' : 'Jadwal Memenuhi Seluruh Aturan Wajib'}</h2>
          <p>{hardErrors.length ? 'Perbaiki bentrok sebelum menerbitkan jadwal.' : 'Tidak ada konflik guru atau bentrok kelas.'}</p>
        </div>
        <div className="validation-banner-count">
          <strong>{hardErrors.length}</strong>
          <span>HARD ERRORS</span>
        </div>
      </div>

      {/* AI Conflict Helper Integration */}
      {state.settings.geminiEnabled && (
        <AiConflictHelper
          issues={combined}
          geminiEnabledInSettings={state.settings.geminiEnabled}
          onNavigateToScreen={onNavigate as any}
        />
      )}

      <div className="issue-list" style={{ marginTop: '16px' }}>
        {combined.map((issue) => (
          <div key={issue.id} className={`issue-item issue-${issue.severity}`}>
            <div className="issue-item-main" onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}>
              <div className="issue-severity-icon">
                {issue.severity === 'error' ? <XCircle size={18} /> : <AlertTriangle size={18} />}
              </div>
              <div className="issue-copy">
                <div className="issue-title-row">
                  <strong>{issue.title}</strong>
                  <span className="issue-code">{issue.code}</span>
                </div>
                <p>{issue.message}</p>
                {issue.context && <span className="issue-context">{issue.context}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * HISTORY SCREEN
 */
function HistoryScreen({ state, onRestore, onNavigate }: { state: AppState; onRestore: (version: ScheduleVersion) => void; onNavigate: (screen: ScreenId) => void }) {
  return (
    <>
      <PageHeading
        kicker="VERSION CONTROL"
        title="Riwayat Versi Jadwal"
        description="Snapshot jadwal resmi tersimpan secara lokal. Anda dapat memulihkan versi sebelumnya kapan saja."
        actions={<Button variant="secondary" icon={CalendarDays} onClick={() => onNavigate('schedule')}>Buka Jadwal</Button>}
      />

      <div className="version-timeline">
        {state.history.map((version, idx) => (
          <div key={version.id} className="version-row">
            <div className="timeline-track">
              <div className={`timeline-dot ${idx === 0 ? 'current' : ''}`}>{idx === 0 ? <Check size={13} /> : <span />}</div>
            </div>
            <div className="version-main">
              <div className="version-title-row">
                <div>
                  <div className="version-kicker">{idx === 0 ? 'ACTIVE VERSION' : `ARCHIVE · VERSI ${version.version}`}</div>
                  <h3>{version.label}</h3>
                </div>
                <div className="version-actions">
                  {idx === 0 && <StatusPill status="success">Aktif</StatusPill>}
                  <Button variant="secondary" icon={RefreshCw} onClick={() => onRestore(version)}>Pulihkan ke Draft</Button>
                </div>
              </div>
              <div className="version-meta">
                <span><Clock3 size={13} /> {formatShortDate(version.createdAt)}</span>
                <span><CalendarDays size={13} /> {version.entryCount} Penempatan</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * BACKUP SCREEN
 */
function BackupScreen({
  state,
  onBackup,
  onImport,
  onExportCSV,
  onExportJSON,
}: {
  state: AppState;
  onBackup: () => void;
  onImport: (file?: File) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}) {
  return (
    <>
      <PageHeading
        kicker="DATA PORTABILITY"
        title="Ekspor &amp; Backup Data"
        description={`Seluruh data ${state.settings.schoolName} tersimpan di browser Anda. Ekspor backup secara teratur untuk keamanan.`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" icon={Download} onClick={onExportJSON}>Ekspor JSON</Button>
            <Button icon={Download} onClick={onBackup}>Download Backup JSON</Button>
          </div>
        }
      />

      <div className="backup-actions-grid">
        <div className="backup-action-card">
          <div className="backup-action-icon json"><FileCheck2 size={21} /></div>
          <div className="backup-action-copy">
            <div className="backup-action-kicker">FULL WORKSPACE SNAPSHOT</div>
            <h3>Backup Penuh JSON</h3>
            <p>Cadangkan seluruh data master, alokasi kebutuhan, presensi, hari libur, dan jadwal ke file aman.</p>
            <Button icon={Download} onClick={onBackup}>Download Backup JSON</Button>
          </div>
        </div>

        <div className="backup-action-card">
          <div className="backup-action-icon csv"><FileSpreadsheet size={21} /></div>
          <div className="backup-action-copy">
            <div className="backup-action-kicker">SPREADSHEET EXPORT</div>
            <h3>Ekspor Jadwal CSV</h3>
            <p>Ekspor susunan jadwal ke format tabel CSV untuk dibuka di Microsoft Excel atau Google Sheets.</p>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={onExportCSV}>Ekspor CSV</Button>
          </div>
        </div>
      </div>

      <Card className="restore-card" eyebrow="RESTORE FROM BACKUP" title="Pulihkan Data Backup">
        <div className="restore-dropzone">
          <div className="restore-icon"><Upload size={21} /></div>
          <h3>Impor File Backup SIGNAL</h3>
          <p>Pilih file JSON hasil cadangan sebelumnya untuk memulihkan seluruh data madrasah.</p>
          <label className="button button-secondary file-pick-button">
            <Upload size={15} /> Pilih File JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </Card>
    </>
  );
}
