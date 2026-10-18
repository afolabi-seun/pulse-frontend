import type { ThroughputWeekDto } from '../types/api';

export const DELIVERED_COLOR = 'rgb(99, 102, 241)';
export const EARNED_COLOR = 'rgb(16, 185, 129)';

/**
 * The two weekly series every throughput chart shows: points delivered (tasks marked Done) and points earned (progress made, finished or not).
 * Earned is rounded to two decimals for display. <paramref name="deliveredColor"/> may be one colour or one per week (the dashboard lightens the
 * current, still-in-progress week).
 */
export function throughputDatasets(weeks: ThroughputWeekDto[], deliveredColor: string | string[] = DELIVERED_COLOR) {
  return [
    { label: 'Delivered', data: weeks.map((w) => w.pointsDelivered), backgroundColor: deliveredColor, borderRadius: 4 },
    { label: 'Earned', data: weeks.map((w) => Math.round((w.pointsEarned ?? 0) * 100) / 100), backgroundColor: EARNED_COLOR, borderRadius: 4 },
  ];
}

/** Chart options with the legend switched on: two series need telling apart. */
export function withLegend<T extends { plugins: Record<string, unknown> }>(options: T): T {
  return { ...options, plugins: { ...options.plugins, legend: { display: true, position: 'bottom' as const } } };
}
