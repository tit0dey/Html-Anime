import React, { useState } from 'react';
import {
  AlarmClock,
  BatteryCharging,
  CheckCircle2,
  Download,
  MapPin,
  MessageSquare,
  Settings,
  Smartphone,
  Timer,
  X,
} from 'lucide-react';
import { executePhoneAction, isRunningInAndroidApk } from '../services/nativeBridge';

interface Props {
  open: boolean;
  onClose: () => void;
  onSendChatPrompt: (prompt: string) => void;
}

export const PhoneControlModal: React.FC<Props> = ({
  open,
  onClose,
  onSendChatPrompt,
}) => {
  const [statusOutput, setStatusOutput] = useState<string>('');
  const inApk = isRunningInAndroidApk();

  if (!open) return null;

  const runDirect = async (
    action:
      | 'battery_status'
      | 'set_alarm'
      | 'set_timer'
      | 'open_settings'
      | 'open_maps'
      | 'send_whatsapp',
    label: string,
    params: Record<string, string | number>
  ) => {
    const out = await executePhoneAction({ action, label, params });
    setStatusOutput(out);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#141821] rounded-t-[28px] sm:rounded-3xl p-5 pb-[calc(1.4rem+env(safe-area-inset-bottom,0px))] shadow-2xl animate-sheet-up space-y-4 border border-slate-200/80 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">
                Phone OS Control
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {inApk
                  ? 'Native Android Bridge Connected · Zero Background Drain'
                  : 'Web Intent Mode · Install APK for Full Native OS Control'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!inApk && (
          <div className="p-3.5 rounded-2xl bg-[#F5F6F8] dark:bg-[#1C2230] flex items-center justify-between gap-3">
            <div className="text-xs text-slate-700 dark:text-slate-200">
              <div className="font-semibold">Install Official Android APK</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Featherlight (~195 KB) · Native Alarms, Calls, WhatsApp & Settings
              </div>
            </div>
            <a
              href="./OpenBrain-AI.apk"
              download="OpenBrain-AI.apk"
              className="shrink-0 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> APK
            </a>
          </div>
        )}

        <div className="text-xs text-slate-500 dark:text-slate-400">
          You can simply type any phone command in chat (e.g., <i>"Set alarm for 6:30 AM"</i> or <i>"Open Wi-Fi settings"</i>), or tap a quick test below:
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => runDirect('battery_status', 'Battery Check', {})}
            className="p-3 rounded-2xl bg-[#F5F6F8] dark:bg-[#1C2230] text-left flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <BatteryCharging className="w-4 h-4 shrink-0" />
            Check Battery
          </button>

          <button
            type="button"
            onClick={() =>
              runDirect('set_alarm', 'Morning Alarm', {
                hour: 7,
                minute: 0,
                message: 'Open Brain Alarm',
              })
            }
            className="p-3 rounded-2xl bg-[#F5F6F8] dark:bg-[#1C2230] text-left flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <AlarmClock className="w-4 h-4 shrink-0" />
            Set 7:00 AM Alarm
          </button>

          <button
            type="button"
            onClick={() =>
              runDirect('set_timer', 'Focus Timer', {
                seconds: 300,
                message: 'Open Brain 5m Timer',
              })
            }
            className="p-3 rounded-2xl bg-[#F5F6F8] dark:bg-[#1C2230] text-left flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <Timer className="w-4 h-4 shrink-0" />
            Start 5m Timer
          </button>

          <button
            type="button"
            onClick={() =>
              runDirect('open_settings', 'Wi-Fi Settings', { section: 'wifi' })
            }
            className="p-3 rounded-2xl bg-[#F5F6F8] dark:bg-[#1C2230] text-left flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <Settings className="w-4 h-4 shrink-0" />
            Wi-Fi Settings
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onSendChatPrompt('Send a WhatsApp message saying: ');
            }}
            className="p-3 rounded-2xl bg-[#F5F6F8] dark:bg-[#1C2230] text-left flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            WhatsApp via Chat
          </button>

          <button
            type="button"
            onClick={() =>
              runDirect('open_maps', 'Nearby Places', { query: 'nearest cafe' })
            }
            className="p-3 rounded-2xl bg-[#F5F6F8] dark:bg-[#1C2230] text-left flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <MapPin className="w-4 h-4 shrink-0" />
            Open Maps
          </button>
        </div>

        {statusOutput && (
          <div className="p-3 rounded-xl bg-slate-900 dark:bg-teal-950/50 text-white dark:text-teal-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{statusOutput}</span>
          </div>
        )}
      </div>
    </div>
  );
};
