package com.openbrain.ai;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentCallbacks2;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Vibrator;
import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private static final int REQ_FILE_CHOOSER = 2001;
    private static final int REQ_RUNTIME_PERMS = 2002;
    private static final String VIRTUAL_HOST = "openbrain.app";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingWebPermission;
    private TextToSpeech nativeTts;
    private boolean ttsReady = false;
    private final ExecutorService httpPool = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, File> pendingTtsFiles = new ConcurrentHashMap<String, File>();

    private void applySystemBarTheme(boolean isDark) {
        Window window = getWindow();
        if (window != null && Build.VERSION.SDK_INT >= 21) {
            int barColor = Color.parseColor(isDark ? "#0B0E14" : "#FFFFFF");
            window.setStatusBarColor(barColor);
            window.setNavigationBarColor(barColor);
            if (Build.VERSION.SDK_INT >= 23) {
                View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility();
                if (!isDark) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    if (Build.VERSION.SDK_INT >= 26) {
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    }
                } else {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    if (Build.VERSION.SDK_INT >= 26) {
                        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    }
                }
                decor.setSystemUiVisibility(flags);
            }
        }
        if (webView != null) {
            webView.setBackgroundColor(Color.parseColor(isDark ? "#0B0E14" : "#FFFFFF"));
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

        applySystemBarTheme(false);

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
                                        "window.__obTtsWavDone && window.__obTtsWavDone("
                                                + JSONObject.quote(utteranceId) + "," + res.toString() + ")"
                                );
                            } catch (Exception e) {
                                wavFile.delete();
                                try {
                                    JSONObject err = new JSONObject();
                                    err.put("ok", false);
                                    err.put("error", String.valueOf(e.getMessage()));
                                    dispatchJsCallback(
                                            "window.__obTtsWavDone && window.__obTtsWavDone("
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
                                        "window.__obTtsWavDone && window.__obTtsWavDone("
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
        root.setBackgroundColor(Color.parseColor("#FFFFFF"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#FFFFFF"));

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 21) {
            ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.addJavascriptInterface(new OpenBrainBridge(), "OpenBrainNativeBridge");

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

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        List<String> needed = new ArrayList<String>();
                        if (Build.VERSION.SDK_INT >= 23) {
                            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                                needed.add(Manifest.permission.RECORD_AUDIO);
                            }
                            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                for (String r : request.getResources()) {
                                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                                        needed.add(Manifest.permission.CAMERA);
                                    }
                                }
                            }
                        }
                        if (needed.isEmpty()) {
                            request.grant(request.getResources());
                        } else if (Build.VERSION.SDK_INT >= 23) {
                            pendingWebPermission = request;
                            requestPermissions(needed.toArray(new String[0]), REQ_RUNTIME_PERMS);
                        }
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> filePath,
                    FileChooserParams fileChooserParams
            ) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = filePath;
                try {
                    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(Intent.createChooser(intent, "Select File"), REQ_FILE_CHOOSER);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

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

        // Load from true HTTPS virtual origin (never file://!) for full SecureContext, WebCodecs & CORS
        webView.loadUrl("https://" + VIRTUAL_HOST + "/index.html");
    }

    // Zero-Phone-Pressure Power Guard: 0% CPU & 0% Battery Drain when minimized!
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
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_RUNTIME_PERMS && pendingWebPermission != null) {
            boolean allOk = true;
            for (int r : grantResults) {
                if (r != PackageManager.PERMISSION_GRANTED) {
                    allOk = false;
                    break;
                }
            }
            if (allOk) {
                pendingWebPermission.grant(pendingWebPermission.getResources());
            } else {
                pendingWebPermission.deny();
            }
            pendingWebPermission = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                    "(function(){ return window.__openBrainBackHandler ? window.__openBrainBackHandler() : false; })()",
                    new ValueCallback<String>() {
                        @Override
                        public void onReceiveValue(String value) {
                            if (!"true".equals(value)) {
                                if (webView.canGoBack()) {
                                    webView.goBack();
                                } else {
                                    MainActivity.super.onBackPressed();
                                }
                            }
                        }
                    }
            );
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        httpPool.shutdownNow();
        if (nativeTts != null) {
            nativeTts.stop();
            nativeTts.shutdown();
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    public class OpenBrainBridge {

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
                        int to = timeoutMs > 1000 ? Math.min(timeoutMs, 45000) : 16000;
                        conn.setConnectTimeout(Math.min(10000, to));
                        conn.setReadTimeout(to);

                        String m = (method == null || method.trim().isEmpty())
                                ? "GET"
                                : method.trim().toUpperCase(Locale.US);
                        conn.setRequestMethod(m);

                        conn.setRequestProperty(
                                "User-Agent",
                                "Mozilla/5.0 (Linux; Android 14; OpenBrain/4.5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
                        );
                        conn.setRequestProperty("Accept", "*/*");
                        conn.setRequestProperty("Referer", "https://openbrain.app/");

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

                        if (("POST".equals(m) || "PUT".equals(m) || "PATCH".equals(m))
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
                            int maxBytes = 12 * 1024 * 1024; // 12MB RAM guard
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
                                "window.__obHttpDone && window.__obHttpDone("
                                        + JSONObject.quote(reqId) + "," + res.toString() + ")"
                        );
                    } catch (Exception e) {
                        try {
                            JSONObject err = new JSONObject();
                            err.put("ok", false);
                            err.put("status", 0);
                            err.put("error", String.valueOf(e.getMessage()));
                            dispatchJsCallback(
                                    "window.__obHttpDone && window.__obHttpDone("
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
                            "window.__obTtsWavDone && window.__obTtsWavDone("
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
                } else {
                    int r = nativeTts.setLanguage(new Locale("en", "IN"));
                    if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                        nativeTts.setLanguage(Locale.US);
                    }
                }
                String safeId = reqId.replaceAll("[^a-zA-Z0-9_-]", "");
                File outWav = new File(getCacheDir(), "ob_tts_" + safeId + ".wav");
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
                            "window.__obTtsWavDone && window.__obTtsWavDone("
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
                            "window.__obTtsWavDone && window.__obTtsWavDone("
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
        public void shareText(String title, String text) {
            try {
                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.putExtra(Intent.EXTRA_TITLE, title);
                sendIntent.putExtra(Intent.EXTRA_TEXT, text);
                sendIntent.setType("text/plain");
                startActivity(Intent.createChooser(sendIntent, title));
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void speakNative(String text, String langTag) {
            if (!ttsReady || nativeTts == null) return;
            try {
                if (langTag != null && langTag.startsWith("bn")) {
                    nativeTts.setLanguage(new Locale("bn", "IN"));
                } else if (langTag != null && langTag.startsWith("hi")) {
                    nativeTts.setLanguage(new Locale("hi", "IN"));
                } else {
                    nativeTts.setLanguage(new Locale("en", "IN"));
                }
                if (Build.VERSION.SDK_INT >= 21) {
                    nativeTts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "ob-utter");
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public String getDeviceInfo() {
            return Build.MANUFACTURER + " " + Build.MODEL + " (Android " + Build.VERSION.RELEASE + ")";
        }

        @JavascriptInterface
        public String getBatteryStatus() {
            try {
                IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                Intent batteryStatus = registerReceiver(null, ifilter);
                if (batteryStatus == null) return "Battery healthy";
                int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                int tempTenths = batteryStatus.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 300);
                boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                        status == BatteryManager.BATTERY_STATUS_FULL;
                int pct = (level >= 0 && scale > 0) ? Math.round((level * 100f) / scale) : 100;
                float tempC = tempTenths / 10.0f;
                return "Battery: " + pct + "% (" + (isCharging ? "Charging" : "Discharging") + ") • Phone Temp: " + tempC + "°C • Device: " + getDeviceInfo();
            } catch (Exception e) {
                return "Device: " + getDeviceInfo();
            }
        }

        @JavascriptInterface
        public String setSystemAlarm(int hour, int minute, String message) {
            try {
                Intent i = new Intent(AlarmClock.ACTION_SET_ALARM);
                i.putExtra(AlarmClock.EXTRA_HOUR, hour);
                i.putExtra(AlarmClock.EXTRA_MINUTES, minute);
                i.putExtra(AlarmClock.EXTRA_MESSAGE, message != null ? message : "Open Brain Alarm");
                i.putExtra(AlarmClock.EXTRA_SKIP_UI, false);
                startActivity(i);
                return "Alarm set for " + hour + ":" + (minute < 10 ? "0" + minute : minute) + " (" + message + ")";
            } catch (Exception e) {
                return "Could not launch clock alarm: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String setSystemTimer(int seconds, String message) {
            try {
                Intent i = new Intent(AlarmClock.ACTION_SET_TIMER);
                i.putExtra(AlarmClock.EXTRA_LENGTH, Math.max(5, seconds));
                i.putExtra(AlarmClock.EXTRA_MESSAGE, message != null ? message : "Open Brain Timer");
                i.putExtra(AlarmClock.EXTRA_SKIP_UI, false);
                startActivity(i);
                return "Started " + seconds + "s system countdown timer!";
            } catch (Exception e) {
                return "Timer note: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String dialPhoneNumber(String phone) {
            try {
                Intent i = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(phone)));
                startActivity(i);
                return "Opened phone dialer for " + phone;
            } catch (Exception e) {
                return "Dialer error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String sendWhatsApp(String phone, String message) {
            try {
                String cleanPhone = phone != null ? phone.replaceAll("[^0-9]", "") : "";
                String url = cleanPhone.isEmpty()
                        ? ("https://api.whatsapp.com/send?text=" + Uri.encode(message))
                        : ("https://api.whatsapp.com/send?phone=" + cleanPhone + "&text=" + Uri.encode(message));
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(i);
                return "Opened WhatsApp message composer!";
            } catch (Exception e) {
                return "WhatsApp launch error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String sendSms(String phone, String body) {
            try {
                Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(phone != null ? phone : "")));
                i.putExtra("sms_body", body != null ? body : "");
                startActivity(i);
                return "Opened SMS app!";
            } catch (Exception e) {
                return "SMS error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String addCalendarEvent(String title, String description, long startMs, long endMs) {
            try {
                Intent i = new Intent(Intent.ACTION_INSERT)
                        .setData(CalendarContract.Events.CONTENT_URI)
                        .putExtra(CalendarContract.Events.TITLE, title)
                        .putExtra(CalendarContract.Events.DESCRIPTION, description)
                        .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMs)
                        .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endMs);
                startActivity(i);
                return "Opened phone Calendar event creator!";
            } catch (Exception e) {
                return "Calendar error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String openMapsSearch(String query) {
            try {
                Uri gmmIntentUri = Uri.parse("geo:0,0?q=" + Uri.encode(query));
                Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
                startActivity(mapIntent);
                return "Opened Maps navigation for: " + query;
            } catch (Exception e) {
                return "Maps error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String openYouTubeSearch(String query) {
            try {
                Uri uri = Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query));
                Intent i = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(i);
                return "Opened YouTube search for: " + query;
            } catch (Exception e) {
                return "YouTube error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String openSystemSettings(String section) {
            try {
                String action = Settings.ACTION_SETTINGS;
                if (section != null) {
                    String s = section.toLowerCase(Locale.US);
                    if (s.contains("wifi") || s.contains("wi-fi")) action = Settings.ACTION_WIFI_SETTINGS;
                    else if (s.contains("blue")) action = Settings.ACTION_BLUETOOTH_SETTINGS;
                    else if (s.contains("sound") || s.contains("volume")) action = Settings.ACTION_SOUND_SETTINGS;
                    else if (s.contains("display") || s.contains("bright")) action = Settings.ACTION_DISPLAY_SETTINGS;
                    else if (s.contains("battery")) action = Intent.ACTION_POWER_USAGE_SUMMARY;
                }
                startActivity(new Intent(action));
                return "Opened Android " + section + " settings!";
            } catch (Exception e) {
                startActivity(new Intent(Settings.ACTION_SETTINGS));
                return "Opened Android System Settings!";
            }
        }

        @JavascriptInterface
        public String sendEmail(String to, String subject, String body) {
            try {
                Uri uri = Uri.parse("mailto:" + Uri.encode(to != null ? to : "")
                        + "?subject=" + Uri.encode(subject != null ? subject : "")
                        + "&body=" + Uri.encode(body != null ? body : ""));
                startActivity(new Intent(Intent.ACTION_SENDTO, uri));
                return "Opened Email app!";
            } catch (Exception e) {
                return "Email error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public void setSystemBarTheme(final boolean isDark) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    applySystemBarTheme(isDark);
                }
            });
        }

        @JavascriptInterface
        public String copyClipboard(String text) {
            try {
                ClipboardManager cb = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cb != null) {
                    cb.setPrimaryClip(ClipData.newPlainText("Open Brain", text));
                }
                showToast("Copied to Phone Clipboard!");
                return "Copied to Phone Clipboard!";
            } catch (Exception e) {
                return "Clipboard error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String saveBase64ToDownloads(String base64Data, final String fileName, String mimeType) {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                String safeName = (fileName == null || fileName.trim().isEmpty())
                        ? ("OpenBrain_" + System.currentTimeMillis())
                        : fileName.replaceAll("[^a-zA-Z0-9._-]", "_");

                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType != null ? mimeType : "application/octet-stream");
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/OpenBrain");
                    ContentResolver resolver = getContentResolver();
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        OutputStream os = resolver.openOutputStream(uri);
                        if (os != null) {
                            os.write(bytes);
                            os.flush();
                            os.close();
                        }
                    }
                } else {
                    File dir = new File(
                            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                            "OpenBrain"
                    );
                    if (!dir.exists()) {
                        dir.mkdirs();
                    }
                    File outFile = new File(dir, safeName);
                    FileOutputStream fos = new FileOutputStream(outFile);
                    fos.write(bytes);
                    fos.flush();
                    fos.close();
                }

                showToast("Saved to Downloads/OpenBrain/" + safeName);
                return "OK";
            } catch (final Exception e) {
                showToast("Save error: " + e.getMessage());
                return "ERROR: " + e.getMessage();
            }
        }
    }
}
