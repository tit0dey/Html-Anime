package com.htmlanime.studio;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ComponentCallbacks2;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class MainActivity extends Activity {

    private static final String VIRTUAL_HOST = "htmlanime.app";

    private static class PendingDownload {
        final String safeName;
        final OutputStream out;
        final Uri mediaUri;
        final File legacyFile;

        PendingDownload(String safeName, OutputStream out, Uri mediaUri, File legacyFile) {
            this.safeName = safeName;
            this.out = out;
            this.mediaUri = mediaUri;
            this.legacyFile = legacyFile;
        }
    }

    private WebView webView;
    private TextToSpeech nativeTts;
    private boolean ttsReady = false;
    private final ExecutorService httpPool = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, File> pendingTtsFiles = new ConcurrentHashMap<String, File>();
    private final ConcurrentHashMap<String, PendingDownload> activeDownloads = new ConcurrentHashMap<String, PendingDownload>();
    private final AtomicInteger downloadSeq = new AtomicInteger(1);

    private void applyDarkCinemaBars() {
        Window window = getWindow();
        if (window != null && Build.VERSION.SDK_INT >= 21) {
            int barColor = Color.parseColor("#060913");
            window.setStatusBarColor(barColor);
            window.setNavigationBarColor(barColor);
            if (Build.VERSION.SDK_INT >= 23) {
                View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility();
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= 26) {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                decor.setSystemUiVisibility(flags);
            }
        }
    }

    private String guessMimeType(String path) {
        String p = path.toLowerCase(Locale.US);
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".wav")) return "audio/wav";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".mp4")) return "video/mp4";
        return "application/octet-stream";
    }

    private byte[] readFileBytes(File file) throws Exception {
        FileInputStream fis = new FileInputStream(file);
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = fis.read(buf)) != -1) {
                bos.write(buf, 0, n);
            }
            return bos.toByteArray();
        } finally {
            fis.close();
        }
    }

    private void dispatchJsCallback(final String jsCode) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    try {
                        webView.evaluateJavascript(jsCode, null);
                    } catch (Exception ignored) {
                    }
                }
            }
        });
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        applyDarkCinemaBars();

        nativeTts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS) {
                    ttsReady = true;
                    nativeTts.setLanguage(Locale.US);
                    nativeTts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                        }

                        @Override
                        public void onDone(String utteranceId) {
                            File wavFile = pendingTtsFiles.remove(utteranceId);
                            if (wavFile == null) return;
                            try {
                                byte[] bytes = readFileBytes(wavFile);
                                wavFile.delete();
                                JSONObject res = new JSONObject();
                                res.put("ok", true);
                                res.put("audioBase64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                                dispatchJsCallback(
                                        "window.__haTtsWavDone && window.__haTtsWavDone("
                                                + JSONObject.quote(utteranceId) + "," + res.toString() + ")"
                                );
                            } catch (Exception e) {
                                wavFile.delete();
                                try {
                                    JSONObject err = new JSONObject();
                                    err.put("ok", false);
                                    err.put("error", String.valueOf(e.getMessage()));
                                    dispatchJsCallback(
                                            "window.__haTtsWavDone && window.__haTtsWavDone("
                                                    + JSONObject.quote(utteranceId) + "," + err.toString() + ")"
                                    );
                                } catch (Exception ignored) {
                                }
                            }
                        }

                        @Override
                        public void onError(String utteranceId) {
                            File wavFile = pendingTtsFiles.remove(utteranceId);
                            if (wavFile != null) wavFile.delete();
                            try {
                                JSONObject err = new JSONObject();
                                err.put("ok", false);
                                err.put("error", "Native TTS utterance error");
                                dispatchJsCallback(
                                        "window.__haTtsWavDone && window.__haTtsWavDone("
                                                + JSONObject.quote(utteranceId) + "," + err.toString() + ")"
                                );
                            } catch (Exception ignored) {
                            }
                        }
                    });
                }
            }
        });

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#060913"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#060913"));

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 21) {
            ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.addJavascriptInterface(new HtmlAnimeBridge(), "HtmlAnimeNativeBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && VIRTUAL_HOST.equalsIgnoreCase(uri.getHost())) {
                    try {
                        String rawPath = uri.getPath();
                        if (rawPath == null || rawPath.isEmpty() || "/".equals(rawPath)) {
                            rawPath = "/index.html";
                        }
                        String assetPath = "public" + rawPath;
                        InputStream is = getAssets().open(assetPath);
                        String mime = guessMimeType(assetPath);
                        Map<String, String> headers = new HashMap<String, String>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        headers.put("Cache-Control", "no-cache");
                        return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, is);
                    } catch (Exception ignored) {
                        try {
                            InputStream fallback = getAssets().open("public/index.html");
                            Map<String, String> headers = new HashMap<String, String>();
                            headers.put("Access-Control-Allow-Origin", "*");
                            return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, fallback);
                        } catch (Exception ignored2) {
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if (VIRTUAL_HOST.equalsIgnoreCase(host)
                        || "file".equals(scheme)
                        || "data".equals(scheme)
                        || "blob".equals(scheme)
                        || "about".equals(scheme)) {
                    return false;
                }
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(browserIntent);
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                try {
                    if (url != null && url.startsWith("http")) {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(i);
                    }
                } catch (Exception ignored) {
                }
            }
        });

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        webView.loadUrl("https://" + VIRTUAL_HOST + "/index.html");
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (webView != null && level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) {
            webView.clearCache(false);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        httpPool.shutdownNow();
        for (PendingDownload pd : activeDownloads.values()) {
            try {
                pd.out.close();
            } catch (Exception ignored) {
            }
        }
        activeDownloads.clear();
        if (nativeTts != null) {
            nativeTts.stop();
            nativeTts.shutdown();
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    public class HtmlAnimeBridge {

        @JavascriptInterface
        public void httpRequestAsync(
                final String reqId,
                final String urlStr,
                final String method,
                final String headersJson,
                final String bodyStr,
                final int timeoutMs
        ) {
            httpPool.execute(new Runnable() {
                @Override
                public void run() {
                    HttpURLConnection conn = null;
                    try {
                        URL url = new URL(urlStr);
                        conn = (HttpURLConnection) url.openConnection();
                        conn.setInstanceFollowRedirects(true);
                        int to = timeoutMs > 1000 ? Math.min(timeoutMs, 30000) : 10000;
                        conn.setConnectTimeout(Math.min(8000, to));
                        conn.setReadTimeout(to);

                        String m = (method == null || method.trim().isEmpty())
                                ? "GET"
                                : method.trim().toUpperCase(Locale.US);
                        conn.setRequestMethod(m);

                        conn.setRequestProperty(
                                "User-Agent",
                                "Mozilla/5.0 (Linux; Android 14; HTMLAnimeStudio/1.0) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36"
                        );
                        conn.setRequestProperty("Accept", "*/*");

                        if (headersJson != null && !headersJson.trim().isEmpty()) {
                            JSONObject hdrs = new JSONObject(headersJson);
                            Iterator<String> keys = hdrs.keys();
                            while (keys.hasNext()) {
                                String k = keys.next();
                                String v = hdrs.optString(k, "");
                                if (!v.isEmpty()) {
                                    conn.setRequestProperty(k, v);
                                }
                            }
                        }

                        if (("POST".equals(m) || "PUT".equals(m))
                                && bodyStr != null && !bodyStr.isEmpty()) {
                            conn.setDoOutput(true);
                            byte[] outBytes = bodyStr.getBytes("UTF-8");
                            OutputStream os = conn.getOutputStream();
                            os.write(outBytes);
                            os.flush();
                            os.close();
                        }

                        int status = conn.getResponseCode();
                        String contentType = conn.getContentType();
                        InputStream is = (status >= 200 && status < 400)
                                ? conn.getInputStream()
                                : conn.getErrorStream();

                        ByteArrayOutputStream bos = new ByteArrayOutputStream();
                        if (is != null) {
                            byte[] buf = new byte[8192];
                            int n;
                            int total = 0;
                            int maxBytes = 12 * 1024 * 1024;
                            while ((n = is.read(buf)) != -1) {
                                if (total + n > maxBytes) break;
                                bos.write(buf, 0, n);
                                total += n;
                            }
                            is.close();
                        }

                        byte[] rawBytes = bos.toByteArray();
                        JSONObject res = new JSONObject();
                        res.put("ok", status >= 200 && status < 300);
                        res.put("status", status);
                        res.put("contentType", contentType != null ? contentType : "");
                        res.put("bodyBase64", Base64.encodeToString(rawBytes, Base64.NO_WRAP));

                        dispatchJsCallback(
                                "window.__haHttpDone && window.__haHttpDone("
                                        + JSONObject.quote(reqId) + "," + res.toString() + ")"
                        );
                    } catch (Exception e) {
                        try {
                            JSONObject err = new JSONObject();
                            err.put("ok", false);
                            err.put("status", 0);
                            err.put("error", String.valueOf(e.getMessage()));
                            dispatchJsCallback(
                                    "window.__haHttpDone && window.__haHttpDone("
                                            + JSONObject.quote(reqId) + "," + err.toString() + ")"
                            );
                        } catch (Exception ignored) {
                        }
                    } finally {
                        if (conn != null) {
                            conn.disconnect();
                        }
                    }
                }
            });
        }

        @JavascriptInterface
        public void synthesizeNativeWavAsync(final String reqId, final String text, final String langTag) {
            if (!ttsReady || nativeTts == null || Build.VERSION.SDK_INT < 21) {
                try {
                    JSONObject err = new JSONObject();
                    err.put("ok", false);
                    err.put("error", "Native Android TTS engine initializing");
                    dispatchJsCallback(
                            "window.__haTtsWavDone && window.__haTtsWavDone("
                                    + JSONObject.quote(reqId) + "," + err.toString() + ")"
                    );
                } catch (Exception ignored) {
                }
                return;
            }
            try {
                if (langTag != null && langTag.startsWith("bn")) {
                    nativeTts.setLanguage(new Locale("bn", "IN"));
                } else if (langTag != null && langTag.startsWith("hi")) {
                    nativeTts.setLanguage(new Locale("hi", "IN"));
                } else if (langTag != null && langTag.startsWith("ja")) {
                    nativeTts.setLanguage(Locale.JAPANESE);
                } else {
                    int r = nativeTts.setLanguage(new Locale("en", "IN"));
                    if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                        nativeTts.setLanguage(Locale.US);
                    }
                }
                String safeId = reqId.replaceAll("[^a-zA-Z0-9_-]", "");
                File outWav = new File(getCacheDir(), "ha_tts_" + safeId + ".wav");
                pendingTtsFiles.put(reqId, outWav);
                Bundle params = new Bundle();
                int res = nativeTts.synthesizeToFile(text, params, outWav, reqId);
                if (res != TextToSpeech.SUCCESS) {
                    pendingTtsFiles.remove(reqId);
                    outWav.delete();
                    JSONObject err = new JSONObject();
                    err.put("ok", false);
                    err.put("error", "Native synthesizeToFile returned " + res);
                    dispatchJsCallback(
                            "window.__haTtsWavDone && window.__haTtsWavDone("
                                    + JSONObject.quote(reqId) + "," + err.toString() + ")"
                    );
                }
            } catch (Exception e) {
                pendingTtsFiles.remove(reqId);
                try {
                    JSONObject err = new JSONObject();
                    err.put("ok", false);
                    err.put("error", String.valueOf(e.getMessage()));
                    dispatchJsCallback(
                            "window.__haTtsWavDone && window.__haTtsWavDone("
                                    + JSONObject.quote(reqId) + "," + err.toString() + ")"
                    );
                } catch (Exception ignored) {
                }
            }
        }

        @JavascriptInterface
        public void showToast(final String message) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    v.vibrate(Math.max(10, Math.min(200, ms)));
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public String getDeviceInfo() {
            return Build.MANUFACTURER + " " + Build.MODEL + " (Android " + Build.VERSION.RELEASE + ")";
        }

        @JavascriptInterface
        public String beginDownloadFile(String fileName, String mimeType) {
            try {
                String safeName = (fileName == null || fileName.trim().isEmpty())
                        ? ("HTML_Anime_" + System.currentTimeMillis() + ".mp4")
                        : fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
                String safeMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "video/mp4";
                String transferId = "dl_" + downloadSeq.getAndIncrement();

                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, safeMime);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/HTMLAnimeStudio");
                    values.put(MediaStore.Downloads.IS_PENDING, 1);
                    ContentResolver resolver = getContentResolver();
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) {
                        return "ERROR: MediaStore insert returned null";
                    }
                    OutputStream os = resolver.openOutputStream(uri);
                    if (os == null) {
                        return "ERROR: Could not open MediaStore stream";
                    }
                    activeDownloads.put(transferId, new PendingDownload(safeName, os, uri, null));
                } else {
                    File dir = new File(
                            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                            "HTMLAnimeStudio"
                    );
                    if (!dir.exists()) {
                        dir.mkdirs();
                    }
                    File outFile = new File(dir, safeName);
                    FileOutputStream fos = new FileOutputStream(outFile);
                    activeDownloads.put(transferId, new PendingDownload(safeName, fos, null, outFile));
                }
                return transferId;
            } catch (Exception e) {
                return "ERROR: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String appendDownloadChunk(String transferId, String base64Chunk) {
            PendingDownload pd = activeDownloads.get(transferId);
            if (pd == null) return "ERROR: Unknown transferId";
            try {
                byte[] chunk = Base64.decode(base64Chunk, Base64.DEFAULT);
                pd.out.write(chunk);
                return "OK";
            } catch (Exception e) {
                activeDownloads.remove(transferId);
                try {
                    pd.out.close();
                } catch (Exception ignored) {
                }
                return "ERROR: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String finishDownloadFile(String transferId) {
            PendingDownload pd = activeDownloads.remove(transferId);
            if (pd == null) return "ERROR: Unknown transferId";
            try {
                pd.out.flush();
                pd.out.close();
                if (Build.VERSION.SDK_INT >= 29 && pd.mediaUri != null) {
                    ContentValues done = new ContentValues();
                    done.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(pd.mediaUri, done, null, null);
                } else if (pd.legacyFile != null) {
                    MediaScannerConnection.scanFile(
                            MainActivity.this,
                            new String[]{pd.legacyFile.getAbsolutePath()},
                            null,
                            null
                    );
                }
                showToast("Saved to Downloads/HTMLAnimeStudio/" + pd.safeName);
                return "OK";
            } catch (Exception e) {
                showToast("Save error: " + e.getMessage());
                return "ERROR: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String saveBase64ToDownloads(String base64Data, final String fileName, String mimeType) {
            String tid = beginDownloadFile(fileName, mimeType);
            if (tid.startsWith("ERROR:")) {
                showToast("Save error: " + tid);
                return tid;
            }
            String step = appendDownloadChunk(tid, base64Data);
            if (step.startsWith("ERROR:")) {
                showToast("Save error: " + step);
                return step;
            }
            return finishDownloadFile(tid);
        }
    }
}
