import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Cloud,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  Unlink,
} from 'lucide-react';
import { getColorToken } from '../constants/theme';
import {
  parseRepoInput,
  saveSyncConfig,
  testGitHubConnection,
  type GitHubSyncConfig,
  type SyncStatusMeta,
} from '../services/githubSync';
import { formatRelativeSince } from '../utils/date';
import { BottomSheetDialog } from './BottomSheetDialog';

interface CloudSyncSheetProps {
  open: boolean;
  config: GitHubSyncConfig | null;
  meta: SyncStatusMeta;
  syncing: boolean;
  isDark: boolean;
  onClose: () => void;
  onConfigSaved: (next: GitHubSyncConfig | null) => void;
  onSyncNow: (overrideConfig?: GitHubSyncConfig) => Promise<void>;
  onNotify: (msg: string) => void;
}

export function CloudSyncSheet({
  open,
  config,
  meta,
  syncing,
  isDark,
  onClose,
  onConfigSaved,
  onSyncNow,
  onNotify,
}: CloudSyncSheetProps) {
  const [repoInput, setRepoInput] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    type: 'ok' | 'warn' | 'err';
    text: string;
  } | null>(null);
  const [confirmUnbind, setConfirmUnbind] = useState(false);

  const emerald = getColorToken('emerald', isDark);

  useEffect(() => {
    if (!open) return;
    setTestFeedback(null);
    setConfirmUnbind(false);
    setShowToken(false);
    if (config) {
      setRepoInput(`${config.owner}/${config.repo}`);
      setBranch(config.branch || 'main');
      setToken(config.token);
      setAutoSync(config.autoSync);
      setGuideOpen(false);
    } else {
      setRepoInput('');
      setBranch('main');
      setToken('');
      setAutoSync(true);
      setGuideOpen(true);
    }
  }, [open, config]);

  const buildCandidateConfig = (): GitHubSyncConfig | null => {
    const parsed = parseRepoInput(repoInput);
    if (!parsed) {
      setTestFeedback({
        type: 'err',
        text: '仓库格式不正确，请填写「用户名/仓库名」或完整 GitHub 仓库链接',
      });
      return null;
    }
    if (!token.trim()) {
      setTestFeedback({ type: 'err', text: '请先填写 GitHub Fine-grained Token' });
      return null;
    }
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: branch.trim() || 'main',
      path: 'daydot-sync.json',
      token: token.trim(),
      autoSync,
    };
  };

  const handleTest = async () => {
    const candidate = buildCandidateConfig();
    if (!candidate || testing) return;
    setTesting(true);
    setTestFeedback(null);
    try {
      const info = await testGitHubConnection(candidate);
      if (info.defaultBranch && info.defaultBranch !== branch) {
        setBranch(info.defaultBranch);
      }
      if (!info.isPrivate) {
        setTestFeedback({
          type: 'warn',
          text: `连接成功（分支 ${info.defaultBranch}），但该仓库目前是公开仓库，建议改为 Private 保护隐私。`,
        });
      } else {
        setTestFeedback({
          type: 'ok',
          text: `连接成功！私有仓库就绪（默认分支：${info.defaultBranch}）。`,
        });
      }
    } catch (err) {
      setTestFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : '测试连接失败',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = buildCandidateConfig();
    if (!candidate) return;
    setTestFeedback(null);
    saveSyncConfig(candidate);
    onConfigSaved(candidate);
    await onSyncNow(candidate);
  };

  const handleToggleAutoSync = () => {
    const nextVal = !autoSync;
    setAutoSync(nextVal);
    if (config) {
      const updated = { ...config, autoSync: nextVal };
      saveSyncConfig(updated);
      onConfigSaved(updated);
      onNotify(nextVal ? '已开启自动同步' : '已切换为手动同步');
    }
  };

  const handleDisconnect = () => {
    if (!confirmUnbind) {
      setConfirmUnbind(true);
      return;
    }
    saveSyncConfig(null);
    onConfigSaved(null);
    setConfirmUnbind(false);
    onNotify('已解绑云同步（本地数据完整保留）');
  };

  return (
    <BottomSheetDialog
      open={open}
      onClose={onClose}
      title="云同步 · GitHub 私有仓库"
      accentColor={emerald.solid}
      bodyStyle={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div className="space-y-3">
        {/* Active Sync Status & One-Tap Sync Card */}
        {config && (
          <section className="space-y-3 rounded-[20px] bg-[var(--bg-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: emerald.soft, color: emerald.ink }}
                >
                  <Cloud className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--fg-primary)]">
                    {config.owner}/{config.repo}
                  </div>
                  <div className="text-xs text-[var(--fg-muted)]">
                    {syncing
                      ? '正在同步中...'
                      : meta.lastError
                        ? '上次同步失败'
                        : meta.lastSyncedAt
                          ? `上次同步：${formatRelativeSince(meta.lastSyncedAt)}`
                          : '尚未执行首次同步'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={syncing}
                onClick={() => onSyncNow()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-white transition active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: emerald.solid }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '同步中' : '立即同步'}
              </button>
            </div>

            {meta.lastError && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{meta.lastError}</span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-input)] px-3.5 py-2.5">
              <div>
                <div className="text-xs font-medium text-[var(--fg-primary)]">
                  自动静默同步
                </div>
                <div className="text-[11px] text-[var(--fg-muted)]">
                  打开应用与修改数据后自动后台合并
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoSync}
                onClick={handleToggleAutoSync}
                className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                style={{
                  backgroundColor: autoSync ? emerald.solid : 'var(--border-color)',
                }}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                    autoSync ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>
          </section>
        )}

        {/* Configuration Form Card */}
        <form
          onSubmit={handleSaveAndSync}
          className="space-y-3.5 rounded-[20px] bg-[var(--bg-surface)] p-4"
        >
          <div>
            <label
              htmlFor="sync-repo"
              className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]"
            >
              私有仓库（用户名/仓库名 或 仓库链接）
            </label>
            <input
              id="sync-repo"
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="例如：username/DayDot-Data"
              className="w-full rounded-xl border border-transparent bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-color)] focus:bg-[var(--bg-surface)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="sync-token"
              className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]"
            >
              GitHub Access Token（仅存本机浏览器）
            </label>
            <div className="flex items-center rounded-xl border border-transparent bg-[var(--bg-input)] pr-2 focus-within:border-[var(--border-color)] focus-within:bg-[var(--bg-surface)]">
              <input
                id="sync-token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_..."
                autoComplete="off"
                className="w-full bg-transparent px-3.5 py-2.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? '隐藏 Token' : '显示 Token'}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="sync-branch"
              className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]"
            >
              分支名
            </label>
            <input
              id="sync-branch"
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full rounded-xl border border-transparent bg-[var(--bg-input)] px-3.5 py-2 text-xs text-[var(--fg-primary)] focus:border-[var(--border-color)] focus:bg-[var(--bg-surface)] focus:outline-none"
            />
          </div>

          {testFeedback && (
            <div
              className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed ${
                testFeedback.type === 'ok'
                  ? 'bg-emerald-500/12 text-emerald-600'
                  : testFeedback.type === 'warn'
                    ? 'bg-amber-500/12 text-amber-600'
                    : 'bg-rose-500/12 text-rose-500'
              }`}
            >
              {testFeedback.type === 'ok' ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span>{testFeedback.text}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={testing}
              onClick={handleTest}
              className="rounded-2xl bg-[var(--bg-subtle)] py-3 text-xs font-medium text-[var(--fg-primary)] transition hover:bg-[var(--bg-subtle-hover)] active:scale-[0.98] disabled:opacity-50"
            >
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button
              type="submit"
              disabled={syncing}
              className="rounded-2xl py-3 text-xs font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: emerald.solid }}
            >
              {syncing ? '同步中...' : '保存并立即同步'}
            </button>
          </div>
        </form>

        {/* Collapsible 3-step Setup Guide */}
        <section className="rounded-[20px] bg-[var(--bg-surface)] p-4">
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-medium text-[var(--fg-secondary)]"
          >
            <span>3 步配置指南（0 成本 · 完全私密）</span>
            <ChevronDown
              className={`h-4 w-4 text-[var(--fg-muted)] transition-transform ${
                guideOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {guideOpen && (
            <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-[var(--fg-muted)]">
              <li>
                1. 打开{' '}
                <a
                  href="https://github.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium underline"
                  style={{ color: emerald.ink }}
                >
                  GitHub 新建仓库
                  <ExternalLink className="h-3 w-3" />
                </a>
                ，起名如 <code className="rounded bg-[var(--bg-subtle)] px-1">DayDot-Data</code>，务必选择{' '}
                <strong className="font-medium text-[var(--fg-primary)]">Private（私有）</strong>{' '}
                并勾选「Add a README file」直接创建。
              </li>
              <li>
                2. 打开{' '}
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium underline"
                  style={{ color: emerald.ink }}
                >
                  生成 Fine-grained Token
                  <ExternalLink className="h-3 w-3" />
                </a>
                ：Repository access 选 <strong className="font-medium text-[var(--fg-primary)]">Only select repositories</strong> 并勾选刚才的私有仓库；下方 Repository permissions 里把{' '}
                <strong className="font-medium text-[var(--fg-primary)]">Contents</strong> 设为{' '}
                <strong className="font-medium text-[var(--fg-primary)]">Read and write</strong>。
              </li>
              <li>
                3. 把生成的 Token 分别粘贴进手机与电脑的这里即可自动合并多端数据，每次同步都会在你的私有仓库保留历史版本。
              </li>
            </ol>
          )}
        </section>

        {/* Unbind button */}
        {config && (
          <button
            type="button"
            onClick={handleDisconnect}
            className={`flex w-full items-center justify-center gap-1.5 rounded-[18px] py-3 text-xs font-medium transition active:scale-[0.99] ${
              confirmUnbind
                ? 'bg-red-600 text-white'
                : 'bg-[var(--bg-surface)] text-red-500 hover:bg-red-500/10'
            }`}
          >
            <Unlink className="h-3.5 w-3.5" />
            {confirmUnbind ? '再次点击确认解绑（本地数据保留）' : '解绑云同步'}
          </button>
        )}
      </div>
    </BottomSheetDialog>
  );
}
