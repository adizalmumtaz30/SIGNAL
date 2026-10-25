import type { SchoolClass } from '../domain/types';

export interface MatrixClassGroupRow {
  rowId: string;
  label: string; // e.g. "Baris 1 — Kelompok A", "Baris 2 — Kelompok B"
  sectionKey: string; // e.g. "A", "B", "1"
  classes: SchoolClass[];
}

const ROMAN_MAP: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

/**
 * Extracts numeric level ranking (for sorting VII < VIII < IX)
 * and the rombel section identifier (e.g. "A", "B", "1").
 */
export function parseClassLevelAndSection(cls: SchoolClass): {
  levelRank: number;
  levelLabel: string;
  section: string;
} {
  const name = (cls.name || '').trim();
  let levelRank = 99;
  let levelLabel = (cls.level || '').trim();
  let section = '';

  // 1. Resolve level rank from cls.level if present
  const upperLevel = levelLabel.toUpperCase();
  if (ROMAN_MAP[upperLevel]) {
    levelRank = ROMAN_MAP[upperLevel];
  } else if (!isNaN(Number(upperLevel)) && Number(upperLevel) > 0) {
    levelRank = Number(upperLevel);
  }

  // 2. Parse from name pattern, e.g. "VII-A", "VII A", "Kelas 7A", "8-B", "IX.1"
  const regex = /^(?:Kelas\s*)?([IVX]+|\d+)\s*[-_./\s]?\s*(.+)?$/i;
  const match = name.match(regex);

  if (match) {
    const rawLvl = match[1].toUpperCase();
    const rawSec = (match[2] || '').trim().toUpperCase();

    if (levelRank === 99) {
      if (ROMAN_MAP[rawLvl]) {
        levelRank = ROMAN_MAP[rawLvl];
        levelLabel = rawLvl;
      } else if (!isNaN(Number(rawLvl)) && Number(rawLvl) > 0) {
        levelRank = Number(rawLvl);
        levelLabel = rawLvl;
      }
    }
    section = rawSec;
  }

  // 3. Fallback: if section is still empty and name has a letter suffix
  if (!section) {
    const letterMatch = name.match(/([A-Za-z0-9]+)$/);
    if (letterMatch && letterMatch[1] !== levelLabel) {
      section = letterMatch[1].toUpperCase();
    }
  }

  return {
    levelRank,
    levelLabel: levelLabel || 'Kelas',
    section,
  };
}

/**
 * Groups active school classes into vertical rombel rows (Kelompok A, Kelompok B, ...)
 * and sorts classes within each row horizontally by grade level (VII < VIII < IX).
 */
export function groupClassesForMasterMatrix(activeClasses: SchoolClass[]): MatrixClassGroupRow[] {
  if (!activeClasses.length) return [];

  // Parse all classes
  const parsed = activeClasses.map((cls) => {
    const meta = parseClassLevelAndSection(cls);
    return { cls, ...meta };
  });

  // Collect distinct section identifiers
  const knownSections = parsed.map((p) => p.section).filter(Boolean);
  const uniqueSections = [...new Set(knownSections)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Case 1: Classes have distinct sections (e.g. "A", "B", or "1", "2")
  if (uniqueSections.length > 1) {
    return uniqueSections.map((sec, idx) => {
      const rowClasses = parsed
        .filter((p) => p.section === sec)
        .sort((a, b) => a.levelRank - b.levelRank || a.cls.name.localeCompare(b.cls.name))
        .map((p) => p.cls);

      const letter = isNaN(Number(sec)) ? sec : String.fromCharCode(65 + idx);
      const rowNumber = idx + 1;
      const label = `Baris ${rowNumber} — Kelompok ${letter}`;

      return {
        rowId: `group-${sec}`,
        label,
        sectionKey: sec,
        classes: rowClasses,
      };
    });
  }

  // Case 2: Group by rombel index per grade level
  // Collect unique levels sorted by levelRank
  const levelBuckets = new Map<number, typeof parsed>();
  for (const item of parsed) {
    const bucket = levelBuckets.get(item.levelRank) || [];
    bucket.push(item);
    levelBuckets.set(item.levelRank, bucket);
  }

  // Sort classes in each level bucket by name
  for (const bucket of levelBuckets.values()) {
    bucket.sort((a, b) => a.cls.name.localeCompare(b.cls.name));
  }

  // Find max rombel count among any level
  let maxRombels = 1;
  for (const bucket of levelBuckets.values()) {
    if (bucket.length > maxRombels) maxRombels = bucket.length;
  }

  const sortedLevelRanks = [...levelBuckets.keys()].sort((a, b) => a - b);
  const rows: MatrixClassGroupRow[] = [];

  for (let rIdx = 0; rIdx < maxRombels; rIdx++) {
    const rowClasses: SchoolClass[] = [];
    for (const rank of sortedLevelRanks) {
      const bucket = levelBuckets.get(rank);
      if (bucket && bucket[rIdx]) {
        rowClasses.push(bucket[rIdx].cls);
      }
    }

    if (rowClasses.length > 0) {
      const letter = String.fromCharCode(65 + rIdx);
      const rowNumber = rIdx + 1;
      rows.push({
        rowId: `group-${letter}`,
        label: `Baris ${rowNumber} — Kelompok ${letter}`,
        sectionKey: letter,
        classes: rowClasses,
      });
    }
  }

  return rows;
}
