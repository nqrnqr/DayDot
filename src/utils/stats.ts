import type { EventItem, EventRecord, NumberFieldDef, SelectFieldDef } from '../types/models';
import { getWeekRange, startOfDay, toDateKey } from './date';

export type StatsPeriod = 'week' | 'month' | 'year' | 'all';

export interface BarDatum {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  count: number;
}

export interface PeriodStatsResult {
  rangeLabel: string;
  totalCount: number;
  totalMetricValue: number | null;
  activeDays: number;
  dailyAverage: number;
  averageIntervalDays: number | null;
  bars: BarDatum[];
  filteredRecords: EventRecord[];
}

export function getPrimaryNumberField(event: EventItem): NumberFieldDef | null {
  const found = event.fields.find((f): f is NumberFieldDef => f.type === 'number');
  return found ?? null;
}

export function extractNumericValue(record: EventRecord, fieldId: string): number {
  const raw = record.values[fieldId];
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function computeAverageInterval(records: EventRecord[]): number | null {
  if (records.length < 2) return null;
  const uniqueDays = Array.from(
    new Set(records.map((r) => startOfDay(r.timestamp).getTime())),
  ).sort((a, b) => a - b);

  if (uniqueDays.length < 2) return 0;
  let totalGapDays = 0;
  for (let i = 1; i < uniqueDays.length; i++) {
    totalGapDays += (uniqueDays[i] - uniqueDays[i - 1]) / 86_400_000;
  }
  return totalGapDays / (uniqueDays.length - 1);
}

export function computePeriodStats(
  records: EventRecord[],
  period: StatsPeriod,
  anchorDate: Date,
  metricField: NumberFieldDef | null,
): PeriodStatsResult {
  const now = new Date();
  let startTs = 0;
  let endTs = Number.MAX_SAFE_INTEGER;
  let rangeLabel = '全部记录';
  let elapsedDaysInRange = 1;

  const bars: BarDatum[] = [];

  if (period === 'week') {
    const { start, end, days } = getWeekRange(anchorDate);
    startTs = start.getTime();
    endTs = end.getTime();
    rangeLabel = `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
    const effectiveEnd = Math.min(end.getTime(), startOfDay(now).getTime() + 86_400_000 - 1);
    elapsedDaysInRange = Math.max(
      1,
      Math.min(7, Math.ceil((effectiveEnd - startTs + 1) / 86_400_000)),
    );
    const weekNames = ['一', '二', '三', '四', '五', '六', '日'];
    days.forEach((d, idx) => {
      bars.push({
        key: toDateKey(d),
        label: `${d.getMonth() + 1}月${d.getDate()}日 周${weekNames[idx]}`,
        shortLabel: `周${weekNames[idx]}`,
        value: 0,
        count: 0,
      });
    });
  } else if (period === 'month') {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const daysInMonth = last.getDate();
    startTs = first.getTime();
    endTs = last.getTime();
    rangeLabel = `${year}年${month + 1}月`;

    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    elapsedDaysInRange = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const showTick = d === 1 || d % 5 === 0 || d === daysInMonth;
      bars.push({
        key: toDateKey(date),
        label: `${month + 1}月${d}日`,
        shortLabel: showTick ? `${d}日` : '',
        value: 0,
        count: 0,
      });
    }
  } else if (period === 'year') {
    const year = anchorDate.getFullYear();
    const first = new Date(year, 0, 1);
    const last = new Date(year, 11, 31, 23, 59, 59, 999);
    startTs = first.getTime();
    endTs = last.getTime();
    rangeLabel = `${year}年`;

    const isCurrentYear = year === now.getFullYear();
    elapsedDaysInRange = isCurrentYear
      ? Math.max(1, Math.ceil((startOfDay(now).getTime() - first.getTime()) / 86_400_000) + 1)
      : 365;

    for (let m = 0; m < 12; m++) {
      bars.push({
        key: `${year}-${String(m + 1).padStart(2, '0')}`,
        label: `${year}年${m + 1}月`,
        shortLabel: `${m + 1}月`,
        value: 0,
        count: 0,
      });
    }
  } else {
    // 'all' - aggregate by month across the active span (up to last 12 months or min..max)
    const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length > 0) {
      const firstDate = new Date(sorted[0].timestamp);
      const lastDate = new Date(Math.max(sorted[sorted.length - 1].timestamp, now.getTime()));
      elapsedDaysInRange = Math.max(
        1,
        Math.ceil((startOfDay(lastDate).getTime() - startOfDay(firstDate).getTime()) / 86_400_000) + 1,
      );
      const cursor = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
      const endMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
      while (cursor <= endMonth) {
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        bars.push({
          key: `${y}-${String(m + 1).padStart(2, '0')}`,
          label: `${y}年${m + 1}月`,
          shortLabel: `${m + 1}月`,
          value: 0,
          count: 0,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      if (bars.length > 12) {
        bars.splice(0, bars.length - 12);
      }
    }
  }

  const filteredRecords = records.filter(
    (r) => r.timestamp >= startTs && r.timestamp <= endTs,
  );

  const barMap = new Map(bars.map((b) => [b.key, b]));
  const activeDaySet = new Set<string>();
  let totalMetric = 0;

  for (const rec of filteredRecords) {
    const dayKey = toDateKey(rec.timestamp);
    activeDaySet.add(dayKey);
    const val = metricField ? extractNumericValue(rec, metricField.id) : 1;
    totalMetric += val;

    const bucketKey =
      period === 'year' || period === 'all' ? dayKey.slice(0, 7) : dayKey;
    const bar = barMap.get(bucketKey);
    if (bar) {
      bar.count += 1;
      bar.value += val;
    }
  }

  const totalCount = filteredRecords.length;
  const activeDays = activeDaySet.size;
  const dailyAverage = totalCount / Math.max(1, elapsedDaysInRange);
  const averageIntervalDays = computeAverageInterval(filteredRecords);

  return {
    rangeLabel,
    totalCount,
    totalMetricValue: metricField ? totalMetric : null,
    activeDays,
    dailyAverage,
    averageIntervalDays,
    bars,
    filteredRecords,
  };
}

export interface SelectOptionStat {
  optionId: string;
  label: string;
  color: string;
  count: number;
  ratio: number;
}

export function computeSelectFieldStats(
  records: EventRecord[],
  field: SelectFieldDef,
): SelectOptionStat[] {
  const counts = new Map<string, number>();
  let totalSelections = 0;

  for (const rec of records) {
    const val = rec.values[field.id];
    if (Array.isArray(val)) {
      for (const id of val) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        totalSelections += 1;
      }
    } else if (typeof val === 'string' && val) {
      counts.set(val, (counts.get(val) ?? 0) + 1);
      totalSelections += 1;
    }
  }

  return field.options
    .map((opt) => {
      const count = counts.get(opt.id) ?? 0;
      return {
        optionId: opt.id,
        label: opt.label,
        color: opt.color,
        count,
        ratio: totalSelections > 0 ? count / totalSelections : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function formatCleanNumber(num: number): string {
  if (Number.isInteger(num)) return String(num);
  return Number(num.toFixed(1)).toString();
}
