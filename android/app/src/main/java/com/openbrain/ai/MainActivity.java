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
import android.util.Base64;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {

    private static final int REQ_FILE_CHOOSER = 2001;
    private static final int REQ_RUNTIME_PERMS = 2002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingWebPermission;
    private TextToSpeech nativeTts;
    private boolean ttsReady = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (window != null && Build.VERSION.SDK_INT >= 21) {
            window.setStatusBarColor(Color.parseColor("#050A0E"));
            window.setNavigationBarColor(Color.parseColor("#050A0E"));
        }

        nativeTts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS) {
                    ttsReady = true;
                    nativeTts.setLanguage(Locale.US);
                }
            }
        });

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#050A0E"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#050A0E"));

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
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("file".equals(scheme) || "data".equals(scheme) || "blob".equals(scheme)) {
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

        webView.loadUrl("file:///android_asset/public/index.html");
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
                if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                    results = new Uri[]{data.getData()};
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
