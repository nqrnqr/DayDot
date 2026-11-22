import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export interface OtaManifest {
  version: string;
  commit?: string;
  url: string;
  checksum?: string;
  updatedAt?: string;
}

export interface OtaCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  remote: OtaManifest;
}

export const BUILTIN_APP_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string | undefined) || '1.0.0';

export const OTA_MANIFEST_URL: string =
  (import.meta.env.VITE_OTA_MANIFEST_URL as string | undefined) || '';

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform();
}

/** Notify native updater that the current bundle booted cleanly (prevents auto-rollback) */
export async function initNativeUpdater(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // Non-fatal
  }
}

export async function getActiveAppVersion(): Promise<string> {
  if (!isNativeAndroid()) return BUILTIN_APP_VERSION;
  try {
    const info = await CapacitorUpdater.current();
    if (info?.bundle?.version && info.bundle.version !== 'builtin') {
      return info.bundle.version;
    }
  } catch {
    // Fallback to built-in version
  }
  return BUILTIN_APP_VERSION;
}

export async function checkForOtaUpdate(): Promise<OtaCheckResult> {
  if (!OTA_MANIFEST_URL) {
    throw new Error('未配置热更新清单地址');
  }
  const currentVersion = await getActiveAppVersion();

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  let res: Response;
  try {
    res = await fetch(`${OTA_MANIFEST_URL}?_=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('检查更新超时，请稍后重试');
    }
    throw new Error('无法连接更新源，请检查网络');
  } finally {
    window.clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`检查更新失败 (HTTP ${res.status})`);
  }

  const remote = (await res.json()) as OtaManifest;
  if (!remote?.version || !remote?.url) {
    throw new Error('更新清单格式无效');
  }

  return {
    hasUpdate: remote.version !== currentVersion,
    currentVersion,
    remote,
  };
}

export async function downloadAndApplyOta(
  manifest: OtaManifest,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (!isNativeAndroid()) {
    throw new Error('仅 Android 客户端支持应用内热更新');
  }
  if (!manifest.checksum) {
    throw new Error('远端更新包缺少 SHA-256 校验值，请稍后重试');
  }

  let nativeFailReason = '';
  const capturedLogs: string[] = [];
  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    try {
      const text = args.map((a) => String(a)).join(' ');
      if (text.includes('[CapgoUpdater]')) {
        capturedLogs.push(text.replace(/^\[CapgoUpdater\]\s*🔴?\s*/u, '').trim());
      }
    } catch {
      // Ignore capture errors
    }
    origConsoleError.apply(console, args);
  };

  const progressHandle = await CapacitorUpdater.addListener(
    'download',
    (info) => {
      if (typeof info?.percent === 'number') {
        onProgress?.(Math.max(0, Math.min(100, Math.round(info.percent))));
      }
    },
  );
  const failedHandle = await CapacitorUpdater.addListener(
    'downloadFailed',
    (info) => {
      const raw = (info as unknown as { error?: string })?.error;
      if (raw && !nativeFailReason) {
        nativeFailReason = raw;
      }
    },
  );

  try {
    const bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
      checksum: manifest.checksum,
    });
    onProgress?.(100);
    await CapacitorUpdater.set(bundle);
  } catch (err) {
    const baseMsg = err instanceof Error ? err.message : String(err);
    const detail =
      nativeFailReason ||
      capturedLogs.find(
        (line) => !line.startsWith('Failed to download from:'),
      ) ||
      capturedLogs[0] ||
      '';
    if (detail && !baseMsg.includes(detail)) {
      throw new Error(`更新下载失败：${detail}`);
    }
    throw new Error(baseMsg || '更新下载失败');
  } finally {
    console.error = origConsoleError;
    await progressHandle.remove().catch(() => {});
    await failedHandle.remove().catch(() => {});
  }
}
