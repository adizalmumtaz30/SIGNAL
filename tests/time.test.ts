import { describe, expect, it } from 'vitest';
import { createDemoState } from '../src/domain/seed';
import { buildTimeSlots, teachingPeriodsForDay } from '../src/domain/time';

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
