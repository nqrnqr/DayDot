import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventRecord, NumberFieldDef } from '../types/models';
import type { ResolvedPalette } from '../constants/theme';
import { buildAnnualHeatmapColumns, formatFullDate, toDateKey } from '../utils/date';
import { extractNumericValue, formatCleanNumber } from '../utils/stats';

interface AnnualHeatmapProps {
  records: EventRecord[];
  year: number;
  color: ResolvedPalette;
  metricField: NumberFieldDef | null;
  metricMode: 'count' | 'value';
  onSelectDate?: (dateKey: string) => void;
}

export function AnnualHeatmap({
  records,
  year,
  color,
  metricField,
  metricMode,
  onSelectDate,
}: AnnualHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeEdges, setFadeEdges] = useState({ left: false, right: false });
  const [selectedCell, setSelectedCell] = useState<{
    dateKey: string;
    count: number;
    value: number;
  } | null>(null);

  const columns = useMemo(() => buildAnnualHeatmapColumns(year), [year]);

  const { dayStats, maxVal } = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const rec of records) {
      const key = toDateKey(rec.timestamp);
      const prev = map.get(key) ?? { count: 0, value: 0 };
      prev.count += 1;
      prev.value += metricField ? extractNumericValue(rec, metricField.id) : 1;
      map.set(key, prev);
    }
    let max = 0;
    map.forEach((stat) => {
      const v = metricMode === 'value' && metricField ? stat.value : stat.count;
      if (v > max) max = v;
    });
    return { dayStats: map, maxVal: Math.max(1, max) };
  }, [records, metricField, metricMode]);

  const updateFadeEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const canScrollLeft = el.scrollLeft > 4;
    const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setFadeEdges((prev) =>
      prev.left === canScrollLeft && prev.right === canScrollRight
        ? prev
        : { left: canScrollLeft, right: canScrollRight },
    );
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    if (year === now.getFullYear()) {
      const ratio = (now.getMonth() + 1) / 12;
      el.scrollLeft = Math.max(0, el.scrollWidth * ratio - el.clientWidth * 0.75);
    } else {
      el.scrollLeft = 0;
    }
    updateFadeEdges();
  }, [year, updateFadeEdges]);

  const getCellColor = (rawVal: number) => {
    if (rawVal <= 0) return 'var(--heatmap-empty)';
    const ratio = rawVal / maxVal;
    if (ratio <= 0.25) return color.levels[0];
    if (ratio <= 0.5) return color.levels[1];
    if (ratio <= 0.75) return color.levels[2];
    return color.levels[3];
  };

  return (
    <div className="daydot-card rounded-[22px] bg-[var(--bg-surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-medium text-[var(--fg-primary)]">
          {year} 年热力图
        </h3>
        {selectedCell ? (
          <span className="truncate rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--fg-secondary)]">
            {formatFullDate(new Date(selectedCell.dateKey + 'T00:00:00'))} ·{' '}
            {selectedCell.count} 次
            {metricField && selectedCell.value > 0
              ? ` (${formatCleanNumber(selectedCell.value)} ${metricField.unit})`
              : ''}
          </span>
        ) : (
          <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--fg-muted)]">
            <span>少</span>
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--heatmap-empty)]" />
            {color.levels.map((lv) => (
              <span
                key={lv}
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ backgroundColor: lv }}
              />
            ))}
            <span>多</span>
          </div>
        )}
      </div>

      <div className="relative">
        {/* Soft edge fade masks when horizontally scrollable on narrow viewports */}
        {fadeEdges.left && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 lg:hidden"
            style={{
              background:
                'linear-gradient(to right, var(--bg-surface) 0%, transparent 100%)',
            }}
          />
        )}
        {fadeEdges.right && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 lg:hidden"
            style={{
              background:
                'linear-gradient(to left, var(--bg-surface) 0%, transparent 100%)',
            }}
          />
        )}

        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label={`${year} 年记录热力图`}
          onScroll={updateFadeEdges}
          className="no-scrollbar overflow-x-auto pb-1 lg:overflow-visible"
        >
          <div
            className="inline-flex gap-[5px] lg:grid lg:w-full lg:gap-[3px]"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            }}
          >
            {columns.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-[5px] lg:gap-[3px]">
                <div className="h-4 overflow-visible text-[11px] font-medium whitespace-nowrap text-[var(--fg-muted)]">
                  {col.monthLabel ?? ''}
                </div>
                {col.days.map((day) => {
                  const stat = dayStats.get(day.dateKey);
                  const val =
                    metricMode === 'value' && metricField
                      ? stat?.value ?? 0
                      : stat?.count ?? 0;
                  const isSelected = selectedCell?.dateKey === day.dateKey;
                  const bg = getCellColor(val);
                  const isFirstOfMonth = day.dayOfMonth === 1;

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedCell({
                          dateKey: day.dateKey,
                          count: stat?.count ?? 0,
                          value: stat?.value ?? 0,
                        });
                        if (stat && stat.count > 0 && onSelectDate) {
                          onSelectDate(day.dateKey);
                        }
                      }}
                      aria-label={`${day.dateKey}: ${stat?.count ?? 0} 次`}
                      title={`${day.dateKey}: ${stat?.count ?? 0} 次`}
                      className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[9px] font-semibold transition-transform active:scale-90 lg:aspect-square lg:h-auto lg:w-full lg:rounded-[4px] lg:text-[8px] xl:text-[9px] ${
                        day.isFuture && val === 0 ? 'opacity-45' : ''
                      } ${isSelected ? 'ring-2 ring-[var(--fg-primary)] ring-offset-1 ring-offset-[var(--bg-surface)]' : ''}`}
                      style={{
                        backgroundColor: bg,
                        color: val > 0 ? '#FFFFFF' : 'var(--fg-muted)',
                      }}
                    >
                      {isFirstOfMonth ? '1' : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
