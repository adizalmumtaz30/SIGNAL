import type { AppState, Day, ScheduleEntry, ValidationIssue, ValidationReport } from './types';
import { DAYS } from './types';
import { segmentsFromBreaks, teachingPeriodsForDay } from './time';

function stableIssueId(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

const makeIssue = (
  code: string,
  severity: ValidationIssue['severity'],
  title: string,
  message: string,
  context?: string,
  action?: string,
): ValidationIssue => ({
  id: `${code}-${stableIssueId([code, severity, title, message, context ?? '', action ?? ''].join('|'))}`,
  code, severity, title, message, context, action,
});

export interface ValidateOptions {
  strictCoverage?: boolean;
  includeSoftWarnings?: boolean;
}

export function validateSchedule(state: AppState, entries: ScheduleEntry[], options: ValidateOptions = {}): ValidationReport {
  const strictCoverage = options.strictCoverage ?? true;
  const includeSoftWarnings = options.includeSoftWarnings ?? true;
  const issues: ValidationIssue[] = [];
  const activeClasses = new Set(state.classes.filter((item) => item.isActive).map((item) => item.id));
  const activeTeachers = new Map(state.teachers.filter((item) => item.isActive).map((item) => [item.id, item]));
  const activeSubjects = new Map(state.subjects.filter((item) => item.isActive).map((item) => [item.id, item]));
  const periodsByDay = new Map<Day, Set<number>>();
  for (const day of state.settings.activeDays) {
    periodsByDay.set(day, new Set(teachingPeriodsForDay(state.slots, day)));
  }

  const classSlot = new Map<string, ScheduleEntry>();
  const teacherSlot = new Map<string, ScheduleEntry>();
  const subjectTeacherCounts = new Map<string, number>();
  const subjectClassCounts = new Map<string, number>();
  const teacherWeeklyCounts = new Map<string, number>();
  const entriesByClassDay = new Map<string, ScheduleEntry[]>();

  for (const entry of entries) {
    const schoolClass = state.classes.find((item) => item.id === entry.classId);
    const teacher = activeTeachers.get(entry.teacherId);
    const subject = activeSubjects.get(entry.subjectId);
    if (!schoolClass || !activeClasses.has(entry.classId)) {
      issues.push(makeIssue('HC-UNKNOWN-CLASS', 'error', 'Kelas tidak tersedia', 'Ada penempatan yang merujuk kelas yang tidak ada atau nonaktif.', `${entry.day} · JP ${entry.jpNo}`, 'Periksa data kelas dan hapus penempatan yatim.'));
      continue;
    }
    if (!teacher) {
      issues.push(makeIssue('HC-UNKNOWN-TEACHER', 'error', 'Guru tidak tersedia', 'Ada penempatan yang merujuk guru yang tidak ada atau nonaktif.', `${schoolClass.name} · ${entry.day} · JP ${entry.jpNo}`, 'Pilih guru aktif lalu validasi ulang.'));
      continue;
    }
    if (!subject) {
      issues.push(makeIssue('HC-UNKNOWN-SUBJECT', 'error', 'Mata pelajaran tidak tersedia', 'Ada penempatan yang merujuk mapel yang tidak ada atau nonaktif.', `${schoolClass.name} · ${entry.day} · JP ${entry.jpNo}`, 'Pilih mapel aktif lalu validasi ulang.'));
      continue;
    }
    if (!state.settings.activeDays.includes(entry.day) || !periodsByDay.get(entry.day)?.has(entry.jpNo)) {
      issues.push(makeIssue('HC-INVALID-SLOT', 'error', 'Slot di luar struktur KBM', `JP ${entry.jpNo} tidak aktif pada ${entry.day}.`, `${schoolClass.name} · ${subject.name}`, 'Pindahkan pelajaran ke slot KBM aktif.'));
      continue;
    }
    if (entry.jpNo > state.settings.maxDailyJP) {
      issues.push(makeIssue('HC-DAILY-LIMIT', 'error', 'Batas JP harian terlampaui', `Penempatan berada pada JP ${entry.jpNo}, di atas batas ${state.settings.maxDailyJP} JP/hari.`, `${schoolClass.name} · ${entry.day}`, 'Ubah struktur atau atur ulang pelajaran.'));
    }
    if (!teacher.subjectIds.includes(entry.subjectId)) {
      issues.push(makeIssue('HC-TEACHER-QUALIFICATION', 'error', 'Kualifikasi guru tidak sesuai', `${teacher.name} belum memiliki kualifikasi untuk ${subject.name}.`, `${schoolClass.name} · ${entry.day} · JP ${entry.jpNo}`, 'Perbaiki alokasi atau data kualifikasi guru.'));
    }

    const slotKey = `${entry.classId}|${entry.day}|${entry.jpNo}`;
    if (classSlot.has(slotKey)) {
      const other = classSlot.get(slotKey)!;
      issues.push(makeIssue('HC-CLASS-COLLISION', 'error', 'Kelas mendapat dua pelajaran', `Pada JP yang sama, kelas ${schoolClass.name} memiliki lebih dari satu penempatan.`, `${entry.day} · JP ${entry.jpNo} · ${other.subjectId} / ${entry.subjectId}`, 'Sisakan satu pelajaran untuk slot tersebut.'));
    } else classSlot.set(slotKey, entry);

    const teacherKey = `${entry.teacherId}|${entry.day}|${entry.jpNo}`;
    if (teacherSlot.has(teacherKey)) {
      const other = teacherSlot.get(teacherKey)!;
      const otherClass = state.classes.find((item) => item.id === other.classId)?.name ?? other.classId;
      issues.push(makeIssue('HC-TEACHER-COLLISION', 'error', 'Guru bentrok', `${teacher.name} ditempatkan di dua kelas pada waktu yang sama.`, `${entry.day} · JP ${entry.jpNo} · ${otherClass} dan ${schoolClass.name}`, 'Pindahkan salah satu penempatan ke slot lain.'));
    } else teacherSlot.set(teacherKey, entry);

    const cstKey = `${entry.classId}|${entry.subjectId}|${entry.teacherId}`;
    subjectTeacherCounts.set(cstKey, (subjectTeacherCounts.get(cstKey) ?? 0) + 1);
    const csKey = `${entry.classId}|${entry.subjectId}`;
    subjectClassCounts.set(csKey, (subjectClassCounts.get(csKey) ?? 0) + 1);
    teacherWeeklyCounts.set(entry.teacherId, (teacherWeeklyCounts.get(entry.teacherId) ?? 0) + 1);
    const dayKey = `${entry.classId}|${entry.day}`;
    const dayEntries = entriesByClassDay.get(dayKey) ?? [];
    dayEntries.push(entry);
    entriesByClassDay.set(dayKey, dayEntries);
  }

  for (const [teacherId, count] of teacherWeeklyCounts) {
    const teacher = activeTeachers.get(teacherId);
    if (teacher && count > teacher.maxWeeklyJP) {
      issues.push(makeIssue('HC-TEACHER-WEEKLY-LIMIT', 'error', 'Beban guru melebihi batas', `${teacher.name} mendapat ${count} JP, sedangkan batas mingguan ${teacher.maxWeeklyJP} JP.`, 'Beban seluruh mapel dijumlahkan per guru.', 'Kurangi atau distribusikan alokasi JP.'));
    }
  }

  const maxPeriods = Math.max(0, ...state.settings.activeDays.map((day) => Math.max(0, ...[...(periodsByDay.get(day) ?? [])])));
  const segments = segmentsFromBreaks(maxPeriods, state.settings.breakAfterJP);
  for (const [key, dayEntries] of entriesByClassDay) {
    const [classId, day] = key.split('|') as [string, Day];
    const schoolClass = state.classes.find((item) => item.id === classId);
    const entryAtJP = new Map(dayEntries.map((entry) => [entry.jpNo, entry]));
    const sequence: Array<ScheduleEntry | undefined> = [];
    for (let jp = 1; jp <= maxPeriods; jp++) sequence.push(entryAtJP.get(jp));

    // Hard rule: only one run of exactly three or more consecutive JP of a subject per class/day.
    const tripleRuns: Array<{ subjectId: string; start: number; end: number }> = [];
    let cursor = 0;
    while (cursor < sequence.length) {
      const current = sequence[cursor];
      if (!current) { cursor += 1; continue; }
      let end = cursor;
      while (end + 1 < sequence.length && sequence[end + 1]?.subjectId === current.subjectId) end += 1;
      const runLength = end - cursor + 1;
      if (runLength >= 3) tripleRuns.push({ subjectId: current.subjectId, start: cursor + 1, end: end + 1 });
      cursor = end + 1;
    }
    const seenRuns = new Set<string>();
    for (const run of tripleRuns) {
      const subject = activeSubjects.get(run.subjectId);
      if (run.end - run.start + 1 > 3) {
        issues.push(makeIssue('HC-SUBJECT-BLOCK-OVERFLOW', 'error', 'Blok mata pelajaran terlalu panjang', `${subject?.name ?? 'Mapel'} berlangsung ${run.end - run.start + 1} JP berturut-turut di ${schoolClass?.name ?? classId}.`, `${day} · JP ${run.start}–${run.end}`, 'Pecah rangkaian menjadi blok yang lebih pendek.'));
      }
      const keyRun = `${run.subjectId}|${run.start}|${run.end}`;
      if (!seenRuns.has(keyRun)) seenRuns.add(keyRun);
    }
    if (tripleRuns.length > 1) {
      issues.push(makeIssue('HC-THREE-JP-BLOCK-LIMIT', 'error', 'Batas blok 3 JP terlampaui', `${schoolClass?.name ?? classId} memiliki lebih dari satu blok mapel 3 JP berturut-turut pada hari ${day}.`, tripleRuns.map((run) => `${activeSubjects.get(run.subjectId)?.name ?? run.subjectId} JP ${run.start}–${run.end}`).join('; '), 'Pertahankan maksimal satu blok tiga JP per kelas per hari.'));
    }

    if (includeSoftWarnings) {
      const hasDouble = sequence.some((entry, index) => !!entry && !!sequence[index + 1] && entry.subjectId === sequence[index + 1]?.subjectId);
      if (dayEntries.length > 0 && !hasDouble) {
        issues.push(makeIssue('SC-NO-DOUBLE-BLOCK', 'warning', 'Preferensi blok 2 JP belum terpenuhi', `${schoolClass?.name ?? classId} belum memiliki pasangan 2 JP mapel yang berurutan pada ${day}.`, undefined, 'Bila memungkinkan, gabungkan dua JP mapel yang sama tanpa melanggar hard constraint.'));
      }
    }
  }

  // Multisubject-teacher sequence around breaks; breaks are not counted as JP.
  const activeTeachersList = [...activeTeachers.values()];
  for (const schoolClass of state.classes.filter((item) => item.isActive)) {
    for (const day of state.settings.activeDays) {
      const byJP = new Map<number, ScheduleEntry>();
      for (const entry of entries) if (entry.classId === schoolClass.id && entry.day === day) byJP.set(entry.jpNo, entry);
      for (let segmentIndex = 0; segmentIndex < segments.length - 1; segmentIndex++) {
        const before = segments[segmentIndex];
        const after = segments[segmentIndex + 1];
        if (!before?.length || !after?.length) continue;
        const beforeEnd = before[before.length - 1];
        const afterStart = after[0];
        const endEntry = byJP.get(beforeEnd);
        if (!endEntry) continue;
        const teacher = activeTeachersList.find((item) => item.id === endEntry.teacherId);
        if (!teacher || teacher.subjectIds.length <= 1) continue;
        let runBefore = 0;
        for (let jp = beforeEnd; jp >= before[0]; jp--) {
          if (byJP.get(jp)?.teacherId !== teacher.id) break;
          runBefore += 1;
        }
        if (runBefore < 1 || runBefore > 3) continue;
        let runAfter = 0;
        for (let jp = afterStart; jp <= after[after.length - 1]; jp++) {
          if (byJP.get(jp)?.teacherId !== teacher.id) break;
          runAfter += 1;
        }
        const maxAfter = ({ 1: 3, 2: 2, 3: 1 } as Record<number, number>)[runBefore];
        if (runAfter > maxAfter) {
          issues.push(makeIssue('HC-MULTISUBJECT-POST-BREAK', 'error', 'Aturan guru multimapel setelah istirahat', `${teacher.name} mengajar ${runBefore} JP berturut-turut sebelum istirahat dan ${runAfter} JP setelahnya; batas setelah istirahat adalah ${maxAfter} JP.`, `${schoolClass.name} · ${day} · jeda setelah JP ${beforeEnd}`, 'Ubah susunan pelajaran pada sisi sebelum atau sesudah istirahat.'));
        }
      }
    }
  }

  // Requirement matching. For draft editing, gaps are warnings; strict validation blocks publish.
  const expectedKeys = new Set<string>();
  for (const requirement of state.requirements) {
    const key = `${requirement.classId}|${requirement.subjectId}|${requirement.teacherId}`;
    expectedKeys.add(key);
    const expected = requirement.requiredJP;
    const actual = subjectTeacherCounts.get(key) ?? 0;
    if (actual !== expected) {
      const severity = strictCoverage ? 'error' : 'warning';
      issues.push(makeIssue('HC-REQUIREMENT-COVERAGE', severity, actual < expected ? 'Alokasi JP belum terpenuhi' : 'Alokasi JP berlebih', `${state.classes.find((item) => item.id === requirement.classId)?.name ?? requirement.classId} · ${state.subjects.find((item) => item.id === requirement.subjectId)?.name ?? requirement.subjectId}: ${actual} dari ${expected} JP dialokasikan kepada guru ini.`, undefined, 'Sesuaikan generator, kebutuhan JP, atau alokasi guru.'));
    }
  }
  for (const [key, actual] of subjectTeacherCounts) {
    if (!expectedKeys.has(key) && actual > 0) {
      issues.push(makeIssue('HC-UNALLOCATED-ENTRY', 'error', 'Penempatan tanpa alokasi', 'Jadwal memuat penempatan guru-mapel yang tidak tercatat dalam alokasi kebutuhan JP.', key.replaceAll('|', ' · '), 'Tambahkan alokasi yang benar atau hapus penempatan tersebut.'));
    }
  }

  // Each class-subject total is checked too, guarding accidental duplicate split allocations.
  for (const requirement of state.requirements) {
    const key = `${requirement.classId}|${requirement.subjectId}`;
    const expected = state.requirements.filter((item) => item.classId === requirement.classId && item.subjectId === requirement.subjectId).reduce((sum, item) => sum + item.requiredJP, 0);
    const actual = subjectClassCounts.get(key) ?? 0;
    if (strictCoverage && actual !== expected && !issues.some((item) => item.code === 'HC-REQUIREMENT-COVERAGE' && item.context === key)) {
      issues.push(makeIssue('HC-SUBJECT-COVERAGE', 'error', 'Kebutuhan mapel belum terpenuhi', `${state.classes.find((item) => item.id === requirement.classId)?.name ?? requirement.classId} · ${state.subjects.find((item) => item.id === requirement.subjectId)?.name ?? requirement.subjectId}: ${actual} dari ${expected} JP.`, undefined, 'Lengkapi alokasi JP mata pelajaran ini.'));
    }
  }

  const hardErrorCount = issues.filter((item) => item.severity === 'error').length;
  const warningCount = issues.filter((item) => item.severity === 'warning').length;
  return { valid: hardErrorCount === 0, issues, hardErrorCount, warningCount };
}

export function validateMasterData(state: AppState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const activeClasses = state.classes.filter((item) => item.isActive);
  if (activeClasses.length > 10) issues.push(makeIssue('DATA-CLASS-LIMIT', 'error', 'Batas kelas terlampaui', `Ada ${activeClasses.length} kelas aktif; lingkup rilis awal maksimal 10 kelas.`));
  if (!activeClasses.length) issues.push(makeIssue('DATA-NO-CLASSES', 'error', 'Belum ada kelas aktif', 'Tambahkan setidaknya satu kelas aktif sebelum membuat jadwal.'));
  if (!state.settings.activeDays.length) issues.push(makeIssue('DATA-NO-DAYS', 'error', 'Belum ada hari aktif', 'Pilih minimal satu hari KBM.'));
  const totalSlots = state.settings.activeDays.reduce((sum, day) => sum + teachingPeriodsForDay(state.slots, day).length, 0);
  for (const schoolClass of activeClasses) {
    const weeklyDemand = state.requirements.filter((item) => item.classId === schoolClass.id).reduce((sum, item) => sum + item.requiredJP, 0);
    if (weeklyDemand > totalSlots) issues.push(makeIssue('DATA-CLASS-DEMAND-CAPACITY', 'error', 'Kebutuhan JP melebihi kapasitas', `${schoolClass.name} membutuhkan ${weeklyDemand} JP, tetapi kapasitas mingguan hanya ${totalSlots} slot.`));
    if (weeklyDemand === 0) issues.push(makeIssue('DATA-CLASS-NO-DEMAND', 'warning', `${schoolClass.name} belum memiliki kebutuhan JP`, 'Tambahkan kebutuhan JP per mata pelajaran sebelum membuat jadwal.'));
  }
  const teachers = new Map(state.teachers.filter((item) => item.isActive).map((item) => [item.id, item]));
  for (const requirement of state.requirements) {
    const teacher = teachers.get(requirement.teacherId);
    const subject = state.subjects.find((item) => item.id === requirement.subjectId && item.isActive);
    const schoolClass = state.classes.find((item) => item.id === requirement.classId && item.isActive);
    if (!teacher || !subject || !schoolClass) {
      issues.push(makeIssue('DATA-INVALID-REQUIREMENT-REFERENCE', 'error', 'Referensi alokasi tidak valid', 'Satu kebutuhan JP merujuk kelas, guru, atau mapel yang tidak aktif/tersedia.', requirement.id));
    } else if (!teacher.subjectIds.includes(subject.id)) {
      issues.push(makeIssue('DATA-UNQUALIFIED-ALLOCATION', 'error', 'Guru tidak berkualifikasi', `${teacher.name} dialokasikan ke ${subject.name}, tetapi kualifikasi belum dicatat.`, schoolClass.name));
    }
    if (!Number.isInteger(requirement.requiredJP) || requirement.requiredJP < 1) {
      issues.push(makeIssue('DATA-INVALID-JP', 'error', 'Alokasi JP tidak valid', 'Jumlah JP harus bilangan bulat minimal 1.', requirement.id));
    }
  }
  const expectedWeeklyLoad = new Map<string, number>();
  for (const requirement of state.requirements) expectedWeeklyLoad.set(requirement.teacherId, (expectedWeeklyLoad.get(requirement.teacherId) ?? 0) + requirement.requiredJP);
  for (const [teacherId, load] of expectedWeeklyLoad) {
    const teacher = teachers.get(teacherId);
    if (teacher && load > teacher.maxWeeklyJP) issues.push(makeIssue('DATA-TEACHER-LOAD-OVER', 'error', 'Beban alokasi guru terlalu tinggi', `${teacher.name} dialokasikan ${load} JP/minggu; batas yang ditetapkan ${teacher.maxWeeklyJP} JP.`, 'Akumulasi mencakup seluruh mapel yang diajarkan.'));
  }
  return issues;
}

export function scoreSchedule(state: AppState, entries: ScheduleEntry[]): number {
  let score = 1000;
  const byClassDay = new Map<string, ScheduleEntry[]>();
  const activePeriodsByDay = new Map(state.settings.activeDays.map((day) => [day, teachingPeriodsForDay(state.slots, day)]));
  for (const entry of entries) {
    const key = `${entry.classId}|${entry.day}`;
    const arr = byClassDay.get(key) ?? [];
    arr.push(entry);
    byClassDay.set(key, arr);
  }
  for (const [key, list] of byClassDay) {
    const day = key.split('|')[1] as Day;
    const periods = activePeriodsByDay.get(day) ?? [];
    const byJP = new Map(list.map((entry) => [entry.jpNo, entry]));
    for (const jp of periods) {
      const current = byJP.get(jp);
      const next = byJP.get(jp + 1);
      if (periods.includes(jp + 1) && current && next && current.subjectId === next.subjectId) score += 4; // gentle reward for a 2-JP block
    }
    const dayCounts = new Map<string, number>();
    for (const entry of list) dayCounts.set(entry.subjectId, (dayCounts.get(entry.subjectId) ?? 0) + 1);
    const max = Math.max(0, ...dayCounts.values());
    score -= Math.max(0, max - 2) * 2;
    const free = Math.max(0, periods.length - list.length);
    score -= free * 0.5;
  }
  return Math.round(score);
}

export function buildScheduleFingerprint(entries: ScheduleEntry[]): string {
  const canonical = [...entries]
    .map(({ classId, subjectId, teacherId, day, jpNo }) => `${classId}:${day}:${jpNo}:${subjectId}:${teacherId}`)
    .sort()
    .join('|');
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function dayDisplay(day: string): string {
  return DAYS.includes(day as Day) ? day : day;
}
