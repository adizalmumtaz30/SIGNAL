import type { AppState, GenerateResult, Requirement, ScheduleCandidate, ScheduleEntry } from './types';
import { validateMasterData, validateSchedule, scoreSchedule } from './validator';
import { teachingPeriodsForDay } from './time';

interface Demand {
  requirement: Requirement;
  remaining: number;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function entryId(seed: number, index: number, reqId: string, day: string, jpNo: number): string {
  return `${seed.toString(36)}-${index.toString(36)}-${reqId}-${day}-${jpNo}`;
}

function cloneEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

export function generateSchedule(state: AppState, seed = Date.now() >>> 0, overrideLimit?: number): GenerateResult {
  const masterIssues = validateMasterData(state);
  const masterErrors = masterIssues.filter((item) => item.severity === 'error');
  if (masterErrors.length) {
    return {
      status: 'INVALID_INPUT', nodes: 0,
      message: `Data master belum siap: ${masterErrors[0].title}. Perbaiki ${masterErrors.length} masalah sebelum membuat jadwal.`,
    };
  }
  const activeDays = state.settings.activeDays;
  const slotDomain: Array<{ day: (typeof activeDays)[number]; jpNo: number }> = [];
  for (const day of activeDays) {
    const periods = teachingPeriodsForDay(state.slots, day);
    for (const jpNo of periods) if (jpNo <= state.settings.maxDailyJP) slotDomain.push({ day, jpNo });
  }
  if (!slotDomain.length) return { status: 'INVALID_INPUT', nodes: 0, message: 'Struktur waktu tidak memiliki slot KBM aktif.' };

  const demandRows: Demand[] = state.requirements
    .filter((requirement) => state.classes.some((item) => item.id === requirement.classId && item.isActive))
    .map((requirement) => ({ requirement, remaining: requirement.requiredJP }));
  const totalDemand = demandRows.reduce((sum, item) => sum + item.remaining, 0);
  if (totalDemand === 0) return { status: 'INVALID_INPUT', nodes: 0, message: 'Belum ada kebutuhan JP. Lengkapi alokasi mata pelajaran terlebih dahulu.' };
  for (const schoolClass of state.classes.filter((item) => item.isActive)) {
    const classDemand = demandRows.filter((item) => item.requirement.classId === schoolClass.id).reduce((sum, item) => sum + item.remaining, 0);
    const capacity = slotDomain.length;
    if (classDemand > capacity) return { status: 'INVALID_INPUT', nodes: 0, message: `${schoolClass.name} membutuhkan ${classDemand} JP, melebihi kapasitas ${capacity} slot.` };
  }

  const teacherById = new Map(state.teachers.map((teacher) => [teacher.id, teacher]));
  const subjectById = new Map(state.subjects.map((subject) => [subject.id, subject]));
  const classById = new Map(state.classes.map((schoolClass) => [schoolClass.id, schoolClass]));
  const entries: ScheduleEntry[] = [];
  const classSlotMap = new Map<string, ScheduleEntry>();
  const teacherSlotSet = new Set<string>();
  const entriesByClassDay = new Map<string, ScheduleEntry[]>();
  const teacherLoads = new Map<string, number>();
  let nodes = 0;
  const nodeLimit = Math.max(1500, Math.min(overrideLimit ?? state.settings.searchLimit, 100000));
  let limitHit = false;
  const random = mulberry32(seed);
  const availablePeriodsByDay = new Map(activeDays.map((day) => [day, teachingPeriodsForDay(state.slots, day).filter((jp) => jp <= state.settings.maxDailyJP)]));
  const maxJP = Math.max(0, ...[...availablePeriodsByDay.values()].flat());

  const slotsForRequirement = (requirement: Requirement): Array<{ day: (typeof activeDays)[number]; jpNo: number }> => {
    const result: Array<{ day: (typeof activeDays)[number]; jpNo: number }> = [];
    for (const day of activeDays) {
      for (const jpNo of availablePeriodsByDay.get(day) ?? []) {
        const key = `${requirement.classId}|${day}|${jpNo}`;
        const teacherKey = `${requirement.teacherId}|${day}|${jpNo}`;
        if (classSlotMap.has(key) || teacherSlotSet.has(teacherKey)) continue;
        const schoolClass = classById.get(requirement.classId);
        const subject = subjectById.get(requirement.subjectId);
        const teacher = teacherById.get(requirement.teacherId);
        if (!schoolClass?.isActive || !subject?.isActive || !teacher?.isActive || !teacher.subjectIds.includes(requirement.subjectId)) continue;
        if ((teacherLoads.get(teacher.id) ?? 0) >= teacher.maxWeeklyJP) continue;
        if (wouldViolateBlock(requirement.classId, day, jpNo, requirement.subjectId, entriesByClassDay)) continue;
        result.push({ day, jpNo });
      }
    }
    // Stable enough for reproducibility: use a seed-specific shuffle after a light preference score.
    return result.map((slot) => ({ ...slot, rank: placementRank(requirement, slot.day, slot.jpNo, entriesByClassDay) + random() * 1.8 }))
      .sort((a, b) => b.rank - a.rank).map(({ day, jpNo }) => ({ day, jpNo }));
  };

  const partialRestRuleOkForCompletedSegments = (classId: string, day: string): boolean => {
    const periods = availablePeriodsByDay.get(day as (typeof activeDays)[number]) ?? [];
    const dayRows = entriesByClassDay.get(`${classId}|${day}`) ?? [];
    if (dayRows.length < periods.length) return true;
    const byJP = new Map(dayRows.map((entry) => [entry.jpNo, entry]));
    const boundaries = [...new Set(state.settings.breakAfterJP)].filter((n) => n < maxJP).sort((a, b) => a - b);
    const segments: number[][] = [];
    let start = 1;
    for (const boundary of boundaries) {
      const seg: number[] = [];
      for (let jp = start; jp <= boundary; jp++) if (periods.includes(jp)) seg.push(jp);
      if (seg.length) segments.push(seg);
      start = boundary + 1;
    }
    const last: number[] = [];
    for (let jp = start; jp <= maxJP; jp++) if (periods.includes(jp)) last.push(jp);
    if (last.length) segments.push(last);
    for (let index = 0; index < segments.length - 1; index++) {
      const before = segments[index];
      const after = segments[index + 1];
      if (!before?.length || !after?.length) continue;
      const beforeEnd = before[before.length - 1];
      const afterStart = after[0];
      const lastEntry = byJP.get(beforeEnd);
      if (!lastEntry) continue;
      const teacher = teacherById.get(lastEntry.teacherId);
      if (!teacher || teacher.subjectIds.length <= 1) continue;
      let runBefore = 0;
      for (let jp = beforeEnd; jp >= before[0]; jp--) {
        if (byJP.get(jp)?.teacherId !== teacher.id) break;
        runBefore++;
      }
      let runAfter = 0;
      for (let jp = afterStart; jp <= after[after.length - 1]; jp++) {
        if (byJP.get(jp)?.teacherId !== teacher.id) break;
        runAfter++;
      }
      const maxAfter = ({ 1: 3, 2: 2, 3: 1 } as Record<number, number>)[runBefore] ?? 99;
      if (runAfter > maxAfter) return false;
    }
    return true;
  };

  const wouldViolateBlock = (classId: string, day: string, jpNo: number, subjectId: string, byDay: Map<string, ScheduleEntry[]>): boolean => {
    const existing = byDay.get(`${classId}|${day}`) ?? [];
    const map = new Map(existing.map((entry) => [entry.jpNo, entry.subjectId]));
    map.set(jpNo, subjectId);
    let tripleRuns = 0;
    for (let jp = 1; jp <= maxJP; ) {
      const sid = map.get(jp);
      if (!sid) { jp++; continue; }
      let end = jp;
      while (map.get(end + 1) === sid) end++;
      const length = end - jp + 1;
      if (length > 3) return true;
      if (length === 3) tripleRuns++;
      jp = end + 1;
    }
    return tripleRuns > 1;
  };

  const placementRank = (requirement: Requirement, day: string, jpNo: number, byDay: Map<string, ScheduleEntry[]>): number => {
    const existing = byDay.get(`${requirement.classId}|${day}`) ?? [];
    const before = existing.find((entry) => entry.jpNo === jpNo - 1);
    const after = existing.find((entry) => entry.jpNo === jpNo + 1);
    let rank = 0;
    if (before?.subjectId === requirement.subjectId) rank += 5;
    if (after?.subjectId === requirement.subjectId) rank += 5;
    if (before && before.subjectId !== requirement.subjectId) rank += 0.6;
    const inDay = existing.length;
    if (inDay < 2) rank += 1.5;
    // Slightly balance heavy subjects across the week; random component breaks ties.
    rank -= (jpNo === maxJP ? 0.1 : 0);
    return rank;
  };

  function chooseNextDemand(): { index: number; candidates: Array<{ day: (typeof activeDays)[number]; jpNo: number }> } | null {
    let bestIndex = -1;
    let bestCandidates: Array<{ day: (typeof activeDays)[number]; jpNo: number }> = [];
    let bestDomainSize = Number.POSITIVE_INFINITY;
    let bestPressure = -1;
    for (let index = 0; index < demandRows.length; index++) {
      const demand = demandRows[index];
      if (demand.remaining <= 0) continue;
      const candidates = slotsForRequirement(demand.requirement);
      const pressure = demand.remaining / Math.max(1, candidates.length);
      if (candidates.length < bestDomainSize || (candidates.length === bestDomainSize && pressure > bestPressure)) {
        bestIndex = index;
        bestCandidates = candidates;
        bestDomainSize = candidates.length;
        bestPressure = pressure;
        if (bestDomainSize === 0) break;
      }
    }
    if (bestIndex < 0) return null;
    return { index: bestIndex, candidates: bestCandidates };
  }

  function recurse(): boolean {
    nodes++;
    if (nodes > nodeLimit) { limitHit = true; return false; }
    let remainingTotal = 0;
    for (const row of demandRows) remainingTotal += row.remaining;
    if (remainingTotal === 0) {
      const report = validateSchedule(state, entries, { strictCoverage: true, includeSoftWarnings: false });
      return report.valid;
    }
    const choice = chooseNextDemand();
    if (!choice || !choice.candidates.length) return false;
    const demand = demandRows[choice.index];
    const requirement = demand.requirement;
    for (const slot of choice.candidates) {
      if (limitHit) return false;
      const entry: ScheduleEntry = {
        id: entryId(seed, entries.length, requirement.id, slot.day, slot.jpNo),
        classId: requirement.classId,
        subjectId: requirement.subjectId,
        teacherId: requirement.teacherId,
        day: slot.day,
        jpNo: slot.jpNo,
      };
      const key = `${entry.classId}|${entry.day}|${entry.jpNo}`;
      const tKey = `${entry.teacherId}|${entry.day}|${entry.jpNo}`;
      entries.push(entry);
      classSlotMap.set(key, entry);
      teacherSlotSet.add(tKey);
      const groupKey = `${entry.classId}|${entry.day}`;
      const group = entriesByClassDay.get(groupKey) ?? [];
      group.push(entry);
      entriesByClassDay.set(groupKey, group);
      teacherLoads.set(entry.teacherId, (teacherLoads.get(entry.teacherId) ?? 0) + 1);
      demand.remaining--;

      const dayPeriods = availablePeriodsByDay.get(entry.day) ?? [];
      const dayComplete = group.length >= dayPeriods.length;
      const restRulesOk = !dayComplete || partialRestRuleOkForCompletedSegments(entry.classId, entry.day);
      if (restRulesOk && recurse()) return true;

      demand.remaining++;
      teacherLoads.set(entry.teacherId, (teacherLoads.get(entry.teacherId) ?? 1) - 1);
      if (teacherLoads.get(entry.teacherId) === 0) teacherLoads.delete(entry.teacherId);
      group.pop();
      if (!group.length) entriesByClassDay.delete(groupKey);
      teacherSlotSet.delete(tKey);
      classSlotMap.delete(key);
      entries.pop();
      if (limitHit) return false;
    }
    return false;
  }

  const found = recurse();
  if (!found) {
    const status = limitHit ? 'SEARCH_LIMIT_REACHED' : 'INFEASIBLE';
    return {
      status,
      nodes,
      message: limitHit
        ? `Pencarian mencapai batas ${nodeLimit.toLocaleString('id-ID')} langkah tanpa kandidat terverifikasi. Kurangi kendala, periksa alokasi, atau naikkan batas pencarian.`
        : 'Tidak ditemukan susunan yang memenuhi seluruh hard constraint setelah ruang pencarian selesai diperiksa. Periksa kembali kebutuhan JP dan ketersediaan guru.',
    };
  }

  const finalEntries = cloneEntries(entries);
  const report = validateSchedule(state, finalEntries, { strictCoverage: true, includeSoftWarnings: true });
  if (!report.valid) {
    return { status: 'FAILED', nodes, message: 'Generator menemukan susunan tetapi validasi final menolaknya. Kandidat tidak disimpan sebagai valid.' };
  }
  const candidate: ScheduleCandidate = {
    id: `CAND-${seed.toString(36)}`,
    createdAt: new Date().toISOString(),
    seed,
    entries: finalEntries,
    report,
    score: scoreSchedule(state, finalEntries),
    label: `Kandidat ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
    searchNodes: nodes,
  };
  return { status: 'SUCCESS', candidate, nodes, message: 'Kandidat berhasil dibuat dan lolos validator deterministik.' };
}
