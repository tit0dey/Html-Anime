export interface SmartHttpResponse {
  ok: boolean;
  status: number;
  contentType: string;
  bytes: Uint8Array;
  text: () => string;
  json: <T = any>() => T;
  arrayBuffer: () => ArrayBuffer;
}

export interface SmartFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

interface PendingHttpEntry {
  resolve: (res: SmartHttpResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface PendingTtsEntry {
  resolve: (buf: ArrayBuffer | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingHttpMap = new Map<string, PendingHttpEntry>();
const pendingTtsMap = new Map<string, PendingTtsEntry>();
let listenersInstalled = false;

function base64ToUint8Array(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(0);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function buildResponseFromBytes(
  ok: boolean,
  status: number,
  contentType: string,
  bytes: Uint8Array
): SmartHttpResponse {
  return {
    ok,
    status,
    contentType,
    bytes,
    text: () => new TextDecoder('utf-8').decode(bytes),
    json: <T = any>() => JSON.parse(new TextDecoder('utf-8').decode(bytes)) as T,
    arrayBuffer: () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  };
}

function ensureNativeCallbacksInstalled(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;

  window.__obHttpDone = (reqId, payload) => {
    const entry = pendingHttpMap.get(reqId);
    if (!entry) return;
    pendingHttpMap.delete(reqId);
    clearTimeout(entry.timer);

    if (payload.status === 0 && payload.error) {
      entry.reject(new Error(payload.error));
      return;
    }

    try {
      const bytes = base64ToUint8Array(payload.bodyBase64 || '');
      entry.resolve(
        buildResponseFromBytes(
          Boolean(payload.ok),
          Number(payload.status || 0),
          String(payload.contentType || ''),
          bytes
        )
      );
    } catch (e) {
      entry.reject(e instanceof Error ? e : new Error(String(e)));
    }
  };

  window.__obTtsWavDone = (reqId, payload) => {
    const entry = pendingTtsMap.get(reqId);
    if (!entry) return;
    pendingTtsMap.delete(reqId);
    clearTimeout(entry.timer);

    if (payload.ok && payload.audioBase64) {
      try {
        const bytes = base64ToUint8Array(payload.audioBase64);
        const buf = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;
        entry.resolve(buf.byteLength > 100 ? buf : null);
        return;
      } catch {
        entry.resolve(null);
        return;
      }
    }
    entry.resolve(null);
  };
}

/**
 * Universal CORS-immune HTTP client:
 * - On Android APK: executes directly via Android OS Java HttpURLConnection (0% CORS failures, works on all 4G/Wi-Fi networks).
 * - On Web Preview: tries standard fetch and seamlessly falls back to /api/proxy when third-party CORS blocks browser requests.
 */
export async function smartFetch(
  url: string,
  options: SmartFetchOptions = {}
): Promise<SmartHttpResponse> {
  const method = options.method || 'GET';
  const headers = options.headers || {};
  const body = options.body || '';
  const timeoutMs = options.timeoutMs || 15000;

  if (typeof window !== 'undefined' && window.OpenBrainNativeBridge?.httpRequestAsync) {
    ensureNativeCallbacksInstalled();
    const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise<SmartHttpResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingHttpMap.delete(reqId);
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs + 1500);

      pendingHttpMap.set(reqId, { resolve, reject, timer });

      try {
        window.OpenBrainNativeBridge!.httpRequestAsync!(
          reqId,
          url,
          method,
          JSON.stringify(headers),
          body,
          timeoutMs
        );
      } catch (err) {
        clearTimeout(timer);
        pendingHttpMap.delete(reqId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  // Browser / Web Preview path with /api/proxy CORS fallback
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' && body ? body : undefined,
      signal: ctrl.signal,
    });
    const ab = await resp.arrayBuffer();
    return buildResponseFromBytes(
      resp.ok,
      resp.status,
      resp.headers.get('content-type') || '',
      new Uint8Array(ab)
    );
  } catch (directErr) {
    clearTimeout(timer);
    // Fallback to local Express /api/proxy if running on web server
    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      const pCtrl = new AbortController();
      const pTimer = setTimeout(() => pCtrl.abort(), timeoutMs);
      try {
        const proxyResp = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, method, headers, body, timeoutMs }),
          signal: pCtrl.signal,
        });
        if (proxyResp.ok) {
          const payload = await proxyResp.json();
          if (payload && typeof payload.status === 'number' && payload.status > 0) {
            const bytes = base64ToUint8Array(payload.bodyBase64 || '');
            return buildResponseFromBytes(
              Boolean(payload.ok),
              payload.status,
              String(payload.contentType || ''),
              bytes
            );
          }
        }
      } catch {
        // Ignore proxy fallback failure and rethrow original
      } finally {
        clearTimeout(pTimer);
      }
    }
    throw directErr instanceof Error ? directErr : new Error(String(directErr));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Synthesizes offline/online PCM WAV bytes directly using Android's native Speech Services engine.
 */
export async function synthesizeAndroidNativeWavBuffer(
  text: string,
  langTag = 'en-IN'
): Promise<ArrayBuffer | null> {
  if (typeof window === 'undefined' || !window.OpenBrainNativeBridge?.synthesizeNativeWavAsync) {
    return null;
  }
  ensureNativeCallbacksInstalled();
  const reqId = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return new Promise<ArrayBuffer | null>((resolve) => {
    const timer = setTimeout(() => {
      pendingTtsMap.delete(reqId);
      resolve(null);
    }, 12000);

    pendingTtsMap.set(reqId, { resolve, timer });
    try {
      window.OpenBrainNativeBridge!.synthesizeNativeWavAsync!(reqId, text.slice(0, 1200), langTag);
    } catch {
      clearTimeout(timer);
      pendingTtsMap.delete(reqId);
      resolve(null);
    }
  });
}
