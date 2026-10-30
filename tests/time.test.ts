import { describe, expect, it } from 'vitest';
import { createDemoState } from '../src/domain/seed';
import { buildTimeSlots, findActiveTeachingSlot, teachingPeriodsForDay } from '../src/domain/time';

describe('struktur waktu KBM', () => {
  it('memisahkan istirahat dari JP KBM dan mempertahankan waktu yang berurutan', () => {
    const state = createDemoState();
    const slots = buildTimeSlots(state.settings);
    const monday = slots.filter((slot) => slot.day === 'Senin');
    expect(teachingPeriodsForDay(slots, 'Senin')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(monday.filter((slot) => slot.kind === 'BREAK')).toHaveLength(2);
    for (let index = 1; index < monday.length; index++) {
      expect(monday[index]!.start).toBe(monday[index - 1]!.end);
    }
  });

  it('mencari target berdasarkan nomor JP KBM, bukan urutan aktivitas', () => {
    const state = createDemoState();
    state.settings.periodDefinitions = [
      { order: 1, start: '07:00', end: '07:40', activityType: 'UPACARA' },
      { order: 2, start: '07:40', end: '08:20', activityType: 'KBM' },
      { order: 3, start: '08:20', end: '09:00', activityType: 'ISTIRAHAT' },
      { order: 4, start: '09:00', end: '09:40', activityType: 'KBM' },
    ];
    const slots = buildTimeSlots(state.settings);
    const jp1 = findActiveTeachingSlot(slots, 'Senin', 1);
    const jp2 = findActiveTeachingSlot(slots, 'Senin', 2);
    expect(jp1?.order).toBe(2);
    expect(jp1?.jpNo).toBe(1);
    expect(jp2?.order).toBe(4);
    expect(jp2?.jpNo).toBe(2);
    expect(findActiveTeachingSlot(slots, 'Senin', 3)).toBeUndefined();
    expect(findActiveTeachingSlot(slots, 'Senin', 99)).toBeUndefined();
  });

  it('tidak menghasilkan jam yang tumpang tindih ketika banyak jeda dipilih', () => {
    const state = createDemoState();
    state.settings.maxDailyJP = 10;
    state.settings.teachingPeriodsPerDay = 10;
    state.settings.breakAfterJP = [2, 3, 4, 5, 6, 7];
    const slots = buildTimeSlots(state.settings).filter((slot) => slot.day === 'Senin');
    expect(teachingPeriodsForDay(slots, 'Senin')).toHaveLength(10);
    for (let index = 1; index < slots.length; index++) {
      expect(slots[index]!.start).toBe(slots[index - 1]!.end);
    }
  });
});
