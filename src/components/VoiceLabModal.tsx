import React, { useState } from 'react';
import {
  AudioWaveform,
  Download,
  Loader2,
  Server,
  Sliders,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { AppSettings, SynthesizedClip, VoiceProfile } from '../types';
import {
  synthesizeClonedVoice,
  VoiceboxEffectPreset,
} from '../services/voiceCloneEngine';
import { saveFileCrossPlatform, showNativeToast } from '../services/nativeBridge';
import { InlineVoiceRecorderCard } from './InlineVoiceRecorderCard';

interface Props {
  open: boolean;
  settings: AppSettings;
  profiles: VoiceProfile[];
  onUpdateSettings?: (patch: Partial<AppSettings>) => void;
  onSaveProfile: (profile: VoiceProfile) => void;
  onDeleteProfile: (id: string) => void;
  onSelectProfile: (id: string) => void;
  onGeneratedClip: (clip: SynthesizedClip) => void;
  onClose: () => void;
}

const PRESET_OPTIONS: Array<{ id: VoiceboxEffectPreset; label: string }> = [
  { id: 'natural', label: 'Natural Clone' },
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'deep', label: 'Deep Voice' },
  { id: 'echo', label: 'Echo Chamber' },
  { id: 'radio', label: 'Radio FX' },
];

export const VoiceLabModal: React.FC<Props> = ({
  open,
  settings,
  profiles,
  onUpdateSettings,
  onSaveProfile,
  onDeleteProfile,
  onSelectProfile,
  onGeneratedClip,
  onClose,
}) => {
  const [testScript, setTestScript] = useState(
    'Hello! This is my cloned voice running inside Open Brain with Voicebox engine.'
  );
  const [synthesizing, setSynthesizing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [previewClip, setPreviewClip] = useState<SynthesizedClip | null>(null);
  const [showVoiceboxServer, setShowVoiceboxServer] = useState(false);

  if (!open) return null;

  const activeProfile =
    profiles.find((p) => p.id === settings.activeVoiceProfileId) ||
    profiles[0] ||
    null;

  const activePreset: VoiceboxEffectPreset = settings.voiceboxEffectPreset || 'natural';

  const handleTestSpeak = async () => {
    if (!testScript.trim() || synthesizing) return;
    setSynthesizing(true);
    setErrorNote(null);
    setLiveStatus('Initializing Voicebox Multi-Engine Synthesizer...');
    try {
      const out = await synthesizeClonedVoice({
        text: testScript,
        profile: activeProfile,
        presetVoice: 'echo',
        tryZeroShotNeural: true,
        hfToken: settings.hfToken,
        voiceboxServerUrl: settings.voiceboxServerUrl,
        effectPreset: activePreset,
        onStatus: (msg) => setLiveStatus(msg),
      });
      const clip: SynthesizedClip = {
        id: `vc-${Date.now()}`,
        text: testScript,
        voiceName: activeProfile ? activeProfile.name : 'Voicebox Studio',
        engineUsed: out.engineUsed,
        audioUrl: out.url,
        createdAt: Date.now(),
      };
      setPreviewClip(clip);
      onGeneratedClip(clip);
      setLiveStatus(`Ready · ${out.engineUsed}`);
      showNativeToast('Voice clone audio ready!');
    } catch (err: any) {
      setErrorNote(`Could not synthesize right now: ${err?.message || String(err)}`);
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F6F8] dark:bg-[#0B0E14] overflow-y-auto animate-sheet-up">
      <div className="max-w-xl mx-auto px-4 pt-[calc(0.9rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AudioWaveform className="w-5 h-5 text-slate-900 dark:text-white" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Voicebox Cloning Lab
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Chatterbox · Qwen3-TTS · F5-TTS · Vocal DNA Pedalboard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#161B24] flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Record a 6–12s voice sample or upload an audio clip. Open Brain clones your voice using Voicebox Cloud Engines (Chatterbox / Qwen3-TTS / F5-TTS) + Vocal DNA Pedalboard DSP with zero phone load.
        </p>

        <InlineVoiceRecorderCard
          profiles={profiles}
          activeProfileId={activeProfile?.id || ''}
          onSaveProfile={onSaveProfile}
          onSelectProfile={onSelectProfile}
        />

        {/* Voicebox Pedalboard Post-Processing Presets */}
        <div className="rounded-2xl bg-white dark:bg-[#141821] p-4 space-y-2.5 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
              <Sliders className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Voicebox Pedalboard Effects
            </span>
            <button
              type="button"
              onClick={() => setShowVoiceboxServer((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <Server className="w-3.5 h-3.5" />
              {settings.voiceboxServerUrl?.trim() ? 'Voicebox Linked' : 'Link Voicebox PC'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_OPTIONS.map((opt) => {
              const selected = activePreset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings?.({ voiceboxEffectPreset: opt.id })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                    selected
                      ? 'bg-slate-900 text-white dark:bg-teal-500 dark:text-slate-950'
                      : 'bg-[#F5F6F8] dark:bg-[#0E121A] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {showVoiceboxServer && (
            <div className="pt-2 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Optional: Connect a desktop <span className="font-semibold">jamiepine/voicebox</span> server (e.g. <code className="text-[10px]">http://192.168.1.50:17493</code>). Leave blank to use built-in free Cloud Voicebox + Vocal DNA engine.
              </div>
              <input
                type="url"
                value={settings.voiceboxServerUrl || ''}
                onChange={(e) =>
                  onUpdateSettings?.({ voiceboxServerUrl: e.target.value })
                }
                placeholder="http://192.168.1.50:17493 (Optional)"
                className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          )}
        </div>

        {profiles.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-[#141821] p-4 space-y-2 border border-slate-200/80 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Saved Voice Clones ({profiles.length})
            </div>
            {profiles.map((p) => (
              <div
                key={p.id}
                className="p-2.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {p.name} ({p.durationSec}s · {p.biometrics.pitchHz}Hz)
                  </div>
                  <audio src={p.audioDataUrl} controls className="h-7 w-48 mt-1" />
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteProfile(p.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Instant Test Card */}
        <div className="rounded-2xl bg-white dark:bg-[#141821] p-4 space-y-3 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-900 dark:text-white">
            Test Speech Synthesis ({activeProfile ? activeProfile.name : 'Voicebox Studio'})
          </div>
          <textarea
            value={testScript}
            onChange={(e) => setTestScript(e.target.value)}
            rows={2}
            placeholder="Write in English, Bangla, Hindi, or any language..."
            className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] p-3 text-xs text-slate-900 dark:text-white focus:outline-none"
          />
          <button
            type="button"
            disabled={!testScript.trim() || synthesizing}
            onClick={handleTestSpeak}
            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {synthesizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Synthesizing...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" /> Speak Now
              </>
            )}
          </button>

          {liveStatus && (
            <div className="text-[11px] text-teal-700 dark:text-teal-300 bg-teal-500/10 rounded-xl px-3 py-2">
              {liveStatus}
            </div>
          )}

          {errorNote && (
            <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-xl px-3 py-2">
              {errorNote}
            </div>
          )}

          {previewClip && (
            <div className="p-3 rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] space-y-2">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {previewClip.voiceName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {previewClip.engineUsed}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    saveFileCrossPlatform(
                      previewClip.audioUrl,
                      `OpenBrainVoice-${previewClip.id}.wav`,
                      'audio/wav'
                    )
                  }
                  className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-teal-400 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Save WAV
                </button>
              </div>
              <audio src={previewClip.audioUrl} controls autoPlay className="w-full h-8" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
