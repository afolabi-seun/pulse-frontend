/**
 * Hours are recorded to two decimals (the server stores them as exact decimals), but JavaScript adds numbers as binary floating point, so adding
 * 1.1 and 2.32 gives 3.4200000000000004. Everything that adds hours up or shows a sum goes through here: values are converted to whole hundredths
 * of an hour, added as integers, and converted back, so a sum can never print more than two decimals.
 */

/** Rounds to two decimals, half up. `toPrecision(15)` strips the binary noise first, so 1.005 gives 1.01 (a plain Math.round(1.005 * 100) gives 1)
 * and 10.005 gives 10.01. Safe for any realistic hours value (0 to a few hundred). */
export const round2 = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Number((n * 100).toPrecision(15))) / 100;
};

/** One value as whole hundredths of an hour. */
const hundredths = (n: number): number => Math.round(Number((n * 100).toPrecision(15)));

/** The exact total of a list of hours, to two decimals. */
export const sumHours = (values: readonly number[]): number => values.reduce((total, v) => total + hundredths(v), 0) / 100;

/** How hours are shown: at most two decimals, none when whole ("3.42h", "4.5h", "2h"). */
export const formatHours = (n: number): string => `${round2(n)}h`;
