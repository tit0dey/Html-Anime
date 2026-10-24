export interface FluxImageOptions {
  prompt: string;
  model?: 'flux' | 'flux-realism' | 'flux-anime' | 'flux-3d' | 'turbo';
  width?: number;
  height?: number;
  seed?: number;
}

export function getDimensionsForRatio(ratio: '1:1' | '9:16' | '16:9'): {
  width: number;
  height: number;
} {
  if (ratio === '9:16') return { width: 768, height: 1344 };
  if (ratio === '16:9') return { width: 1344, height: 768 };
  return { width: 1024, height: 1024 };
}

export function buildFluxImageUrl(opts: FluxImageOptions): string {
  const seed = opts.seed ?? Math.floor(Math.random() * 9999999);
  const width = opts.width ?? 1024;
  const height = opts.height ?? 1024;
  const model = opts.model ?? 'flux';
  const encoded = encodeURIComponent(opts.prompt.trim());
  return `https://image.pollinations.ai/prompt/${encoded}?model=${model}&width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;
}

export async function preloadImageAsObjectUrl(url: string, timeoutMs = 35000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`Image HTTP ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } finally {
    clearTimeout(timer);
  }
}
