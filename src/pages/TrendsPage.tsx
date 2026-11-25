import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sun,
} from 'lucide-react';
import type { EventItem, EventRecord, Group } from '../types/models';
import { getColorToken, type ResolvedPalette } from '../constants/theme';
import {
  buildAnnualHeatmapColumns,
  getWeekRange,
  startOfDay,
  toDateKey,
} from '../utils/date';
import { EventIcon } from '../components/EventIcon';

type TrendTab = 'week' | 'month' | 'year';
type SortMode = 'default' | 'count' | 'days';

interface TrendsPageProps {
  groups: Group[];
  events: EventItem[];
  records: EventRecord[];
  isDark: boolean;
  onSelectEvent: (eventId: string) => void;
}

/** Airy, borderless MarkTimes-style monthly mini-calendar card */
function EventMonthCard({
  event,
  dayCountMap,
  year,
  monthIndex,
  todayEndTs,
  isDark,
  onSelect,
}: {
  event: EventItem;
  dayCountMap: Map<string, number>;
  year: number;
  monthIndex: number;
  todayEndTs: number;
  isDark: boolean;
  onSelect: () => void;
}) {
  const color = getColorToken(event.color, isDark);

  const { cells, totalCount, activeDays, maxDayCount } = useMemo(() => {
    const first = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const leadingBlanks = (first.getDay() + 6) % 7;

    const list: (null | { key: string; count: number; isFuture: boolean })[] = [];
    for (let i = 0; i < leadingBlanks; i++) list.push(null);

    let sumCount = 0;
    let daysHit = 0;
    let maxC = 1;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIndex, d);
      const key = toDateKey(date);
      const count = dayCountMap.get(key) ?? 0;
      if (count > 0) {
        sumCount += count;
        daysHit += 1;
        if (count > maxC) maxC = count;
      }
      list.push({
        key,
        count,
        isFuture: date.getTime() > todayEndTs,
      });
    }

    return {
      cells: list,
      totalCount: sumCount,
      activeDays: daysHit,
      maxDayCount: maxC,
    };
  }, [dayCountMap, year, monthIndex, todayEndTs]);

  const cellBg = (count: number, isFuture: boolean) => {
    if (count > 0) {
      if (maxDayCount === 1) return color.solid;
      const ratio = count / maxDayCount;
      if (ratio <= 0.34) return color.levels[1];
      if (ratio <= 0.67) return color.levels[2];
      return color.levels[3];
    }
    return isFuture ? 'var(--heatmap-empty)' : color.soft;
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className="daydot-card flex flex-col justify-between rounded-[22px] bg-[var(--bg-surface)] px-4 py-4 text-left transition-[transform,box-shadow] duration-150 active:scale-[0.98] lg:p-5 lg:hover:-translate-y-0.5 lg:hover:shadow-[0_6px_22px_rgba(15,23,42,0.06)]"
    >
      {/* Header: Soft circular icon + light-weight title */}
      <div className="mb-4 flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: color.soft, color: color.ink }}
        >
          <EventIcon name={event.icon} className="h-3.5 w-3.5 stroke-[1.9]" />
        </div>
        <span className="truncate text-[14px] font-medium text-[var(--fg-primary)]">
          {event.name}
        </span>
      </div>

      {/* Airy 7-column calendar squares with generous spacing */}
      <div className="grid grid-cols-7 gap-[6px]">
        {cells.map((cell, idx) =>
          cell === null ? (
            <span key={`b-${idx}`} className="aspect-square" />
          ) : (
            <span
              key={cell.key}
              className="aspect-square rounded-[4px]"
              style={{
                backgroundColor: cellBg(cell.count, cell.isFuture),
                opacity: cell.count === 0 && !cell.isFuture ? (isDark ? 0.55 : 0.78) : 1,
              }}
            />
          ),
        )}
      </div>

      {/* Clean borderless footer separated purely by whitespace */}
      <div className="mt-4 flex items-center justify-around pt-1 text-[13px] font-normal text-[var(--fg-secondary)] tabular-nums">
        <span className="inline-flex items-center gap-1.5" title="本月记录次数">
          <CheckCircle2 className="h-3.5 w-3.5 stroke-[1.7] text-[var(--fg-secondary)]" />
          {totalCount}
        </span>
        <span className="h-2.5 w-[1px] bg-[var(--border-color)]" aria-hidden="true" />
        <span className="inline-flex items-center gap-1.5" title="本月记录天数">
          <Sun className="h-3.5 w-3.5 stroke-[1.7] text-[var(--fg-secondary)]" />
          {activeDays}
        </span>
      </div>
    </button>
  );
}

/** Compact annual heatmap card per event */
function EventYearCard({
  event,
  dayCountMap,
  year,
  columns,
  isDark,
  onSelect,
}: {
  event: EventItem;
  dayCountMap: Map<string, number>;
  year: number;
  columns: ReturnType<typeof buildAnnualHeatmapColumns>;
  isDark: boolean;
  onSelect: () => void;
}) {
  const color: ResolvedPalette = getColorToken(event.color, isDark);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { totalCount, activeDays, maxDayCount } = useMemo(() => {
    const prefix = `${year}-`;
    let sum = 0;
    let days = 0;
    let maxC = 1;
    dayCountMap.forEach((cnt, key) => {
      if (key.startsWith(prefix) && cnt > 0) {
        sum += cnt;
        days += 1;
        if (cnt > maxC) maxC = cnt;
      }
    });
    return { totalCount: sum, activeDays: days, maxDayCount: maxC };
  }, [dayCountMap, year]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    if (year === now.getFullYear()) {
      const ratio = (now.getMonth() + 1) / 12;
      el.scrollLeft = Math.max(0, el.scrollWidth * ratio - el.clientWidth * 0.78);
    } else {
      el.scrollLeft = 0;
    }
  }, [year]);

  const cellBg = (count: number, isFuture: boolean) => {
    if (count > 0) {
      if (maxDayCount === 1) return color.solid;
      const ratio = count / maxDayCount;
      if (ratio <= 0.34) return color.levels[1];
      if (ratio <= 0.67) return color.levels[2];
      return color.levels[3];
    }
    return isFuture ? 'var(--heatmap-empty)' : color.soft;
  };

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="daydot-card cursor-pointer rounded-[22px] bg-[var(--bg-surface)] p-4 transition-transform duration-150 active:scale-[0.99]"
    >
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: color.soft, color: color.ink }}
          >
            <EventIcon name={event.icon} className="h-3.5 w-3.5 stroke-[1.9]" />
          </div>
          <span className="truncate text-[14px] font-medium text-[var(--fg-primary)]">
            {event.name}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 text-[13px] font-normal text-[var(--fg-secondary)] tabular-nums">
          <span className="inline-flex items-center gap-1" title="本年记录次数">
            <CheckCircle2 className="h-3.5 w-3.5 stroke-[1.7] text-[var(--fg-secondary)]" />
            {totalCount}
          </span>
          <span className="h-2.5 w-[1px] bg-[var(--border-color)]" aria-hidden="true" />
          <span className="inline-flex items-center gap-1" title="本年记录天数">
            <Sun className="h-3.5 w-3.5 stroke-[1.7] text-[var(--fg-secondary)]" />
            {activeDays}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label={`${event.name} ${year} 年记录热力图`}
        onClick={(e) => e.stopPropagation()}
        className="no-scrollbar overflow-x-auto pb-0.5 lg:overflow-visible"
      >
        <div
          className="inline-flex gap-[4px] lg:grid lg:w-full lg:gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          }}
        >
          {columns.map((col, cIdx) => (
            <div key={cIdx} className="flex flex-col gap-[4px] lg:gap-[3px]">
              {col.days.map((day) => {
                const inYear = day.date.getFullYear() === year;
                if (!inYear) {
                  return (
                    <span
                      key={day.dateKey}
                      className="h-[11px] w-[11px] lg:aspect-square lg:h-auto lg:w-full"
                    />
                  );
                }
                const cnt = dayCountMap.get(day.dateKey) ?? 0;
                return (
                  <span
                    key={day.dateKey}
                    title={`${day.dateKey}: ${cnt} 次`}
                    className="h-[11px] w-[11px] rounded-[2.5px] lg:aspect-square lg:h-auto lg:w-full lg:rounded-[3px]"
                    style={{
                      backgroundColor: cellBg(cnt, day.isFuture),
                      opacity:
                        cnt === 0 && !day.isFuture ? (isDark ? 0.52 : 0.72) : 1,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrendsPage({
  groups,
  events,
  records,
  isDark,
  onSelectEvent,
}: TrendsPageProps) {
  const [tab, setTab] = useState<TrendTab>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const emerald = getColorToken('emerald', isDark);

  const activeEvents = useMemo(
    () =>
      [...events]
        .filter((e) => !e.archived)
        .sort((a, b) => {
          const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
          if (pinDiff !== 0) return pinDiff;
          return a.order - b.order;
        }),
    [events],
  );

  const lifetimeStats = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const recordDaySet = new Set<string>();
    let earliestTs = todayStart;

    for (const ev of activeEvents) {
      if (ev.createdAt && ev.createdAt < earliestTs) earliestTs = ev.createdAt;
    }
    for (const rec of records) {
      recordDaySet.add(toDateKey(rec.timestamp));
      if (rec.timestamp < earliestTs) earliestTs = rec.timestamp;
    }

    const usageDays = Math.max(
      1,
      Math.floor((todayStart - startOfDay(earliestTs).getTime()) / 86_400_000) + 1,
    );

    return {
      eventTotal: activeEvents.length,
      recordTotal: records.length,
      usageDays,
      recordDays: recordDaySet.size,
    };
  }, [activeEvents, records]);

  const countsByEventDay = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of records) {
      let dayMap = map.get(r.eventId);
      if (!dayMap) {
        dayMap = new Map<string, number>();
        map.set(r.eventId, dayMap);
      }
      const key = toDateKey(r.timestamp);
      dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    }
    return map;
  }, [records]);

  const weekInfo = useMemo(() => getWeekRange(anchor), [anchor]);
  const todayEndTs = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, []);

  const annualColumns = useMemo(
    () => buildAnnualHeatmapColumns(anchor.getFullYear()),
    [anchor],
  );

  const rangeLabel = useMemo(() => {
    if (tab === 'week') {
      const s = weekInfo.start;
      const e = weekInfo.end;
      return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 - ${e.getFullYear()}年${e.getMonth() + 1}月${e.getDate()}日`;
    }
    if (tab === 'month') {
      return `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`;
    }
    return `${anchor.getFullYear()}年`;
  }, [tab, weekInfo, anchor]);

  const isCurrentPeriod = useMemo(() => {
    const today = new Date();
    if (tab === 'year') return anchor.getFullYear() === today.getFullYear();
    if (tab === 'month') {
      return (
        anchor.getFullYear() === today.getFullYear() &&
        anchor.getMonth() === today.getMonth()
      );
    }
    return (
      toDateKey(getWeekRange(anchor).start) === toDateKey(getWeekRange(today).start)
    );
  }, [tab, anchor]);

  const resetLabel =
    tab === 'week' ? '回到本周' : tab === 'month' ? '回到本月' : '回到今年';

  const shiftPeriod = (delta: number) => {
    const d = new Date(anchor);
    if (tab === 'week') d.setDate(d.getDate() + delta * 7);
    else if (tab === 'month') d.setMonth(d.getMonth() + delta);
    else d.setFullYear(d.getFullYear() + delta);
    setAnchor(d);
  };

  const visibleEvents = useMemo(() => {
    const filtered =
      selectedGroupId === 'all'
        ? activeEvents
        : activeEvents.filter((e) => e.groupId === selectedGroupId);

    if (sortMode === 'default') return filtered;

    const getMetrics = (eventId: string) => {
      const dayMap = countsByEventDay.get(eventId);
      if (!dayMap) return { count: 0, days: 0 };
      let count = 0;
      let days = 0;

      if (tab === 'week') {
        for (const d of weekInfo.days) {
          const c = dayMap.get(toDateKey(d)) ?? 0;
          if (c > 0) {
            count += c;
            days += 1;
          }
        }
      } else if (tab === 'month') {
        const prefix = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-`;
        dayMap.forEach((c, k) => {
          if (k.startsWith(prefix) && c > 0) {
            count += c;
            days += 1;
          }
        });
      } else {
        const prefix = `${anchor.getFullYear()}-`;
        dayMap.forEach((c, k) => {
          if (k.startsWith(prefix) && c > 0) {
            count += c;
            days += 1;
          }
        });
      }
      return { count, days };
    };

    return [...filtered].sort((a, b) => {
      const ma = getMetrics(a.id);
      const mb = getMetrics(b.id);
      if (sortMode === 'count') return mb.count - ma.count || mb.days - ma.days;
      return mb.days - ma.days || mb.count - ma.count;
    });
  }, [activeEvents, selectedGroupId, sortMode, countsByEventDay, tab, weekInfo, anchor]);

  const cycleSort = () => {
    setSortMode((prev) =>
      prev === 'default' ? 'count' : prev === 'count' ? 'days' : 'default',
    );
  };

  const sortBadgeText =
    sortMode === 'count' ? '按次数' : sortMode === 'days' ? '按天数' : null;

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      shiftPeriod(dx < 0 ? 1 : -1);
    }
  };

  return (
    <div className="flex flex-col pb-24 lg:pb-12">
      <header className="pt-safe sticky top-0 z-20 bg-[var(--bg-canvas-blur)] px-5 pb-2.5 backdrop-blur-md lg:px-8 lg:pt-7 lg:pb-4">
        <div className="mx-auto w-full max-w-[1160px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-[24px] font-semibold tracking-tight text-[var(--fg-primary)] lg:text-[26px]">
                趋势
              </h1>
              {sortBadgeText && (
                <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-secondary)] lg:hidden">
                  {sortBadgeText}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 lg:gap-2">
              {groups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  aria-label="按分组筛选"
                  title="按分组筛选"
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95 lg:hidden ${
                    filterOpen || selectedGroupId !== 'all'
                      ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)]'
                      : 'bg-[var(--bg-surface)] text-[var(--fg-secondary)]'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5 stroke-[1.9]" />
                </button>
              )}

              <button
                type="button"
                onClick={cycleSort}
                aria-label="切换排序方式"
                title="切换排序：默认 / 按次数 / 按天数"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95 lg:h-9 lg:w-auto lg:gap-1.5 lg:px-3.5 lg:text-xs lg:font-medium ${
                  sortMode !== 'default'
                    ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)]'
                    : 'bg-[var(--bg-surface)] text-[var(--fg-secondary)] lg:border lg:border-[var(--border-color)] lg:hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <ArrowUpDown className="h-3.5 w-3.5 stroke-[1.9]" />
                <span className="hidden lg:inline">
                  {sortBadgeText ? `排序：${sortBadgeText}` : '默认排序'}
                </span>
              </button>
            </div>
          </div>

          {groups.length > 0 && (
            <div
              className={`no-scrollbar mt-2.5 items-center gap-1.5 overflow-x-auto pb-0.5 lg:mt-3.5 lg:flex ${
                filterOpen ? 'flex' : 'hidden'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedGroupId('all')}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition lg:px-3.5 lg:py-1.5 lg:text-[13px] ${
                  selectedGroupId === 'all'
                    ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)]'
                    : 'bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                全部分组
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition lg:px-3.5 lg:py-1.5 lg:text-[13px] ${
                    selectedGroupId === g.id
                      ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)]'
                      : 'bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="px-4 pt-1 lg:px-8 lg:pt-2">
        <div className="mx-auto w-full max-w-[1160px] space-y-4 lg:space-y-5">
          {/* Top Lifetime Summary Cards: 2x2 on mobile, 4-col row on desktop */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] px-4 py-3.5 lg:px-5 lg:py-4">
              <div className="text-[22px] leading-tight font-medium text-[var(--fg-primary)] tabular-nums lg:text-[26px]">
                {lifetimeStats.eventTotal}
              </div>
              <div className="mt-1 text-xs text-[var(--fg-muted)]">事件总数</div>
            </div>

            <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] px-4 py-3.5 lg:px-5 lg:py-4">
              <div className="text-[22px] leading-tight font-medium text-[var(--fg-primary)] tabular-nums lg:text-[26px]">
                {lifetimeStats.recordTotal}
              </div>
              <div className="mt-1 text-xs text-[var(--fg-muted)]">记录次数</div>
            </div>

            <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] px-4 py-3.5 lg:px-5 lg:py-4">
              <div className="text-[22px] leading-tight font-medium text-[var(--fg-primary)] tabular-nums lg:text-[26px]">
                {lifetimeStats.usageDays}
              </div>
              <div className="mt-1 text-xs text-[var(--fg-muted)]">使用天数</div>
            </div>

            <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] px-4 py-3.5 lg:px-5 lg:py-4">
              <div className="text-[22px] leading-tight font-medium text-[var(--fg-primary)] tabular-nums lg:text-[26px]">
                {lifetimeStats.recordDays}
              </div>
              <div className="mt-1 text-xs text-[var(--fg-muted)]">记录天数</div>
            </div>
          </section>

          {/* Segmented Control + Date Stepper (stacked on mobile, sleek single toolbar on desktop) */}
          <div className="space-y-3 lg:flex lg:items-center lg:justify-between lg:space-y-0 lg:rounded-[20px] lg:bg-[var(--bg-surface)] lg:px-4 lg:py-2.5">
            <div
              role="tablist"
              aria-label="趋势时间维度"
              className="grid grid-cols-3 rounded-full bg-[var(--bg-subtle)] p-1 lg:w-[240px]"
            >
              {(
                [
                  ['week', '周'],
                  ['month', '月'],
                  ['year', '年'],
                ] as [TrendTab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`rounded-full py-1.5 text-[13px] font-medium transition ${
                    tab === id
                      ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Date Range Stepper */}
            <div className="relative flex min-h-8 items-center justify-center lg:gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftPeriod(-1)}
                  aria-label="上一周期"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle-hover)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[13px] font-medium text-[var(--fg-muted)] tabular-nums lg:text-sm lg:text-[var(--fg-primary)]">
                  {rangeLabel}
                </span>
                <button
                  type="button"
                  onClick={() => shiftPeriod(1)}
                  aria-label="下一周期"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle-hover)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {!isCurrentPeriod && (
                <button
                  type="button"
                  onClick={() => setAnchor(new Date())}
                  aria-label={resetLabel}
                  title={resetLabel}
                  className="absolute right-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition active:scale-90 lg:static"
                  style={{ backgroundColor: emerald.soft, color: emerald.ink }}
                >
                  今
                </button>
              )}
            </div>
          </div>

          {visibleEvents.length === 0 ? (
            <div className="rounded-[22px] bg-[var(--bg-surface)] py-12 text-center text-xs text-[var(--fg-muted)]">
              当前筛选下暂无事件
            </div>
          ) : (
            <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              {/* WEEK VIEW: Airy 7-Day Circle Matrix */}
              {tab === 'week' && (
                <section className="daydot-card rounded-[24px] bg-[var(--bg-surface)] px-4 py-4 lg:px-6 lg:py-5">
                  <div className="mb-3.5 grid grid-cols-[minmax(0,1fr)_repeat(7,25px)] items-center gap-1.5 lg:mb-4 lg:grid-cols-[minmax(0,1fr)_repeat(7,48px)] xl:grid-cols-[minmax(0,1fr)_repeat(7,56px)]">
                    <div className="hidden text-xs font-medium text-[var(--fg-muted)] lg:block">
                      事件
                    </div>
                    <div className="lg:hidden" />
                    {['一', '二', '三', '四', '五', '六', '日'].map((w, idx) => {
                      const isTodayCol =
                        toDateKey(weekInfo.days[idx]) === toDateKey(new Date());
                      return (
                        <div
                          key={w}
                          className={`text-center text-xs font-normal ${
                            isTodayCol
                              ? 'font-medium text-[var(--fg-primary)]'
                              : 'text-[var(--fg-muted)]'
                          }`}
                        >
                          <span className="lg:hidden">{w}</span>
                          <span className="hidden lg:inline">周{w}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-3.5 lg:space-y-2.5">
                    {visibleEvents.map((ev) => {
                      const color = getColorToken(ev.color, isDark);
                      const dayMap = countsByEventDay.get(ev.id);

                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onSelectEvent(ev.id)}
                          className="grid w-full grid-cols-[minmax(0,1fr)_repeat(7,25px)] items-center gap-1.5 rounded-xl py-0.5 text-left transition hover:bg-[var(--bg-canvas)] active:scale-[0.99] lg:grid-cols-[minmax(0,1fr)_repeat(7,48px)] lg:px-2 lg:py-2 xl:grid-cols-[minmax(0,1fr)_repeat(7,56px)]"
                        >
                          <div className="flex min-w-0 items-center gap-2 pr-1 lg:gap-2.5">
                            <div
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full lg:h-7 lg:w-7"
                              style={{ backgroundColor: color.soft, color: color.ink }}
                            >
                              <EventIcon
                                name={ev.icon}
                                className="h-3.5 w-3.5 stroke-[1.9] lg:h-4 lg:w-4"
                              />
                            </div>
                            <span className="truncate text-[14px] font-normal text-[var(--fg-primary)] lg:font-medium">
                              {ev.name}
                            </span>
                          </div>

                          {weekInfo.days.map((d) => {
                            const key = toDateKey(d);
                            const cnt = dayMap?.get(key) ?? 0;
                            const isFuture = d.getTime() > todayEndTs;

                            return (
                              <span
                                key={key}
                                title={`${ev.name} · ${key}: ${cnt} 次`}
                                className="mx-auto flex h-[19px] w-[19px] items-center justify-center rounded-full text-[10px] font-medium lg:h-[24px] lg:w-[24px] lg:text-[11px]"
                                style={
                                  cnt > 0
                                    ? {
                                        backgroundColor: color.solid,
                                        color: '#FFFFFF',
                                      }
                                    : {
                                        backgroundColor: isFuture
                                          ? 'var(--heatmap-empty)'
                                          : color.soft,
                                        opacity: !isFuture ? (isDark ? 0.58 : 0.82) : 0.72,
                                      }
                                }
                              >
                                {cnt > 1 ? cnt : ''}
                              </span>
                            );
                          })}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* MONTH VIEW: Adaptive Multi-Column Per-Event Mini Calendars */}
              {tab === 'month' && (
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fill,minmax(236px,1fr))] lg:gap-4">
                  {visibleEvents.map((ev) => (
                    <EventMonthCard
                      key={ev.id}
                      event={ev}
                      dayCountMap={countsByEventDay.get(ev.id) ?? new Map()}
                      year={anchor.getFullYear()}
                      monthIndex={anchor.getMonth()}
                      todayEndTs={todayEndTs}
                      isDark={isDark}
                      onSelect={() => onSelectEvent(ev.id)}
                    />
                  ))}
                </section>
              )}

              {/* YEAR VIEW: Full-Width Stacked Annual Heatmap Cards */}
              {tab === 'year' && (
                <section className="space-y-3 lg:space-y-4">
                  {visibleEvents.map((ev) => (
                    <EventYearCard
                      key={ev.id}
                      event={ev}
                      dayCountMap={countsByEventDay.get(ev.id) ?? new Map()}
                      year={anchor.getFullYear()}
                      columns={annualColumns}
                      isDark={isDark}
                      onSelect={() => onSelectEvent(ev.id)}
                    />
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
