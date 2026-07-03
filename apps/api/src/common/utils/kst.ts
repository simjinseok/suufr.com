/**
 * Korea Standard Time (KST) helpers.
 *
 * KST is a fixed UTC+9 offset with no daylight saving, so month/day boundaries
 * can be computed by shifting the UTC instant by 9 hours. Using these instead of
 * `new Date(year, month, ...)` makes month/year bucketing correct regardless of
 * the server's local timezone (production runs on UTC).
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * The UTC instant at which the given KST month begins.
 * @param year  KST calendar year
 * @param month KST calendar month, 1-12. Values outside the range roll over
 *              (e.g. month 13 → January of the next year, month 0 → December of
 *              the previous year), which is convenient for range math.
 */
export function kstMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET_MS);
}

/**
 * The KST calendar year/month/day for a given instant.
 */
export function toKstParts(instant: Date): { year: number; month: number; day: number } {
  const shifted = new Date(instant.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}
