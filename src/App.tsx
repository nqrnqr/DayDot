import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, CalendarDays, Home, Settings, Undo2 } from 'lucide-react';
import type { EventItem, EventRecord } from './types/models';
import {
  buildDefaultValues,
  createId,
  db,
  ensureSeeded,
  notifyLocalMutation,
  softDeleteEvent,
  softDeleteRecord,
} from './db/db';
import {
  loadSyncConfig,
  loadSyncMeta,
  markSyncPending,
  syncWithGitHub,
  type GitHubSyncConfig,
  type SyncStatusMeta,
} from './services/githubSync';
import { initNativeUpdater } from './services/otaUpdater';
import { useThemeMode } from './utils/themeMode';
import { HomePage } from './pages/HomePage';
import { EventDetailPage } from './pages/EventDetailPage';
import { TrendsPage } from './pages/TrendsPage';
import { CalendarViewPage } from './pages/CalendarViewPage';
import { SettingsPage } from './pages/SettingsPage';
import { QuickRecordSheet } from './components/QuickRecordSheet';
import { EventEditorSheet } from './components/EventEditorSheet';
import { GroupManagerSheet } from './components/GroupManagerSheet';
import { CloudSyncSheet } from './components/CloudSyncSheet';

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

  // Cloud Sync state
  const [syncConfig, setSyncConfig] = useState<GitHubSyncConfig | null>(() =>
    loadSyncConfig(),
  );
  const [syncMeta, setSyncMeta] = useState<SyncStatusMeta>(() => loadSyncMeta());
  const [syncing, setSyncing] = useState(false);
  const [cloudSyncOpen, setCloudSyncOpen] = useState(false);
  const autoSyncTimerRef = useRef<number | null>(null);

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

  const showToast = useCallback((message: string, undoRecordId?: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, undoRecordId });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

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

  useEffect(() => {
    void initNativeUpdater();
    ensureSeeded().then(() => setReady(true));
  }, []);

  // Sync Android system status/navigation bar background & icon colors with Light & Dark themes
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const nativeBridge = (
      window as unknown as {
        DayDotNative?: {
          setSystemBarTheme?: (dark: boolean, bgHex: string) => void;
        };
      }
    ).DayDotNative;
    if (nativeBridge?.setSystemBarTheme) {
      nativeBridge.setSystemBarTheme(isDark, isDark ? '#111216' : '#F7F7F8');
      return;
    }
    void SystemBars.setStyle({
      style: isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    }).catch(() => {
      // Non-fatal
    });
  }, [isDark]);

  // Native Android hardware back button handling when packaged via Capacitor APK
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => void) | undefined;

    void CapApp.addListener('backButton', () => {
      if (recordSheetState.open) {
        setRecordSheetState((prev) => ({ ...prev, open: false }));
        return;
      }
      if (eventEditorState.open) {
        setEventEditorState((prev) => ({ ...prev, open: false }));
        return;
      }
      if (groupManagerOpen) {
        setGroupManagerOpen(false);
        return;
      }
      if (cloudSyncOpen) {
        setCloudSyncOpen(false);
        return;
      }
      if (selectedEventId) {
        closeEventDetail();
        return;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return;
      }
      void CapApp.minimizeApp();
    }).then((handle) => {
      removeListener = () => {
        void handle.remove();
      };
    });

    return () => {
      removeListener?.();
    };
  }, [
    recordSheetState.open,
    eventEditorState.open,
    groupManagerOpen,
    cloudSyncOpen,
    selectedEventId,
    activeTab,
    closeEventDetail,
    setActiveTab,
  ]);

  const SYNC_DEBOUNCE_MS = 30_000;
  const FOREGROUND_PULL_COOLDOWN_MS = 2 * 60_000;

  const runSync = useCallback(
    async (silent: boolean, overrideConfig?: GitHubSyncConfig) => {
      const cfg = overrideConfig ?? syncConfig;
      if (!cfg) return;
      if (autoSyncTimerRef.current) {
        window.clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
      setSyncing(true);
      try {
        const res = await syncWithGitHub(cfg);
        const latest = loadSyncMeta();
        setSyncMeta(latest);
        if (!silent) {
          showToast(res.summary);
        } else if (res.pulledCount > 0) {
          showToast(`云端已同步 ${res.pulledCount} 项更新`);
        }
        // If another local edit occurred while this sync was in-flight, schedule a follow-up batch
        if (latest.pendingChanges && cfg.autoSync && navigator.onLine) {
          autoSyncTimerRef.current = window.setTimeout(() => {
            autoSyncTimerRef.current = null;
            void runSync(true);
          }, SYNC_DEBOUNCE_MS);
        }
      } catch (err) {
        setSyncMeta(loadSyncMeta());
        if (!silent) {
          showToast(err instanceof Error ? err.message : '同步失败，请稍后重试');
        }
      } finally {
        setSyncing(false);
      }
    },
    [syncConfig, showToast],
  );

  const flushPendingSync = useCallback(() => {
    if (!syncConfig?.autoSync || !navigator.onLine) return;
    const latest = loadSyncMeta();
    if (!latest.pendingChanges) return;
    void runSync(true);
  }, [syncConfig, runSync]);

  const handleForegroundResume = useCallback(() => {
    if (!syncConfig?.autoSync || !navigator.onLine) return;
    const latest = loadSyncMeta();
    if (latest.pendingChanges) {
      void runSync(true);
      return;
    }
    const elapsed = Date.now() - (latest.lastSyncedAt ?? 0);
    if (elapsed >= FOREGROUND_PULL_COOLDOWN_MS) {
      void runSync(true);
    }
  }, [syncConfig, runSync]);

  // Silent auto-sync on app startup when enabled (also flushes any pending changes left from offline/force-kill)
  const initialSyncDoneRef = useRef(false);
  useEffect(() => {
    if (!ready || initialSyncDoneRef.current) return;
    initialSyncDoneRef.current = true;
    if (syncConfig?.autoSync && navigator.onLine) {
      void runSync(true);
    }
  }, [ready, syncConfig, runSync]);

  // Track pending local mutations + 30s batch debounce when auto-sync is enabled
  useEffect(() => {
    const handleLocalChange = () => {
      if (!syncConfig) return;
      setSyncMeta(markSyncPending());
      if (!syncConfig.autoSync || !navigator.onLine) return;
      if (autoSyncTimerRef.current) window.clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = window.setTimeout(() => {
        autoSyncTimerRef.current = null;
        void runSync(true);
      }, SYNC_DEBOUNCE_MS);
    };
    window.addEventListener('daydot-local-change', handleLocalChange);
    return () => {
      window.removeEventListener('daydot-local-change', handleLocalChange);
      if (autoSyncTimerRef.current) {
        window.clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [syncConfig, runSync]);

  // Flush pending changes immediately on background / lock / tab switch / network reconnect,
  // and pull silently on foreground return after cooldown
  useEffect(() => {
    if (!syncConfig?.autoSync) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSync();
      } else if (document.visibilityState === 'visible') {
        handleForegroundResume();
      }
    };
    const onPageHide = () => {
      flushPendingSync();
    };
    const onOnline = () => {
      flushPendingSync();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);

    let removeAppStateListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          flushPendingSync();
        } else {
          handleForegroundResume();
        }
      }).then((handle) => {
        removeAppStateListener = () => {
          void handle.remove();
        };
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
      removeAppStateListener?.();
    };
  }, [syncConfig, flushPendingSync, handleForegroundResume]);

  // Filter out soft-deleted tombstones from UI queries
  const groups = useLiveQuery(
    () => db.groups.orderBy('order').filter((g) => !g.deletedAt).toArray(),
    [],
    [],
  );
  const events = useLiveQuery(
    () => db.events.orderBy('order').filter((e) => !e.deletedAt).toArray(),
    [],
    [],
  );
  const records = useLiveQuery(
    () => db.records.filter((r) => !r.deletedAt).toArray(),
    [],
    [],
  );

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
    notifyLocalMutation();
    showToast(`已速记「${event.name}」`, id);
  };

  const handleUndoRecord = async () => {
    if (!toast?.undoRecordId) return;
    await softDeleteRecord(toast.undoRecordId);
    setToast(null);
    showToast('已撤销刚才的记录');
  };

  const handleDeleteEvent = async (event: EventItem) => {
    await softDeleteEvent(event.id);
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
                syncConfig={syncConfig}
                syncMeta={syncMeta}
                syncing={syncing}
                onChangeTheme={setPreference}
                onManageGroups={() => setGroupManagerOpen(true)}
                onOpenCloudSync={() => setCloudSyncOpen(true)}
                onSyncNow={() => void runSync(false)}
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
            className="fixed bottom-20 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full bg-[var(--pill-active-bg)] px-4 py-2.5 text-xs font-medium text-[var(--pill-active-fg)] shadow-lg backdrop-blur-md"
          >
            <span className="truncate">{toast.message}</span>
            {toast.undoRecordId && (
              <button
                type="button"
                onClick={handleUndoRecord}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-semibold text-emerald-400 hover:bg-emerald-500/30"
              >
                <Undo2 className="h-3 w-3 shrink-0" />
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

        <CloudSyncSheet
          open={cloudSyncOpen}
          config={syncConfig}
          meta={syncMeta}
          syncing={syncing}
          isDark={isDark}
          onClose={() => setCloudSyncOpen(false)}
          onConfigSaved={(next) => {
            setSyncConfig(next);
            setSyncMeta(loadSyncMeta());
          }}
          onSyncNow={(override) => runSync(false, override)}
          onNotify={(m) => showToast(m)}
        />
      </div>
    </div>
  );
}

export default App;
