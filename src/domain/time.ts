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
  breakAfterJP = [2, 5],
  periodMinutes = 40,
): PeriodDefinition[] {
  const definitions: PeriodDefinition[] = [];
  let order = 1;
  let cursor = 7 * 60; // 07:00
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
    });

    if (breakSet.has(jp) && jp < teachingPeriods) {
      const bStart = toClock(cursor);
      const bEnd = toClock(cursor + 20);
      cursor += 20;

      definitions.push({
        order: order++,
        start: bStart,
        end: bEnd,
        activityType: 'ISTIRAHAT',
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

  // If customized period definitions are provided, use them
  if (settings.periodDefinitions && settings.periodDefinitions.length > 0) {
    for (const day of DAYS) {
      if (!settings.activeDays.includes(day)) continue;
      let jpNo = 0;
      let orderIndex = 0;

      for (const def of settings.periodDefinitions) {
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

  // Fallback default generation
  const breakAfter = new Set(settings.breakAfterJP);
  for (const day of DAYS) {
    if (!settings.activeDays.includes(day)) continue;
    let jpNo = 0;
    let order = 0;
    let cursorMinutes = 7 * 60;

    const pushTeaching = (startMinutes: number, endMinutes: number) => {
      jpNo += 1;
      order += 1;
      slots.push({
        id: `${day}-${order}`,
        day,
        order,
        kind: 'TEACHING',
        activityType: 'KBM',
        jpNo,
        label: `JP ${jpNo}`,
        start: toClock(startMinutes),
        end: toClock(endMinutes),
        active: jpNo <= maxTeaching,
      });
    };

    const pushBreak = (startMinutes: number, endMinutes: number) => {
      order += 1;
      slots.push({
        id: `${day}-${order}`,
        day,
        order,
        kind: 'BREAK',
        activityType: 'ISTIRAHAT',
        label: 'Istirahat',
        start: toClock(startMinutes),
        end: toClock(endMinutes),
        active: true,
      });
    };

    for (let jp = 1; jp <= teachingPeriods; jp++) {
      const teachingEnd = cursorMinutes + periodMinutes;
      pushTeaching(cursorMinutes, teachingEnd);
      cursorMinutes = teachingEnd;
      if (breakAfter.has(jp) && jp < teachingPeriods) {
        const breakEnd = cursorMinutes + 20;
        pushBreak(cursorMinutes, breakEnd);
        cursorMinutes = breakEnd;
      }
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
