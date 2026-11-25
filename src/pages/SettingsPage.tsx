import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ChevronRight,
  Cloud,
  Download,
  FolderCog,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import type { BackupPayload } from '../types/models';
import { getColorToken } from '../constants/theme';
import type { ThemePreference } from '../utils/themeMode';
import type { GitHubSyncConfig, SyncStatusMeta } from '../services/githubSync';
import {
  BUILTIN_APP_VERSION,
  checkForOtaUpdate,
  downloadAndApplyOta,
  getActiveAppVersion,
  isNativeAndroid,
  type OtaManifest,
} from '../services/otaUpdater';
import { formatRelativeSince } from '../utils/date';
import {
  clearAllData,
  exportBackupJson,
  importBackupJson,
} from '../db/db';

interface SettingsPageProps {
  groupCount: number;
  eventCount: number;
  recordCount: number;
  isDark: boolean;
  themePreference: ThemePreference;
  systemDark: boolean;
  syncConfig: GitHubSyncConfig | null;
  syncMeta: SyncStatusMeta;
  syncing: boolean;
  onChangeTheme: (pref: ThemePreference) => void;
  onManageGroups: () => void;
  onOpenCloudSync: () => void;
  onSyncNow: () => void;
  onNotify: (msg: string) => void;
}

export function SettingsPage({
  groupCount,
  eventCount,
  recordCount,
  isDark,
  themePreference,
  systemDark,
  syncConfig,
  syncMeta,
  syncing,
  onChangeTheme,
  onManageGroups,
  onOpenCloudSync,
  onSyncNow,
  onNotify,
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [confirmClear, setConfirmClear] = useState(false);

  // Native APK OTA hot-update state
  const nativeAndroid = isNativeAndroid();
  const [appVersion, setAppVersion] = useState<string>(BUILTIN_APP_VERSION);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [otaError, setOtaError] = useState<string | null>(null);
  const [pendingOta, setPendingOta] = useState<OtaManifest | null>(null);

  useEffect(() => {
    void getActiveAppVersion().then(setAppVersion);
  }, []);

  const emerald = getColorToken('emerald', isDark);

  const handleCheckOta = async () => {
    if (checkingUpdate || applyingUpdate) return;
    setCheckingUpdate(true);
    setOtaError(null);
    try {
      const result = await checkForOtaUpdate();
      setAppVersion(result.currentVersion);
      if (result.hasUpdate) {
        setPendingOta(result.remote);
        onNotify(`发现新版本 v${result.remote.version}`);
      } else {
        setPendingOta(null);
        onNotify(`已是最新版本 (v${result.currentVersion})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '检查更新失败';
      setOtaError(msg);
      onNotify(msg);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyOta = async () => {
    if (!pendingOta || applyingUpdate) return;
    setApplyingUpdate(true);
    setDownloadPercent(0);
    setOtaError(null);
    try {
      onNotify(`正在下载 v${pendingOta.version}...`);
      await downloadAndApplyOta(pendingOta, (pct) => setDownloadPercent(pct));
    } catch (err) {
      setApplyingUpdate(false);
      setDownloadPercent(null);
      const msg = err instanceof Error ? err.message : '热更新下载失败';
      setOtaError(msg);
      onNotify(msg);
    }
  };

  const handleExport = async () => {
    const payload = await exportBackupJson();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `daydot-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(
      `已导出备份（${payload.events.length} 个事件 / ${payload.records.length} 条记录）`,
    );
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      const summary = await importBackupJson(parsed, importMode);
      onNotify(`导入成功：${summary.events} 个事件，${summary.records} 条记录`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : '导入失败，请检查文件格式');
    }
  };

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    await clearAllData();
    setConfirmClear(false);
    onNotify('已清空本机数据');
  };

  const syncSubtitle = !syncConfig
    ? '未配置'
    : syncing
      ? '同步中...'
      : syncMeta.lastError
        ? '同步失败'
        : syncMeta.pendingChanges
          ? '待同步'
          : syncMeta.lastSyncedAt
            ? `已同步 · ${formatRelativeSince(syncMeta.lastSyncedAt)}`
            : '待首次同步';

  return (
    <div className="flex flex-col pb-24 lg:pb-12">
      <header className="pt-safe sticky top-0 z-20 bg-[var(--bg-canvas-blur)] px-5 pb-3 backdrop-blur-md lg:px-8 lg:pt-7 lg:pb-4">
        <div className="mx-auto flex w-full max-w-2xl items-baseline justify-between">
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--fg-primary)] lg:text-[26px]">
            设置
          </h1>
          <span className="text-xs text-[var(--fg-muted)] tabular-nums">
            {eventCount} 事件 · {recordCount} 记录
          </span>
        </div>
      </header>

      <main className="px-4 pt-1 lg:px-8 lg:pt-2">
        <div className="mx-auto w-full max-w-2xl space-y-4 lg:space-y-5">
          {/* Group 1: Appearance & Organization */}
        <section className="daydot-card overflow-hidden rounded-[22px] bg-[var(--bg-surface)]">
          {/* Theme selector */}
          <div className="space-y-2.5 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-sm font-medium text-[var(--fg-primary)]">
                <Palette className="h-4 w-4 text-[var(--fg-muted)]" />
                外观
              </div>
              {themePreference === 'system' && (
                <span className="text-xs text-[var(--fg-muted)]">
                  当前{systemDark ? '深色' : '浅色'}
                </span>
              )}
            </div>

            <div
              role="radiogroup"
              aria-label="外观主题"
              className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--bg-subtle)] p-1"
            >
              {(
                [
                  ['system', '自动', Monitor],
                  ['light', '浅色', Sun],
                  ['dark', '深色', Moon],
                ] as const
              ).map(([value, label, Icon]) => {
                const active = themePreference === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChangeTheme(value)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition active:scale-95 ${
                      active
                        ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)]'
                        : 'text-[var(--fg-muted)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group Management Row */}
          <button
            type="button"
            onClick={onManageGroups}
            className="flex w-full items-center justify-between border-t border-[var(--border-soft)] px-4 py-3.5 text-left transition hover:bg-[var(--bg-canvas)] active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5 text-sm font-medium text-[var(--fg-primary)]">
              <FolderCog className="h-4 w-4 text-[var(--fg-muted)]" />
              分组管理
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
              <span>{groupCount} 个分组</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        </section>

        {/* Group 2: Sync & Local Backup */}
        <section className="daydot-card overflow-hidden rounded-[22px] bg-[var(--bg-surface)]">
          {/* Cloud Sync Row */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <button
              type="button"
              onClick={onOpenCloudSync}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition active:opacity-75"
            >
              <Cloud className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
              <span className="text-sm font-medium text-[var(--fg-primary)]">
                云同步
              </span>
              <span
                className={`ml-auto truncate pr-1 text-xs ${
                  syncMeta.lastError ? 'text-rose-500' : 'text-[var(--fg-muted)]'
                }`}
              >
                {syncSubtitle}
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-1">
              {syncConfig && (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={onSyncNow}
                  aria-label="立即同步"
                  title="立即同步"
                  className="flex h-7 w-7 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-50"
                  style={{ backgroundColor: emerald.soft, color: emerald.ink }}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenCloudSync}
                aria-label="配置云同步"
                className="flex h-7 w-6 items-center justify-center text-[var(--fg-muted)]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Native Android OTA Hot Update Row (only shown inside Android APK) */}
          {nativeAndroid && (
            <div className="border-t border-[var(--border-soft)] px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ArrowDownToLine className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--fg-primary)]">
                      应用热更新
                    </div>
                    <div className="truncate text-[11px] text-[var(--fg-muted)]">
                      {pendingOta
                        ? `发现新版 v${pendingOta.version}，无需重装 APK`
                        : `页面运行版本 v${appVersion}`}
                    </div>
                  </div>
                </div>

                {pendingOta ? (
                  <button
                    type="button"
                    disabled={applyingUpdate}
                    onClick={handleApplyOta}
                    className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-white tabular-nums transition active:scale-95 disabled:opacity-60"
                    style={{ backgroundColor: emerald.solid }}
                  >
                    {applyingUpdate
                      ? downloadPercent !== null && downloadPercent > 0
                        ? `下载中 ${downloadPercent}%`
                        : '更新中...'
                      : '立即更新'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={checkingUpdate}
                    onClick={handleCheckOta}
                    className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--fg-primary)] transition active:scale-95 disabled:opacity-60"
                  >
                    {checkingUpdate ? '检查中...' : '检查更新'}
                  </button>
                )}
              </div>

              {otaError && (
                <p className="mt-2 break-all rounded-xl bg-red-500/8 px-3 py-2 text-[11px] leading-relaxed text-red-500">
                  {otaError}
                </p>
              )}
            </div>
          )}

          {/* Export JSON Row */}
          <button
            type="button"
            onClick={handleExport}
            className="flex w-full items-center justify-between border-t border-[var(--border-soft)] px-4 py-3.5 text-left transition hover:bg-[var(--bg-canvas)] active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5 text-sm font-medium text-[var(--fg-primary)]">
              <Download className="h-4 w-4 text-[var(--fg-muted)]" />
              导出备份
            </div>
            <span className="text-xs text-[var(--fg-muted)]">JSON</span>
          </button>

          {/* Import JSON Row with inline strategy toggle */}
          <div className="flex items-center justify-between border-t border-[var(--border-soft)] px-4 py-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-1 items-center gap-2.5 py-0.5 text-left transition active:opacity-75"
            >
              <Upload className="h-4 w-4 text-[var(--fg-muted)]" />
              <span className="text-sm font-medium text-[var(--fg-primary)]">
                导入备份
              </span>
            </button>

            <div className="inline-flex rounded-full bg-[var(--bg-subtle)] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`rounded-full px-2.5 py-0.5 font-medium transition ${
                  importMode === 'merge'
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)]'
                    : 'text-[var(--fg-muted)]'
                }`}
              >
                合并
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`rounded-full px-2.5 py-0.5 font-medium transition ${
                  importMode === 'replace'
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)]'
                    : 'text-[var(--fg-muted)]'
                }`}
              >
                覆盖
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </section>

        {/* Group 3: Clean Local Reset */}
        <section className="daydot-card overflow-hidden rounded-[22px] bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={handleClearAll}
            className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-medium transition ${
              confirmClear
                ? 'bg-red-600 text-white'
                : 'text-red-500 hover:bg-red-500/8'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <Trash2 className="h-4 w-4" />
              {confirmClear ? '再次点击确认清空本机数据' : '清空本机数据'}
            </span>
            {!confirmClear && (
              <span className="text-xs font-normal text-[var(--fg-muted)]">
                不影响云端
              </span>
            )}
          </button>
        </section>

        <p className="pt-2 text-center text-[11px] text-[var(--fg-muted)] opacity-75">
          DayDot · 日迹 v{appVersion}
        </p>
        </div>
      </main>
    </div>
  );
}
