import { Project, WorkExperience } from '@/types/resume';

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function parseYearMonth(raw: string): number | null {
  const yearMonth = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]) - 1;
    if (month >= 0 && month <= 11) {
      return Date.UTC(year, month, 1);
    }
  }

  const monthYearNumeric = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthYearNumeric) {
    const month = Number(monthYearNumeric[1]) - 1;
    const year = Number(monthYearNumeric[2]);
    if (month >= 0 && month <= 11) {
      return Date.UTC(year, month, 1);
    }
  }

  const monthYearText = raw.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthYearText) {
    const monthKey = monthYearText[1].toLowerCase();
    const month = MONTHS[monthKey];
    const year = Number(monthYearText[2]);
    if (month !== undefined) {
      return Date.UTC(year, month, 1);
    }
  }

  return null;
}

function normalizeDateCandidate(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();

  // For ranges like "Jan 2023 - Mar 2024", use the right-most segment.
  const parts = compact.split(/\s*(?:-|to|–|—)\s*/i).filter(Boolean);
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }

  return compact;
}

function toTimestamp(value: string): number {
  const raw = normalizeDateCandidate(String(value ?? '').trim());
  if (!raw) return Number.NEGATIVE_INFINITY;

  if (/^(present|current|ongoing|now)$/i.test(raw)) {
    return Number.POSITIVE_INFINITY;
  }

  const normalizedYearMonth = parseYearMonth(raw);
  if (normalizedYearMonth !== null) return normalizedYearMonth;

  const direct = Date.parse(raw);
  if (!Number.isNaN(direct)) return direct;

  const monthYear = Date.parse(`1 ${raw}`);
  if (!Number.isNaN(monthYear)) return monthYear;

  const yearMatch = raw.match(/^\d{4}$/);
  if (yearMatch) {
    return Date.parse(`${raw}-12-31`);
  }

  return Number.NEGATIVE_INFINITY;
}

function compareByTimestampDesc(a: number, b: number): number {
  if (a === b) return 0;
  if (a > b) return -1;
  return 1;
}

export function sortWorkExperienceByDateDesc(items: WorkExperience[]): WorkExperience[] {
  return [...items].sort((a, b) => {
    const aPrimary = toTimestamp(a.endDate || a.startDate);
    const bPrimary = toTimestamp(b.endDate || b.startDate);
    const primaryCompare = compareByTimestampDesc(aPrimary, bPrimary);
    if (primaryCompare !== 0) return primaryCompare;

    const aSecondary = toTimestamp(a.startDate);
    const bSecondary = toTimestamp(b.startDate);
    return compareByTimestampDesc(aSecondary, bSecondary);
  });
}

export function sortProjectsByDateDesc(items: Project[]): Project[] {
  return [...items].sort((a, b) => {
    const aDate = toTimestamp(a.completionDate);
    const bDate = toTimestamp(b.completionDate);
    return compareByTimestampDesc(aDate, bDate);
  });
}
