import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export interface OtaManifest {
  version: string;
  commit?: string;
  url: string;
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

export async function downloadAndApplyOta(manifest: OtaManifest): Promise<void> {
  if (!isNativeAndroid()) {
    throw new Error('仅 Android 客户端支持应用内热更新');
  }
  const bundle = await CapacitorUpdater.download({
    url: manifest.url,
    version: manifest.version,
  });
  await CapacitorUpdater.set(bundle);
}
