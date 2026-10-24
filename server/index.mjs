import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const APK_FILE = path.join(REPO_ROOT, 'apk/HTML-Anime-Studio.apk');

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
    app: 'HTML-Anime Studio',
    version: '1.0.0',
    apkReady: fs.existsSync(APK_FILE),
    apkSizeBytes: fs.existsSync(APK_FILE) ? fs.statSync(APK_FILE).size : 0,
  });
});

app.all('/api/proxy-binary', async (req, res) => {
  const url = String(req.query.url || req.body?.url || '');
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).send('Invalid URL');
    return;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14; HTMLAnimeStudio/1.0) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
      },
      signal: ctrl.signal,
    });
    if (!upstream.ok) {
      res.status(upstream.status).send('Upstream error');
      return;
    }
    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', ct);
    res.send(buf);
  } catch {
    res.status(502).send('Upstream unreachable');
  } finally {
    clearTimeout(timer);
  }
});

app.get(
  ['/api/download-apk', '/HTML-Anime-Studio.apk', '/apk/HTML-Anime-Studio.apk'],
  (_req, res) => {
    if (!fs.existsSync(APK_FILE)) {
      res.status(404).send('APK file not found. Run npm run build:apk first.');
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="HTML-Anime-Studio.apk"'
    );
    res.sendFile(APK_FILE);
  }
);

app.use(express.static(DIST_DIR));

app.get('*', (_req, res) => {
  const indexHtml = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res
      .status(200)
      .send('HTML-Anime Studio Server running. Build frontend with npm run build.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTML-Anime Studio] Live Server listening on http://0.0.0.0:${PORT}`);
});
