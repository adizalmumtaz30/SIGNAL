export const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] as const;
export type Day = (typeof DAYS)[number];
export type SlotKind = 'TEACHING' | 'BREAK';

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

export interface TimeSlot {
  id: string;
  day: Day;
  order: number;
  kind: SlotKind;
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
  maxDailyJP: number;
  teachingPeriodsPerDay: number;
  activeDays: Day[];
  breakAfterJP: number[];
  searchLimit: number;
  geminiEnabled: boolean;
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
}

export interface GenerateResult {
  status: GeneratorStatus;
  candidate?: ScheduleCandidate;
  nodes: number;
  message: string;
}
