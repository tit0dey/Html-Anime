import { PhoneActionPayload } from '../types';

declare global {
  interface Window {
    OpenBrainNativeBridge?: {
      saveBase64ToDownloads: (base64Data: string, fileName: string, mimeType: string) => string;
      showToast: (message: string) => void;
      vibrate: (ms: number) => void;
      shareText: (title: string, text: string) => void;
      speakNative: (text: string, langTag: string) => void;
      getDeviceInfo: () => string;
      getBatteryStatus: () => string;
      setSystemAlarm: (hour: number, minute: number, message: string) => string;
      setSystemTimer: (seconds: number, message: string) => string;
      dialPhoneNumber: (phone: string) => string;
      sendWhatsApp: (phone: string, message: string) => string;
      sendSms: (phone: string, body: string) => string;
      addCalendarEvent: (title: string, description: string, startMs: number, endMs: number) => string;
      openMapsSearch: (query: string) => string;
      openYouTubeSearch: (query: string) => string;
      openSystemSettings: (section: string) => string;
      sendEmail: (to: string, subject: string, body: string) => string;
      copyClipboard: (text: string) => string;
      setSystemBarTheme?: (isDark: boolean) => void;
    };
  }
}

export function isRunningInAndroidApk(): boolean {
  return typeof window !== 'undefined' && Boolean(window.OpenBrainNativeBridge);
}

export function syncNativeSystemBars(isDark: boolean): void {
  try {
    if (window.OpenBrainNativeBridge?.setSystemBarTheme) {
      window.OpenBrainNativeBridge.setSystemBarTheme(isDark);
    }
  } catch {
    // Ignore
  }
}

export function triggerHaptic(ms = 16): void {
  try {
    if (window.OpenBrainNativeBridge) {
      window.OpenBrainNativeBridge.vibrate(ms);
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore on unsupported devices
  }
}

export function showNativeToast(message: string): void {
  try {
    if (window.OpenBrainNativeBridge) {
      window.OpenBrainNativeBridge.showToast(message);
    }
  } catch {
    // Ignore
  }
}

export function speakWithDeviceFallback(text: string, lang = 'en-IN'): boolean {
  try {
    const clean = text.replace(/[#*`_~[\]()]/g, '').slice(0, 1200);
    if (window.OpenBrainNativeBridge) {
      window.OpenBrainNativeBridge.speakNative(clean, lang);
      return true;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = lang;
      window.speechSynthesis.speak(utter);
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

/**
 * Executes real Android Phone Control tasks natively inside the Open Brain APK,
 * with graceful Web Intent / Browser fallbacks when run on mobile/desktop web!
 */
export async function executePhoneAction(payload: PhoneActionPayload): Promise<string> {
  const bridge = window.OpenBrainNativeBridge;
  const p = payload.params || {};

  try {
    switch (payload.action) {
      case 'battery_status': {
        if (bridge) {
          return bridge.getBatteryStatus();
        }
        if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
          const bat: any = await (navigator as any).getBattery();
          return `Battery: ${Math.round(bat.level * 100)}% (${bat.charging ? 'Charging' : 'On Battery'})`;
        }
        return 'Device running in Featherlight Zero-Pressure Cloud-Offload mode (0% background drain).';
      }

      case 'set_alarm': {
        const hour = Number(p.hour ?? 7);
        const minute = Number(p.minute ?? 0);
        const msg = String(p.message || 'Open Brain Alarm');
        if (bridge) {
          return bridge.setSystemAlarm(hour, minute, msg);
        }
        return `Alarm prepared for ${String(hour).padStart(2, '0')}:${String(minute).padStart(
          2,
          '0'
        )} ("${msg}"). Install Open Brain APK on your Android phone for 1-tap system clock setting!`;
      }

      case 'set_timer': {
        const seconds = Number(p.seconds ?? 60);
        const msg = String(p.message || 'Open Brain Timer');
        if (bridge) {
          return bridge.setSystemTimer(seconds, msg);
        }
        return `Timer configured for ${seconds} seconds ("${msg}"). On Open Brain Android APK this launches your native Clock countdown!`;
      }

      case 'dial_number': {
        const phone = String(p.phone || '').trim();
        if (bridge) {
          return bridge.dialPhoneNumber(phone);
        }
        window.open(`tel:${encodeURIComponent(phone)}`, '_blank', 'noopener');
        return `Opened phone dialer for ${phone}.`;
      }

      case 'send_whatsapp': {
        const phone = String(p.phone || '').replace(/[^0-9]/g, '');
        const text = String(p.message || '');
        if (bridge) {
          return bridge.sendWhatsApp(phone, text);
        }
        const waUrl = phone
          ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
          : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank', 'noopener');
        return `Opened WhatsApp with prepared message.`;
      }

      case 'send_sms': {
        const phone = String(p.phone || '');
        const body = String(p.message || '');
        if (bridge) {
          return bridge.sendSms(phone, body);
        }
        window.open(`sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(body)}`, '_self');
        return `Opened SMS composer for ${phone || 'recipient'}.`;
      }

      case 'add_calendar': {
        const title = String(p.title || 'Open Brain Reminder');
        const desc = String(p.description || '');
        const startMs = Number(p.startMs || Date.now() + 3600_000);
        const endMs = Number(p.endMs || startMs + 3600_000);
        if (bridge) {
          return bridge.addCalendarEvent(title, desc, startMs, endMs);
        }
        const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
          title
        )}&details=${encodeURIComponent(desc)}`;
        window.open(gcal, '_blank', 'noopener');
        return `Opened Calendar event "${title}".`;
      }

      case 'open_maps': {
        const query = String(p.query || 'Kolkata');
        if (bridge) {
          return bridge.openMapsSearch(query);
        }
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
          '_blank',
          'noopener'
        );
        return `Opened Maps navigation/search for "${query}".`;
      }

      case 'open_youtube': {
        const query = String(p.query || '');
        if (bridge) {
          return bridge.openYouTubeSearch(query);
        }
        window.open(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          '_blank',
          'noopener'
        );
        return `Opened YouTube for "${query}".`;
      }

      case 'open_settings': {
        const section = String(p.section || 'settings');
        if (bridge) {
          return bridge.openSystemSettings(section);
        }
        return `System Settings ("${section}") action ready — runs natively inside Open Brain Android APK.`;
      }

      case 'send_email': {
        const to = String(p.to || '');
        const subject = String(p.subject || 'From Open Brain');
        const body = String(p.body || '');
        if (bridge) {
          return bridge.sendEmail(to, subject, body);
        }
        window.open(
          `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
            subject
          )}&body=${encodeURIComponent(body)}`,
          '_self'
        );
        return `Opened email composer to ${to || 'recipient'}.`;
      }

      case 'copy_clipboard': {
        const text = String(p.text || '');
        if (bridge) {
          return bridge.copyClipboard(text);
        }
        await navigator.clipboard?.writeText(text);
        return `Copied text (${text.length} chars) to phone clipboard!`;
      }
    }
  } catch (err) {
    return `Action note: ${String(err)}`;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveFileCrossPlatform(
  source: Blob | string,
  fileName: string,
  mimeType: string
): Promise<void> {
  triggerHaptic(22);

  if (window.OpenBrainNativeBridge) {
    let base64 = '';
    if (typeof source !== 'string') {
      base64 = await blobToBase64(source);
    } else if (source.startsWith('data:')) {
      const idx = source.indexOf(',');
      base64 = idx >= 0 ? source.slice(idx + 1) : source;
    } else {
      const resp = await fetch(source);
      const blob = await resp.blob();
      base64 = await blobToBase64(blob);
    }
    window.OpenBrainNativeBridge.saveBase64ToDownloads(base64, fileName, mimeType);
    return;
  }

  let href = '';
  let revokeAfter = false;
  if (typeof source !== 'string') {
    href = URL.createObjectURL(source);
    revokeAfter = true;
  } else if (source.startsWith('blob:') || source.startsWith('data:')) {
    href = source;
  } else {
    try {
      const resp = await fetch(source);
      const blob = await resp.blob();
      href = URL.createObjectURL(blob);
      revokeAfter = true;
    } catch {
      href = source;
    }
  }

  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (revokeAfter) {
    setTimeout(() => URL.revokeObjectURL(href), 12000);
  }
}
