import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowUpDown,
  Check,
  GripHorizontal,
  Home,
  Pin,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import type { EventItem, EventRecord, Group } from '../types/models';
import { getColorToken } from '../constants/theme';
import { db, notifyLocalMutation } from '../db/db';
import { formatRelativeSince, isSameDay } from '../utils/date';
import { extractNumericValue, formatCleanNumber, getPrimaryNumberField } from '../utils/stats';
import { EventIcon } from '../components/EventIcon';

interface HomePageProps {
  groups: Group[];
  events: EventItem[];
  records: EventRecord[];
  isDark: boolean;
  onSelectEvent: (eventId: string) => void;
  onQuickRecord: (event: EventItem) => void;
  onOpenRecordSheet: (event: EventItem) => void;
  onCreateEvent: () => void;
  onManageGroups: () => void;
  onNotify: (msg: string) => void;
}

interface SortableEventCardProps {
  event: EventItem;
  evRecords: EventRecord[];
  isDark: boolean;
  organizeMode: boolean;
  onSelect: () => void;
  onQuickAction: () => void;
  onTogglePin: () => void;
}

function SortableEventCard({
  event,
  evRecords,
  isDark,
  organizeMode,
  onSelect,
  onQuickAction,
  onTogglePin,
}: SortableEventCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.id, disabled: !organizeMode });

  const color = getColorToken(event.color, isDark);
  const latest = evRecords[0];
  const primaryNum = getPrimaryNumberField(event);

  const todayRecs = evRecords.filter((r) => isSameDay(r.timestamp, new Date()));
  const doneToday = todayRecs.length > 0;

  const prevTodayCountRef = useRef(todayRecs.length);
  const [burstSeq, setBurstSeq] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const prev = prevTodayCountRef.current;
    prevTodayCountRef.current = todayRecs.length;
    if (todayRecs.length > prev) {
      let endTimer: number | undefined;
      const startTimer = window.setTimeout(() => {
        setBurstSeq((n) => n + 1);
        setCelebrating(true);
        endTimer = window.setTimeout(() => setCelebrating(false), 780);
      }, 90);
      return () => {
        window.clearTimeout(startTimer);
        if (endTimer !== undefined) window.clearTimeout(endTimer);
      };
    }
    if (todayRecs.length < prev) setCelebrating(false);
  }, [todayRecs.length]);

  let subtitle = '-';
  if (doneToday) {
    if (primaryNum) {
      const sum = todayRecs.reduce(
        (acc, r) => acc + extractNumericValue(r, primaryNum.id),
        0,
      );
      subtitle = `今日 ${formatCleanNumber(sum)} ${primaryNum.unit}`;
    } else {
      subtitle = `今日 ${todayRecs.length} 次`;
    }
  } else if (latest) {
    subtitle = formatRelativeSince(latest.timestamp);
  }

  const cardStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      {...(organizeMode ? { ...attributes, ...listeners } : {})}
      onClick={() => {
        if (!organizeMode) onSelect();
      }}
      role={organizeMode ? undefined : 'button'}
      tabIndex={organizeMode ? undefined : 0}
      onKeyDown={(e) => {
        if (!organizeMode && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`daydot-card group flex min-h-[126px] flex-col justify-between rounded-[22px] bg-[var(--bg-surface)] p-4 transition-[transform,box-shadow] duration-150 lg:min-h-[144px] lg:p-5 ${
        organizeMode
          ? isDragging
            ? 'scale-[1.03] cursor-grabbing touch-none shadow-xl ring-2 ring-[var(--accent)]'
            : 'cursor-grab touch-none ring-1 ring-[var(--border-color)]'
          : `cursor-pointer active:scale-[0.98] lg:hover:-translate-y-0.5 lg:hover:shadow-[0_6px_22px_rgba(15,23,42,0.06)] ${celebrating ? 'daydot-card-ack' : ''}`
      }`}
    >
      {/* Top row: Pastel icon badge + Quick Action OR Pin button */}
      <div className="flex items-start justify-between gap-1">
        <div
          className="relative flex h-10 w-10 items-center justify-center rounded-[13px]"
          style={{ backgroundColor: color.soft, color: color.ink }}
        >
          <EventIcon name={event.icon} className="h-5 w-5" />
          {event.pinned && !organizeMode && (
            <span
              title="已置顶"
              className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-surface)] shadow-xs ring-1 ring-[var(--border-color)]"
              style={{ color: color.ink }}
            >
              <Pin className="h-2.5 w-2.5 fill-current" />
            </span>
          )}
        </div>

        {organizeMode ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            aria-label={event.pinned ? '取消置顶' : '置顶事件'}
            title={event.pinned ? '取消置顶' : '置顶'}
            className="flex h-8 w-8 items-center justify-center rounded-full transition active:scale-90"
            style={
              event.pinned
                ? { backgroundColor: color.solid, color: '#FFFFFF' }
                : {
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--fg-muted)',
                  }
            }
          >
            <Pin className={`h-3.5 w-3.5 ${event.pinned ? 'fill-current' : ''}`} />
          </button>
        ) : (
          <div className="relative flex items-center justify-center">
            {celebrating && (
              <>
                <span
                  key={`halo-${burstSeq}`}
                  aria-hidden="true"
                  className="daydot-halo-ring pointer-events-none absolute inset-0 rounded-full border-2"
                  style={{ borderColor: color.solid }}
                />
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <span
                    key={`dot-${burstSeq}-${deg}`}
                    aria-hidden="true"
                    className="daydot-burst-dot pointer-events-none absolute h-1.5 w-1.5 rounded-full"
                    style={
                      {
                        backgroundColor: color.solid,
                        '--dot-angle': `${deg}deg`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction();
              }}
              aria-label={
                event.quickMode ? `一键速记 ${event.name}` : `记录 ${event.name}`
              }
              title={
                doneToday
                  ? event.quickMode
                    ? '今日已记 · 点击再速记一次'
                    : '今日已记 · 点击再记一次'
                  : event.quickMode
                    ? '一键速记（按默认值）'
                    : '打开记录确认弹窗'
              }
              className={`relative z-10 flex h-9 w-9 appearance-none items-center justify-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-90 ${
                celebrating ? 'daydot-btn-pop' : ''
              } ${
                doneToday
                  ? ''
                  : 'bg-[var(--bg-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle-hover)]'
              }`}
              style={
                doneToday
                  ? { backgroundColor: color.solid, color: '#FFFFFF' }
                  : undefined
              }
            >
              {celebrating ? (
                <Check
                  key={`chk-${burstSeq}`}
                  className="daydot-icon-pop h-4.5 w-4.5 stroke-[2.6]"
                />
              ) : event.quickMode ? (
                <Zap className="h-4 w-4 fill-current" />
              ) : (
                <Plus className="h-4.5 w-4.5 stroke-[2.2]" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bottom row: Clean Title + Status */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-[15px] font-medium text-[var(--fg-primary)]">
            {event.name}
          </h2>
          {organizeMode && (
            <GripHorizontal className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
          )}
        </div>
        <p
          key={celebrating ? `sub-${burstSeq}` : 'sub-idle'}
          className={`mt-1 truncate text-xs font-normal transition-colors duration-200 ${
            celebrating ? 'daydot-subtitle-tick' : ''
          }`}
          style={{
            color: !organizeMode && doneToday ? color.ink : 'var(--fg-muted)',
          }}
        >
          {organizeMode ? '按住拖动排序' : subtitle}
        </p>
      </div>
    </div>
  );
}

export function HomePage({
  groups,
  events,
  records,
  isDark,
  onSelectEvent,
  onQuickRecord,
  onOpenRecordSheet,
  onCreateEvent,
  onManageGroups,
  onNotify,
}: HomePageProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [organizeMode, setOrganizeMode] = useState(false);
  const [query, setQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const recordsByEvent = useMemo(() => {
    const map = new Map<string, EventRecord[]>();
    for (const r of records) {
      const list = map.get(r.eventId);
      if (list) list.push(r);
      else map.set(r.eventId, [r]);
    }
    map.forEach((list) => list.sort((a, b) => b.timestamp - a.timestamp));
    return map;
  }, [records]);

  const sortedActiveEvents = useMemo(() => {
    return [...events]
      .filter((e) => !e.archived)
      .sort((a, b) => {
        const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        if (pinDiff !== 0) return pinDiff;
        return a.order - b.order;
      });
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortedActiveEvents.filter((e) => {
      if (selectedGroupId !== 'all' && e.groupId !== selectedGroupId) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sortedActiveEvents, selectedGroupId, query]);

  const todayCount = useMemo(() => {
    const now = new Date();
    return records.filter((r) => isSameDay(r.timestamp, now)).length;
  }, [records]);

  const prevTotalTodayRef = useRef(todayCount);
  const [todayPillPop, setTodayPillPop] = useState(false);

  useEffect(() => {
    const prev = prevTotalTodayRef.current;
    prevTotalTodayRef.current = todayCount;
    if (todayCount > prev) {
      setTodayPillPop(true);
      const timer = window.setTimeout(() => setTodayPillPop(false), 480);
      return () => window.clearTimeout(timer);
    }
    if (todayCount < prev) setTodayPillPop(false);
  }, [todayCount]);

  const handleTogglePin = async (event: EventItem) => {
    const nextPinned = !event.pinned;
    await db.events.update(event.id, {
      pinned: nextPinned,
      updatedAt: Date.now(),
    });
    notifyLocalMutation();
    onNotify(nextPinned ? `已置顶「${event.name}」` : `已取消置顶「${event.name}」`);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = filteredEvents.findIndex((e) => e.id === active.id);
    const newIdx = filteredEvents.findIndex((e) => e.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const targetPinned = Boolean(filteredEvents[newIdx].pinned);
    const movedList = arrayMove(filteredEvents, oldIdx, newIdx).map((item) =>
      item.id === active.id ? { ...item, pinned: targetPinned } : item,
    );

    const now = Date.now();
    await db.transaction('rw', db.events, async () => {
      const orders = filteredEvents.map((e) => e.order).sort((a, b) => a - b);
      const normalized = orders.map((val, idx) =>
        idx > 0 && val <= orders[idx - 1] ? orders[idx - 1] + 1 : val,
      );
      for (let i = 0; i < movedList.length; i++) {
        await db.events.update(movedList[i].id, {
          order: normalized[i] ?? i,
          pinned: Boolean(movedList[i].pinned),
          updatedAt: now,
        });
      }
    });
    notifyLocalMutation();
  };

  return (
    <div className="flex flex-col pb-24 lg:pb-12">
      <header className="pt-safe sticky top-0 z-20 bg-[var(--bg-canvas-blur)] px-5 pb-3 backdrop-blur-md lg:px-8 lg:pt-7 lg:pb-4">
        <div className="mx-auto w-full max-w-[1160px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--fg-primary)] italic lg:hidden">
                DayDot
              </h1>
              <h1 className="hidden text-[26px] font-semibold tracking-tight text-[var(--fg-primary)] lg:block">
                主页
              </h1>
              {todayCount > 0 && !organizeMode && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums lg:hidden ${
                    todayPillPop ? 'daydot-btn-pop' : ''
                  }`}
                  style={{
                    backgroundColor: getColorToken('emerald', isDark).soft,
                    color: getColorToken('emerald', isDark).ink,
                  }}
                >
                  今日 {todayCount} 迹
                </span>
              )}
              {!organizeMode && (
                <span className="hidden text-xs text-[var(--fg-muted)] tabular-nums lg:inline">
                  共 {filteredEvents.length} 个事件
                </span>
              )}
              {organizeMode && (
                <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--fg-secondary)]">
                  拖动卡片排序
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 lg:gap-2">
              {organizeMode ? (
                <button
                  type="button"
                  onClick={() => setOrganizeMode(false)}
                  className="inline-flex h-9 items-center gap-1 rounded-full bg-[var(--pill-active-bg)] px-3.5 text-xs font-semibold text-[var(--pill-active-fg)] transition active:scale-95"
                >
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  完成
                </button>
              ) : (
                <>
                  {/* Desktop inline persistent search bar */}
                  <div className="relative hidden items-center lg:flex">
                    <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--fg-muted)]" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜索事件..."
                      aria-label="搜索事件"
                      className="w-56 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] py-1.5 pr-8 pl-9 text-xs text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] transition focus:w-64 focus:border-[var(--fg-muted)] focus:outline-none"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="清空搜索"
                        className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Mobile search toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen((v) => !v);
                      if (searchOpen) setQuery('');
                    }}
                    aria-label="搜索事件"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-secondary)] transition hover:bg-[var(--bg-subtle-hover)] active:scale-95 lg:hidden"
                  >
                    {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                  </button>

                  {sortedActiveEvents.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        setQuery('');
                        setOrganizeMode(true);
                      }}
                      aria-label="排序与置顶"
                      title="卡片排序与置顶"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-secondary)] transition hover:bg-[var(--bg-subtle-hover)] active:scale-95 lg:w-auto lg:gap-1.5 lg:border lg:border-[var(--border-color)] lg:bg-[var(--bg-surface)] lg:px-3.5 lg:text-xs lg:font-medium lg:hover:bg-[var(--bg-subtle)]"
                    >
                      <ArrowUpDown className="h-4.5 w-4.5 lg:h-3.5 lg:w-3.5" />
                      <span className="hidden lg:inline">排序与置顶</span>
                    </button>
                  )}

                  {/* Mobile quick create button (desktop uses sidebar primary CTA) */}
                  <button
                    type="button"
                    onClick={onCreateEvent}
                    aria-label="新建事件"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-primary)] transition hover:bg-[var(--bg-subtle-hover)] active:scale-95 lg:hidden"
                  >
                    <Plus className="h-6 w-6 stroke-[2.2]" />
                  </button>
                </>
              )}
            </div>
          </div>

          {searchOpen && !organizeMode && (
            <div className="mt-3 lg:hidden">
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索事件名称..."
                className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--fg-muted)] focus:outline-none"
              />
            </div>
          )}

          {/* Group Filter Pills + Manage Groups Button */}
          <div className="no-scrollbar mt-3.5 flex items-center gap-2 overflow-x-auto pb-0.5 lg:mt-4">
            <button
              type="button"
              onClick={() => setSelectedGroupId('all')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
                selectedGroupId === 'all'
                  ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)] shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              所有
            </button>

            {groups.map((grp) => {
              const active = selectedGroupId === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setSelectedGroupId(grp.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
                    active
                      ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)] shadow-xs'
                      : 'bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  {grp.name}
                </button>
              );
            })}

            <button
              type="button"
              onClick={onManageGroups}
              aria-label="管理分组"
              title="管理分组"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--fg-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] active:scale-95 lg:w-auto lg:gap-1.5 lg:px-3 lg:text-xs lg:font-medium"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">管理分组</span>
            </button>
          </div>
        </div>
      </header>

      {/* Responsive Draggable Event Cards Grid */}
      <main className="px-4 pt-1 lg:px-8 lg:pt-2">
        <div className="mx-auto w-full max-w-[1160px]">
          {filteredEvents.length === 0 ? (
            <div className="mt-10 flex flex-col items-center rounded-[24px] bg-[var(--bg-surface)] px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05)] lg:mx-auto lg:max-w-md lg:py-16">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: getColorToken('emerald', isDark).soft,
                  color: getColorToken('emerald', isDark).ink,
                }}
              >
                <Plus className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--fg-primary)]">
                {query ? '没有找到匹配的事件' : '还没有事件卡片'}
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                新建一个你常做的事（如引体向上、练琴），随时记录
              </p>
              <button
                type="button"
                onClick={onCreateEvent}
                className="mt-4 rounded-full bg-[var(--pill-active-bg)] px-5 py-2 text-xs font-semibold text-[var(--pill-active-fg)] transition active:scale-95"
              >
                新建事件
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredEvents.map((e) => e.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] lg:gap-4">
                  {filteredEvents.map((event) => (
                    <SortableEventCard
                      key={event.id}
                      event={event}
                      evRecords={recordsByEvent.get(event.id) ?? []}
                      isDark={isDark}
                      organizeMode={organizeMode}
                      onSelect={() => onSelectEvent(event.id)}
                      onQuickAction={() =>
                        event.quickMode
                          ? onQuickRecord(event)
                          : onOpenRecordSheet(event)
                      }
                      onTogglePin={() => handleTogglePin(event)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </main>
    </div>
  );
}
