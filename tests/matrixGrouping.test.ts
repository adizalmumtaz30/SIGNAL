import { describe, expect, it } from 'vitest';
import type { SchoolClass } from '../src/domain/types';
import { groupClassesForMasterMatrix, parseClassLevelAndSection } from '../src/utils/matrixGrouping';

describe('Matriks Seluruh Kelas — Pengelompokan Rombel & Tingkatan', () => {
  it('dapat mengekstrak peringkat tingkat dan kode seksi rombel secara akurat', () => {
    const cls7A: SchoolClass = { id: '1', name: 'VII-A', level: 'VII', isActive: true };
    const meta7A = parseClassLevelAndSection(cls7A);
    expect(meta7A.levelRank).toBe(7);
    expect(meta7A.section).toBe('A');

    const cls8B: SchoolClass = { id: '2', name: 'VIII-B', level: 'VIII', isActive: true };
    const meta8B = parseClassLevelAndSection(cls8B);
    expect(meta8B.levelRank).toBe(8);
    expect(meta8B.section).toBe('B');

    const cls9A: SchoolClass = { id: '3', name: 'IX-A', level: 'IX', isActive: true };
    const meta9A = parseClassLevelAndSection(cls9A);
    expect(meta9A.levelRank).toBe(9);
    expect(meta9A.section).toBe('A');
  });

  it('mengelompokkan kelas 3 tingkatan (VII, VIII, IX) dengan masing-masing 2 rombel sesuai spesifikasi', () => {
    const classes: SchoolClass[] = [
      { id: 'c1', name: 'VII-A', level: 'VII', isActive: true },
      { id: 'c2', name: 'VII-B', level: 'VII', isActive: true },
      { id: 'c3', name: 'VIII-A', level: 'VIII', isActive: true },
      { id: 'c4', name: 'VIII-B', level: 'VIII', isActive: true },
      { id: 'c5', name: 'IX-A', level: 'IX', isActive: true },
      { id: 'c6', name: 'IX-B', level: 'IX', isActive: true },
    ];

    const rows = groupClassesForMasterMatrix(classes);

    expect(rows).toHaveLength(2);

    // Baris 1: Kelompok A -> VII-A | VIII-A | IX-A
    expect(rows[0].label).toContain('Kelompok A');
    expect(rows[0].classes.map((c) => c.name)).toEqual(['VII-A', 'VIII-A', 'IX-A']);

    // Baris 2: Kelompok B -> VII-B | VIII-B | IX-B
    expect(rows[1].label).toContain('Kelompok B');
    expect(rows[1].classes.map((c) => c.name)).toEqual(['VII-B', 'VIII-B', 'IX-B']);
  });

  it('mengelompokkan 2 tingkatan dengan 2 rombel secara konsisten', () => {
    const classes: SchoolClass[] = [
      { id: 'c1', name: 'VII-A', level: 'VII', isActive: true },
      { id: 'c2', name: 'VII-B', level: 'VII', isActive: true },
      { id: 'c3', name: 'VIII-A', level: 'VIII', isActive: true },
      { id: 'c4', name: 'VIII-B', level: 'VIII', isActive: true },
    ];

    const rows = groupClassesForMasterMatrix(classes);

    expect(rows).toHaveLength(2);
    expect(rows[0].classes.map((c) => c.name)).toEqual(['VII-A', 'VIII-A']);
    expect(rows[1].classes.map((c) => c.name)).toEqual(['VII-B', 'VIII-B']);
  });
});
