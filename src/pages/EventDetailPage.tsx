import { useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
} from 'lucide-react';
import type { EventItem, EventRecord, SelectFieldDef } from '../types/models';
import { getColorToken } from '../constants/theme';
import {
  buildMonthGrid,
  formatCompactInterval,
  formatFullDate,
  formatMonthTitle,
  formatTime,
  formatWeekday,
  getWeekRange,
  toDateKey,
} from '../utils/date';
import {
  computePeriodStats,
  computeSelectFieldStats,
  extractNumericValue,
  formatCleanNumber,
  getPrimaryNumberField,
  type StatsPeriod,
} from '../utils/stats';
import { AnnualHeatmap } from '../components/AnnualHeatmap';
import { BarChartCard } from '../components/BarChartCard';
import { RecordValueChips } from '../components/RecordValueChips';

interface EventDetailPageProps {
  event: EventItem;
  records: EventRecord[];
  isDark: boolean;
  onBack: () => void;
  onEditEvent: (event: EventItem) => void;
  onAddRecord: (event: EventItem, initialTimestamp?: number) => void;
  onEditRecord: (event: EventItem, record: EventRecord) => void;
}

export function EventDetailPage({
  event,
  records,
  isDark,
  onBack,
  onEditEvent,
  onAddRecord,
  onEditRecord,
}: EventDetailPageProps) {
  const color = getColorToken(event.color, isDark);
  const primaryNumberField = useMemo(() => getPrimaryNumberField(event), [event]);

  const [tab, setTab] = useState<'records' | 'stats'>('records');
  const [timeDisplayMode, setTimeDisplayMode] = useState<'clock' | 'interval'>(() => {
    try {
      return localStorage.getItem('daydot_timeline_time_mode') === 'interval'
        ? 'interval'
        : 'clock';
    } catch {
      return 'clock';
    }
  });

  const toggleTimeDisplayMode = () => {
    setTimeDisplayMode((prev) => {
      const next = prev === 'clock' ? 'interval' : 'clock';
      try {
        localStorage.setItem('daydot_timeline_time_mode', next);
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  // Record Tab Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);

  // Stats Tab state
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [statsAnchor, setStatsAnchor] = useState(() => new Date());
  const [metricMode, setMetricMode] = useState<'count' | 'value'>(() =>
    primaryNumberField ? 'value' : 'count',
  );

  // Touch swipe tracking for calendar & stats period navigation
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (onPrev: () => void, onNext: () => void) => (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) onNext();
      else onPrev();
    }
  };

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.timestamp - a.timestamp),
    [records],
  );

  // Map each recordId -> compact interval since the immediately preceding earlier record of this event
  const intervalByRecordId = useMemo(() => {
    const map = new Map<string, string>();
    // sortedRecords is descending (newest -> oldest), so sortedRecords[i + 1] is the previous earlier record
    for (let i = 0; i < sortedRecords.length; i++) {
      const cur = sortedRecords[i];
      const prev = sortedRecords[i + 1];
      map.set(
        cur.id,
        prev ? formatCompactInterval(cur.timestamp - prev.timestamp) : '-',
      );
    }
    return map;
  }, [sortedRecords]);

  const recordCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      const k = toDateKey(r.timestamp);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [records]);

  const monthCells = useMemo(
    () => buildMonthGrid(calYear, calMonth),
    [calYear, calMonth],
  );

  const isCurrentCalMonth =
    calYear === now.getFullYear() && calMonth === now.getMonth();

  const isCurrentStatsPeriod = useMemo(() => {
    const today = new Date();
    if (period === 'all') return true;
    if (period === 'year') return statsAnchor.getFullYear() === today.getFullYear();
    if (period === 'month') {
      return (
        statsAnchor.getFullYear() === today.getFullYear() &&
        statsAnchor.getMonth() === today.getMonth()
      );
    }
    // week
    return (
      toDateKey(getWeekRange(statsAnchor).start) ===
      toDateKey(getWeekRange(today).start)
    );
  }, [period, statsAnchor]);

  const resetPeriodLabel =
    period === 'week' ? '回到本周' : period === 'month' ? '回到本月' : '回到今年';

  const timelineGroups = useMemo(() => {
    const list = selectedDateKey
      ? sortedRecords.filter((r) => toDateKey(r.timestamp) === selectedDateKey)
      : sortedRecords;

    const grouped: { dateKey: string; weekday: string; title: string; items: EventRecord[] }[] = [];
    const indexMap = new Map<string, number>();

    for (const rec of list) {
      const key = toDateKey(rec.timestamp);
      const idx = indexMap.get(key);
      if (idx !== undefined) {
        grouped[idx].items.push(rec);
      } else {
        indexMap.set(key, grouped.length);
        grouped.push({
          dateKey: key,
          weekday: formatWeekday(rec.timestamp),
          title: formatFullDate(rec.timestamp),
          items: [rec],
        });
      }
    }
    return grouped;
  }, [sortedRecords, selectedDateKey]);

  const effectiveMetricMode: 'count' | 'value' =
    primaryNumberField && metricMode === 'value' ? 'value' : 'count';

  const stats = useMemo(
    () => computePeriodStats(sortedRecords, period, statsAnchor, primaryNumberField),
    [sortedRecords, period, statsAnchor, primaryNumberField],
  );

  const numericInsights = useMemo(() => {
    if (!primaryNumberField || stats.filteredRecords.length === 0) return null;
    const vals = stats.filteredRecords.map((r) =>
      extractNumericValue(r, primaryNumberField.id),
    );
    const sum = vals.reduce((a, b) => a + b, 0);
    const max = Math.max(...vals);
    const avg = sum / vals.length;
    return { sum, max, avg };
  }, [primaryNumberField, stats.filteredRecords]);

  const selectFields = useMemo(
    () => event.fields.filter((f): f is SelectFieldDef => f.type === 'select'),
    [event.fields],
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const shiftStatsPeriod = (delta: number) => {
    const d = new Date(statsAnchor);
    if (period === 'week') d.setDate(d.getDate() + delta * 7);
    else if (period === 'month') d.setMonth(d.getMonth() + delta);
    else if (period === 'year') d.setFullYear(d.getFullYear() + delta);
    setStatsAnchor(d);
  };

  const handleFabClick = () => {
    if (selectedDateKey) {
      const target = new Date(`${selectedDateKey}T12:00:00`);
      const nowTime = new Date();
      target.setHours(nowTime.getHours(), nowTime.getMinutes(), 0, 0);
      onAddRecord(event, target.getTime());
    } else {
      onAddRecord(event);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg-canvas)] pb-24">
      {/* Clean balanced Header: Back | Segmented Tabs | Edit (delete safely inside Edit sheet) */}
      <header className="pt-safe-sm sticky top-0 z-20 flex items-center justify-between bg-[var(--bg-canvas-blur)] px-4 pb-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回主页"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-primary)] transition hover:bg-[var(--bg-subtle-hover)] active:scale-95"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <div
          role="tablist"
          aria-label="事件视图切换"
          className="inline-flex overflow-hidden rounded-full"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${color.solid}`,
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'records'}
            onClick={() => setTab('records')}
            className="rounded-full px-5 py-1 text-[13px] font-medium transition"
            style={
              tab === 'records'
                ? { backgroundColor: color.solid, color: '#FFFFFF' }
                : { color: 'var(--fg-secondary)' }
            }
          >
            记录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'stats'}
            onClick={() => setTab('stats')}
            className="rounded-full px-5 py-1 text-[13px] font-medium transition"
            style={
              tab === 'stats'
                ? { backgroundColor: color.solid, color: '#FFFFFF' }
                : { color: 'var(--fg-secondary)' }
            }
          >
            统计
          </button>
        </div>

        <button
          type="button"
          onClick={() => onEditEvent(event)}
          aria-label="编辑事件"
          title="编辑事件"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-secondary)] transition hover:bg-[var(--bg-subtle-hover)] active:scale-95"
        >
          <Pencil className="h-4.5 w-4.5" />
        </button>
      </header>

      {/* Event Name Banner */}
      <div className="flex items-center justify-between px-5 pb-1.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color.solid }}
          />
          <h1 className="text-[16px] font-medium text-[var(--fg-primary)]">{event.name}</h1>
          <span className="text-xs text-[var(--fg-muted)]">
            共 {records.length} 条记录
          </span>
        </div>
        {selectedDateKey && tab === 'records' && (
          <button
            type="button"
            onClick={() => setSelectedDateKey(null)}
            className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--fg-secondary)]"
          >
            显示全部 ×
          </button>
        )}
      </div>

      {/* ==================== TAB 1: 记录 ==================== */}
      {tab === 'records' && (
        <main className="flex flex-1 flex-col">
          <section
            className="px-4 pb-2"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd(
              () => shiftMonth(-1),
              () => shiftMonth(1),
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-medium text-[var(--fg-primary)]">
                  {formatMonthTitle(calYear, calMonth)}
                </span>
                {!isCurrentCalMonth && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = new Date();
                      setCalYear(t.getFullYear());
                      setCalMonth(t.getMonth());
                    }}
                    aria-label="回到本月"
                    title="回到本月"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition active:scale-90"
                    style={{ backgroundColor: color.soft, color: color.ink }}
                  >
                    今
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="上个月"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle-hover)]"
                >
                  <ChevronLeft className="h-4.5 w-4.5" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="下个月"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle-hover)]"
                >
                  <ChevronRight className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {!calendarCollapsed && (
              <>
                <div className="grid grid-cols-7 text-center text-xs font-normal text-[var(--fg-muted)]">
                  {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((w) => (
                    <div key={w} className="py-1.5">
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {monthCells.map((cell) => {
                    const count = recordCountByDay.get(cell.dateKey) ?? 0;
                    const isSelected = selectedDateKey === cell.dateKey;
                    const hasRecord = count > 0;

                    let bg = 'transparent';
                    let fg = cell.inCurrentMonth
                      ? 'var(--fg-primary)'
                      : 'var(--fg-muted)';

                    if (isSelected) {
                      bg = 'var(--pill-active-bg)';
                      fg = 'var(--pill-active-fg)';
                    } else if (hasRecord) {
                      bg = color.solid;
                      fg = '#FFFFFF';
                    } else if (cell.isToday) {
                      bg = color.soft;
                      fg = color.ink;
                    }

                    return (
                      <div
                        key={cell.dateKey}
                        className={`flex flex-col items-center justify-center py-0.5 ${
                          !cell.inCurrentMonth && !hasRecord && !isSelected
                            ? 'opacity-45'
                            : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDateKey(isSelected ? null : cell.dateKey)
                          }
                          className={`relative flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition active:scale-90 ${
                            hasRecord || isSelected || cell.isToday
                              ? 'font-medium'
                              : 'font-normal'
                          }`}
                          style={{ backgroundColor: bg, color: fg }}
                        >
                          {cell.isToday ? '今' : cell.dayNum}
                          {count > 1 && (
                            <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[var(--pill-active-bg)] px-0.5 text-[9px] font-medium text-[var(--pill-active-fg)] ring-1 ring-[var(--bg-canvas)]">
                              {count}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setCalendarCollapsed((v) => !v)}
              aria-label={calendarCollapsed ? '展开月历' : '收起月历'}
              className="mt-1 flex w-full justify-center py-1.5"
            >
              <span className="h-1 w-9 rounded-full bg-[var(--border-color)]" />
            </button>
          </section>

          {/* Rounded Vertical Timeline Sheet with ONE continuous vertical rail tucked cleanly left */}
          <section className="flex-1 rounded-t-[26px] bg-[var(--bg-surface)] pt-5 pr-4 pb-24 pl-2.5">
            {timelineGroups.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-normal text-[var(--fg-muted)]">
                  {selectedDateKey
                    ? `${selectedDateKey} 还没有记录`
                    : '还没有任何记录'}
                </p>
                <button
                  type="button"
                  onClick={handleFabClick}
                  className="mt-3 rounded-full px-4 py-1.5 text-xs font-medium text-white"
                  style={{ backgroundColor: color.solid }}
                >
                  + 立即补记一条
                </button>
              </div>
            ) : (
              <div className="relative space-y-5">
                {/* Single continuous hairline passing dead-center through every dot:
                    w-8 (32px) + mr-2 (8px) + half of w-2.5 (5px) = 45px */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-2.5 bottom-5 left-[44.5px] w-[1px] bg-[var(--rail-color)]"
                />

                {timelineGroups.map((group) => (
                  <div key={group.dateKey} className="space-y-3">
                    <div className="flex items-center">
                      <span className="mr-2 w-8 shrink-0 text-right text-xs font-normal text-[var(--fg-secondary)]">
                        {group.weekday}
                      </span>
                      <span
                        className="relative z-10 mr-3 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color.solid }}
                      />
                      <span className="text-[14px] font-normal text-[var(--fg-primary)]">
                        {group.title}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {group.items.map((rec) => {
                        const timeLabel =
                          timeDisplayMode === 'interval'
                            ? intervalByRecordId.get(rec.id) ?? '-'
                            : formatTime(rec.timestamp);

                        return (
                          <div key={rec.id} className="flex items-start">
                            <button
                              type="button"
                              onClick={toggleTimeDisplayMode}
                              title={
                                timeDisplayMode === 'clock'
                                  ? '点击切换为时间间隔'
                                  : '点击切换回具体时间'
                              }
                              aria-label={
                                timeDisplayMode === 'clock'
                                  ? `时间 ${timeLabel}，点击切换为间隔显示`
                                  : `距上次间隔 ${timeLabel}，点击切换回时间点`
                              }
                              className="mr-2 w-8 shrink-0 pt-3 text-right text-[11px] font-normal tabular-nums transition opacity-90 hover:opacity-100 active:scale-95"
                              style={{ color: color.ink }}
                            >
                              {timeLabel}
                            </button>

                            <div className="relative z-10 mr-3 flex w-2.5 shrink-0 justify-center pt-3.5">
                              <span
                                className="h-2.5 w-2.5 rounded-full border-[1.75px] bg-[var(--bg-surface)]"
                                style={{ borderColor: color.solid }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => onEditRecord(event, rec)}
                              className="flex-1 rounded-[16px] bg-[var(--bg-canvas)] px-4 py-3 text-left transition hover:bg-[var(--bg-subtle)] active:scale-[0.99]"
                            >
                              <RecordValueChips
                                event={event}
                                record={rec}
                                isDark={isDark}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Properly anchored FAB container — always 20px inside the 460px app frame */}
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 mx-auto flex max-w-[460px] justify-end px-5">
            <button
              type="button"
              onClick={handleFabClick}
              aria-label="新增记录"
              className="pointer-events-auto flex h-13 w-13 items-center justify-center rounded-full text-white shadow-md transition active:scale-90"
              style={{ backgroundColor: color.solid }}
            >
              <Plus className="h-6 w-6 stroke-[2.2]" />
            </button>
          </div>
        </main>
      )}

      {/* ==================== TAB 2: 统计 ==================== */}
      {tab === 'stats' && (
        <main className="space-y-3.5 px-4 pt-1 pb-6">
          <div className="grid grid-cols-4 rounded-xl bg-[var(--bg-subtle)] p-1">
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

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            {period !== 'all' ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => shiftStatsPeriod(-1)}
                  aria-label="上一周期"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle-hover)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-[var(--fg-primary)]">
                  {stats.rangeLabel}
                </span>
                <button
                  type="button"
                  onClick={() => shiftStatsPeriod(1)}
                  aria-label="下一周期"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle-hover)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {!isCurrentStatsPeriod && (
                  <button
                    type="button"
                    onClick={() => setStatsAnchor(new Date())}
                    aria-label={resetPeriodLabel}
                    title={resetPeriodLabel}
                    className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition active:scale-90"
                    style={{ backgroundColor: color.soft, color: color.ink }}
                  >
                    今
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm font-semibold text-[var(--fg-primary)]">
                全部历史统计
              </span>
            )}

            {primaryNumberField && (
              <div className="inline-flex rounded-full bg-[var(--bg-subtle)] p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setMetricMode('value')}
                  className="rounded-full px-2.5 py-1 transition"
                  style={
                    effectiveMetricMode === 'value'
                      ? { backgroundColor: color.solid, color: '#FFFFFF' }
                      : { color: 'var(--fg-secondary)' }
                  }
                >
                  {primaryNumberField.name}({primaryNumberField.unit})
                </button>
                <button
                  type="button"
                  onClick={() => setMetricMode('count')}
                  className="rounded-full px-2.5 py-1 transition"
                  style={
                    effectiveMetricMode === 'count'
                      ? { backgroundColor: color.solid, color: '#FFFFFF' }
                      : { color: 'var(--fg-secondary)' }
                  }
                >
                  次数
                </button>
              </div>
            )}
          </div>

          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd(
              () => {
                if (period !== 'all') shiftStatsPeriod(-1);
              },
              () => {
                if (period !== 'all') shiftStatsPeriod(1);
              },
            )}
          >
            <BarChartCard
              bars={stats.bars}
              color={color}
              mode={effectiveMetricMode}
              unit={primaryNumberField?.unit || '次'}
            />
          </div>

          {/* 2x2 KPI Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] p-4">
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-medium text-[var(--fg-primary)] tabular-nums">
                  {stats.totalCount}
                </span>
                <span className="text-xs text-[var(--fg-muted)]">次</span>
              </div>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">记录次数</p>
            </div>

            <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] p-4">
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-medium text-[var(--fg-primary)] tabular-nums">
                  {stats.activeDays}
                </span>
                <span className="text-xs text-[var(--fg-muted)]">天</span>
              </div>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">记录天数</p>
            </div>

            <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] p-4">
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-medium text-[var(--fg-primary)] tabular-nums">
                  {formatCleanNumber(stats.dailyAverage)}
                </span>
                <span className="text-xs text-[var(--fg-muted)]">次</span>
              </div>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">每日平均</p>
            </div>

            <div className="daydot-card rounded-[20px] bg-[var(--bg-surface)] p-4">
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-medium text-[var(--fg-primary)] tabular-nums">
                  {stats.averageIntervalDays === null
                    ? '-'
                    : formatCleanNumber(stats.averageIntervalDays)}
                </span>
                {stats.averageIntervalDays !== null && (
                  <span className="text-xs text-[var(--fg-muted)]">天</span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">平均间隔</p>
            </div>
          </div>

          {primaryNumberField && numericInsights && (
            <div className="daydot-card rounded-[22px] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 text-[15px] font-medium text-[var(--fg-primary)]">
                {primaryNumberField.name}统计（{primaryNumberField.unit}）
              </h3>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div
                  className="rounded-2xl py-3"
                  style={{ backgroundColor: color.soft }}
                >
                  <div
                    className="text-lg font-medium tabular-nums"
                    style={{ color: color.ink }}
                  >
                    {formatCleanNumber(numericInsights.sum)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
                    累计总量
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--bg-canvas)] py-3">
                  <div className="text-lg font-medium text-[var(--fg-primary)] tabular-nums">
                    {formatCleanNumber(numericInsights.avg)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
                    单次平均
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--bg-canvas)] py-3">
                  <div className="text-lg font-medium text-[var(--fg-primary)] tabular-nums">
                    {formatCleanNumber(numericInsights.max)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
                    单次最高
                  </div>
                </div>
              </div>
            </div>
          )}

          <AnnualHeatmap
            records={sortedRecords}
            year={statsAnchor.getFullYear()}
            color={color}
            metricField={primaryNumberField}
            metricMode={effectiveMetricMode}
            onSelectDate={(dateKey) => {
              setSelectedDateKey(dateKey);
              const d = new Date(`${dateKey}T00:00:00`);
              setCalYear(d.getFullYear());
              setCalMonth(d.getMonth());
              setTab('records');
            }}
          />

          {selectFields.map((sf) => {
            const optionStats = computeSelectFieldStats(stats.filteredRecords, sf);
            const hasAny = optionStats.some((o) => o.count > 0);
            if (!hasAny) return null;
            return (
              <div
                key={sf.id}
                className="daydot-card rounded-[22px] bg-[var(--bg-surface)] p-4"
              >
                <h3 className="mb-3 text-[15px] font-medium text-[var(--fg-primary)]">
                  {sf.name}分布
                </h3>
                <div className="space-y-2.5">
                  {optionStats.map((opt) => (
                    <div key={opt.optionId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--fg-secondary)]">
                          {opt.label}
                        </span>
                        <span className="font-medium text-[var(--fg-muted)] tabular-nums">
                          {opt.count} 次 ({Math.round(opt.ratio * 100)}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(opt.count > 0 ? 4 : 0, opt.ratio * 100)}%`,
                            backgroundColor: opt.color || color.solid,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </main>
      )}
    </div>
  );
}
