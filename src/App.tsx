import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock,
  Clock3,
  Download,
  Edit2,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  History,
  Home,
  Info,
  LayoutGrid,
  LoaderCircle,
  LockKeyhole,
  Menu,
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
  Award,
  RotateCcw,
  ZoomIn,
  ZoomOut,
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
  getTimelineRows,
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
import { COMMON_TEACHER_POSITIONS, getDefaultMadrasahLogo, processLogoUpload } from './utils/madrasahLogo';
import { compactSubjectName, compactTeacherName, getPrintableCellColor } from './utils/pdfExport';
import { groupClassesForMasterMatrix } from './utils/matrixGrouping';

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

interface NavGroup {
  sectionTitle: string;
  items: Array<{ id: ScreenId; label: string; icon: LucideIcon }>;
}

const navGroups: NavGroup[] = [
  {
    sectionTitle: 'RINGKASAN',
    items: [
      { id: 'overview', label: 'Beranda', icon: Home },
    ],
  },
  {
    sectionTitle: 'PERENCANAAN',
    items: [
      { id: 'master', label: 'Data Master', icon: DatabaseIcon },
      { id: 'requirements', label: 'Kebutuhan & Alokasi', icon: BookOpen },
      { id: 'generator', label: 'Schedule Generator', icon: WandSparkles },
    ],
  },
  {
    sectionTitle: 'OPERASIONAL',
    items: [
      { id: 'schedule', label: 'Jadwal Pelajaran', icon: CalendarDays },
      { id: 'validation', label: 'Validasi & Konflik', icon: ShieldCheck },
    ],
  },
  {
    sectionTitle: 'GURU',
    items: [
      { id: 'workload', label: 'Beban Guru', icon: Users },
      { id: 'attendance', label: 'Presensi Guru', icon: UserCheck },
    ],
  },
  {
    sectionTitle: 'KONTROL & SISTEM',
    items: [
      { id: 'history', label: 'Riwayat & Cadangan Data', icon: History },
      { id: 'settings', label: 'Pengaturan', icon: Settings2 },
    ],
  },
];

type MasterTab = 'classes' | 'teachers' | 'subjects';
type AddType = 'class' | 'teacher' | 'subject' | null;
interface EditSlotContext { classId: string; day: Day; jpNo: number }
interface ToastData { message: string; kind: 'success' | 'warning' | 'error' | 'info' }

const emptyMasterForm = {
  name: '',
  level: 'VII',
  code: '',
  roleTitle: 'Guru Mapel',
  nip: '',
  maxWeeklyJP: '24',
  selectedSubjectIds: [] as string[],
  color: '#2f7771',
};
const emptyRequirementForm = { classId: '', subjectId: '', teacherId: '', requiredJP: '4' };

function titleForScreen(screen: ScreenId) {
  const titles: Record<ScreenId, string> = {
    overview: 'Beranda Kerja Operator',
    schedule: 'Jadwal Pelajaran',
    workload: 'Statistik Beban Guru',
    attendance: 'Presensi Guru',
    generator: 'Schedule Generator',
    master: 'Data Master Madrasah',
    requirements: 'Kebutuhan & Alokasi JP',
    validation: 'Validasi & Kepatuhan Aturan',
    history: 'Riwayat Versi & Cadangan Data',
    backup: 'Ekspor & Cadangan Data',
    settings: 'Pengaturan Workspace',
  };
  return titles[screen] || 'SIGNAL';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // Drag and Drop Placement with Deterministic Collision Guard (Defense-in-depth)
  const handleDropSlot = (source: { classId: string; day: Day; jpNo: number }, target: { day: Day; jpNo: number }) => {
    if (!workspace) return;
    if (source.day === target.day && source.jpNo === target.jpNo) return;

    // 1. Resolve target slot: MUST be an active TEACHING slot for target day and jpNo
    const validTargetSlot = workspace.slots.find(
      (s) => s.day === target.day && s.kind === 'TEACHING' && s.active && s.jpNo === target.jpNo,
    );
    if (!validTargetSlot) {
      const nonKbmSlot = workspace.slots.find((s) => s.day === target.day && s.kind === 'BREAK');
      notify(
        `Tidak dapat dipindahkan: Target bukan slot KBM aktif${nonKbmSlot ? ` (terdapat kegiatan ${nonKbmSlot.label || nonKbmSlot.activityType})` : ''}.`,
        'error',
      );
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
    const targetSlot = workspace.slots.find(
      (s) => s.day === day && s.kind === 'TEACHING' && s.active && s.jpNo === jpNo,
    );
    if (!targetSlot) {
      notify(`Slot ${day} JP ${jpNo} bukan slot KBM aktif yang dapat diisi.`, 'warning');
      return;
    }
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

    // Defense-in-depth: Re-verify target slot is an active TEACHING slot
    const targetSlot = workspace.slots.find(
      (s) => s.day === day && s.kind === 'TEACHING' && s.active && s.jpNo === jpNo,
    );
    if (!targetSlot) {
      notify(`Slot ${day} JP ${jpNo} bukan slot KBM aktif yang valid. Perubahan dibatalkan.`, 'error');
      setEditingSlot(null);
      return;
    }

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
      const teacher: Teacher = {
        id: `TCH-${Date.now().toString(36)}`,
        code: masterForm.code.trim() || `T-${workspace.teachers.length + 1}`,
        name: masterForm.name.trim(),
        roleTitle: masterForm.roleTitle.trim() || 'Guru Mapel',
        nip: masterForm.nip.trim() || undefined,
        subjectIds: masterForm.selectedSubjectIds,
        maxWeeklyJP: Math.max(1, Number(masterForm.maxWeeklyJP) || 24),
        isActive: true,
      };
      updateWorkspace((current) => ({ ...current, teachers: [...current.teachers, teacher] }), true);
      notify(`Guru ${teacher.name} (${teacher.roleTitle}) ditambahkan.`);
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
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sakala-brand" onClick={() => navigate('overview')} title="SIGNAL — The Grand Academic Atelier">
          <div className="v3-brandmark">S</div>
          {!sidebarCollapsed && (
            <div>
              <h2 className="sakala-brand-title">SIGNAL</h2>
              <span className="sakala-brand-subtitle">THE GRAND ACADEMIC ATELIER</span>
            </div>
          )}
          <button
            type="button"
            className="round-btn sidebar-toggle-btn"
            aria-label={sidebarCollapsed ? 'Perluas menu' : 'Perkecil menu'}
            onClick={(e) => { e.stopPropagation(); setSidebarCollapsed(!sidebarCollapsed); }}
            title={sidebarCollapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
            style={{ width: '22px', height: '22px', position: 'absolute', right: '0', top: '0', background: 'transparent', border: 'none', color: '#b5c9bd', display: 'grid', placeItems: 'center' }}
          >
            {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} />}
          </button>
        </div>

        <nav className="sakala-nav" aria-label="Navigasi alur kerja">
          {navGroups.map((group) => (
            <div key={group.sectionTitle} className="sakala-nav-group">
              {!sidebarCollapsed && (
                <div className="sakala-nav-section-title">{group.sectionTitle}</div>
              )}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`sakala-nav-item ${screen === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                  aria-current={screen === item.id ? 'page' : undefined}
                  title={item.label}
                >
                  <item.icon className="icon" strokeWidth={screen === item.id ? 2.2 : 1.8} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                  {item.id === 'validation' && report && report.hardErrorCount > 0 && (
                    <span className="sakala-nav-badge">{report.hardErrorCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="side-foot">
            <b>THE GRAND ACADEMIC ATELIER</b>
            <span>Local workspace · TP {workspace.settings.academicYear}</span>
          </div>
        )}
      </aside>

      <main className={`main-shell ${sidebarCollapsed ? "main-shell-expanded" : ""}`}>
        <header className="sakala-topbar">
          <div className="sakala-header-greeting">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="icon-button mobile-menu-trigger" aria-label="Buka menu" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>SIGNAL</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 800 }}>/</span>
                  <b style={{ color: 'var(--ink)' }}>{currentTitle}</b>
                </div>
                <h1 style={{ marginTop: '1px' }}>{screen === 'overview' ? 'Selamat Datang, Operator' : currentTitle}</h1>
              </div>
            </div>
            <p>{screen === 'overview' ? 'Ringkasan status jadwal, kepatuhan alokasi, dan alur operasional madrasah' : `Ruang kerja operasional SIGNAL · ${workspace.settings.schoolName}`}</p>
          </div>

          <div className="sakala-header-controls">
            <div className="sakala-context-badge" title="Tahun Ajaran & Semester Aktif">
              <CalendarDays size={14} />
              <span>TP {workspace.settings.academicYear} · Sem. {workspace.settings.semester}</span>
            </div>
            <div className="sakala-header-divider" />
            <button
              className="sakala-bell-btn"
              aria-label="Pemeriksaan Validasi"
              onClick={() => setQuickValidationOpen(true)}
              title={report?.hardErrorCount ? `Ada ${report.hardErrorCount} masalah perlu ditinjau` : 'Jadwal 100% Bebas Bentrok'}
            >
              <Bell size={16} />
              {report && report.hardErrorCount > 0 && (
                <span className="sakala-bell-badge">{report.hardErrorCount}</span>
              )}
            </button>
            <div
              className="sakala-avatar-circle"
              onClick={() => navigate('settings')}
              title="Profil Administrator"
            >
              OP
            </div>
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
      {editingSlot && (() => {
        const slotKbmDef = workspace.slots.find(
          (s) => s.day === editingSlot.day && s.kind === 'TEACHING' && s.active && s.jpNo === editingSlot.jpNo
        );
        const activeSched = workspace.draft ?? workspace.activeSchedule ?? [];
        const teacherConflict = editingTeacher && editingTeacher !== '__NEW_CUSTOM__'
          ? activeSched.find(
              (e: ScheduleEntry) => e.day === editingSlot.day && e.jpNo === editingSlot.jpNo && e.teacherId === editingTeacher && e.classId !== editingSlot.classId
            )
          : null;
        const conflictClass = teacherConflict ? getClass(workspace, teacherConflict.classId) : null;

        return (
        <Modal
          title="Penempatan Pelajaran Jam KBM"
          subtitle={`Kelas ${getClass(workspace, editingSlot.classId)?.name ?? ''} · ${editingSlot.day} · JP ke-${editingSlot.jpNo}`}
          onClose={() => setEditingSlot(null)}
          icon={CalendarDays}
        >
          <div style={{ padding: '14px 20px 0 20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#edf6f2',
                borderRadius: '10px',
                border: '1.5px solid #c2ded0',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#16483f" />
                <div>
                  <strong style={{ color: '#103f3e', fontSize: '13px', display: 'block' }}>
                    Alokasi Jam KBM: {slotKbmDef ? `${slotKbmDef.start} – ${slotKbmDef.end} WIB` : `JP ${editingSlot.jpNo}`}
                  </strong>
                  <span style={{ color: '#4a6b62', fontSize: '11px' }}>
                    Hari {editingSlot.day} · JP ke-{editingSlot.jpNo} (Durasi {workspace.settings.periodMinutes || 40} menit/JP)
                  </span>
                </div>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#1f6952',
                  background: '#d4eedf',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.04em',
                }}
              >
                ✓ JAM KBM AKTIF
              </span>
            </div>

            {teacherConflict && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  background: '#fdf2f0',
                  border: '1px solid #f9ccc6',
                  borderRadius: '8px',
                  color: '#a03c30',
                  fontSize: '11.5px',
                  marginTop: '10px',
                }}
              >
                <AlertTriangle size={15} color="#b24c3d" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Peringatan Bentrok:</strong> Guru ini sudah terjadwal mengajar di <strong>Kelas {conflictClass?.name || 'Lain'}</strong> pada Jam KBM yang sama ({editingSlot.day}, JP {editingSlot.jpNo} {slotKbmDef ? `· ${slotKbmDef.start}–${slotKbmDef.end}` : ''}).
                </span>
              </div>
            )}
          </div>
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
        );
      })()}

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

function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  onClick,
  disabled,
  type = 'button',
  className = '',
  title,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'hero-ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
}) {
  const sizeClass = size === 'sm' ? 'button-sm' : size === 'lg' ? 'button-lg' : '';
  const iconSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      className={`button button-${variant} ${sizeClass} ${className}`.trim()}
      onClick={onClick}
    >
      {Icon && <Icon size={iconSize} className="btn-icon" />}
      <span className="btn-label">{children}</span>
    </button>
  );
}

function Card({ children, className = '', title, eyebrow, action }: { children: ReactNode; className?: string; title?: string; eyebrow?: string; action?: ReactNode }) {
  return <section className={`surface-card ${className}`}>{(title || eyebrow || action) && <div className="card-heading"><div>{eyebrow && <div className="card-eyebrow">{eyebrow}</div>}{title && <h3>{title}</h3>}</div>{action}</div>}{children}</section>;
}

function StatusPill({
  status,
  children,
  icon: CustomIcon,
  className = '',
}: {
  status: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = CustomIcon || (
    status === 'success' ? CheckCircle2 :
    status === 'warning' ? AlertTriangle :
    status === 'danger' ? XCircle :
    status === 'info' ? Info :
    Activity
  );
  return (
    <span className={`status-pill status-${status} ${className}`.trim()} role="status">
      <Icon size={12} className="status-pill-icon" aria-hidden="true" />
      <span className="status-pill-text">{children}</span>
    </span>
  );
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

function TablePagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : pageSize === 0 ? 1 : (page - 1) * pageSize + 1;
  const to = pageSize === 0 ? totalItems : Math.min(page * pageSize, totalItems);

  return (
    <div className="table-pagination">
      <div className="pagination-left">
        <span>Menampilkan <strong>{from}–{to}</strong> dari <strong>{totalItems}</strong> baris</span>
        <div className="pagination-size-select">
          <span>Baris:</span>
          <select
            className="page-select"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={0}>Semua</option>
          </select>
        </div>
      </div>
      <div className="pagination-right">
        <button
          className="page-btn"
          disabled={page <= 1 || pageSize === 0}
          onClick={() => onPageChange(page - 1)}
          title="Halaman sebelumnya"
        >
          ‹
        </button>
        <span style={{ fontSize: '11.5px', fontWeight: 600, padding: '0 6px' }}>
          Hal {page} / {totalPages}
        </span>
        <button
          className="page-btn"
          disabled={page >= totalPages || pageSize === 0}
          onClick={() => onPageChange(page + 1)}
          title="Halaman berikutnya"
        >
          ›
        </button>
      </div>
    </div>
  );
}

/**
 * SECTION B: BERANDA RINGKAS (OPERATOR CENTER)
 * SAKALA V2 Modern / SIGNAL Warm Ivory & Mocha Architectural Aesthetic
 */
function OperatorOverviewScreen({
  state,
  report,
  masterIssues,
  readiness: _readiness,
  occupiedSlots,
  totalWeeklyCapacity,
  onNavigate,
  onGenerate,
  isGenerating,
  onOpenPdfModal: _onOpenPdfModal,
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
  const activeClasses = state.classes.filter((c) => c.isActive);
  const activeTeachers = state.teachers.filter((t) => t.isActive);
  const classCount = activeClasses.length;
  const teacherCount = activeTeachers.length;
  const totalErrors = masterIssues.filter((i) => i.severity === 'error').length + report.hardErrorCount;
  const capacityPercent = totalWeeklyCapacity > 0 ? Math.round((occupiedSlots / totalWeeklyCapacity) * 100) : 46;

  const classRows = activeClasses.slice(0, 6);

  return (
    <div className="overview-page-wrapper">
      {/* 1. PLATE 01: GRAND ATELIER OPERATIONAL HERO */}
      <section className="hero">
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div className="kicker">
            STATUS JADWAL · SEMESTER {state.settings.semester.toUpperCase()} {state.settings.academicYear}
          </div>
          <h3>
            {report.valid
              ? 'Jadwal Siap Diperiksa & Diterbitkan'
              : totalErrors > 0
              ? `Terdapat ${totalErrors} Bentrok Jadwal Perlu Diperbaiki`
              : 'Lengkapi Alokasi Kebutuhan JP & Susun Jadwal'}
          </h3>
          <p>
            {report.valid
              ? `Seluruh aturan wajib KBM terpenuhi (${occupiedSlots} JP teralokasi, 0 bentrok guru). Anda dapat langsung memeriksa matriks atau mencetak jadwal resmi madrasah.`
              : totalErrors > 0
              ? `Ditemukan pelanggaran jam mengajar guru atau bentrok ruang kelas. Selesaikan konflik sebelum menerbitkan jadwal resmi.`
              : `Tentukan jam mengajar guru per kelas di menu Kebutuhan JP, kemudian jalankan penyusunan otomatis.`}
          </p>
          <div className="actions" style={{ marginTop: '14px' }}>
            {totalErrors > 0 ? (
              <>
                <button type="button" className="btn gold" onClick={() => onNavigate('validation')}>
                  Periksa Sekarang &rarr;
                </button>
                <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} onClick={onGenerate} disabled={isGenerating}>
                  {isGenerating ? 'Menyusun…' : '✦ Generate Ulang'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn gold" onClick={() => onNavigate('schedule')}>
                  Buka Matriks Jadwal &rarr;
                </button>
                <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} onClick={() => onNavigate('schedule')}>
                  Cetak Dokumen PDF
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. PLATE 01: 4-KPI JEWEL METRIC STRIP */}
      <div className="stats">
        <div className="stat" onClick={() => onNavigate('master')} style={{ cursor: 'pointer', '--accent': '#B39A68' } as React.CSSProperties}>
          <div className="label">ROMBEL AKTIF</div>
          <div className="value">{classCount}</div>
          <div className="foot">Seluruh kelas terdata</div>
        </div>

        <div className="stat" onClick={() => onNavigate('schedule')} style={{ cursor: 'pointer', '--accent': '#2D8066' } as React.CSSProperties}>
          <div className="label">ALOKASI KBM</div>
          <div className="value">{capacityPercent}%</div>
          <div className="foot">{occupiedSlots} / {totalWeeklyCapacity} JP dari kebutuhan</div>
        </div>

        <div className="stat" onClick={() => onOpenValidationModal()} style={{ cursor: 'pointer', '--accent': '#334F70' } as React.CSSProperties}>
          <div className="label">KONFLIK KERAS</div>
          <div className="value" style={{ color: totalErrors > 0 ? 'var(--red)' : 'var(--ink)' }}>
            {totalErrors === 0 ? '0' : totalErrors}
          </div>
          <div className="foot">{totalErrors === 0 ? 'Tidak ada bentrok' : 'Perlu tindakan segera'}</div>
        </div>

        <div className="stat" onClick={() => onNavigate('workload')} style={{ cursor: 'pointer', '--accent': '#927D98' } as React.CSSProperties}>
          <div className="label">GURU TERJADWAL</div>
          <div className="value">{teacherCount}</div>
          <div className="foot">Beban dihitung aktual</div>
        </div>
      </div>

      {/* 3. PLATE 01: SPLIT WORKSPACE SECTION */}
      <div className="split">
        {/* Left: Status per Rombel Panel */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Status per Rombel</div>
              <div className="muted">{classCount} kelas aktif terdata</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button variant="secondary" size="sm" icon={BookOpen} onClick={() => onNavigate('requirements')}>
                Kelola Kebutuhan JP
              </Button>
              <Button variant="secondary" size="sm" icon={CalendarDays} onClick={() => onNavigate('schedule')}>
                Lihat Jadwal
              </Button>
            </div>
          </div>

          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: '38px' }}>#</th>
                  <th>KELAS</th>
                  <th>TERISI</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {classRows.map((cls, idx) => {
                  const reqs = state.requirements.filter((r) => r.classId === cls.id);
                  const totalReq = reqs.reduce((sum, r) => sum + r.requiredJP, 0);
                  const classEntries = (state.draft ?? state.activeSchedule ?? []).filter((e) => e.classId === cls.id);
                  const isComplete = totalReq > 0 && classEntries.length >= totalReq;
                  return (
                    <tr key={cls.id}>
                      <td style={{ color: 'var(--muted)', fontWeight: 700 }}>0{idx + 1}</td>
                      <td>
                        <strong style={{ color: 'var(--ink)' }}>Kelas {cls.name}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Tingkat {cls.level}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {classEntries.length} / {totalReq || '—'} JP
                        </span>
                      </td>
                      <td>
                        {isComplete ? (
                          <span className="tag good">Lengkap</span>
                        ) : totalReq === 0 ? (
                          <span className="tag warn">Belum Ada Kebutuhan</span>
                        ) : (
                          <span className="tag warn">Perlu Cek</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="button-quiet"
                          style={{ height: '28px', padding: '0 8px', fontSize: '11.5px' }}
                          onClick={() => onNavigate('schedule')}
                        >
                          Buka Jadwal &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Langkah Berikutnya (Dark Panel - Plate 01) */}
        <div className="panel dark">
          <div className="panel-head">
            <div className="panel-title" style={{ color: '#fff' }}>Langkah Berikutnya</div>
            <span className="badge-num">02</span>
          </div>

          <div className="mini-list" style={{ marginTop: '10px' }}>
            <div className="listitem" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', color: '#fff' }}>
              <span className="bullet" style={{ background: 'var(--emerald)' }}></span>
              <div style={{ flex: 1 }}>
                <b style={{ color: '#fff' }}>Lengkapi alokasi</b>
                <small style={{ color: '#a8beb2' }}>
                  {state.classes.filter(c => c.isActive && !state.requirements.some(r => r.classId === c.id)).length > 0
                    ? `${state.classes.filter(c => c.isActive && !state.requirements.some(r => r.classId === c.id)).length} rombel belum teralokasi`
                    : 'Target alokasi KBM tercatat'}
                </small>
              </div>
            </div>

            <div className="listitem" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', color: '#fff' }}>
              <span className="bullet" style={{ background: 'var(--gold)' }}></span>
              <div style={{ flex: 1 }}>
                <b style={{ color: '#fff' }}>Periksa validasi</b>
                <small style={{ color: '#a8beb2' }}>
                  {totalErrors === 0 ? 'Semua aturan wajib terpenuhi' : `${totalErrors} catatan perlu diperiksa`}
                </small>
              </div>
            </div>

            <div className="listitem" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', color: '#fff' }}>
              <span className="bullet" style={{ background: 'var(--jade)' }}></span>
              <div style={{ flex: 1 }}>
                <b style={{ color: '#fff' }}>Terbitkan jadwal</b>
                <small style={{ color: '#a8beb2' }}>Setelah pemeriksaan selesai &amp; ekspor PDF</small>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="btn gold"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onNavigate('generator')}
            >
              Buka Generator &rarr;
            </button>
            <button
              type="button"
              className="btn"
              style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
              onClick={() => onNavigate('validation')}
            >
              Tinjau Validasi &amp; Konflik
            </button>
          </div>
        </div>
      </div>
    </div>
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

  // View mode switcher: 'all' (Matriks Seluruh Kelas) vs 'single' (Editor Per-Kelas)
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  const [filterTeacherId, setFilterTeacherId] = useState<string>('');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [colorizeCells, setColorizeCells] = useState<boolean>(true);
  const [compactLabels, setCompactLabels] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterRombelRow, setFilterRombelRow] = useState<string>('all');

  const hasEntries = !!(state.draft?.length || state.activeSchedule?.length);
  const activeDays = state.settings.activeDays;
  const timelineRows = useMemo(
    () => getTimelineRows(state.slots, state.settings.teachingPeriodsPerDay),
    [state.slots, state.settings.teachingPeriodsPerDay],
  );
  const published = !state.draft && !!state.activeSchedule?.length;
  const activeClasses = useMemo(() => state.classes.filter((c) => c.isActive), [state.classes]);
  const activeTeachers = useMemo(() => state.teachers.filter((t) => t.isActive), [state.teachers]);

  const scheduleEntries = state.draft ?? state.activeSchedule ?? [];
  const periodMinutes = state.settings.periodMinutes ?? 40;
  const totalAllocatedJp = scheduleEntries.length;
  const totalAstroHours = ((totalAllocatedJp * periodMinutes) / 60).toFixed(1);
  const targetRequiredJp = state.requirements.reduce((sum, r) => sum + r.requiredJP, 0);

  // Group classes by section into rows (Baris 1 - Kelompok A: VII-A, VIII-A, IX-A; Baris 2 - Kelompok B: VII-B, VIII-B, IX-B)
  const rombelRows = useMemo(() => groupClassesForMasterMatrix(activeClasses), [activeClasses]);
  const uniqueLevels = useMemo(
    () => Array.from(new Set(activeClasses.map((c) => c.level).filter(Boolean))).sort(),
    [activeClasses],
  );
  const visibleRombelRows = useMemo(() => {
    return rombelRows
      .filter((row) => filterRombelRow === 'all' || row.sectionKey === filterRombelRow)
      .map((row) => ({
        ...row,
        classes: row.classes.filter((cls) => filterLevel === 'all' || cls.level === filterLevel),
      }))
      .filter((row) => row.classes.length > 0);
  }, [rombelRows, filterRombelRow, filterLevel]);

  return (
    <>
      <PageHeading
        kicker="SCHEDULE WORKSPACE"
        title="Jadwal Pelajaran"
        description="Tinjau matriks jadwal seluruh madrasah sekaligus atau kelola detail alokasi per kelas dengan validator deterministik."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {lastMove && (
              <Button variant="secondary" icon={Undo2} onClick={onUndoMove} title="Batalkan perpindahan terakhir">
                Urungkan
              </Button>
            )}
            <Button variant="secondary" icon={Download} onClick={onOpenPdfModal}>
              Ekspor PDF
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

      {/* Main Mode Switcher & Global Toolbar */}
      <div className="toolbar-card" style={{ flexWrap: 'wrap', gap: '12px' }}>
        {/* View Switcher Segmented Control */}
        <div className="schedule-view-switcher">
          <button
            type="button"
            className={`view-switch-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
            title="Tampilan matriks terpadu semua kelas dalam satu layar"
          >
            <LayoutGrid size={15} />
            <span>Matriks Seluruh Kelas</span>
          </button>
          <button
            type="button"
            className={`view-switch-btn ${viewMode === 'single' ? 'active' : ''}`}
            onClick={() => setViewMode('single')}
            title="Tampilan detail per kelas dengan drag-and-drop"
          >
            <GraduationCap size={15} />
            <span>Editor Per-Kelas</span>
          </button>
        </div>

        {viewMode === 'single' && (
          <>
            <div className="toolbar-divider" />
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
                  {activeClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      Kelas {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
          </>
        )}

        <div className="toolbar-divider" />

        <div className="schedule-status">
          <span className="toolbar-label">STATUS JADWAL</span>
          {state.draft ? (
            <StatusPill status={report.valid ? 'success' : 'warning'}>
              {report.valid ? 'Draft Valid' : `${report.hardErrorCount} Bentrok Perlu Diperbaiki`}
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

      {/* ========================================================================= */}
      {/* MODE 1: MATRIKS SELURUH KELAS TERPADU (MASTER TIMETABLE VIEW)             */}
      {/* ========================================================================= */}
      {viewMode === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Master Timetable Toolbar with Filtering, Zoom, & View Controls */}
          <div className="matrix-controls-bar">
            {/* Filter controls */}
            <div className="matrix-filter-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Filter size={13} style={{ color: '#52776d' }} />
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#31544d', letterSpacing: '0.04em' }}>
                  FILTER:
                </span>
              </div>

              {/* Tingkat filter */}
              <select
                className="master-filter-select"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                title="Saring berdasarkan tingkatan kelas"
              >
                <option value="all">Semua Tingkat ({uniqueLevels.join(', ') || 'Semua'})</option>
                {uniqueLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Tingkat {lvl}
                  </option>
                ))}
              </select>

              {/* Kelompok Rombel filter */}
              <select
                className="master-filter-select"
                value={filterRombelRow}
                onChange={(e) => setFilterRombelRow(e.target.value)}
                title="Saring kelompok rombel paralel"
              >
                <option value="all">Semua Kelompok ({rombelRows.length} Baris)</option>
                {rombelRows.map((r) => (
                  <option key={r.sectionKey} value={r.sectionKey}>
                    {r.label}
                  </option>
                ))}
              </select>

              {/* Teacher filter */}
              <select
                className="master-filter-select"
                value={filterTeacherId}
                onChange={(e) => setFilterTeacherId(e.target.value)}
                title="Sorot guru pada seluruh blok kelas"
              >
                <option value="">Sorot Semua Guru</option>
                {activeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>

              {/* Subject filter */}
              <select
                className="master-filter-select"
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                title="Sorot mata pelajaran pada seluruh blok kelas"
              >
                <option value="">Sorot Semua Mapel</option>
                {state.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>

              {(filterLevel !== 'all' || filterRombelRow !== 'all' || filterTeacherId || filterSubjectId) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterLevel('all');
                    setFilterRombelRow('all');
                    setFilterTeacherId('');
                    setFilterSubjectId('');
                  }}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#b24c3d',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Reset Filter
                </button>
              )}
            </div>

            {/* Display Toggles, Zoom, and PDF Export */}
            <div className="matrix-action-group">
              <label className="master-toggle-label">
                <input
                  type="checkbox"
                  checked={colorizeCells}
                  onChange={(e) => setColorizeCells(e.target.checked)}
                />
                <span>Warna Mapel</span>
              </label>
              <label className="master-toggle-label">
                <input
                  type="checkbox"
                  checked={compactLabels}
                  onChange={(e) => setCompactLabels(e.target.checked)}
                />
                <span>Singkat Nama</span>
              </label>

              {/* Interactive Zoom Controls */}
              <div className="matrix-zoom-controls">
                <button
                  type="button"
                  className="matrix-zoom-btn"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                  title="Perkecil tampilan matriks (-10%)"
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  type="button"
                  className="matrix-zoom-btn zoom-text"
                  onClick={() => setZoomLevel(100)}
                  title="Klik untuk reset zoom (100%)"
                >
                  {zoomLevel}%
                </button>
                <button
                  type="button"
                  className="matrix-zoom-btn"
                  onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                  title="Perbesar tampilan matriks (+10%)"
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  type="button"
                  className="matrix-zoom-btn"
                  onClick={() => setZoomLevel(100)}
                  title="Kembalikan zoom ke 100%"
                >
                  <RotateCcw size={12} />
                </button>
              </div>

              {/* Timetable Live Status Pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', background: '#eef6f3', borderRadius: '8px', fontSize: '11.5px', color: '#16483f', fontWeight: 700 }}>
                <span>{activeClasses.length} Rombel</span>
                <span style={{ opacity: 0.35 }}>•</span>
                <span>{totalAllocatedJp} / {targetRequiredJp > 0 ? targetRequiredJp : totalAllocatedJp} JP ({totalAstroHours} Jam)</span>
                <span style={{ opacity: 0.35 }}>•</span>
                <span style={{ color: report.valid ? '#166534' : '#991b1b' }}>
                  {report.valid ? 'Bebas Bentrok' : `${report.hardErrorCount} Konflik`}
                </span>
              </div>
            </div>
          </div>

          {/* Master Timetable Multi-Row Horizontal Track Workspace */}
          <div
            className="master-matrix-workspace"
            style={{
              transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
              transformOrigin: 'top left',
              width: zoomLevel !== 100 ? `${(100 / (zoomLevel / 100)).toFixed(2)}%` : '100%',
            }}
          >
            {visibleRombelRows.length === 0 ? (
              <div className="surface-card" style={{ padding: '36px', textAlign: 'center', color: '#687a75' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                  Tidak ada kelas yang sesuai dengan filter yang dipilih.
                </p>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ marginTop: '12px' }}
                  onClick={() => {
                    setFilterLevel('all');
                    setFilterRombelRow('all');
                  }}
                >
                  Tampilkan Semua Kelas
                </button>
              </div>
            ) : (
              visibleRombelRows.map((row) => (
                <div key={row.rowId} className="master-matrix-row-container">
                  {/* Row Header: Kelompok A, B, etc. */}
                  <div className="master-matrix-row-header">
                    <div className="row-title-area">
                      <span className="row-badge">PARALEL</span>
                      <h3 className="row-title">{row.label}</h3>
                      <span className="row-count">
                        ({row.classes.length} Kelas Berdampingan:{' '}
                        {row.classes.map((c) => c.name).join(' | ')})
                      </span>
                    </div>
                    <div className="row-legend-hint">
                      Senin &ndash; {activeDays[activeDays.length - 1]} &bull; Disusun horizontal per tingkat
                    </div>
                  </div>

                  {/* Horizontal Track of Complete Weekly Class Blocks */}
                  <div className="master-matrix-horizontal-track">
                    {row.classes.map((cls) => {
                      const classEntries = scheduleEntries.filter((e) => e.classId === cls.id);
                      const classReqJp = state.requirements
                        .filter((r) => r.classId === cls.id)
                        .reduce((sum, r) => sum + r.requiredJP, 0);

                      return (
                        <div key={cls.id} className="master-class-weekly-block">
                          {/* Class Block Header */}
                          <div className="master-class-block-header">
                            <div className="class-identity">
                              <h4 className="class-name">Kelas {cls.name}</h4>
                              <span className="class-level-tag">Tingkat {cls.level}</span>
                            </div>
                            <div className="class-stats">
                              <span className="jp-counter">
                                {classEntries.length} / {classReqJp > 0 ? classReqJp : classEntries.length} JP
                              </span>
                              <button
                                type="button"
                                className="editor-shortcut-btn"
                                onClick={() => {
                                  onSelectClass(cls.id);
                                  setViewMode('single');
                                }}
                                title={`Buka Kelas ${cls.name} di Editor Per-Kelas`}
                              >
                                <Edit2 size={11} /> Editor
                              </button>
                            </div>
                          </div>

                          {/* Complete Weekly Schedule Table for this Class */}
                          <table className="master-class-weekly-table">
                            <thead>
                              <tr>
                                <th className="col-time-th">JP / WAKTU</th>
                                {activeDays.map((day) => (
                                  <th key={day}>{day}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {timelineRows.map((tRow) => {
                                const timeStr = `${tRow.start}-${tRow.end}`;
                                if (!tRow.isKbm) {
                                  return (
                                    <tr key={`agenda-${tRow.order}`}>
                                      <th className="jp-row-header" style={{ background: '#eef5f1' }}>
                                        <strong style={{ color: '#103f3e', fontSize: '9.5px' }}>{tRow.defaultLabel}</strong>
                                        <small style={{ color: '#2d6b5e' }}>{timeStr}</small>
                                      </th>
                                      {activeDays.map((day) => {
                                        const slotDef = state.slots.find(
                                          (s) => s.day === day && s.order === tRow.order,
                                        );
                                        const actType = (slotDef?.activityType || tRow.activityType || '').toLowerCase();
                                        const actClass = actType.includes('upacara')
                                          ? 'upacara'
                                          : actType.includes('religi') || actType.includes('sholat')
                                          ? 'religi'
                                          : actType.includes('istirahat')
                                          ? 'istirahat'
                                          : 'lainnya';
                                        const label = slotDef?.activityName || slotDef?.label || tRow.defaultLabel;
                                        return (
                                          <td key={day}>
                                            <div
                                              className={`master-non-kbm-slot ${actClass}`}
                                              title={`${label} (${day}, ${timeStr} WIB): Non-KBM / Terkunci`}
                                            >
                                              <LockKeyhole size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: -1 }} />
                                              {label}
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                }

                                const jpNo = tRow.jpNo!;
                                return (
                                  <tr key={jpNo}>
                                    <th className="jp-row-header">
                                      <strong>JP {String(jpNo).padStart(2, '0')}</strong>
                                      <small>{timeStr}</small>
                                    </th>

                                    {activeDays.map((day) => {
                                      const slotDef = state.slots.find(
                                        (s) => s.day === day && s.kind === 'TEACHING' && s.jpNo === jpNo,
                                      );
                                      const blocked = isSlotBlocked(slotDef);
                                      const isOver =
                                        dragOverTarget?.day === day &&
                                        dragOverTarget?.jpNo === jpNo &&
                                        draggedSlot?.classId === cls.id;

                                      if (blocked) {
                                        const isOutOfKbm = !slotDef;
                                        const actType = (slotDef?.activityType || '').toLowerCase();
                                        const actClass = actType.includes('upacara')
                                          ? 'upacara'
                                          : actType.includes('religi') || actType.includes('sholat')
                                          ? 'religi'
                                          : actType.includes('istirahat')
                                          ? 'istirahat'
                                          : 'lainnya';

                                        return (
                                          <td key={day}>
                                            <div
                                              className={`master-non-kbm-slot ${actClass}`}
                                              style={isOutOfKbm ? { background: '#f5f7f6', color: '#889e96', border: '1px dashed #d0dcd6' } : undefined}
                                              title={isOutOfKbm ? `Di Luar Jam KBM (${day}, JP ${jpNo})` : `${slotDef?.activityName || slotDef?.activityType} (${day}, ${slotDef?.start}-${slotDef?.end} WIB)`}
                                            >
                                              {isOutOfKbm ? 'Selesai KBM' : (slotDef?.activityName || slotDef?.activityType || 'NON-KBM')}
                                            </div>
                                          </td>
                                        );
                                      }

                                      const entry = getEntry(state, cls.id, day, jpNo);

                                      if (!entry) {
                                        return (
                                          <td
                                            key={day}
                                            onDragOver={(e) => {
                                              if (draggedSlot?.classId === cls.id) {
                                                e.preventDefault();
                                                setDragOverTarget({ day, jpNo });
                                              }
                                            }}
                                            onDragLeave={() => {
                                              if (dragOverTarget?.day === day && dragOverTarget?.jpNo === jpNo) {
                                                setDragOverTarget(null);
                                              }
                                            }}
                                            onDrop={(e) => {
                                              e.preventDefault();
                                              setDragOverTarget(null);
                                              if (draggedSlot && draggedSlot.classId === cls.id) {
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
                                              type="button"
                                              className="master-empty-slot"
                                              onClick={() => onEditSlot(cls.id, day, jpNo)}
                                              title={`Klik untuk mengisi jadwal Kelas ${cls.name} pada ${day}, JP ${jpNo}`}
                                            >
                                              <span>+ Isi</span>
                                            </button>
                                          </td>
                                        );
                                      }

                                      const subject = getSubject(state, entry.subjectId);
                                      const teacher = getTeacher(state, entry.teacherId);

                                      const isHighlighted =
                                        (filterTeacherId && entry.teacherId === filterTeacherId) ||
                                        (filterSubjectId && entry.subjectId === filterSubjectId);

                                      let cellBg = '#f5f9f6';
                                      let cellBorder = '#d7e2da';
                                      let cellText = '#173637';

                                      if (colorizeCells && subject?.color) {
                                        const { bg, text } = getPrintableCellColor(subject.color);
                                        cellBg = `rgb(${bg.join(',')})`;
                                        cellBorder = `rgb(${text.map((v) => Math.min(220, v + 80)).join(',')})`;
                                        cellText = `rgb(${text.join(',')})`;
                                      }

                                      const subjLabel = compactLabels
                                        ? compactSubjectName(subject?.name || '', subject?.code)
                                        : subject?.name || 'Mapel';

                                      const teacherLabel = compactLabels
                                        ? compactTeacherName(teacher?.name || '', teacher?.code)
                                        : teacher?.name || '—';

                                      return (
                                        <td
                                          key={day}
                                          onDragOver={(e) => {
                                            if (draggedSlot?.classId === cls.id) {
                                              e.preventDefault();
                                              setDragOverTarget({ day, jpNo });
                                            }
                                          }}
                                          onDragLeave={() => {
                                            if (dragOverTarget?.day === day && dragOverTarget?.jpNo === jpNo) {
                                              setDragOverTarget(null);
                                            }
                                          }}
                                          onDrop={(e) => {
                                            e.preventDefault();
                                            setDragOverTarget(null);
                                            if (draggedSlot && draggedSlot.classId === cls.id) {
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
                                            type="button"
                                            draggable={true}
                                            onDragStart={() => {
                                              setDraggedSlot({ classId: cls.id, day, jpNo });
                                            }}
                                            className={`master-slot-btn ${isHighlighted ? 'is-highlighted' : ''}`}
                                            onClick={() => onEditSlot(cls.id, day, jpNo)}
                                            style={{
                                              background: cellBg,
                                              borderColor: isHighlighted ? '#bc945e' : cellBorder,
                                              color: cellText,
                                            }}
                                            title={`${subject?.name || 'Mapel'} (${teacher?.name || 'Guru'})\nKelas ${cls.name} · ${day}, JP ${jpNo} (${timeStr})\nKlik untuk mengedit atau drag untuk memindahkan alokasi`}
                                          >
                                            <div className="master-slot-subject">{subjLabel}</div>
                                            <div className="master-slot-teacher">{teacherLabel}</div>
                                          </button>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Master View Legend */}
          <div className="schedule-legend-row" style={{ marginTop: '8px' }}>
            <span>
              <i className="legend-dot dot-teal" /> Sel KBM Berwarna (Klik untuk edit, drag &amp; drop untuk menukar slot)
            </span>
            <span>
              <i className="legend-dot dot-ivory" /> Sel Kosong (+ Isi KBM)
            </span>
            <span>
              <span
                style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  background: '#fef8e7',
                  border: '1px dashed #e6c884',
                  borderRadius: '3px',
                  verticalAlign: 'middle',
                  marginRight: '5px',
                }}
              />
              Non-KBM (Istirahat, Upacara, Sholat)
            </span>
            <span style={{ color: '#bc945e', fontWeight: 700 }}>
              💡 Setiap kelas menampilkan jadwal mingguan utuh Senin&ndash;Sabtu. Disusun paralel per kelompok rombel.
            </span>
            <span className="legend-spacer" />
            <button className="text-link" onClick={onOpenValidationModal}>
              Laporan Konflik &amp; Validasi Lengkap <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: EDITOR DETAIL PER-KELAS (DRAG & DROP ANTAR-SLOT)                  */}
      {/* ========================================================================= */}
      {viewMode === 'single' && (
        <>
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
                  <span>Kepatuhan JP</span>
                  {(() => {
                    const filled = (state.draft ?? state.activeSchedule ?? []).filter((e) => e.classId === selectedClass).length;
                    const target = state.requirements.filter((item) => item.classId === selectedClass).reduce((sum, item) => sum + item.requiredJP, 0);
                    const diff = filled - target;
                    return (
                      <strong style={{ color: diff === 0 ? '#1f6952' : '#b24c3d' }}>
                        {diff === 0 ? '100% Pas' : diff > 0 ? `+${diff} JP` : `${diff} JP`}
                      </strong>
                    );
                  })()}
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
                    {timelineRows.map((tRow) => {
                      if (!tRow.isKbm) {
                        return (
                          <tr key={`agenda-${tRow.order}`}>
                            <th
                              className="period-heading non-kbm-heading"
                              title={`Non-KBM: ${tRow.defaultLabel} (${tRow.start} – ${tRow.end} WIB)`}
                              style={{ background: '#edf4f0', borderRight: '2px solid #b8d5c8' }}
                            >
                              <span style={{ fontSize: '0.62rem', padding: '2px 5px', background: '#d5e9df', color: '#103f3e', borderRadius: '4px', fontWeight: 800 }}>NON-KBM</span>
                              <small style={{ fontWeight: 700, color: '#1b564b', marginTop: '2px' }}>
                                {tRow.start} – {tRow.end}
                              </small>
                            </th>
                            {activeDays.map((day) => {
                              const slotDef = state.slots.find((s) => s.day === day && s.order === tRow.order);
                              const actType = (slotDef?.activityType || tRow.activityType || '').toUpperCase();
                              const label = slotDef?.activityName || slotDef?.label || tRow.defaultLabel;
                              const isUpacara = actType === 'UPACARA';
                              const isReligi = actType === 'RELIGI';

                              return (
                                <td key={`${day}-${tRow.order}`} className="non-kbm-cell-wrap" style={{ background: '#f8faf9', padding: '5px' }}>
                                  <div
                                    className={`non-kbm-card ${isUpacara ? 'is-upacara' : isReligi ? 'is-religi' : 'is-istirahat'}`}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      minHeight: '82px',
                                      height: '100%',
                                      borderRadius: '8px',
                                      padding: '8px 6px',
                                      textAlign: 'center',
                                      userSelect: 'none',
                                      cursor: 'not-allowed',
                                      background: isUpacara
                                        ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                                        : isReligi
                                        ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                                        : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                      border: isUpacara
                                        ? '1px solid #fde68a'
                                        : isReligi
                                        ? '1px solid #bbf7d0'
                                        : '1px solid #e2e8f0',
                                      color: isUpacara
                                        ? '#92400e'
                                        : isReligi
                                        ? '#166534'
                                        : '#475569',
                                    }}
                                    title={`${label} (${day}, ${slotDef?.start || tRow.start}–${slotDef?.end || tRow.end} WIB): Terkunci Permanen / Non-KBM. Tidak dapat diisi mapel.`}
                                  >
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800, fontSize: '0.78rem' }}>
                                      <LockKeyhole size={12} style={{ opacity: 0.85 }} />
                                      <span>{label}</span>
                                    </div>
                                    <small style={{ fontSize: '0.68rem', opacity: 0.85, marginTop: '3px', fontWeight: 600 }}>
                                      {isUpacara
                                        ? 'Upacara & Apel Pagi'
                                        : isReligi
                                        ? (day === 'Jumat' ? 'Jumat Bersih & Religi' : 'Tadarus & Sholat Dhuha')
                                        : (tRow.order === 5 ? 'Rehat Pagi Santri' : 'Sholat Dhuhur & Ishoma')}
                                    </small>
                                    <span style={{ fontSize: '0.64rem', fontWeight: 700, opacity: 0.75, marginTop: '2px' }}>
                                      {slotDef?.start || tRow.start} – {slotDef?.end || tRow.end} WIB
                                    </span>
                                    <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: '3px', marginTop: '4px' }}>
                                      Terkunci
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      }

                      const jpNo = tRow.jpNo!;
                      const refSlot = state.slots.find((slot) => slot.kind === 'TEACHING' && slot.active && slot.jpNo === jpNo);
                      return (
                      <tr key={jpNo}>
                        <th className="period-heading" title={`Jam KBM JP ${jpNo}: ${refSlot ? `${refSlot.start} – ${refSlot.end} WIB` : '—'}`}>
                          <span>JP {String(jpNo).padStart(2, '0')}</span>
                          <small style={{ fontWeight: 700, color: '#16483f' }}>
                            {refSlot ? `${refSlot.start} – ${refSlot.end}` : '—'}
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

                          const isOutOfKbm = !slotDef;
                          return (
                            <td
                              key={`${day}-${jpNo}`}
                              onDragOver={(e) => {
                                if (blocked) return;
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
                                if (blocked) return;
                                if (draggedSlot) {
                                  onDropSlot(draggedSlot, { day, jpNo });
                                  setDraggedSlot(null);
                                }
                              }}
                              style={{
                                background: isOver && !blocked ? 'rgba(36, 99, 94, 0.12)' : undefined,
                                outline: isOver && !blocked ? '2px dashed #24635e' : undefined,
                              }}
                            >
                              <button
                                type="button"
                                disabled={blocked}
                                draggable={!blocked && !!entry}
                                onDragStart={() => {
                                  if (entry && !blocked) {
                                    setDraggedSlot({ classId: selectedClass, day, jpNo });
                                  }
                                }}
                                className={`schedule-cell ${entry ? 'has-entry' : 'is-empty'} ${blocked ? 'is-blocked' : ''}`}
                                style={{
                                  ...(entry && subject ? ({ '--subject-color': subject.color } as React.CSSProperties) : {}),
                                  cursor: blocked ? 'not-allowed' : undefined,
                                }}
                                onClick={() => {
                                  if (!blocked) {
                                    onEditSlot(selectedClass, day, jpNo);
                                  }
                                }}
                                title={
                                  blocked
                                    ? (isOutOfKbm ? `Di luar jam KBM ${day}` : `${slotDef?.activityName || slotDef?.activityType || 'Non-KBM'} (${slotDef?.start}–${slotDef?.end} WIB): Terkunci`)
                                    : entry
                                    ? `Tarik untuk memindahkan: ${subject?.name} (${teacher?.name}) · Jam KBM ${slotDef?.start}–${slotDef?.end}`
                                    : `Klik untuk menambah pelajaran pada ${day}, JP ${jpNo} (${slotDef?.start}–${slotDef?.end} WIB)`
                                }
                              >
                                <span className="cell-time">
                                  {entry
                                    ? `${subject?.code ?? 'MAPEL'} · ${slotDef?.start ?? ''}`
                                    : blocked
                                    ? (isOutOfKbm ? 'SELESAI' : (slotDef?.activityName || slotDef?.activityType || 'NON-KBM'))
                                    : `JP ${jpNo} (${slotDef?.start ?? ''})`}
                                </span>
                                {entry ? (
                                  <>
                                    <strong>{subject?.name ?? 'Mapel'}</strong>
                                    <small>{teacher?.name ?? 'Guru belum tersedia'}</small>
                                    <span className="cell-foot">
                                      <i /> {teacher?.code ?? '—'} <span style={{ opacity: 0.75, marginLeft: 'auto' }}>{slotDef?.start}–{slotDef?.end}</span>
                                    </span>
                                  </>
                                ) : (
                                  <span className="empty-cell-hint">
                                    {blocked ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <LockKeyhole size={11} /> {isOutOfKbm ? 'Di Luar Jam KBM' : (slotDef?.activityName || slotDef?.activityType)}
                                      </span>
                                    ) : (
                                      <span>+ Isi Mapel ({slotDef?.start ?? ''})</span>
                                    )}
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="schedule-legend-row">
                <span><i className="legend-dot dot-teal" /> Mapel terisi (Dapat digeser/drag)</span>
                <span><i className="legend-dot dot-ivory" /> Slot KBM kosong</span>
                <span><LockKeyhole size={13} style={{ verticalAlign: -2, color: '#16483f' }} /> Slot Non-KBM (Upacara, Religi, Istirahat: Terkunci)</span>
                <span><ShieldCheck size={14} /> Klik untuk edit manual</span>
                <span className="legend-spacer" />
                <button className="text-link" onClick={onOpenValidationModal}>
                  Laporan Validasi Lengkap <ArrowRight size={13} />
                </button>
              </div>
            </>
          )}
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

  // Madrasah Profile & Document Integration
  const [ministry, setMinistry] = useState(state.settings.ministry ?? 'KEMENTERIAN AGAMA REPUBLIK INDONESIA');
  const [regionalOffice, setRegionalOffice] = useState(state.settings.regionalOffice ?? 'KANTOR KEMENTERIAN AGAMA KABUPATEN MALANG');
  const [address, setAddress] = useState(state.settings.address ?? 'Jl. Raya Cendekia No. 45, Sumberpucung');
  const [city, setCity] = useState(state.settings.city ?? 'Kabupaten Malang');
  const [postalCode, setPostalCode] = useState(state.settings.postalCode ?? '65165');
  const [npsn, setNpsn] = useState(state.settings.npsn ?? '20580001');
  const [nsm, setNsm] = useState(state.settings.nsm ?? '121235070001');
  const [phone, setPhone] = useState(state.settings.phone ?? '(0341) 395882 / 0812-3456-7890');
  const [email, setEmail] = useState(state.settings.email ?? 'mts.cendekia@kemenag.go.id');
  const [website, setWebsite] = useState(state.settings.website ?? 'www.mtscendekia.sch.id');
  const [logoUrl, setLogoUrl] = useState<string>(state.settings.logoUrl ?? '');
  const [logoError, setLogoError] = useState<string | null>(null);

  // Official Signatories
  const [headmasterName, setHeadmasterName] = useState(state.settings.headmasterName ?? 'H. Ahmad Fauzi, S.Ag., M.Pd.I.');
  const [headmasterNip, setHeadmasterNip] = useState(state.settings.headmasterNip ?? '19750812 200212 1 003');
  const [headmasterTitle, setHeadmasterTitle] = useState(state.settings.headmasterTitle ?? 'Kepala Madrasah');
  const [curriculumLeaderName, setCurriculumLeaderName] = useState(state.settings.curriculumLeaderName ?? 'Siti Aminah, S.Pd.I., M.Pd.');
  const [curriculumLeaderNip, setCurriculumLeaderNip] = useState(state.settings.curriculumLeaderNip ?? '19820315 200901 2 008');
  const [curriculumLeaderTitle, setCurriculumLeaderTitle] = useState(state.settings.curriculumLeaderTitle ?? 'Waka Bidang Kurikulum');

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

  const handleDurationChange = (index: number, newMinutes: number) => {
    const safeDur = Math.max(5, Math.min(180, newMinutes || 40));
    const def = definitions[index];
    const startMins = clockToMinutes(def.start);
    const newEnd = toClock(startMins + safeDur);
    handleUpdateDef(index, { end: newEnd });
  };

  const handleStartTimeChange = (index: number, newStart: string) => {
    const def = definitions[index];
    const currentDur = Math.max(5, clockToMinutes(def.end) - clockToMinutes(def.start));
    const startMins = clockToMinutes(newStart);
    const newEnd = toClock(startMins + currentDur);
    handleUpdateDef(index, { start: newStart, end: newEnd });
  };

  const handleMoveSlot = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= definitions.length) return;
    const updated = [...definitions];
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    setDefinitions(updated.map((item, idx) => ({ ...item, order: idx + 1 })));
  };

  const handleAddSlot = (
    activityType: ActivityType = 'KBM',
    customMinutes?: number,
    customName?: string,
    applicableDays?: Day[]
  ) => {
    const last = definitions[definitions.length - 1];
    const order = definitions.length + 1;
    const startMins = last ? clockToMinutes(last.end) : 7 * 60;
    const dur = customMinutes ?? (activityType === 'KBM' ? Number(periodMinutes) || 40 : activityType === 'ISTIRAHAT' ? 20 : 30);
    const endMins = startMins + dur;

    setDefinitions([
      ...definitions,
      {
        order,
        start: toClock(startMins),
        end: toClock(endMins),
        activityType,
        activityName: customName || (
          activityType === 'ISTIRAHAT'
            ? 'Istirahat'
            : activityType === 'UPACARA'
            ? 'Upacara Bendera'
            : activityType === 'RELIGI'
            ? 'Sholat Dhuha / Tadarus'
            : ''
        ),
        applicableDays,
      },
    ]);
  };

  const handleCascadeSequentialTimes = (baseMinutes?: number) => {
    if (!definitions.length) return;
    const kbmDur = baseMinutes ?? (Number(periodMinutes) || 40);
    const firstStart = clockToMinutes(definitions[0].start || '07:00');
    let cursor = firstStart;

    const updated = definitions.map((def, idx) => {
      let dur = Math.max(5, clockToMinutes(def.end) - clockToMinutes(def.start));
      if (def.activityType === 'KBM') {
        dur = kbmDur;
      }
      const start = toClock(cursor);
      const end = toClock(cursor + dur);
      cursor += dur;
      return {
        ...def,
        order: idx + 1,
        start,
        end,
      };
    });
    setDefinitions(updated);
  };

  const handleQuickDurationPreset = (mins: number) => {
    setPeriodMinutes(String(mins));
    handleCascadeSequentialTimes(mins);
  };

  const handleDeleteSlot = (index: number) => {
    if (definitions.length <= 1) return;
    const updated = definitions.filter((_, i) => i !== index).map((def, idx) => ({ ...def, order: idx + 1 }));
    setDefinitions(updated);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setLogoError(null);
      const dataUrl = await processLogoUpload(file);
      setLogoUrl(dataUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses berkas logo.';
      setLogoError(msg);
    }
  };

  const handleResetLogo = () => {
    setLogoUrl('');
    setLogoError(null);
  };

  const handleSave = () => {
    const kbmCount = definitions.filter((d) => d.activityType === 'KBM').length;
    onSettingsChange({
      schoolName: schoolName.trim() || 'MTs Cendekia Nusantara',
      ministry: ministry.trim() || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
      regionalOffice: regionalOffice.trim() || 'KANTOR KEMENTERIAN AGAMA KABUPATEN MALANG',
      address: address.trim() || 'Jl. Raya Cendekia No. 45, Sumberpucung',
      city: city.trim() || 'Kabupaten Malang',
      postalCode: postalCode.trim() || '65165',
      npsn: npsn.trim() || '20580001',
      nsm: nsm.trim() || '121235070001',
      phone: phone.trim() || '(0341) 395882 / 0812-3456-7890',
      email: email.trim() || 'mts.cendekia@kemenag.go.id',
      website: website.trim() || 'www.mtscendekia.sch.id',
      logoUrl: logoUrl.trim() || undefined,
      headmasterName: headmasterName.trim() || 'H. Ahmad Fauzi, S.Ag., M.Pd.I.',
      headmasterNip: headmasterNip.trim() || '19750812 200212 1 003',
      headmasterTitle: headmasterTitle.trim() || 'Kepala Madrasah',
      curriculumLeaderName: curriculumLeaderName.trim() || 'Siti Aminah, S.Pd.I., M.Pd.',
      curriculumLeaderNip: curriculumLeaderNip.trim() || '19820315 200901 2 008',
      curriculumLeaderTitle: curriculumLeaderTitle.trim() || 'Waka Bidang Kurikulum',
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
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                HARI BELAJAR AKTIF
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong style={{ fontSize: '22px', color: '#173637', fontWeight: 800 }}>{activeDays.length} Hari</strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>/ Pekan KBM</span>
              </div>
            </div>

            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TOTAL JP KBM PEKANAN
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong style={{ fontSize: '22px', color: '#1f6952', fontWeight: 800 }}>
                  {state.settings.activeDays.reduce((sum, day) => sum + teachingPeriodsForDay(state.slots, day).length, 0)} JP
                </strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>Jam KBM Efektif</span>
              </div>
            </div>

            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                DURASI STANDAR 1 JP
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong style={{ fontSize: '22px', color: '#bc945e', fontWeight: 800 }}>{periodMinutes} Menit</strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>Standar MTs</span>
              </div>
            </div>

            <div className="surface-card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '11px', color: '#55726b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                WAKTU ASTRONOMIS NYATA
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                <strong style={{ fontSize: '22px', color: '#2c678a', fontWeight: 800 }}>
                  {((state.settings.activeDays.reduce((sum, day) => sum + teachingPeriodsForDay(state.slots, day).length, 0) * Number(periodMinutes || 40)) / 60).toFixed(1)} Jam
                </strong>
                <span style={{ fontSize: '12px', color: '#687a75' }}>Tatap Muka / Pekan</span>
              </div>
            </div>
          </div>

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

            {/* 2. Period Definitions (Jam ke-1..N with Activity Types & Durations) */}
            <Card
              eyebrow="PERIOD SLOTS & ACTIVITIES"
              title="Pengaturan Durasi JP & Susunan Jam Kegiatan (KBM, Istirahat, Upacara, Religi)"
              action={
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="button button-sm button-quiet"
                    onClick={() => {
                      setDefinitions(createDefaultPeriodDefinitions(8, [2, 5], Number(periodMinutes) || 40));
                    }}
                    title="Muat susunan standar 8 JP KBM dengan 2 istirahat"
                  >
                    Template Standar (8 JP)
                  </button>
                  <button
                    type="button"
                    className="button button-sm button-quiet"
                    onClick={() => {
                      const dur = Number(periodMinutes) || 40;
                      let cursor = 7 * 60; // 07:00
                      const defs: PeriodDefinition[] = [
                        { order: 1, start: toClock(cursor), end: toClock(cursor + 40), activityType: 'UPACARA', activityName: 'Upacara Bendera', applicableDays: ['Senin'] },
                      ];
                      cursor += 40;
                      for (let i = 1; i <= 9; i++) {
                        defs.push({ order: defs.length + 1, start: toClock(cursor), end: toClock(cursor + dur), activityType: 'KBM' });
                        cursor += dur;
                        if (i === 3) {
                          defs.push({ order: defs.length + 1, start: toClock(cursor), end: toClock(cursor + 20), activityType: 'ISTIRAHAT', activityName: 'Istirahat Pagi' });
                          cursor += 20;
                        } else if (i === 6) {
                          defs.push({ order: defs.length + 1, start: toClock(cursor), end: toClock(cursor + 40), activityType: 'RELIGI', activityName: 'Sholat Dhuhur Berjamaah' });
                          cursor += 40;
                        }
                      }
                      setDefinitions(defs);
                    }}
                    title="Muat susunan Full Day (Upacara + 9 JP KBM + Istirahat + Sholat Dhuhur)"
                  >
                    Template Full Day
                  </button>
                  <button
                    type="button"
                    className="button button-sm button-secondary"
                    onClick={() => handleAddSlot('ISTIRAHAT', 20, 'Istirahat')}
                  >
                    <Plus size={14} /> Sisipkan Istirahat
                  </button>
                  <button
                    type="button"
                    className="button button-sm button-secondary"
                    onClick={() => handleAddSlot('KBM')}
                  >
                    <Plus size={14} /> Tambah Jam KBM
                  </button>
                </div>
              }
            >
              <p className="settings-card-intro">
                Tentukan urutan jam madrasah dari jam pertama sampai selesai. Durasi tiap jam dapat disesuaikan dalam menit. Slot berjenis <strong>🟢 Belajar Mengajar (KBM)</strong> otomatis dialokasikan untuk mata pelajaran &amp; beban mengajar guru, sedangkan slot <strong>🟡 Istirahat, 🔴 Upacara, 🟣 Religi,</strong> dan <strong>⚪ Kegiatan Lain</strong> otomatis diblokir dari KBM.
              </p>

              {/* HERO BANNER: PENGATURAN DURASI STANDAR 1 JP (MENIT) */}
              <div className="period-duration-banner">
                <div className="period-duration-banner-top">
                  <div className="period-duration-title">
                    <Clock size={20} color="#24635e" />
                    <div>
                      <strong>DURASI STANDAR 1 JAM PELAJARAN (JP)</strong>
                      <span style={{ display: 'block', fontSize: '11.5px', color: '#556663', marginTop: '2px' }}>
                        Acuan menit tatap muka per JP dan dasar konversi jam astronomis (SKMT / Beban Guru).
                      </span>
                    </div>
                  </div>

                  <div className="period-duration-controls">
                    <div className="duration-input-wrap">
                      <input
                        type="number"
                        min="20"
                        max="90"
                        value={periodMinutes}
                        onChange={(e) => setPeriodMinutes(e.target.value)}
                        title="Durasi dalam menit per JP"
                      />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#173637' }}>Menit / JP</span>
                    </div>

                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        type="button"
                        className={`duration-preset-btn ${Number(periodMinutes) === 35 ? 'active' : ''}`}
                        onClick={() => handleQuickDurationPreset(35)}
                        title="Terapkan 35 menit per JP untuk jenjang MI/SD"
                      >
                        35 Mnt (MI)
                      </button>
                      <button
                        type="button"
                        className={`duration-preset-btn ${Number(periodMinutes) === 40 ? 'active' : ''}`}
                        onClick={() => handleQuickDurationPreset(40)}
                        title="Terapkan 40 menit per JP (Standar MTs Kemenag)"
                      >
                        40 Mnt (MTs Standar)
                      </button>
                      <button
                        type="button"
                        className={`duration-preset-btn ${Number(periodMinutes) === 45 ? 'active' : ''}`}
                        onClick={() => handleQuickDurationPreset(45)}
                        title="Terapkan 45 menit per JP untuk jenjang MA/SMA"
                      >
                        45 Mnt (MA)
                      </button>
                    </div>

                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ fontSize: '11.5px', height: '34px', gap: '6px' }}
                      onClick={() => handleCascadeSequentialTimes()}
                      title="Hitung ulang jam mulai & selesai secara berurutan tanpa jeda"
                    >
                      <RefreshCw size={13} /> Sinkronkan Jam Berurutan (Cascade)
                    </button>
                  </div>
                </div>

                <div className="period-categories-legend">
                  <span style={{ fontWeight: 800, color: '#103f3e', letterSpacing: '0.04em' }}>KATEGORI JAM:</span>
                  <span className="category-badge category-badge-kbm" title="Masuk perhitungan KBM, alokasi kelas, dan jam mengajar guru">
                    🟢 Belajar Mengajar (KBM)
                  </span>
                  <span className="category-badge category-badge-istirahat" title="Jeda istirahat siswa dan guru, diblokir dari KBM">
                    🟡 Istirahat
                  </span>
                  <span className="category-badge category-badge-upacara" title="Upacara bendera / apel madrasah, diblokir dari KBM">
                    🔴 Upacara Bendera
                  </span>
                  <span className="category-badge category-badge-religi" title="Sholat dhuha, tadarus Al-Qur'an, atau pembiasaan ibadah, diblokir dari KBM">
                    🟣 Religi / Dhuha
                  </span>
                  <span className="category-badge category-badge-lainnya" title="Kegiatan khusus madrasah, literasi, atau ekstrakurikuler">
                    ⚪ Kegiatan Lain
                  </span>
                </div>
              </div>

              {/* Period Table with interactive Durasi column and Reordering */}
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '65px', textAlign: 'center' }}>Urutan</th>
                      <th style={{ width: '95px' }}>Mulai</th>
                      <th style={{ width: '85px', textAlign: 'center' }}>Durasi</th>
                      <th style={{ width: '95px' }}>Selesai</th>
                      <th style={{ width: '180px' }}>Kategori JP / Jenis Kegiatan</th>
                      <th style={{ width: '135px' }}>Hari Berlaku</th>
                      <th>Nama Kegiatan / Keterangan</th>
                      <th style={{ width: '75px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {definitions.map((def, idx) => {
                      const startMins = clockToMinutes(def.start);
                      const endMins = clockToMinutes(def.end);
                      const currentDur = Math.max(0, endMins - startMins);
                      const isKbm = def.activityType === 'KBM';

                      return (
                        <tr key={idx} style={{ background: !isKbm ? '#fafbf9' : undefined }}>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                              <span style={{ fontWeight: 800, fontSize: '12px', color: '#173637' }}>#{def.order}</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <button
                                  type="button"
                                  className="icon-button"
                                  style={{ width: '16px', height: '14px', padding: 0 }}
                                  disabled={idx === 0}
                                  onClick={() => handleMoveSlot(idx, 'up')}
                                  title="Pindahkan jam ke atas"
                                >
                                  <ChevronUp size={11} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button"
                                  style={{ width: '16px', height: '14px', padding: 0 }}
                                  disabled={idx === definitions.length - 1}
                                  onClick={() => handleMoveSlot(idx, 'down')}
                                  title="Pindahkan jam ke bawah"
                                >
                                  <ChevronDown size={11} />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td>
                            <input
                              type="time"
                              value={def.start}
                              onChange={(e) => handleStartTimeChange(idx, e.target.value)}
                              title="Jam mulai"
                              style={{ padding: '6px', borderRadius: '6px', border: '1px solid #c8d3cc', width: '100%', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <input
                                type="number"
                                min="5"
                                max="180"
                                step="5"
                                value={currentDur || ''}
                                onChange={(e) => handleDurationChange(idx, Number(e.target.value))}
                                title="Ubah durasi dalam menit"
                                style={{
                                  width: '48px',
                                  padding: '5px 2px',
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid #c8d3cc',
                                  background: isKbm ? '#f4f8f6' : '#fff9f0',
                                }}
                              />
                              <small style={{ fontSize: '10px', color: '#687a75' }}>mnt</small>
                            </div>
                          </td>
                          <td>
                            <input
                              type="time"
                              value={def.end}
                              onChange={(e) => handleUpdateDef(idx, { end: e.target.value })}
                              title="Jam selesai"
                              style={{ padding: '6px', borderRadius: '6px', border: '1px solid #c8d3cc', width: '100%', fontSize: '12px' }}
                            />
                          </td>
                          <td>
                            <select
                              value={def.activityType}
                              onChange={(e) => {
                                const newType = e.target.value as ActivityType;
                                const changes: Partial<PeriodDefinition> = { activityType: newType };
                                if (newType === 'ISTIRAHAT' && (!def.activityName || def.activityName === 'Jam Pelajaran KBM')) {
                                  changes.activityName = 'Istirahat';
                                } else if (newType === 'UPACARA') {
                                  changes.activityName = 'Upacara Bendera';
                                  changes.applicableDays = ['Senin'];
                                } else if (newType === 'RELIGI' && (!def.activityName || def.activityName === 'Jam Pelajaran KBM')) {
                                  changes.activityName = 'Sholat Dhuha / Tadarus';
                                } else if (newType === 'KBM' && def.activityName === 'Istirahat') {
                                  changes.activityName = '';
                                }
                                handleUpdateDef(idx, changes);
                              }}
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
                              type="button"
                              className="icon-button table-row-action"
                              onClick={() => handleDeleteSlot(idx)}
                              title="Hapus jam kegiatan ini"
                              disabled={definitions.length <= 1}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 14px', background: '#f5faf7', borderRadius: '8px', border: '1px solid #dce8e2' }}>
                <span style={{ fontSize: '12px', color: '#16483f' }}>
                  <strong>{definitions.filter((d) => d.activityType === 'KBM').length} Jam Pelajaran (KBM)</strong> · {definitions.filter((d) => d.activityType !== 'KBM').length} Jam Non-KBM Terjadwal · Rentang {definitions[0]?.start ?? '07:00'} sampai {definitions[definitions.length - 1]?.end ?? '13:00'} ({Number(periodMinutes) || 40} Menit/JP)
                </span>
                <span style={{ fontSize: '11.5px', color: '#556663' }}>
                  Gunakan tombol <strong>Simpan Pengaturan</strong> di bagian atas untuk menyimpan seluruh perubahan.
                </span>
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
            <Card eyebrow="DURATION & STANDARDS" title="Ringkasan Jam & Konversi JP">
              <div className="field-group">
                <label>Durasi Standar 1 JP</label>
                <select
                  value={periodMinutes}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPeriodMinutes(val);
                    handleCascadeSequentialTimes(Number(val));
                  }}
                >
                  <option value="35">35 Menit (SD/MI)</option>
                  <option value="40">40 Menit (MTs / Standar Kemenag)</option>
                  <option value="45">45 Menit (MA / SMA)</option>
                </select>
                <small>1 JP setara {((Number(periodMinutes) || 40) / 60).toFixed(2)} jam astronomis (60 mnt).</small>
              </div>

              <div style={{ marginTop: '14px', padding: '12px', background: '#f5f8f6', borderRadius: '8px', border: '1px solid #d4e4db', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#556663' }}>Jam KBM per hari:</span>
                  <strong>{definitions.filter((d) => d.activityType === 'KBM').length} JP</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#556663' }}>Non-KBM per hari:</span>
                  <strong>{definitions.filter((d) => d.activityType !== 'KBM').length} Sesi</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#556663' }}>Hari aktif madrasah:</span>
                  <strong>{activeDays.length} Hari</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #c0d7cb', paddingTop: '6px' }}>
                  <span style={{ color: '#173637', fontWeight: 700 }}>Kapasitas Kelas/Minggu:</span>
                  <strong style={{ color: '#1f6952' }}>{activeDays.length * definitions.filter((d) => d.activityType === 'KBM').length} JP</strong>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ width: '100%', fontSize: '11px', height: '32px' }}
                  onClick={() => handleCascadeSequentialTimes()}
                >
                  <RefreshCw size={13} /> Sinkronkan Seluruh Jam
                </button>
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
        </>
      )}

      {activeTab === 'general' && (
        <div className="settings-layout">
          <div className="settings-main-column">
            {/* 1. Kementerian & Satuan Pendidikan */}
            <Card eyebrow="KELEMBAGAAN KEMENAG" title="Kementerian & Satuan Pendidikan">
              <div className="settings-form-grid">
                <div className="field-group field-span-two">
                  <label>Kementerian yang Menaungi</label>
                  <input
                    value={ministry}
                    onChange={(e) => setMinistry(e.target.value)}
                    placeholder="Contoh: KEMENTERIAN AGAMA REPUBLIK INDONESIA"
                  />
                  <small>Muncul pada baris teratas Kop Surat seluruh dokumen resmi.</small>
                </div>

                <div className="field-group field-span-two">
                  <label>Kantor Wilayah / Kankemenag Daerah</label>
                  <input
                    value={regionalOffice}
                    onChange={(e) => setRegionalOffice(e.target.value)}
                    placeholder="Contoh: KANTOR KEMENTERIAN AGAMA KABUPATEN MALANG"
                  />
                  <small>Muncul pada baris kedua Kop Surat resmi.</small>
                </div>

                <div className="field-group field-span-two">
                  <label>Nama Satuan Pendidikan / Madrasah</label>
                  <input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Nama madrasah lengkap, misal: MTs Cendekia Nusantara"
                  />
                </div>

                <div className="field-group">
                  <label>Nomor Statistik Madrasah (NSM)</label>
                  <input
                    value={nsm}
                    onChange={(e) => setNsm(e.target.value)}
                    placeholder="12 digit NSM, misal: 121235070001"
                  />
                </div>

                <div className="field-group">
                  <label>NPSN (Nomor Pokok Sekolah Nasional)</label>
                  <input
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value)}
                    placeholder="8 digit NPSN, misal: 20580001"
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
            </Card>

            {/* 2. Alamat & Narahubung Resmi */}
            <Card eyebrow="DOMISILI & KONTAK" title="Alamat & Narahubung Resmi">
              <div className="settings-form-grid">
                <div className="field-group field-span-two">
                  <label>Alamat Lengkap (Jalan / Desa / Kecamatan)</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Jl. Raya Cendekia No. 45, Sumberpucung"
                  />
                </div>

                <div className="field-group">
                  <label>Kota / Kabupaten Pengesahan</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Kabupaten Malang"
                  />
                  <small>Dicantumkan di atas tanggal tanda tangan surat keputusan.</small>
                </div>

                <div className="field-group">
                  <label>Kode Pos</label>
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="65165"
                  />
                </div>

                <div className="field-group">
                  <label>No. Telepon / WhatsApp Madrasah</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(0341) 395882 / 0812-3456-7890"
                  />
                </div>

                <div className="field-group">
                  <label>Email Resmi Madrasah</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mts.cendekia@kemenag.go.id"
                  />
                </div>

                <div className="field-group field-span-two">
                  <label>Website / Portal Madrasah</label>
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="www.mtscendekia.sch.id"
                  />
                </div>
              </div>
            </Card>

            {/* 3. Pejabat Penandatangan Dokumen Resmi */}
            <Card eyebrow="OFFICIAL SIGNATORIES" title="Pejabat Pengesah Dokumen Resmi">
              <div style={{ padding: '12px 14px', background: '#f0f5eb', border: '1px solid #dfe9dd', borderRadius: '8px', color: '#28413e', fontSize: '12.5px', display: 'flex', gap: '9px', alignItems: 'flex-start', marginBottom: '16px' }}>
                <ShieldCheck size={16} style={{ color: '#2f7771', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ lineHeight: 1.5 }}>
                  <strong style={{ display: 'block', color: '#16483f', marginBottom: '2px' }}>Integrasi Dokumen Otomatis</strong>
                  Nama, jabatan, dan NIP pejabat di bawah ini otomatis tertera pada kolom tanda tangan dokumen resmi: Jadwal Semua Kelas (A4), Jadwal Guru perorangan, dan Rekap Presensi Bulanan.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '14px', border: '1px solid #e2e7dc', borderRadius: '10px', background: '#fcfdfb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Award size={16} style={{ color: '#2f7771' }} />
                    <strong style={{ fontSize: '13px', color: '#16483f' }}>Pejabat 1: Kepala Madrasah</strong>
                  </div>
                  <div className="settings-form-grid">
                    <div className="field-group">
                      <label>Nomenklatur Jabatan</label>
                      <input
                        value={headmasterTitle}
                        onChange={(e) => setHeadmasterTitle(e.target.value)}
                        placeholder="Kepala Madrasah"
                      />
                    </div>
                    <div className="field-group">
                      <label>Nama Lengkap &amp; Gelar</label>
                      <input
                        value={headmasterName}
                        onChange={(e) => setHeadmasterName(e.target.value)}
                        placeholder="H. Ahmad Fauzi, S.Ag., M.Pd.I."
                      />
                    </div>
                    <div className="field-group field-span-two">
                      <label>NIP / NPK Kepala Madrasah</label>
                      <input
                        value={headmasterNip}
                        onChange={(e) => setHeadmasterNip(e.target.value)}
                        placeholder="19750812 200212 1 003"
                      />
                    </div>
                  </div>
                </div>

                <div style={{ padding: '14px', border: '1px solid #e2e7dc', borderRadius: '10px', background: '#fcfdfb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Award size={16} style={{ color: '#2f7771' }} />
                    <strong style={{ fontSize: '13px', color: '#16483f' }}>Pejabat 2: Waka Kurikulum / Pengesah</strong>
                  </div>
                  <div className="settings-form-grid">
                    <div className="field-group">
                      <label>Nomenklatur Jabatan</label>
                      <input
                        value={curriculumLeaderTitle}
                        onChange={(e) => setCurriculumLeaderTitle(e.target.value)}
                        placeholder="Waka Bidang Kurikulum"
                      />
                    </div>
                    <div className="field-group">
                      <label>Nama Lengkap &amp; Gelar</label>
                      <input
                        value={curriculumLeaderName}
                        onChange={(e) => setCurriculumLeaderName(e.target.value)}
                        placeholder="Siti Aminah, S.Pd.I., M.Pd."
                      />
                    </div>
                    <div className="field-group field-span-two">
                      <label>NIP / NPK Waka Kurikulum</label>
                      <input
                        value={curriculumLeaderNip}
                        onChange={(e) => setCurriculumLeaderNip(e.target.value)}
                        placeholder="19820315 200901 2 008"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button icon={Save} onClick={handleSave}>
                  {saved ? 'Tersimpan' : 'Simpan Seluruh Identitas'}
                </Button>
              </div>
            </Card>
          </div>

          <aside className="settings-side-column">
            {/* Logo Madrasah Card */}
            <Card eyebrow="OFFICIAL EMBLEM" title="Logo Dokumen Madrasah">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', padding: '10px 0' }}>
                <div
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    padding: '6px',
                    border: '2px solid #bc945e',
                    background: '#ffffff',
                    boxShadow: '0 4px 14px rgba(11, 52, 53, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={logoUrl || getDefaultMadrasahLogo()}
                    alt="Logo Madrasah"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>

                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '6px',
                      background: logoUrl ? '#e6f4ee' : '#f5eedb',
                      color: logoUrl ? '#16483f' : '#8e6b28',
                      border: `1px solid ${logoUrl ? '#bce0d0' : '#e6d8b5'}`,
                    }}
                  >
                    {logoUrl ? '✓ Logo Kustom Terpasang' : 'Logo Standar Kemenag (Bawaan)'}
                  </span>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    className="button button-secondary"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    <Upload size={14} /> Unggah Logo Kustom
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      className="button button-quiet"
                      style={{ width: '100%', justifyContent: 'center', fontSize: '11.5px', color: '#8e625a' }}
                      onClick={handleResetLogo}
                    >
                      <RotateCcw size={13} /> Reset ke Logo Kemenag
                    </button>
                  )}
                </div>

                {logoError && (
                  <div style={{ width: '100%', padding: '8px', background: '#faeae6', border: '1px solid #ebd0c8', borderRadius: '6px', color: '#b24c3d', fontSize: '11px', textAlign: 'left' }}>
                    {logoError}
                  </div>
                )}

                <p style={{ margin: 0, fontSize: '11px', color: '#657874', lineHeight: 1.5, textAlign: 'left' }}>
                  Disarankan format PNG/JPEG dengan latar transparan atau putih (rasio 1:1). Logo otomatis dikompres dan terintegrasi di Kop Surat dokumen PDF.
                </p>
              </div>
            </Card>

            {/* Kop Surat Live Preview Card */}
            <Card eyebrow="LIVE DOCUMENT PREVIEW" title="Pratinjau Kop Surat Resmi">
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #d4d7cc',
                  borderRadius: '8px',
                  padding: '14px 12px 12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                {/* Header Content */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={logoUrl || getDefaultMadrasahLogo()}
                    alt="Logo Kop"
                    style={{ width: '42px', height: '42px', objectFit: 'contain', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                    <div style={{ fontSize: '8.5px', fontWeight: 700, color: '#0b3435', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                      {ministry || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA'}
                    </div>
                    <div style={{ fontSize: '8px', fontWeight: 700, color: '#16483f', textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.2, marginTop: '1px' }}>
                      {regionalOffice || 'KANTOR KEMENTERIAN AGAMA KABUPATEN MALANG'}
                    </div>
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0b3435', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.2, marginTop: '2px' }}>
                      {schoolName || 'MTS CENDEKIA NUSANTARA'}
                    </div>
                    <div style={{ fontSize: '7px', fontWeight: 600, color: '#435e58', marginTop: '2px' }}>
                      NSM: {nsm || '-'} &nbsp;|&nbsp; NPSN: {npsn || '-'}
                    </div>
                    <div style={{ fontSize: '6.5px', color: '#657874', marginTop: '1px', lineHeight: 1.2 }}>
                      {address || '-'}, {city || '-'} {postalCode || ''}
                    </div>
                    <div style={{ fontSize: '6.5px', color: '#657874', marginTop: '1px' }}>
                      Telp: {phone || '-'} &nbsp;|&nbsp; Email: {email || '-'}
                    </div>
                  </div>
                </div>

                {/* Double Rule Line Divider */}
                <div style={{ marginTop: '7px', marginBottom: '8px' }}>
                  <div style={{ height: '2px', background: '#0b3435', width: '100%' }} />
                  <div style={{ height: '0.7px', background: '#0b3435', width: '100%', marginTop: '1.5px' }} />
                </div>

                {/* Simulated Document Body Title */}
                <div style={{ textAlign: 'center', padding: '4px 0' }}>
                  <div style={{ fontSize: '8.5px', fontWeight: 800, color: '#0b3435', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    JADWAL PELAJARAN SEMESTER {semester.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '7.5px', color: '#435e58', fontWeight: 600 }}>
                    TAHUN AJARAN {academicYear}
                  </div>
                </div>

                {/* Simulated Mini Signature Footer */}
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e4e2d7', display: 'flex', justifyContent: 'flex-end', textAlign: 'right' }}>
                  <div style={{ fontSize: '7px', color: '#435e58', lineHeight: 1.35 }}>
                    <div>{city}, {formatDate()}</div>
                    <div style={{ fontWeight: 600, color: '#0b3435' }}>{headmasterTitle}</div>
                    <div style={{ height: '18px' }} />
                    <div style={{ fontWeight: 700, textDecoration: 'underline', color: '#0b3435' }}>{headmasterName}</div>
                    <div>NIP. {headmasterNip}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#435e58' }}>
                <ShieldCheck size={14} style={{ color: '#2f7771', flexShrink: 0 }} />
                <span>Terintegrasi di seluruh cetak dokumen PDF resmi.</span>
              </div>
            </Card>
          </aside>
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

      {/* Solver & Capacity KPI Metrics */}
      <div className="generator-metrics">
        <div>
          <span>TARGET ALOKASI JP</span>
          <strong>{allJP} JP</strong>
          <small>{state.requirements.length} Mata Pelajaran Siswa</small>
        </div>
        <div>
          <span>KAPASITAS SLOT MURNI</span>
          <strong>
            {state.settings.activeDays.reduce((sum, day) => sum + teachingPeriodsForDay(state.slots, day).length, 0) *
              state.classes.filter((c) => c.isActive).length}{' '}
            JP
          </strong>
          <small>{state.classes.filter((c) => c.isActive).length} Rombel KBM Terdaftar</small>
        </div>
        <div>
          <span>KANDIDAT TERSIMPAN</span>
          <strong>{state.candidates.length}</strong>
          <small>Variasi Solusi Teruji</small>
        </div>
        <div>
          <span>STATUS SOLVER</span>
          <strong
            style={{
              color: isGenerating ? '#1f6850' : result?.status === 'SUCCESS' ? '#1f6850' : '#876123',
            }}
          >
            {isGenerating ? 'Mencari...' : result?.status === 'SUCCESS' ? '100% Lolos' : result ? statuses[result.status].label : 'Siap Dijalankan'}
          </strong>
          <small>Constraint Engine Deterministik</small>
        </div>
      </div>

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
    const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  const filteredClasses = state.classes.filter((item) => `${item.name} ${item.level}`.toLowerCase().includes(search.toLowerCase()));
  const filteredTeachers = state.teachers.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(search.toLowerCase()));
  const filteredSubjects = state.subjects.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(search.toLowerCase()));

  const currentList = activeTab === 'classes' ? filteredClasses : activeTab === 'teachers' ? filteredTeachers : filteredSubjects;
  const paginatedList = pageSize === 0 ? currentList : currentList.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
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

      {/* Real-Time Master Data KPI Strip */}
      <div className="master-summary-strip">
        <div className="master-summary-item">
          <div className="master-summary-icon">
            <GraduationCap size={19} />
          </div>
          <div>
            <span>TOTAL ROMBEL</span>
            <strong>{state.classes.filter((c) => c.isActive).length}</strong>
            <small>{state.classes.length} Rombel Terdaftar</small>
          </div>
        </div>

        <div className="master-summary-item">
          <div className="master-summary-icon gold">
            <Users size={19} />
          </div>
          <div>
            <span>DEWAN GURU</span>
            <strong>{state.teachers.filter((t) => t.isActive).length}</strong>
            <small>Pendidik Aktif Mengampu</small>
          </div>
        </div>

        <div className="master-summary-item">
          <div className="master-summary-icon blue">
            <BookOpen size={19} />
          </div>
          <div>
            <span>MATA PELAJARAN</span>
            <strong>{state.subjects.filter((s) => s.isActive).length}</strong>
            <small>Kurikulum MTs Terdata</small>
          </div>
        </div>

        <div className="master-summary-item">
          <div
            className="master-summary-icon"
            style={{
              color: state.classes.length > 0 && state.teachers.length > 0 && state.subjects.length > 0 ? '#1f6850' : '#b24c3d',
              background: state.classes.length > 0 && state.teachers.length > 0 && state.subjects.length > 0 ? '#e7efe5' : '#fee4e2',
            }}
          >
            <ShieldCheck size={19} />
          </div>
          <div>
            <span>INTEGRITAS DATA</span>
            <strong
              style={{
                color: state.classes.length > 0 && state.teachers.length > 0 && state.subjects.length > 0 ? '#1f6850' : '#b24c3d',
              }}
            >
              {state.classes.length > 0 && state.teachers.length > 0 && state.subjects.length > 0 ? '100% Siap' : 'Perlu Input'}
            </strong>
            <small>
              {state.classes.length > 0 && state.teachers.length > 0 && state.subjects.length > 0
                ? 'Struktur Master Lengkap'
                : 'Data Inti Belum Lengkap'}
            </small>
          </div>
        </div>
      </div>

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
                <div className="form-grid-two">
                  <div className="field-group">
                    <label>Jabatan Guru (Isi Manual / Rekomendasi)</label>
                    <input
                      value={form.roleTitle}
                      onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
                      placeholder="Misal: Waka Kurikulum, Guru Mapel, Guru BK..."
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {COMMON_TEACHER_POSITIONS.slice(0, 7).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setForm({ ...form, roleTitle: pos })}
                          style={{
                            fontSize: '10.5px',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            border: form.roleTitle === pos ? '1px solid #16483f' : '1px solid #d4d7cc',
                            background: form.roleTitle === pos ? '#e6f0ed' : '#ffffff',
                            color: form.roleTitle === pos ? '#0b3435' : '#435e58',
                            cursor: 'pointer',
                          }}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field-group">
                    <label>NIP / NPK / NUPTK</label>
                    <input
                      value={form.nip}
                      onChange={(e) => setForm({ ...form, nip: e.target.value })}
                      placeholder="Contoh: 19820514 200801 1 005 atau tanda (-)"
                    />
                    <small>Dicantumkan di bawah nama guru pada seluruh berkas resmi.</small>
                  </div>
                </div>

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
                {(paginatedList as SchoolClass[]).map((c) => {
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
                  <th>Jabatan</th>
                  <th>Kode</th>
                  <th>Kualifikasi Mapel</th>
                  <th>Beban Kebutuhan (JP)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(paginatedList as Teacher[]).map((t) => {
                  const teacherReqs = state.requirements.filter((r) => r.teacherId === t.id);
                  const totalAssignedJP = teacherReqs.reduce((sum, r) => sum + r.requiredJP, 0);
                  const maxJP = t.maxWeeklyJP || 24;
                  const pct = Math.round((totalAssignedJP / maxJP) * 100);
                  const isOverload = totalAssignedJP > maxJP;
                  const isFull = totalAssignedJP === maxJP;

                  return (
                    <tr key={t.id}>
                      <td>
                        <strong style={{ display: 'block', color: '#0f2c28' }}>{t.name}</strong>
                        {t.nip && (
                          <span style={{ fontSize: '11px', color: '#657874', letterSpacing: '0.01em' }}>
                            NIP. {t.nip}
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#16483f', fontSize: '12.5px' }}>
                          {t.roleTitle || 'Guru Mapel'}
                        </span>
                      </td>
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
                {(paginatedList as Subject[]).map((s) => {
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
              <TablePagination
          totalItems={currentList.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
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
  const [reqPageSize, setReqPageSize] = useState<number>(10);
  const [reqPage, setReqPage] = useState<number>(1);

  useEffect(() => {
    setReqPage(1);
  }, [selectedClassFilter, onlyIssuesFilter, searchQuery]);

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

      {/* Real-Time Requirements & Capacity KPI Grid */}
      <div className="requirements-metric-grid">
        <div className="req-metric">
          <div className="req-metric-mark">
            <BookOpen size={18} />
          </div>
          <span>TOTAL KEBUTUHAN</span>
          <strong>{totalJP} JP</strong>
          <small>{state.requirements.length} Alokasi Mapel Terdata</small>
        </div>

        <div className="req-metric">
          <div className="req-metric-mark blue">
            <Clock size={18} />
          </div>
          <span>KAPASITAS KBM</span>
          <strong>{totalWeeklySlots * state.classes.filter((c) => c.isActive).length} JP</strong>
          <small>{totalWeeklySlots} JP per Rombel / Pekan</small>
        </div>

        <div className="req-metric">
          <div className="req-metric-mark amber">
            <TrendingUp size={18} />
          </div>
          <span>KESEIMBANGAN ALOKASI</span>
          <strong
            style={{
              color: totalJP === totalWeeklySlots * state.classes.filter((c) => c.isActive).length ? '#1f6850' : '#b24c3d',
            }}
          >
            {totalJP === totalWeeklySlots * state.classes.filter((c) => c.isActive).length
              ? '100% Pas'
              : totalJP > totalWeeklySlots * state.classes.filter((c) => c.isActive).length
              ? `Surplus +${totalJP - totalWeeklySlots * state.classes.filter((c) => c.isActive).length} JP`
              : `Kurang ${totalWeeklySlots * state.classes.filter((c) => c.isActive).length - totalJP} JP`}
          </strong>
          <small>
            {totalJP === totalWeeklySlots * state.classes.filter((c) => c.isActive).length
              ? 'Seluruh slot KBM terisi pas'
              : 'Perlu diselaraskan dengan JP KBM'}
          </small>
        </div>

        <div className="req-metric">
          <div className="req-metric-mark violet">
            <CheckCircle2 size={18} />
          </div>
          <span>ROMBEL TUNTAS</span>
          <strong>
            {classCapacityStats.filter((c) => c.isExact).length} / {classCapacityStats.length}
          </strong>
          <small>
            {classCapacityStats.filter((c) => !c.isExact).length === 0
              ? 'Semua rombel tepat kapasitas'
              : `${classCapacityStats.filter((c) => !c.isExact).length} rombel butuh penyesuaian`}
          </small>
        </div>
      </div>

      {/* Live Issue Context Notice (Calm & Compact) */}
      {liveIssues.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '10px', marginTop: '14px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#854d0e' }}>
            <AlertTriangle size={15} />
            <span>Terdeteksi <strong>{criticalIssues.length} isu kritis</strong> dan <strong>{warningIssues.length} peringatan</strong> alokasi JP.</span>
          </div>
          <button
            type="button"
            className="button button-quiet"
            style={{ height: '28px', fontSize: '11.5px' }}
            onClick={() => setOnlyIssuesFilter(!onlyIssuesFilter)}
          >
            {onlyIssuesFilter ? 'Tampilkan Semua Alokasi' : 'Saring Hanya Isu'}
          </button>
        </div>
      )}

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

        <div className="class-selector-wrap" style={{ minWidth: '160px' }}>
          <div className="select-with-icon">
            <GraduationCap size={14} />
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', fontWeight: 600, color: '#16483f' }}
            >
              <option value="ALL">Semua Rombel ({classCapacityStats.length})</option>
              {classCapacityStats.map((c) => (
                <option key={c.cls.id} value={c.cls.id}>
                  Kelas {c.cls.name} ({c.allocatedJP}/{totalWeeklySlots} JP)
                </option>
              ))}
            </select>
          </div>
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
              (reqPageSize === 0 ? filteredRequirements : filteredRequirements.slice((reqPage - 1) * reqPageSize, reqPage * reqPageSize)).map((r) => {
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
        <TablePagination
          totalItems={filteredRequirements.length}
          page={reqPage}
          pageSize={reqPageSize}
          onPageChange={setReqPage}
          onPageSizeChange={setReqPageSize}
        />
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

      {/* Real-Time Compliance & Audit KPI Grid */}
      <div className="validation-summary-grid">
        <div>
          <div className="validation-summary-icon teal">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span>SKOR KEPATUHAN</span>
            <strong>
              {Math.max(0, Math.min(100, 100 - hardErrors.length * 25 - (combined.length - hardErrors.length) * 5))}%
            </strong>
            <small>{hardErrors.length === 0 ? 'Lolos Semua Aturan' : `${hardErrors.length} Pelanggaran Wajib`}</small>
          </div>
        </div>

        <div>
          <div className="validation-summary-icon error">
            <XCircle size={20} />
          </div>
          <div>
            <span>KONFLIK KERAS</span>
            <strong style={{ color: hardErrors.length > 0 ? '#b42318' : '#1f6850' }}>{hardErrors.length}</strong>
            <small>{hardErrors.length === 0 ? 'Nihil Bentrok' : 'Wajib Diselesaikan'}</small>
          </div>
        </div>

        <div>
          <div className="validation-summary-icon warning">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span>PERINGATAN LEMAH</span>
            <strong style={{ color: combined.length - hardErrors.length > 0 ? '#876123' : '#1f6850' }}>
              {combined.length - hardErrors.length}
            </strong>
            <small>Saran Distribusi &amp; Beban</small>
          </div>
        </div>

        <div>
          <div className="validation-summary-icon info">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>STATUS KELAYAKAN</span>
            <strong style={{ color: hardErrors.length === 0 ? '#1f6850' : '#b42318' }}>
              {hardErrors.length === 0 ? 'SIAP TERBIT' : 'DITAHAN'}
            </strong>
            <small>{hardErrors.length === 0 ? 'Jadwal Siap Edar' : 'Selesaikan Konflik'}</small>
          </div>
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

      {combined.length === 0 ? (
        <div className="surface-card" style={{ marginTop: '16px', padding: '32px 24px', textAlign: 'center', background: '#f5faf7', border: '1.5px solid #d1fae5' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#d1fae5', color: '#065f46', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
            <CheckCircle2 size={26} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '17px', color: '#065f46', fontWeight: 800 }}>
            Audit Kepatuhan: 100% Bebas Bentrok
          </h3>
          <p style={{ margin: '0 0 16px', color: '#16483f', fontSize: '13px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
            Seluruh jadwal KBM, kuota mingguan rombel, batas beban guru, dan slot khusus (Upacara/Religi/Istirahat) telah diverifikasi secara deterministik tanpa konflik.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {onNavigate && (
              <Button onClick={() => onNavigate('schedule')} icon={CalendarDays}>
                Buka Matriks Jadwal
              </Button>
            )}
          </div>
        </div>
      ) : (
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
      )}
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
        title="Riwayat Versi &amp; Cadangan Data"
        description="Snapshot jadwal resmi dan pencadangan data madrasah tersimpan secara lokal. Anda dapat memulihkan versi sebelumnya kapan saja."
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
