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

const OTA_RETRY_PARAM = '_ota_retry';

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform();
}

export async function initNativeUpdater(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    const current = await CapacitorUpdater.current().catch(() => null);
    const bundle = current?.bundle;
    const url = new URL(window.location.href);
    if (bundle?.version && bundle.version !== 'builtin' && bundle.version !== BUILTIN_APP_VERSION) {
      // A cached document can start successfully while running the wrong bundle.
      // Retry once at a fresh URL and let Capgo handle rollback if it still fails.
      if (url.searchParams.get(OTA_RETRY_PARAM) !== bundle.id) {
        url.searchParams.set(OTA_RETRY_PARAM, bundle.id);
        window.location.replace(url);
      }
      return;
    }

    let urlDirty = false;
    for (const param of [OTA_RETRY_PARAM, '_ota', '_sw_reset']) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        urlDirty = true;
      }
    }
    if (urlDirty) {
      window.history.replaceState(window.history.state, '', url);
    }
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // Non-fatal
  }
}

export async function getActiveAppVersion(): Promise<string> {
  // Always report the version baked into the actually executing JS bundle.
  // Native CapacitorUpdater.current() can temporarily lead ahead of WebView
  // if a hot reload hasn't torn down the old JS context yet.
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
    // Change the current document URL before Capgo navigates to the app URL.
    // set() can destroy this JS context without resolving its promise.
    const previousUrl = window.location.href;
    const restartUrl = new URL(previousUrl);
    restartUrl.hash = '';
    restartUrl.searchParams.set('_ota', bundle.id);
    window.history.replaceState(window.history.state, '', restartUrl);
    try {
      await CapacitorUpdater.set({ id: bundle.id });
      // Fallback: if WebView kept the old JS context alive, force native cache clear + reload
      window.setTimeout(() => {
        const nativeBridge = (
          window as unknown as { DayDotNative?: { hardReload?: () => void } }
        ).DayDotNative;
        if (nativeBridge?.hardReload) {
          nativeBridge.hardReload();
        } else {
          window.location.replace(`/?_ota=${Date.now()}`);
        }
      }, 150);
    } catch (err) {
      if (window.location.href === restartUrl.href) {
        window.history.replaceState(window.history.state, '', previousUrl);
      }
      throw err;
    }
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
