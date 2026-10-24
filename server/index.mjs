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
    version: '1.0.1',
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
          'Mozilla/5.0 (Linux; Android 14; HTMLAnimeStudio/1.0.1) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
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

// Direct binary APK download endpoints (zero login, instant Android Chrome / Google download)
app.get(
  [
    '/apk',
    '/dl',
    '/api/download-apk',
    '/HTML-Anime-Studio.apk',
    '/apk/HTML-Anime-Studio.apk',
  ],
  (_req, res) => {
    if (!fs.existsSync(APK_FILE)) {
      res.status(404).send('APK file not found. Run npm run build:apk first.');
      return;
    }
    const stat = fs.statSync(APK_FILE);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="HTML-Anime-Studio.apk"'
    );
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(APK_FILE);
  }
);

// Smart auto-download HTML landing page for Google Search In-App Browser
app.get('/download', (_req, res) => {
  const sizeKb = fs.existsSync(APK_FILE)
    ? Math.round(fs.statSync(APK_FILE).size / 1024)
    : 222;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=/HTML-Anime-Studio.apk" />
  <title>Download HTML-Anime Studio APK</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#060913; color:#f1f5f9; font-family:system-ui,-apple-system,sans-serif; padding:24px; }
    .card { max-width:400px; width:100%; background:#0f172a; border:1px solid #312e81; border-radius:20px; padding:28px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,.6); }
    .logo { width:64px; height:64px; background:#fff; border-radius:16px; padding:8px; margin:0 auto 16px; display:block; }
    h1 { font-size:20px; margin:0 0 8px; }
    p { font-size:13px; color:#94a3b8; margin:0 0 22px; line-height:1.5; }
    .btn { display:inline-block; width:100%; box-sizing:border-box; padding:14px 20px; border-radius:12px; background:linear-gradient(90deg,#4f46e5,#7c3aed); color:#fff; font-weight:700; font-size:14px; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <img src="/logo.png" alt="HTML-Anime Studio" class="logo" />
    <h1>HTML-Anime Studio v1.0.1</h1>
    <p>Starting automatic Android APK download (${sizeKb} KB · Signed V2+V3 · Zero API Keys)...</p>
    <a class="btn" href="/HTML-Anime-Studio.apk" download="HTML-Anime-Studio.apk">Download HTML-Anime-Studio.apk</a>
  </div>
  <script>setTimeout(function(){ window.location.href = '/HTML-Anime-Studio.apk'; }, 250);</script>
</body>
</html>`);
});

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
