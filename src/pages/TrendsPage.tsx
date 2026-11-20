import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { EventItem, EventRecord } from '../types/models';
import { getColorToken } from '../constants/theme';
import { getWeekRange, toDateKey } from '../utils/date';
import {
  computePeriodStats,
  extractNumericValue,
  formatCleanNumber,
  getPrimaryNumberField,
  type StatsPeriod,
} from '../utils/stats';
import { AnnualHeatmap } from '../components/AnnualHeatmap';
import { EventIcon } from '../components/EventIcon';

interface TrendsPageProps {
  events: EventItem[];
  records: EventRecord[];
  isDark: boolean;
  onSelectEvent: (eventId: string) => void;
}

export function TrendsPage({ events, records, isDark, onSelectEvent }: TrendsPageProps) {
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [anchor, setAnchor] = useState(() => new Date());

  const emerald = getColorToken('emerald', isDark);

  const isCurrentPeriod = useMemo(() => {
    const today = new Date();
    if (period === 'all') return true;
    if (period === 'year') return anchor.getFullYear() === today.getFullYear();
    if (period === 'month') {
      return (
        anchor.getFullYear() === today.getFullYear() &&
        anchor.getMonth() === today.getMonth()
      );
    }
    return (
      toDateKey(getWeekRange(anchor).start) === toDateKey(getWeekRange(today).start)
    );
  }, [period, anchor]);

  const resetLabel =
    period === 'week' ? '回到本周' : period === 'month' ? '回到本月' : '回到今年';

  const globalStats = useMemo(
    () => computePeriodStats(records, period, anchor, null),
    [records, period, anchor],
  );

  const eventBreakdown = useMemo(() => {
    const counts = new Map<string, EventRecord[]>();
    for (const r of globalStats.filteredRecords) {
      const list = counts.get(r.eventId);
      if (list) list.push(r);
      else counts.set(r.eventId, [r]);
    }

    const total = Math.max(1, globalStats.filteredRecords.length);

    return events
      .map((event) => {
        const list = counts.get(event.id) ?? [];
        const numField = getPrimaryNumberField(event);
        const metricSum = numField
          ? list.reduce((acc, r) => acc + extractNumericValue(r, numField.id), 0)
          : null;
        return {
          event,
          count: list.length,
          ratio: list.length / total,
          metricSum,
          metricUnit: numField?.unit ?? '',
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [events, globalStats.filteredRecords]);

  const shiftPeriod = (delta: number) => {
    const d = new Date(anchor);
    if (period === 'week') d.setDate(d.getDate() + delta * 7);
    else if (period === 'month') d.setMonth(d.getMonth() + delta);
    else if (period === 'year') d.setFullYear(d.getFullYear() + delta);
    setAnchor(d);
  };

  return (
    <div className="flex flex-col pb-24">
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas-blur)] px-5 pt-5 pb-3 backdrop-blur-md">
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--fg-primary)]">
          趋势总览
        </h1>

        <div className="mt-3 grid grid-cols-4 rounded-xl bg-[var(--bg-subtle)] p-1">
          {(
            [
              ['week', '周'],
              ['month', '月'],
              ['year', '年'],
              ['all', '总'],
            ] as [StatsPeriod, string][]
          ).map(([p, label]) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                period === p
                  ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                  : 'text-[var(--fg-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {period !== 'all' && (
          <div className="mt-3 flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              aria-label="上一周期"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle-hover)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-[var(--fg-primary)]">
              {globalStats.rangeLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              aria-label="下一周期"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle-hover)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {!isCurrentPeriod && (
              <button
                type="button"
                onClick={() => setAnchor(new Date())}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition active:scale-95"
                style={{ backgroundColor: emerald.soft, color: emerald.ink }}
              >
                <RotateCcw className="h-2.5 w-2.5" />
                {resetLabel}
              </button>
            )}
          </div>
        )}
      </header>

      <main className="space-y-3.5 px-4 pt-1">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="text-xl font-bold text-[var(--fg-primary)] tabular-nums">
              {globalStats.totalCount}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
              总完成次数
            </div>
          </div>
          <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="text-xl font-bold text-[var(--fg-primary)] tabular-nums">
              {globalStats.activeDays}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
              活跃天数
            </div>
          </div>
          <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="text-xl font-bold text-[var(--fg-primary)] tabular-nums">
              {formatCleanNumber(globalStats.dailyAverage)}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
              日均记录
            </div>
          </div>
        </div>

        <AnnualHeatmap
          records={records}
          year={anchor.getFullYear()}
          color={emerald}
          metricField={null}
          metricMode="count"
        />

        <div className="daydot-card rounded-[22px] bg-[var(--bg-surface)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[var(--fg-primary)]">
              事件分布
            </h2>
            <span className="text-xs font-medium text-[var(--fg-muted)]">
              点击查看详情
            </span>
          </div>

          {eventBreakdown.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--fg-muted)]">暂无事件</p>
          ) : (
            <div className="space-y-3">
              {eventBreakdown.map(({ event, count, ratio, metricSum, metricUnit }) => {
                const color = getColorToken(event.color, isDark);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectEvent(event.id)}
                    className="block w-full rounded-2xl p-2 text-left transition hover:bg-[var(--bg-canvas)] active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: color.soft, color: color.ink }}
                        >
                          <EventIcon name={event.icon} className="h-4 w-4" />
                        </div>
                        <span className="truncate text-sm font-semibold text-[var(--fg-primary)]">
                          {event.name}
                        </span>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-sm font-bold text-[var(--fg-primary)] tabular-nums">
                          {count} 次
                        </span>
                        {metricSum !== null && count > 0 && (
                          <span
                            className="ml-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                            style={{ backgroundColor: color.soft, color: color.ink }}
                          >
                            {formatCleanNumber(metricSum)} {metricUnit}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${count > 0 ? Math.max(4, ratio * 100) : 0}%`,
                          backgroundColor: color.solid,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
