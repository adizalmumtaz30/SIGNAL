import type { AppState, Requirement, Subject, Teacher, SchoolClass } from './types';
import { buildTimeSlots } from './time';

export function createDemoState(): AppState {
  const settings: AppState['settings'] = {
    schoolName: 'MTs Cendekia Nusantara',
    academicYear: '2026/2027',
    semester: 'Ganjil' as const,
    maxDailyJP: 10,
    teachingPeriodsPerDay: 8,
    activeDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
    breakAfterJP: [2, 5],
    searchLimit: 65000,
    geminiEnabled: false,
  };
  const classes: SchoolClass[] = [
    { id: 'CLS-7A', name: 'VII-A', level: 'VII', isActive: true },
    { id: 'CLS-7B', name: 'VII-B', level: 'VII', isActive: true },
    { id: 'CLS-8A', name: 'VIII-A', level: 'VIII', isActive: true },
    { id: 'CLS-8B', name: 'VIII-B', level: 'VIII', isActive: true },
  ];
  const subjects: Subject[] = [
    { id: 'SUB-MAT', code: 'MAT', name: 'Matematika', color: '#2f7771', isActive: true },
    { id: 'SUB-IND', code: 'BIN', name: 'Bahasa Indonesia', color: '#b9854d', isActive: true },
    { id: 'SUB-IPA', code: 'IPA', name: 'Ilmu Pengetahuan Alam', color: '#668fbc', isActive: true },
    { id: 'SUB-IPS', code: 'IPS', name: 'Ilmu Pengetahuan Sosial', color: '#a07bb0', isActive: true },
    { id: 'SUB-ENG', code: 'BIG', name: 'Bahasa Inggris', color: '#ba726e', isActive: true },
    { id: 'SUB-PJOK', code: 'PJK', name: 'PJOK', color: '#8b9b4d', isActive: true },
    { id: 'SUB-PAI', code: 'PAI', name: 'Pendidikan Agama Islam', color: '#be9b45', isActive: true },
    { id: 'SUB-QUR', code: 'QUR', name: 'Tahfiz & Al-Qur’an', color: '#5c9c8f', isActive: true },
    { id: 'SUB-PPK', code: 'PPK', name: 'Pendidikan Pancasila', color: '#8b7f71', isActive: true },
    { id: 'SUB-SEN', code: 'SEN', name: 'Seni Budaya', color: '#ce8e6f', isActive: true },
  ];
  const teachers: Teacher[] = [
    { id: 'TCH-001', code: 'T-01', name: 'Ahmad Fauzi, S.Pd.', subjectIds: ['SUB-MAT'], maxWeeklyJP: 24, isActive: true },
    { id: 'TCH-002', code: 'T-02', name: 'Siti Rahmah, S.Pd.', subjectIds: ['SUB-IND'], maxWeeklyJP: 24, isActive: true },
    { id: 'TCH-003', code: 'T-03', name: 'Budi Santoso, S.Pd.', subjectIds: ['SUB-IPA'], maxWeeklyJP: 24, isActive: true },
    { id: 'TCH-004', code: 'T-04', name: 'Nur Aini, S.Pd.', subjectIds: ['SUB-IPS'], maxWeeklyJP: 24, isActive: true },
    { id: 'TCH-005', code: 'T-05', name: 'Rahma Fitri, S.Pd.', subjectIds: ['SUB-ENG'], maxWeeklyJP: 24, isActive: true },
    { id: 'TCH-006', code: 'T-06', name: 'Ridwan Hadi, S.Pd.', subjectIds: ['SUB-PJOK'], maxWeeklyJP: 24, isActive: true },
    { id: 'TCH-007', code: 'T-07', name: 'Aisyah Khairunnisa, S.Pd.I.', subjectIds: ['SUB-PAI', 'SUB-QUR'], maxWeeklyJP: 24, isActive: true },
    { id: 'TCH-008', code: 'T-08', name: 'Yusuf Maulana, S.Pd.', subjectIds: ['SUB-PPK'], maxWeeklyJP: 24, isActive: true },
    { id: 'TCH-009', code: 'T-09', name: 'Dewi Anggraini, S.Sn.', subjectIds: ['SUB-SEN'], maxWeeklyJP: 24, isActive: true },
  ];
  const hoursBySubject: Record<string, number> = {
    'SUB-MAT': 5, 'SUB-IND': 5, 'SUB-IPA': 5, 'SUB-IPS': 4, 'SUB-ENG': 4,
    'SUB-PJOK': 3, 'SUB-PAI': 3, 'SUB-QUR': 2, 'SUB-PPK': 4, 'SUB-SEN': 5,
  };
  const teacherBySubject: Record<string, string> = Object.fromEntries(
    teachers.flatMap((teacher) => teacher.subjectIds.map((subjectId) => [subjectId, teacher.id])),
  );
  const requirements: Requirement[] = [];
  for (const schoolClass of classes) {
    for (const subject of subjects) {
      requirements.push({
        id: `${schoolClass.id}-${subject.id}`,
        classId: schoolClass.id,
        subjectId: subject.id,
        teacherId: teacherBySubject[subject.id],
        requiredJP: hoursBySubject[subject.id],
      });
    }
  }
  return {
    schemaVersion: 1,
    dataMode: 'demo',
    settings: { ...settings, activeDays: [...settings.activeDays] },
    classes, teachers, subjects, requirements,
    slots: buildTimeSlots(settings),
    draft: null,
    activeSchedule: null,
    candidates: [],
    history: [],
    lastBackupAt: null,
  };
}

export function createEmptyState(): AppState {
  const state = createDemoState();
  return {
    ...state,
    dataMode: 'custom',
    classes: [], teachers: [], subjects: [], requirements: [],
    draft: null, activeSchedule: null, candidates: [], history: [],
  };
}
