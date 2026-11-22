import { useRef, useState } from 'react';
import {
  ChevronRight,
  Database,
  Download,
  FolderCog,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import type { BackupPayload } from '../types/models';
import { getColorToken } from '../constants/theme';
import type { ThemePreference } from '../utils/themeMode';
import {
  clearAllData,
  exportBackupJson,
  importBackupJson,
  seedDemoData,
} from '../db/db';

interface SettingsPageProps {
  groupCount: number;
  eventCount: number;
  recordCount: number;
  isDark: boolean;
  themePreference: ThemePreference;
  systemDark: boolean;
  onChangeTheme: (pref: ThemePreference) => void;
  onManageGroups: () => void;
  onNotify: (msg: string) => void;
}

export function SettingsPage({
  groupCount,
  eventCount,
  recordCount,
  isDark,
  themePreference,
  systemDark,
  onChangeTheme,
  onManageGroups,
  onNotify,
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [confirmClear, setConfirmClear] = useState(false);

  const emerald = getColorToken('emerald', isDark);
  const indigo = getColorToken('indigo', isDark);

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

  const handleResetDemo = async () => {
    await clearAllData();
    await seedDemoData();
    onNotify('已恢复示例数据（引体向上、练琴、维生素、奶茶）');
  };

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    await clearAllData();
    setConfirmClear(false);
    onNotify('已清空全部本地数据');
  };

  return (
    <div className="flex flex-col pb-24">
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas-blur)] px-5 pt-5 pb-3 backdrop-blur-md">
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--fg-primary)]">
          设置
        </h1>
      </header>

      <main className="space-y-3.5 px-4 pt-1">
        {/* Local Status Card */}
        <section className="daydot-card rounded-[22px] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: emerald.soft, color: emerald.ink }}
            >
              <ShieldCheck className="h-5.5 w-5.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--fg-primary)]">
                纯本地离线存储
              </h2>
              <p className="mt-0.5 text-xs font-medium text-[var(--fg-muted)]">
                当前已保存 {eventCount} 个事件 · {recordCount} 条记录，数据完全留在你的设备
              </p>
            </div>
          </div>
        </section>

        {/* Appearance / Dark Mode Toggle */}
        <section className="daydot-card space-y-3 rounded-[22px] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--fg-primary)]">
              <Palette className="h-4 w-4 text-[var(--fg-muted)]" />
              外观主题
            </div>
            <span className="text-[11px] font-medium text-[var(--fg-muted)]">
              {themePreference === 'system'
                ? `系统当前：${systemDark ? '深色' : '浅色'}`
                : themePreference === 'dark'
                  ? '已固定深色'
                  : '已固定浅色'}
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="外观主题"
            className="grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--bg-subtle)] p-1"
          >
            {(
              [
                ['system', '跟随系统', Monitor],
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
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition active:scale-95 ${
                    active
                      ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                      : 'text-[var(--fg-muted)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Clean Single-Row Entry for Group Management */}
        <section className="daydot-card overflow-hidden rounded-[22px] bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={onManageGroups}
            className="flex w-full items-center justify-between px-4 py-4 text-left transition hover:bg-[var(--bg-canvas)] active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5 text-sm font-bold text-[var(--fg-primary)]">
              <FolderCog className="h-4 w-4 text-[var(--fg-muted)]" />
              分组管理
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-[var(--fg-muted)]">
              <span>{groupCount} 个分组</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        </section>

        {/* Backup & Restore */}
        <section className="daydot-card space-y-3 rounded-[22px] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--fg-primary)]">
            <Database className="h-4 w-4 text-[var(--fg-muted)]" />
            数据备份与恢复（JSON）
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--pill-active-bg)] py-3 text-xs font-semibold text-[var(--pill-active-fg)] transition active:scale-95"
            >
              <Download className="h-4 w-4" />
              导出 JSON 备份
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--bg-subtle)] py-3 text-xs font-semibold text-[var(--fg-primary)] transition hover:bg-[var(--bg-subtle-hover)] active:scale-95"
            >
              <Upload className="h-4 w-4" />
              导入恢复数据
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[var(--bg-canvas)] px-3 py-2 text-xs">
            <span className="font-medium text-[var(--fg-muted)]">导入策略</span>
            <div className="inline-flex gap-1.5">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`rounded-lg px-2.5 py-1 font-semibold ${
                  importMode === 'merge'
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                    : 'text-[var(--fg-muted)]'
                }`}
              >
                合并保留
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`rounded-lg px-2.5 py-1 font-semibold ${
                  importMode === 'replace'
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                    : 'text-[var(--fg-muted)]'
                }`}
              >
                覆盖替换
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

        {/* Android PWA Tip */}
        <section className="daydot-card rounded-[22px] bg-[var(--bg-surface)] p-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: indigo.soft, color: indigo.ink }}
            >
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-[var(--fg-primary)]">
                安装到 Android 桌面
              </h2>
              <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
                在手机 Chrome / Edge 打开后，点击右上角菜单选择「安装应用」或「添加到主屏幕」，即可全屏离线像原生 App 一样使用（已内置 192px / 512px 高清桌面图标）。
              </p>
            </div>
          </div>
        </section>

        {/* Demo / Reset Actions */}
        <section className="daydot-card space-y-2 rounded-[22px] bg-[var(--bg-surface)] p-4">
          <button
            type="button"
            onClick={handleResetDemo}
            className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[var(--fg-secondary)] transition hover:bg-[var(--bg-canvas)]"
          >
            <span className="inline-flex shrink-0 items-center gap-2">
              <RotateCcw className="h-4 w-4 text-[var(--fg-muted)]" />
              恢复初始示例数据
            </span>
            <span className="truncate text-[11px] font-medium text-[var(--fg-muted)]">
              引体向上 / 练琴 / 维生素 / 奶茶
            </span>
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
              confirmClear
                ? 'bg-red-600 text-white'
                : 'text-red-500 hover:bg-red-500/10'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {confirmClear ? '再次点击确认清空全部数据' : '清空全部本地数据'}
            </span>
          </button>
        </section>
      </main>
    </div>
  );
}
