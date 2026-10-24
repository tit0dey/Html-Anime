import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const APK_FILE = path.join(REPO_ROOT, 'apk/OpenBrain-AI.apk');

const app = express();
const PORT = Number(process.env.PORT || 5173);

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'Open Brain',
    version: '4.5.0',
    apkReady: fs.existsSync(APK_FILE),
    apkSizeBytes: fs.existsSync(APK_FILE) ? fs.statSync(APK_FILE).size : 0,
  });
});

app.post('/api/proxy', async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, body, timeoutMs = 18000 } = req.body || {};
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ ok: false, status: 400, error: 'Invalid URL' });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(45000, Number(timeoutMs) || 18000));
    try {
      const upstream = await fetch(url, {
        method,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 14; OpenBrain/4.5) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
          Referer: 'https://openbrain.app/',
          ...headers,
        },
        body:
          method !== 'GET' && method !== 'HEAD' && body !== undefined
            ? typeof body === 'string'
              ? body
              : JSON.stringify(body)
            : undefined,
        signal: ctrl.signal,
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.json({
        ok: upstream.ok,
        status: upstream.status,
        contentType: upstream.headers.get('content-type') || '',
        bodyBase64: buf.toString('base64'),
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    res.json({
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get(['/OpenBrain-AI.apk', '/apk/OpenBrain-AI.apk'], (_req, res) => {
  if (!fs.existsSync(APK_FILE)) {
    res.status(404).send('APK file not found. Run npm run build:apk first.');
    return;
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="OpenBrain-AI.apk"');
  res.sendFile(APK_FILE);
});

app.use(express.static(DIST_DIR));

app.get('*', (_req, res) => {
  const indexHtml = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(200).send('Open Brain Server running. Build frontend with npm run build.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Open Brain] Live Server listening on http://0.0.0.0:${PORT}`);
});
