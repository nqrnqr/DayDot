import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, CalendarDays, Home, Settings, Undo2 } from 'lucide-react';
import type { EventItem, EventRecord } from './types/models';
import { buildDefaultValues, createId, db, ensureSeeded } from './db/db';
import { useThemeMode } from './utils/themeMode';
import { HomePage } from './pages/HomePage';
import { EventDetailPage } from './pages/EventDetailPage';
import { TrendsPage } from './pages/TrendsPage';
import { CalendarViewPage } from './pages/CalendarViewPage';
import { SettingsPage } from './pages/SettingsPage';
import { QuickRecordSheet } from './components/QuickRecordSheet';
import { EventEditorSheet } from './components/EventEditorSheet';
import { GroupManagerSheet } from './components/GroupManagerSheet';

type MainTab = 'home' | 'trends' | 'calendar' | 'settings';

interface RouteState {
  tab: MainTab;
  eventId: string | null;
}

const VALID_TABS: MainTab[] = ['home', 'trends', 'calendar', 'settings'];

function parseHashRoute(): RouteState {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  if (!raw) return { tab: 'home', eventId: null };

  if (raw.startsWith('event/')) {
    const rest = raw.slice('event/'.length);
    const [idPart, queryPart] = rest.split('?');
    const params = new URLSearchParams(queryPart ?? '');
    const fromTab = params.get('from') as MainTab | null;
    return {
      tab: fromTab && VALID_TABS.includes(fromTab) ? fromTab : 'home',
      eventId: idPart ? decodeURIComponent(idPart) : null,
    };
  }

  if (VALID_TABS.includes(raw as MainTab)) {
    return { tab: raw as MainTab, eventId: null };
  }

  return { tab: 'home', eventId: null };
}

function buildHash(tab: MainTab, eventId: string | null): string {
  if (eventId) {
    return `#event/${encodeURIComponent(eventId)}${tab !== 'home' ? `?from=${tab}` : ''}`;
  }
  return `#${tab}`;
}

interface ToastState {
  message: string;
  undoRecordId?: string;
}

export function App() {
  const [ready, setReady] = useState(false);
  const initialRoute = useMemo(() => parseHashRoute(), []);
  const [activeTab, setActiveTabState] = useState<MainTab>(initialRoute.tab);
  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(
    initialRoute.eventId,
  );
  const { preference, systemDark, isDark, setPreference } = useThemeMode();

  const [recordSheetState, setRecordSheetState] = useState<{
    open: boolean;
    event: EventItem | null;
    editingRecord?: EventRecord | null;
    initialTimestamp?: number;
  }>({ open: false, event: null });

  const [eventEditorState, setEventEditorState] = useState<{
    open: boolean;
    editingEvent?: EventItem | null;
  }>({ open: false });

  const [groupManagerOpen, setGroupManagerOpen] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const navigate = useCallback((nextTab: MainTab, nextEventId: string | null) => {
    setActiveTabState(nextTab);
    setSelectedEventIdState(nextEventId);
    const targetHash = buildHash(nextTab, nextEventId);
    if (window.location.hash !== targetHash) {
      window.history.pushState(null, '', targetHash);
    }
  }, []);

  const setActiveTab = useCallback(
    (tab: MainTab) => {
      navigate(tab, null);
    },
    [navigate],
  );

  const openEventDetail = useCallback(
    (eventId: string) => {
      navigate(activeTab, eventId);
    },
    [activeTab, navigate],
  );

  const closeEventDetail = useCallback(() => {
    navigate(activeTab, null);
  }, [activeTab, navigate]);

  // Sync browser back/forward & manual hash changes
  useEffect(() => {
    const syncFromHash = () => {
      const parsed = parseHashRoute();
      setActiveTabState(parsed.tab);
      setSelectedEventIdState(parsed.eventId);
    };
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
  }, []);

  const showToast = (message: string, undoRecordId?: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, undoRecordId });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  useEffect(() => {
    ensureSeeded().then(() => setReady(true));
  }, []);

  const groups = useLiveQuery(() => db.groups.orderBy('order').toArray(), [], []);
  const events = useLiveQuery(() => db.events.orderBy('order').toArray(), [], []);
  const records = useLiveQuery(() => db.records.toArray(), [], []);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const selectedEventRecords = useMemo(
    () =>
      selectedEventId
        ? records.filter((r) => r.eventId === selectedEventId)
        : [],
    [records, selectedEventId],
  );

  const handleQuickRecord = async (event: EventItem) => {
    const now = Date.now();
    const id = createId('rec');
    await db.records.add({
      id,
      eventId: event.id,
      timestamp: now,
      values: buildDefaultValues(event),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    showToast(`已速记「${event.name}」`, id);
  };

  const handleUndoRecord = async () => {
    if (!toast?.undoRecordId) return;
    await db.records.delete(toast.undoRecordId);
    setToast(null);
    showToast('已撤销刚才的记录');
  };

  const handleDeleteEvent = async (event: EventItem) => {
    await db.transaction('rw', db.events, db.records, async () => {
      await db.records.where('eventId').equals(event.id).delete();
      await db.events.delete(event.id);
    });
    closeEventDetail();
    showToast(`已删除事件「${event.name}」`);
  };

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-canvas)]">
        <div className="text-sm font-medium text-[var(--fg-muted)]">
          正在加载 DayDot...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-outer)] sm:py-4">
      <div className="relative mx-auto min-h-dvh w-full max-w-[460px] bg-[var(--bg-canvas)] sm:min-h-[calc(100dvh-2rem)] sm:overflow-hidden sm:rounded-[32px] sm:shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
        {selectedEvent ? (
          <EventDetailPage
            event={selectedEvent}
            records={selectedEventRecords}
            isDark={isDark}
            onBack={closeEventDetail}
            onEditEvent={(ev) =>
              setEventEditorState({ open: true, editingEvent: ev })
            }
            onAddRecord={(ev, initialTimestamp) =>
              setRecordSheetState({
                open: true,
                event: ev,
                editingRecord: null,
                initialTimestamp,
              })
            }
            onEditRecord={(ev, rec) =>
              setRecordSheetState({
                open: true,
                event: ev,
                editingRecord: rec,
              })
            }
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomePage
                groups={groups}
                events={events}
                records={records}
                isDark={isDark}
                onSelectEvent={openEventDetail}
                onQuickRecord={handleQuickRecord}
                onOpenRecordSheet={(ev) =>
                  setRecordSheetState({
                    open: true,
                    event: ev,
                    editingRecord: null,
                  })
                }
                onCreateEvent={() =>
                  setEventEditorState({ open: true, editingEvent: null })
                }
                onManageGroups={() => setGroupManagerOpen(true)}
                onNotify={(m) => showToast(m)}
              />
            )}

            {activeTab === 'trends' && (
              <TrendsPage
                groups={groups}
                events={events}
                records={records}
                isDark={isDark}
                onSelectEvent={openEventDetail}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarViewPage
                events={events}
                records={records}
                isDark={isDark}
                onSelectEvent={openEventDetail}
                onEditRecord={(ev, rec) =>
                  setRecordSheetState({
                    open: true,
                    event: ev,
                    editingRecord: rec,
                  })
                }
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                groupCount={groups.length}
                eventCount={events.length}
                recordCount={records.length}
                isDark={isDark}
                themePreference={preference}
                systemDark={systemDark}
                onChangeTheme={setPreference}
                onManageGroups={() => setGroupManagerOpen(true)}
                onNotify={(m) => showToast(m)}
              />
            )}

            <nav
              aria-label="主导航"
              className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[460px] border-t border-[var(--border-soft)] bg-[var(--bg-surface-blur)] px-2 pt-2 backdrop-blur-md sm:rounded-b-[32px]"
            >
              <div className="grid grid-cols-4">
                {(
                  [
                    ['home', '主页', Home],
                    ['trends', '趋势', BarChart3],
                    ['calendar', '查看', CalendarDays],
                    ['settings', '设置', Settings],
                  ] as const
                ).map(([id, label, Icon]) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      className={`flex flex-col items-center gap-1 py-1 transition ${
                        active
                          ? 'text-[var(--fg-primary)]'
                          : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${active ? 'stroke-[2.4]' : 'stroke-[1.9]'}`}
                      />
                      <span className="text-[11px] font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </>
        )}

        {/* Toast Notification */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[var(--pill-active-bg)] px-4 py-2.5 text-xs font-medium text-[var(--pill-active-fg)] shadow-lg backdrop-blur-md"
          >
            <span>{toast.message}</span>
            {toast.undoRecordId && (
              <button
                type="button"
                onClick={handleUndoRecord}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-semibold text-emerald-400 hover:bg-emerald-500/30"
              >
                <Undo2 className="h-3 w-3" />
                撤销
              </button>
            )}
          </div>
        )}

        {/* Modals / Bottom Sheets */}
        <QuickRecordSheet
          open={recordSheetState.open}
          event={recordSheetState.event}
          editingRecord={recordSheetState.editingRecord}
          initialTimestamp={recordSheetState.initialTimestamp}
          isDark={isDark}
          onClose={() =>
            setRecordSheetState((prev) => ({ ...prev, open: false }))
          }
          onSaved={(msg) => showToast(msg)}
        />

        <EventEditorSheet
          open={eventEditorState.open}
          editingEvent={eventEditorState.editingEvent}
          groups={groups}
          isDark={isDark}
          onClose={() =>
            setEventEditorState((prev) => ({ ...prev, open: false }))
          }
          onSaved={(msg) => showToast(msg)}
          onDeleteEvent={handleDeleteEvent}
        />

        <GroupManagerSheet
          open={groupManagerOpen}
          groups={groups}
          events={events}
          onClose={() => setGroupManagerOpen(false)}
          onNotify={(m) => showToast(m)}
        />
      </div>
    </div>
  );
}

export default App;
