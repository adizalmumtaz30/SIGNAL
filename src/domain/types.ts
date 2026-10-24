export const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
export type Day = (typeof DAYS)[number];
export type SlotKind = 'TEACHING' | 'BREAK';
export type ActivityType = 'KBM' | 'UPACARA' | 'ISTIRAHAT' | 'RELIGI' | 'LAINNYA';

export interface SchoolClass {
  id: string;
  name: string;
  level: string;
  isActive: boolean;
}

export interface Teacher {
  id: string;
  code: string;
  name: string;
  subjectIds: string[];
  maxWeeklyJP: number;
  isActive: boolean;
  roleTitle?: string; // Jabatan guru (isi manual, misal: Waka Kurikulum, Guru Mapel, Guru BK, dll)
  nip?: string; // NIP / NPK / NUPTK
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface Requirement {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  requiredJP: number;
}

export interface PeriodDefinition {
  order: number;
  start: string;
  end: string;
  activityType: ActivityType;
  activityName?: string;
  applicableDays?: Day[];
}

export interface TimeSlot {
  id: string;
  day: Day;
  order: number;
  kind: SlotKind;
  activityType?: ActivityType;
  activityName?: string;
  jpNo?: number;
  label: string;
  start: string;
  end: string;
  active: boolean;
}

export interface ScheduleEntry {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  day: Day;
  jpNo: number;
}

export type GeneratorStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'INFEASIBLE'
  | 'SEARCH_LIMIT_REACHED'
  | 'INVALID_INPUT'
  | 'CANCELLED'
  | 'FAILED';

export interface ValidationIssue {
  id: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  context?: string;
  action?: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  hardErrorCount: number;
  warningCount: number;
}

export interface ScheduleCandidate {
  id: string;
  createdAt: string;
  seed: number;
  entries: ScheduleEntry[];
  report: ValidationReport;
  score: number;
  label: string;
  searchNodes: number;
}

export interface ScheduleVersion {
  id: string;
  version: number;
  createdAt: string;
  label: string;
  entryCount: number;
  entries: ScheduleEntry[];
  fingerprint: string;
  validatorVersion: string;
}

export interface AppSettings {
  schoolName: string;
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  periodMinutes: number; // e.g. 40 minutes per JP
  maxDailyJP: number;
  teachingPeriodsPerDay: number;
  activeDays: Day[];
  breakAfterJP: number[];
  periodDefinitions?: PeriodDefinition[];
  searchLimit: number;
  geminiEnabled: boolean;

  // Identitas Madrasah Lengkap & Terintegrasi Dokumen Resmi:
  ministry?: string; // Kementerian yang menaungi (e.g. "KEMENTERIAN AGAMA REPUBLIK INDONESIA")
  regionalOffice?: string; // Kantor Wilayah / Kankemenag Kab/Kota
  address?: string; // Alamat lengkap jalan & nomor
  city?: string; // Kabupaten / Kota
  postalCode?: string; // Kode Pos
  npsn?: string; // Nomor Pokok Sekolah Nasional (8 digit)
  nsm?: string; // Nomor Statistik Madrasah (12 digit)
  phone?: string; // No yang bisa dihubungi / WhatsApp / Telepon
  email?: string; // Email resmi madrasah
  website?: string; // Situs web resmi madrasah
  logoUrl?: string; // Data URL logo resmi madrasah (PNG base64)
  headmasterName?: string; // Nama Kepala Madrasah
  headmasterNip?: string; // NIP / NPK Kepala Madrasah
  headmasterTitle?: string; // Jabatan Kepala Madrasah (default: "Kepala Madrasah")
  curriculumLeaderName?: string; // Nama Waka Kurikulum / Koordinator
  curriculumLeaderNip?: string; // NIP Waka Kurikulum
  curriculumLeaderTitle?: string; // Jabatan Koordinator (default: "Waka Bidang Kurikulum")
}

export type AttendanceStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA' | 'DINAS_LUAR';

export interface AttendanceRecord {
  id: string;
  date: string; // 'YYYY-MM-DD'
  teacherId: string;
  status: AttendanceStatus;
  notes?: string;
  recordedAt: string;
}

export interface Holiday {
  id: string;
  date: string; // 'YYYY-MM-DD'
  name: string;
  isRecurringYearly?: boolean;
}

export interface AppState {
  schemaVersion: number;
  dataMode: 'demo' | 'custom';
  settings: AppSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  requirements: Requirement[];
  slots: TimeSlot[];
  draft: ScheduleEntry[] | null;
  activeSchedule: ScheduleEntry[] | null;
  candidates: ScheduleCandidate[];
  history: ScheduleVersion[];
  lastBackupAt: string | null;
  attendance?: AttendanceRecord[];
  holidays?: Holiday[];
}

export interface GenerateResult {
  status: GeneratorStatus;
  candidate?: ScheduleCandidate;
  nodes: number;
  message: string;
}
