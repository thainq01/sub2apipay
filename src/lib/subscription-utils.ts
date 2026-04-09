export type ValidityUnit = 'day' | 'week' | 'month';

/**
 * Calculate actual validity days based on value and unit.
 * - day: return directly
 * - week: value * 7
 * - month: calculate day difference from fromDate to same day after value months
 */
export function computeValidityDays(value: number, unit: ValidityUnit, fromDate?: Date): number {
  if (unit === 'day') return value;
  if (unit === 'week') return value * 7;

  // month: calculate day difference to same day after value months
  const from = fromDate ?? new Date();
  const target = new Date(from);
  target.setMonth(target.getMonth() + value);
  return Math.round((target.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format validity period display text (show what's configured, no conversion).
 * - unit=month, value=1 → 1 tháng / 1 Month
 * - unit=week, value=2 → 2 tuần / 2 Weeks
 * - unit=day, value=30 → 30 ngày / 30 Days
 */
export function formatValidityLabel(value: number, unit: ValidityUnit, locale: 'vi' | 'en'): string {
  const unitLabels: Record<ValidityUnit, { vi: string; en: string; enPlural: string }> = {
    day: { vi: 'ngày', en: 'Day', enPlural: 'Days' },
    week: { vi: 'tuần', en: 'Week', enPlural: 'Weeks' },
    month: { vi: 'tháng', en: 'Month', enPlural: 'Months' },
  };
  const u = unitLabels[unit];
  if (locale === 'vi') return `${value} ${u.vi}`;
  return `${value} ${value === 1 ? u.en : u.enPlural}`;
}

/**
 * Format validity period suffix (for price display, show what's configured).
 * - unit=month, value=1 → /1 tháng / /1mo
 * - unit=week, value=2 → /2 tuần / /2wk
 * - unit=day, value=30 → /30 ngày / /30d
 */
export function formatValiditySuffix(value: number, unit: ValidityUnit, locale: 'vi' | 'en'): string {
  const unitLabels: Record<ValidityUnit, { vi: string; en: string }> = {
    day: { vi: 'ngày', en: 'd' },
    week: { vi: 'tuần', en: 'wk' },
    month: { vi: 'tháng', en: 'mo' },
  };
  const u = unitLabels[unit];
  if (locale === 'vi') return `/${value} ${u.vi}`;
  return `/${value}${u.en}`;
}

/**
 * Format validity period list display text (for admin backend table).
 * - unit=day → "30 ngày"
 * - unit=week → "2 tuần"
 * - unit=month → "1 tháng"
 */
export function formatValidityDisplay(value: number, unit: ValidityUnit, locale: 'vi' | 'en'): string {
  const unitLabels: Record<ValidityUnit, { vi: string; en: string }> = {
    day: { vi: 'ngày', en: 'day(s)' },
    week: { vi: 'tuần', en: 'week(s)' },
    month: { vi: 'tháng', en: 'month(s)' },
  };
  const label = locale === 'vi' ? unitLabels[unit].vi : unitLabels[unit].en;
  return `${value} ${label}`;
}
