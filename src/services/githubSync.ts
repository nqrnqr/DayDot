import type { EventItem, EventRecord, Group } from '../types/models';
import { createId, db, isUserModified } from '../db/db';

export interface GitHubSyncConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
  autoSync: boolean;
}

export interface SyncStatusMeta {
  lastSyncedAt: number | null;
  lastError: string | null;
  pendingChanges: boolean;
  lastMutationAt: number | null;
}

interface SyncEntity {
  id: string;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface SyncFilePayload {
  app: 'DayDot';
  version: 1;
  syncedAt: number;
  deviceId: string;
  groups: Group[];
  events: EventItem[];
  records: EventRecord[];
}

export interface SyncResult {
  pulledCount: number;
  pushed: boolean;
  syncedAt: number;
  summary: string;
}

const CONFIG_KEY = 'daydot_github_sync_config_v1';
const META_KEY = 'daydot_github_sync_meta_v1';
const DEVICE_ID_KEY = 'daydot_device_id_v1';
const USER_MODIFIED_KEY = 'daydot_user_modified_v1';
const TOMBSTONE_TTL_MS = 90 * 86_400_000;

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = createId('dev');
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_local';
  }
}

export function loadSyncConfig(): GitHubSyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GitHubSyncConfig>;
    if (!parsed.owner || !parsed.repo || !parsed.token) return null;
    return {
      owner: parsed.owner.trim(),
      repo: parsed.repo.trim(),
      branch: parsed.branch?.trim() || 'main',
      path: parsed.path?.trim() || 'daydot-sync.json',
      token: parsed.token.trim(),
      autoSync: parsed.autoSync !== false,
    };
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: GitHubSyncConfig | null): void {
  try {
    if (!config) {
      localStorage.removeItem(CONFIG_KEY);
      localStorage.removeItem(META_KEY);
    } else {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadSyncMeta(): SyncStatusMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return {
        lastSyncedAt: null,
        lastError: null,
        pendingChanges: false,
        lastMutationAt: null,
      };
    }
    const parsed = JSON.parse(raw) as Partial<SyncStatusMeta>;
    return {
      lastSyncedAt:
        typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
      pendingChanges: Boolean(parsed.pendingChanges),
      lastMutationAt:
        typeof parsed.lastMutationAt === 'number' ? parsed.lastMutationAt : null,
    };
  } catch {
    return {
      lastSyncedAt: null,
      lastError: null,
      pendingChanges: false,
      lastMutationAt: null,
    };
  }
}

export function saveSyncMeta(meta: SyncStatusMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore
  }
}

export function markSyncPending(): SyncStatusMeta {
  const prev = loadSyncMeta();
  const next: SyncStatusMeta = {
    ...prev,
    pendingChanges: true,
    lastMutationAt: Date.now(),
  };
  saveSyncMeta(next);
  return next;
}

/** Parse either "owner/repo" or "https://github.com/owner/repo(.git)" */
export function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim().replace(/\.git$/i, '').replace(/\/+$/, '');
  const urlMatch = cleaned.match(/github\.com\/([^/\s]+)\/([^/\s]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }
  const slashMatch = cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slashMatch) {
    return { owner: slashMatch[1], repo: slashMatch[2] };
  }
  return null;
}

/** UTF-8 safe Base64 encode/decode for Chinese & emoji payloads */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const cleaned = b64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('连接 GitHub 超时，请检查网络后重试');
    }
    throw new Error('无法连接 GitHub（本地数据已安全保留，稍后可重试）');
  } finally {
    window.clearTimeout(timer);
  }
}

function explainHttpError(status: number, context: 'repo' | 'contents'): string {
  if (status === 401) return 'Token 无效或已过期，请重新检查 Token';
  if (status === 403) return '权限不足：请确认 Token 已授予该仓库 Contents 读写权限';
  if (status === 404) {
    return context === 'repo'
      ? '找不到该仓库，请检查「用户名/仓库名」或 Token 权限'
      : '远端仓库路径不可访问，请检查分支名称与 Token 权限';
  }
  if (status === 409) return '远端数据刚被其他设备更新，请重试同步';
  return `GitHub 请求失败 (HTTP ${status})`;
}

export async function testGitHubConnection(
  config: Pick<GitHubSyncConfig, 'owner' | 'repo' | 'token'>,
): Promise<{ ok: true; isPrivate: boolean; defaultBranch: string }> {
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: githubHeaders(config.token),
  });

  if (!res.ok) {
    throw new Error(explainHttpError(res.status, 'repo'));
  }

  const data = (await res.json()) as {
    private?: boolean;
    default_branch?: string;
  };

  return {
    ok: true,
    isPrivate: Boolean(data.private),
    defaultBranch: data.default_branch || 'main',
  };
}

/** Deterministic Last-Write-Wins merge by id & updatedAt */
function mergeCollections<T extends SyncEntity>(
  localList: T[],
  remoteList: T[],
): { merged: T[]; remoteUpdates: number; localOnlyOrNewer: boolean } {
  const map = new Map<string, T>();
  for (const item of localList) {
    map.set(item.id, item);
  }

  let remoteUpdates = 0;
  let localOnlyOrNewer = false;

  const remoteIds = new Set<string>();
  for (const rItem of remoteList) {
    remoteIds.add(rItem.id);
    const lItem = map.get(rItem.id);
    if (!lItem) {
      map.set(rItem.id, rItem);
      remoteUpdates += 1;
    } else if (rItem.updatedAt > lItem.updatedAt) {
      map.set(rItem.id, rItem);
      remoteUpdates += 1;
    } else if (lItem.updatedAt > rItem.updatedAt) {
      localOnlyOrNewer = true;
    } else if (rItem.deletedAt && !lItem.deletedAt) {
      map.set(rItem.id, rItem);
      remoteUpdates += 1;
    } else if (lItem.deletedAt && !rItem.deletedAt) {
      localOnlyOrNewer = true;
    }
  }

  for (const lItem of localList) {
    if (!remoteIds.has(lItem.id)) {
      localOnlyOrNewer = true;
    }
  }

  return {
    merged: Array.from(map.values()),
    remoteUpdates,
    localOnlyOrNewer,
  };
}

function pruneOldTombstones<T extends SyncEntity>(list: T[], now: number): T[] {
  return list.filter((item) => {
    if (!item.deletedAt) return true;
    return now - item.deletedAt < TOMBSTONE_TTL_MS;
  });
}

async function fetchRemoteSyncFile(config: GitHubSyncConfig): Promise<{
  sha: string | null;
  payload: SyncFilePayload | null;
}> {
  const encodedPath = config.path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(config.branch)}&_=${Date.now()}`;

  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: githubHeaders(config.token),
    cache: 'no-store',
  });

  if (res.status === 404) {
    return { sha: null, payload: null };
  }
  if (!res.ok) {
    throw new Error(explainHttpError(res.status, 'contents'));
  }

  const json = (await res.json()) as {
    sha: string;
    content?: string;
    encoding?: string;
    download_url?: string;
  };

  let rawText = '';
  if (json.content && json.encoding === 'base64') {
    rawText = base64ToUtf8(json.content);
  } else if (json.download_url) {
    const rawRes = await fetchWithTimeout(json.download_url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!rawRes.ok) throw new Error('下载远端同步文件失败');
    rawText = await rawRes.text();
  }

  if (!rawText.trim()) {
    return { sha: json.sha, payload: null };
  }

  const parsed = JSON.parse(rawText) as SyncFilePayload;
  if (!parsed || parsed.app !== 'DayDot') {
    throw new Error('远端文件内容不是有效的 DayDot 同步格式');
  }

  return { sha: json.sha, payload: parsed };
}

async function putRemoteSyncFile(
  config: GitHubSyncConfig,
  payload: SyncFilePayload,
  sha: string | null,
): Promise<Response> {
  const encodedPath = config.path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;

  const content = utf8ToBase64(JSON.stringify(payload, null, 2));
  const body: Record<string, string> = {
    message: `sync: DayDot ${new Date(payload.syncedAt).toISOString()}`,
    content,
    branch: config.branch,
  };
  if (sha) body.sha = sha;

  return fetchWithTimeout(url, {
    method: 'PUT',
    headers: {
      ...githubHeaders(config.token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

let inFlightSync: Promise<SyncResult> | null = null;

/**
 * Bidirectional LWW sync against the user's private GitHub repo.
 * Automatically retries once on HTTP 409 SHA conflict.
 */
export async function syncWithGitHub(config: GitHubSyncConfig): Promise<SyncResult> {
  if (inFlightSync) return inFlightSync;

  const runner = (async (): Promise<SyncResult> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const syncStartedAt = Date.now();
      const { sha, payload: remote } = await fetchRemoteSyncFile(config);
      const [localGroups, localEvents, localRecords] = await Promise.all([
        db.groups.toArray(),
        db.events.toArray(),
        db.records.toArray(),
      ]);

      const now = Date.now();
      const freshUntouchedDevice = !isUserModified() && remote !== null;

      let nextGroups: Group[];
      let nextEvents: EventItem[];
      let nextRecords: EventRecord[];
      let pulledCount = 0;
      let needsPush = false;

      if (freshUntouchedDevice && remote) {
        // Fresh device with untouched demo seeds: adopt remote truth cleanly
        nextGroups = remote.groups ?? [];
        nextEvents = remote.events ?? [];
        nextRecords = remote.records ?? [];
        pulledCount =
          nextGroups.filter((g) => !g.deletedAt).length +
          nextEvents.filter((e) => !e.deletedAt).length +
          nextRecords.filter((r) => !r.deletedAt).length;
        needsPush = false;

        await db.transaction('rw', db.groups, db.events, db.records, async () => {
          await db.groups.clear();
          await db.events.clear();
          await db.records.clear();
          if (nextGroups.length) await db.groups.bulkPut(nextGroups);
          if (nextEvents.length) await db.events.bulkPut(nextEvents);
          if (nextRecords.length) await db.records.bulkPut(nextRecords);
        });
        try {
          localStorage.setItem(USER_MODIFIED_KEY, '1');
        } catch {
          // Ignore
        }
      } else {
        const gRes = mergeCollections(localGroups, remote?.groups ?? []);
        const eRes = mergeCollections(localEvents, remote?.events ?? []);
        const rRes = mergeCollections(localRecords, remote?.records ?? []);

        nextGroups = pruneOldTombstones(gRes.merged, now);
        nextEvents = pruneOldTombstones(eRes.merged, now);
        nextRecords = pruneOldTombstones(rRes.merged, now);
        pulledCount = gRes.remoteUpdates + eRes.remoteUpdates + rRes.remoteUpdates;
        needsPush =
          !remote ||
          gRes.localOnlyOrNewer ||
          eRes.localOnlyOrNewer ||
          rRes.localOnlyOrNewer;

        if (pulledCount > 0) {
          await db.transaction('rw', db.groups, db.events, db.records, async () => {
            if (nextGroups.length) await db.groups.bulkPut(nextGroups);
            if (nextEvents.length) await db.events.bulkPut(nextEvents);
            if (nextRecords.length) await db.records.bulkPut(nextRecords);
          });
        }
      }

      if (needsPush) {
        const outPayload: SyncFilePayload = {
          app: 'DayDot',
          version: 1,
          syncedAt: now,
          deviceId: getDeviceId(),
          groups: nextGroups,
          events: nextEvents,
          records: nextRecords,
        };

        const putRes = await putRemoteSyncFile(config, outPayload, sha);
        if (putRes.status === 409 && attempt === 0) {
          // Another device wrote concurrently; retry merge cleanly
          continue;
        }
        if (!putRes.ok) {
          throw new Error(explainHttpError(putRes.status, 'contents'));
        }
      }

      const latestMeta = loadSyncMeta();
      const hasNewerLocalMutation =
        latestMeta.lastMutationAt !== null && latestMeta.lastMutationAt > syncStartedAt;
      saveSyncMeta({
        lastSyncedAt: now,
        lastError: null,
        pendingChanges: hasNewerLocalMutation,
        lastMutationAt: hasNewerLocalMutation ? latestMeta.lastMutationAt : null,
      });
      const summary =
        pulledCount > 0 && needsPush
          ? `同步完成（拉取 ${pulledCount} 项并已上传）`
          : pulledCount > 0
            ? `已从云端拉取 ${pulledCount} 项更新`
            : needsPush
              ? '已同步最新数据到 GitHub'
              : '已是最新状态';

      return { pulledCount, pushed: needsPush, syncedAt: now, summary };
    }

    throw new Error('同步冲突重试失败，请稍后再试');
  })();

  inFlightSync = runner;
  try {
    return await runner;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '同步失败';
    const prev = loadSyncMeta();
    saveSyncMeta({
      ...prev,
      lastError: msg,
    });
    throw err;
  } finally {
    inFlightSync = null;
  }
}
