import type { AppSettings, Day, PeriodDefinition, TimeSlot } from './types';
import { DAYS } from './types';

export function toClock(minutes: number): string {
  const normalized = Math.max(0, minutes);
  const hours = Math.floor(normalized / 60) % 24;
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function clockToMinutes(time: string): number {
  const parts = time.split(':').map((p) => Number(p));
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return 0;
  return parts[0] * 60 + parts[1];
}

export function createDefaultPeriodDefinitions(
  teachingPeriods = 8,
  breakAfterJP = [3, 6],
  periodMinutes = 40,
): PeriodDefinition[] {
  const definitions: PeriodDefinition[] = [];
  let order = 1;
  let cursor = 7 * 60; // 07:00

  // 1. Agenda Pagi Jam Pertama (Non-KBM):
  // Upacara pada hari Senin (07:00 - 07:40)
  // Tadarus & Sholat Dhuha pada Selasa - Sabtu (07:00 - 07:40)
  const morningStart = toClock(cursor);
  const morningEnd = toClock(cursor + 40);
  cursor += 40;

  definitions.push({
    order: order++,
    start: morningStart,
    end: morningEnd,
    activityType: 'UPACARA',
    activityName: 'Upacara Bendera',
    applicableDays: ['Senin'],
  });

  definitions.push({
    order: order++,
    start: morningStart,
    end: morningEnd,
    activityType: 'RELIGI',
    activityName: 'Tadarus & Sholat Dhuha',
    applicableDays: ['Selasa', 'Rabu', 'Kamis', 'Sabtu'],
  });

  definitions.push({
    order: order++,
    start: morningStart,
    end: morningEnd,
    activityType: 'RELIGI',
    activityName: 'Jumat Bersih & Religi',
    applicableDays: ['Jumat'],
  });

  // 2. KBM Periods and Breaks
  const breakSet = new Set(breakAfterJP);

  for (let jp = 1; jp <= teachingPeriods; jp++) {
    const start = toClock(cursor);
    const end = toClock(cursor + periodMinutes);
    cursor += periodMinutes;

    definitions.push({
      order: order++,
      start,
      end,
      activityType: 'KBM',
      activityName: `Jam Belajar (JP ${jp})`,
    });

    if (breakSet.has(jp) && jp < teachingPeriods) {
      const isSecondBreak = jp >= 5;
      const bDuration = isSecondBreak ? 40 : 20;
      const bStart = toClock(cursor);
      const bEnd = toClock(cursor + bDuration);
      cursor += bDuration;

      definitions.push({
        order: order++,
        start: bStart,
        end: bEnd,
        activityType: isSecondBreak ? 'RELIGI' : 'ISTIRAHAT',
        activityName: isSecondBreak ? 'Sholat Dhuhur & Istirahat' : 'Istirahat Pagi',
      });
    }
  }

  return definitions;
}

export function buildTimeSlots(
  settings: Pick<AppSettings, 'activeDays' | 'breakAfterJP' | 'maxDailyJP' | 'teachingPeriodsPerDay'> & {
    periodDefinitions?: PeriodDefinition[];
    periodMinutes?: number;
  },
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const maxTeaching = Math.min(10, Math.max(1, settings.maxDailyJP));
  const teachingPeriods = Math.min(maxTeaching, Math.max(1, settings.teachingPeriodsPerDay));
  const periodMinutes = settings.periodMinutes ?? 40;

  const defs =
    settings.periodDefinitions && settings.periodDefinitions.length > 0
      ? settings.periodDefinitions
      : createDefaultPeriodDefinitions(
          teachingPeriods,
          settings.breakAfterJP ?? [3, 6],
          periodMinutes,
        );

  for (const day of DAYS) {
    if (!settings.activeDays.includes(day)) continue;
    let jpNo = 0;
    let orderIndex = 0;

    for (const def of defs) {
      if (def.applicableDays && def.applicableDays.length > 0 && !def.applicableDays.includes(day)) {
        continue;
      }

      orderIndex += 1;
      const isKbm = def.activityType === 'KBM';
      if (isKbm) jpNo += 1;

      let label = def.activityName || def.activityType;
      if (isKbm) {
        label = `JP ${jpNo}`;
      } else if (def.activityType === 'UPACARA') {
        label = def.activityName || 'Upacara Bendera';
      } else if (def.activityType === 'ISTIRAHAT') {
        label = def.activityName || 'Istirahat';
      } else if (def.activityType === 'RELIGI') {
        label = def.activityName || 'Religi / Dhuha';
      } else if (def.activityType === 'LAINNYA') {
        label = def.activityName || 'Kegiatan Lain';
      }

      slots.push({
        id: `${day}-${orderIndex}`,
        day,
        order: orderIndex,
        kind: isKbm ? 'TEACHING' : 'BREAK',
        activityType: def.activityType,
        activityName: def.activityName,
        jpNo: isKbm ? jpNo : undefined,
        label,
        start: def.start,
        end: def.end,
        active: isKbm ? jpNo <= maxTeaching : true,
      });
    }
  }

  return slots;
}

export function teachingPeriodsForDay(slots: TimeSlot[], day: Day): number[] {
  return slots
    .filter((slot) => slot.day === day && slot.kind === 'TEACHING' && slot.active && slot.jpNo != null)
    .map((slot) => slot.jpNo as number);
}

export function segmentsFromBreaks(maxJP: number, breakAfterJP: number[]): number[][] {
  const boundaries = [...new Set(breakAfterJP)].filter((n) => n > 0 && n < maxJP).sort((a, b) => a - b);
  const segments: number[][] = [];
  let start = 1;
  for (const boundary of boundaries) {
    const segment: number[] = [];
    for (let jp = start; jp <= boundary; jp++) segment.push(jp);
    if (segment.length) segments.push(segment);
    start = boundary + 1;
  }
  const last: number[] = [];
  for (let jp = start; jp <= maxJP; jp++) last.push(jp);
  if (last.length) segments.push(last);
  return segments;
}

export function jpToAstronomical(jp: number, periodMinutes = 40): { minutes: number; hours: number; formatted: string } {
  const minutes = Math.max(0, jp * periodMinutes);
  const hours = Math.round((minutes / 60) * 10) / 10;
  return {
    minutes,
    hours,
    formatted: `${hours} jam (${minutes} menit)`,
  };
}

export function isSlotBlocked(slot?: TimeSlot): boolean {
  if (!slot) return true;
  return slot.kind === 'BREAK' || (slot.activityType != null && slot.activityType !== 'KBM');
}

export function findActiveTeachingSlot(slots: TimeSlot[], day: Day, jpNo: number): TimeSlot | undefined {
  return slots.find(
    (s) => s.day === day && s.jpNo === jpNo && s.kind === 'TEACHING' && (s.activityType === 'KBM' || !s.activityType),
  );
}

export interface TimelineRow {
  order: number;
  start: string;
  end: string;
  isKbm: boolean;
  jpNo?: number;
  activityType?: string;
  defaultLabel: string;
}

export function getTimelineRows(slots: TimeSlot[], defaultJPCount = 8): TimelineRow[] {
  const orderMap = new Map<number, TimelineRow>();

  for (const s of slots) {
    if (!orderMap.has(s.order)) {
      const isKbm = s.kind === 'TEACHING' && (s.activityType === 'KBM' || !s.activityType);
      orderMap.set(s.order, {
        order: s.order,
        start: s.start,
        end: s.end,
        isKbm,
        jpNo: s.jpNo,
        activityType: s.activityType,
        defaultLabel: s.label || (s.jpNo ? `JP ${s.jpNo}` : (s.activityName || 'Agenda')),
      });
    }
  }

  const rows = Array.from(orderMap.values()).sort((a, b) => a.order - b.order);
  if (rows.length > 0) return rows;

  return Array.from({ length: defaultJPCount }, (_, i) => ({
    order: i + 1,
    start: '',
    end: '',
    isKbm: true,
    jpNo: i + 1,
    activityType: 'KBM',
    defaultLabel: `JP ${i + 1}`,
  }));
}
