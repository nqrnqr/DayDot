import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart3,
  CalendarDays,
  Cloud,
  Home,
  Plus,
  RefreshCw,
  Settings,
  Undo2,
} from 'lucide-react';
import type { EventItem, EventRecord } from './types/models';
import { getColorToken } from './constants/theme';
import { isSameDay } from './utils/date';
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

  const todayRecordCount = useMemo(() => {
    const now = new Date();
    return records.filter((r) => isSameDay(r.timestamp, now)).length;
  }, [records]);

  const activeEventCount = useMemo(
    () => events.filter((e) => !e.archived).length,
    [events],
  );

  const emeraldToken = getColorToken('emerald', isDark);

  const sidebarSyncLabel = !syncConfig
    ? '未配置云同步'
    : syncing
      ? '同步中...'
      : syncMeta.lastError
        ? '同步失败'
        : syncMeta.pendingChanges
          ? '有待同步改动'
          : '云端已同步';

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

  const navItems = [
    ['home', '主页', Home],
    ['trends', '趋势', BarChart3],
    ['calendar', '查看', CalendarDays],
    ['settings', '设置', Settings],
  ] as const;

  return (
    <div className="min-h-dvh bg-[var(--bg-outer)] sm:py-4 lg:bg-[var(--bg-canvas)] lg:py-0">
      <div className="relative mx-auto min-h-dvh w-full max-w-[460px] bg-[var(--bg-canvas)] sm:min-h-[calc(100dvh-2rem)] sm:max-w-[500px] sm:overflow-hidden sm:rounded-[32px] sm:shadow-[0_12px_40px_rgba(0,0,0,0.14)] lg:mx-0 lg:flex lg:min-h-dvh lg:max-w-none lg:overflow-visible lg:rounded-none lg:shadow-none">
        {/* Desktop Persistent Left Sidebar (lg and above) */}
        <aside
          aria-label="桌面端侧边导航"
          className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[244px] lg:shrink-0 lg:flex-col lg:border-r lg:border-[var(--border-soft)] lg:bg-[var(--bg-surface)] lg:px-4 lg:py-6 xl:w-[260px]"
        >
          {/* Brand + Today Badge */}
          <div className="px-2">
            <div className="flex items-baseline justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="text-left focus:outline-none"
              >
                <span className="text-[26px] leading-none font-extrabold tracking-tight text-[var(--fg-primary)] italic">
                  DayDot
                </span>
              </button>
              {todayRecordCount > 0 && (
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums"
                  style={{
                    backgroundColor: emeraldToken.soft,
                    color: emeraldToken.ink,
                  }}
                >
                  今日 {todayRecordCount} 迹
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-[var(--fg-muted)]">
              轻量无压力的生活迹点记录
            </p>
          </div>

          {/* Primary Quick Action */}
          <button
            type="button"
            onClick={() =>
              setEventEditorState({ open: true, editingEvent: null })
            }
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--pill-active-bg)] px-4 py-2.5 text-[13px] font-semibold text-[var(--pill-active-fg)] shadow-xs transition hover:opacity-92 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4 stroke-[2.4]" />
            新建事件
          </button>

          {/* Main Navigation Links */}
          <nav aria-label="主导航" className="mt-6 flex-1 space-y-1">
            {navItems.map(([id, label, Icon]) => {
              const active = !selectedEvent && activeTab === id;
              const isParentOfDetail = Boolean(selectedEvent) && activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] transition ${
                    active
                      ? 'bg-[var(--bg-subtle)] font-semibold text-[var(--fg-primary)]'
                      : isParentOfDetail
                        ? 'bg-[var(--bg-canvas)] font-medium text-[var(--fg-primary)]'
                        : 'font-medium text-[var(--fg-secondary)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-primary)]'
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${
                      active || isParentOfDetail ? 'stroke-[2.3]' : 'stroke-[1.9]'
                    }`}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer: Cloud Sync Status & Compact Stats */}
          <div className="mt-auto space-y-2.5 border-t border-[var(--border-soft)] pt-4">
            <div className="flex items-center gap-1.5 rounded-2xl bg-[var(--bg-canvas)] px-3 py-2">
              <button
                type="button"
                onClick={() => setCloudSyncOpen(true)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left transition hover:opacity-80"
              >
                <Cloud
                  className={`h-4 w-4 shrink-0 ${
                    syncMeta.lastError
                      ? 'text-rose-500'
                      : syncConfig
                        ? ''
                        : 'text-[var(--fg-muted)]'
                  }`}
                  style={
                    syncConfig && !syncMeta.lastError
                      ? { color: emeraldToken.ink }
                      : undefined
                  }
                />
                <span
                  className={`truncate text-xs font-medium ${
                    syncMeta.lastError
                      ? 'text-rose-500'
                      : 'text-[var(--fg-secondary)]'
                  }`}
                >
                  {sidebarSyncLabel}
                </span>
              </button>
              {syncConfig && (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void runSync(false)}
                  aria-label="立即同步"
                  title="立即同步"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:opacity-85 active:scale-90 disabled:opacity-50"
                  style={{
                    backgroundColor: emeraldToken.soft,
                    color: emeraldToken.ink,
                  }}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
                  />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-2 text-[11px] text-[var(--fg-muted)] tabular-nums">
              <span>{activeEventCount} 个事件</span>
              <span>{records.length} 条记录</span>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="min-w-0 flex-1">
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

              {/* Mobile / Tablet Bottom Tab Navigation */}
              <nav
                aria-label="底部主导航"
                className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[460px] border-t border-[var(--border-soft)] bg-[var(--bg-surface-blur)] px-2 pt-2 backdrop-blur-md sm:max-w-[500px] sm:rounded-b-[32px] lg:hidden"
              >
                <div className="grid grid-cols-4">
                  {navItems.map(([id, label, Icon]) => {
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
        </div>

        {/* Toast Notification */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-max max-w-[calc(100%_-_2rem)] items-center gap-2.5 rounded-full bg-[var(--pill-active-bg)] px-4 py-2.5 text-xs font-medium text-[var(--pill-active-fg)] shadow-lg backdrop-blur-md lg:bottom-6 lg:left-[244px] xl:left-[260px]"
          >
            <span className="min-w-0 truncate">{toast.message}</span>
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
