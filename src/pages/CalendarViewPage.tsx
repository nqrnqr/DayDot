import { useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import type { EventItem, EventRecord } from '../types/models';
import { getColorToken } from '../constants/theme';
import {
  buildMonthGrid,
  formatFullDate,
  formatMonthTitle,
  formatTime,
  formatWeekday,
  toDateKey,
} from '../utils/date';
import { EventIcon } from '../components/EventIcon';
import { RecordValueChips } from '../components/RecordValueChips';

interface CalendarViewPageProps {
  events: EventItem[];
  records: EventRecord[];
  isDark: boolean;
  onEditRecord: (event: EventItem, record: EventRecord) => void;
  onSelectEvent: (eventId: string) => void;
}

export function CalendarViewPage({
  events,
  records,
  isDark,
  onEditRecord,
  onSelectEvent,
}: CalendarViewPageProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('calendar');
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(toDateKey(now));

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const emerald = getColorToken('emerald', isDark);

  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const sortedRecords = useMemo(
    () =>
      [...records]
        .filter((r) => eventMap.has(r.eventId))
        .sort((a, b) => b.timestamp - a.timestamp),
    [records, eventMap],
  );

  const dotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rec of sortedRecords) {
      const ev = eventMap.get(rec.eventId);
      if (!ev) continue;
      const key = toDateKey(rec.timestamp);
      const color = getColorToken(ev.color, isDark).solid;
      const list = map.get(key) ?? [];
      if (!list.includes(color) && list.length < 4) {
        list.push(color);
        map.set(key, list);
      }
    }
    return map;
  }, [sortedRecords, eventMap, isDark]);

  const monthCells = useMemo(
    () => buildMonthGrid(calYear, calMonth),
    [calYear, calMonth],
  );

  const dayRecords = useMemo(
    () => sortedRecords.filter((r) => toDateKey(r.timestamp) === selectedDateKey),
    [sortedRecords, selectedDateKey],
  );

  const groupedTimeline = useMemo(() => {
    const groups: {
      dateKey: string;
      title: string;
      weekday: string;
      items: EventRecord[];
    }[] = [];
    const idxMap = new Map<string, number>();
    for (const r of sortedRecords) {
      const key = toDateKey(r.timestamp);
      const idx = idxMap.get(key);
      if (idx !== undefined) {
        groups[idx].items.push(r);
      } else {
        idxMap.set(key, groups.length);
        groups.push({
          dateKey: key,
          title: formatFullDate(r.timestamp),
          weekday: formatWeekday(r.timestamp),
          items: [r],
        });
      }
    }
    return groups;
  }, [sortedRecords]);

  const shiftMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

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
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      shiftMonth(dx < 0 ? 1 : -1);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[var(--bg-canvas-blur)] px-5 pt-5 pb-3 backdrop-blur-md">
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--fg-primary)]">
          查看
        </h1>

        <div
          role="tablist"
          aria-label="查看模式"
          className="inline-flex rounded-full bg-[var(--bg-subtle)] p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'calendar'}
            onClick={() => setViewMode('calendar')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
              viewMode === 'calendar'
                ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)]'
                : 'text-[var(--fg-muted)]'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            月历
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'timeline'}
            onClick={() => setViewMode('timeline')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
              viewMode === 'timeline'
                ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)]'
                : 'text-[var(--fg-muted)]'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            时间轴
          </button>
        </div>
      </header>

      {viewMode === 'calendar' ? (
        <main className="space-y-4 px-4 pt-1">
          {/* Monthly Calendar Card — aligned with EventDetail circular style & light typography */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="daydot-card rounded-[24px] bg-[var(--bg-surface)] p-4"
          >
            <div className="mb-2.5 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-medium text-[var(--fg-primary)]">
                  {formatMonthTitle(calYear, calMonth)}
                </span>
                {(calYear !== now.getFullYear() ||
                  calMonth !== now.getMonth() ||
                  selectedDateKey !== toDateKey(now)) && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = new Date();
                      setCalYear(t.getFullYear());
                      setCalMonth(t.getMonth());
                      setSelectedDateKey(toDateKey(t));
                    }}
                    aria-label="回到今天"
                    title="回到今天"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition active:scale-90"
                    style={{ backgroundColor: emerald.soft, color: emerald.ink }}
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
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="下个月"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-normal text-[var(--fg-muted)]">
              {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((w) => (
                <div key={w} className="py-1.5">
                  {w}
                </div>
              ))}
            </div>

            <div className="mt-0.5 grid grid-cols-7 gap-y-1 text-center">
              {monthCells.map((cell) => {
                const dots = dotsByDay.get(cell.dateKey) ?? [];
                const isSelected = selectedDateKey === cell.dateKey;

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => setSelectedDateKey(cell.dateKey)}
                    className={`flex flex-col items-center justify-center py-0.5 transition active:scale-90 ${
                      !cell.inCurrentMonth && !isSelected ? 'opacity-40' : ''
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] ${
                        isSelected
                          ? 'bg-[var(--pill-active-bg)] font-medium text-[var(--pill-active-fg)]'
                          : cell.isToday
                            ? 'font-medium'
                            : 'font-normal text-[var(--fg-primary)]'
                      }`}
                      style={
                        !isSelected && cell.isToday
                          ? { backgroundColor: emerald.soft, color: emerald.ink }
                          : undefined
                      }
                    >
                      {cell.isToday ? '今' : cell.dayNum}
                    </span>
                    <span className="mt-1 flex h-1.5 items-center gap-[3px]">
                      {dots.map((hex, i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Done List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[13px] font-medium text-[var(--fg-secondary)]">
                {formatFullDate(new Date(`${selectedDateKey}T00:00:00`))} ·{' '}
                {formatWeekday(new Date(`${selectedDateKey}T00:00:00`))}
              </h2>
              <span className="text-xs text-[var(--fg-muted)]">
                {dayRecords.length} 条记录
              </span>
            </div>

            {dayRecords.length === 0 ? (
              <div className="rounded-[22px] bg-[var(--bg-surface)] py-10 text-center text-xs text-[var(--fg-muted)]">
                这一天还没有留下迹点
              </div>
            ) : (
              <div className="space-y-2.5">
                {dayRecords.map((rec) => {
                  const ev = eventMap.get(rec.eventId);
                  if (!ev) return null;
                  const color = getColorToken(ev.color, isDark);
                  return (
                    <div
                      key={rec.id}
                      onClick={() => onEditRecord(ev, rec)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onEditRecord(ev, rec);
                      }}
                      className="daydot-card flex cursor-pointer items-start gap-3 rounded-[20px] bg-[var(--bg-surface)] p-3.5 transition active:scale-[0.99]"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(ev.id);
                        }}
                        aria-label={`进入 ${ev.name} 详情`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]"
                        style={{ backgroundColor: color.soft, color: color.ink }}
                      >
                        <EventIcon name={ev.icon} className="h-4.5 w-4.5" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[14px] font-medium text-[var(--fg-primary)]">
                            {ev.name}
                          </span>
                          <span className="shrink-0 text-xs text-[var(--fg-muted)] tabular-nums">
                            {formatTime(rec.timestamp)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <RecordValueChips
                            event={ev}
                            record={rec}
                            isDark={isDark}
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      ) : (
        /* True Continuous Vertical Timeline matching EventDetail aesthetic */
        <main className="flex-1 rounded-t-[26px] bg-[var(--bg-surface)] pt-5 pr-4 pb-10 pl-2.5">
          {groupedTimeline.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--fg-muted)]">
              还没有记录，去主页点亮第一个迹点吧
            </div>
          ) : (
            <div className="relative space-y-5">
              {/* Single continuous hairline aligned dead-center through every dot:
                  w-8 (32px) + mr-2 (8px) + half of w-2.5 (5px) = 45px */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-2.5 bottom-5 left-[44.5px] w-[1px] bg-[var(--rail-color)]"
              />

              {groupedTimeline.map((group) => (
                <section key={group.dateKey} className="space-y-3">
                  <div className="flex items-center">
                    <span className="mr-2 w-8 shrink-0 text-right text-xs font-normal text-[var(--fg-secondary)]">
                      {group.weekday}
                    </span>
                    <span
                      className="relative z-10 mr-3 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: emerald.solid }}
                    />
                    <div className="flex flex-1 items-baseline justify-between gap-2">
                      <h2 className="text-[14px] font-normal text-[var(--fg-primary)]">
                        {group.title}
                      </h2>
                      <span className="text-xs text-[var(--fg-muted)]">
                        {group.items.length} 条记录
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {group.items.map((rec) => {
                      const ev = eventMap.get(rec.eventId);
                      if (!ev) return null;
                      const color = getColorToken(ev.color, isDark);
                      return (
                        <div key={rec.id} className="flex items-start">
                          <span
                            className="mr-2 w-8 shrink-0 pt-3.5 text-right text-[11px] font-normal tabular-nums"
                            style={{ color: color.ink }}
                          >
                            {formatTime(rec.timestamp)}
                          </span>

                          <div className="relative z-10 mr-3 flex w-2.5 shrink-0 justify-center pt-4">
                            <span
                              className="h-2.5 w-2.5 rounded-full border-[1.75px] bg-[var(--bg-surface)]"
                              style={{ borderColor: color.solid }}
                            />
                          </div>

                          <div
                            onClick={() => onEditRecord(ev, rec)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onEditRecord(ev, rec);
                            }}
                            className="flex flex-1 cursor-pointer items-start gap-2.5 rounded-[16px] bg-[var(--bg-canvas)] px-3.5 py-3 transition hover:bg-[var(--bg-subtle)] active:scale-[0.99]"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvent(ev.id);
                              }}
                              aria-label={`进入 ${ev.name} 详情`}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                              style={{ backgroundColor: color.soft, color: color.ink }}
                            >
                              <EventIcon name={ev.icon} className="h-4 w-4" />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-medium text-[var(--fg-primary)]">
                                {ev.name}
                              </div>
                              <div className="mt-0.5">
                                <RecordValueChips
                                  event={ev}
                                  record={rec}
                                  isDark={isDark}
                                  compact
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
