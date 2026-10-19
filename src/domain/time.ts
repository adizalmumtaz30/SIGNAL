import type { AppSettings, Day, TimeSlot } from './types';
import { DAYS } from './types';

function toClock(minutes: number): string {
  const normalized = Math.max(0, minutes);
  const hours = Math.floor(normalized / 60) % 24;
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function buildTimeSlots(settings: Pick<AppSettings, 'activeDays' | 'breakAfterJP' | 'maxDailyJP' | 'teachingPeriodsPerDay'>): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const breakAfter = new Set(settings.breakAfterJP);
  const maxTeaching = Math.min(10, Math.max(1, settings.maxDailyJP));
  const teachingPeriods = Math.min(maxTeaching, Math.max(1, settings.teachingPeriodsPerDay));
  for (const day of DAYS) {
    if (!settings.activeDays.includes(day)) continue;
    let jpNo = 0;
    let order = 0;
    let cursorMinutes = 7 * 60;
    const pushTeaching = (startMinutes: number, endMinutes: number) => {
      jpNo += 1;
      order += 1;
      slots.push({
        id: `${day}-${order}`, day, order, kind: 'TEACHING', jpNo,
        label: `Jam ke-${order}`, start: toClock(startMinutes), end: toClock(endMinutes), active: jpNo <= maxTeaching,
      });
    };
    const pushBreak = (startMinutes: number, endMinutes: number) => {
      order += 1;
      slots.push({
        id: `${day}-${order}`, day, order, kind: 'BREAK', label: 'Istirahat',
        start: toClock(startMinutes), end: toClock(endMinutes), active: true,
      });
    };
    for (let jp = 1; jp <= teachingPeriods; jp++) {
      const teachingEnd = cursorMinutes + 40;
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
  return slots.filter((slot) => slot.day === day && slot.kind === 'TEACHING' && slot.active && slot.jpNo != null)
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
