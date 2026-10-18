import { describe, it, expect } from 'vitest';
import { throughputDatasets, withLegend, DELIVERED_COLOR, EARNED_COLOR } from '../throughput';
import type { ThroughputWeekDto } from '../../types/api';

const weeks: ThroughputWeekDto[] = [
  { weekOf: '2026-10-05', pointsDelivered: 5, pointsEarned: 7.123 },
  { weekOf: '2026-10-12', pointsDelivered: 0, pointsEarned: -1.5 },
  { weekOf: '2026-10-19', pointsDelivered: 3 }, // an older response with no earned figure
];

describe('throughputDatasets', () => {
  it('gives a Delivered and an Earned series in week order', () => {
    const [delivered, earned] = throughputDatasets(weeks);

    expect(delivered.label).toBe('Delivered');
    expect(delivered.data).toEqual([5, 0, 3]);
    expect(earned.label).toBe('Earned');
    expect(earned.backgroundColor).toBe(EARNED_COLOR);
  });

  it('rounds earned points for display, keeps negative weeks, and treats a missing figure as zero', () => {
    const [, earned] = throughputDatasets(weeks);

    expect(earned.data).toEqual([7.12, -1.5, 0]);
  });

  it('colours delivered one way, or week by week when given a list', () => {
    expect(throughputDatasets(weeks)[0].backgroundColor).toBe(DELIVERED_COLOR);
    expect(throughputDatasets(weeks, ['a', 'b', 'c'])[0].backgroundColor).toEqual(['a', 'b', 'c']);
  });
});

describe('withLegend', () => {
  it('turns the legend on without touching the rest of the options', () => {
    const options = { responsive: true, plugins: { legend: { display: false }, title: { display: false } } };

    const result = withLegend(options);

    expect(result.plugins.legend).toEqual({ display: true, position: 'bottom' });
    expect(result.plugins.title).toEqual({ display: false });
    expect(result.responsive).toBe(true);
    expect(options.plugins.legend.display).toBe(false);
  });
});
