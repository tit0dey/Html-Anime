declare global {
  interface Window {
    HtmlAnimeNativeBridge?: {
      httpRequestAsync?: (
        reqId: string,
        urlStr: string,
        method: string,
        headersJson: string,
        bodyStr: string,
        timeoutMs: number
      ) => void;
      synthesizeNativeWavAsync?: (reqId: string, text: string, langTag: string) => void;
      beginDownloadFile?: (fileName: string, mimeType: string) => string;
      appendDownloadChunk?: (transferId: string, base64Chunk: string) => string;
      finishDownloadFile?: (transferId: string) => string;
      saveBase64ToDownloads: (base64Data: string, fileName: string, mimeType: string) => string;
      showToast: (message: string) => void;
      vibrate: (ms: number) => void;
    };
    __haHttpDone?: (
      reqId: string,
      payload: {
        ok: boolean;
        status: number;
        contentType?: string;
        bodyBase64?: string;
        error?: string;
      }
    ) => void;
    __haTtsWavDone?: (
      reqId: string,
      payload: {
        ok: boolean;
        audioBase64?: string;
        error?: string;
      }
    ) => void;
  }
}

interface PendingHttp {
  resolve: (bytes: Uint8Array | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingHttpMap = new Map<string, PendingHttp>();
const pendingTtsMap = new Map<string, PendingHttp>();
let callbacksReady = false;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(parts.join(''));
}

function initCallbacks(): void {
  if (callbacksReady || typeof window === 'undefined') return;
  callbacksReady = true;

  window.__haHttpDone = (reqId, payload) => {
    const p = pendingHttpMap.get(reqId);
    if (!p) return;
    pendingHttpMap.delete(reqId);
    clearTimeout(p.timer);
    if (payload.ok && payload.bodyBase64) {
      try {
        p.resolve(b64ToBytes(payload.bodyBase64));
        return;
      } catch {
        // Ignore
      }
    }
    p.resolve(null);
  };

  window.__haTtsWavDone = (reqId, payload) => {
    const p = pendingTtsMap.get(reqId);
    if (!p) return;
    pendingTtsMap.delete(reqId);
    clearTimeout(p.timer);
    if (payload.ok && payload.audioBase64) {
      try {
        p.resolve(b64ToBytes(payload.audioBase64));
        return;
      } catch {
        // Ignore
      }
    }
    p.resolve(null);
  };
}

export function isAndroidApk(): boolean {
  return typeof window !== 'undefined' && Boolean(window.HtmlAnimeNativeBridge);
}

export function showToast(msg: string): void {
  try {
    if (window.HtmlAnimeNativeBridge) {
      window.HtmlAnimeNativeBridge.showToast(msg);
    }
  } catch {
    // Ignore
  }
}

export function hapticTap(ms = 18): void {
  try {
    if (window.HtmlAnimeNativeBridge) {
      window.HtmlAnimeNativeBridge.vibrate(ms);
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore
  }
}

export async function fetchBinaryBridge(
  url: string,
  timeoutMs = 9000
): Promise<ArrayBuffer | null> {
  if (typeof window !== 'undefined' && window.HtmlAnimeNativeBridge?.httpRequestAsync) {
    initCallbacks();
    const id = `ha_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingHttpMap.delete(id);
        resolve(null);
      }, timeoutMs + 1000);
      pendingHttpMap.set(id, {
        timer,
        resolve: (bytes) =>
          resolve(
            bytes
              ? (bytes.buffer.slice(
                  bytes.byteOffset,
                  bytes.byteOffset + bytes.byteLength
                ) as ArrayBuffer)
              : null
          ),
      });
      window.HtmlAnimeNativeBridge!.httpRequestAsync!(id, url, 'GET', '{}', '', timeoutMs);
    });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (r.ok) return await r.arrayBuffer();
  } catch {
    try {
      const pr = await fetch('/api/proxy-binary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (pr.ok) return await pr.arrayBuffer();
    } catch {
      // Ignore
    }
  } finally {
    clearTimeout(timer);
  }
  return null;
}

export async function synthesizeNativeSpeechWav(
  text: string,
  langTag: string
): Promise<ArrayBuffer | null> {
  if (typeof window === 'undefined' || !window.HtmlAnimeNativeBridge?.synthesizeNativeWavAsync) {
    return null;
  }
  initCallbacks();
  const id = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingTtsMap.delete(id);
      resolve(null);
    }, 10000);
    pendingTtsMap.set(id, {
      timer,
      resolve: (bytes) =>
        resolve(
          bytes
            ? (bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength
              ) as ArrayBuffer)
            : null
        ),
    });
    window.HtmlAnimeNativeBridge!.synthesizeNativeWavAsync!(id, text.slice(0, 900), langTag);
  });
}

export async function downloadBlobCrossPlatform(
  blobOrUrl: Blob | string,
  fileName: string,
  mimeType: string
): Promise<void> {
  hapticTap(24);
  const blob =
    typeof blobOrUrl === 'string' ? await (await fetch(blobOrUrl)).blob() : blobOrUrl;

  const bridge = typeof window !== 'undefined' ? window.HtmlAnimeNativeBridge : undefined;
  if (bridge) {
    // Zero-OOM streaming 512KB chunked writer for Android APK (handles arbitrarily large MP4s!)
    if (
      bridge.beginDownloadFile &&
      bridge.appendDownloadChunk &&
      bridge.finishDownloadFile
    ) {
      const transferId = bridge.beginDownloadFile(fileName, mimeType);
      if (transferId && !transferId.startsWith('ERROR:')) {
        const sliceSize = 512 * 1024;
        for (let offset = 0; offset < blob.size; offset += sliceSize) {
          const slice = blob.slice(offset, Math.min(blob.size, offset + sliceSize));
          const buf = new Uint8Array(await slice.arrayBuffer());
          const res = bridge.appendDownloadChunk(transferId, bytesToB64(buf));
          if (res && res.startsWith('ERROR:')) {
            throw new Error(res);
          }
        }
        bridge.finishDownloadFile(transferId);
        return;
      }
    }

    // Fallback single-shot Base64 save
    const fullBytes = new Uint8Array(await blob.arrayBuffer());
    bridge.saveBase64ToDownloads(bytesToB64(fullBytes), fileName, mimeType);
    return;
  }

  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 15000);
}
