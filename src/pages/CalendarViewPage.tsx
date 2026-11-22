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
    <div className="flex flex-col pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[var(--bg-canvas-blur)] px-5 pt-5 pb-3 backdrop-blur-md">
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--fg-primary)]">
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
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
              viewMode === 'calendar'
                ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
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
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
              viewMode === 'timeline'
                ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
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
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="daydot-card rounded-[24px] bg-[var(--bg-surface)] p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-[var(--fg-primary)]">
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
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition active:scale-90"
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

            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-[var(--fg-muted)]">
              {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-y-1.5 text-center">
              {monthCells.map((cell) => {
                const dots = dotsByDay.get(cell.dateKey) ?? [];
                const isSelected = selectedDateKey === cell.dateKey;
                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => setSelectedDateKey(cell.dateKey)}
                    className={`mx-auto flex h-11 w-10 flex-col items-center justify-center rounded-xl transition active:scale-90 ${
                      isSelected
                        ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)]'
                        : cell.inCurrentMonth
                          ? 'text-[var(--fg-primary)] hover:bg-[var(--bg-canvas)]'
                          : 'text-[var(--fg-muted)] opacity-45'
                    }`}
                    style={
                      !isSelected && cell.isToday
                        ? { backgroundColor: emerald.soft, color: emerald.ink }
                        : undefined
                    }
                  >
                    <span className="text-[13px] font-semibold">
                      {cell.isToday ? '今' : cell.dayNum}
                    </span>
                    <div className="mt-1 flex h-1.5 items-center gap-[3px]">
                      {dots.map((hex, i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: isSelected
                              ? 'var(--pill-active-fg)'
                              : hex,
                          }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Done List - unified header format with Timeline */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[13px] font-bold text-[var(--fg-secondary)]">
                {formatFullDate(new Date(`${selectedDateKey}T00:00:00`))} ·{' '}
                {formatWeekday(new Date(`${selectedDateKey}T00:00:00`))}
              </h2>
              <span className="text-xs font-medium text-[var(--fg-muted)]">
                {dayRecords.length} 条记录
              </span>
            </div>

            {dayRecords.length === 0 ? (
              <div className="rounded-[22px] bg-[var(--bg-surface)] py-10 text-center text-xs text-[var(--fg-muted)] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
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
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                        style={{ backgroundColor: color.soft, color: color.ink }}
                      >
                        <EventIcon name={ev.icon} className="h-5 w-5" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--fg-primary)]">
                            {ev.name}
                          </span>
                          <span className="shrink-0 text-xs font-medium text-[var(--fg-muted)] tabular-nums">
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
        <main className="space-y-5 px-4 pt-1">
          {groupedTimeline.length === 0 ? (
            <div className="mt-8 rounded-[22px] bg-[var(--bg-surface)] py-12 text-center text-sm text-[var(--fg-muted)]">
              还没有记录，去主页点亮第一个迹点吧
            </div>
          ) : (
            groupedTimeline.map((group) => (
              <section key={group.dateKey} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[13px] font-bold text-[var(--fg-secondary)]">
                    {group.title} · {group.weekday}
                  </h2>
                  <span className="text-xs font-medium text-[var(--fg-muted)]">
                    {group.items.length} 条记录
                  </span>
                </div>

                <div className="space-y-2">
                  {group.items.map((rec) => {
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
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                          style={{ backgroundColor: color.soft, color: color.ink }}
                        >
                          <EventIcon name={ev.icon} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--fg-primary)]">
                              {ev.name}
                            </span>
                            <span className="text-xs font-medium text-[var(--fg-muted)] tabular-nums">
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
              </section>
            ))
          )}
        </main>
      )}
    </div>
  );
}
