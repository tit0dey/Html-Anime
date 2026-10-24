import React, { useRef, useState } from 'react';
import {
  AudioWaveform,
  CheckCircle2,
  Loader2,
  Mic,
  Square,
  Upload,
} from 'lucide-react';
import { VoiceProfile } from '../types';
import { analyzeVocalBiometrics } from '../services/voiceCloneEngine';
import { triggerHaptic } from '../services/nativeBridge';

interface Props {
  profiles: VoiceProfile[];
  activeProfileId: string;
  onSaveProfile: (profile: VoiceProfile) => void;
  onSelectProfile: (id: string) => void;
}

export const InlineVoiceRecorderCard: React.FC<Props> = ({
  profiles,
  activeProfileId,
  onSaveProfile,
  onSelectProfile,
}) => {
  const [voiceName, setVoiceName] = useState('My Voice');
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

  const ingestAudio = async (blob: Blob, label?: string) => {
    setAnalyzing(true);
    try {
      const [{ durationSec, biometrics }, dataUrl] = await Promise.all([
        analyzeVocalBiometrics(blob),
        blobToDataUrl(blob),
      ]);
      const created: VoiceProfile = {
        id: `vp-${Date.now()}`,
        name: (label || voiceName || 'My Cloned Voice').trim(),
        createdAt: Date.now(),
        audioDataUrl: dataUrl,
        durationSec,
        referenceText: 'Hello, this is my natural speaking voice sample for Open Brain.',
        biometrics,
      };
      onSaveProfile(created);
      setStatusError(null);
      triggerHaptic(25);
    } catch (err: any) {
      setStatusError(`Could not process audio sample: ${err?.message || String(err)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const startRec = async () => {
    setStatusError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        await ingestAudio(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start(200);
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s >= 12) {
            stopRec();
            return 12;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setStatusError('Microphone permission is needed to record live. You can also upload any .wav or .mp3 voice clip.');
    }
  };

  const stopRec = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F8F9FB] dark:bg-[#151A24] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-teal-500/20 text-white dark:text-teal-300 flex items-center justify-center">
            <AudioWaveform className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Zero-Shot Voice Clone Studio
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Record 6-12s or upload audio — then ask in chat to speak anything in your voice
            </div>
          </div>
        </div>
      </div>

      <input
        type="text"
        value={voiceName}
        onChange={(e) => setVoiceName(e.target.value)}
        placeholder="Voice profile name (e.g., My Voice)"
        className="w-full rounded-xl bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        {!isRecording ? (
          <button
            type="button"
            disabled={analyzing}
            onClick={startRec}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Mic className="w-3.5 h-3.5" /> Record Voice (6-12s)
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRec}
            className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5 fill-white" /> Stop ({seconds}s / 12s)
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await ingestAudio(f, voiceName || f.name.replace(/\.[^.]+$/, ''));
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={analyzing || isRecording}
          onClick={() => fileRef.current?.click()}
          className="py-2.5 px-3 rounded-xl bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
        >
          {analyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          Upload Audio
        </button>
      </div>

      {statusError && (
        <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-xl px-3 py-2">
          {statusError}
        </div>
      )}

      {profiles.length > 0 && (
        <div className="pt-1 space-y-1.5">
          {profiles.slice(0, 3).map((p) => {
            const active = p.id === activeProfileId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProfile(p.id)}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs ${
                  active
                    ? 'border-slate-900 dark:border-teal-400 bg-white dark:bg-[#0E121A]'
                    : 'border-slate-200 dark:border-slate-800 opacity-75'
                }`}
              >
                <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      active ? 'text-slate-900 dark:text-teal-400' : 'text-slate-400'
                    }`}
                  />
                  {p.name} · {p.biometrics.pitchHz}Hz ({p.biometrics.timbreLabel})
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-teal-300">
                  {active ? 'Active' : 'Use'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
